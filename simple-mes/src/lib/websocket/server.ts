import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { DeviceManager } from './device-manager';
import { PLCMonitor } from './plc-monitor';

export interface WebSocketMessage {
  type: string;
  payload?: any;
  timestamp?: number;
}

export interface ClientSession {
  socketId: string;
  userId?: string;
  workstationId?: string;
  subscriptions: Set<string>;
  lastActivity: Date;
}

export class WebSocketServer {
  private io: SocketIOServer;
  private sessions: Map<string, ClientSession> = new Map();
  private deviceManager: DeviceManager;
  private plcMonitor: PLCMonitor;
  
  constructor(httpServer: HTTPServer) {
    // 初始化Socket.IO服务器
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });
    
    // 初始化设备管理器和PLC监控器
    this.deviceManager = new DeviceManager();
    this.plcMonitor = new PLCMonitor(this.deviceManager, this);
    
    this.setupEventHandlers();
    this.startHeartbeat();
  }
  
  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {

      
      // 创建会话
      const session: ClientSession = {
        socketId: socket.id,
        subscriptions: new Set(),
        lastActivity: new Date()
      };
      this.sessions.set(socket.id, session);
      
      // 发送连接确认
      socket.emit('connected', {
        socketId: socket.id,
        timestamp: Date.now()
      });
      
      // 处理认证
      socket.on('authenticate', (data) => {
        session.userId = data.userId;
        session.workstationId = data.workstationId;

        
        // 加入工位房间
        if (data.workstationId) {
          socket.join(`workstation:${data.workstationId}`);
        }
        
        socket.emit('authenticated', { success: true });
      });
      
      // 订阅PLC监控
      socket.on('subscribe:plc', async (data) => {
        const { deviceId, address, interval = 100 } = data;
        const subscriptionKey = `plc:${deviceId}:${address}`;
        

        
        // 添加订阅
        session.subscriptions.add(subscriptionKey);
        socket.join(subscriptionKey);
        
        // 开始监控
        await this.plcMonitor.startMonitoring(
          deviceId,
          address,
          interval,
          subscriptionKey
        );
        
        socket.emit('subscribed:plc', {
          subscriptionKey,
          success: true
        });
      });
      
      // 取消订阅PLC监控
      socket.on('unsubscribe:plc', async (data) => {
        const { deviceId, address } = data;
        const subscriptionKey = `plc:${deviceId}:${address}`;
        

        
        // 移除订阅
        session.subscriptions.delete(subscriptionKey);
        socket.leave(subscriptionKey);
        
        // 检查是否还有其他客户端订阅
        const room = this.io.sockets.adapter.rooms.get(subscriptionKey);
        if (!room || room.size === 0) {
          // 没有其他订阅者，停止监控
          await this.plcMonitor.stopMonitoring(subscriptionKey);
        }
        
        socket.emit('unsubscribed:plc', {
          subscriptionKey,
          success: true
        });
      });
      
      // PLC写入操作
      socket.on('plc:write', async (data) => {
        const { deviceId, address, value } = data;
        
        try {
          const result = await this.deviceManager.writePLC(deviceId, address, value);
          socket.emit('plc:write:result', {
            success: result.success,
            error: result.error,
            requestId: data.requestId
          });
        } catch (error) {
          socket.emit('plc:write:result', {
            success: false,
            error: error instanceof Error ? error.message : 'Write failed',
            requestId: data.requestId
          });
        }
      });
      
      // 批量PLC读取
      socket.on('plc:batch:read', async (data) => {
        const { deviceId, addresses } = data;
        
        try {
          const results = await this.deviceManager.batchReadPLC(deviceId, addresses);
          socket.emit('plc:batch:read:result', {
            success: true,
            data: results,
            requestId: data.requestId
          });
        } catch (error) {
          socket.emit('plc:batch:read:result', {
            success: false,
            error: error instanceof Error ? error.message : 'Batch read failed',
            requestId: data.requestId
          });
        }
      });
      
      // 订阅订单更新
      socket.on('subscribe:orders', (data) => {
        const { workstationId } = data;
        const subscriptionKey = `orders:${workstationId}`;
        
        session.subscriptions.add(subscriptionKey);
        socket.join(subscriptionKey);
        

        socket.emit('subscribed:orders', { success: true });
      });
      
      // 订阅设备状态
      socket.on('subscribe:device:status', (data) => {
        const { deviceId } = data;
        const subscriptionKey = `device:status:${deviceId}`;
        
        session.subscriptions.add(subscriptionKey);
        socket.join(subscriptionKey);
        
        // 立即发送当前状态
        const status = this.deviceManager.getDeviceStatus(deviceId);
        socket.emit('device:status:update', {
          deviceId,
          ...status
        });
        

        socket.emit('subscribed:device:status', { success: true });
      });
      
      // 处理断开连接
      socket.on('disconnect', async () => {

        
        const session = this.sessions.get(socket.id);
        if (session) {
          // 清理订阅
          for (const subscriptionKey of session.subscriptions) {
            socket.leave(subscriptionKey);
            
            // 检查是否需要停止监控
            if (subscriptionKey.startsWith('plc:')) {
              const room = this.io.sockets.adapter.rooms.get(subscriptionKey);
              if (!room || room.size === 0) {
                await this.plcMonitor.stopMonitoring(subscriptionKey);
              }
            }
          }
          
          this.sessions.delete(socket.id);
        }
      });
      
      // 心跳响应
      socket.on('ping', () => {
        session.lastActivity = new Date();
        socket.emit('pong', { timestamp: Date.now() });
      });
    });
  }
  
  // 广播PLC数据更新
  public broadcastPLCUpdate(subscriptionKey: string, data: any) {
    this.io.to(subscriptionKey).emit('plc:data:update', {
      subscriptionKey,
      ...data,
      timestamp: Date.now()
    });
  }
  
  // 广播设备状态更新
  public broadcastDeviceStatus(deviceId: string, status: any) {
    const subscriptionKey = `device:status:${deviceId}`;
    this.io.to(subscriptionKey).emit('device:status:update', {
      deviceId,
      ...status,
      timestamp: Date.now()
    });
  }
  
  // 广播订单更新
  public broadcastOrderUpdate(workstationId: string, orders: any[]) {
    const subscriptionKey = `orders:${workstationId}`;
    this.io.to(subscriptionKey).emit('orders:update', {
      workstationId,
      orders,
      timestamp: Date.now()
    });
  }
  
  // 发送给特定工位
  public sendToWorkstation(workstationId: string, event: string, data: any) {
    this.io.to(`workstation:${workstationId}`).emit(event, data);
  }
  
  // 心跳检测
  private startHeartbeat() {
    setInterval(() => {
      const now = new Date();
      const timeout = 2 * 60 * 1000; // 2分钟超时
      
      for (const [socketId, session] of this.sessions) {
        if (now.getTime() - session.lastActivity.getTime() > timeout) {

          const socket = this.io.sockets.sockets.get(socketId);
          if (socket) {
            socket.disconnect(true);
          }
          this.sessions.delete(socketId);
        }
      }
    }, 30000); // 每30秒检查一次
  }
  
  // 获取连接状态
  public getStatus() {
    return {
      connected: this.sessions.size,
      sessions: Array.from(this.sessions.values()).map(s => ({
        socketId: s.socketId,
        userId: s.userId,
        workstationId: s.workstationId,
        subscriptions: Array.from(s.subscriptions),
        lastActivity: s.lastActivity
      }))
    };
  }
}