"use client";

import React, { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useLanguage } from "@/contexts/LanguageContext";

// 类型定义
interface Product {
  id: string;
  productCode: string;
  name: string;
}

interface Process {
  id: string;
  processCode: string;
  name: string;
  version: string;
}

interface Workstation {
  id: string;
  workstationId: string;
  name: string;
  isOrderCompleteStation?: boolean;
}

interface CurrentStation {
  id: string;
  workstationId: string;
  name: string;
}

interface CurrentStep {
  id: string;
  stepCode: string;
  name: string;
  sequence: number;
}

interface WorkstationStatus {
  workstation: Workstation;
  queueStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'SKIPPED';
  assignedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  priority: number;
  sequence: number;
  isVisible: boolean;
  notes?: string | null;
  relatedSteps: RelatedStep[];
}

interface RelatedStep {
  stepId: string;
  stepCode: string;
  stepName: string;
  sequence: number;
  status: string;
  startedAt?: string | null;
  completedAt?: string | null;
  executedBy?: string | null;
  actualTime?: number | null;
  errorMessage?: string | null;
  notes?: string | null;
}

interface WorkstationStatusSummary {
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  skipped: number;
  total: number;
}

interface StepStatusSummary {
  pending: number;
  inProgress: number;
  completed: number;
  error: number;
  total: number;
}

interface ActiveWorkstation {
  workstationId: string;
  name: string;
  startedAt: string;
}

interface OrderMonitoring {
  id: string;
  orderNumber: string;
  productionNumber: string;
  quantity: number;
  completedQuantity: number;
  priority: number;
  sequence: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED' | 'CANCELLED' | 'ERROR';
  plannedDate?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  product: Product;
  process: Process;
  currentStation?: CurrentStation | null;
  currentStep?: CurrentStep | null;
  progressPercentage: number;
  activeWorkstations: ActiveWorkstation[];
  workstationStatusSummary: WorkstationStatusSummary;
  stepStatusSummary: StepStatusSummary;
  workstationStatuses: WorkstationStatus[];
}

interface OverallStatistics {
  totalOrders: number;
  statusBreakdown: {
    pending: number;
    inProgress: number;
    completed: number;
    paused: number;
    cancelled: number;
    error: number;
  };
  averageProgress: number;
}

interface MonitoringData {
  orders: OrderMonitoring[];
  statistics: OverallStatistics;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function OrderMonitoringPage() {
  const { language, t } = useLanguage();
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [workstationStatusFilter, setWorkstationStatusFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof OrderMonitoring;
    direction: 'asc' | 'desc';
  }>({
    key: 'priority',
    direction: 'asc'
  });

  // 翻译配置
  const translations = {
    zh: {
      title: "订单监测",
      refresh: "刷新",
      search: "搜索订单号/生产号",
      allStatus: "全部状态",
      allWorkstationStatus: "全部工位状态",
      allProducts: "全部产品",
      orderNumber: "订单号",
      productionNumber: "生产号",
      product: "产品",
      process: "工艺",
      status: "订单状态",
      progress: "进度",
      currentStation: "当前工位",
      activeWorkstations: "活跃工位",
      workstationProgress: "工位进度",
      actions: "操作",
      expand: "展开",
      collapse: "收起",
      viewDetails: "查看详情",
      workstation: "工位",
      workstationStatus: "工位状态",
      steps: "步骤",
      assignedAt: "分配时间",
      startedAt: "开始时间",
      completedAt: "完成时间",
      notes: "备注",
      noOrders: "暂无订单数据",
      loadingError: "加载失败",
      totalOrders: "总订单数",
      averageProgress: "平均进度",
      pending: "等待中",
      inProgress: "进行中",
      completed: "已完成",
      paused: "已暂停",
      cancelled: "已取消",
      error: "错误",
      skipped: "已跳过",
      lastUpdate: "最后更新",
      autoRefresh: "自动刷新",
      refreshInterval: "每30秒",
      quantity: "数量",
      completedQuantity: "完成数量"
    },
    en: {
      title: "Order Monitoring",
      refresh: "Refresh",
      search: "Search Order/Production Number",
      allStatus: "All Status",
      allWorkstationStatus: "All Workstation Status",
      allProducts: "All Products",
      orderNumber: "Order Number",
      productionNumber: "Production Number",
      product: "Product",
      process: "Process",
      status: "Order Status",
      progress: "Progress",
      currentStation: "Current Station",
      activeWorkstations: "Active Stations",
      workstationProgress: "Station Progress",
      actions: "Actions",
      expand: "Expand",
      collapse: "Collapse",
      viewDetails: "View Details",
      workstation: "Workstation",
      workstationStatus: "Station Status",
      steps: "Steps",
      assignedAt: "Assigned At",
      startedAt: "Started At",
      completedAt: "Completed At",
      notes: "Notes",
      noOrders: "No order data",
      loadingError: "Loading failed",
      totalOrders: "Total Orders",
      averageProgress: "Average Progress",
      pending: "Pending",
      inProgress: "In Progress",
      completed: "Completed",
      paused: "Paused",
      cancelled: "Cancelled",
      error: "Error",
      skipped: "Skipped",
      lastUpdate: "Last Update",
      autoRefresh: "Auto Refresh",
      refreshInterval: "Every 30s",
      quantity: "Quantity",
      completedQuantity: "Completed Qty"
    }
  };

  const getText = (key: string): string => {
    return translations[language][key] || key;
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    const statusColors = {
      'PENDING': 'bg-gray-100 text-gray-800',
      'IN_PROGRESS': 'bg-blue-100 text-blue-800',
      'COMPLETED': 'bg-green-100 text-green-800',
      'PAUSED': 'bg-yellow-100 text-yellow-800',
      'CANCELLED': 'bg-red-100 text-red-800',
      'ERROR': 'bg-red-100 text-red-800',
      'SKIPPED': 'bg-purple-100 text-purple-800',
      'pending': 'bg-gray-100 text-gray-800',
      'in_progress': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'paused': 'bg-yellow-100 text-yellow-800',
      'cancelled': 'bg-red-100 text-red-800',
      'error': 'bg-red-100 text-red-800',
      'skipped': 'bg-purple-100 text-purple-800'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  // 获取进度条颜色
  const getProgressColor = (percentage: number) => {
    if (percentage === 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    if (percentage >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  // 加载监测数据
  const loadMonitoringData = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20'
      });

      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (workstationStatusFilter) params.append('workstationStatus', workstationStatusFilter);
      if (productFilter) params.append('productId', productFilter);

      const response = await fetch(`/api/orders/monitoring?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch monitoring data');
      }

      const result = await response.json();
      if (result.success) {
        setMonitoringData(result.data);
      } else {
        console.error('获取监测数据失败:', result.error);
      }
    } catch (error) {
      console.error('加载监测数据失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage, searchTerm, statusFilter, workstationStatusFilter, productFilter]);

  // 加载产品列表
  const loadProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/products?limit=1000');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setProducts(result.data.products || []);
        }
      }
    } catch (error) {
      console.error('加载产品列表失败:', error);
    }
  }, []);

  // 初始化数据
  useEffect(() => {
    loadProducts();
    loadMonitoringData();
  }, [loadProducts, loadMonitoringData]);

  // 自动刷新
  useEffect(() => {
    const interval = setInterval(() => {
      loadMonitoringData(true);
    }, 30000); // 30秒刷新一次

    return () => clearInterval(interval);
  }, [loadMonitoringData]);

  // 手动刷新
  const handleRefresh = () => {
    loadMonitoringData(true);
  };

  // 搜索处理
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  // 筛选处理
  const handleFilter = (type: string, value: string) => {
    switch (type) {
      case 'status':
        setStatusFilter(value);
        break;
      case 'workstationStatus':
        setWorkstationStatusFilter(value);
        break;
      case 'product':
        setProductFilter(value);
        break;
    }
    setCurrentPage(1);
  };

  // 排序处理
  const handleSort = (key: keyof OrderMonitoring) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // 切换展开状态
  const toggleExpanded = (orderId: string) => {
    setExpandedOrder(prev => prev === orderId ? null : orderId);
  };

  // 格式化时间
  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  // 格式化持续时间
  const formatDuration = (minutes: number | null | undefined) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (loading && !monitoringData) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">加载中...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 页面标题和操作栏 */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">{getText('title')}</h1>
            <div className="flex items-center space-x-4">
              {refreshing && (
                <div className="flex items-center text-sm text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  {getText('refreshing')}
                </div>
              )}
              <div className="text-sm text-gray-500">
                {getText('autoRefresh')}: {getText('refreshInterval')}
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors"
              >
                {getText('refresh')}
              </button>
            </div>
          </div>

          {/* 统计面板 */}
          {monitoringData?.statistics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow border">
                <div className="text-sm font-medium text-gray-500">{getText('totalOrders')}</div>
                <div className="text-2xl font-bold text-gray-900">{monitoringData.statistics.totalOrders}</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow border">
                <div className="text-sm font-medium text-gray-500">{getText('averageProgress')}</div>
                <div className="text-2xl font-bold text-blue-600">{monitoringData.statistics.averageProgress}%</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow border">
                <div className="text-sm font-medium text-gray-500">{getText('inProgress')}</div>
                <div className="text-2xl font-bold text-blue-600">{monitoringData.statistics.statusBreakdown.inProgress}</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow border">
                <div className="text-sm font-medium text-gray-500">{getText('completed')}</div>
                <div className="text-2xl font-bold text-green-600">{monitoringData.statistics.statusBreakdown.completed}</div>
              </div>
            </div>
          )}

          {/* 筛选栏 */}
          <div className="bg-white p-4 rounded-lg shadow border mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <input
                  type="text"
                  placeholder={getText('search')}
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => handleFilter('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{getText('allStatus')}</option>
                  <option value="PENDING">{getText('pending')}</option>
                  <option value="IN_PROGRESS">{getText('inProgress')}</option>
                  <option value="COMPLETED">{getText('completed')}</option>
                  <option value="PAUSED">{getText('paused')}</option>
                  <option value="CANCELLED">{getText('cancelled')}</option>
                  <option value="ERROR">{getText('error')}</option>
                </select>
              </div>
              <div>
                <select
                  value={workstationStatusFilter}
                  onChange={(e) => handleFilter('workstationStatus', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{getText('allWorkstationStatus')}</option>
                  <option value="PENDING">{getText('pending')}</option>
                  <option value="IN_PROGRESS">{getText('inProgress')}</option>
                  <option value="COMPLETED">{getText('completed')}</option>
                  <option value="CANCELLED">{getText('cancelled')}</option>
                  <option value="SKIPPED">{getText('skipped')}</option>
                </select>
              </div>
              <div>
                <select
                  value={productFilter}
                  onChange={(e) => handleFilter('product', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{getText('allProducts')}</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.productCode} - {product.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 订单监测表格 */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {monitoringData?.orders && monitoringData.orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getText('orderNumber')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getText('product')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getText('status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getText('progress')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getText('currentStation')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getText('workstationProgress')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getText('actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {monitoringData.orders.map((order) => (
                    <React.Fragment key={order.id}>
                      {/* 主行 */}
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{order.orderNumber}</div>
                            <div className="text-sm text-gray-500">{order.productionNumber}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{order.product.productCode}</div>
                            <div className="text-sm text-gray-500">{order.product.name}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                            {getText(order.status.toLowerCase())}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(order.progressPercentage)}`}
                              style={{ width: `${order.progressPercentage}%` }}
                            ></div>
                          </div>
                          <div className="text-sm text-gray-600 mt-1">{order.progressPercentage}%</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {order.currentStation ? (
                            <div>
                              <div className="text-sm font-medium text-gray-900">{order.currentStation.name}</div>
                              <div className="text-sm text-gray-500">{order.currentStation.workstationId}</div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="space-y-1">
                            <div className="text-xs text-gray-500">
                              进行中: {order.workstationStatusSummary.inProgress} / 
                              已完成: {order.workstationStatusSummary.completed} / 
                              总数: {order.workstationStatusSummary.total}
                            </div>
                            {order.activeWorkstations.length > 0 && (
                              <div className="text-xs text-blue-600">
                                活跃: {order.activeWorkstations.map(w => w.name).join(', ')}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => toggleExpanded(order.id)}
                            className="text-blue-600 hover:text-blue-900 mr-2"
                          >
                            {expandedOrder === order.id ? getText('collapse') : getText('expand')}
                          </button>
                        </td>
                      </tr>

                      {/* 展开的详细信息 */}
                      {expandedOrder === order.id && (
                        <tr>
                          <td colSpan={7} className="px-6 py-4 bg-gray-50">
                            <div className="space-y-4">
                              <h4 className="text-lg font-medium text-gray-900">工位执行详情</h4>
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        {getText('workstation')}
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        {getText('workstationStatus')}
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        {getText('steps')}
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        {getText('assignedAt')}
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        {getText('startedAt')}
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        {getText('completedAt')}
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        {getText('notes')}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {order.workstationStatuses.map((ws, index) => (
                                      <tr key={index}>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          <div>
                                            <div className="text-sm font-medium text-gray-900">{ws.workstation.name}</div>
                                            <div className="text-sm text-gray-500">{ws.workstation.workstationId}</div>
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(ws.queueStatus)}`}>
                                            {getText(ws.queueStatus.toLowerCase())}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          <div className="text-sm text-gray-900">
                                            总计: {ws.relatedSteps.length} 步骤
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            完成: {ws.relatedSteps.filter(s => s.status === 'completed').length}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                          {formatDateTime(ws.assignedAt)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                          {formatDateTime(ws.startedAt)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                          {formatDateTime(ws.completedAt)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                          {ws.notes || '-'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">{getText('noOrders')}</p>
            </div>
          )}
        </div>

        {/* 分页 */}
        {monitoringData?.pagination && monitoringData.pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              显示第 {((monitoringData.pagination.page - 1) * monitoringData.pagination.limit) + 1} 到{' '}
              {Math.min(monitoringData.pagination.page * monitoringData.pagination.limit, monitoringData.pagination.total)} 条，
              共 {monitoringData.pagination.total} 条
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <span className="px-3 py-1 bg-blue-600 text-white rounded-md">
                {currentPage}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(monitoringData.pagination.totalPages, prev + 1))}
                disabled={currentPage === monitoringData.pagination.totalPages}
                className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        )}

        {/* 最后更新时间 */}
        <div className="mt-4 text-center text-sm text-gray-500">
          {getText('lastUpdate')}: {new Date().toLocaleString()}
        </div>
      </div>
    </AdminLayout>
  );
}