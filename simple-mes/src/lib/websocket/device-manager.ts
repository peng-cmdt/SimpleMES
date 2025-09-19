// 设备连接池管理器
import EventEmitter from 'events';

export interface DeviceConnection {
  deviceId: string;
  instanceId: string;
  ipAddress: string;
  port: number;
  isConnected: boolean;
  lastActivity: Date;
  connectionTime?: Date;
  reconnectAttempts: number;
  client?: any; // PLC客户端实例
}

export interface PLCAddress {
  type: string;
  dbNumber?: number;
  byte?: number;
  bit?: number;
  address: string;
}

export class DeviceManager extends EventEmitter {
  private connections: Map<string, DeviceConnection> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 5000;
  
  constructor() {
    super();
    this.startConnectionMonitor();
  }
  
  // 获取或创建设备连接
  public async getConnection(deviceId: string): Promise<DeviceConnection> {
    let connection = this.connections.get(deviceId);
    
    if (!connection) {
      // 需要从数据库获取设备信息并创建连接
      connection = await this.createConnection(deviceId);
    }
    
    // 检查连接状态
    if (!connection.isConnected) {
      await this.reconnectDevice(deviceId);
    }
    
    return connection;
  }
  
  // 创建新连接
  private async createConnection(deviceId: string): Promise<DeviceConnection> {
    try {
      // 获取设备信息（这里需要调用现有的API）
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/device-communication/devices/${deviceId}/status`);
      const data = await response.json();
      
      const connection: DeviceConnection = {
        deviceId: deviceId,
        instanceId: deviceId,
        ipAddress: data.ipAddress || '127.0.0.1',
        port: data.port || 102,
        isConnected: false,
        lastActivity: new Date(),
        reconnectAttempts: 0
      };
      
      this.connections.set(deviceId, connection);
      
      // 尝试连接
      await this.connectDevice(deviceId);
      
      return connection;
    } catch (error) {

      throw error;
    }
  }
  
  // 连接设备
  private async connectDevice(deviceId: string): Promise<boolean> {
    const connection = this.connections.get(deviceId);
    if (!connection) return false;
    
    try {

      
      // 调用现有的连接API
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/device-communication/devices/${deviceId}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        connection.isConnected = true;
        connection.connectionTime = new Date();
        connection.reconnectAttempts = 0;
        

        this.emit('device:connected', { deviceId, connection });
        
        return true;
      } else {
        throw new Error(result.error || '连接失败');
      }
    } catch (error) {

      connection.isConnected = false;
      
      this.emit('device:disconnected', { deviceId, error });
      
      // 安排重连
      this.scheduleReconnect(deviceId);
      
      return false;
    }
  }
  
  // 重连设备
  private async reconnectDevice(deviceId: string): Promise<boolean> {
    const connection = this.connections.get(deviceId);
    if (!connection) return false;
    
    if (connection.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {

      this.emit('device:reconnect:failed', { deviceId });
      return false;
    }
    
    connection.reconnectAttempts++;

    
    return await this.connectDevice(deviceId);
  }
  
  // 安排重连
  private scheduleReconnect(deviceId: string) {
    // 清除现有的重连定时器
    const existingTimer = this.reconnectTimers.get(deviceId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // 设置新的重连定时器
    const timer = setTimeout(async () => {
      await this.reconnectDevice(deviceId);
      this.reconnectTimers.delete(deviceId);
    }, this.RECONNECT_DELAY);
    
    this.reconnectTimers.set(deviceId, timer);
  }
  
  // 读取PLC数据
  public async readPLC(deviceId: string, address: PLCAddress): Promise<any> {
    const connection = await this.getConnection(deviceId);
    
    if (!connection.isConnected) {
      throw new Error(`设备未连接: ${deviceId}`);
    }
    
    try {
      // 调用现有的读取API
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/device-communication/devices/${deviceId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(address)
      });
      
      const result = await response.json();
      
      if (result.success) {
        connection.lastActivity = new Date();
        return result.value;
      } else {
        throw new Error(result.error || '读取失败');
      }
    } catch (error) {

      
      // 检查是否需要重连
      if (this.isConnectionError(error)) {
        connection.isConnected = false;
        this.scheduleReconnect(deviceId);
      }
      
      throw error;
    }
  }
  
  // 写入PLC数据
  public async writePLC(deviceId: string, address: string, value: any): Promise<any> {
    const connection = await this.getConnection(deviceId);
    
    if (!connection.isConnected) {
      throw new Error(`设备未连接: ${deviceId}`);
    }
    
    try {
      // 调用现有的写入API
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/device-communication/devices/${deviceId}/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, value })
      });
      
      const result = await response.json();
      
      if (result.success) {
        connection.lastActivity = new Date();
        return result;
      } else {
        throw new Error(result.error || '写入失败');
      }
    } catch (error) {

      
      // 检查是否需要重连
      if (this.isConnectionError(error)) {
        connection.isConnected = false;
        this.scheduleReconnect(deviceId);
      }
      
      throw error;
    }
  }
  
  // 批量读取PLC数据
  public async batchReadPLC(deviceId: string, addresses: PLCAddress[]): Promise<any[]> {
    const connection = await this.getConnection(deviceId);
    
    if (!connection.isConnected) {
      throw new Error(`设备未连接: ${deviceId}`);
    }
    
    try {
      // 批量读取优化：合并相邻地址
      const optimizedAddresses = this.optimizeAddresses(addresses);
      const results: any[] = [];
      
      // 并行读取多个地址
      const readPromises = optimizedAddresses.map(addr => this.readPLC(deviceId, addr));
      const values = await Promise.all(readPromises);
      
      // 映射回原始地址
      for (let i = 0; i < addresses.length; i++) {
        results.push(values[i] || null);
      }
      
      return results;
    } catch (error) {

      throw error;
    }
  }
  
  // 优化地址列表（合并相邻地址）
  private optimizeAddresses(addresses: PLCAddress[]): PLCAddress[] {
    // 这里可以实现地址合并优化逻辑
    // 比如将连续的DB块地址合并为一次读取
    return addresses;
  }
  
  // 判断是否为连接错误
  private isConnectionError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';
    return errorMessage.includes('timeout') || 
           errorMessage.includes('connection') ||
           errorMessage.includes('disconnected') ||
           errorMessage.includes('econnrefused');
  }
  
  // 获取设备状态
  public getDeviceStatus(deviceId: string): any {
    const connection = this.connections.get(deviceId);
    
    if (!connection) {
      return {
        isConnected: false,
        status: 'unknown'
      };
    }
    
    return {
      isConnected: connection.isConnected,
      status: connection.isConnected ? 'connected' : 'disconnected',
      ipAddress: connection.ipAddress,
      port: connection.port,
      lastActivity: connection.lastActivity,
      connectionTime: connection.connectionTime,
      reconnectAttempts: connection.reconnectAttempts
    };
  }
  
  // 获取所有连接状态
  public getAllStatus(): Map<string, any> {
    const status = new Map();
    
    for (const [deviceId, connection] of this.connections) {
      status.set(deviceId, this.getDeviceStatus(deviceId));
    }
    
    return status;
  }
  
  // 断开设备连接
  public async disconnectDevice(deviceId: string): Promise<void> {
    const connection = this.connections.get(deviceId);
    if (!connection) return;
    
    try {
      // 调用现有的断开API
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/device-communication/devices/${deviceId}/disconnect`, {
        method: 'POST'
      });
      
      connection.isConnected = false;
      
      // 清除重连定时器
      const timer = this.reconnectTimers.get(deviceId);
      if (timer) {
        clearTimeout(timer);
        this.reconnectTimers.delete(deviceId);
      }
      

      this.emit('device:disconnected', { deviceId });
    } catch (error) {

    }
  }
  
  // 连接监控
  private startConnectionMonitor() {
    setInterval(() => {
      for (const [deviceId, connection] of this.connections) {
        // 检查长时间未活动的连接
        const inactiveTime = Date.now() - connection.lastActivity.getTime();
        if (inactiveTime > 5 * 60 * 1000) { // 5分钟未活动

          // 可以发送心跳或重连
        }
      }
    }, 60000); // 每分钟检查一次
  }
  
  // 清理资源
  public async cleanup() {
    // 断开所有连接
    for (const deviceId of this.connections.keys()) {
      await this.disconnectDevice(deviceId);
    }
    
    // 清除所有定时器
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    
    this.connections.clear();
    this.reconnectTimers.clear();
  }
}