/**
 * WebSocket设备通信客户端 - 工业实时优化
 * 替代HTTP请求，实现长连接低延迟通信
 */

import { DeviceCacheManager } from '@/lib/device-cache/DeviceCacheManager';

interface DeviceCommand {
  id: string;
  deviceId: string;
  operation: 'READ' | 'WRITE' | 'CONNECT' | 'DISCONNECT' | 'BATCH_READ' | 'BATCH_WRITE';
  address?: string;
  value?: any;
  addresses?: string[];
  timestamp: string;
  timeout?: number;
}

interface DeviceResponse {
  commandId: string;
  deviceId: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
  responseTime?: number;
}

interface PendingCommand {
  resolve: (response: DeviceResponse) => void;
  reject: (error: Error) => void;
  startTime: number;
  timeout: NodeJS.Timeout;
}

class WebSocketDeviceClient {
  private static instance: WebSocketDeviceClient;
  private websocket: WebSocket | null = null;
  private pendingCommands: Map<string, PendingCommand> = new Map();
  private eventListeners: Map<string, Set<Function>> = new Map();
  private isConnected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private cache = DeviceCacheManager.getInstance();
  
  // 工业优化配置
  private readonly WS_URL = 'ws://localhost:5000/ws';
  private readonly COMMAND_TIMEOUT = 300; // 300ms命令超时
  private readonly HEARTBEAT_INTERVAL = 10000; // 10秒心跳
  private readonly RECONNECT_DELAY = 1000; // 1秒重连延迟
  
  private heartbeatTimer: NodeJS.Timeout | null = null;
  
  private constructor() {
    this.connect();
  }
  
  static getInstance(): WebSocketDeviceClient {
    if (!WebSocketDeviceClient.instance) {
      WebSocketDeviceClient.instance = new WebSocketDeviceClient();
    }
    return WebSocketDeviceClient.instance;
  }
  
  // 建立WebSocket连接
  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('正在连接设备WebSocket服务...');
        this.websocket = new WebSocket(this.WS_URL);
        
        this.websocket.onopen = () => {
          console.log('设备WebSocket连接成功');
          this.isConnected = true;
          this.startHeartbeat();
          this.emit('connected');
          resolve();
        };
        
        this.websocket.onmessage = (event) => {
          try {
            const response: DeviceResponse = JSON.parse(event.data);
            this.handleResponse(response);
          } catch (error) {
            console.error('WebSocket消息解析失败:', error);
          }
        };
        
        this.websocket.onclose = () => {
          console.log('设备WebSocket连接关闭');
          this.isConnected = false;
          this.stopHeartbeat();
          this.emit('disconnected');
          this.scheduleReconnect();
        };
        
        this.websocket.onerror = (error) => {
          console.error('设备WebSocket错误:', error);
          this.isConnected = false;
          this.emit('error', error);
          reject(error);
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // 处理服务器响应
  private handleResponse(response: DeviceResponse): void {
    const pending = this.pendingCommands.get(response.commandId);
    
    if (pending) {
      // 计算响应时间
      const responseTime = Date.now() - pending.startTime;
      response.responseTime = responseTime;
      
      // 清除超时定时器
      clearTimeout(pending.timeout);
      this.pendingCommands.delete(response.commandId);
      
      // 更新缓存
      if (response.success && response.data) {
        this.cache.setDeviceStatus(response.deviceId, response.data, 500);
      }
      
      // 解析响应
      pending.resolve(response);
    } else if (response.deviceId) {
      // 实时状态更新消息
      this.emit('device_status_update', {
        deviceId: response.deviceId,
        status: response.data,
        timestamp: response.timestamp
      });
    }
  }
  
  // 发送设备命令
  async sendCommand(command: Omit<DeviceCommand, 'id' | 'timestamp'>): Promise<DeviceResponse> {
    if (!this.isConnected) {
      throw new Error('WebSocket未连接');
    }
    
    const commandId = this.generateCommandId();
    const fullCommand: DeviceCommand = {
      id: commandId,
      timestamp: new Date().toISOString(),
      timeout: this.COMMAND_TIMEOUT,
      ...command
    };
    
    return new Promise((resolve, reject) => {
      // 设置超时
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(commandId);
        reject(new Error('命令执行超时'));
      }, fullCommand.timeout || this.COMMAND_TIMEOUT);
      
      // 记录待处理命令
      this.pendingCommands.set(commandId, {
        resolve,
        reject,
        startTime: Date.now(),
        timeout
      });
      
      // 发送命令
      try {
        this.websocket!.send(JSON.stringify(fullCommand));
      } catch (error) {
        this.pendingCommands.delete(commandId);
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
  
  // 读取设备值
  async readDevice(deviceId: string, address: string, parameters?: any): Promise<any> {
    const response = await this.sendCommand({
      deviceId,
      operation: 'READ',
      address,
      ...parameters
    });
    
    if (!response.success) {
      throw new Error(response.error || 'READ操作失败');
    }
    
    return response.data;
  }
  
  // 写入设备值
  async writeDevice(deviceId: string, address: string, value: any, parameters?: any): Promise<boolean> {
    const response = await this.sendCommand({
      deviceId,
      operation: 'WRITE',
      address,
      value,
      ...parameters
    });
    
    if (!response.success) {
      throw new Error(response.error || 'WRITE操作失败');
    }
    
    return true;
  }
  
  // 连接设备
  async connectDevice(deviceId: string): Promise<boolean> {
    const response = await this.sendCommand({
      deviceId,
      operation: 'CONNECT'
    });
    
    if (response.success) {
      this.cache.updateConnectionStatus(deviceId, true);
    }
    
    return response.success;
  }
  
  // 批量读取
  async batchRead(deviceId: string, addresses: string[]): Promise<Map<string, any>> {
    const response = await this.sendCommand({
      deviceId,
      operation: 'BATCH_READ',
      addresses
    });
    
    const result = new Map<string, any>();
    if (response.success && response.data) {
      for (const item of response.data) {
        result.set(item.address, item.value);
      }
    }
    
    return result;
  }
  
  // 批量写入
  async batchWrite(deviceId: string, operations: Array<{address: string, value: any}>): Promise<boolean> {
    const response = await this.sendCommand({
      deviceId,
      operation: 'BATCH_WRITE',
      addresses: operations.map(op => op.address),
      value: operations // 传递完整操作数组
    });
    
    return response.success;
  }
  
  // 事件监听
  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }
  
  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }
  
  private emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`WebSocket事件监听器错误 '${event}':`, error);
        }
      });
    }
  }
  
  // 心跳机制
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected && this.websocket) {
        try {
          this.websocket.send(JSON.stringify({ type: 'ping' }));
        } catch (error) {
          console.error('心跳发送失败:', error);
        }
      }
    }, this.HEARTBEAT_INTERVAL);
  }
  
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
  
  // 重连机制
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.reconnectTimer = setTimeout(() => {
      console.log('尝试重连设备WebSocket...');
      this.connect().catch(error => {
        console.error('重连失败:', error);
        this.scheduleReconnect();
      });
    }, this.RECONNECT_DELAY);
  }
  
  // 生成命令ID
  private generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // 获取连接状态
  get connected(): boolean {
    return this.isConnected;
  }
  
  // 获取统计信息
  getStats() {
    return {
      connected: this.isConnected,
      pendingCommands: this.pendingCommands.size,
      cacheStats: this.cache.getStats()
    };
  }
  
  // 断开连接
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHeartbeat();
    
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    this.isConnected = false;
    
    // 清除所有待处理命令
    for (const [id, pending] of this.pendingCommands) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('WebSocket连接已断开'));
    }
    this.pendingCommands.clear();
  }
}

export default WebSocketDeviceClient;
export { WebSocketDeviceClient, type DeviceCommand, type DeviceResponse };