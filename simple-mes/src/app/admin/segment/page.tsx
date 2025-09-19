'use client';
import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';

interface WorkstationOrder {
  id: string;
  orderId: string;
  workstationId: string;
  status: string;
  assignedAt: string;
  startedAt?: string;
  completedAt?: string;
  priority: number;
  sequence: number;
  isVisible: boolean;
  notes?: string;
  order: {
    orderNumber: string;
    productionNumber: string;
    status: string;
    product: {
      productCode: string;
      name: string;
    };
  };
  workstation: {
    workstationId: string;
    name: string;
    isOrderCompleteStation: boolean;
  };
}

interface WorkstationOverview {
  workstation: {
    id: string;
    workstationId: string;
    name: string;
    isOrderCompleteStation: boolean;
  };
  statistics: {
    pending: number;
    inProgress: number;
    completed: number;
    total: number;
  };
  orders: Array<{
    orderNumber: string;
    status: string;
    globalStatus: string;
  }>;
}

export default function OrderAllocationPage() {
  const [overview, setOverview] = useState<WorkstationOverview[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<string>('');
  const [orderAllocations, setOrderAllocations] = useState<WorkstationOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // 状态颜色映射
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'skipped': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  // 状态中文名称
  const getStatusName = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return '待处理';
      case 'in_progress': return '进行中';
      case 'completed': return '已完成';
      case 'cancelled': return '已取消';
      case 'skipped': return '已跳过';
      default: return status;
    }
  };

  // 加载系统概览
  const loadOverview = useCallback(async () => {
    try {
      const response = await fetch('/api/segment/overview');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setOverview(data.data);
        }
      }
    } catch (error) {
      console.error('加载系统概览失败:', error);
    }
  }, []);

  // 加载订单分配详情
  const loadOrderAllocations = useCallback(async (orderNumber: string) => {
    if (!orderNumber) {
      setOrderAllocations([]);
      return;
    }

    try {
      const response = await fetch(`/api/segment/order/${orderNumber}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setOrderAllocations(data.data);
        }
      }
    } catch (error) {
      console.error('加载订单分配详情失败:', error);
    }
  }, []);

  // 手动分配订单到工位
  const assignOrderToWorkstation = async (orderNumber: string, workstationId: string) => {
    try {
      const response = await fetch('/api/segment/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber,
          workstationId,
          assignedBy: 'admin'
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert('分配成功');
          setRefreshKey(prev => prev + 1);
        } else {
          alert('分配失败: ' + data.error);
        }
      }
    } catch (error) {
      console.error('分配订单失败:', error);
      alert('分配失败');
    }
  };

  // 更新工位订单状态
  const updateOrderStatus = async (orderId: string, workstationId: string, newStatus: string) => {
    try {
      const response = await fetch('/api/segment/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          workstationId,
          status: newStatus,
          updatedBy: 'admin'
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setRefreshKey(prev => prev + 1);
        } else {
          alert('状态更新失败: ' + data.error);
        }
      }
    } catch (error) {
      console.error('更新状态失败:', error);
      alert('更新失败');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await loadOverview();
      if (selectedOrder) {
        await loadOrderAllocations(selectedOrder);
      }
      setIsLoading(false);
    };

    loadData();
  }, [refreshKey, loadOverview, loadOrderAllocations, selectedOrder]);

  return (
    <AdminLayout title="订单分配监控管理">
      <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          订单分配监控管理
        </h1>
        <button
          onClick={() => setRefreshKey(prev => prev + 1)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          🔄 刷新
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-gray-600 dark:text-gray-400">正在加载...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：工位概览 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              工位订单概览
            </h2>
            
            <div className="space-y-4">
              {overview.map((item) => (
                <div key={item.workstation.id} className="border dark:border-gray-600 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {item.workstation.name} ({item.workstation.workstationId})
                      </h3>
                      {item.workstation.isOrderCompleteStation && (
                        <span className="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 px-2 py-1 rounded">
                          关闭订单工位
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      总计: {item.statistics.total}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-yellow-600">{item.statistics.pending}</div>
                      <div className="text-xs text-gray-500">待处理</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-600">{item.statistics.inProgress}</div>
                      <div className="text-xs text-gray-500">进行中</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-green-600">{item.statistics.completed}</div>
                      <div className="text-xs text-gray-500">已完成</div>
                    </div>
                  </div>

                  {item.orders.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">当前订单:</div>
                      {item.orders.slice(0, 3).map((order, idx) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <span 
                            className="text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
                            onClick={() => setSelectedOrder(order.orderNumber)}
                          >
                            {order.orderNumber}
                          </span>
                          <span className={`px-2 py-1 rounded ${getStatusColor(order.status)}`}>
                            {getStatusName(order.status)}
                          </span>
                        </div>
                      ))}
                      {item.orders.length > 3 && (
                        <div className="text-xs text-gray-500">
                          还有 {item.orders.length - 3} 个订单...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 右侧：订单分配详情 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              订单分配详情
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                选择订单:
              </label>
              <input
                type="text"
                value={selectedOrder}
                onChange={(e) => setSelectedOrder(e.target.value)}
                placeholder="输入订单号，如: T001"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            {selectedOrder && orderAllocations.length > 0 ? (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                    订单 {selectedOrder} 分配情况
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    产品: {orderAllocations[0]?.order.product.name} ({orderAllocations[0]?.order.product.productCode})
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    全局状态: <span className={`px-2 py-1 rounded text-xs ${getStatusColor(orderAllocations[0]?.order.status)}`}>
                      {getStatusName(orderAllocations[0]?.order.status)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {orderAllocations.map((allocation) => (
                    <div key={allocation.id} className="border dark:border-gray-600 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {allocation.workstation.name} ({allocation.workstation.workstationId})
                          </h4>
                          {allocation.workstation.isOrderCompleteStation && (
                            <span className="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 px-1 py-0.5 rounded">
                              关闭订单工位
                            </span>
                          )}
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(allocation.status)}`}>
                          {getStatusName(allocation.status)}
                        </span>
                      </div>

                      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                        <div>分配时间: {new Date(allocation.assignedAt).toLocaleString()}</div>
                        {allocation.startedAt && (
                          <div>开始时间: {new Date(allocation.startedAt).toLocaleString()}</div>
                        )}
                        {allocation.completedAt && (
                          <div>完成时间: {new Date(allocation.completedAt).toLocaleString()}</div>
                        )}
                        {allocation.notes && (
                          <div>备注: {allocation.notes}</div>
                        )}
                        <div>可见性: {allocation.isVisible ? '✅ 可见' : '❌ 隐藏'}</div>
                      </div>

                      {allocation.status === 'PENDING' && (
                        <div className="mt-2 flex space-x-2">
                          <button
                            onClick={() => updateOrderStatus(allocation.orderId, allocation.workstationId, 'IN_PROGRESS')}
                            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                          >
                            开始
                          </button>
                          <button
                            onClick={() => updateOrderStatus(allocation.orderId, allocation.workstationId, 'CANCELLED')}
                            className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                          >
                            取消
                          </button>
                        </div>
                      )}

                      {allocation.status === 'IN_PROGRESS' && (
                        <div className="mt-2 flex space-x-2">
                          <button
                            onClick={() => updateOrderStatus(allocation.orderId, allocation.workstationId, 'COMPLETED')}
                            className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                          >
                            完成
                          </button>
                          <button
                            onClick={() => updateOrderStatus(allocation.orderId, allocation.workstationId, 'CANCELLED')}
                            className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                          >
                            取消
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : selectedOrder ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                未找到订单 {selectedOrder} 的分配信息
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                请输入订单号查看分配详情
              </div>
            )}
          </div>
        </div>
      )}

      {/* 说明文档 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">系统说明</h3>
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <p>• <strong>自动分配</strong>：订单创建时根据产品工艺路线自动分配到相关工位</p>
          <p>• <strong>独立状态</strong>：每个工位维护独立的订单状态，互不干扰</p>
          <p>• <strong>关闭订单工位</strong>：标记为"关闭订单"的工位完成任务时，会隐藏其他工位的相同订单</p>
          <p>• <strong>状态管理</strong>：支持手动调整订单在各工位的状态</p>
        </div>
      </div>
      </div>
    </AdminLayout>
  );
}