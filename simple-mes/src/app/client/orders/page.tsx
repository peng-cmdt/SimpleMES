"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

export default function ClientOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [workstationSession, setWorkstationSession] = useState<WorkstationSession | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // 验证会话和加载数据
  useEffect(() => {
    validateSession();
    loadOrders();
  }, []);

  // 更新时间
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
    } catch (error) {
      console.error('Session validation failed:', error);
      router.push("/client/login");
    }
  };

  const loadOrders = async () => {
    try {
      // 首先尝试从API加载真实数据
      const response = await fetch('/api/orders?status=pending&limit=20');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.orders) {
          // 按照车号(T00x)排序
          const sortedOrders = data.data.orders.sort((a: Order, b: Order) => {
            return a.productionNumber.localeCompare(b.productionNumber);
          });
          setOrders(sortedOrders);
          setIsLoading(false);
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
        orderNumber: "O1",
        productionNumber: "T001",
        customerSeq: "01",
        carNumber: "T001",
        productFamily: "V174",
        carrierId: "CARR-c0p2p3",
        status: "pending",
        priority: 1,
        product: { name: "V174产品", productCode: "V174" }
      },
      {
        id: "2", 
        orderNumber: "O2",
        productionNumber: "T002",
        customerSeq: "02",
        carNumber: "T002",
        productFamily: "V174",
        carrierId: "CARR-s1ye2v",
        status: "pending",
        priority: 2,
        product: { name: "V174产品", productCode: "V174" }
      },
      {
        id: "3",
        orderNumber: "O3",
        productionNumber: "T003",
        customerSeq: "03",
        carNumber: "T003",
        productFamily: "V174",
        carrierId: "CARR-x8m4n9",
        status: "pending",
        priority: 3,
        product: { name: "V174产品", productCode: "V174" }
      },
      {
        id: "4",
        orderNumber: "O4",
        productionNumber: "T004",
        customerSeq: "04",
        carNumber: "T004",
        productFamily: "V174",
        carrierId: "CARR-h5k7l2",
        status: "pending",
        priority: 4,
        product: { name: "V174产品", productCode: "V174" }
      }
    ];
    
    setOrders(mockOrders);
    setIsLoading(false);
  };

  const handleStart = () => {
    if (orders.length === 0) {
      alert('暂无订单可以处理');
      return;
    }
    
    // 自动选择第一个订单（按T00x排序后的第一个）
    const firstOrder = orders[0];
    
    // 跳转到工艺执行界面，传递订单ID
    router.push(`/client/workstation/execute?orderId=${firstOrder.id}`);
  };

  const handleAdjustSequence = () => {
    alert('调整序列功能 - 开发中');
  };

  const handleManualInput = () => {
    alert('手动输入功能 - 开发中');
  };

  const handleLogout = () => {
    localStorage.removeItem("clientAuth");
    localStorage.removeItem("clientUserInfo");
    localStorage.removeItem("clientInfo");
    localStorage.removeItem("workstationSession");
    router.push("/");
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('zh-CN');
  };

  if (isLoading || !workstationSession || !userInfo) {
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
    <div className="min-h-screen bg-white">
      {/* 顶部状态栏 */}
      <div className="bg-gray-100 border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          {/* 左侧信息 */}
          <div className="flex items-center space-x-8 text-sm text-gray-700">
            <div>
              <span className="font-medium">MES</span>
            </div>
            <div>
              <span>1. station: {workstationSession.workstation.workstationId}</span>
            </div>
            <div>
              <span>2. name: {userInfo.username}</span>
            </div>
            <div>
              <span>3. login date: {new Date(workstationSession.loginTime).toLocaleString('zh-CN')}</span>
            </div>
          </div>
          
          {/* 右侧时间和登出 */}
          <div className="flex items-center space-x-4">
            <span className="text-lg font-mono">
              {formatDateTime(currentTime)}
            </span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition-colors"
            >
              LOGOUT
            </button>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex flex-1">
        {/* 左侧订单列表 */}
        <div className="flex-1 p-6">
          {/* 订单表格 */}
          <div className="bg-white border border-gray-300 rounded">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 border-b border-gray-200">
                    Customer seq #
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 border-b border-gray-200">
                    Car number
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 border-b border-gray-200">
                    Product family
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 border-b border-gray-200">
                    carrier_id
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, index) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900 border-b border-gray-200">
                      {order.customerSeq}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 border-b border-gray-200">
                      {order.carNumber}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 border-b border-gray-200">
                      {order.productFamily}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 border-b border-gray-200">
                      {order.carrierId}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      暂无订单数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 右侧操作按钮 */}
        <div className="w-80 bg-gray-50 border-l border-gray-200 p-6">
          <div className="space-y-4">
            <button
              onClick={handleStart}
              disabled={orders.length === 0}
              className="w-full h-16 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-lg font-medium rounded transition-colors"
            >
              开始
            </button>
            
            <button
              onClick={handleAdjustSequence}
              className="w-full h-16 bg-blue-500 hover:bg-blue-600 text-white text-lg font-medium rounded transition-colors"
            >
              调整序列
            </button>
            
            <button
              onClick={handleManualInput}
              className="w-full h-16 bg-blue-500 hover:bg-blue-600 text-white text-lg font-medium rounded transition-colors"
            >
              手动输入
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}