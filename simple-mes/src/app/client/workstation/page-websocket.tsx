'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { WebSocketClient } from '@/lib/websocket/client';

// 动作接口
interface Action {
  id: string;
  name: string;
  deviceId?: string;
  device?: {
    id: string;
    deviceId: string;
    name: string;
    ipAddress: string;
    port: number;
  };
  deviceAddress?: string;
  expectedValue?: string;
  parameters?: any;
  status?: 'pending' | 'in_progress' | 'completed';
}

// 工作状态接口
interface WorkstationSession {
  sessionId: string;
  workstation: {
    id: string;
    workstationId: string;
    name: string;
  };
}

// 优化的PLC监控Hook
function usePLCMonitor(wsClient: WebSocketClient | null) {
  const [monitoringTasks] = useState(new Map<string, string>());
  
  const startMonitoring = (
    action: Action,
    onComplete: () => void,
    onError: (error: Error) => void
  ): string | null => {
    if (!wsClient?.isConnected() || !action.device) {
      onError(new Error('WebSocket未连接或设备未配置'));
      return null;
    }
    
    const deviceId = action.device.deviceId;
    const sensorValue = action.parameters?.sensorValue || 
                       action.parameters?.completionCondition || 
                       action.deviceAddress || '';
    
    if (!sensorValue) {
      console.log('动作未配置传感器地址，跳过监控');
      return null;
    }
    
    // 解析地址和期望值
    let address = sensorValue;
    let expectedValue = '1';
    
    if (sensorValue.includes('=')) {
      const parts = sensorValue.split('=');
      address = parts[0].trim();
      expectedValue = parts[1].trim();
    }
    
    console.log(`开始WebSocket监控: ${action.name}, 地址: ${address}, 期望值: ${expectedValue}`);
    
    // 订阅PLC数据，使用50ms的高频率监控
    const subscriptionKey = wsClient.subscribePLC(
      deviceId,
      address,
      50, // 50ms监控间隔，显著降低延迟
      (data) => {
        if (data.error) {
          console.error('PLC监控错误:', data.error);
          onError(new Error(data.error));
          return;
        }
        
        // 检查值是否匹配期望值
        const currentValue = data.value?.toString();
        console.log(`PLC值更新: ${address} = ${currentValue}, 期望: ${expectedValue}`);
        
        if (currentValue === expectedValue || 
            (expectedValue === '1' && (currentValue === 'true' || currentValue === '1')) ||
            (expectedValue === '0' && (currentValue === 'false' || currentValue === '0'))) {
          console.log(`动作完成: ${action.name}, 条件满足`);
          stopMonitoring(subscriptionKey);
          onComplete();
        }
      }
    );
    
    monitoringTasks.set(action.id, subscriptionKey);
    return subscriptionKey;
  };
  
  const stopMonitoring = (subscriptionKey: string) => {
    if (wsClient && subscriptionKey) {
      wsClient.unsubscribePLC(subscriptionKey);
      
      // 从任务列表中移除
      for (const [actionId, key] of monitoringTasks) {
        if (key === subscriptionKey) {
          monitoringTasks.delete(actionId);
          break;
        }
      }
    }
  };
  
  const stopAllMonitoring = () => {
    for (const subscriptionKey of monitoringTasks.values()) {
      if (wsClient) {
        wsClient.unsubscribePLC(subscriptionKey);
      }
    }
    monitoringTasks.clear();
  };
  
  return {
    startMonitoring,
    stopMonitoring,
    stopAllMonitoring
  };
}

export default function WorkstationPageWebSocket() {
  const router = useRouter();
  const [workstationSession, setWorkstationSession] = useState<WorkstationSession | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [isExecutionMode, setIsExecutionMode] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  
  // WebSocket客户端
  const wsClientRef = useRef<WebSocketClient | null>(null);
  const { startMonitoring, stopAllMonitoring } = usePLCMonitor(wsClientRef.current);
  
  // 初始化WebSocket连接
  useEffect(() => {
    const userInfoStr = localStorage.getItem("clientUserInfo");
    
    if (!userInfoStr) {
      router.push('/client/login');
      return;
    }

    // 扫描所有可用的工位session
    const availableSessions = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('workstationSession_')) {
        const sessionStr = localStorage.getItem(key);
        if (sessionStr) {
          try {
            const session = JSON.parse(sessionStr);
            availableSessions.push(session);
          } catch (e) {
            // 无效的session，忽略
          }
        }
      }
    }

    // 检查旧格式的session（向后兼容）
    const oldSessionStr = localStorage.getItem('workstationSession');
    if (oldSessionStr) {
      try {
        const oldSession = JSON.parse(oldSessionStr);
        availableSessions.push(oldSession);
      } catch (e) {
        // 无效的session，忽略
      }
    }

    if (availableSessions.length === 0) {
      router.push('/client/login');
      return;
    }
    
    // 使用第一个可用的session
    const sessionData = availableSessions[0];
    setWorkstationSession(sessionData);
    
    // 创建WebSocket客户端
    const wsClient = new WebSocketClient({
      userId: sessionData.userId,
      workstationId: sessionData.workstation.workstationId
    });
    
    wsClientRef.current = wsClient;
    
    // 监听连接状态
    wsClient.on('connected', () => {
      console.log('WebSocket已连接');
      setWsConnected(true);
      
      // 订阅订单更新
      wsClient.subscribeOrders(sessionData.workstation.workstationId, (orders) => {
        console.log('收到订单更新:', orders);
        setOrders(orders);
      });
      
      // 订阅设备状态
      if (currentOrder?.orderSteps) {
        subscribeDeviceStatus();
      }
    });
    
    wsClient.on('disconnected', () => {
      console.log('WebSocket已断开');
      setWsConnected(false);
    });
    
    // 连接WebSocket
    wsClient.connect().catch(error => {
      console.error('WebSocket连接失败:', error);
    });
    
    // 清理函数
    return () => {
      stopAllMonitoring();
      wsClient.disconnect();
    };
  }, [router]);
  
  // 订阅设备状态
  const subscribeDeviceStatus = () => {
    const wsClient = wsClientRef.current;
    if (!wsClient || !currentOrder) return;
    
    // 收集所有设备ID
    const deviceIds = new Set<string>();
    currentOrder.orderSteps?.forEach((step: any) => {
      step.step.actions?.forEach((action: Action) => {
        if (action.device?.deviceId) {
          deviceIds.add(action.device.deviceId);
        }
      });
    });
    
    // 订阅每个设备的状态
    deviceIds.forEach(deviceId => {
      wsClient.subscribeDeviceStatus(deviceId, (status) => {
        console.log(`设备状态更新 ${deviceId}:`, status);
        // 更新UI显示设备状态
      });
    });
  };
  
  // 获取当前动作
  const getCurrentAction = (): Action | null => {
    if (!currentOrder?.orderSteps) return null;
    const currentStep = currentOrder.orderSteps[currentStepIndex];
    if (!currentStep?.step?.actions) return null;
    return currentStep.step.actions[currentActionIndex] || null;
  };
  
  // 处理下一个动作
  const handleNextAction = () => {
    const currentStep = currentOrder?.orderSteps?.[currentStepIndex];
    if (!currentStep) return;
    
    const actions = currentStep.step.actions || [];
    
    // 标记当前动作为完成
    if (actions[currentActionIndex]) {
      actions[currentActionIndex].status = 'completed';
    }
    
    if (currentActionIndex < actions.length - 1) {
      // 移动到下一个动作
      setCurrentActionIndex(currentActionIndex + 1);
    } else {
      // 当前步骤的所有动作完成，移动到下一个步骤
      handleNextStep();
    }
  };
  
  // 处理下一个步骤
  const handleNextStep = () => {
    if (currentStepIndex < currentOrder.orderSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      setCurrentActionIndex(0);
    } else {
      // 所有步骤完成
      completeOrder();
    }
  };
  
  // 完成订单
  const completeOrder = async () => {
    console.log('订单完成');
    
    // 停止所有监控
    stopAllMonitoring();
    
    // 更新订单状态
    try {
      const response = await fetch(`/api/orders/${currentOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'changeStatus',
          status: 'COMPLETED',
          updatedBy: 'client',
          reason: '所有工艺步骤已完成'
        })
      });
      
      if (response.ok) {
        console.log('订单状态已更新为完成');
      }
    } catch (error) {
      console.error('更新订单状态失败:', error);
    }
    
    // 退出执行模式
    setIsExecutionMode(false);
    setCurrentOrder(null);
    setCurrentStepIndex(0);
    setCurrentActionIndex(0);
  };
  
  // 监听当前动作变化，自动开始监控
  useEffect(() => {
    if (!isExecutionMode || !wsClientRef.current?.isConnected()) return;
    
    const currentAction = getCurrentAction();
    if (!currentAction || !currentAction.device) return;
    
    console.log('开始监控新动作:', currentAction.name);
    
    // 使用WebSocket监控PLC
    const subscriptionKey = startMonitoring(
      currentAction,
      () => {
        // 动作完成回调
        console.log('动作通过WebSocket监控完成');
        handleNextAction();
      },
      (error) => {
        // 错误处理
        console.error('动作监控错误:', error);
      }
    );
    
    // 清理函数
    return () => {
      if (subscriptionKey && wsClientRef.current) {
        wsClientRef.current.unsubscribePLC(subscriptionKey);
      }
    };
  }, [currentActionIndex, currentStepIndex, isExecutionMode, wsConnected]);
  
  // 开始执行订单
  const handleStartOrder = async (order: any) => {
    try {
      // 加载订单详情
      const response = await fetch(`/api/orders/${order.id}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setCurrentOrder(data.data);
        setCurrentStepIndex(0);
        setCurrentActionIndex(0);
        setIsExecutionMode(true);
        
        // 订阅设备状态
        subscribeDeviceStatus();
        
        console.log('开始执行订单（WebSocket模式）:', order.orderNumber);
      }
    } catch (error) {
      console.error('加载订单失败:', error);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto p-4">
        {/* WebSocket连接状态 */}
        <div className="mb-4 p-2 bg-white rounded shadow">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm">
              WebSocket: {wsConnected ? '已连接（实时模式）' : '未连接'}
            </span>
          </div>
        </div>
        
        {/* 订单列表 */}
        {!isExecutionMode && (
          <div className="bg-white rounded shadow p-4">
            <h2 className="text-xl font-bold mb-4">待执行订单（实时更新）</h2>
            <div className="space-y-2">
              {orders.map(order => (
                <div key={order.id} className="border p-3 rounded flex justify-between items-center">
                  <div>
                    <div className="font-medium">{order.orderNumber}</div>
                    <div className="text-sm text-gray-600">{order.productionNumber}</div>
                  </div>
                  <button
                    onClick={() => handleStartOrder(order)}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    disabled={!wsConnected}
                  >
                    开始执行
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 执行模式 */}
        {isExecutionMode && currentOrder && (
          <div className="bg-white rounded shadow p-4">
            <h2 className="text-xl font-bold mb-4">
              正在执行: {currentOrder.orderNumber}
            </h2>
            
            {/* 当前步骤 */}
            <div className="mb-4">
              <h3 className="font-medium">
                步骤 {currentStepIndex + 1}/{currentOrder.orderSteps?.length || 0}: 
                {currentOrder.orderSteps?.[currentStepIndex]?.step?.name}
              </h3>
            </div>
            
            {/* 当前动作 */}
            <div className="mb-4">
              <h4 className="font-medium">当前动作:</h4>
              <div className="p-3 border rounded bg-yellow-50">
                {getCurrentAction()?.name || '无'}
              </div>
              {getCurrentAction()?.device && (
                <div className="mt-2 text-sm text-gray-600">
                  设备: {getCurrentAction()?.device?.name} 
                  ({getCurrentAction()?.device?.ipAddress}:{getCurrentAction()?.device?.port})
                </div>
              )}
            </div>
            
            {/* WebSocket监控状态 */}
            <div className="text-sm text-gray-600">
              使用WebSocket实时监控，延迟: ~50ms
            </div>
          </div>
        )}
      </div>
    </div>
  );
}