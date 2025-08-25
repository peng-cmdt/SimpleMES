"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/layout/AdminLayout";
import { useLanguage } from "@/contexts/LanguageContext";

interface SystemOverview {
  totalOrders: number;
  activeOrders: number;
  completedOrdersToday: number;
  errorOrders: number;
  onlineWorkstations: number;
  totalWorkstations: number;
  activeDevices: number;
  totalDevices: number;
  productionRate: {
    today: number;
    yesterday: number;
    trend: 'up' | 'down' | 'stable';
  };
  recentAlerts: Array<{
    id: string;
    type: 'error' | 'warning' | 'info';
    message: string;
    workstationName?: string;
    createdAt: string;
  }>;
}

interface WorkstationStatus {
  workstationId: string;
  name: string;
  type: 'VISUAL_CLIENT' | 'SERVICE_TYPE';
  status: 'online' | 'offline' | 'error' | 'maintenance';
  currentOrder?: {
    id: string;
    orderNumber: string;
    productName: string;
    quantity: number;
    completedQuantity: number;
    progress: number;
  };
  currentStep?: {
    id: string;
    name: string;
    sequence: number;
    status: string;
    startedAt?: string;
  };
  sessionInfo?: {
    sessionId: string;
    userId?: string;
    username?: string;
    loginTime: string;
    lastActivity: string;
  };
  alerts: Array<{
    id: string;
    type: 'error' | 'warning' | 'info';
    message: string;
    createdAt: string;
  }>;
}

interface ActiveOrder {
  id: string;
  orderNumber: string;
  productName: string;
  status: string;
  currentStationName?: string;
  progress: number;
  startedAt?: string;
  priority: number;
}

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [systemOverview, setSystemOverview] = useState<SystemOverview | null>(null);
  const [workstationStatuses, setWorkstationStatuses] = useState<WorkstationStatus[]>([]);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    const adminAuth = localStorage.getItem("adminAuth");
    const userInfoStr = localStorage.getItem("adminUserInfo");
    
    if (adminAuth === "true" && userInfoStr) {
      const user = JSON.parse(userInfoStr);
      setUserInfo(user);
      setIsAuthenticated(true);
      loadDashboardData();
    } else {
      router.push("/admin/login");
    }
  }, [router]);

  // 定期刷新数据
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      loadDashboardData(false);
    }, 30000); // 每30秒刷新一次

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const loadDashboardData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    
    try {
      // 并行加载所有数据
      const [overviewRes, workstationsRes, ordersRes] = await Promise.all([
        fetch('/api/monitoring?endpoint=overview'),
        fetch('/api/monitoring?endpoint=workstations'),
        fetch('/api/monitoring?endpoint=active-orders&limit=10')
      ]);

      if (overviewRes.ok) {
        const data = await overviewRes.json();
        setSystemOverview(data.data);
      }

      if (workstationsRes.ok) {
        const data = await workstationsRes.json();
        setWorkstationStatuses(data.data);
      }

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setActiveOrders(data.data);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>;
      case 'down':
        return <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>;
      default:
        return <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'offline':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getAlertIcon = (type: 'error' | 'warning' | 'info') => {
    switch (type) {
      case 'error':
        return '🔴';
      case 'warning':
        return '🟡';
      default:
        return '🔵';
    }
  };

  if (!isAuthenticated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <AdminLayout title={t('menu.dashboard')}>
      {/* Header with refresh button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            实时监控总览
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
            最后更新: {lastUpdated.toLocaleTimeString('zh-CN')}
          </p>
        </div>
        <button
          onClick={() => loadDashboardData(true)}
          className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="text-3xl text-blue-500">📋</div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                总订单数
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {systemOverview?.totalOrders || 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                活跃: {systemOverview?.activeOrders || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="text-3xl text-green-500">🏭</div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                工位状态
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {systemOverview?.onlineWorkstations || 0}/{systemOverview?.totalWorkstations || 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                在线工位
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="text-3xl text-purple-500">⚙️</div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                设备状态
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {systemOverview?.activeDevices || 0}/{systemOverview?.totalDevices || 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                在线设备
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="text-3xl text-orange-500">📈</div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                今日产量
              </p>
              <div className="flex items-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white mr-2">
                  {systemOverview?.completedOrdersToday || 0}
                </p>
                {systemOverview?.productionRate && getTrendIcon(systemOverview.productionRate.trend)}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                昨日: {systemOverview?.productionRate?.yesterday || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 工位状态 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            工位状态总览
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {workstationStatuses.length === 0 ? (
              <p className="text-gray-500 text-center py-4">暂无工位数据</p>
            ) : (
              workstationStatuses.map((workstation) => (
                <div key={workstation.workstationId} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {workstation.name}
                      </span>
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        ({workstation.type})
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(workstation.status)}`}>
                      {workstation.status === 'online' ? '在线' : workstation.status === 'offline' ? '离线' : workstation.status === 'error' ? '错误' : '维护'}
                    </span>
                  </div>
                  
                  {workstation.currentOrder && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <div>当前订单: {workstation.currentOrder.orderNumber}</div>
                      <div>进度: {workstation.currentOrder.progress}%</div>
                    </div>
                  )}

                  {workstation.sessionInfo && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      操作员: {workstation.sessionInfo.username}
                    </div>
                  )}

                  {workstation.alerts.length > 0 && (
                    <div className="mt-2">
                      {workstation.alerts.slice(0, 2).map((alert) => (
                        <div key={alert.id} className="text-xs text-red-600 dark:text-red-400">
                          {getAlertIcon(alert.type)} {alert.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 活跃订单 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            活跃订单
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {activeOrders.length === 0 ? (
              <p className="text-gray-500 text-center py-4">暂无活跃订单</p>
            ) : (
              activeOrders.map((order) => (
                <div key={order.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {order.orderNumber}
                    </span>
                    <div className="flex items-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">
                        优先级: {order.priority}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${order.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}>
                        {order.status === 'IN_PROGRESS' ? '进行中' : order.status === 'PENDING' ? '待开始' : order.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <div>产品: {order.productName}</div>
                    {order.currentStationName && (
                      <div>当前工位: {order.currentStationName}</div>
                    )}
                    <div className="flex items-center mt-1">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${order.progress}%` }}
                        ></div>
                      </div>
                      <span className="ml-2 text-xs">{order.progress}%</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 系统告警 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            系统告警
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {!systemOverview?.recentAlerts || systemOverview.recentAlerts.length === 0 ? (
              <p className="text-gray-500 text-center py-4">暂无告警信息</p>
            ) : (
              systemOverview.recentAlerts.map((alert) => (
                <div key={alert.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                  <div className="flex items-start">
                    <span className="mr-2 text-lg">{getAlertIcon(alert.type)}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {alert.message}
                      </div>
                      {alert.workstationName && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          工位: {alert.workstationName}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(alert.createdAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}