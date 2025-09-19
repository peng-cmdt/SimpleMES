"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface OrderStep {
  id: string;
  sequence: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  step: {
    id: string;
    stepCode: string;
    name: string;
    sequence: number;
    stepTemplate: {
      id: string;
      stepCode: string;
      name: string;
      description?: string;
      instructions?: string;
      image?: string;
      estimatedTime?: number;
    };
    actions: Action[];
  };
  workstation?: {
    id: string;
    workstationId: string;
    name: string;
    type: string;
  };
  startedAt?: string;
  completedAt?: string;
}

interface Action {
  id: string;
  sequence: number;
  name: string;
  type: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  parameters?: any;
  device?: {
    id: string;
    deviceId: string;
    name: string;
    type: string;
  };
}

interface Order {
  id: string;
  orderNumber: string;
  productionNumber: string;
  status: string;
  product: {
    name: string;
    productCode: string;
  };
  process: {
    name: string;
    processCode: string;
  };
  orderSteps: OrderStep[];
}

interface WorkstationSession {
  sessionId: string;
  workstation: {
    id: string;
    workstationId: string;
    name: string;
    type: 'VISUAL_CLIENT' | 'SERVICE_TYPE';
  };
  username: string;
  loginTime: string;
}

interface UserInfo {
  id: string;
  username: string;
  role: string;
}

export default function WorkstationExecutePage() {
  const [order, setOrder] = useState<Order | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [workstationSession, setWorkstationSession] = useState<WorkstationSession | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [assemblyLineTimer, setAssemblyLineTimer] = useState("00:00:09");

  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams?.get('orderId');

  // 验证会话
  useEffect(() => {
    validateSession();
  }, []);

  // 加载订单数据
  useEffect(() => {
    if (orderId && workstationSession) {
      loadOrderData(orderId);
    }
  }, [orderId, workstationSession]);

  // 更新时间
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
  };

  const loadOrderData = async (orderId: string) => {
    try {
      // 尝试从API加载订单数据
      const response = await fetch(`/api/orders/${orderId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setOrder(data.data);
          setIsLoading(false);
          return;
        }
      }
      
      // 如果API失败，使用模拟数据
      loadMockOrderData();
    } catch (error) {
      console.error('Failed to load order data:', error);
      loadMockOrderData();
    }
  };

  const loadMockOrderData = () => {
    const mockOrder: Order = {
      id: orderId || "1",
      orderNumber: "O1",
      productionNumber: "T001",
      status: "in_progress",
      product: {
        name: "V174",
        productCode: "V174"
      },
      process: {
        name: "主线生产工艺",
        processCode: "P1"
      },
      orderSteps: [
        {
          id: "step1",
          sequence: 1,
          status: "in_progress",
          step: {
            id: "step1",
            stepCode: "SCAN_SENSOR_1",
            name: "扫描左手边压力传感器",
            sequence: 1,
            stepTemplate: {
              id: "template1",
              stepCode: "SCAN_SENSOR_1",
              name: "扫描传感器步骤",
              description: "扫描左手边压力传感器",
              instructions: "请扫描左手边压力传感器\n\n操作步骤：\n1. 找到左侧压力传感器位置\n2. 使用扫描枪扫描传感器二维码\n3. 确认扫描结果",
              image: "/api/placeholder/600/400",
              estimatedTime: 30
            },
            actions: [
              {
                id: "action1",
                sequence: 1,
                name: "SCANNING SENSOR 1",
                type: "BARCODE_SCAN",
                description: "扫描传感器1",
                status: "in_progress",
                parameters: {
                  expectedPattern: "SENSOR_\\d+",
                  timeout: 30
                }
              },
              {
                id: "action2",
                sequence: 2,
                name: "SCREW_1",
                type: "MANUAL_CONFIRM",
                description: "拧螺丝1",
                status: "pending",
                parameters: {
                  confirmationMessage: "请确认螺丝1已正确拧紧"
                }
              }
            ]
          }
        },
        {
          id: "step2",
          sequence: 2,
          status: "pending",
          step: {
            id: "step2",
            stepCode: "SCAN_SENSOR_2",
            name: "SCANNING SENSOR 2",
            sequence: 2,
            stepTemplate: {
              id: "template2",
              stepCode: "SCAN_SENSOR_2",
              name: "扫描传感器2步骤",
              instructions: "扫描第二个传感器"
            },
            actions: [
              {
                id: "action3",
                sequence: 1,
                name: "SCREW_2",
                type: "MANUAL_CONFIRM",
                description: "拧螺丝2",
                status: "pending"
              }
            ]
          }
        }
      ]
    };
    
    setOrder(mockOrder);
    setIsLoading(false);
  };

  const getCurrentStep = () => {
    if (!order || !order.orderSteps || currentStepIndex >= order.orderSteps.length) {
      return null;
    }
    return order.orderSteps[currentStepIndex];
  };

  const getCurrentAction = () => {
    const currentStep = getCurrentStep();
    if (!currentStep || !currentStep.step.actions || currentActionIndex >= currentStep.step.actions.length) {
      return null;
    }
    return currentStep.step.actions[currentActionIndex];
  };

  const handleNextAction = () => {
    const currentStep = getCurrentStep();
    if (!currentStep) return;

    if (currentActionIndex < currentStep.step.actions.length - 1) {
      setCurrentActionIndex(currentActionIndex + 1);
    } else {
      // 当前步骤的所有动作完成，移到下一步
      handleNextStep();
    }
  };

  const handleNextStep = () => {
    if (!order) return;

    if (currentStepIndex < order.orderSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      setCurrentActionIndex(0);
    } else {
      // 所有步骤完成
      alert('所有工艺步骤已完成！');
      const workstationId = workstationSession?.workstation?.workstationId;
      if (workstationId) {
        router.push(`/client/workstation?workstationId=${workstationId}`);
      } else {
        router.push('/client/workstation');
      }
    }
  };

  const handleRepeatStep = () => {
    setCurrentActionIndex(0);
  };

  const handleSelectStep = () => {
    setShowMenu(!showMenu);
  };

  const handleRestart = () => {
    if (confirm('确定要重新开始吗？')) {
      setCurrentStepIndex(0);
      setCurrentActionIndex(0);
    }
  };

  const handleQualityIssue = () => {
    alert('质量问题报告功能 - 开发中');
  };

  const handleCancel = () => {
    if (confirm('确定要取消当前操作吗？')) {
      const workstationId = workstationSession?.workstation?.workstationId;
      if (workstationId) {
        router.push(`/client/workstation?workstationId=${workstationId}`);
      } else {
        router.push('/client/workstation');
      }
    }
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (isLoading || !order || !workstationSession || !userInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载工艺数据...</p>
        </div>
      </div>
    );
  }

  const currentStep = getCurrentStep();
  const currentAction = getCurrentAction();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* 顶部状态栏 */}
      <div className="bg-blue-500 text-white px-4 py-2 flex justify-between items-center text-sm">
        <div className="flex items-center space-x-6">
          <span className="font-bold">PAS</span>
          <span>CN# 3981972 | {'>'}MFA{'>'}2{'>'}</span>
          <span>SEQ# MF120250822T151</span>
        </div>
        <div className="flex items-center space-x-6">
          <div className="text-right">
            <div>1. station: WS-001</div>
            <div>2. name: {userInfo.username}</div>
            <div>3. login date: {new Date(workstationSession.loginTime).toLocaleDateString('zh-CN')} 00:00:32</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-mono">{formatDateTime(currentTime)}</div>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex flex-1">
        {/* 左侧主屏幕区域 */}
        <div className="flex-1 bg-black relative">
          {/* 图片显示区域 */}
          <div className="w-full h-full flex items-center justify-center">
            {currentStep?.step.stepTemplate.image ? (
              <img 
                src={currentStep.step.stepTemplate.image}
                alt={currentStep.step.name}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  // 如果图片加载失败，显示占位图
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDYwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI2MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yODcuNSAyMjVMMjczIDIzOS41TDI4NyAyNTRIMzEzTDMyNyAyMzkuNUwzMTIuNSAyMjVIMjg3LjVaIiBmaWxsPSIjOUI5QkFCIi8+CjxwYXRoIGQ9Ik0yNTggMTk2SDM0MlYyMjVIMjU4VjE5NloiIGZpbGw9IiM5QjlCQUIiLz4KPHRleHQgeD0iMzAwIiB5PSIxODAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzlCOUJBQiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+5ZKl6IOM5LiN5Yiw5Zu+54mHPC90ZXh0Pgo8L3N2Zz4K';
                }}
              />
            ) : (
              // 默认占位图
              <div className="w-96 h-64 bg-gray-300 flex items-center justify-center text-gray-600">
                <div className="text-center">
                  <div className="text-4xl mb-2">📷</div>
                  <div>工艺指导图片</div>
                </div>
              </div>
            )}
          </div>

          {/* 指导文字叠加 */}
          {currentStep && (
            <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-75 text-white p-4 rounded">
              <h3 className="text-xl font-bold mb-2">{currentStep.step.name}</h3>
              {currentStep.step.stepTemplate.instructions && (
                <p className="text-sm whitespace-pre-line">{currentStep.step.stepTemplate.instructions}</p>
              )}
            </div>
          )}
        </div>

        {/* 右侧区域 */}
        <div className="w-80 flex flex-col">
          {/* 菜单区域 */}
          <div className="flex-1 bg-gray-100 border-l border-gray-300">
            {/* 产品信息 */}
            <div className="p-4 border-b border-gray-300">
              <div className="text-sm space-y-1">
                <div className="font-bold text-blue-600">M1.01.EISENMANN-{'>'}ASC</div>
                <div className="text-green-600">M1.MFA2.ACC. SENSOR</div>
                <div>M1.MFA2.WATER PUMP 8</div>
                <div>M1.WATER PUMP TORQUE</div>
                <div>M1.MFA2.7741 HORN RH :</div>
                <div>M1.MFA2.7641 HORN LH :</div>
              </div>
            </div>

            {/* 当前动作列表 */}
            <div className="p-4">
              <div className="text-sm font-bold mb-3">Actions</div>
              <div className="space-y-2">
                {currentStep?.step.actions.map((action, index) => (
                  <div 
                    key={action.id}
                    className={`p-2 rounded text-xs ${
                      index === currentActionIndex 
                        ? 'bg-yellow-200 text-black font-bold' 
                        : action.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {action.name}
                  </div>
                ))}
              </div>
            </div>

            {/* 设备信息 */}
            <div className="p-4 border-t border-gray-300">
              <div className="text-sm space-y-1">
                <div className="font-bold">Devices</div>
                <div className="text-green-600">KEYENCE SR-2000_senso*</div>
              </div>
            </div>

            {/* Assembly line timer */}
            <div className="p-4 border-t border-gray-300">
              <div className="text-sm text-gray-600 mb-1">Assembly line</div>
              <div className="text-4xl font-mono font-bold text-center">
                {assemblyLineTimer}
              </div>
            </div>
          </div>

          {/* 右侧菜单按钮 */}
          <div className="w-20 bg-gray-600 flex flex-col justify-end pb-8">
            <div className="px-2 py-1 text-center">
              <div className="text-white text-xs mb-2 writing-mode-vertical">MENU</div>
              <div className="text-white text-xs mb-4 writing-mode-vertical">LANGUAGE</div>
            </div>
          </div>

          {/* 操作按钮区域 */}
          <div className="w-full bg-gray-700 p-4">
            <div className="text-white text-xs mb-2 writing-mode-vertical text-center">PROCESS</div>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={handleNextAction}
                className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors"
                disabled={!currentAction}
              >
                NEXT ACTION
              </button>
              
              <button
                onClick={handleNextStep}
                className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors"
              >
                NEXT STEP
              </button>
              
              <button
                onClick={handleRepeatStep}
                className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors"
              >
                REPEAT STEP
              </button>
              
              <button
                onClick={handleSelectStep}
                className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors"
              >
                SELECT STEP
              </button>
              
              <button
                onClick={handleRestart}
                className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors"
              >
                RESTART
              </button>
              
              <button
                onClick={handleQualityIssue}
                className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded transition-colors"
              >
                QUALITY ISSUE
              </button>
              
              <button
                onClick={handleCancel}
                className="w-full py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded transition-colors"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 步骤选择菜单 (可选显示) */}
      {showMenu && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">选择步骤</h3>
            <div className="space-y-2">
              {order.orderSteps.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => {
                    setCurrentStepIndex(index);
                    setCurrentActionIndex(0);
                    setShowMenu(false);
                  }}
                  className={`w-full text-left p-3 rounded border transition-colors ${
                    index === currentStepIndex
                      ? 'bg-blue-100 border-blue-500'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="font-medium">{step.sequence}. {step.step.name}</div>
                  <div className="text-sm text-gray-600">
                    状态: {step.status === 'pending' ? '待开始' : 
                           step.status === 'in_progress' ? '进行中' : 
                           step.status === 'completed' ? '已完成' : '失败'}
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowMenu(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}