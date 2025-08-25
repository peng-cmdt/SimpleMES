"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

// 安全配置常量
const SECURITY_CONFIG = {
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30分钟会话超时
  HEARTBEAT_INTERVAL: 5 * 60 * 1000, // 5分钟心跳检查
  MAX_FAILED_ATTEMPTS: 3, // 最大失败尝试次数
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15分钟锁定时间
  RATE_LIMIT: {
    DEVICE_OPERATIONS: 10, // 每分钟最多10次设备操作
    BARCODE_SCANS: 30, // 每分钟最多30次条码扫描
    API_REQUESTS: 50, // 每分钟最多50次API请求
    WINDOW_MS: 60 * 1000 // 1分钟窗口
  },
  INPUT_MAX_LENGTH: {
    address: 50,
    value: 100,
    barcode: 100
  }
};

// 输入验证和清理函数
const sanitizeInput = (input: string, maxLength: number = 100): string => {
  if (!input || typeof input !== 'string') return '';
  // 移除潜在的恶意字符
  const cleaned = input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>.*?<\/object>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');
  
  return cleaned.substring(0, maxLength).trim();
};

// PLC地址验证
const validatePLCAddress = (address: string): boolean => {
  const plcAddressPattern = /^(DB\d+\.(DBW|DBD|DBB)\d+|[MI]\d+(\.\d+)?|Q\d+(\.\d+)?)$/i;
  return plcAddressPattern.test(address);
};

// 审计日志记录
const logSecurityEvent = async (eventType: string, details: any) => {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      eventType,
      details: {
        ...details,
        userAgent: navigator.userAgent,
        sessionId: details.sessionId ? details.sessionId.substring(0, 8) + '...' : 'unknown'
      }
    };
    
    await fetch('/api/security/audit-log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
      },
      body: JSON.stringify(logEntry)
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
};

// 速率限制管理
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitCache = new Map<string, RateLimitEntry>();

const checkRateLimit = (operationType: 'device_operation' | 'barcode_scan' | 'api_request', identifier: string): boolean => {
  const now = Date.now();
  const key = `${operationType}_${identifier}`;
  const limit = SECURITY_CONFIG.RATE_LIMIT;
  
  let maxOperations: number;
  switch (operationType) {
    case 'device_operation':
      maxOperations = limit.DEVICE_OPERATIONS;
      break;
    case 'barcode_scan':
      maxOperations = limit.BARCODE_SCANS;
      break;
    case 'api_request':
      maxOperations = limit.API_REQUESTS;
      break;
    default:
      maxOperations = 10;
  }
  
  const entry = rateLimitCache.get(key);
  
  if (!entry || (now - entry.windowStart) > limit.WINDOW_MS) {
    // 新窗口或窗口过期，重置计数
    rateLimitCache.set(key, { count: 1, windowStart: now });
    return true;
  }
  
  if (entry.count >= maxOperations) {
    // 超出速率限制
    return false;
  }
  
  // 增加计数
  entry.count++;
  rateLimitCache.set(key, entry);
  return true;
};

const getRemainingOperations = (operationType: 'device_operation' | 'barcode_scan' | 'api_request', identifier: string): number => {
  const now = Date.now();
  const key = `${operationType}_${identifier}`;
  const limit = SECURITY_CONFIG.RATE_LIMIT;
  
  let maxOperations: number;
  switch (operationType) {
    case 'device_operation':
      maxOperations = limit.DEVICE_OPERATIONS;
      break;
    case 'barcode_scan':
      maxOperations = limit.BARCODE_SCANS;
      break;
    case 'api_request':
      maxOperations = limit.API_REQUESTS;
      break;
    default:
      maxOperations = 10;
  }
  
  const entry = rateLimitCache.get(key);
  
  if (!entry || (now - entry.windowStart) > limit.WINDOW_MS) {
    return maxOperations;
  }
  
  return Math.max(0, maxOperations - entry.count);
};

interface Order {
  id: string;
  orderNumber: string;
  productionNumber: string;
  customerSeq: string;
  carNumber: string;
  productFamily: string;
  carrierId: string;
  status: string;
  priority: number;
  plannedDate?: string;
  product?: {
    name: string;
    productCode: string;
  };
}

interface WorkstationSession {
  sessionId: string;
  workstation: {
    id: string;
    workstationId: string;
    name: string;
    description?: string;
    location?: string;
    type: 'VISUAL_CLIENT' | 'SERVICE_TYPE';
  };
  username: string;
  loginTime: string;
}

interface DeviceStatus {
  deviceId: string;
  deviceName?: string;
  deviceType?: string;
  status: string;
  isOnline: boolean;
  lastConnected?: string;
  lastHeartbeat?: string;
  error?: string;
  // 新增字段
  brand?: string;
  model?: string;
  ipAddress?: string;
  port?: number;
}

interface UserInfo {
  id: string;
  username: string;
  email: string;
  role: string;
}

interface DeviceOperationResult {
  requestId: string;
  success: boolean;
  data?: any;
  errorMessage?: string;
  duration: number;
  timestamp: string;
}

export default function ClientDashboard() {
  const [workstationSession, setWorkstationSession] = useState<WorkstationSession | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [deviceStatuses, setDeviceStatuses] = useState<DeviceStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'devices' | 'monitor'>('orders');
  
  // 设备操作相关状态
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [operation, setOperation] = useState<'read' | 'write'>('read');
  const [address, setAddress] = useState<string>('');
  const [value, setValue] = useState<string>('');
  const [dataType, setDataType] = useState<string>('INT');
  const [operationResult, setOperationResult] = useState<DeviceOperationResult | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [operationHistory, setOperationHistory] = useState<DeviceOperationResult[]>([]);
  
  // 条码扫描状态
  const [scannedBarcode, setScannedBarcode] = useState<string>('');
  const [scanHistory, setScanHistory] = useState<string[]>([]);
  
  // WebSocket实时通信状态
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [realTimeEvents, setRealTimeEvents] = useState<any[]>([]);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);
  
  // 安全状态管理
  const [securityState, setSecurityState] = useState({
    failedAttempts: 0,
    isLocked: false,
    lockoutExpiry: null as Date | null,
    lastActivity: new Date(),
    sessionValid: true
  });
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  const router = useRouter();

  // 安全会话管理
  const updateLastActivity = useCallback(() => {
    setSecurityState(prev => ({ ...prev, lastActivity: new Date() }));
    
    // 重置会话超时
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }
    
    sessionTimeoutRef.current = setTimeout(() => {
      handleSessionTimeout();
    }, SECURITY_CONFIG.SESSION_TIMEOUT);
  }, []);

  // 会话超时处理
  const handleSessionTimeout = useCallback(async () => {
    await logSecurityEvent('SESSION_TIMEOUT', {
      sessionId: workstationSession?.sessionId,
      username: userInfo?.username,
      workstationId: workstationSession?.workstation.id
    });
    
    setSecurityState(prev => ({ ...prev, sessionValid: false }));
    
    alert('会话已超时，请重新登录');
    handleLogout();
  }, [workstationSession, userInfo]);

  // 安全验证增强的认证检查
  const validateSession = useCallback(async () => {
    const userInfoStr = localStorage.getItem("clientUserInfo");
    const workstationSessionStr = localStorage.getItem("workstationSession");
    
    if (!userInfoStr || !workstationSessionStr) {
      await logSecurityEvent('INVALID_SESSION', { reason: 'Missing session data' });
      router.push("/client/login");
      return false;
    }

    try {
      const user = JSON.parse(userInfoStr);
      const session = JSON.parse(workstationSessionStr);
      
      // 验证会话完整性
      if (!session.sessionId || !session.workstation || !user.id) {
        throw new Error('Session data corrupted');
      }
      
      // 检查会话时间
      const loginTime = new Date(session.loginTime);
      const now = new Date();
      if (now.getTime() - loginTime.getTime() > SECURITY_CONFIG.SESSION_TIMEOUT) {
        throw new Error('Session expired');
      }
      
      setUserInfo(user);
      setWorkstationSession(session);
      updateLastActivity();
      
      await logSecurityEvent('SESSION_VALIDATED', {
        sessionId: session.sessionId,
        username: user.username,
        workstationId: session.workstation.id
      });
      
      return true;
    } catch (error) {
      await logSecurityEvent('SESSION_VALIDATION_FAILED', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userAgent: navigator.userAgent
      });
      
      localStorage.removeItem("clientUserInfo");
      localStorage.removeItem("workstationSession");
      router.push("/client/login");
      return false;
    }
  }, [router, updateLastActivity]);

  // 更新时间显示
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 安全增强的认证状态检查和数据加载
  useEffect(() => {
    validateSession().then(isValid => {
      if (isValid && workstationSession) {
        loadOrders();
        loadDeviceStatuses(workstationSession.workstation.id);
      }
    });
  }, [validateSession]);

  // 定期刷新设备状态
  useEffect(() => {
    if (!workstationSession) return;

    const interval = setInterval(() => {
      loadDeviceStatuses(workstationSession.workstation.id);
    }, 5000); // 每5秒刷新

    return () => clearInterval(interval);
  }, [workstationSession]);

  // WebSocket实时通信连接
  useEffect(() => {
    if (!workstationSession) return;

    const connectWebSocket = () => {
      setConnectionStatus('connecting');
      
      // 连接到后端WebSocket服务（运行在8080端口）
      const ws = new WebSocket(`ws://localhost:8080/ws`);
      
      ws.onopen = () => {
        console.log('WebSocket连接已建立');
        setConnectionStatus('connected');
        setWsConnection(ws);
        setLastHeartbeat(new Date());
        
        // 发送订阅消息代替认证消息
        ws.send(JSON.stringify({
          Type: 'subscribe',
          Data: {
            workstationId: workstationSession.workstation.workstationId,
            sessionId: workstationSession.sessionId,
            username: workstationSession.username
          },
          Timestamp: new Date().toISOString()
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('解析WebSocket消息失败:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket连接已关闭:', event.code, event.reason);
        setConnectionStatus('disconnected');
        setWsConnection(null);
        
        // 3秒后尝试重连
        if (event.code !== 1000) { // 不是正常关闭
          setTimeout(() => {
            if (workstationSession) {
              connectWebSocket();
            }
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket连接错误:', error);
        setConnectionStatus('error');
      };

      return ws;
    };

    const ws = connectWebSocket();
    
    // 心跳检测
    const heartbeatInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ 
          Type: 'ping', 
          Data: { sessionId: workstationSession.sessionId },
          Timestamp: new Date().toISOString()
        }));
      }
    }, 30000); // 每30秒发送心跳

    return () => {
      clearInterval(heartbeatInterval);
      if (ws) {
        ws.close(1000, 'Component unmounting');
      }
    };
  }, [workstationSession]);

  // 处理WebSocket消息
  const handleWebSocketMessage = useCallback((data: any) => {
    setLastHeartbeat(new Date());
    
    switch (data.type) {
      case 'pong':
        // 心跳响应
        break;
        
      case 'device_status_update':
        // 设备状态更新
        setDeviceStatuses(prevStatuses => {
          const updatedStatuses = [...prevStatuses];
          const index = updatedStatuses.findIndex(d => d.deviceId === data.deviceId);
          if (index >= 0) {
            updatedStatuses[index] = { ...updatedStatuses[index], ...data.status };
          }
          return updatedStatuses;
        });
        
        // 添加到实时事件列表
        setRealTimeEvents(prevEvents => [{
          id: `device_${Date.now()}`,
          type: 'device_status',
          message: `设备 ${data.deviceName || data.deviceId} 状态更新: ${data.status.status}`,
          timestamp: new Date(),
          severity: data.status.isOnline ? 'info' : 'warning'
        }, ...prevEvents.slice(0, 19)]);
        break;
        
      case 'device_operation_result':
        // 设备操作结果
        const operationResult: DeviceOperationResult = {
          requestId: data.requestId,
          success: data.success,
          data: data.data,
          errorMessage: data.errorMessage,
          duration: data.duration,
          timestamp: data.timestamp
        };
        
        setOperationResult(operationResult);
        setOperationHistory(prev => [operationResult, ...prev.slice(0, 19)]);
        
        setRealTimeEvents(prevEvents => [{
          id: `operation_${Date.now()}`,
          type: 'device_operation',
          message: `设备操作${data.success ? '成功' : '失败'}: ${data.requestId}`,
          timestamp: new Date(),
          severity: data.success ? 'success' : 'error'
        }, ...prevEvents.slice(0, 19)]);
        break;
        
      case 'order_update':
        // 订单状态更新
        setOrders(prevOrders => {
          return prevOrders.map(order => 
            order.id === data.orderId 
              ? { ...order, status: data.status }
              : order
          );
        });
        
        setRealTimeEvents(prevEvents => [{
          id: `order_${Date.now()}`,
          type: 'order_update',
          message: `订单 ${data.orderNumber} 状态更新: ${data.status}`,
          timestamp: new Date(),
          severity: 'info'
        }, ...prevEvents.slice(0, 19)]);
        break;
        
      case 'system_notification':
        // 系统通知
        setRealTimeEvents(prevEvents => [{
          id: `system_${Date.now()}`,
          type: 'system',
          message: data.message,
          timestamp: new Date(),
          severity: data.severity || 'info'
        }, ...prevEvents.slice(0, 19)]);
        break;
        
      case 'barcode_scan':
        // 实时条码扫描
        setScannedBarcode(data.barcode);
        setScanHistory(prev => [data.barcode, ...prev.slice(0, 19)]);
        
        setRealTimeEvents(prevEvents => [{
          id: `barcode_${Date.now()}`,
          type: 'barcode_scan',
          message: `扫描到条码: ${data.barcode}`,
          timestamp: new Date(),
          severity: 'success'
        }, ...prevEvents.slice(0, 19)]);
        break;
        
      default:
        console.log('未知的WebSocket消息类型:', data.type);
    }
  }, []);

  // 发送WebSocket消息
  const sendWebSocketMessage = useCallback((message: any) => {
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      wsConnection.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, [wsConnection]);

  const loadOrders = async () => {
    try {
      // 首先尝试从API加载真实数据
      const response = await fetch('/api/orders?status=pending&limit=20');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.orders) {
          setOrders(data.data.orders);
          return;
        }
      }
      
      // 如果API失败，使用模拟数据
      loadMockOrders();
    } catch (error) {
      console.error('Failed to load orders:', error);
      loadMockOrders();
    }
  };

  const loadMockOrders = () => {
    const mockOrders: Order[] = [
      {
        id: "1",
        orderNumber: "MF120250821T001",
        productionNumber: "3983424",
        customerSeq: "MF120250821T001",
        carNumber: "3983424",
        productFamily: "MRA",
        carrierId: "22244637",
        status: "pending",
        priority: 1,
        product: { name: "主机产品A", productCode: "MRA-001" }
      },
      {
        id: "2", 
        orderNumber: "MF120250821T002",
        productionNumber: "3985753",
        customerSeq: "MF120250821T002",
        carNumber: "3985753",
        productFamily: "MRB",
        carrierId: "22245113",
        status: "pending",
        priority: 2,
        product: { name: "主机产品B", productCode: "MRB-001" }
      },
      {
        id: "3",
        orderNumber: "MF120250821T003", 
        productionNumber: "3985754",
        customerSeq: "MF120250821T003",
        carNumber: "3985754",
        productFamily: "MRC",
        carrierId: "22245114",
        status: "pending",
        priority: 3,
        product: { name: "主机产品C", productCode: "MRC-001" }
      },
      {
        id: "4",
        orderNumber: "MF120250821T004",
        productionNumber: "3985755", 
        customerSeq: "MF120250821T004",
        carNumber: "3985755",
        productFamily: "MRD",
        carrierId: "22245115",
        status: "pending",
        priority: 4,
        product: { name: "主机产品D", productCode: "MRD-001" }
      }
    ];
    
    setOrders(mockOrders);
  };

  const loadDeviceStatuses = async (workstationId: string) => {
    try {
      // 从API获取工位配置的设备列表
      const response = await fetch(`/api/workstation/${workstationId}/devices`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.devices)) {
          // 转换设备数据格式并设置当前状态
          const devices: DeviceStatus[] = data.devices.map((device: any) => ({
            deviceId: device.deviceId,
            deviceName: device.name,
            deviceType: device.type.replace('_CONTROLLER', '').replace('_', ' '), // 清理设备类型显示
            status: device.isOnline ? 'online' : 'offline',
            isOnline: device.isOnline,
            lastConnected: device.lastConnected,
            lastHeartbeat: device.lastHeartbeat,
            error: null,
            // 添加额外信息用于显示
            brand: device.brand,
            model: device.model,
            ipAddress: device.ipAddress,
            port: device.port
          }));
          
          setDeviceStatuses(devices);
          
          // 如果有设备，尝试检查它们的实际在线状态
          if (devices.length > 0) {
            checkDeviceOnlineStatuses(workstationId, devices);
          }
        } else {
          console.warn('No devices configured for workstation:', workstationId);
          setDeviceStatuses([]);
        }
      } else {
        console.error('Failed to load workstation devices, status:', response.status);
        setDeviceStatuses([]);
      }
    } catch (error) {
      console.error('Failed to load device statuses:', error);
      setDeviceStatuses([]);
    }
  };

  // 检查设备实际在线状态
  const checkDeviceOnlineStatuses = async (workstationId: string, devices: DeviceStatus[]) => {
    try {
      // 调用设备通信服务检查实际状态
      const statusResponse = await fetch(`http://localhost:8080/api/workstation/${workstationId}/devices/status`);
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        
        // 更新设备状态
        const updatedDevices = devices.map(device => {
          const realStatus = statusData.find((s: any) => s.deviceId === device.deviceId);
          if (realStatus) {
            return {
              ...device,
              status: realStatus.isOnline ? 'online' : 'offline',
              isOnline: realStatus.isOnline,
              lastConnected: realStatus.lastConnected,
              lastHeartbeat: realStatus.lastHeartbeat,
              error: realStatus.error
            };
          }
          return device;
        });
        
        setDeviceStatuses(updatedDevices);
      } else {
        console.log('Device communication service not available, showing offline status');
      }
    } catch (error) {
      console.log('Device communication service not available:', error);
    }
  };

  const handleLogout = async () => {
    try {
      if (workstationSession) {
        await fetch(`/api/workstation/logout/${workstationSession.sessionId}`, {
          method: 'POST'
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem("clientAuth");
      localStorage.removeItem("clientUserInfo");
      localStorage.removeItem("clientInfo");
      localStorage.removeItem("workstationSession");
      router.push("/");
    }
  };

  const handleStart = async () => {
    if (!selectedOrderId) {
      alert('请先选择一个订单');
      return;
    }
    
    setIsProcessing(true);
    try {
      // 模拟处理逻辑
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 更新订单状态
      setOrders(orders.map(order => 
        order.id === selectedOrderId 
          ? { ...order, status: 'in_progress' }
          : order
      ));
      
      alert(`订单 ${selectedOrderId} 已开始处理`);
      setSelectedOrderId("");
    } catch (error) {
      console.error('Start processing error:', error);
      alert('启动处理失败');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAdjustSequence = () => {
    alert('调整序列功能 - 开发中');
  };

  const handleManualInsert = () => {
    alert('手动插入功能 - 开发中');
  };

  const handleServiceMode = () => {
    alert('服务模式功能 - 开发中');
  };

  // 安全增强的设备操作函数
  const executeDeviceOperation = async () => {
    // 安全前置检查
    if (!securityState.sessionValid) {
      alert('会话无效，请重新登录');
      handleLogout();
      return;
    }

    if (securityState.isLocked) {
      alert('账户已被锁定，请稍后再试');
      return;
    }

    // 速率限制检查
    const rateLimitIdentifier = workstationSession?.sessionId || 'unknown';
    if (!checkRateLimit('device_operation', rateLimitIdentifier)) {
      const remainingOps = getRemainingOperations('device_operation', rateLimitIdentifier);
      await logSecurityEvent('DEVICE_OPERATION_RATE_LIMITED', {
        sessionId: workstationSession?.sessionId,
        username: userInfo?.username,
        remainingOperations: remainingOps,
        limit: SECURITY_CONFIG.RATE_LIMIT.DEVICE_OPERATIONS
      });
      alert(`操作频率过高，请稍后再试。当前剩余操作次数: ${remainingOps}`);
      return;
    }

    // 输入验证和清理
    const sanitizedAddress = sanitizeInput(address, SECURITY_CONFIG.INPUT_MAX_LENGTH.address);
    const sanitizedValue = value ? sanitizeInput(value, SECURITY_CONFIG.INPUT_MAX_LENGTH.value) : '';

    if (!selectedDeviceId || !sanitizedAddress) {
      await logSecurityEvent('DEVICE_OPERATION_INVALID_INPUT', {
        sessionId: workstationSession?.sessionId,
        deviceId: selectedDeviceId,
        address: address,
        reason: 'Missing device or address'
      });
      alert('请选择设备并输入有效地址');
      return;
    }

    // PLC地址格式验证
    if (!validatePLCAddress(sanitizedAddress)) {
      await logSecurityEvent('DEVICE_OPERATION_INVALID_ADDRESS', {
        sessionId: workstationSession?.sessionId,
        deviceId: selectedDeviceId,
        address: sanitizedAddress,
        reason: 'Invalid PLC address format'
      });
      alert('PLC地址格式无效，请输入有效的地址格式');
      return;
    }

    if (operation === 'write' && !sanitizedValue.trim()) {
      await logSecurityEvent('DEVICE_OPERATION_INVALID_INPUT', {
        sessionId: workstationSession?.sessionId,
        deviceId: selectedDeviceId,
        operation: operation,
        reason: 'Write operation missing value'
      });
      alert('写操作需要输入值');
      return;
    }

    // 更新活动时间
    updateLastActivity();

    setIsExecuting(true);
    setOperationResult(null);

    const requestId = `req_${Date.now()}`;
    const startTime = Date.now();

    // 记录操作开始审计日志
    await logSecurityEvent('DEVICE_OPERATION_START', {
      sessionId: workstationSession?.sessionId,
      username: userInfo?.username,
      workstationId: workstationSession?.workstation.id,
      deviceId: selectedDeviceId,
      operation: operation,
      address: sanitizedAddress,
      dataType: dataType,
      requestId: requestId
    });

    try {
      // 构建安全的操作数据
      const operationData = {
        type: 'device_operation',
        requestId,
        workstationId: workstationSession?.workstation.id,
        deviceId: selectedDeviceId,
        operation: operation.toUpperCase(),
        address: sanitizedAddress,
        value: operation === 'write' ? parseValue(sanitizedValue, dataType) : undefined,
        dataType: dataType,
        timestamp: new Date().toISOString(),
        securityToken: workstationSession?.sessionId
      };

      // 如果WebSocket连接可用，优先使用WebSocket
      if (sendWebSocketMessage(operationData)) {
        // WebSocket消息发送成功，等待实时响应
        setRealTimeEvents(prevEvents => [{
          id: `req_${Date.now()}`,
          type: 'device_operation_start',
          message: `开始执行设备操作: ${operation} ${sanitizedAddress}`,
          timestamp: new Date(),
          severity: 'info'
        }, ...prevEvents.slice(0, 19)]);
        
        // 设置安全超时处理
        setTimeout(() => {
          if (isExecuting) {
            setIsExecuting(false);
            setOperationResult({
              requestId,
              success: false,
              errorMessage: '操作超时，请检查设备连接',
              duration: Date.now() - startTime,
              timestamp: new Date().toISOString()
            });
            
            // 记录超时事件
            logSecurityEvent('DEVICE_OPERATION_TIMEOUT', {
              sessionId: workstationSession?.sessionId,
              requestId: requestId,
              duration: Date.now() - startTime
            });
          }
        }, 10000); // 10秒超时
        
        return; // 等待WebSocket响应
      }
      
      // WebSocket不可用，使用安全的HTTP API
      const response = await fetch('/api/workstation/device/operation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
          'Authorization': `Bearer ${workstationSession?.sessionId}`
        },
        body: JSON.stringify({
          workstationId: workstationSession?.workstation.id,
          deviceId: selectedDeviceId,
          operation: operation.toUpperCase(),
          address: sanitizedAddress,
          value: operation === 'write' ? parseValue(sanitizedValue, dataType) : undefined,
          dataType: dataType,
          requestId: requestId
        })
      });

      const result = await response.json();
      const duration = Date.now() - startTime;
      
      const operationResult: DeviceOperationResult = {
        requestId,
        success: response.ok && result.success,
        data: result.data,
        errorMessage: result.error || (response.ok ? undefined : `HTTP ${response.status}`),
        duration,
        timestamp: new Date().toISOString()
      };

      setOperationResult(operationResult);
      setOperationHistory(prev => [operationResult, ...prev.slice(0, 19)]); // 保留最近20条记录
      
      // 记录操作完成审计日志
      await logSecurityEvent('DEVICE_OPERATION_COMPLETE', {
        sessionId: workstationSession?.sessionId,
        requestId: requestId,
        success: operationResult.success,
        duration: duration,
        errorMessage: operationResult.errorMessage
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const operationResult: DeviceOperationResult = {
        requestId,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        duration,
        timestamp: new Date().toISOString()
      };
      
      setOperationResult(operationResult);
      setOperationHistory(prev => [operationResult, ...prev.slice(0, 19)]);
      
      // 记录操作错误审计日志
      await logSecurityEvent('DEVICE_OPERATION_ERROR', {
        sessionId: workstationSession?.sessionId,
        requestId: requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: duration
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const parseValue = (valueStr: string, dataType: string) => {
    switch (dataType) {
      case 'INT':
      case 'DINT':
        return parseInt(valueStr, 10);
      case 'REAL':
      case 'FLOAT':
        return parseFloat(valueStr);
      case 'BOOL':
        return valueStr.toLowerCase() === 'true' || valueStr === '1';
      default:
        return valueStr;
    }
  };

  // 安全增强的条码扫描函数
  const handleBarcodeScan = async (barcode: string) => {
    // 安全前置检查
    if (!securityState.sessionValid) {
      alert('会话无效，请重新登录');
      handleLogout();
      return;
    }

    if (securityState.isLocked) {
      alert('账户已被锁定，请稍后再试');
      return;
    }

    if (!barcode.trim()) return;

    // 速率限制检查
    const rateLimitIdentifier = workstationSession?.sessionId || 'unknown';
    if (!checkRateLimit('barcode_scan', rateLimitIdentifier)) {
      const remainingScans = getRemainingOperations('barcode_scan', rateLimitIdentifier);
      await logSecurityEvent('BARCODE_SCAN_RATE_LIMITED', {
        sessionId: workstationSession?.sessionId,
        username: userInfo?.username,
        remainingScans: remainingScans,
        limit: SECURITY_CONFIG.RATE_LIMIT.BARCODE_SCANS
      });
      alert(`扫描频率过高，请稍后再试。当前剩余扫描次数: ${remainingScans}`);
      return;
    }
    
    // 输入验证和清理
    const sanitizedBarcode = sanitizeInput(barcode.trim(), SECURITY_CONFIG.INPUT_MAX_LENGTH.barcode);
    
    // 条码格式验证
    const barcodePattern = /^[A-Za-z0-9\-._]+$/;
    if (!barcodePattern.test(sanitizedBarcode)) {
      await logSecurityEvent('BARCODE_SCAN_INVALID_FORMAT', {
        sessionId: workstationSession?.sessionId,
        username: userInfo?.username,
        barcode: barcode.substring(0, 20) + '...',
        reason: 'Invalid barcode format'
      });
      alert('条码格式无效，只允许字母、数字、连字符、下划线和点');
      return;
    }

    // 检查条码长度
    if (sanitizedBarcode.length > SECURITY_CONFIG.INPUT_MAX_LENGTH.barcode) {
      await logSecurityEvent('BARCODE_SCAN_LENGTH_EXCEEDED', {
        sessionId: workstationSession?.sessionId,
        username: userInfo?.username,
        barcodeLength: sanitizedBarcode.length,
        maxLength: SECURITY_CONFIG.INPUT_MAX_LENGTH.barcode
      });
      alert(`条码长度超过限制 (最大${SECURITY_CONFIG.INPUT_MAX_LENGTH.barcode}字符)`);
      return;
    }

    // 更新活动时间
    updateLastActivity();
    
    // 记录扫描操作审计日志
    await logSecurityEvent('BARCODE_SCAN_SUCCESS', {
      sessionId: workstationSession?.sessionId,
      username: userInfo?.username,
      workstationId: workstationSession?.workstation.id,
      barcode: sanitizedBarcode,
      scanType: 'manual'
    });
    
    setScannedBarcode(sanitizedBarcode);
    setScanHistory(prev => [sanitizedBarcode, ...prev.slice(0, 19)]); // 保留最近20条记录
    
    // 通过WebSocket发送安全的条码扫描事件（如果连接可用）
    sendWebSocketMessage({
      type: 'barcode_scan_event',
      barcode: sanitizedBarcode,
      workstationId: workstationSession?.workstation.id,
      username: workstationSession?.username,
      timestamp: new Date().toISOString(),
      securityToken: workstationSession?.sessionId
    });
    
    // 添加到实时事件列表
    setRealTimeEvents(prevEvents => [{
      id: `scan_${Date.now()}`,
      type: 'barcode_scan',
      message: `手动扫描条码: ${sanitizedBarcode}`,
      timestamp: new Date(),
      severity: 'success'
    }, ...prevEvents.slice(0, 19)]);
    
    console.log('Secured barcode scan completed:', sanitizedBarcode);
  };

  const clearOperationHistory = () => {
    setOperationHistory([]);
    setOperationResult(null);
  };

  const clearScanHistory = () => {
    setScanHistory([]);
    setScannedBarcode('');
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('zh-CN');
  };

  const getStatusColor = (status: string, isOnline?: boolean) => {
    if (isOnline === false) return 'bg-gray-500';
    switch (status.toLowerCase()) {
      case 'online':
      case 'connected':
        return 'bg-green-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'in_progress':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-600';
      case 'error':
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'online':
        return '在线';
      case 'offline':
        return '离线';
      case 'pending':
        return '待处理';
      case 'in_progress':
        return '处理中';
      case 'completed':
        return '已完成';
      case 'error':
      case 'failed':
        return '错误';
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority <= 3) return 'bg-red-100 text-red-800 border-red-200';
    if (priority <= 6) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (priority <= 9) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getPriorityText = (priority: number) => {
    if (priority <= 3) return '高优先级';
    if (priority <= 6) return '中优先级';
    if (priority <= 9) return '普通';
    return '低优先级';
  };

  if (!workstationSession || !userInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* 移动优化的顶部状态栏 */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            {/* 左侧Logo和工作站信息 - 移动优化 */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="flex items-center">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mr-2 sm:mr-3">
                  <span className="text-base sm:text-xl">🏭</span>
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-gray-900">SimpleMES</h1>
                  <p className="text-xs sm:text-sm text-gray-600 truncate max-w-[120px] sm:max-w-none">
                    {workstationSession.workstation.name}
                  </p>
                </div>
              </div>
              
              {/* 移动设备状态指示器 - 紧凑显示 */}
              <div className="flex md:hidden items-center space-x-1">
                <div className="flex items-center px-2 py-1 bg-white/60 rounded-full border border-white/30">
                  <div className={`w-1.5 h-1.5 rounded-full mr-1 ${
                    deviceStatuses.every(d => d.isOnline) ? 'bg-green-400' : 'bg-orange-400'
                  } animate-pulse`}></div>
                  <span className="text-xs font-medium text-gray-700">
                    {deviceStatuses.filter(d => d.isOnline).length}/{deviceStatuses.length}
                  </span>
                </div>
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-blue-400 animate-pulse' : 
                  connectionStatus === 'connecting' ? 'bg-yellow-400 animate-spin' :
                  connectionStatus === 'error' ? 'bg-red-400' : 'bg-gray-400'
                }`}></div>
              </div>
              
              {/* 桌面设备状态指示器 */}
              <div className="hidden md:flex items-center space-x-2">
                <div className="flex items-center px-3 py-1 bg-white/60 rounded-full border border-white/30">
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    deviceStatuses.every(d => d.isOnline) ? 'bg-green-400' : 'bg-orange-400'
                  } animate-pulse`}></div>
                  <span className="text-xs font-medium text-gray-700">
                    设备 {deviceStatuses.filter(d => d.isOnline).length}/{deviceStatuses.length}
                  </span>
                </div>
                
                {/* WebSocket连接状态指示器 */}
                <div className="flex items-center px-3 py-1 bg-white/60 rounded-full border border-white/30">
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    connectionStatus === 'connected' ? 'bg-blue-400 animate-pulse' : 
                    connectionStatus === 'connecting' ? 'bg-yellow-400 animate-spin' :
                    connectionStatus === 'error' ? 'bg-red-400' : 'bg-gray-400'
                  }`}></div>
                  <span className="text-xs font-medium text-gray-700">
                    {connectionStatus === 'connected' ? '实时连接' :
                     connectionStatus === 'connecting' ? '连接中' :
                     connectionStatus === 'error' ? '连接错误' : '离线模式'}
                  </span>
                </div>
              </div>
            </div>

            {/* 右侧用户信息和时间 - 移动优化 */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* 移动设备显示简化用户信息 */}
              <div className="text-right hidden lg:block">
                <div className="text-sm text-gray-600">
                  {userInfo.username} • {formatDateTime(currentTime)}
                </div>
                <div className="text-xs text-gray-500">
                  登录时间: {new Date(workstationSession.loginTime).toLocaleTimeString('zh-CN')}
                </div>
              </div>
              
              {/* 移动设备简化显示 */}
              <div className="text-right block lg:hidden">
                <div className="text-xs text-gray-600">
                  {userInfo.username}
                </div>
                <div className="text-xs text-gray-500">
                  {formatDateTime(currentTime).split(' ')[1]}
                </div>
              </div>
              
              <button
                onClick={handleLogout}
                className="px-3 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 shadow-lg touch-manipulation"
              >
                <span className="hidden sm:inline">退出登录</span>
                <span className="sm:hidden">退出</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 移动优化的主内容区域 */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* 移动优化的快速操作面板 */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <button
            onClick={handleStart}
            disabled={!selectedOrderId || isProcessing}
            className="h-16 sm:h-20 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 active:from-green-700 active:to-green-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95 disabled:hover:scale-100 touch-manipulation"
          >
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 sm:h-6 sm:w-6 border-b-2 border-white mb-1"></div>
                <span className="text-xs sm:text-sm">启动中</span>
              </div>
            ) : (
              <>
                <div className="text-lg sm:text-2xl mb-1">▶️</div>
                <div className="text-xs sm:text-sm">开始处理</div>
              </>
            )}
          </button>

          <button
            onClick={handleAdjustSequence}
            className="h-16 sm:h-20 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 active:from-blue-700 active:to-blue-800 text-white font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95 touch-manipulation"
          >
            <div className="text-lg sm:text-2xl mb-1">🔄</div>
            <div className="text-xs sm:text-sm">调整序列</div>
          </button>

          <button
            onClick={handleManualInsert}
            className="h-16 sm:h-20 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 text-white font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95 touch-manipulation"
          >
            <div className="text-lg sm:text-2xl mb-1">✋</div>
            <div className="text-xs sm:text-sm">手动插入</div>
          </button>

          <button
            onClick={handleServiceMode}
            className="h-16 sm:h-20 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 active:from-orange-700 active:to-orange-800 text-white font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95 touch-manipulation"
          >
            <div className="text-lg sm:text-2xl mb-1">🔧</div>
            <div className="text-xs sm:text-sm">服务模式</div>
          </button>
        </div>

        {/* 移动优化的选项卡导航 */}
        <div className="flex space-x-1 mb-4 sm:mb-6 bg-white/60 backdrop-blur-lg p-1 rounded-xl border border-white/30">
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex-1 py-2 sm:py-3 px-2 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
              activeTab === 'orders'
                ? 'bg-white text-blue-600 shadow-lg'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            } touch-manipulation`}
          >
            <span className="block sm:hidden">📋</span>
            <span className="hidden sm:block">📋 生产订单</span>
          </button>
          <button
            onClick={() => setActiveTab('devices')}
            className={`flex-1 py-2 sm:py-3 px-2 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
              activeTab === 'devices'
                ? 'bg-white text-blue-600 shadow-lg'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            } touch-manipulation`}
          >
            <span className="block sm:hidden">🔌</span>
            <span className="hidden sm:block">🔌 设备状态</span>
          </button>
          <button
            onClick={() => setActiveTab('monitor')}
            className={`flex-1 py-2 sm:py-3 px-2 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
              activeTab === 'monitor'
                ? 'bg-white text-blue-600 shadow-lg'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            } touch-manipulation`}
          >
            <span className="block sm:hidden">📊</span>
            <span className="hidden sm:block">📊 实时监控</span>
          </button>
        </div>

        {/* 选项卡内容 */}
        <div className="space-y-6">
          {/* 移动优化的生产订单选项卡 */}
          {activeTab === 'orders' && (
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 space-y-2 sm:space-y-0">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">生产订单队列</h2>
                <div className="flex items-center justify-between sm:justify-end space-x-2">
                  <span className="text-xs sm:text-sm text-gray-600">共 {orders.length} 个待处理订单</span>
                  <button
                    onClick={loadOrders}
                    className="p-2 text-gray-600 hover:text-blue-600 active:text-blue-700 transition-colors duration-200 touch-manipulation"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:gap-4">
                {orders.length === 0 ? (
                  <div className="text-center py-8 sm:py-12">
                    <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">📭</div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">暂无待处理订单</h3>
                    <p className="text-sm sm:text-base text-gray-600">当前队列中没有需要处理的生产订单</p>
                  </div>
                ) : (
                  orders.map((order) => (
                    <div
                      key={order.id}
                      className={`p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 active:scale-[0.98] ${
                        selectedOrderId === order.id
                          ? 'border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-100'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md active:border-blue-300'
                      } touch-manipulation`}
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0">
                            {order.priority}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{order.orderNumber}</h3>
                            <p className="text-xs sm:text-sm text-gray-600 truncate">生产号: {order.productionNumber}</p>
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-end sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 flex-shrink-0">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(order.priority)}`}>
                            <span className="hidden sm:inline">{getPriorityText(order.priority)}</span>
                            <span className="sm:hidden">{order.priority <= 3 ? '高' : order.priority <= 6 ? '中' : '低'}</span>
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(order.status)}`}>
                            {getStatusText(order.status)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                        <div className="min-w-0">
                          <span className="text-gray-500 block">客户序号:</span>
                          <p className="font-medium truncate">{order.customerSeq}</p>
                        </div>
                        <div className="min-w-0">
                          <span className="text-gray-500 block">车号:</span>
                          <p className="font-medium truncate">{order.carNumber}</p>
                        </div>
                        <div className="min-w-0">
                          <span className="text-gray-500 block">产品族:</span>
                          <p className="font-medium truncate">{order.productFamily}</p>
                        </div>
                        <div className="min-w-0">
                          <span className="text-gray-500 block">载具ID:</span>
                          <p className="font-medium font-mono text-xs truncate">{order.carrierId}</p>
                        </div>
                      </div>

                      {order.product && (
                        <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-200">
                          <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm text-gray-600 truncate flex-1 min-w-0 mr-2">
                              产品: {order.product.name}
                            </span>
                            <span className="text-xs text-gray-500 font-mono flex-shrink-0">{order.product.productCode}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 移动优化的设备状态选项卡 */}
          {activeTab === 'devices' && (
            <div className="space-y-4 sm:space-y-6">
              {/* 移动优化的设备状态概览 */}
              <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 space-y-2 sm:space-y-0">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">设备连接状态</h2>
                  <button
                    onClick={() => workstationSession && loadDeviceStatuses(workstationSession.workstation.id)}
                    className="px-3 py-2 sm:px-4 sm:py-2 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors duration-200 touch-manipulation self-start sm:self-auto"
                  >
                    刷新状态
                  </button>
                </div>

                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {deviceStatuses.length === 0 ? (
                    <div className="col-span-full text-center py-8 sm:py-12">
                      <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">🔌</div>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">暂无设备信息</h3>
                      <p className="text-sm sm:text-base text-gray-600">当前工作站没有连接的设备</p>
                    </div>
                  ) : (
                    deviceStatuses.map((device) => (
                      <div key={device.deviceId} className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200 shadow-sm hover:shadow-md active:shadow-lg transition-shadow duration-200 touch-manipulation">
                        <div className="flex items-center justify-between mb-3 sm:mb-4">
                          <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                            <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full ${getStatusColor(device.status, device.isOnline)} ${device.isOnline ? 'animate-pulse' : ''} flex-shrink-0`}></div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{device.deviceName || device.deviceId}</h3>
                              <p className="text-xs sm:text-sm text-gray-600 truncate">{device.deviceType}</p>
                              {/* 显示品牌和型号 */}
                              {(device.brand || device.model) && (
                                <p className="text-xs text-gray-500 truncate">
                                  {device.brand} {device.model}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className={`px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs font-medium text-white ${getStatusColor(device.status, device.isOnline)} flex-shrink-0`}>
                            {getStatusText(device.status)}
                          </span>
                        </div>

                        <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm text-gray-600">
                          {/* 连接信息 */}
                          {device.ipAddress && (
                            <div className="flex justify-between items-center">
                              <span>连接地址:</span>
                              <span className="text-right font-mono text-xs">
                                {device.ipAddress}{device.port ? `:${device.port}` : ''}
                              </span>
                            </div>
                          )}
                          
                          {device.lastConnected && (
                            <div className="flex justify-between items-center">
                              <span>最后连接:</span>
                              <span className="text-right text-xs">{new Date(device.lastConnected).toLocaleString('zh-CN')}</span>
                            </div>
                          )}
                          {device.lastHeartbeat && (
                            <div className="flex justify-between items-center">
                              <span>最后心跳:</span>
                              <span className="text-right text-xs">{new Date(device.lastHeartbeat).toLocaleString('zh-CN')}</span>
                            </div>
                          )}
                          {device.error && (
                            <div className="text-red-600 text-xs mt-2 p-2 bg-red-50 rounded">
                              错误: {device.error}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 移动优化的设备操作控制面板 */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
                {/* 移动优化的PLC设备操作 */}
                <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center">
                      <span className="text-xl sm:text-2xl mr-2">⚡</span>
                      PLC设备操作
                    </h3>
                    <button
                      onClick={clearOperationHistory}
                      className="text-xs text-gray-500 hover:text-gray-700 active:text-gray-900 transition-colors duration-200 touch-manipulation"
                    >
                      清除历史
                    </button>
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    {/* 移动优化的设备选择 */}
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">选择设备</label>
                      <select
                        value={selectedDeviceId}
                        onChange={(e) => setSelectedDeviceId(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 touch-manipulation"
                        disabled={isExecuting}
                      >
                        <option value="">请选择设备...</option>
                        {deviceStatuses
                          .filter(device => device.isOnline && (device.deviceType?.includes('PLC') || device.deviceType?.includes('plc')))
                          .map((device) => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.deviceName || device.deviceId} - {getStatusText(device.status)}
                              {device.brand && device.model && ` (${device.brand} ${device.model})`}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* 移动优化的操作类型 */}
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">操作类型</label>
                      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                        <label className="flex items-center touch-manipulation">
                          <input
                            type="radio"
                            name="operation"
                            value="read"
                            checked={operation === 'read'}
                            onChange={(e) => setOperation(e.target.value as 'read' | 'write')}
                            disabled={isExecuting}
                            className="mr-2 text-blue-500 w-4 h-4"
                          />
                          <span className="flex items-center text-sm">
                            📥 读取数据
                          </span>
                        </label>
                        <label className="flex items-center touch-manipulation">
                          <input
                            type="radio"
                            name="operation"
                            value="write"
                            checked={operation === 'write'}
                            onChange={(e) => setOperation(e.target.value as 'read' | 'write')}
                            disabled={isExecuting}
                            className="mr-2 text-blue-500 w-4 h-4"
                          />
                          <span className="flex items-center text-sm">
                            📤 写入数据
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {/* 移动优化的地址输入 */}
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">PLC地址</label>
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="例如: DB1.DBW0, M100, I0.0"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 touch-manipulation"
                          disabled={isExecuting}
                        />
                      </div>

                      {/* 移动优化的数据类型 */}
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">数据类型</label>
                        <select
                          value={dataType}
                          onChange={(e) => setDataType(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 touch-manipulation"
                          disabled={isExecuting}
                        >
                          <option value="BOOL">BOOL</option>
                          <option value="BYTE">BYTE</option>
                          <option value="WORD">WORD</option>
                          <option value="DWORD">DWORD</option>
                          <option value="INT">INT</option>
                          <option value="DINT">DINT</option>
                          <option value="REAL">REAL</option>
                          <option value="STRING">STRING</option>
                        </select>
                      </div>
                    </div>

                    {/* 写入值输入 */}
                    {operation === 'write' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">写入值</label>
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          placeholder={`请输入${dataType}类型的值`}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                          disabled={isExecuting}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {dataType === 'BOOL' && 'BOOL: true/false 或 1/0'}
                          {dataType === 'INT' && 'INT: -32768 到 32767'}
                          {dataType === 'DINT' && 'DINT: -2147483648 到 2147483647'}
                          {dataType === 'REAL' && 'REAL: 浮点数 (例如: 3.14)'}
                          {dataType === 'STRING' && 'STRING: 文本字符串'}
                        </p>
                      </div>
                    )}

                    {/* 执行按钮 */}
                    <button
                      onClick={executeDeviceOperation}
                      disabled={isExecuting || !selectedDeviceId || !address.trim() || (operation === 'write' && !value.trim())}
                      className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:hover:scale-100"
                    >
                      {isExecuting ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          执行中...
                        </div>
                      ) : (
                        `🚀 执行${operation === 'read' ? '读取' : '写入'}操作`
                      )}
                    </button>

                    {/* 操作结果 */}
                    {operationResult && (
                      <div className={`p-4 rounded-lg border-l-4 ${
                        operationResult.success 
                          ? 'bg-green-50 border-green-400' 
                          : 'bg-red-50 border-red-400'
                      }`}>
                        <div className="flex items-center mb-2">
                          <span className={`text-sm font-medium ${
                            operationResult.success ? 'text-green-800' : 'text-red-800'
                          }`}>
                            {operationResult.success ? '✅ 操作成功' : '❌ 操作失败'}
                          </span>
                          <span className="text-xs text-gray-500 ml-auto">
                            耗时: {operationResult.duration}ms
                          </span>
                        </div>

                        {operationResult.success && operationResult.data !== undefined && (
                          <div className="mb-2">
                            <span className="text-sm font-medium text-green-800">读取结果: </span>
                            <span className="text-green-700 font-mono bg-green-100 px-2 py-1 rounded">
                              {JSON.stringify(operationResult.data)}
                            </span>
                          </div>
                        )}

                        {operationResult.errorMessage && (
                          <div className="text-sm text-red-700 mb-2">
                            <span className="font-medium">错误详情: </span>
                            {operationResult.errorMessage}
                          </div>
                        )}

                        <div className="text-xs text-gray-500">
                          {formatDateTime(new Date(operationResult.timestamp))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 条码扫描器操作 - 只在有扫码设备时显示 */}
                {deviceStatuses.some(device => device.deviceType?.toLowerCase().includes('scanner') || device.deviceType?.toLowerCase().includes('barcode')) && (
                <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center">
                      <span className="text-2xl mr-2">📱</span>
                      条码扫描器
                    </h3>
                    <button
                      onClick={clearScanHistory}
                      className="text-xs text-gray-500 hover:text-gray-700 transition-colors duration-200"
                    >
                      清除历史
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* 扫描器状态 */}
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 ${deviceStatuses.filter(d => (d.deviceType?.toLowerCase().includes('scanner') || d.deviceType?.toLowerCase().includes('barcode')) && d.isOnline).length > 0 ? 'bg-green-400 animate-pulse' : 'bg-gray-400'} rounded-full mr-3`}></div>
                        <span className="text-sm font-medium text-gray-700">
                          扫描器{deviceStatuses.filter(d => (d.deviceType?.toLowerCase().includes('scanner') || d.deviceType?.toLowerCase().includes('barcode')) && d.isOnline).length > 0 ? '就绪' : '离线'}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {deviceStatuses.filter(d => (d.deviceType?.toLowerCase().includes('scanner') || d.deviceType?.toLowerCase().includes('barcode')) && d.isOnline).length > 0 ? '在线' : '离线'}
                      </span>
                    </div>

                    {/* 手动输入条码 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">手动输入条码</label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={scannedBarcode}
                          onChange={(e) => setScannedBarcode(e.target.value)}
                          placeholder="输入或扫描条码..."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && scannedBarcode.trim()) {
                              handleBarcodeScan(scannedBarcode.trim());
                            }
                          }}
                        />
                        <button
                          onClick={() => scannedBarcode.trim() && handleBarcodeScan(scannedBarcode.trim())}
                          disabled={!scannedBarcode.trim()}
                          className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200"
                        >
                          📱 扫描
                        </button>
                      </div>
                    </div>

                    {/* 扫描历史 */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">扫描历史 ({scanHistory.length})</h4>
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {scanHistory.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <div className="text-3xl mb-2">📋</div>
                            <p className="text-sm">暂无扫描记录</p>
                          </div>
                        ) : (
                          scanHistory.map((barcode, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center">
                                <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                                <span className="font-mono text-sm">{barcode}</span>
                              </div>
                              <span className="text-xs text-gray-500">
                                {index === 0 ? '刚刚' : `${index + 1}条前`}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                )}

                {/* 如果没有扫码设备，显示提示信息 */}
                {!deviceStatuses.some(device => device.deviceType?.toLowerCase().includes('scanner') || device.deviceType?.toLowerCase().includes('barcode')) && (
                <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 p-6">
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-4">📱</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">未配置扫码设备</h3>
                    <p className="text-sm text-gray-600">当前工位没有配置条码扫描器设备</p>
                    <p className="text-xs text-gray-500 mt-2">如需扫码功能，请联系管理员配置相应设备</p>
                  </div>
                </div>
                )}
              </div>

              {/* 操作历史记录 */}
              {operationHistory.length > 0 && (
                <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">操作历史记录</h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {operationHistory.map((record) => (
                      <div key={record.requestId} className={`p-3 rounded-lg border-l-4 ${
                        record.success ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">
                            {record.success ? '✅' : '❌'} {record.requestId}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDateTime(new Date(record.timestamp))} • {record.duration}ms
                          </span>
                        </div>
                        {record.data !== undefined && (
                          <div className="text-sm text-gray-700">
                            结果: <span className="font-mono">{JSON.stringify(record.data)}</span>
                          </div>
                        )}
                        {record.errorMessage && (
                          <div className="text-sm text-red-600">
                            错误: {record.errorMessage}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 实时监控选项卡 */}
          {activeTab === 'monitor' && (
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">实时监控面板</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 工作站概况 */}
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">工作站状态</h3>
                    <div className="text-2xl">🏭</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>工作站:</span>
                      <span className="font-medium">{workstationSession.workstation.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>类型:</span>
                      <span className="font-medium">
                        {workstationSession.workstation.type === 'VISUAL_CLIENT' ? '交互式' : '自动化'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>操作员:</span>
                      <span className="font-medium">{workstationSession.username}</span>
                    </div>
                  </div>
                </div>

                {/* 订单统计 */}
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">订单统计</h3>
                    <div className="text-2xl">📊</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>待处理:</span>
                      <span className="font-bold text-xl">{orders.filter(o => o.status === 'pending').length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>处理中:</span>
                      <span className="font-bold text-xl">{orders.filter(o => o.status === 'in_progress').length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>总数:</span>
                      <span className="font-medium">{orders.length}</span>
                    </div>
                  </div>
                </div>

                {/* 设备统计 */}
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">设备状态</h3>
                    <div className="text-2xl">⚡</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>在线设备:</span>
                      <span className="font-bold text-xl">{deviceStatuses.filter(d => d.isOnline).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>离线设备:</span>
                      <span className="font-bold text-xl">{deviceStatuses.filter(d => !d.isOnline).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>总数:</span>
                      <span className="font-medium">{deviceStatuses.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 实时事件面板 */}
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 实时事件流 */}
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 flex items-center">
                      <span className="text-xl mr-2">📡</span>
                      实时事件流
                    </h3>
                    <div className="flex items-center space-x-2">
                      {connectionStatus === 'connected' && lastHeartbeat && (
                        <span className="text-xs text-green-600">
                          最后更新: {formatDateTime(lastHeartbeat)}
                        </span>
                      )}
                      <button
                        onClick={() => setRealTimeEvents([])}
                        className="text-xs text-gray-500 hover:text-gray-700 transition-colors duration-200"
                      >
                        清除事件
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {realTimeEvents.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-3xl mb-2">📊</div>
                        <p className="text-sm">
                          {connectionStatus === 'connected' ? '等待实时事件...' : '连接实时服务后显示事件'}
                        </p>
                      </div>
                    ) : (
                      realTimeEvents.map((event) => (
                        <div key={event.id} className={`flex items-start p-3 rounded-lg border-l-4 ${
                          event.severity === 'success' ? 'bg-green-50 border-green-400' :
                          event.severity === 'warning' ? 'bg-yellow-50 border-yellow-400' :
                          event.severity === 'error' ? 'bg-red-50 border-red-400' :
                          'bg-blue-50 border-blue-400'
                        }`}>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-sm font-medium ${
                                event.severity === 'success' ? 'text-green-800' :
                                event.severity === 'warning' ? 'text-yellow-800' :
                                event.severity === 'error' ? 'text-red-800' :
                                'text-blue-800'
                              }`}>
                                {event.type === 'device_status' ? '🔌' :
                                 event.type === 'device_operation' ? '⚡' :
                                 event.type === 'order_update' ? '📋' :
                                 event.type === 'barcode_scan' ? '📱' :
                                 event.type === 'system' ? '💻' : '📡'} 
                                {event.message}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {formatDateTime(event.timestamp)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 系统状态和诊断 */}
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="text-xl mr-2">🔍</span>
                    系统诊断
                  </h3>
                  
                  <div className="space-y-4">
                    {/* WebSocket连接详情 */}
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-700">实时连接状态</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          connectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
                          connectionStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' :
                          connectionStatus === 'error' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {connectionStatus === 'connected' ? '已连接' :
                           connectionStatus === 'connecting' ? '连接中' :
                           connectionStatus === 'error' ? '连接错误' : '未连接'}
                        </span>
                      </div>
                      {connectionStatus === 'connected' && lastHeartbeat && (
                        <p className="text-xs text-gray-600">
                          上次心跳: {formatDateTime(lastHeartbeat)}
                        </p>
                      )}
                      {connectionStatus === 'error' && (
                        <p className="text-xs text-red-600">
                          无法连接到实时服务，正在使用离线模式
                        </p>
                      )}
                    </div>

                    {/* 安全状态面板 */}
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-700">安全状态</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          securityState.sessionValid && !securityState.isLocked ? 'bg-green-100 text-green-800' :
                          securityState.isLocked ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {securityState.sessionValid && !securityState.isLocked ? '安全' :
                           securityState.isLocked ? '已锁定' : '警告'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="block">剩余设备操作:</span>
                          <span className="font-medium text-blue-600">
                            {getRemainingOperations('device_operation', workstationSession?.sessionId || 'unknown')}/
                            {SECURITY_CONFIG.RATE_LIMIT.DEVICE_OPERATIONS}
                          </span>
                        </div>
                        <div>
                          <span className="block">剩余扫描次数:</span>
                          <span className="font-medium text-green-600">
                            {getRemainingOperations('barcode_scan', workstationSession?.sessionId || 'unknown')}/
                            {SECURITY_CONFIG.RATE_LIMIT.BARCODE_SCANS}
                          </span>
                        </div>
                        <div>
                          <span className="block">会话状态:</span>
                          <span className={`font-medium ${securityState.sessionValid ? 'text-green-600' : 'text-red-600'}`}>
                            {securityState.sessionValid ? '有效' : '无效'}
                          </span>
                        </div>
                        <div>
                          <span className="block">失败尝试:</span>
                          <span className={`font-medium ${securityState.failedAttempts < 2 ? 'text-green-600' : 'text-orange-600'}`}>
                            {securityState.failedAttempts}/{SECURITY_CONFIG.MAX_FAILED_ATTEMPTS}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        最后活动: {formatDateTime(securityState.lastActivity)}
                      </div>
                    </div>

                    {/* 操作统计 */}
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-700">操作统计</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="block">成功操作:</span>
                          <span className="font-medium text-green-600">
                            {operationHistory.filter(op => op.success).length}
                          </span>
                        </div>
                        <div>
                          <span className="block">失败操作:</span>
                          <span className="font-medium text-red-600">
                            {operationHistory.filter(op => !op.success).length}
                          </span>
                        </div>
                        <div>
                          <span className="block">扫描记录:</span>
                          <span className="font-medium text-blue-600">
                            {scanHistory.length}
                          </span>
                        </div>
                        <div>
                          <span className="block">实时事件:</span>
                          <span className="font-medium text-purple-600">
                            {realTimeEvents.length}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 性能指标 */}
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-700">性能指标</span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        {operationHistory.length > 0 && (
                          <div className="flex justify-between">
                            <span>平均响应时间:</span>
                            <span className="font-medium">
                              {Math.round(operationHistory.reduce((sum, op) => sum + op.duration, 0) / operationHistory.length)}ms
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>会话时长:</span>
                          <span className="font-medium">
                            {Math.floor((Date.now() - new Date(workstationSession.loginTime).getTime()) / 1000 / 60)}分钟
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>在线设备:</span>
                          <span className="font-medium">
                            {deviceStatuses.filter(d => d.isOnline).length}/{deviceStatuses.length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}