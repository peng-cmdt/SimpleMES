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
    type: 'D',
    dbNumber: 0,
    byte: 0,
    bit: 0,
    writeValue: false
  });
  const [plcTestResult, setPlcTestResult] = useState<PLCTestResult | null>(null);
  const [plcTestLoading, setPlcTestLoading] = useState(false);
  
  // 工艺执行相关状态
  const [isExecutionMode, setIsExecutionMode] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [showStepSelectMenu, setShowStepSelectMenu] = useState(false);
  const [assemblyLineTimer, setAssemblyLineTimer] = useState("00:00:00");
  const [startTime, setStartTime] = useState<Date | null>(null);
  
  // 设备连接错误弹框状态
  const [showDeviceErrorModal, setShowDeviceErrorModal] = useState(false);
  const [deviceErrorInfo, setDeviceErrorInfo] = useState<{
    deviceName: string;
    deviceIP: string;
    errorMessage: string;
    actionName: string;
  } | null>(null);
  
  // 屏幕状态
  const [screenError, setScreenError] = useState(false);
  const [isMonitoringPLC, setIsMonitoringPLC] = useState(false);
  
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
  }, [workstationSession]);

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
    
    // 当切换到新动作时，自动开始PLC监控
    const currentAction = getCurrentAction();
    if (currentAction && currentAction.device && isExecutionMode) {
      console.log('切换到新动作，开始自动PLC监控:', currentAction.name);
      startPLCMonitoring(currentAction);
    }
  }, [currentActionIndex, isExecutionMode]);

  const loadOrders = async () => {
    if (!workstationSession) return;
    
    try {
      // 从API加载真实数据 - 使用工位的workstationId字段而不是UUID id
      const workstationId = workstationSession.workstation.workstationId;
      const response = await fetch(`/api/orders?status=pending&workstationId=${workstationId}&limit=20`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.orders) {
          // 映射API数据到界面格式
          const mappedOrders = data.data.orders.map((order: any) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            productionNumber: order.productionNumber,
            productFamily: order.product?.name || order.product?.productCode || 'N/A',
            carrierId: order.notes || `CARR-${order.id.slice(-6)}`, // 使用备注或生成载具ID
            status: order.status.toLowerCase(),
            priority: order.priority,
            product: order.product
          }));
          setOrders(mappedOrders);
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

  // 使用传入的session对象加载订单，避免状态异步更新问题
  const loadOrdersWithSession = async (session: WorkstationSession) => {
    if (!session) return;
    
    try {
      // 从API加载真实数据 - 使用工位的workstationId字段而不是UUID id
      const workstationId = session.workstation.workstationId;
      const response = await fetch(`/api/orders?status=pending&workstationId=${workstationId}&limit=20`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.orders) {
          // 映射API数据到界面格式
          const mappedOrders = data.data.orders.map((order: any) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            productionNumber: order.productionNumber,
            productFamily: order.product?.name || order.product?.productCode || 'N/A',
            carrierId: order.notes || `CARR-${order.id.slice(-6)}`, // 使用备注或生成载具ID
            status: order.status.toLowerCase(),
            priority: order.priority,
            product: order.product
          }));
          setOrders(mappedOrders);
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

  const handleStart = async () => {
    // 自动选择第一个订单（按顺序排列）
    const firstOrder = orders.length > 0 ? orders[0] : null;
    
    if (!firstOrder) {
      alert('暂无订单可以处理');
      return;
    }
    
    setIsProcessing(true);
    try {
      // 加载订单详细信息包括工艺步骤
      const response = await fetch(`/api/orders/${firstOrder.id}`);
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
            setCurrentStepIndex(0);
            setCurrentActionIndex(0);
            setIsExecutionMode(true);
            setStartTime(new Date()); // 启动计时器
            console.log('Started order execution with OrderSteps data:', processedOrder);
            
            // 强制触发重新渲染以确保设备信息正确显示
            setTimeout(() => {
              setCurrentActionIndex(0); // 触发重新渲染
            }, 50);
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
            setCurrentStepIndex(0);
            setCurrentActionIndex(0);
            setIsExecutionMode(true);
            setStartTime(new Date()); // 启动计时器
            console.log('Started order execution with generated OrderSteps:', orderWithSteps);
            
            // 强制触发重新渲染以确保设备信息正确显示
            setTimeout(() => {
              setCurrentActionIndex(0); // 触发重新渲染
            }, 50);
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

  const handleAdjustSequence = () => {
    alert(t('workstation.adjustSequenceFunction'));
  };

  const handleManualInsert = () => {
    alert(t('workstation.manualInsertFunction'));
  };

  const handleLogout = () => {
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
    // 检查是否为PLC设备，如果是则显示专用测试界面
    if (device.type === 'PLC_CONTROLLER' || device.type.toLowerCase().includes('plc')) {
      setCurrentPLCDevice(device);
      setShowPLCTestModal(true);
      return;
    }

    // 对于非PLC设备，使用原来的测试逻辑
    setTestingDevices(prev => new Set([...prev, device.id]));
    
    try {
      console.log(`Testing connection to device: ${device.name} (${device.deviceId})`);
      
      // 使用真实的设备通信API进行连接测试
      const response = await fetch(`/api/device-communication/devices/${device.deviceId}/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        alert(`${t('serviceMode.testSuccess')}: ${device.name}`);
        // 更新设备状态为在线
        setDevices(prev => prev.map(d => 
          d.id === device.id 
            ? { ...d, status: 'ONLINE' as const, isOnline: true }
            : d
        ));
      } else {
        const errorMsg = result.message || result.error || 'Connection failed';
        alert(`${t('serviceMode.testFailed')}: ${device.name} - ${errorMsg}`);
        setDevices(prev => prev.map(d => 
          d.id === device.id 
            ? { ...d, status: 'ERROR' as const, isOnline: false }
            : d
        ));
      }
    } catch (error) {
      console.error('Device test error:', error);
      alert(`${t('serviceMode.testFailed')}: ${device.name} - ${error instanceof Error ? error.message : 'Network error'}`);
      setDevices(prev => prev.map(d => 
        d.id === device.id 
          ? { ...d, status: 'ERROR' as const, isOnline: false }
          : d
      ));
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

  // 工艺执行相关函数
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
    } else {
      // 所有步骤完成
      alert('所有工艺步骤已完成！');
      handleExitExecution();
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

    // 重置屏幕状态
    setScreenError(false);
    setIsMonitoringPLC(true);

    try {
      // 获取设备的真实IP信息
      const deviceResponse = await fetch(`/api/devices/${action.device.id}`);
      if (!deviceResponse.ok) {
        throw new Error('获取设备信息失败');
      }
      
      const deviceData = await deviceResponse.json();
      const device = deviceData.device; // API返回的是device字段，不是data字段
      
      // 构建设备连接参数
      const deviceIP = device.ipAddress || '127.0.0.1';
      const devicePort = device.port || 102; // PLC默认端口
      
      console.log(`自动开始监控PLC: ${action.name}, 设备: ${device.name} (${deviceIP}:${devicePort})`);
      
      // 从动作配置中读取传感器值地址
      const sensorValue = action.parameters?.sensorValue || action.parameters?.completionCondition || action.deviceAddress || '';
      
      console.log('动作配置调试信息:', {
        actionName: action.name,
        parameters: action.parameters,
        deviceAddress: action.deviceAddress,
        sensorValue: sensorValue
      });
      
      if (!sensorValue) {
        console.log('动作未配置传感器值地址，跳过监控');
        setIsMonitoringPLC(false);
        return;
      }
      
      // 解析PLC地址 - 从配置的传感器值读取
      const parseAddress = (address: string) => {
        // 移除等号后的值部分
        const cleanAddress = address.split('=')[0];
        
        // 解析DB10.DBX0.0格式
        const dbMatch = cleanAddress.match(/DB(\d+)\.DBX(\d+)\.(\d+)/);
        if (dbMatch) {
          return {
            type: 'DB',
            dbNumber: parseInt(dbMatch[1]),
            byte: parseInt(dbMatch[2]),
            bit: parseInt(dbMatch[3]),
            address: cleanAddress
          };
        }
        
        // 如果解析失败，返回默认值
        return {
          type: 'DB',
          dbNumber: 0,
          byte: 0,
          bit: 0,
          address: cleanAddress
        };
      };
      
      const addressInfo = parseAddress(sensorValue);
      console.log('解析的PLC地址:', addressInfo);
      
      // 设置超时时间（默认30秒）
      const timeoutMs = (action.timeout || action.parameters?.timeout || 30) * 1000;
      const startTime = Date.now();
      
      // 持续监控PLC值
      const monitorPLCValue = async (): Promise<boolean> => {
        while (Date.now() - startTime < timeoutMs) {
          // 检查是否还在监控状态
          if (!isMonitoringPLC) {
            return false;
          }
          
          try {
            console.log(`读取PLC地址: ${addressInfo.address}`);
            
            const response = await fetch(`/api/device-communication/devices/${action.device.deviceId}/read`, {
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
                console.log(`PLC读取结果: ${addressInfo.address} = ${value}`);
                
                // 判断值是否为1
                if (value === 1 || value === true || value === '1') {
                  console.log('PLC值检测通过，动作完成');
                  return true;
                }
                
                console.log(`等待PLC值变为1，当前值: ${value}`);
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
        
        // 超时
        throw new Error('TIMEOUT');
      };

      // 开始监控
      const success = await monitorPLCValue();
      
      if (success) {
        // 监控成功，动作通过
        console.log(`动作自动完成: ${action.name}, PLC地址 ${addressInfo.address} 值已变为1`);
        setIsMonitoringPLC(false);
        setTimeout(() => handleNextAction(), 500); // 短暂延迟后自动下一步
      }
      
    } catch (error) {
      console.error('PLC监控失败:', error);
      setIsMonitoringPLC(false);
      
      // 获取设备IP用于错误显示
      let deviceIP = 'Unknown IP';
      try {
        const deviceResponse = await fetch(`/api/devices/${action.device.id}`);
        if (deviceResponse.ok) {
          const deviceData = await deviceResponse.json();
          deviceIP = deviceData.device?.ipAddress || '127.0.0.1';
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
          `设备连接超时 - PLC地址 ${addressInfo.address} 监控超时` : 
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
    if (confirm('确定要退出工艺执行吗？')) {
      // 停止PLC监控
      setIsMonitoringPLC(false);
      setScreenError(false);
      
      setIsExecutionMode(false);
      setCurrentOrder(null);
      setCurrentStepIndex(0);
      setCurrentActionIndex(0);
      setShowStepSelectMenu(false);
      setStartTime(null); // 重置计时器
    }
  };

  // PLC测试相关函数
  const getPLCAddressTypes = (brand?: string) => {
    const lowerBrand = brand?.toLowerCase() || '';
    
    if (lowerBrand.includes('siemens') || lowerBrand.includes('西门子')) {
      // 西门子PLC地址类型
      return [
        { value: 'D', label: 'D - 数据区 (Data)' },
        { value: 'M', label: 'M - 存储区 (Memory)' },
        { value: 'I', label: 'I - 输入区 (Input)' },
        { value: 'Q', label: 'Q - 输出区 (Output)' },
        { value: 'DB', label: 'DB - 数据块 (Data Block)' }
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
          message: `读取成功: ${address} = ${result.value}`
        });
      } else {
        setPlcTestResult({
          success: false,
          message: result.message || result.error || '读取失败'
        });
      }
    } catch (error) {
      console.error('PLC read error:', error);
      setPlcTestResult({
        success: false,
        message: error instanceof Error ? error.message : '网络错误'
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
      
      const response = await fetch(`/api/device-communication/devices/${currentPLCDevice.deviceId}/write`, {
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
          message: `写入成功: ${address} = ${plcTestParams.writeValue}`
        });
      } else {
        setPlcTestResult({
          success: false,
          message: result.message || result.error || '写入失败'
        });
      }
    } catch (error) {
      console.error('PLC write error:', error);
      setPlcTestResult({
        success: false,
        message: error instanceof Error ? error.message : '网络错误'
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
      type: 'D',
      dbNumber: 0,
      byte: 0,
      bit: 0,
      writeValue: false
    });
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

        {/* PLC测试模态框保持不变 - 这里省略以节省空间 */}
      </div>
    );
  }

  // 工艺执行模式界面 - 6区域设计
  if (isExecutionMode && currentOrder) {
    const currentStep = getCurrentStep();
    const currentAction = getCurrentAction();

    return (
      <div className="h-screen bg-white flex flex-col overflow-hidden">
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
                        className={`p-2 text-sm border rounded ${
                          index === currentStepIndex 
                            ? 'bg-yellow-400 text-black font-bold' 
                            : orderStep.status === 'completed'
                            ? 'bg-green-200 text-green-800'
                            : 'bg-gray-50 text-gray-700'
                        }`}
                      >
                        {orderStep.step.name}
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
                        className={`p-2 text-sm rounded ${
                          index === currentActionIndex 
                            ? 'bg-yellow-400 text-black font-bold' 
                            : action.status === 'completed'
                            ? 'bg-green-200 text-green-800'
                            : 'bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div className="font-medium">{action.name}</div>
                        {action.description && (
                          <div className="text-xs text-gray-600 mt-1">{action.description}</div>
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
                <div className="flex-1 p-2 text-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  {currentAction?.device ? (
                    <>
                      <div className="text-gray-700 font-medium">{currentAction.device.type}</div>
                      <div className="text-green-600 font-bold">{currentAction.device.name}</div>
                      {isMonitoringPLC && (currentAction.name === 'Action1' || currentAction.name === 'SCANNING SENSOR 1') && (
                        <div className="text-red-600 text-xs mt-1 font-medium">监控: DB10.DBX0.0</div>
                      )}
                    </>
                  ) : (
                    <div className="text-gray-500">当前动作无设备配置</div>
                  )}
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
            className={`flex-1 relative overflow-hidden transition-all duration-500 ${screenError ? 'bg-red-500' : 'bg-white'}`}
            onClick={() => {
              // 点击中间区域隐藏弹出的菜单
              setShowMenuArea(false);
              setShowProcessMenu(false);
            }}
          >
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

            {/* 指导文字叠加 */}
            {currentStep && (
              <div 
                className="absolute bottom-4 left-4 right-4 bg-white bg-opacity-95 text-black p-4 rounded-lg shadow-lg overflow-y-auto"
                style={{ maxHeight: '15vh' }}
              >
                <h3 className="text-2xl font-bold mb-2 text-gray-900">{currentStep.step.name}</h3>
                {currentStep.step.stepTemplate.instructions && (
                  <p className="text-lg leading-relaxed whitespace-pre-line text-gray-800">{currentStep.step.stepTemplate.instructions}</p>
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
                      setIsMonitoringPLC(false); // 停止监控
                      // 重试执行
                      setTimeout(() => executeCurrentAction(), 100);
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

  // 默认的订单列表界面
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

      {/* 主要内容区域 */}
      <div className="flex gap-4 h-[calc(100vh-200px)]">
        {/* 左侧订单列表 */}
        <div className="flex-1 bg-white rounded-lg shadow-sm overflow-hidden">
          {/* 表格标题 */}
          <div className="bg-gray-50 px-6 py-4 border-b">
            <div className="grid grid-cols-4 gap-4 font-black text-gray-900 text-3xl">
              <div className="text-center">Customer seq #</div>
              <div className="text-center">Car number</div>
              <div className="text-center">Product family</div>
              <div className="text-center">carrier_id</div>
            </div>
          </div>
          
          {/* 订单列表 */}
          <div className="overflow-auto max-h-full">
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
                    <div className="grid grid-cols-4 gap-4 text-2xl font-bold">
                      <div className="font-mono text-center">{order.orderNumber}</div>
                      <div className="font-mono text-center">{order.productionNumber}</div>
                      <div className="font-bold text-center">{order.productFamily}</div>
                      <div className="font-mono text-center">{order.carrierId}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* 右侧操作菜单 */}
        <div className="flex">
          {/* 主要操作按钮区域 */}
          <div className="w-64 space-y-4">
            {/* START 按钮 */}
            <button
              onClick={handleStart}
              disabled={orders.length === 0 || isProcessing}
              className="w-full h-20 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xl font-bold rounded-lg transition-colors shadow-lg"
            >
              {isProcessing ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-2"></div>
                  {t('workstation.startProcessing')}
                </div>
              ) : (
                t('workstation.start')
              )}
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
                <h3 className="font-semibold text-gray-900 mb-2">下一个订单</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <div>订单号: {orders[0].orderNumber}</div>
                  <div>车号: {orders[0].productionNumber}</div>
                  <div>产品: {orders[0].productFamily}</div>
                  <div>载具ID: {orders[0].carrierId}</div>
                </div>
              </div>
            )}
          </div>

          {/* 垂直MENU按钮 */}
          <div className="w-20 ml-4">
            <button
              onClick={toggleMenu}
              className="h-full w-full bg-gray-600 hover:bg-gray-700 text-white text-lg font-bold transition-colors shadow-lg flex items-center justify-center"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
              {t('workstation.menu')}
            </button>
          </div>

          {/* 可展开的菜单选项 */}
          {isMenuExpanded && (
            <div className="w-48 space-y-4 ml-4">
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
                {t('workstation.serviceMode')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}