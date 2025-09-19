'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import { DevicePreloadManager } from '@/lib/device-preload/DevicePreloadManager';

// 复用原有的接口定义
interface Action {
  id: string;
  sequence: number;
  name: string;
  type: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  parameters?: any;
  deviceAddress?: string;
  expectedValue?: string;
  device?: {
    id: string;
    deviceId: string;
    name: string;
    type: string;
    ipAddress?: string;
    port?: number;
  };
}

interface OrderStep {
  id: string;
  sequence: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  step: {
    id: string;
    stepCode: string;
    name: string;
    sequence: number;
    actions: Action[];
  };
}

interface Order {
  id: string;
  orderNumber: string;
  productionNumber: string;
  productFamily: string;
  carrierId: string;
  status: string;
  priority: number;
  orderSteps?: OrderStep[];
}

export default function WorkstationPageWithWebSocket() {
  const router = useRouter();
  const { t } = useLanguage();
  
  // 基础状态
  const [workstationSession, setWorkstationSession] = useState<any>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // 执行模式状态
  const [isExecutionMode, setIsExecutionMode] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [isMonitoringPLC, setIsMonitoringPLC] = useState(false);
  const [screenError, setScreenError] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [assemblyLineTimer, setAssemblyLineTimer] = useState("00:00:00");
  
  // WebSocket连接
  const ws = useWebSocket({
    userId: userInfo?.username,
    workstationId: workstationSession?.workstation?.workstationId,
    autoConnect: true
  });
  
  // PLC监控任务跟踪
  const currentMonitorKeyRef = useRef<string>('');
  
  // 验证会话
  useEffect(() => {
    const validateSession = () => {
      const userInfoStr = localStorage.getItem("clientUserInfo");
      
      if (!userInfoStr) {
        router.push("/client/login");
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
        router.push("/client/login");
        return;
      }
      
      // 使用第一个可用的session
      const session = availableSessions[0];
      setUserInfo(JSON.parse(userInfoStr));
      setWorkstationSession(session);
      
      // 加载订单
      loadOrders(session.workstation.workstationId);
    };
    
    validateSession();
  }, [router]);
  
  // WebSocket连接后订阅订单更新
  useEffect(() => {
    if (ws.connected && workstationSession) {
      // 订阅订单实时更新
      ws.subscribeOrders(workstationSession.workstation.workstationId, (data) => {
        if (data.orders) {
          setOrders(data.orders);
        }
      });
    }
  }, [ws.connected, workstationSession]);
  
  // 加载订单
  const loadOrders = async (workstationId: string) => {
    try {
      const response = await fetch(`/api/orders?workstationId=${workstationId}&limit=20`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.orders) {
          const mappedOrders = data.data.orders.map((order: any) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            productionNumber: order.productionNumber,
            productFamily: order.product?.name || 'N/A',
            carrierId: order.notes || `CARR-${order.id.slice(-6)}`,
            status: order.status.toLowerCase(),
            priority: order.priority
          }));
          
          setOrders(mappedOrders);
        }
      }
    } catch (error) {

    }
  };
  
  // 获取当前动作
  const getCurrentAction = (): Action | null => {
    if (!currentOrder?.orderSteps) return null;
    const currentStep = currentOrder.orderSteps[currentStepIndex];
    if (!currentStep?.step?.actions) return null;
    return currentStep.step.actions[currentActionIndex] || null;
  };
  
  // 获取当前步骤
  const getCurrentStep = (): OrderStep | null => {
    if (!currentOrder?.orderSteps) return null;
    return currentOrder.orderSteps[currentStepIndex] || null;
  };
  
  // 使用WebSocket开始PLC监控
  const startPLCMonitoring = useCallback(async (action: Action) => {
    if (!action.device) {
      return;
    }
    
    // 确保WebSocket已连接
    if (!ws.connected) {
      try {
        await ws.connect();
      } catch (error) {

        setScreenError(true);
        return;
      }
    }
    
    setScreenError(false);
    setIsMonitoringPLC(true);
    
    const deviceInstanceId = action.device.deviceId;

    
    // 先确保设备已连接
    try {
      await ws.connectDevice(deviceInstanceId);
    } catch (error) {
    }
    
    // 解析PLC地址和期望值
    const sensorValue = action.parameters?.sensorValue || 
                       action.parameters?.completionCondition || 
                       action.deviceAddress || '';
    
    if (!sensorValue) {
      setIsMonitoringPLC(false);
      return;
    }
    
    let address = sensorValue;
    let expectedValue = '1';
    
    if (sensorValue.includes('=')) {
      const parts = sensorValue.split('=');
      address = parts[0].trim();
      expectedValue = parts[1].trim();
    } else if (action.expectedValue) {
      expectedValue = action.expectedValue.toString();
    }
    

    
    // 使用WebSocket监控PLC
    const monitorKey = ws.startPLCMonitor({
      deviceId: deviceInstanceId,
      address: address,
      expectedValue: expectedValue,
      interval: 50, // 50ms高频监控
      onData: (data) => {
      },
      onComplete: (data) => {
        setIsMonitoringPLC(false);
        currentMonitorKeyRef.current = '';
        
        // 自动进入下一个动作
        setTimeout(() => handleNextAction(), 100);
      },
      onError: (error) => {

        setIsMonitoringPLC(false);
        setScreenError(true);
        currentMonitorKeyRef.current = '';
      }
    });
    
    currentMonitorKeyRef.current = monitorKey;
  }, [ws]);
  
  // 停止当前PLC监控
  const stopCurrentPLCMonitoring = useCallback(() => {
    if (currentMonitorKeyRef.current) {
      ws.stopPLCMonitor(currentMonitorKeyRef.current);
      currentMonitorKeyRef.current = '';
    }
    setIsMonitoringPLC(false);
  }, [ws]);
  
  // 处理下一个动作
  const handleNextAction = () => {
    const currentStep = getCurrentStep();
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
      // 当前步骤完成，移动到下一个步骤
      handleNextStep();
    }
  };
  
  // 处理下一个步骤
  const handleNextStep = () => {
    if (!currentOrder?.orderSteps) return;
    
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

    
    // 停止PLC监控
    stopCurrentPLCMonitoring();
    
    // 更新订单状态
    if (currentOrder) {
      try {
        const response = await fetch(`/api/orders/${currentOrder.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'changeStatus',
            status: 'COMPLETED',
            updatedBy: userInfo?.username || 'client',
            reason: '所有工艺步骤已完成'
          })
        });
        
        if (response.ok) {
        }
      } catch (error) {
      }
    }
    
    // 退出执行模式
    setIsExecutionMode(false);
    setCurrentOrder(null);
    setCurrentStepIndex(0);
    setCurrentActionIndex(0);
    setStartTime(null);
    
    // 刷新订单列表
    if (workstationSession) {
      loadOrders(workstationSession.workstation.workstationId);
    }
  };
  
  // 监听当前动作变化，自动开始监控
  useEffect(() => {
    if (!isExecutionMode) return;
    
    const currentAction = getCurrentAction();
    if (!currentAction || !currentAction.device) return;
    
    startPLCMonitoring(currentAction);
    
    return () => {
      // 清理：停止当前监控
      stopCurrentPLCMonitoring();
    };
  }, [currentActionIndex, currentStepIndex, isExecutionMode]);
  
  // 开始执行订单
  const handleStartOrder = async (order: Order) => {
    try {

      
      // 加载订单详情
      const response = await fetch(`/api/orders/${order.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // 处理订单数据
          const processedOrder = {
            ...data.data,
            orderSteps: data.data.orderSteps?.map((orderStep: any) => ({
              ...orderStep,
              step: {
                ...orderStep.step,
                actions: orderStep.step.actions?.map((action: any) => ({
                  ...action,
                  status: action.status || 'pending'
                })) || []
              }
            })) || []
          };
          
          setCurrentOrder(processedOrder);
          setCurrentStepIndex(0);
          setCurrentActionIndex(0);
          setIsExecutionMode(true);
          setStartTime(new Date());
          
        }
      }
    } catch (error) {

      alert('无法加载订单详情');
    }
  };
  
  // 更新计时器
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      
      if (startTime && isExecutionMode) {
        const now = new Date();
        const diffMs = now.getTime() - startTime.getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
        
        setAssemblyLineTimer(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [startTime, isExecutionMode]);
  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* 顶部状态栏 */}
      <div className="bg-white shadow-sm border-b px-4 py-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <span className="font-bold text-lg">
              {workstationSession?.workstation?.name || 'Loading...'}
            </span>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${ws.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm">
                WebSocket: {ws.connected ? '已连接（实时模式）' : ws.connecting ? '连接中...' : '未连接'}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm">{userInfo?.username}</span>
            <span className="text-sm">{currentTime.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
      
      {/* 主内容区 */}
      <div className="p-4">
        {!isExecutionMode ? (
          // 订单列表模式
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">待执行订单（WebSocket实时更新）</h2>
            <div className="space-y-3">
              {orders.map(order => (
                <div 
                  key={order.id} 
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-lg">{order.orderNumber}</div>
                      <div className="text-sm text-gray-600">
                        生产号: {order.productionNumber} | 产品族: {order.productFamily}
                      </div>
                      <div className="text-sm text-gray-500">
                        载具: {order.carrierId} | 状态: {order.status}
                      </div>
                    </div>
                    <button
                      onClick={() => handleStartOrder(order)}
                      className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400"
                      disabled={!ws.connected}
                    >
                      开始执行
                    </button>
                  </div>
                </div>
              ))}
              
              {orders.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  暂无待执行订单
                </div>
              )}
            </div>
          </div>
        ) : (
          // 执行模式
          <div className="space-y-4">
            {/* 执行状态栏 */}
            <div className={`bg-white rounded-lg shadow p-4 ${screenError ? 'border-2 border-red-500' : ''}`}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">
                  正在执行: {currentOrder?.orderNumber}
                </h2>
                <div className="flex items-center space-x-4">
                  <span className="text-lg font-mono">{assemblyLineTimer}</span>
                  <button
                    onClick={() => {
                      if (confirm('确定要停止执行吗？')) {
                        stopCurrentPLCMonitoring();
                        setIsExecutionMode(false);
                        setCurrentOrder(null);
                      }
                    }}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    停止
                  </button>
                </div>
              </div>
              
              {/* 当前步骤信息 */}
              <div className="border-t pt-4">
                <div className="mb-2">
                  <span className="font-medium">当前步骤: </span>
                  <span className="text-lg">
                    {getCurrentStep()?.step?.name || 'N/A'} 
                    ({currentStepIndex + 1}/{currentOrder?.orderSteps?.length || 0})
                  </span>
                </div>
                
                <div className="mb-2">
                  <span className="font-medium">当前动作: </span>
                  <span className="text-lg">
                    {getCurrentAction()?.name || 'N/A'}
                    ({currentActionIndex + 1}/{getCurrentStep()?.step?.actions?.length || 0})
                  </span>
                </div>
                
                {getCurrentAction()?.device && (
                  <div className="text-sm text-gray-600">
                    设备: {getCurrentAction()?.device?.name} 
                    ({getCurrentAction()?.device?.ipAddress}:{getCurrentAction()?.device?.port})
                  </div>
                )}
                
                {isMonitoringPLC && (
                  <div className="mt-2 flex items-center">
                    <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-sm text-green-600">
                      WebSocket实时监控中（50ms延迟）
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* 步骤列表 */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-3">工艺步骤</h3>
              <div className="space-y-2">
                {currentOrder?.orderSteps?.map((orderStep, index) => (
                  <div 
                    key={orderStep.id}
                    className={`p-3 border rounded ${
                      index === currentStepIndex 
                        ? 'bg-blue-50 border-blue-500' 
                        : orderStep.status === 'completed'
                        ? 'bg-green-50 border-green-300'
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">
                        {index + 1}. {orderStep.step.name}
                      </span>
                      <span className="text-sm">
                        {orderStep.status === 'completed' ? '✓ 完成' : 
                         index === currentStepIndex ? '▶ 执行中' : '待执行'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* 动作列表 */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-3">当前步骤动作</h3>
              <div className="space-y-2">
                {getCurrentStep()?.step?.actions?.map((action, index) => (
                  <div 
                    key={action.id}
                    className={`p-3 border rounded ${
                      index === currentActionIndex 
                        ? 'bg-yellow-50 border-yellow-500' 
                        : action.status === 'completed'
                        ? 'bg-green-50 border-green-300'
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span>
                        {index + 1}. {action.name}
                      </span>
                      <span className="text-sm">
                        {action.status === 'completed' ? '✓' : 
                         index === currentActionIndex ? '▶' : '○'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}