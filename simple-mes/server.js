/**
 * 自定义Next.js服务器
 * 集成WebSocket支持
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server: SocketIOServer } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

// 创建Next.js应用实例
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// WebSocket管理
class WebSocketManager {
  constructor(io) {
    this.io = io;
    this.deviceConnections = new Map();
    this.plcMonitors = new Map();
    this.setupHandlers();
  }

  setupHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`[WebSocket] 客户端连接: ${socket.id}`);

      // 认证
      socket.on('auth', (data) => {
        socket.userId = data.userId;
        socket.workstationId = data.workstationId;
        console.log(`[WebSocket] 用户认证: ${data.userId}, 工位: ${data.workstationId}`);
        
        if (data.workstationId) {
          socket.join(`workstation:${data.workstationId}`);
        }
        
        socket.emit('auth:success', { 
          socketId: socket.id,
          timestamp: Date.now() 
        });
      });

      // PLC监控订阅
      socket.on('plc:monitor:start', async (data) => {
        const { deviceId, address, expectedValue, interval = 50 } = data;
        const monitorKey = `${socket.id}:${deviceId}:${address}`;
        
        console.log(`[PLC监控] 开始监控: ${deviceId}, 地址: ${address}, 期望值: ${expectedValue}, 间隔: ${interval}ms`);
        
        // 停止之前的监控
        if (this.plcMonitors.has(monitorKey)) {
          clearInterval(this.plcMonitors.get(monitorKey));
        }
        
        // 创建新的监控任务
        const monitor = setInterval(async () => {
          try {
            // 调用设备通信API读取PLC值
            const response = await fetch(`http://localhost:3000/api/device-communication/devices/${deviceId}/read`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                address: address,
                type: 'DB',
                dbNumber: parseInt(address.match(/DB(\d+)/)?.[1] || '0'),
                byte: parseInt(address.match(/DBX(\d+)/)?.[1] || '0'),
                bit: parseInt(address.match(/\.(\d+)$/)?.[1] || '0')
              })
            });
            
            if (response.ok) {
              const result = await response.json();
              if (result.success) {
                const value = result.value;
                
                // 发送实时数据到客户端
                socket.emit('plc:data', {
                  deviceId,
                  address,
                  value,
                  expectedValue,
                  match: value?.toString() === expectedValue?.toString(),
                  timestamp: Date.now()
                });
                
                // 如果值匹配期望值，通知完成
                if (value?.toString() === expectedValue?.toString() || 
                    (expectedValue === '1' && (value === true || value === 1)) ||
                    (expectedValue === '0' && (value === false || value === 0))) {
                  console.log(`[PLC监控] 条件满足: ${address} = ${value}`);
                  socket.emit('plc:monitor:complete', {
                    deviceId,
                    address,
                    value,
                    expectedValue
                  });
                  
                  // 停止监控
                  clearInterval(monitor);
                  this.plcMonitors.delete(monitorKey);
                }
              }
            }
          } catch (error) {
            console.error(`[PLC监控] 读取错误:`, error);
            socket.emit('plc:error', {
              deviceId,
              address,
              error: error.message
            });
          }
        }, interval);
        
        this.plcMonitors.set(monitorKey, monitor);
        
        socket.emit('plc:monitor:started', {
          deviceId,
          address,
          expectedValue,
          interval
        });
      });

      // 停止PLC监控
      socket.on('plc:monitor:stop', (data) => {
        const { deviceId, address } = data;
        const monitorKey = `${socket.id}:${deviceId}:${address}`;
        
        if (this.plcMonitors.has(monitorKey)) {
          clearInterval(this.plcMonitors.get(monitorKey));
          this.plcMonitors.delete(monitorKey);
          console.log(`[PLC监控] 停止监控: ${deviceId}, 地址: ${address}`);
        }
        
        socket.emit('plc:monitor:stopped', { deviceId, address });
      });

      // PLC写入
      socket.on('plc:write', async (data) => {
        const { deviceId, address, value } = data;
        
        try {
          const response = await fetch(`http://localhost:3000/api/device-communication/devices/${deviceId}/write`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, value })
          });
          
          const result = await response.json();
          socket.emit('plc:write:result', {
            success: result.success,
            deviceId,
            address,
            value,
            error: result.error
          });
        } catch (error) {
          socket.emit('plc:write:result', {
            success: false,
            deviceId,
            address,
            error: error.message
          });
        }
      });

      // 设备连接管理
      socket.on('device:connect', async (data) => {
        const { deviceId } = data;
        
        try {
          const response = await fetch(`http://localhost:3000/api/device-communication/devices/${deviceId}/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          
          const result = await response.json();
          
          if (result.success) {
            this.deviceConnections.set(deviceId, {
              connected: true,
              connectedAt: Date.now(),
              socketId: socket.id
            });
            
            socket.emit('device:connected', { deviceId });
            
            // 广播设备状态更新
            this.io.emit('device:status:update', {
              deviceId,
              connected: true
            });
          } else {
            throw new Error(result.error || '连接失败');
          }
        } catch (error) {
          socket.emit('device:connect:error', {
            deviceId,
            error: error.message
          });
        }
      });

      // 订单状态订阅
      socket.on('orders:subscribe', (data) => {
        const { workstationId } = data;
        socket.join(`orders:${workstationId}`);
        console.log(`[订单] 订阅工位订单: ${workstationId}`);
      });

      // 断开连接清理
      socket.on('disconnect', () => {
        console.log(`[WebSocket] 客户端断开: ${socket.id}`);
        
        // 清理所有监控任务
        for (const [key, monitor] of this.plcMonitors.entries()) {
          if (key.startsWith(socket.id)) {
            clearInterval(monitor);
            this.plcMonitors.delete(key);
          }
        }
      });

      // 心跳
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });
    });
  }

  // 广播订单更新
  broadcastOrderUpdate(workstationId, orders) {
    this.io.to(`orders:${workstationId}`).emit('orders:update', {
      orders,
      timestamp: Date.now()
    });
  }
}

// 启动服务器
app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // 初始化Socket.IO
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
  });

  // 创建WebSocket管理器
  const wsManager = new WebSocketManager(io);
  
  // 将WebSocket管理器暴露给全局（供API路由使用）
  global.wsManager = wsManager;

  server.once('error', (err) => {
    console.error(err);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`
╔════════════════════════════════════════════╗
║     SimpleMES Server with WebSocket        ║
╠════════════════════════════════════════════╣
║  HTTP Server:  http://${hostname}:${port}       ║
║  WebSocket:    ws://${hostname}:${port}          ║
║  Environment:  ${dev ? 'Development' : 'Production'}              ║
╚════════════════════════════════════════════╝
    `);
  });
});