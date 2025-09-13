"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";

interface Order {
  id: string;
  orderNumber: string; // Customer seq #
  productionNumber: string; // Car number  
  productFamily: string; // Product family
  carrierId: string; // carrier_id
  status: string;
  priority: number;
  product?: {
    name: string;
    productCode: string;
  };
  process?: {
    name: string;
    processCode: string;
  };
  orderSteps?: OrderStep[];
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

interface UserInfo {
  id: string;
  username: string;
  email: string;
  role: string;
}

interface Device {
  id: string;
  deviceId: string;
  name: string;
  type: string;
  brand?: string;
  model?: string;
  description?: string;
  ipAddress?: string;
  port?: number;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR' | 'MAINTENANCE';
  isOnline: boolean;
  lastConnected?: string;
}

interface PLCTestParams {
  type: string;
  dbNumber: number;
  byte: number;
  bit: number;
  writeValue: boolean;
}

interface PLCTestResult {
  success: boolean;
  value?: any;
  message?: string;
  operation?: 'read' | 'write';
  rawData?: string;
}

export default function WorkstationPage() {
  const [workstationSession, setWorkstationSession] = useState<WorkstationSession | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMenuExpanded, setIsMenuExpanded] = useState(false);
  const [isServiceMode, setIsServiceMode] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [testingDevices, setTestingDevices] = useState<Set<string>>(new Set());
  const [showPLCTestModal, setShowPLCTestModal] = useState(false);
  const [currentPLCDevice, setCurrentPLCDevice] = useState<Device | null>(null);
  const [plcTestParams, setPlcTestParams] = useState<PLCTestParams>({
    type: 'DB',
    dbNumber: 0,
    byte: 0,
    bit: 0,
    writeValue: false
  });
  const [plcTestResult, setPlcTestResult] = useState<PLCTestResult | null>(null);
  const [plcTestLoading, setPlcTestLoading] = useState(false);
  
  // 系统设置相关状态
  const [orderDisplayLimit, setOrderDisplayLimit] = useState<number>(20); // 默认20条
  
  // 工艺执行相关状态
  const [isExecutionMode, setIsExecutionMode] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [showStepSelectMenu, setShowStepSelectMenu] = useState(false);
  const [assemblyLineTimer, setAssemblyLineTimer] = useState("00:00:00");
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [stepExecutionResults, setStepExecutionResults] = useState<any[]>([]);
  const [currentStepResult, setCurrentStepResult] = useState<any>(null);
  
  // 设备连接状态监控
  const [deviceConnectionStatus, setDeviceConnectionStatus] = useState<{[deviceId: string]: boolean}>({});
  const [lastDeviceCheck, setLastDeviceCheck] = useState<Date>(new Date());
  
  // 设备连接错误弹框状态
  const [showDeviceErrorModal, setShowDeviceErrorModal] = useState(false);
  const [deviceErrorInfo, setDeviceErrorInfo] = useState<{
    deviceName: string;
    deviceIP: string;
    errorMessage: string;
    actionName: string;
  } | null>(null);
  
  // 服务模式设备测试错误弹框状态
  const [showDeviceTestErrorModal, setShowDeviceTestErrorModal] = useState(false);
  const [deviceTestErrorInfo, setDeviceTestErrorInfo] = useState<{
    deviceName: string;
    address: string;
    errorMessage: string;
  } | null>(null);
  
  // 通用设备测试对话框状态
  const [showGenericTestModal, setShowGenericTestModal] = useState(false);
  const [currentGenericDevice, setCurrentGenericDevice] = useState<Device | null>(null);
  const [genericTestLoading, setGenericTestLoading] = useState(false);
  const [genericTestResult, setGenericTestResult] = useState<{
    success: boolean;
    message: string;
    data?: any;
  } | null>(null);
  
  // 手动插入订单对话框状态
  const [showManualInsertModal, setShowManualInsertModal] = useState(false);
  const [manualProductionNumber, setManualProductionNumber] = useState('');
  const [manualInsertLoading, setManualInsertLoading] = useState(false);
  
  // 扫描工单界面状态
  const [showScanWorkorderScreen, setShowScanWorkorderScreen] = useState(false);
  const [scanProductionNumber, setScanProductionNumber] = useState('');
  const [scanError, setScanError] = useState('');
  const [showScanRightPanel, setShowScanRightPanel] = useState(false); // 扫描界面右侧菜单状态
  
  // 屏幕状态
  const [screenError, setScreenError] = useState(false);
  const [isMonitoringPLC, setIsMonitoringPLC] = useState(false);
  
  // 使用ref来跟踪监控状态，避免在异步循环中读取过期的状态值
  const monitoringControlRef = useRef<{
    isActive: boolean;
    shouldStop: boolean;
  }>({
    isActive: false,
    shouldStop: false
  });
  
  // 6区域设计状态
  const [showMenuArea, setShowMenuArea] = useState(false);
  const [showProcessMenu, setShowProcessMenu] = useState(false);
  
  // 左右面板显示状态
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  
  // 滚动引用
  const activeStepRef = useRef<HTMLDivElement>(null);
  const activeActionRef = useRef<HTMLDivElement>(null);
  
  const router = useRouter();
  const { t } = useLanguage();

  // 加载系统设置
  useEffect(() => {
    const loadSystemSettings = async () => {
      try {
        const response = await fetch('/api/system/settings');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.settings) {
            setOrderDisplayLimit(data.settings.clientOrderDisplayCount || 20);
          }
        }
      } catch (error) {
        console.error('Failed to load system settings:', error);
        // 使用默认值20
      }
    };

    loadSystemSettings();
  }, []);

  // 检查值是否匹配期望值的函数
  const checkValueMatch = (actualValue: any, expectedValue: string): boolean => {
    // 将期望值转换为适当的类型进行比较
    const expected = expectedValue.toLowerCase();
    
    // 布尔值比较
    if (expected === 'true' || expected === '1') {
      return actualValue === true || actualValue === 1 || actualValue === '1' || actualValue === 'true';
    }
    if (expected === 'false' || expected === '0') {
      return actualValue === false || actualValue === 0 || actualValue === '0' || actualValue === 'false';
    }
    
    // 数值比较
    if (!isNaN(Number(expected))) {
      const expectedNum = Number(expected);
      const actualNum = Number(actualValue);
      return !isNaN(actualNum) && actualNum === expectedNum;
    }
    
    // 字符串比较
    return actualValue?.toString() === expectedValue;
  };

  // 定期检测工位所有设备的连接状态
  useEffect(() => {
    if (!workstationSession || !isExecutionMode) return;
    
    const checkAllDevicesStatus = async () => {
      try {
        // 获取工位设备列表
        const response = await fetch(`/api/workstation/${workstationSession.workstation.workstationId}/devices`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.devices) {
            // 检测每个设备的连接状态
            for (const device of data.devices) {
              await checkDeviceConnectionStatus(device.deviceId, device.id);
            }
          }
        }
      } catch (error) {
        console.error('批量检测设备状态失败:', error);
      }
    };

    // 立即检测一次
    checkAllDevicesStatus();
    
    // 每30秒检测一次设备状态
    const interval = setInterval(checkAllDevicesStatus, 30000);
    
    return () => clearInterval(interval);
  }, [workstationSession, isExecutionMode]);

  // 会话心跳维持 - 每60秒发送一次心跳，检测会话状态
  useEffect(() => {
    if (!workstationSession) return;

    const sendHeartbeat = async () => {
      try {
        const response = await fetch('/api/workstation/session/heartbeat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: workstationSession.sessionId
          })
        });

        const result = await response.json();
        
        if (!result.success) {
          console.error('心跳检测失败:', result.error, result.message);
          
          // 检查是否被接管
          if (result.error === 'SESSION_TAKEN_OVER') {
            // 显示被接管通知并自动退出
            alert(`您的会话已被 ${result.takenOverBy} 接管，系统将自动退出到登录界面。`);
          } else if (result.error === 'SESSION_TERMINATED') {
            // 会话被终止
            alert('您的会话已过期或被终止，系统将自动退出到登录界面。');
          }
          
          if (result.shouldLogout) {
            // 清理本地存储并退出到登录界面
            localStorage.removeItem("clientAuth");
            localStorage.removeItem("clientUserInfo"); 
            localStorage.removeItem("clientInfo");
            localStorage.removeItem("workstationSession");
            router.push("/client/login");
            return;
          }
        } else {
          console.log('会话心跳发送成功');
        }
      } catch (error) {
        console.error('会话心跳发送失败:', error);
      }
    };

    // 立即发送一次心跳
    sendHeartbeat();
    
    // 每60秒发送一次心跳
    const heartbeatInterval = setInterval(sendHeartbeat, 60000);
    
    return () => clearInterval(heartbeatInterval);
  }, [workstationSession, router]);

  // 验证会话和加载数据
  useEffect(() => {
    const validateSession = () => {
      const userInfoStr = localStorage.getItem("clientUserInfo");
      const workstationSessionStr = localStorage.getItem("workstationSession");
      
      if (!userInfoStr || !workstationSessionStr) {
        router.push("/client/login");
        return;
      }

      try {
        const user = JSON.parse(userInfoStr);
        const session = JSON.parse(workstationSessionStr);
        
        setUserInfo(user);
        setWorkstationSession(session);
        // 直接使用session对象来加载订单，而不是依赖状态
        loadOrdersWithSession(session);
        // 尝试恢复工作状态
        restoreWorkState(session.workstation.workstationId);
      } catch (error) {
        console.error('Session validation failed:', error);
        router.push("/client/login");
      }
    };

    validateSession();
  }, [router]);

  // 添加一个独立的useEffect来监听workstationSession变化
  useEffect(() => {
    if (workstationSession) {
      loadOrders();
    }
  }, [workstationSession, orderDisplayLimit]);

  // 实时刷新订单列表 - 每3秒刷新一次（仅在非执行模式下）
  useEffect(() => {
    if (!workstationSession || isExecutionMode) return;
    
    const orderRefreshInterval = setInterval(() => {
      console.log('Auto-refreshing order list...');
      loadOrdersWithSession(workstationSession);
    }, 3000); // 更改为每3秒刷新一次
    
    return () => clearInterval(orderRefreshInterval);
  }, [workstationSession, isExecutionMode, orderDisplayLimit]);

  // 更新时间显示和计时器
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      
      // 更新组装计时器
      if (startTime && isExecutionMode) {
        const now = new Date();
        const diffMs = now.getTime() - startTime.getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
        
        const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        setAssemblyLineTimer(timeStr);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime, isExecutionMode]);

  // 自动滚动到当前步骤
  useEffect(() => {
    if (activeStepRef.current) {
      activeStepRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStepIndex]);

  // 自动滚动到当前动作，并开始PLC监控
  useEffect(() => {
    if (activeActionRef.current) {
      activeActionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // 当切换到新动作时，检测设备状态并开始监控
    const currentAction = getCurrentAction();
    if (currentAction && currentAction.device && isExecutionMode) {
      console.log('切换到新动作，开始设备状态检测:', currentAction.name);
      
      // 首先检测设备连接状态
      checkCurrentActionDeviceStatus(currentAction).then((isConnected) => {
        if (isConnected) {
          // 设备连接正常，开始PLC监控
          console.log('设备连接正常，开始PLC监控:', currentAction.name);
          startPLCMonitoring(currentAction);
        } else {
          console.log('设备连接失败，停止执行:', currentAction.name);
        }
      });
    }
  }, [currentActionIndex, isExecutionMode]);

  // 使用传入的session对象加载订单，避免状态异步更新问题
  const loadOrdersWithSession = async (session: WorkstationSession) => {
    if (!session) return;
    
    try {
      // 从API加载真实数据 - 使用工位的workstationId字段而不是UUID id
      // 查询非已完成状态的订单，包括 pending 和 in_progress
      const workstationId = session.workstation.workstationId;
      const response = await fetch(`/api/orders?status=pending,in_progress&workstationId=${workstationId}&limit=${orderDisplayLimit}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.orders) {
          // 映射API数据到界面格式，并按订单号排序
          const mappedOrders = data.data.orders
            .map((order: any) => ({
              id: order.id,
              orderNumber: order.orderNumber,
              productionNumber: order.productionNumber,
              productFamily: order.product?.name || order.product?.productCode || 'N/A',
              carrierId: order.notes || `CARR-${order.id.slice(-6)}`, // 使用备注或生成载具ID
              status: order.status.toLowerCase(),
              priority: order.priority,
              product: order.product
            }))
            // 按订单号从小到大排序（T001, T002, T003...）
            .sort((a: any, b: any) => {
              // 提取数字部分进行比较
              const getOrderNumber = (orderNumber: string) => {
                const match = orderNumber.match(/T(\d+)/);
                return match ? parseInt(match[1]) : 0;
              };
              return getOrderNumber(a.orderNumber) - getOrderNumber(b.orderNumber);
            });
          
          setOrders(mappedOrders);
          console.log('已加载订单列表 (按订单号排序):', mappedOrders);
          return;
        }
      }
      
      // API失败时不加载任何数据  
      setOrders([]);
    } catch (error) {
      console.error('Failed to load orders:', error);
      setOrders([]);
    }
  };

  // 简单的loadOrders函数，使用当前workstationSession
  const loadOrders = () => {
    if (workstationSession) {
      loadOrdersWithSession(workstationSession);
    }
  };

  const handleStart = async () => {
    // 非插单模式：严格按序执行订单
    const sortedOrders = [...orders].sort((a, b) => {
      // 按订单号从小到大排序（T001, T002, T003...）
      const getOrderNumber = (orderNumber: string) => {
        const match = orderNumber.match(/T(\d+)/);
        return match ? parseInt(match[1]) : 0;
      };
      return getOrderNumber(a.orderNumber) - getOrderNumber(b.orderNumber);
    });

    // 首先检查是否有正在进行中的订单
    const inProgressOrder = sortedOrders.find(order => order.status?.toLowerCase() === 'in_progress');
    
    if (inProgressOrder) {
      // 如果有正在进行中的订单，继续执行该订单（无论是哪个订单）
      console.log('发现进行中的订单，继续执行:', inProgressOrder.orderNumber);
      await handleContinueOrder(inProgressOrder);
      return;
    }
    
    // 没有进行中的订单，按顺序查找第一个待开始的订单
    const firstPendingOrder = sortedOrders.find(order => order.status?.toLowerCase() === 'pending');
    
    if (!firstPendingOrder) {
      alert('暂无待开始的订单');
      return;
    }
    
    console.log('按顺序开始执行订单:', firstPendingOrder.orderNumber);
    await handleStartOrder(firstPendingOrder);
  };

  const handleStartOrder = async (order: Order) => {
    setIsProcessing(true);
    try {
      // First get a valid workstation ID to avoid foreign key constraint errors
      let validWorkstationId: string | undefined = undefined;
      if (workstationSession?.workstation.id) {
        try {
          // Verify the workstation exists in the database
          const wsResponse = await fetch(`/api/workstations/${workstationSession.workstation.id}`);
          if (wsResponse.ok) {
            validWorkstationId = workstationSession.workstation.id;
          } else {
            console.warn('Workstation ID not found in database:', workstationSession.workstation.id);
          }
        } catch (error) {
          console.warn('Error validating workstation ID:', error);
        }
      }
      
      // First update order status to IN_PROGRESS
      console.log('Updating order status to IN_PROGRESS:', order.id);
      const statusUpdateResponse = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'changeStatus',
          status: 'IN_PROGRESS',
          updatedBy: userInfo?.username || 'client',
          reason: '开始工艺执行',
          currentStationId: validWorkstationId
        })
      });
      
      if (statusUpdateResponse.ok) {
        const statusResult = await statusUpdateResponse.json();
        console.log('订单状态更新成功:', statusResult);
      } else {
        console.error('订单状态更新失败，停止执行');
        const errorData = await statusUpdateResponse.json();
        console.error('错误详情:', errorData);
        console.error('Request payload:', {
          action: 'changeStatus',
          status: 'IN_PROGRESS',
          updatedBy: userInfo?.username || 'client',
          reason: '开始工艺执行',
          currentStationId: validWorkstationId
        });
        console.error('Workstation session:', workstationSession);
        alert('无法启动订单执行 - 状态更新失败: ' + (errorData.error || '未知错误'));
        return; // 停止执行
      }
      
      // 加载订单详细信息包括工艺步骤
      const response = await fetch(`/api/orders/${order.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          console.log('API返回的订单数据:', data.data);
          console.log('Process steps数据:', data.data.process?.steps);
          console.log('OrderSteps数据:', data.data.orderSteps);
          
          // 检查每个步骤的actions
          if (data.data.process?.steps) {
            data.data.process.steps.forEach((step: any, index: number) => {
              console.log(`Step ${index + 1} (${step.name}) actions:`, step.actions);
            });
          }
          
          // 检查是否有orderSteps数据
          if (data.data.orderSteps && data.data.orderSteps.length > 0) {
            // 使用orderSteps数据，但确保actions有status字段
            console.log('使用真实的OrderSteps数据');
            const processedOrderSteps = data.data.orderSteps.map((orderStep: any) => ({
              ...orderStep,
              step: {
                ...orderStep.step,
                actions: orderStep.step.actions?.map((action: any) => ({
                  ...action,
                  status: action.status || 'pending' // 确保有status字段
                })) || []
              }
            }));
            
            const processedOrder = {
              ...data.data,
              orderSteps: processedOrderSteps
            };
            
            setCurrentOrder(processedOrder);
            const firstActionStepIndex = findFirstStepWithActions(processedOrderSteps);
            setCurrentStepIndex(firstActionStepIndex);
            setCurrentActionIndex(0);
            setIsExecutionMode(true);
            setStartTime(new Date()); // 启动计时器
            console.log('Started order execution with OrderSteps data:', processedOrder);
            
            // 强制触发重新渲染以确保设备信息正确显示
            setTimeout(() => {
              setCurrentActionIndex(0); // 触发重新渲染
            }, 50);
            
            // 刷新订单列表以反映状态变化
            if (workstationSession) {
              loadOrdersWithSession(workstationSession);
              // 保存工作状态
              saveWorkState(workstationSession.workstation.workstationId);
            }
          } else if (data.data.process?.steps && data.data.process.steps.length > 0) {
            // 如果没有orderSteps但有process.steps，创建orderSteps
            console.log('没有OrderSteps，使用Process Steps创建OrderSteps');
            const orderStepsFromProcess = data.data.process.steps.map((step: any) => ({
              id: `temp-${step.id}`,
              sequence: step.sequence,
              status: 'pending',
              step: {
                ...step,
                actions: step.actions?.map((action: any) => ({
                  ...action,
                  status: 'pending' // 为每个action添加status字段
                })) || []
              },
              workstation: step.workstation,
              startedAt: null,
              completedAt: null
            }));
            
            const orderWithSteps = {
              ...data.data,
              orderSteps: orderStepsFromProcess
            };
            
            console.log('创建的OrderSteps:', orderStepsFromProcess);
            setCurrentOrder(orderWithSteps);
            const firstActionStepIndex = findFirstStepWithActions(orderStepsFromProcess);
            setCurrentStepIndex(firstActionStepIndex);
            setCurrentActionIndex(0);
            setIsExecutionMode(true);
            setStartTime(new Date()); // 启动计时器
            console.log('Started order execution with generated OrderSteps:', orderWithSteps);
            
            // 强制触发重新渲染以确保设备信息正确显示
            setTimeout(() => {
              setCurrentActionIndex(0); // 触发重新渲染
            }, 50);
            
            // 刷新订单列表以反映状态变化
            if (workstationSession) {
              loadOrdersWithSession(workstationSession);
              // 保存工作状态
              saveWorkState(workstationSession.workstation.workstationId);
            }
          } else {
            console.log('API返回成功但无有效步骤数据');
            alert('订单没有配置工艺步骤 - 请在管理系统中为订单配置工艺流程');
            return;
          }
        } else {
          console.log('API返回失败，无有效数据');
          alert('无法加载订单详情 - 请检查订单配置');
          return;
        }
      } else {
        console.log('API调用失败');
        alert('无法连接到服务器 - 请检查网络连接');
        return;
      }
    } catch (error) {
      console.error('Failed to load order details:', error);
      alert('加载订单详情时发生错误: ' + (error instanceof Error ? error.message : '未知错误'));
      return;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleContinueOrder = async (order: Order) => {
    // 对于进行中的订单，直接加载并继续执行
    setIsProcessing(true);
    try {
      // 加载订单详细信息包括工艺步骤
      const response = await fetch(`/api/orders/${order.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          console.log('继续执行订单:', data.data);
          
          if (data.data.orderSteps && data.data.orderSteps.length > 0) {
            const processedOrderSteps = data.data.orderSteps.map((orderStep: any) => ({
              ...orderStep,
              step: {
                ...orderStep.step,
                actions: orderStep.step.actions?.map((action: any) => ({
                  ...action,
                  status: action.status || 'pending'
                })) || []
              }
            }));
            
            const processedOrder = {
              ...data.data,
              orderSteps: processedOrderSteps
            };
            
            // 找到当前应该执行的步骤和动作
            let currentStepIdx = 0;
            let currentActionIdx = 0;
            
            // 查找第一个未完成的步骤
            for (let i = 0; i < processedOrderSteps.length; i++) {
              if (processedOrderSteps[i].status !== 'completed') {
                currentStepIdx = i;
                // 在该步骤中找到第一个未完成的动作
                const actions = processedOrderSteps[i].step.actions || [];
                for (let j = 0; j < actions.length; j++) {
                  if (actions[j].status !== 'completed') {
                    currentActionIdx = j;
                    break;
                  }
                }
                break;
              }
            }
            
            setCurrentOrder(processedOrder);
            setCurrentStepIndex(currentStepIdx);
            setCurrentActionIndex(currentActionIdx);
            setIsExecutionMode(true);
            setStartTime(new Date()); // 启动计时器
            console.log('Continued order execution:', processedOrder);
            
            setTimeout(() => {
              setCurrentActionIndex(currentActionIdx);
            }, 50);
          } else {
            alert('订单没有配置工艺步骤');
            return;
          }
        } else {
          alert('无法加载订单详情');
          return;
        }
      } else {
        alert('无法连接到服务器');
        return;
      }
    } catch (error) {
      console.error('Failed to continue order:', error);
      alert('继续执行订单时发生错误: ' + (error instanceof Error ? error.message : '未知错误'));
      return;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAdjustSequence = () => {
    alert(t('workstation.adjustSequenceFunction'));
  };

  const handleManualInsert = () => {
    setShowScanWorkorderScreen(true);
    setScanProductionNumber('');
    setScanError(''); // 清除错误信息
    setShowScanRightPanel(false); // 默认折叠状态
  };

  const handleManualInsertSubmit = async () => {
    if (!manualProductionNumber.trim()) {
      alert(t('manualInsert.pleaseEnter'));
      return;
    }

    setManualInsertLoading(true);
    try {
      // 根据生产号查找订单
      const response = await fetch(`/api/orders?productionNumber=${manualProductionNumber.trim()}&limit=1`);
      if (!response.ok) {
        throw new Error(t('manualInsert.searchFailed'));
      }

      const data = await response.json();
      if (!data.success || !data.data.orders || data.data.orders.length === 0) {
        alert(t('manualInsert.orderNotFound'));
        return;
      }

      const order = data.data.orders[0];
      
      // 映射订单数据格式
      const mappedOrder = {
        id: order.id,
        orderNumber: order.orderNumber,
        productionNumber: order.productionNumber,
        productFamily: order.product?.name || order.product?.productCode || 'N/A',
        carrierId: order.notes || `CARR-${order.id.slice(-6)}`,
        status: order.status.toLowerCase(),
        priority: order.priority,
        product: order.product,
        process: order.process
      };

      // 关闭弹框
      setShowManualInsertModal(false);
      setManualProductionNumber('');
      
      // 根据订单状态执行不同操作
      if (mappedOrder.status === 'pending') {
        // 待开始的订单，直接开始执行
        await handleStartOrder(mappedOrder);
      } else if (mappedOrder.status === 'in_progress') {
        // 进行中的订单，继续执行
        await handleContinueOrder(mappedOrder);
      } else {
        alert(t('manualInsert.invalidStatus').replace('{status}', mappedOrder.status));
      }
    } catch (error) {
      console.error('手动插入订单失败:', error);
      alert(t('manualInsert.searchFailed') + ': ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setManualInsertLoading(false);
    }
  };

  const handleScanWorkorderSubmit = async () => {
    if (!scanProductionNumber.trim()) {
      setScanError('Please enter workorder number');
      return;
    }

    setManualInsertLoading(true);
    setScanError(''); // 清除之前的错误信息
    
    try {
      // 根据生产号查找订单
      const response = await fetch(`/api/orders?productionNumber=${scanProductionNumber.trim()}&limit=1`);
      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      if (!data.success || !data.data.orders || data.data.orders.length === 0) {
        setScanError('No step found for the record!');
        return;
      }

      const order = data.data.orders[0];
      
      // 映射订单数据格式
      const mappedOrder = {
        id: order.id,
        orderNumber: order.orderNumber,
        productionNumber: order.productionNumber,
        productFamily: order.product?.name || order.product?.productCode || 'N/A',
        carrierId: order.notes || `CARR-${order.id.slice(-6)}`,
        status: order.status.toLowerCase(),
        priority: order.priority,
        product: order.product,
        process: order.process
      };

      // 关闭扫描界面
      setShowScanWorkorderScreen(false);
      setScanProductionNumber('');
      setScanError('');
      setShowScanRightPanel(false);
      
      // 根据订单状态执行不同操作
      if (mappedOrder.status === 'pending') {
        // 待开始的订单，直接开始执行
        await handleStartOrder(mappedOrder);
      } else if (mappedOrder.status === 'in_progress') {
        // 进行中的订单，继续执行
        await handleContinueOrder(mappedOrder);
      } else {
        setScanError(`Invalid order status: ${mappedOrder.status}`);
      }
    } catch (error) {
      console.error('扫描工单失败:', error);
      setScanError('No step found for the record!');
    } finally {
      setManualInsertLoading(false);
    }
  };

  // 保存当前工作状态
  const saveWorkState = async (workstationId: string) => {
    if (!currentOrder) return; // 没有当前订单时不保存状态

    try {
      const workState = {
        currentOrder: currentOrder,
        isExecutionMode: isExecutionMode,
        currentStepIndex: currentStepIndex,
        stepExecutionResults: stepExecutionResults,
        currentStepResult: currentStepResult,
        savedAt: new Date().toISOString(),
        orderProgress: {
          orderId: currentOrder.id,
          status: currentOrder.status,
          currentStep: currentStepIndex,
          totalSteps: currentOrder.steps?.length || 0
        }
      };

      const response = await fetch('/api/workstation/work-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workstationId: workstationId,
          workState: workState
        })
      });

      const result = await response.json();
      if (result.success) {
        console.log('工作状态保存成功:', result);
      } else {
        console.error('工作状态保存失败:', result.error);
      }
    } catch (error) {
      console.error('保存工作状态时出错:', error);
    }
  };

  // 恢复工作状态
  const restoreWorkState = async (workstationId: string) => {
    try {
      const response = await fetch(`/api/workstation/work-state?workstationId=${workstationId}`);
      const result = await response.json();

      if (result.success && result.hasWorkState) {
        const workState = result.workState;
        console.log('发现保存的工作状态:', workState);

        // 恢复订单状态
        if (workState.currentOrder) {
          setCurrentOrder(workState.currentOrder);
          setIsExecutionMode(workState.isExecutionMode || false);
          setCurrentStepIndex(workState.currentStepIndex || 0);
          setStepExecutionResults(workState.stepExecutionResults || []);
          setCurrentStepResult(workState.currentStepResult || null);

          // 显示恢复通知
          alert(`检测到之前的工作进度，已自动恢复订单 "${workState.currentOrder.productionNumber}" 的执行状态。`);
        }
      } else {
        console.log('没有发现保存的工作状态');
      }
    } catch (error) {
      console.error('恢复工作状态时出错:', error);
    }
  };

  // 清除工作状态
  const clearWorkState = async (workstationId: string) => {
    try {
      const response = await fetch(`/api/workstation/work-state?workstationId=${workstationId}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      if (result.success) {
        console.log('工作状态清除成功');
      }
    } catch (error) {
      console.error('清除工作状态时出错:', error);
    }
  };

  const handleLogout = async () => {
    try {
      // 调用登出API清理服务端会话
      if (workstationSession) {
        await fetch('/api/workstation/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: workstationSession.sessionId,
            workstationId: workstationSession.workstation.workstationId,
            username: userInfo?.username
          })
        });
      }
    } catch (error) {
      console.error('登出API调用失败:', error);
      // 即使API调用失败，也继续清理本地存储
    }

    // 清理本地存储
    localStorage.removeItem("clientAuth");
    localStorage.removeItem("clientUserInfo");
    localStorage.removeItem("clientInfo");
    localStorage.removeItem("workstationSession");
    router.push("/");
  };

  const handleServiceMode = () => {
    setIsServiceMode(true);
    setIsMenuExpanded(false);
    loadWorkstationDevices();
  };

  const loadWorkstationDevices = async () => {
    if (!workstationSession) return;
    
    setIsLoadingDevices(true);
    try {
      // 使用工位ID从真实API获取设备列表
      const response = await fetch(`/api/workstation/${workstationSession.workstation.workstationId}/devices`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.devices) {
          setDevices(data.devices);
          console.log(`Loaded ${data.devices.length} devices for workstation ${workstationSession.workstation.workstationId}`);
        } else {
          console.warn('No devices found for this workstation');
          setDevices([]);
        }
      } else {
        console.error('Failed to fetch devices, status:', response.status);
        const errorData = await response.json();
        console.error('Error details:', errorData);
        setDevices([]);
      }
    } catch (error) {
      console.error('Failed to load devices:', error);
      setDevices([]);
    } finally {
      setIsLoadingDevices(false);
    }
  };


  const testDeviceConnection = async (device: Device) => {
    setTestingDevices(prev => new Set([...prev, device.id]));
    
    try {
      console.log(`Testing device: ${device.name} (${device.deviceId})`);
      
      // 首先检查设备是否已经连接
      console.log(`Checking connection status for device: ${device.name}`);
      const statusResponse = await fetch(`/api/device-communication/devices/${device.deviceId}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const statusResult = await statusResponse.json();
      const isAlreadyConnected = statusResponse.ok && statusResult.success && statusResult.isConnected;
      
      if (isAlreadyConnected) {
        // 设备已连接，直接显示测试界面
        console.log(`Device ${device.name} is already connected, showing test interface`);
        
        // 更新设备状态为在线
        setDevices(prev => prev.map(d => 
          d.id === device.id 
            ? { ...d, status: 'ONLINE' as const, isOnline: true }
            : d
        ));
        
        // 显示测试界面（PLC显示专用界面，其他设备显示通用界面）
        if (device.type === 'PLC_CONTROLLER' || device.type.toLowerCase().includes('plc')) {
          setCurrentPLCDevice(device);
          setShowPLCTestModal(true);
        } else {
          setCurrentGenericDevice(device);
          setShowGenericTestModal(true);
        }
        
        return;
      }
      
      // 设备未连接，尝试建立连接
      console.log(`Device ${device.name} not connected, attempting to connect...`);
      const connectResponse = await fetch(`/api/device-communication/devices/${device.deviceId}/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const connectResult = await connectResponse.json();
      
      if (connectResponse.ok && connectResult.success) {
        // 连接成功
        console.log(`Device connected successfully: ${device.name}`);
        
        // 更新设备状态为在线
        setDevices(prev => prev.map(d => 
          d.id === device.id 
            ? { ...d, status: 'ONLINE' as const, isOnline: true }
            : d
        ));

        // 显示测试界面
        if (device.type === 'PLC_CONTROLLER' || device.type.toLowerCase().includes('plc')) {
          setCurrentPLCDevice(device);
          setShowPLCTestModal(true);
        } else {
          setCurrentGenericDevice(device);
          setShowGenericTestModal(true);
        }
      } else {
        // 连接失败
        const errorMsg = connectResult.message || connectResult.error || 'Connection failed';
        console.error(`Device connection failed: ${device.name} - ${errorMsg}`);
        
        // 更新设备状态为错误
        setDevices(prev => prev.map(d => 
          d.id === device.id 
            ? { ...d, status: 'ERROR' as const, isOnline: false }
            : d
        ));
        
        // 显示简单的设备测试错误弹框
        setDeviceTestErrorInfo({
          deviceName: device.name,
          address: `${device.ipAddress || 'Unknown IP'}:${device.port || 'Unknown Port'}`,
          errorMessage: `The device (${device.name}) is unreachable!`
        });
        setShowDeviceTestErrorModal(true);
      }
    } catch (error) {
      console.error('Device test error:', error);
      
      // 更新设备状态为错误
      setDevices(prev => prev.map(d => 
        d.id === device.id 
          ? { ...d, status: 'ERROR' as const, isOnline: false }
          : d
      ));
      
      // 显示简单的设备测试错误弹框
      setDeviceTestErrorInfo({
        deviceName: device.name,
        address: `${device.ipAddress || 'Unknown IP'}:${device.port || 'Unknown Port'}`,
        errorMessage: `The device (${device.name}) is unreachable!`
      });
      setShowDeviceTestErrorModal(true);
    } finally {
      setTestingDevices(prev => {
        const newSet = new Set(prev);
        newSet.delete(device.id);
        return newSet;
      });
    }
  };

  const exitServiceMode = () => {
    setIsServiceMode(false);
    setDevices([]);
  };

  // 检测设备连接状态
  const checkDeviceConnectionStatus = async (deviceDatabaseId: string, deviceInstanceId?: string) => {
    try {
      // 优先使用instanceId进行通讯
      const deviceIdForApi = deviceInstanceId || deviceDatabaseId;
      const response = await fetch(`/api/device-communication/devices/${deviceIdForApi}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      const isConnected = response.ok && result.success && result.isConnected;
      
      // 使用数据库ID作为状态key，便于前端查找
      const stateKey = deviceDatabaseId;
      
      setDeviceConnectionStatus(prev => ({
        ...prev,
        [stateKey]: isConnected
      }));
      
      return isConnected;
    } catch (error) {
      console.error('设备状态检测失败:', error);
      const stateKey = deviceDatabaseId;
      setDeviceConnectionStatus(prev => ({
        ...prev,
        [stateKey]: false
      }));
      return false;
    }
  };
  
  // 检测当前动作设备连接状态并显示警告
  const checkCurrentActionDeviceStatus = async (action: Action) => {
    if (!action.device) return true;
    
    // action.device.id 是数据库ID， action.device.deviceId 是instanceId
    const isConnected = await checkDeviceConnectionStatus(action.device.id, action.device.deviceId);
    
    if (!isConnected) {
      // 设备未连接，触发报警
      let deviceIP = 'Unknown IP';
      try {
        const deviceResponse = await fetch(`/api/workstation-devices/${action.device.id}`);
        if (deviceResponse.ok) {
          const deviceData = await deviceResponse.json();
          deviceIP = deviceData.data?.ipAddress || '127.0.0.1';
        }
      } catch (e) {
        console.error('获取设备IP失败:', e);
      }
      
      // 设置红屏报警
      setScreenError(true);
      
      // 显示设备连接错误弹框
      setDeviceErrorInfo({
        deviceName: action.device.name,
        deviceIP: deviceIP,
        errorMessage: `设备 ${action.device.name} 连接失败 - 请检查设备状态和网络连接`,
        actionName: action.name
      });
      setShowDeviceErrorModal(true);
      
      return false;
    }
    
    return true;
  };

  // 工艺执行相关函数
  const findFirstStepWithActions = (orderSteps: any[]) => {
    for (let i = 0; i < orderSteps.length; i++) {
      if (orderSteps[i]?.step?.actions && orderSteps[i].step.actions.length > 0) {
        return i;
      }
    }
    return 0; // 如果没有找到有actions的步骤，返回第一个步骤
  };

  const getCurrentStep = () => {
    if (!currentOrder || !currentOrder.orderSteps || currentStepIndex >= currentOrder.orderSteps.length) {
      return null;
    }
    return currentOrder.orderSteps[currentStepIndex];
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
    if (!currentOrder) return;

    if (currentStepIndex < currentOrder.orderSteps!.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      setCurrentActionIndex(0);
      
      // 保存工作状态
      if (workstationSession) {
        saveWorkState(workstationSession.workstation.workstationId);
      }
    } else {
      // 所有步骤完成 - 直接完成订单并退出执行模式
      console.log('所有工艺步骤已完成，订单完成');
      
      // 异步更新订单状态为已完成
      const completeOrder = async () => {
        try {
          // 首先检查当前订单状态，确保是IN_PROGRESS才能完成
          const checkResponse = await fetch(`/api/orders/${currentOrder.id}`);
          if (checkResponse.ok) {
            const checkData = await checkResponse.json();
            if (checkData.success && checkData.data.status !== 'IN_PROGRESS') {
              console.warn(`订单状态为 ${checkData.data.status}，无法完成订单`);
              alert(`无法完成订单：当前订单状态为 ${checkData.data.status}，只有进行中的订单才能完成`);
              return;
            }
          }

          console.log('更新订单状态为已完成:', currentOrder.id);
          const statusUpdateResponse = await fetch(`/api/orders/${currentOrder.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: 'changeStatus',
              status: 'COMPLETED',
              updatedBy: userInfo?.username || 'client',
              reason: '所有工艺步骤已完成',
              currentStationId: workstationSession?.workstation.id
            })
          });
          
          if (statusUpdateResponse.ok) {
            const statusResult = await statusUpdateResponse.json();
            console.log('订单状态更新为已完成:', statusResult);
          } else {
            console.error('订单状态更新失败');
            const errorData = await statusUpdateResponse.json();
            console.error('错误详情:', errorData);
            alert('订单完成失败: ' + (errorData.error || '未知错误'));
          }
        } catch (error) {
          console.error('更新订单状态时出错:', error);
          alert('订单完成时发生错误: ' + (error instanceof Error ? error.message : '未知错误'));
        }
      };
      
      // 先更新状态，然后清理界面
      completeOrder();
      
      // 停止PLC监控
      setIsMonitoringPLC(false);
      monitoringControlRef.current.isActive = false;
      monitoringControlRef.current.shouldStop = true;
      setScreenError(false);
      
      // 退出执行模式
      setIsExecutionMode(false);
      setCurrentOrder(null);
      setCurrentStepIndex(0);
      setCurrentActionIndex(0);
      setShowStepSelectMenu(false);
      setStartTime(null); // 重置计时器
      
      // 清除工作状态
      if (workstationSession) {
        clearWorkState(workstationSession.workstation.workstationId);
      }
      
      // 立即刷新订单列表（移除已完成的订单） - 确保在状态更新完成后执行
      setTimeout(async () => {
        if (workstationSession) {
          console.log('订单完成后立即刷新订单列表...');
          await loadOrdersWithSession(workstationSession);
          // 再次刷新确保数据同步
          setTimeout(() => {
            if (workstationSession) {
              loadOrdersWithSession(workstationSession);
            }
          }, 1000);
        }
      }, 500);
    }
  };

  const handleRepeatStep = () => {
    setCurrentActionIndex(0);
  };

  // 开始PLC监控 - 当动作变为当前动作时自动开始
  const startPLCMonitoring = async (action: Action) => {
    if (!action.device) {
      console.log('动作无设备配置，跳过监控');
      return;
    }

    // 重置屏幕状态和监控控制
    setScreenError(false);
    setIsMonitoringPLC(true);
    
    // 重置监控控制ref
    monitoringControlRef.current = {
      isActive: true,
      shouldStop: false
    };

    try {
      // 使用设备的instanceId进行通讯
      const deviceInstanceId = action.device.deviceId; // 这是instanceId
      console.log(`准备连接设备: ${action.device.name} (Instance: ${deviceInstanceId})`);
      
      // 首先检查设备连接状态
      const statusResponse = await fetch(`/api/device-communication/devices/${deviceInstanceId}/status`);
      const statusData = await statusResponse.json();
      
      if (!statusData.isConnected) {
        console.log(`设备未连接，尝试连接: ${action.device.name}`);
        // 尝试连接设备
        const connectResponse = await fetch(`/api/device-communication/devices/${deviceInstanceId}/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const connectResult = await connectResponse.json();
        if (!connectResult.success) {
          throw new Error(`设备连接失败: ${connectResult.error || connectResult.message}`);
        }
        console.log(`设备连接成功: ${action.device.name}`);
      } else {
        console.log(`设备已连接: ${action.device.name}`);
      }
      
      // 获取设备信息
      const deviceIP = action.device.ipAddress || '127.0.0.1';
      const devicePort = action.device.port || 102;
      
      console.log(`自动开始监控PLC: ${action.name}, 设备: ${action.device.name} (${deviceIP}:${devicePort})`);
      
      // 从动作配置中读取传感器值地址和期望值
      const sensorValue = action.parameters?.sensorValue || action.parameters?.completionCondition || action.deviceAddress || '';
      
      console.log('动作配置调试信息:', {
        actionName: action.name,
        parameters: action.parameters,
        deviceAddress: action.deviceAddress,
        sensorValue: sensorValue,
        expectedValue: action.expectedValue
      });
      
      if (!sensorValue) {
        console.log('动作未配置传感器值地址，跳过监控');
        setIsMonitoringPLC(false);
        monitoringControlRef.current.isActive = false;
        return;
      }
      
      // 解析PLC地址和期望值 - 支持 DB10.DBX0.0=1 格式
      const parseAddressAndExpectedValue = (addressString: string) => {
        // 检查是否包含等号，分离地址和期望值
        let cleanAddress = addressString.trim();
        let expectedValue = '1'; // 默认期望值为1
        
        if (addressString.includes('=')) {
          const parts = addressString.split('=');
          cleanAddress = parts[0].trim();
          expectedValue = parts[1].trim();
        } else if (action.expectedValue) {
          // 如果动作有单独配置的期望值，使用它
          expectedValue = action.expectedValue.toString();
        }
        
        // 解析DB10.DBX0.0格式
        const dbMatch = cleanAddress.match(/DB(\d+)\.DBX(\d+)\.(\d+)/);
        if (dbMatch) {
          return {
            type: 'DB',
            dbNumber: parseInt(dbMatch[1]),
            byte: parseInt(dbMatch[2]),
            bit: parseInt(dbMatch[3]),
            address: cleanAddress,
            expectedValue: expectedValue,
            fullCondition: `${cleanAddress}=${expectedValue}`
          };
        }
        
        // 如果解析失败，尝试其他格式或返回默认值
        return {
          type: 'DB',
          dbNumber: 0,
          byte: 0,
          bit: 0,
          address: cleanAddress,
          expectedValue: expectedValue,
          fullCondition: `${cleanAddress}=${expectedValue}`
        };
      };
      
      const addressInfo = parseAddressAndExpectedValue(sensorValue);
      console.log('解析的PLC地址和期望值:', addressInfo);
      
      // 设置超时时间（默认30秒）
      const timeoutMs = (action.timeout || action.parameters?.timeout || 30) * 1000;
      const startTime = Date.now();
      
      // 持续监控PLC值
      const monitorPLCValue = async (): Promise<boolean> => {
        while (Date.now() - startTime < timeoutMs && monitoringControlRef.current.isActive && !monitoringControlRef.current.shouldStop) {
          try {
            console.log(`读取PLC地址: ${addressInfo.address}`);
            
            const response = await fetch(`/api/device-communication/devices/${deviceInstanceId}/read`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                address: addressInfo.address,
                type: addressInfo.type,
                dbNumber: addressInfo.dbNumber,
                byte: addressInfo.byte,
                bit: addressInfo.bit
              })
            });
            
            if (response.ok) {
              const result = await response.json();
              if (result.success) {
                const value = result.value;
                console.log(`PLC读取结果: ${addressInfo.address} = ${value}, 期望值: ${addressInfo.expectedValue}`);
                
                // 判断值是否匹配期望值
                const isMatch = checkValueMatch(value, addressInfo.expectedValue);
                if (isMatch) {
                  console.log(`PLC值检测通过，动作完成 (${addressInfo.fullCondition})`);
                  return true;
                }
                
                console.log(`等待PLC值变为期望值，当前: ${addressInfo.address}=${value}, 期望: ${addressInfo.expectedValue}`);
              } else {
                console.warn('PLC读取失败:', result.error);
              }
            } else {
              console.warn('PLC通信失败:', response.status);
            }
            
            // 等待1秒后继续读取
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } catch (readError) {
            console.error('PLC读取异常:', readError);
            // 继续尝试读取
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        // 超时或被停止
        if (Date.now() - startTime >= timeoutMs) {
          throw new Error('TIMEOUT');
        }
        return false;
      };

      // 开始监控
      const success = await monitorPLCValue();
      
      if (success) {
        // 监控成功，动作通过
        console.log(`动作自动完成: ${action.name}, PLC条件 ${addressInfo.fullCondition} 已满足`);
        setIsMonitoringPLC(false);
        monitoringControlRef.current.isActive = false;
        setTimeout(() => handleNextAction(), 500); // 短暂延迟后自动下一步
      }
      
    } catch (error) {
      console.error('PLC监控失败:', error);
      setIsMonitoringPLC(false);
      monitoringControlRef.current.isActive = false;
      
      // 获取设备IP用于错误显示
      let deviceIP = 'Unknown IP';
      try {
        const deviceResponse = await fetch(`/api/workstation-devices/${action.device.id}`);
        if (deviceResponse.ok) {
          const deviceData = await deviceResponse.json();
          deviceIP = deviceData.data?.ipAddress || '127.0.0.1';
        }
      } catch (e) {
        console.error('获取设备IP失败:', e);
      }
      
      // 设置屏幕为红色错误状态
      setScreenError(true);
      
      // 显示设备连接错误弹框
      setDeviceErrorInfo({
        deviceName: action.device.name,
        deviceIP: deviceIP,
        errorMessage: error instanceof Error && error.message === 'TIMEOUT' ? 
          `设备连接超时 - PLC条件 ${addressInfo.fullCondition} 监控超时` : 
          `连接错误: ${error instanceof Error ? error.message : '未知错误'}`,
        actionName: action.name
      });
      setShowDeviceErrorModal(true);
    }
  };

  // 手动确认当前动作
  const executeCurrentAction = () => {
    const currentAction = getCurrentAction();
    if (!currentAction) {
      alert('没有可执行的动作');
      return;
    }
    
    // 手动确认动作完成
    alert(`手动确认动作: ${currentAction.name}`);
    handleNextAction();
  };

  const handleSelectStep = () => {
    setShowStepSelectMenu(!showStepSelectMenu);
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

  const handleExitExecution = () => {
    // 停止PLC监控
    setIsMonitoringPLC(false);
    monitoringControlRef.current.isActive = false;
    monitoringControlRef.current.shouldStop = true;
    setScreenError(false);
    
    setIsExecutionMode(false);
    setCurrentOrder(null);
    setCurrentStepIndex(0);
    setCurrentActionIndex(0);
    setShowStepSelectMenu(false);
    setStartTime(null); // 重置计时器
    
    // 退出执行模式后立即刷新订单列表
    setTimeout(() => {
      if (workstationSession) {
        console.log('退出执行模式后刷新订单列表...');
        loadOrdersWithSession(workstationSession);
      }
    }, 100);
  };

  // PLC测试相关函数
  const getPLCAddressTypes = (brand?: string) => {
    const lowerBrand = brand?.toLowerCase() || '';
    
    if (lowerBrand.includes('siemens') || lowerBrand.includes('西门子')) {
      // 西门子PLC地址类型
      return [
        { value: 'DB', label: 'DB - 数据块 (Data Block)' },
        { value: 'D', label: 'D - 数据区 (Data)' },
        { value: 'M', label: 'M - 存储区 (Memory)' },
        { value: 'I', label: 'I - 输入区 (Input)' },
        { value: 'Q', label: 'Q - 输出区 (Output)' }
      ];
    } else if (lowerBrand.includes('mitsubishi') || lowerBrand.includes('三菱')) {
      // 三菱PLC地址类型
      return [
        { value: 'D', label: 'D - 数据寄存器' },
        { value: 'M', label: 'M - 内部继电器' },
        { value: 'X', label: 'X - 输入继电器' },
        { value: 'Y', label: 'Y - 输出继电器' },
        { value: 'T', label: 'T - 定时器' },
        { value: 'C', label: 'C - 计数器' }
      ];
    } else {
      // 通用PLC地址类型
      return [
        { value: 'DB', label: 'DB - 数据块' },
        { value: 'D', label: 'D - 数据区' },
        { value: 'M', label: 'M - 存储区' },
        { value: 'I', label: 'I - 输入区' },
        { value: 'Q', label: 'Q - 输出区' }
      ];
    }
  };

  const handlePLCRead = async () => {
    if (!currentPLCDevice) return;
    
    setPlcTestLoading(true);
    setPlcTestResult(null);
    
    try {
      const address = `${plcTestParams.type}${plcTestParams.dbNumber}.${plcTestParams.byte}.${plcTestParams.bit}`;
      console.log(`Reading PLC address: ${address}`);
      console.log(`Current PLC Device:`, currentPLCDevice);
      console.log(`Using device ID for API call:`, currentPLCDevice.id);
      
      // 直接使用真实设备读取，不使用模拟模式
      // 后端服务已经支持PLC模拟器（端口5020）
      {
        // 使用真实设备读取
        const response = await fetch(`/api/device-communication/devices/${currentPLCDevice.deviceId}/read`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            address: address,
            type: plcTestParams.type,
            dbNumber: plcTestParams.dbNumber,
            byte: plcTestParams.byte,
            bit: plcTestParams.bit
          })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
          setPlcTestResult({
            success: true,
            value: result.value,
            message: `读取成功: ${address} = ${result.value}`,
            operation: 'read',
            rawData: result.rawFrame || `TX: ${result.request || 'N/A'}\nRX: ${result.response || 'N/A'}`
          });
        } else {
          setPlcTestResult({
            success: false,
            message: result.message || result.error || '读取失败',
            operation: 'read',
            rawData: result.rawFrame || result.debugInfo || 'No frame data available'
          });
        }
      }
    } catch (error) {
      console.error('PLC read error:', error);
      setPlcTestResult({
        success: false,
        message: error instanceof Error ? error.message : '网络错误',
        operation: 'read'
      });
    } finally {
      setPlcTestLoading(false);
    }
  };

  const handlePLCWrite = async () => {
    if (!currentPLCDevice) return;
    
    setPlcTestLoading(true);
    setPlcTestResult(null);
    
    try {
      const address = `${plcTestParams.type}${plcTestParams.dbNumber}.${plcTestParams.byte}.${plcTestParams.bit}`;
      console.log(`Writing PLC address: ${address} = ${plcTestParams.writeValue}`);
      console.log(`Current PLC Device:`, currentPLCDevice);
      console.log(`Using device ID for write API:`, currentPLCDevice.deviceId);
      console.log(`Device has ID fields - id: ${currentPLCDevice.id}, deviceId: ${currentPLCDevice.deviceId}`);
      
      // 直接使用真实设备写入，不使用模拟模式
      // 后端服务已经支持PLC模拟器（端口5020）
      {
        // 使用真实设备写入
        const writeUrl = `/api/device-communication/devices/${currentPLCDevice.deviceId}/write`;
        console.log(`Write API URL:`, writeUrl);
        const response = await fetch(writeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            address: address,
            type: plcTestParams.type,
            dbNumber: plcTestParams.dbNumber,
            byte: plcTestParams.byte,
            bit: plcTestParams.bit,
            value: plcTestParams.writeValue
          })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
          setPlcTestResult({
            success: true,
            value: plcTestParams.writeValue,
            message: `写入成功: ${address} = ${plcTestParams.writeValue}`,
            operation: 'write',
            rawData: result.rawFrame || `TX: ${result.request || 'N/A'}\nRX: ${result.response || 'N/A'}`
          });
        } else {
          setPlcTestResult({
            success: false,
            message: result.message || result.error || '写入失败',
            operation: 'write',
            rawData: result.rawFrame || result.debugInfo || 'No frame data available'
          });
        }
      }
    } catch (error) {
      console.error('PLC write error:', error);
      setPlcTestResult({
        success: false,
        message: error instanceof Error ? error.message : '网络错误',
        operation: 'write'
      });
    } finally {
      setPlcTestLoading(false);
    }
  };

  const closePLCTestModal = () => {
    setShowPLCTestModal(false);
    setCurrentPLCDevice(null);
    setPlcTestResult(null);
    setPlcTestParams({
      type: 'DB',
      dbNumber: 0,
      byte: 0,
      bit: 0,
      writeValue: false
    });
  };

  // 通用设备测试函数
  const performGenericDeviceTest = async (testType: string) => {
    if (!currentGenericDevice) return;
    
    setGenericTestLoading(true);
    setGenericTestResult(null);
    
    try {
      console.log(`Performing ${testType} test on device: ${currentGenericDevice.name}`);
      
      let apiUrl = '';
      let method = 'POST';
      let body: any = {};
      
      switch (testType) {
        case 'ping':
          // 使用状态检查API作为ping测试
          apiUrl = `/api/device-communication/devices/${currentGenericDevice.deviceId}/status`;
          method = 'GET';
          body = null;
          break;
        case 'read':
          // 对于通用设备的读取测试，可能需要特定参数
          apiUrl = `/api/device-communication/devices/${currentGenericDevice.deviceId}/read`;
          body = { testRead: true };
          break;
        case 'write':
          // 对于通用设备的写入测试
          apiUrl = `/api/device-communication/devices/${currentGenericDevice.deviceId}/write`;
          body = { testWrite: true, value: 'test' };
          break;
        default:
          throw new Error(`Unknown test type: ${testType}`);
      }
      
      const response = await fetch(apiUrl, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {},
        body: method === 'POST' ? JSON.stringify(body) : undefined
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        setGenericTestResult({
          success: true,
          message: `${testType.toUpperCase()} test successful`,
          data: result
        });
      } else {
        setGenericTestResult({
          success: false,
          message: result.message || result.error || `${testType.toUpperCase()} test failed`
        });
      }
    } catch (error) {
      console.error(`Generic device ${testType} test error:`, error);
      setGenericTestResult({
        success: false,
        message: error instanceof Error ? error.message : `${testType.toUpperCase()} test network error`
      });
    } finally {
      setGenericTestLoading(false);
    }
  };

  const closeGenericTestModal = () => {
    setShowGenericTestModal(false);
    setCurrentGenericDevice(null);
    setGenericTestResult(null);
  };

  const getDeviceIcon = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('camera')) return '📹';
    if (lowerType.includes('scanner') || lowerType.includes('barcode')) return '📱';
    if (lowerType.includes('plc') || lowerType.includes('simatic')) return '🖥️';
    if (lowerType.includes('sensor') || lowerType.includes('senzor')) return '🔍';
    if (lowerType.includes('zebra') || lowerType.includes('printer')) return '🖨️';
    if (lowerType.includes('system')) return '❓';
    if (lowerType.includes('keyence')) return '🔷';
    if (lowerType.includes('ifm')) return '🔺';
    return '⚙️';
  };

  const toggleMenu = () => {
    setIsMenuExpanded(!isMenuExpanded);
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

  const formatLoginTime = (loginTime: string) => {
    return new Date(loginTime).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
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

  // 服务模式界面
  if (isServiceMode) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        {/* 顶部工位信息栏 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-gray-900">MES</h1>
              <div className="flex items-center space-x-8 text-sm text-gray-600">
                <div>1. station: {workstationSession.workstation.name}</div>
                <div>2. name: {userInfo.username}</div>
                <div>3. login date: {formatLoginTime(workstationSession.loginTime)}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-mono">{formatDateTime(currentTime)}</div>
            </div>
          </div>
        </div>

        {/* 服务模式主体内容 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {/* 标题和返回按钮 */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">{t('serviceMode.title')}</h2>
            <button
              onClick={exitServiceMode}
              className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
            >
              {t('serviceMode.backToWorkstation')}
            </button>
          </div>

          {/* 加载状态 */}
          {isLoadingDevices ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mr-4"></div>
              <p className="text-gray-600 text-lg">{t('serviceMode.loadingDevices')}</p>
            </div>
          ) : devices.length === 0 ? (
            /* 无设备状态 */
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📡</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('serviceMode.noDevices')}</h3>
              <p className="text-gray-600">
                工位 <span className="font-mono bg-gray-100 px-2 py-1 rounded">{workstationSession.workstation.workstationId}</span> 
                暂无配置的设备
              </p>
            </div>
          ) : (
            /* 设备网格 */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {devices.map((device) => (
                <div key={device.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  {/* 设备图标和名称 */}
                  <div className="flex items-center mb-3">
                    <span className="text-2xl mr-3">{getDeviceIcon(device.type)}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-sm">{t('serviceMode.deviceName')}: {device.name}</h3>
                      <p className="text-gray-600 text-xs mt-1">{t('serviceMode.deviceType')}: {device.type}</p>
                    </div>
                  </div>

                  {/* 设备状态指示器 */}
                  <div className="flex items-center mb-3">
                    <div className={`w-3 h-3 rounded-full mr-2 ${
                      device.status === 'ONLINE' ? 'bg-green-500' :
                      device.status === 'OFFLINE' ? 'bg-gray-400' :
                      device.status === 'ERROR' ? 'bg-red-500' :
                      'bg-yellow-500'
                    }`}></div>
                    <span className={`text-xs font-medium ${
                      device.status === 'ONLINE' ? 'text-green-600' :
                      device.status === 'OFFLINE' ? 'text-gray-500' :
                      device.status === 'ERROR' ? 'text-red-600' :
                      'text-yellow-600'
                    }`}>
                      {device.status}
                    </span>
                  </div>

                  {/* 连接信息 */}
                  {device.ipAddress && (
                    <div className="text-xs text-gray-500 mb-3">
                      <div>IP: {device.ipAddress}</div>
                      {device.port && <div>Port: {device.port}</div>}
                    </div>
                  )}

                  {/* 测试按钮 */}
                  <button
                    onClick={() => testDeviceConnection(device)}
                    disabled={testingDevices.has(device.id)}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium text-sm rounded-md transition-colors"
                  >
                    {testingDevices.has(device.id) ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {t('serviceMode.testing')}
                      </div>
                    ) : (
                      t('serviceMode.test')
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PLC测试模态框 */}
        {showPLCTestModal && currentPLCDevice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
              {/* 标题栏 */}
              <div className="flex justify-between items-center p-6 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">
                  {currentPLCDevice.name} [{currentPLCDevice.type}1 - {currentPLCDevice.ipAddress}:{currentPLCDevice.port},0,1]
                </h3>
                <button
                  onClick={closePLCTestModal}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                >
                  ×
                </button>
              </div>

              <div className="p-4">
                {/* PLC参数设置区域 */}
                <div className="mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {/* TYPE */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700 uppercase">TYPE</label>
                      <select
                        value={plcTestParams.type}
                        onChange={(e) => setPlcTestParams(prev => ({ ...prev, type: e.target.value }))}
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm font-medium text-center"
                      >
                        {getPLCAddressTypes(currentPLCDevice.brand).map(type => (
                          <option key={type.value} value={type.value}>{type.value}</option>
                        ))}
                      </select>
                    </div>

                    {/* DB NUMBER */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700 uppercase">DB NUMBER</label>
                      <div className="flex items-stretch bg-white border-2 border-gray-300 rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-transparent">
                        <button
                          type="button"
                          onClick={() => setPlcTestParams(prev => ({ 
                            ...prev, 
                            dbNumber: Math.max(0, prev.dbNumber - 1) 
                          }))}
                          className="flex-shrink-0 w-8 px-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-lg flex items-center justify-center transition-colors border-r-2 border-gray-300"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          value={plcTestParams.dbNumber}
                          onChange={(e) => setPlcTestParams(prev => ({ 
                            ...prev, 
                            dbNumber: Math.max(0, parseInt(e.target.value) || 0) 
                          }))}
                          className="flex-1 px-3 py-2 text-center text-sm font-medium border-0 focus:outline-none min-w-[50px]"
                          min="0"
                        />
                        <button
                          type="button"
                          onClick={() => setPlcTestParams(prev => ({ 
                            ...prev, 
                            dbNumber: prev.dbNumber + 1 
                          }))}
                          className="flex-shrink-0 w-8 px-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-lg flex items-center justify-center transition-colors border-l-2 border-gray-300"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* BYTE */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700 uppercase">BYTE</label>
                      <div className="flex items-stretch bg-white border-2 border-gray-300 rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-transparent">
                        <button
                          type="button"
                          onClick={() => setPlcTestParams(prev => ({ 
                            ...prev, 
                            byte: Math.max(0, prev.byte - 1) 
                          }))}
                          className="flex-shrink-0 w-8 px-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-lg flex items-center justify-center transition-colors border-r-2 border-gray-300"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          value={plcTestParams.byte}
                          onChange={(e) => setPlcTestParams(prev => ({ 
                            ...prev, 
                            byte: Math.max(0, parseInt(e.target.value) || 0) 
                          }))}
                          className="flex-1 px-3 py-2 text-center text-sm font-medium border-0 focus:outline-none min-w-[50px]"
                          min="0"
                        />
                        <button
                          type="button"
                          onClick={() => setPlcTestParams(prev => ({ 
                            ...prev, 
                            byte: prev.byte + 1 
                          }))}
                          className="flex-shrink-0 w-8 px-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-lg flex items-center justify-center transition-colors border-l-2 border-gray-300"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* BIT */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700 uppercase">BIT</label>
                      <div className="flex items-stretch bg-white border-2 border-gray-300 rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-transparent">
                        <button
                          type="button"
                          onClick={() => setPlcTestParams(prev => ({ 
                            ...prev, 
                            bit: Math.max(0, prev.bit - 1) 
                          }))}
                          className="flex-shrink-0 w-8 px-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-lg flex items-center justify-center transition-colors border-r-2 border-gray-300"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          value={plcTestParams.bit}
                          onChange={(e) => setPlcTestParams(prev => ({ 
                            ...prev, 
                            bit: Math.max(0, Math.min(7, parseInt(e.target.value) || 0)) 
                          }))}
                          className="flex-1 px-3 py-2 text-center text-sm font-medium border-0 focus:outline-none min-w-[40px]"
                          min="0"
                          max="7"
                        />
                        <button
                          type="button"
                          onClick={() => setPlcTestParams(prev => ({ 
                            ...prev, 
                            bit: Math.min(7, prev.bit + 1) 
                          }))}
                          className="flex-shrink-0 w-8 px-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-lg flex items-center justify-center transition-colors border-l-2 border-gray-300"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Write value */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700 uppercase">Write value</label>
                      <select
                        value={plcTestParams.writeValue.toString()}
                        onChange={(e) => setPlcTestParams(prev => ({ 
                          ...prev, 
                          writeValue: e.target.value === 'true' 
                        }))}
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm font-medium text-center"
                      >
                        <option value="false">FALSE</option>
                        <option value="true">TRUE</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex justify-center gap-4 mb-6">
                  <button
                    onClick={handlePLCRead}
                    disabled={plcTestLoading}
                    className="px-8 py-3 bg-blue-600 text-white font-bold text-base rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg"
                  >
                    {plcTestLoading ? 'READING...' : 'READ'}
                  </button>
                  <button
                    onClick={handlePLCWrite}
                    disabled={plcTestLoading}
                    className="px-8 py-3 bg-green-600 text-white font-bold text-base rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg"
                  >
                    {plcTestLoading ? 'WRITING...' : 'WRITE'}
                  </button>
                </div>

                {/* 结果显示区域 */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-base font-bold text-center text-gray-900 mb-3 uppercase">Result</h4>
                    <div className="min-h-[60px] bg-gray-50 border-2 border-gray-300 rounded-md p-3 flex items-center justify-center">
                      {plcTestResult ? (
                        <div className={`text-center ${plcTestResult.success ? 'text-green-600' : 'text-red-600'}`}>
                          <div className="text-base font-medium">
                            {plcTestResult.success ? 
                              <>
                                {plcTestResult.operation === 'read' ? (
                                  plcTestResult.value !== undefined ? 
                                    `Read Value: ${plcTestResult.value}` : 
                                    'Read successful'
                                ) : (
                                  'Write successful'
                                )}
                              </> : 
                              `Error: ${plcTestResult.message || 'Operation failed'}`
                            }
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-500 text-base">Result will appear here</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-center text-gray-900 mb-3 uppercase">Message</h4>
                    <div className="min-h-[60px] bg-gray-50 border-2 border-gray-300 rounded-md p-3">
                      {plcTestResult?.rawData ? (
                        <div className="font-mono text-xs text-gray-700 whitespace-pre-wrap break-all">
                          {plcTestResult.rawData}
                        </div>
                      ) : (
                        <div className="text-gray-500 text-base text-center">Raw data frame will appear here</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 服务模式设备测试错误对话框 */}
        {showDeviceTestErrorModal && deviceTestErrorInfo && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96 mx-4 shadow-xl">
              <div className="text-center">
                {/* 错误标题 */}
                <h3 className="text-lg font-medium text-red-600 mb-4">
                  {deviceTestErrorInfo.errorMessage}
                </h3>
                
                {/* 地址信息 */}
                <div className="text-sm text-gray-600 mb-6">
                  <p><strong>Address:</strong> {deviceTestErrorInfo.address}</p>
                </div>
                
                {/* 关闭按钮 */}
                <button
                  onClick={() => {
                    setShowDeviceTestErrorModal(false);
                    setDeviceTestErrorInfo(null);
                  }}
                  className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 通用设备测试对话框 */}
        {showGenericTestModal && currentGenericDevice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96 mx-4 shadow-xl">
              <div className="text-center">
                {/* 设备信息标题 */}
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {currentGenericDevice.name}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {currentGenericDevice.type} - {currentGenericDevice.brand || 'Generic'} 
                  {currentGenericDevice.model && ` ${currentGenericDevice.model}`}
                </p>
                
                {/* 设备地址 */}
                <div className="text-sm text-gray-600 mb-6 bg-gray-50 p-3 rounded">
                  <p><strong>Address:</strong> {currentGenericDevice.ipAddress || 'N/A'}:{currentGenericDevice.port || 'N/A'}</p>
                  <p><strong>Protocol:</strong> {currentGenericDevice.protocol || 'TCP'}</p>
                </div>
                
                {/* 测试按钮组 */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <button
                    onClick={() => performGenericDeviceTest('ping')}
                    disabled={genericTestLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-sm transition-colors"
                  >
                    {genericTestLoading ? '...' : 'PING'}
                  </button>
                  <button
                    onClick={() => performGenericDeviceTest('read')}
                    disabled={genericTestLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-sm transition-colors"
                  >
                    {genericTestLoading ? '...' : 'READ'}
                  </button>
                  <button
                    onClick={() => performGenericDeviceTest('write')}
                    disabled={genericTestLoading}
                    className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:bg-orange-400 disabled:cursor-not-allowed text-sm transition-colors"
                  >
                    {genericTestLoading ? '...' : 'WRITE'}
                  </button>
                </div>
                
                {/* 测试结果 */}
                {genericTestResult && (
                  <div className={`mb-6 p-3 rounded text-sm ${
                    genericTestResult.success 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    <p className="font-medium">
                      {genericTestResult.success ? '✅' : '❌'} {genericTestResult.message}
                    </p>
                    {genericTestResult.data && (
                      <pre className="mt-2 text-xs overflow-x-auto">
                        {JSON.stringify(genericTestResult.data, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
                
                {/* 关闭按钮 */}
                <button
                  onClick={closeGenericTestModal}
                  className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
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

  // 工艺执行模式界面 - 6区域设计
  if (isExecutionMode && currentOrder) {
    const currentStep = getCurrentStep();
    const currentAction = getCurrentAction();

    return (
      <div className="h-screen flex flex-col overflow-hidden bg-white">
        
        {/* 顶部状态栏 */}
        <div className="bg-blue-500 text-white px-4 py-2 flex justify-between items-center text-sm flex-shrink-0">
          <div className="flex items-center space-x-6">
            <span>1. station: {workstationSession.workstation.workstationId}</span>
            <span>2. name: {userInfo.username}</span>
            <span>3. login date: {new Date(workstationSession.loginTime).toLocaleDateString('zh-CN')} {new Date(workstationSession.loginTime).toLocaleTimeString('zh-CN')}</span>
          </div>
          <div className="text-lg font-mono">{formatDateTime(currentTime)}</div>
        </div>

        {/* 主内容区域 - 使用flex-1占满剩余高度 */}
        <div className="flex flex-1 relative overflow-hidden">

          {/* 左侧区域 - 区域1,2,3,4 - 紧凑高度分配适配屏幕 */}
          {showLeftPanel && (
            <div className="w-96 h-full flex flex-col flex-shrink-0">
              {/* 区域1: 步骤 (Worksteps) - 占用40%高度 */}
              <div 
                className="border border-gray-300 bg-gray-100 flex flex-col"
                style={{ height: '40%' }}
                onClick={() => setShowLeftPanel(false)}
              >
                <div className="bg-gray-200 px-3 py-1 font-bold text-base border-b flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  Worksteps ({currentOrder?.orderSteps?.length || 0})
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1" onClick={(e) => e.stopPropagation()}>
                  {!currentOrder?.orderSteps ? (
                    <div className="text-red-500 text-sm">无步骤数据</div>
                  ) : currentOrder.orderSteps.length === 0 ? (
                    <div className="text-yellow-600 text-sm">步骤列表为空</div>
                  ) : (
                    currentOrder.orderSteps.map((orderStep, index) => (
                      <div 
                        key={orderStep.id}
                        ref={index === currentStepIndex ? activeStepRef : null}
                        onClick={(e) => { e.stopPropagation(); setCurrentStepIndex(index); setCurrentActionIndex(0); }}
                        className={`p-2 text-lg border rounded cursor-pointer hover:bg-yellow-100 transition-colors ${
                          index === currentStepIndex 
                            ? 'bg-yellow-400 text-black font-bold' 
                            : orderStep.status === 'completed'
                            ? 'bg-green-200 text-green-800'
                            : 'bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div className="font-bold text-xl">
                          {orderStep.step.name}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">动作: {orderStep.step.actions?.length || 0}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 区域2: 动作 (Actions) - 占用30%高度 */}
              <div 
                className="border border-gray-300 bg-gray-100 flex flex-col"
                style={{ height: '30%' }}
                onClick={() => setShowLeftPanel(false)}
              >
                <div className="bg-gray-200 px-3 py-1 font-bold text-base border-b flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  Actions ({currentStep?.step.actions?.length || 0})
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1" onClick={(e) => e.stopPropagation()}>
                  {!currentStep ? (
                    <div className="text-red-500 text-sm">当前步骤为空</div>
                  ) : !currentStep.step ? (
                    <div className="text-red-500 text-sm">步骤详情为空</div>
                  ) : !currentStep.step.actions ? (
                    <div className="text-red-500 text-sm">无动作数据</div>
                  ) : currentStep.step.actions.length === 0 ? (
                    <div className="text-yellow-600 text-sm">动作列表为空</div>
                  ) : (
                    currentStep.step.actions.map((action, index) => (
                      <div 
                        key={action.id}
                        ref={index === currentActionIndex ? activeActionRef : null}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentActionIndex(index);
                          // 如果动作有设备配置，自动开始监控
                          if (action.device && isExecutionMode) {
                            console.log('手动切换到动作:', action.name);
                            // 触发设备监控会在useEffect中自动开始
                          }
                        }}
                        className={`p-2 text-base rounded cursor-pointer transition-colors ${
                          index === currentActionIndex 
                            ? 'bg-yellow-400 text-black font-bold' 
                            : action.status === 'completed'
                            ? 'bg-green-200 text-green-800'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-lg">{action.name || `Action ${index + 1}`}</div>
                          {index === currentActionIndex && isMonitoringPLC && (
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                          )}
                        </div>
                        {action.description && (
                          <div className="text-xs text-gray-600 mt-1">{action.description}</div>
                        )}
                        {action.type && (
                          <div className="text-xs text-gray-500 mt-1">类型: {action.type}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 区域3: 设备 (Devices) - 占用15%高度 */}
              <div 
                className="border border-gray-300 bg-gray-100 flex flex-col"
                style={{ height: '15%' }}
                onClick={() => setShowLeftPanel(false)}
              >
                <div className="bg-gray-200 px-3 py-1 font-bold text-base border-b flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  Devices
                  {isMonitoringPLC && (
                    <span className="ml-2 text-xs text-red-600 font-normal animate-pulse">● 监控中</span>
                  )}
                </div>
                <div className="flex-1 p-2 text-sm overflow-hidden overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  {(() => {
                    // 显示当前步骤涉及的所有设备，并高亮当前动作的设备
                    const step = currentStep;
                    if (!step || !step.step) {
                      return <div className="text-gray-500">当前步骤为空</div>;
                    }

                    const actions = step.step.actions || [];
                    // 收集该步骤中涉及到的设备（去重），按 device.deviceId 聚合
                    const devicesMap = new Map<string, { device: any; actionIndexes: number[] }>();
                    actions.forEach((action, idx) => {
                      const dev = action.device;
                      const devInstanceId = dev?.deviceId || action.deviceId;
                      if (!devInstanceId) return;
                      if (!devicesMap.has(devInstanceId)) {
                        devicesMap.set(devInstanceId, {
                          device: dev || { 
                            deviceId: action.deviceId, 
                            name: action.deviceName || '设备', 
                            type: action.deviceType || action.type,
                            ipAddress: action.deviceIP,
                            port: action.devicePort
                          },
                          actionIndexes: []
                        });
                      }
                      devicesMap.get(devInstanceId)!.actionIndexes.push(idx);
                    });

                    if (devicesMap.size === 0) {
                      return <div className="text-gray-500">当前步骤无设备配置</div>;
                    }

                    return Array.from(devicesMap.values()).map(({ device, actionIndexes }, i) => {
                      const isCurrent = currentAction && (device?.deviceId === currentAction.device?.deviceId || device?.deviceId === currentAction.deviceId);
                      // 使用数据库ID查找连接状态
                      const currentDeviceAction = actions[actionIndexes[0]];
                      const dbId = currentDeviceAction?.device?.id;
                      const conn = dbId ? deviceConnectionStatus[dbId] : undefined;
                      const statusColor = conn === true ? 'bg-green-500' : (conn === false ? 'bg-red-500' : 'bg-yellow-500');
                      const statusText = conn === true ? '设备在线' : (conn === false ? '设备离线' : '检测中...');
                      
                      return (
                        <div 
                          key={device?.deviceId || device?.id || i} 
                          className={`mb-2 p-2 rounded border transition-all ${
                            isCurrent 
                              ? 'border-blue-500 bg-blue-50 shadow-md' 
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-bold text-base text-gray-900">
                                {device?.name || '未命名设备'}
                              </div>
                              <div className="text-xs text-gray-600 mt-0.5">
                                {device?.type || '未知类型'}
                              </div>
                              {device?.ipAddress && (
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {device.ipAddress}:{device.port || '102'}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center space-x-1">
                              <div className={`w-2 h-2 rounded-full ${statusColor}`} title={statusText} />
                              {isCurrent && isMonitoringPLC && (
                                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" title="正在监控" />
                              )}
                            </div>
                          </div>

                          {/* 该设备关联的动作 */}
                          {actionIndexes.length > 0 && (
                            <div className="mt-2">
                              <div className="text-xs text-gray-500 mb-1">
                                相关动作 ({actionIndexes.length}):
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {actionIndexes.map(ai => {
                                  const action = actions[ai];
                                  const isCurrentAction = ai === currentActionIndex;
                                  return (
                                    <button
                                      key={ai}
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setCurrentActionIndex(ai); 
                                      }}
                                      className={`px-2 py-0.5 rounded border text-xs transition-colors ${
                                        isCurrentAction 
                                          ? 'bg-yellow-300 border-yellow-500 font-bold' 
                                          : action?.status === 'completed'
                                          ? 'bg-green-100 border-green-300 text-green-700'
                                          : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
                                      }`}
                                      title={action?.description || `执行: ${action?.name || ''}`}
                                    >
                                      {action?.name || `动作 ${ai + 1}`}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* 区域4: 工作用时 (Assembly time) - 占用15%高度 */}
              <div 
                className="border border-gray-300 bg-gray-100 flex flex-col"
                style={{ height: '15%' }}
                onClick={() => setShowLeftPanel(false)}
              >
                <div className="bg-gray-200 px-3 py-1 font-bold text-base border-b flex-shrink-0" onClick={(e) => e.stopPropagation()}>Assembly time</div>
                <div className="flex-1 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-7xl font-mono font-bold text-center text-blue-600 leading-none">
                      {assemblyLineTimer}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 左侧点击区域（当面板隐藏时） */}
          {!showLeftPanel && (
            <div 
              className="w-8 bg-gray-200 hover:bg-gray-300 cursor-pointer flex items-center justify-center transition-colors flex-shrink-0"
              onClick={() => setShowLeftPanel(true)}
            >
              <div className="text-gray-600 text-xs" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                ▶
              </div>
            </div>
          )}


          {/* 中间主屏幕区域 - 图片显示 */}
          <div 
            className="flex-1 relative overflow-hidden transition-all duration-500 bg-white"
            onClick={() => {
              // 点击中间区域隐藏弹出的菜单
              setShowMenuArea(false);
              setShowProcessMenu(false);
            }}
          >
            {/* 中间区域红屏错误覆盖层 - 只覆盖图片区域 */}
            {screenError && (
              <div className="absolute inset-0 bg-red-500 bg-opacity-30 z-20 pointer-events-none animate-pulse">
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-lg font-bold text-lg shadow-lg">
                  ⚠️ 设备连接异常 - 请检查设备状态
                </div>
              </div>
            )}
            <div className="w-full h-full flex items-center justify-center">
              {currentStep?.step.stepTemplate.image ? (
                <img 
                  src={currentStep.step.stepTemplate.image}
                  alt={currentStep.step.name}
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDYwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI2MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yODcuNSAyMjVMMjczIDIzOS41TDI4NyAyNTRIMzEzTDMyNyAyMzkuNUwzMTIuNSAyMjVIMjg3LjVaIiBmaWxsPSIjOUI5QkFCIi8+CjxwYXRoIGQ9Ik0yNTggMTk2SDM0MlYyMjVIMjU4VjE5NloiIGZpbGw9IiM5QjlCQUIiLz4KPHRleHQgeD0iMzAwIiB5PSIxODAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzlCOUJBQiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+5ZKl6IOM5LiN5Yiw5Zu+54mHPC90ZXh0Pgo8L3N2Zz4K';
                  }}
                />
              ) : (
                <div className="w-96 h-64 bg-gray-300 flex items-center justify-center text-gray-600">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📷</div>
                    <div>工艺指导图片</div>
                  </div>
                </div>
              )}
            </div>

            {/* 动作描述信息叠加 */}
            {currentAction && (
              <div 
                className="absolute bottom-4 left-4 right-4 bg-white bg-opacity-95 text-black p-4 rounded-lg shadow-lg overflow-y-auto"
                style={{ maxHeight: '15vh' }}
              >
                <h3 className="text-2xl font-bold mb-2 text-gray-900">{currentAction.name}</h3>
                {currentAction.description && (
                  <p className="text-lg leading-relaxed whitespace-pre-line text-gray-800">{currentAction.description}</p>
                )}
              </div>
            )}
          </div>

          {/* 右侧区域 - MENU和PROCESS */}
          {showRightPanel ? (
            /* 展开状态 - 使用相对定位 */
            <div 
              className="w-64 flex flex-shrink-0 bg-white"
              onClick={() => setShowRightPanel(false)}
            >
              {/* 左侧垂直MENU和PROCESS文字 */}
              <div className="w-16 flex flex-col bg-gray-300 h-full flex-shrink-0">
                {/* MENU垂直文字 */}
                <div className="h-48 flex items-center justify-center border-r border-gray-400">
                  <span 
                    className="text-black text-3xl font-bold tracking-widest"
                    style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                  >
                    MENU
                  </span>
                </div>
                
                {/* 分隔线 */}
                <div className="h-px bg-gray-600"></div>
                
                {/* PROCESS垂直文字 */}
                <div className="flex-1 flex items-center justify-center border-r border-gray-400">
                  <span 
                    className="text-black text-3xl font-bold tracking-widest"
                    style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                  >
                    PROCESS
                  </span>
                </div>
              </div>

              {/* 右侧菜单内容区域 */}
              <div className="flex-1 flex flex-col h-full" onClick={(e) => e.stopPropagation()}>
                {/* MENU菜单内容区域 */}
                <div className="h-48 bg-gray-100 border border-gray-300 flex flex-col flex-shrink-0">
                  <div className="flex-1 p-2 space-y-2">
                    <button
                      onClick={handleLogout}
                      className="w-full py-6 bg-gray-200 hover:bg-gray-300 text-black text-lg font-medium border border-gray-400"
                    >
                      LOGOUT
                    </button>
                    <button
                      className="w-full py-6 bg-gray-200 hover:bg-gray-300 text-black text-lg font-medium border border-gray-400"
                    >
                      LANGUAGE
                    </button>
                  </div>
                </div>

                {/* 分隔线 */}
                <div className="h-px bg-gray-600"></div>

                {/* PROCESS菜单内容区域 - 使用剩余高度 */}
                <div className="flex-1 bg-gray-100 border border-gray-300 flex flex-col">
                  <div className="flex-1 p-2 flex flex-col justify-between h-full">
                    <div className="space-y-2 flex-1">
                      <button
                        onClick={executeCurrentAction}
                        className="w-full py-4 bg-blue-400 hover:bg-blue-500 text-white text-lg font-medium"
                        disabled={!currentAction}
                      >
                        INPUT
                      </button>
                      <button
                        onClick={handleNextAction}
                        className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white text-lg font-medium"
                        disabled={!currentAction}
                      >
                        NEXT ACTION
                      </button>
                      <button
                        onClick={handleNextStep}
                        className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white text-lg font-medium"
                      >
                        NEXT STEP
                      </button>
                      <button
                        onClick={handleRepeatStep}
                        className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white text-lg font-medium"
                      >
                        REPEAT STEP
                      </button>
                      <button
                        onClick={handleSelectStep}
                        className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white text-lg font-medium"
                      >
                        SELECT STEP
                      </button>
                      <button
                        onClick={handleRestart}
                        className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white text-lg font-medium"
                      >
                        RESTART
                      </button>
                      <button
                        onClick={handleQualityIssue}
                        className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white text-lg font-medium"
                      >
                        QUALITY ISSUE
                      </button>
                    </div>
                    {/* 底部对齐的CANCEL按钮 */}
                    <button
                      onClick={handleExitExecution}
                      className="w-full py-4 bg-red-500 hover:bg-red-600 text-white text-lg font-medium flex-shrink-0"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* 收缩状态 */
            <div className="w-16 flex flex-col h-full flex-shrink-0">
              {/* MENU垂直文字区域 */}
              <div className="h-48 bg-gray-300 flex items-center justify-center border-r border-gray-400">
                <button
                  onClick={() => setShowRightPanel(true)}
                  className="h-full w-full text-black flex items-center justify-center hover:bg-gray-400 transition-colors"
                  style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                >
                  <span className="text-3xl font-bold tracking-widest">MENU</span>
                </button>
              </div>

              {/* 分隔线 */}
              <div className="h-px bg-gray-600"></div>

              {/* PROCESS垂直文字区域 */}
              <div className="flex-1 bg-gray-300 flex items-center justify-center border-r border-gray-400">
                <button
                  onClick={() => setShowRightPanel(true)}
                  className="h-full w-full text-black flex items-center justify-center hover:bg-gray-400 transition-colors"
                  style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                >
                  <span className="text-3xl font-bold tracking-widest">PROCESS</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 步骤选择菜单 */}
        {showStepSelectMenu && currentOrder.orderSteps && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowStepSelectMenu(false)}
          >
            <div 
              className="bg-white rounded-lg p-6 w-96 max-h-96 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-4">选择步骤</h3>
              <div className="space-y-2">
                {currentOrder.orderSteps.map((step, index) => (
                  <button
                    key={step.id}
                    onClick={() => {
                      setCurrentStepIndex(index);
                      setCurrentActionIndex(0);
                      setShowStepSelectMenu(false);
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
                  onClick={() => setShowStepSelectMenu(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* 设备连接错误弹框 */}
        {showDeviceErrorModal && deviceErrorInfo && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="text-center">
                {/* 错误图标 */}
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                
                {/* 错误标题 */}
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  设备连接失败
                </h3>
                
                {/* 错误详情 */}
                <div className="text-sm text-gray-600 space-y-2 mb-6">
                  <p><strong>动作名称:</strong> {deviceErrorInfo.actionName}</p>
                  <p><strong>设备名称:</strong> {deviceErrorInfo.deviceName}</p>
                  <p><strong>设备IP:</strong> {deviceErrorInfo.deviceIP}</p>
                  <p className="text-red-600"><strong>错误信息:</strong> {deviceErrorInfo.errorMessage}</p>
                </div>
                
                {/* 操作建议 */}
                <div className="text-xs text-gray-500 mb-6 text-left bg-gray-50 p-3 rounded">
                  <p className="font-medium mb-1">处理建议:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>检查设备电源是否正常</li>
                    <li>检查网络连接是否正常</li>
                    <li>确认设备IP地址配置正确</li>
                    <li>联系技术人员检查设备状态</li>
                  </ul>
                </div>
                
                {/* 操作按钮 */}
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowDeviceErrorModal(false);
                      setDeviceErrorInfo(null);
                      // 保持红屏状态以提醒员工
                      setIsMonitoringPLC(false); // 停止监控
                      monitoringControlRef.current.isActive = false;
                      monitoringControlRef.current.shouldStop = true;
                    }}
                    className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    关闭
                  </button>
                  <button
                    onClick={() => {
                      setShowDeviceErrorModal(false);
                      setDeviceErrorInfo(null);
                      setScreenError(false); // 清除红屏状态
                      setIsMonitoringPLC(false); // 停止当前监控
                      monitoringControlRef.current.shouldStop = true; // 停止当前监控循环
                      
                      // 重试执行 - 重新开始PLC监控
                      setTimeout(() => {
                        const currentAction = getCurrentAction();
                        if (currentAction) {
                          startPLCMonitoring(currentAction);
                        }
                      }, 100);
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    重试连接
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 扫描工单界面 - 全屏显示，保留右侧菜单
  if (showScanWorkorderScreen) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-white">
        {/* 顶部状态栏 */}
        <div className="bg-blue-500 text-white px-4 py-2 flex justify-between items-center text-sm flex-shrink-0">
          <div className="flex items-center space-x-6">
            <span>1. station: {workstationSession.workstation.workstationId}</span>
            <span>2. name: {userInfo.username}</span>
            <span>3. login date: {new Date(workstationSession.loginTime).toLocaleDateString('zh-CN')} {new Date(workstationSession.loginTime).toLocaleTimeString('zh-CN')}</span>
          </div>
          <div className="text-lg font-mono">{formatDateTime(currentTime)}</div>
        </div>

        {/* 主内容区域 */}
        <div className="flex flex-1 relative overflow-hidden">

          {/* 中间扫描区域 - 占据主要空间 */}
          <div className="flex-1 relative overflow-hidden bg-white flex flex-col items-center pt-20">
            {/* 扫描工单标题 */}
            <div className="text-center mb-8">
              <h1 className="text-6xl font-bold text-gray-800 mb-4">
                Scan Workorder to start Assembly process
              </h1>
            </div>

            {/* 输入框区域 */}
            <div className="w-full max-w-4xl px-8">
              <div className="relative">
                <input
                  type="text"
                  value={scanProductionNumber}
                  onChange={(e) => setScanProductionNumber(e.target.value)}
                  placeholder="CAR NUMBER"
                  className="w-full px-8 py-8 text-4xl text-center border-4 border-blue-300 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-500 focus:border-transparent bg-white shadow-lg"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleScanWorkorderSubmit();
                    }
                    if (e.key === 'Escape') {
                      setShowScanWorkorderScreen(false);
                      setScanProductionNumber('');
                      setScanError('');
                      setShowScanRightPanel(false);
                    }
                  }}
                  onFocus={() => setScanError('')} // 清除错误信息当用户重新输入时
                  autoFocus
                  disabled={manualInsertLoading}
                />
              </div>
              
              {/* 提示信息和错误信息 */}
              <div className="text-center mt-4">
                {scanError ? (
                  <div className="text-red-500 text-2xl font-semibold mb-2">
                    {scanError}
                  </div>
                ) : (
                  <div className="text-gray-600 text-xl">
                    <p>扫描或输入车号以开始装配流程</p>
                    <p className="text-base mt-2">按 Enter 确认 | 按 ESC 取消</p>
                  </div>
                )}
              </div>

              {/* 取消手动插入按钮 */}
              <div className="text-center mt-6">
                <button
                  onClick={() => {
                    setShowScanWorkorderScreen(false);
                    setScanProductionNumber('');
                    setScanError('');
                    setShowScanRightPanel(false);
                  }}
                  disabled={manualInsertLoading}
                  className="px-8 py-3 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white text-xl font-medium rounded-lg"
                >
                  取消手动插入
                </button>
              </div>
            </div>
          </div>

          {/* 右侧区域 - 仅MENU，默认折叠 */}
          {showScanRightPanel ? (
            /* 展开状态 - 只有MENU */
            <div 
              className="w-64 flex flex-shrink-0 bg-white"
              onClick={() => setShowScanRightPanel(false)}
            >
              {/* 左侧垂直MENU文字 */}
              <div className="w-16 flex flex-col bg-gray-300 h-full flex-shrink-0">
                {/* MENU垂直文字 */}
                <div className="h-full flex items-center justify-center border-r border-gray-400">
                  <span 
                    className="text-black text-3xl font-bold tracking-widest"
                    style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                  >
                    MENU
                  </span>
                </div>
              </div>

              {/* 右侧菜单内容区域 */}
              <div className="flex-1 flex flex-col h-full" onClick={(e) => e.stopPropagation()}>
                {/* MENU菜单内容区域 - 占满整个高度 */}
                <div className="flex-1 bg-gray-100 border border-gray-300 flex flex-col">
                  <div className="flex-1 p-2 space-y-2">
                    <button
                      onClick={handleLogout}
                      className="w-full py-6 bg-gray-200 hover:bg-gray-300 text-black text-lg font-medium border border-gray-400"
                    >
                      LOGOUT
                    </button>
                    <button
                      className="w-full py-6 bg-gray-200 hover:bg-gray-300 text-black text-lg font-medium border border-gray-400"
                    >
                      LANGUAGE
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* 收缩状态 - 只有MENU */
            <div className="w-16 flex flex-col h-full flex-shrink-0">
              {/* MENU垂直文字区域 */}
              <div className="h-full bg-gray-300 flex items-center justify-center border-r border-gray-400">
                <button
                  onClick={() => setShowScanRightPanel(true)}
                  className="h-full w-full text-black flex items-center justify-center hover:bg-gray-400 transition-colors"
                  style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                >
                  <span className="text-3xl font-bold tracking-widest">MENU</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 默认的订单列表界面
  return (
    <div className="h-screen bg-gray-100 p-4 flex flex-col">
      {/* 顶部工位信息栏 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-8">
            <h1 className="text-2xl font-bold text-gray-900">MES</h1>
            <div className="flex items-center space-x-8 text-sm text-gray-600">
              <div>1. station: {workstationSession.workstation.name}</div>
              <div>2. name: {userInfo.username}</div>
              <div>3. login date: {formatLoginTime(workstationSession.loginTime)}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-mono">{formatDateTime(currentTime)}</div>
          </div>
        </div>
      </div>

      {/* 主要内容区域 - 占据剩余空间 */}
      <div className="flex gap-4 flex-1">
        {/* 左侧订单列表 - 底部对齐 */}
        <div className="flex-1 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
          {/* 表格标题 */}
          <div className="bg-gray-50 px-6 py-4 border-b flex-shrink-0">
            <div className="grid grid-cols-5 gap-4 font-black text-gray-900 text-4xl">
              <div className="text-center">订单号</div>
              <div className="text-center">生产号</div>
              <div className="text-center">产品号</div>
              <div className="text-center">工艺</div>
              <div className="text-center">交付时间</div>
            </div>
          </div>
          
          {/* 订单列表 */}
          <div className="overflow-auto flex-1">
            {orders.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">📭</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">当前工位暂无订单</h3>
                <p className="text-gray-600 mb-4">
                  工位 <span className="font-mono bg-gray-100 px-2 py-1 rounded">{workstationSession.workstation.workstationId}</span> 
                  <span className="mx-2">({workstationSession.workstation.name})</span>
                  暂无分配的待处理订单
                </p>
                <p className="text-sm text-gray-500">
                  请联系生产计划员分配订单，或在订单管理中配置产品工艺路线
                </p>
              </div>
            ) : (
              <>
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="px-6 py-4 border-b hover:bg-gray-50 transition-colors"
                  >
                    <div className="grid grid-cols-5 gap-4 text-3xl font-bold items-center">
                      {/* 订单号 */}
                      <div className="text-center">
                        <div className="font-mono">{order.orderNumber}</div>
                      </div>
                      
                      {/* 生产号 */}
                      <div className="text-center">
                        <div className="font-mono text-blue-600">{order.productionNumber}</div>
                      </div>
                      
                      {/* 产品号 */}
                      <div className="text-center">
                        <div className="font-bold">{order.product?.productCode || order.productFamily}</div>
                      </div>
                      
                      {/* 工艺 */}
                      <div className="text-center">
                        <div className="font-bold">{order.process?.processCode || 'P1'}</div>
                      </div>
                      
                      {/* 交付时间 */}
                      <div className="text-center">
                        <div className="text-2xl">2025-01-15</div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* 右侧操作菜单 - 上对齐 */}
        <div className="flex items-start pt-4" style={{ height: 'calc(100vh - 120px)' }}>
          {/* 主要操作按钮区域 */}
          <div className="w-64 space-y-4">
            {/* START 按钮 */}
            <button
              onClick={handleStart}
              disabled={orders.length === 0 || (!orders.some(order => order.status?.toLowerCase() === 'pending') && !orders.some(order => order.status?.toLowerCase() === 'in_progress')) || isProcessing}
              className="w-full h-20 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xl font-bold rounded-lg transition-colors shadow-lg"
            >
              {isProcessing ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-2"></div>
                  启动中...
                </div>
              ) : (() => {
                // 按顺序排序找到正确的订单
                const sortedOrders = [...orders].sort((a, b) => {
                  const getOrderNumber = (orderNumber: string) => {
                    const match = orderNumber.match(/T(\d+)/);
                    return match ? parseInt(match[1]) : 0;
                  };
                  return getOrderNumber(a.orderNumber) - getOrderNumber(b.orderNumber);
                });
                
                const inProgressOrder = sortedOrders.find(order => order.status?.toLowerCase() === 'in_progress');
                if (inProgressOrder) {
                  return `开始`;
                }
                
                const pendingOrder = sortedOrders.find(order => order.status?.toLowerCase() === 'pending');
                if (pendingOrder) {
                  return `开始执行 ${pendingOrder.orderNumber}`;
                }
                
                return "暂无待执行订单";
              })()}
            </button>

            {/* ADJUST SEQUENCE 按钮 */}
            <button
              onClick={handleAdjustSequence}
              className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold rounded-lg transition-colors shadow-lg"
            >
              {t('workstation.adjustSequence')}
            </button>

            {/* MANUAL INSERT 按钮 */}
            <button
              onClick={handleManualInsert}
              className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold rounded-lg transition-colors shadow-lg"
            >
              {t('workstation.manualInsert')}
            </button>

            {/* 订单状态信息 */}
            {orders.length > 0 && (
              <div className="bg-white rounded-lg p-4 shadow-sm border">
                <h3 className="font-semibold text-gray-900 mb-2">订单概览</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">待开始:</span>
                    <span className="font-bold text-yellow-600">{orders.filter(order => order.status?.toLowerCase() === 'pending').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">进行中:</span>
                    <span className="font-bold text-green-600">{orders.filter(order => order.status?.toLowerCase() === 'in_progress').length}</span>
                  </div>
                  {(() => {
                    const nextOrder = orders.find(order => order.status?.toLowerCase() === 'pending') || orders[0];
                    return (
                      <>
                        <hr className="my-2" />
                        <div className="text-xs text-gray-500">下一个订单:</div>
                        <div>订单号: <span className="font-mono">{nextOrder.orderNumber}</span></div>
                        <div>车号: <span className="font-mono">{nextOrder.productionNumber}</span></div>
                        <div>产品: {nextOrder.productFamily}</div>
                        <div>状态: 
                          <span className={`ml-1 px-2 py-1 rounded text-xs ${
                            nextOrder.status?.toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            nextOrder.status?.toLowerCase() === 'in_progress' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {nextOrder.status?.toLowerCase() === 'pending' ? '待开始' :
                             nextOrder.status?.toLowerCase() === 'in_progress' ? '进行中' : '未知'}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* 垂直MENU按钮 - 底部对齐 */}
          <div className="w-20 ml-4" style={{ height: 'calc(100vh - 120px)' }}>
            <button
              onClick={toggleMenu}
              className="h-full w-full bg-gray-600 hover:bg-gray-700 text-white text-lg font-bold transition-colors shadow-lg flex items-center justify-center"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
              {t('workstation.menu')}
            </button>
          </div>

          {/* 可展开的菜单选项 - 上对齐 */}
          {isMenuExpanded && (
            <div className="w-48 space-y-4 ml-4 flex flex-col justify-start pt-4" style={{ height: 'calc(100vh - 120px)' }}>
              {/* LOGOUT 按钮 */}
              <button
                onClick={handleLogout}
                className="w-full h-16 bg-gray-300 hover:bg-gray-400 text-gray-800 text-lg font-bold rounded-lg transition-colors shadow-lg"
              >
                {t('workstation.logout')}
              </button>

              {/* SERVICE MODE 按钮 */}
              <button
                onClick={handleServiceMode}
                className="w-full h-16 bg-gray-300 hover:bg-gray-400 text-gray-800 text-lg font-bold rounded-lg transition-colors shadow-lg"
              >
                SERVICE MODE
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 手动插入订单对话框 */}
      {showManualInsertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{t('manualInsert.title')}</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('manualInsert.inputLabel')}
              </label>
              <input
                type="text"
                value={manualProductionNumber}
                onChange={(e) => setManualProductionNumber(e.target.value)}
                placeholder={t('manualInsert.placeholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={manualInsertLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleManualInsertSubmit();
                  }
                }}
                autoFocus
              />
              <p className="mt-2 text-sm text-gray-500">
                {t('manualInsert.description')}
              </p>
            </div>
            
            {/* 操作按钮 */}
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowManualInsertModal(false);
                  setManualProductionNumber('');
                }}
                disabled={manualInsertLoading}
                className="flex-1 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors disabled:bg-gray-400"
              >
                {t('manualInsert.cancel')}
              </button>
              <button
                onClick={handleManualInsertSubmit}
                disabled={!manualProductionNumber.trim() || manualInsertLoading}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                {manualInsertLoading ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t('manualInsert.searching')}
                  </span>
                ) : (
                  t('manualInsert.submit')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}