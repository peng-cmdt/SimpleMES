// WebSocket客户端管理器
import { io, Socket } from 'socket.io-client';

export interface WebSocketConfig {
  url?: string;
  userId?: string;
  workstationId?: string;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  heartbeatInterval?: number;
}

export interface PLCSubscription {
  deviceId: string;
  address: string;
  interval?: number;
  callback: (data: any) => void;
}

export class WebSocketClient {
  private socket: Socket | null = null;
  private config: WebSocketConfig;
  private subscriptions: Map<string, PLCSubscription> = new Map();
  private eventListeners: Map<string, Set<Function>> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;
  
  constructor(config: WebSocketConfig = {}) {
    this.config = {
      url: config.url || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      autoReconnect: config.autoReconnect !== false,
      reconnectInterval: config.reconnectInterval || 5000,
      heartbeatInterval: config.heartbeatInterval || 30000,
      ...config
    };
  }
  
  // 连接WebSocket服务器
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }
      
      if (this.isConnecting) {
        // 等待当前连接完成
        const checkConnection = setInterval(() => {
          if (this.socket?.connected) {
            clearInterval(checkConnection);
            resolve();
          }
        }, 100);
        return;
      }
      
      this.isConnecting = true;

      
      this.socket = io(this.config.url!, {
        transports: ['websocket', 'polling'],
        reconnection: false, // 我们自己处理重连
        timeout: 10000
      });
      
      // 连接成功
      this.socket.on('connect', () => {

        this.isConnecting = false;
        
        // 发送认证信息
        if (this.config.userId || this.config.workstationId) {
          this.authenticate();
        }
        
        // 开始心跳
        this.startHeartbeat();
        
        // 触发连接事件
        this.emit('connected', { socketId: this.socket!.id });
        
        resolve();
      });
      
      // 连接失败
      this.socket.on('connect_error', (error) => {

        this.isConnecting = false;
        
        // 触发错误事件
        this.emit('error', { error: error.message });
        
        // 自动重连
        if (this.config.autoReconnect) {
          this.scheduleReconnect();
        }
        
        reject(error);
      });
      
      // 断开连接
      this.socket.on('disconnect', (reason) => {

        
        // 停止心跳
        this.stopHeartbeat();
        
        // 触发断开事件
        this.emit('disconnected', { reason });
        
        // 自动重连
        if (this.config.autoReconnect && reason !== 'io client disconnect') {
          this.scheduleReconnect();
        }
      });
      
      // 设置默认事件处理
      this.setupDefaultHandlers();
    });
  }
  
  // 断开连接
  public disconnect() {
    this.config.autoReconnect = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHeartbeat();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    

  }
  
  // 认证
  private authenticate() {
    if (!this.socket?.connected) return;
    
    this.socket.emit('authenticate', {
      userId: this.config.userId,
      workstationId: this.config.workstationId
    });
    
    this.socket.once('authenticated', (data) => {
      if (data.success) {

        this.emit('authenticated', data);
        
        // 恢复订阅
        this.restoreSubscriptions();
      } else {

        this.emit('authentication_failed', data);
      }
    });
  }
  
  // 订阅PLC数据
  public subscribePLC(
    deviceId: string,
    address: string,
    interval: number = 100,
    callback: (data: any) => void
  ): string {
    const subscriptionKey = `plc:${deviceId}:${address}`;
    
    // 保存订阅信息
    this.subscriptions.set(subscriptionKey, {
      deviceId,
      address,
      interval,
      callback
    });
    
    // 如果已连接，立即订阅
    if (this.socket?.connected) {
      this.socket.emit('subscribe:plc', {
        deviceId,
        address,
        interval
      });
      
      // 监听数据更新
      this.socket.on('plc:data:update', (data) => {
        if (data.subscriptionKey === subscriptionKey) {
          callback(data);
        }
      });
      

    }
    
    return subscriptionKey;
  }
  
  // 取消订阅PLC数据
  public unsubscribePLC(subscriptionKey: string) {
    const subscription = this.subscriptions.get(subscriptionKey);
    if (!subscription) return;
    
    this.subscriptions.delete(subscriptionKey);
    
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe:plc', {
        deviceId: subscription.deviceId,
        address: subscription.address
      });
      

    }
  }
  
  // PLC写入
  public writePLC(
    deviceId: string,
    address: string,
    value: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('WebSocket未连接'));
        return;
      }
      
      const requestId = Date.now().toString();
      
      this.socket.emit('plc:write', {
        deviceId,
        address,
        value,
        requestId
      });
      
      // 等待响应
      const timeout = setTimeout(() => {
        reject(new Error('PLC写入超时'));
      }, 5000);
      
      this.socket.once('plc:write:result', (data) => {
        clearTimeout(timeout);
        
        if (data.requestId === requestId) {
          if (data.success) {
            resolve(data);
          } else {
            reject(new Error(data.error || 'PLC写入失败'));
          }
        }
      });
    });
  }
  
  // 批量读取PLC
  public batchReadPLC(
    deviceId: string,
    addresses: string[]
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('WebSocket未连接'));
        return;
      }
      
      const requestId = Date.now().toString();
      
      this.socket.emit('plc:batch:read', {
        deviceId,
        addresses,
        requestId
      });
      
      // 等待响应
      const timeout = setTimeout(() => {
        reject(new Error('批量读取超时'));
      }, 5000);
      
      this.socket.once('plc:batch:read:result', (data) => {
        clearTimeout(timeout);
        
        if (data.requestId === requestId) {
          if (data.success) {
            resolve(data.data);
          } else {
            reject(new Error(data.error || '批量读取失败'));
          }
        }
      });
    });
  }
  
  // 订阅订单更新
  public subscribeOrders(workstationId: string, callback: (orders: any[]) => void) {
    if (!this.socket?.connected) return;
    
    this.socket.emit('subscribe:orders', { workstationId });
    
    this.socket.on('orders:update', (data) => {
      if (data.workstationId === workstationId) {
        callback(data.orders);
      }
    });
    

  }
  
  // 订阅设备状态
  public subscribeDeviceStatus(deviceId: string, callback: (status: any) => void) {
    if (!this.socket?.connected) return;
    
    this.socket.emit('subscribe:device:status', { deviceId });
    
    this.socket.on('device:status:update', (data) => {
      if (data.deviceId === deviceId) {
        callback(data);
      }
    });
    

  }
  
  // 添加事件监听
  public on(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }
  
  // 移除事件监听
  public off(event: string, callback: Function) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }
  
  // 触发事件
  private emit(event: string, data?: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }
  
  // 设置默认事件处理
  private setupDefaultHandlers() {
    if (!this.socket) return;
    
    // PLC数据更新
    this.socket.on('plc:data:update', (data) => {
      const subscription = this.subscriptions.get(data.subscriptionKey);
      if (subscription) {
        subscription.callback(data);
      }
    });
    
    // 心跳响应
    this.socket.on('pong', (data) => {

    });
  }
  
  // 恢复订阅
  private restoreSubscriptions() {
    // 恢复PLC订阅
    for (const [key, subscription] of this.subscriptions) {
      this.socket!.emit('subscribe:plc', {
        deviceId: subscription.deviceId,
        address: subscription.address,
        interval: subscription.interval
      });

    }
  }
  
  // 开始心跳
  private startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, this.config.heartbeatInterval!);
  }
  
  // 停止心跳
  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
  
  // 安排重连
  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    

    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(error => {

      });
    }, this.config.reconnectInterval!);
  }
  
  // 获取连接状态
  public isConnected(): boolean {
    return this.socket?.connected || false;
  }
  
  // 获取Socket ID
  public getSocketId(): string | null {
    return this.socket?.id || null;
  }
}