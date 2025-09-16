import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketOptions {
  autoConnect?: boolean;
  userId?: string;
  workstationId?: string;
}

interface PLCMonitorOptions {
  deviceId: string;
  address: string;
  expectedValue: string;
  interval?: number;
  onData?: (data: any) => void;
  onComplete?: (data: any) => void;
  onError?: (error: any) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const monitoringTasksRef = useRef<Map<string, PLCMonitorOptions>>(new Map());

  // 连接WebSocket
  const connect = useCallback(() => {
    if (socketRef.current?.connected || connecting) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      setConnecting(true);
      console.log('[useWebSocket] 正在连接WebSocket服务器...');

      const socket = io('/', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      });

      socketRef.current = socket;

      // 连接成功
      socket.on('connect', () => {
        console.log('[useWebSocket] WebSocket连接成功:', socket.id);
        setConnected(true);
        setConnecting(false);

        // 发送认证信息
        if (options.userId || options.workstationId) {
          socket.emit('auth', {
            userId: options.userId,
            workstationId: options.workstationId
          });
        }

        resolve();
      });

      // 认证成功
      socket.on('auth:success', (data) => {
        console.log('[useWebSocket] 认证成功:', data);
      });

      // 连接错误
      socket.on('connect_error', (error) => {
        setConnecting(false);
        setIsConnected(false);
        reject(error);
      });

      // 断开连接
      socket.on('disconnect', (reason) => {
        console.log('[useWebSocket] 断开连接:', reason);
        setConnected(false);
      });
    });
  }, [options.userId, options.workstationId, connecting]);

  // 断开连接
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      // 停止所有监控
      monitoringTasksRef.current.forEach((_, key) => {
        stopPLCMonitor(key);
      });
      
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
      console.log('[useWebSocket] 已断开连接');
    }
  }, []);

  // 开始PLC监控
  const startPLCMonitor = useCallback((options: PLCMonitorOptions): string => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      return '';
    }

    const monitorKey = `${options.deviceId}:${options.address}`;
    
    // 停止之前的监控
    if (monitoringTasksRef.current.has(monitorKey)) {
      stopPLCMonitor(monitorKey);
    }

    console.log('[useWebSocket] 开始PLC监控:', {
      deviceId: options.deviceId,
      address: options.address,
      expectedValue: options.expectedValue,
      interval: options.interval || 50
    });

    // 发送监控请求
    socket.emit('plc:monitor:start', {
      deviceId: options.deviceId,
      address: options.address,
      expectedValue: options.expectedValue,
      interval: options.interval || 50
    });

    // 监听监控开始确认
    socket.once('plc:monitor:started', (data) => {
      console.log('[useWebSocket] PLC监控已启动:', data);
    });

    // 监听实时数据
    const handlePLCData = (data: any) => {
      if (data.deviceId === options.deviceId && data.address === options.address) {
        console.log('[useWebSocket] PLC数据更新:', data);
        if (options.onData) {
          options.onData(data);
        }
      }
    };

    // 监听监控完成
    const handlePLCComplete = (data: any) => {
      if (data.deviceId === options.deviceId && data.address === options.address) {
        console.log('[useWebSocket] PLC监控完成:', data);
        if (options.onComplete) {
          options.onComplete(data);
        }
        // 清理监听器
        socket.off('plc:data', handlePLCData);
        socket.off('plc:monitor:complete', handlePLCComplete);
        socket.off('plc:error', handlePLCError);
        monitoringTasksRef.current.delete(monitorKey);
      }
    };

    // 监听错误
    const handlePLCError = (data: any) => {
      if (data.deviceId === options.deviceId && data.address === options.address) {
        if (options.onError) {
          options.onError(data);
        }
      }
    };

    socket.on('plc:data', handlePLCData);
    socket.on('plc:monitor:complete', handlePLCComplete);
    socket.on('plc:error', handlePLCError);

    // 保存监控任务
    monitoringTasksRef.current.set(monitorKey, options);

    return monitorKey;
  }, []);

  // 停止PLC监控
  const stopPLCMonitor = useCallback((monitorKey: string) => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    const [deviceId, address] = monitorKey.split(':');
    
    console.log('[useWebSocket] 停止PLC监控:', { deviceId, address });

    socket.emit('plc:monitor:stop', { deviceId, address });
    
    // 移除监听器
    socket.off('plc:data');
    socket.off('plc:monitor:complete');
    socket.off('plc:error');
    
    monitoringTasksRef.current.delete(monitorKey);
  }, []);

  // PLC写入
  const writePLC = useCallback((deviceId: string, address: string, value: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        reject(new Error('WebSocket未连接'));
        return;
      }

      console.log('[useWebSocket] PLC写入:', { deviceId, address, value });

      socket.emit('plc:write', { deviceId, address, value });

      socket.once('plc:write:result', (result) => {
        if (result.success) {
          console.log('[useWebSocket] PLC写入成功:', result);
          resolve(result);
        } else {
          reject(new Error(result.error || 'PLC写入失败'));
        }
      });

      // 超时处理
      setTimeout(() => {
        reject(new Error('PLC写入超时'));
      }, 5000);
    });
  }, []);

  // 连接设备
  const connectDevice = useCallback(async (deviceId: string): Promise<void> => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      throw new Error('WebSocket未连接');
    }

    return new Promise((resolve, reject) => {
      console.log('[useWebSocket] 连接设备:', deviceId);

      socket.emit('device:connect', { deviceId });

      socket.once('device:connected', (data) => {
        console.log('[useWebSocket] 设备已连接:', data);
        resolve();
      });

      socket.once('device:connect:error', (data) => {
        reject(new Error(data.error || '设备连接失败'));
      });

      // 超时处理
      setTimeout(() => {
        reject(new Error('设备连接超时'));
      }, 10000);
    });
  }, []);

  // 订阅订单更新
  const subscribeOrders = useCallback((workstationId: string, callback: (data: any) => void) => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    console.log('[useWebSocket] 订阅订单更新:', workstationId);

    socket.emit('orders:subscribe', { workstationId });

    socket.on('orders:update', (data) => {
      console.log('[useWebSocket] 订单更新:', data);
      callback(data);
    });
  }, []);

  // 监听事件
  const on = useCallback((event: string, callback: (data: any) => void) => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.on(event, callback);
  }, []);

  // 移除监听
  const off = useCallback((event: string, callback?: (data: any) => void) => {
    const socket = socketRef.current;
    if (!socket) return;

    if (callback) {
      socket.off(event, callback);
    } else {
      socket.off(event);
    }
  }, []);

  // 发送事件
  const emit = useCallback((event: string, data?: any) => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      return;
    }

    socket.emit(event, data);
  }, []);

  // 自动连接
  useEffect(() => {
    if (options.autoConnect !== false) {
      connect().catch(error => {
        // 自动连接失败，静默处理，由上层组件决定如何处理
        setIsConnected(false);
      });
    }

    return () => {
      disconnect();
    };
  }, []);

  return {
    connected,
    connecting,
    connect,
    disconnect,
    startPLCMonitor,
    stopPLCMonitor,
    writePLC,
    connectDevice,
    subscribeOrders,
    on,
    off,
    emit,
    socket: socketRef.current
  };
}