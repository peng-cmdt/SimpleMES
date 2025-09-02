"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useLanguage } from "@/contexts/LanguageContext";

interface Product {
  id: string;
  productCode: string;
  name: string;
}

interface BOM {
  id: string;
  bomCode: string;
  name: string;
  version: string;
  status: string;
  description?: string;
  createdAt: string;
  bomItems?: BOMItem[];
}

interface BOMItem {
  id: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  description?: string;
}

interface Part {
  id: string;
  name: string;
  partNumber: string;
  sapDescription: string;
}

interface Process {
  id: string;
  processCode: string;
  name: string;
  version: string;
}

interface Order {
  id: string;
  orderNumber: string;
  productionNumber: string;
  productId: string;
  bomId: string | null;
  processId: string;
  quantity: number;
  priority: number;
  status: string;
  plannedDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  product: Product;
  bom: BOM | null;
  process: Process;
  _count: {
    orderSteps: number;
  };
}

interface OrderFormData {
  orderNumber: string;
  productionNumber: string;
  productId: string;
  processId: string;
  quantity: number;
  priority: number;
  plannedDate: string;
  notes: string;
}

const orderStatuses = [
  { value: 'PENDING', label: '待开始', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' },
  { value: 'IN_PROGRESS', label: '进行中', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { value: 'COMPLETED', label: '已完成', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { value: 'PAUSED', label: '已暂停', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  { value: 'CANCELLED', label: '已取消', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  { value: 'ERROR', label: '错误状态', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' }
];

// BOM Items component for displaying order's BOM items
function BOMItemsForOrder({ order, onEditPart, refreshTrigger }: { 
  order: Order, 
  onEditPart: (order: Order, item: any) => void,
  refreshTrigger?: number 
}) {
  const [bomItems, setBomItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadBomItems = useCallback(async () => {
    if (!order.bomId) {
      setBomItems([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/orders/${order.id}/parts`);
      if (response.ok) {
        const data = await response.json();
        setBomItems(data.data.bomItems || []);
        console.log('Loaded BOM items for order:', order.id, data.data.bomItems?.length || 0, 'items');
      }
    } catch (error) {
      console.error('Failed to load BOM items:', error);
    } finally {
      setIsLoading(false);
    }
  }, [order.id, order.bomId]);

  useEffect(() => {
    loadBomItems();
  }, [loadBomItems, refreshTrigger]); // 添加refreshTrigger依赖

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">加载BOM项...</span>
      </div>
    );
  }

  if (bomItems.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <div className="flex flex-col items-center">
          <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>当前订单暂无BOM项</p>
          <p className="text-xs mt-1">点击上方"添加BOM"按钮添加零件</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              零件编号
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              零件名称
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              数量
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              单位
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              描述
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              创建时间
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {bomItems.map((item: any) => (
            <tr 
              key={item.id} 
              className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" 
              onDoubleClick={() => onEditPart(order, item)}
              title="双击编辑此零件"
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-600 dark:text-blue-400">
                {item.itemCode}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                {item.itemName}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                {item.quantity}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                {item.unit}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300 max-w-xs">
                <div className="truncate" title={item.description || ''}>
                  {item.description || '-'}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                {new Date(item.createdAt).toLocaleDateString('zh-CN')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [boms, setBoms] = useState<BOM[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [formData, setFormData] = useState<OrderFormData>({
    orderNumber: '',
    productionNumber: '',
    productId: '',
    processId: '',
    quantity: 1,
    priority: 0,
    plannedDate: '',
    notes: ''
  });
  const [error, setError] = useState('');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [activeOrderTabs, setActiveOrderTabs] = useState<{[key: string]: 'info' | 'bom'}>({});
  const [orderBOMData, setOrderBOMData] = useState<{[key: string]: BOMItem[]}>({});
  const [editingBOMOrder, setEditingBOMOrder] = useState<Order | null>(null);
  const [editingBOMItem, setEditingBOMItem] = useState<BOMItem | null>(null);
  const [showBOMEditModal, setShowBOMEditModal] = useState(false);
  const [bomItemFormData, setBomItemFormData] = useState<{
    itemCode: string;
    itemName: string;
    quantity: number;
    unit: string;
    description: string;
  }>({
    itemCode: '',
    itemName: '',
    quantity: 1,
    unit: '个',
    description: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BOMItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // 搜索筛选状态
  const [searchFilters, setSearchFilters] = useState({
    productionNumber: '',
    orderNumber: '',
    productCode: '',
    processCode: ''
  });
  
  // 展开订单编辑表单的状态
  const [expandedOrderFormData, setExpandedOrderFormData] = useState<{[key: string]: OrderFormData}>({});
  
  // BOM选项卡搜索状态
  const [bomSearchFilters, setBomSearchFilters] = useState<{[key: string]: {
    name: string;
    number: string;
    sapDescription: string;
  }}>({});
  const [partsData, setPartsData] = useState<Part[]>([]);
  const [filteredParts, setFilteredParts] = useState<{[key: string]: Part[]}>({});
  
  // BOM选择相关状态
  const [showBomSelectModal, setShowBomSelectModal] = useState(false);
  const [selectedOrderForBom, setSelectedOrderForBom] = useState<Order | null>(null);
  const [availableBoms, setAvailableBoms] = useState<BOM[]>([]);
  const [isLoadingBoms, setIsLoadingBoms] = useState(false);
  
  // 添加零件相关状态
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [partSearchQuery, setPartSearchQuery] = useState('');
  const [partSearchResults, setPartSearchResults] = useState<Part[]>([]);
  const [showPartSuggestions, setShowPartSuggestions] = useState(false);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [partQuantity, setPartQuantity] = useState(1);
  const [isSearchingParts, setIsSearchingParts] = useState(false);
  
  // 编辑零件相关状态
  const [showEditPartModal, setShowEditPartModal] = useState(false);
  const [editingOrderForPart, setEditingOrderForPart] = useState<Order | null>(null);
  const [editingBomItem, setEditingBomItem] = useState<any>(null);
  const [editPartQuantity, setEditPartQuantity] = useState(1);
  
  // BOM数据刷新触发器
  const [bomRefreshTrigger, setBomRefreshTrigger] = useState<{[orderId: string]: number}>({});
  
  // BOM模态框零部件搜索状态
  const [bomModalSearchType, setBomModalSearchType] = useState<'bom-items' | 'parts'>('bom-items'); // 搜索类型切换
  const [bomModalPartQuery, setBomModalPartQuery] = useState('');
  const [bomModalPartResults, setBomModalPartResults] = useState<Part[]>([]);
  const [bomModalShowPartResults, setBomModalShowPartResults] = useState(false);
  const [bomModalSearchingParts, setBomModalSearchingParts] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bomModalPartSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { t } = useLanguage();

  // 触发特定订单的BOM数据刷新
  const triggerBomRefresh = (orderId: string) => {
    setBomRefreshTrigger(prev => ({
      ...prev,
      [orderId]: Date.now()
    }));
  };

  useEffect(() => {
    loadOrders();
    loadProducts();
    loadPartsData();
  }, []);

  useEffect(() => {
    if (formData.productId) {
      loadProcessesByProduct(formData.productId);
    }
  }, [formData.productId]);

  // 搜索筛选逻辑
  useEffect(() => {
    let filtered = [...orders];
    
    if (searchFilters.productionNumber) {
      filtered = filtered.filter(order =>
        order.productionNumber.toLowerCase().includes(searchFilters.productionNumber.toLowerCase())
      );
    }
    
    if (searchFilters.orderNumber) {
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(searchFilters.orderNumber.toLowerCase())
      );
    }
    
    if (searchFilters.productCode) {
      filtered = filtered.filter(order =>
        order.product.productCode.toLowerCase().includes(searchFilters.productCode.toLowerCase())
      );
    }
    
    if (searchFilters.processCode) {
      filtered = filtered.filter(order =>
        order.process.processCode.toLowerCase().includes(searchFilters.processCode.toLowerCase())
      );
    }
    
    setFilteredOrders(filtered);
  }, [orders, searchFilters]);

  // 实时刷新订单列表 - 每15秒刷新一次
  useEffect(() => {
    const orderRefreshInterval = setInterval(() => {
      console.log('Admin: Auto-refreshing order list...');
      loadOrders();
    }, 15000); // 每15秒刷新一次
    
    return () => clearInterval(orderRefreshInterval);
  }, []);

  useEffect(() => {
    // 当零件数据加载完成后，为所有展开的订单初始化过滤数据
    if (partsData.length > 0) {
      expandedOrders.forEach(orderId => {
        if (!filteredParts[orderId]) {
          setFilteredParts(prev => ({ ...prev, [orderId]: partsData }));
        }
      });
    }
  }, [partsData, expandedOrders]);

  const loadOrders = async () => {
    try {
      const response = await fetch('/api/orders');
      if (response.ok) {
        const data = await response.json();
        setOrders(data.data.orders);
        setFilteredOrders(data.data.orders); // 初始化过滤后的订单
      }
    } catch (error) {
      console.error('Load orders error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await fetch('/api/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data.data.products);
      }
    } catch (error) {
      console.error('Load products error:', error);
    }
  };

  const loadBOMsByProduct = async (productId: string) => {
    try {
      const response = await fetch(`/api/boms?productId=${productId}`);
      if (response.ok) {
        const data = await response.json();
        setBoms(data.data.boms);
      }
    } catch (error) {
      console.error('Load BOMs error:', error);
    }
  };

  const loadProcessesByProduct = async (productId: string) => {
    console.log('开始加载产品工艺流程:', productId);
    try {
      const response = await fetch(`/api/processes?productId=${productId}`);
      console.log('工艺流程API响应状态:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('工艺流程API响应数据:', data);
        const processesData = data.data?.processes || [];
        console.log('设置工艺流程选项:', processesData.length, '个');
        setProcesses(processesData);
      } else {
        console.error('加载工艺流程失败，状态码:', response.status);
        setProcesses([]);
      }
    } catch (error) {
      console.error('加载工艺流程错误:', error);
      setProcesses([]);
    }
  };

  const loadPartsData = async () => {
    try {
      const response = await fetch('/api/bom-items?limit=100');
      if (response.ok) {
        const data = await response.json();
        // 将BOM项数据转换为零件数据格式
        const bomItems = data.data?.bomItems || [];
        const partsFromBomItems = bomItems.map((item: any) => ({
          id: item.id,
          name: item.itemName,
          partNumber: item.itemCode,
          sapDescription: item.description || item.itemName
        }));
        setPartsData(partsFromBomItems);
        console.log('Loaded parts from BOM items:', partsFromBomItems.length, 'items');
      }
    } catch (error) {
      console.error('Load parts error:', error);
      setPartsData([]);
    }
  };

  const filterPartsForOrder = (orderId: string) => {
    const filters = bomSearchFilters[orderId];
    if (!filters) {
      setFilteredParts(prev => ({ ...prev, [orderId]: partsData }));
      return;
    }

    const filtered = partsData.filter(part => {
      const nameMatch = !filters.name || part.name.toLowerCase().includes(filters.name.toLowerCase());
      const numberMatch = !filters.number || part.partNumber.toLowerCase().includes(filters.number.toLowerCase());
      const descriptionMatch = !filters.sapDescription || part.sapDescription.toLowerCase().includes(filters.sapDescription.toLowerCase());
      return nameMatch && numberMatch && descriptionMatch;
    });

    setFilteredParts(prev => ({ ...prev, [orderId]: filtered }));
  };

  const handleBomSearchChange = (orderId: string, field: string, value: string) => {
    setBomSearchFilters(prev => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [field]: value
      }
    }));
    
    // 延迟搜索以提高性能
    setTimeout(() => {
      filterPartsForOrder(orderId);
    }, 300);
  };

  const loadAvailableBoms = async (productId?: string) => {
    setIsLoadingBoms(true);
    try {
      const url = productId ? `/api/boms?productId=${productId}` : '/api/boms';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setAvailableBoms(data.data?.boms || []);
      }
    } catch (error) {
      console.error('Failed to load BOMs:', error);
    } finally {
      setIsLoadingBoms(false);
    }
  };

  const handleAddBomToOrder = (order: Order) => {
    setSelectedOrderForBom(order);
    setShowAddPartModal(true);
    setPartSearchQuery(''); // 清空搜索框
    setSelectedPart(null);
    setPartQuantity(1);
    setPartSearchResults([]);
    setShowPartSuggestions(false);
    setIsSearchingParts(false); // 重置搜索状态
  };

  // 搜索零件
  const searchParts = async (query: string) => {
    if (!query || query.length < 2) {
      setPartSearchResults([]);
      setShowPartSuggestions(false);
      setIsSearchingParts(false);
      return;
    }

    setIsSearchingParts(true);
    try {
      // 直接从Parts API搜索零部件
      const response = await fetch(`/api/parts?search=${encodeURIComponent(query)}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        const parts = data.data?.parts || [];
        setPartSearchResults(parts);
        setShowPartSuggestions(true);
      } else {
        console.error('Parts search API failed');
        setPartSearchResults([]);
        setShowPartSuggestions(false);
      }
    } catch (error) {
      console.error('Failed to search parts:', error);
      setPartSearchResults([]);
      setShowPartSuggestions(false);
    } finally {
      setIsSearchingParts(false);
    }
  };

  // 处理零件搜索输入
  const handlePartSearchChange = (query: string) => {
    setPartSearchQuery(query);
    
    // 清除之前的timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // 延迟搜索以提高性能
    searchTimeoutRef.current = setTimeout(() => {
      searchParts(query);
    }, 300);
  };

  // 选择零件
  const handleSelectPart = (part: Part) => {
    setSelectedPart(part);
    setPartSearchQuery(`${part.partNumber} - ${part.name}`); // 显示零部件号和名称
    setShowPartSuggestions(false);
  };

  // 保存零件到订单BOM
  const handleSavePartToOrder = async () => {
    if (!selectedOrderForBom || !selectedPart || partQuantity <= 0) {
      alert('请选择零件并输入有效数量');
      return;
    }

    try {
      const response = await fetch(`/api/orders/${selectedOrderForBom.id}/parts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partId: selectedPart.id,
          partName: selectedPart.name,
          partNumber: selectedPart.partNumber,
          quantity: partQuantity,
          sapDescription: selectedPart.sapDescription
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // 立即触发BOM数据刷新
        triggerBomRefresh(selectedOrderForBom.id);
        await loadOrders();
        setLastUpdated(new Date());
        setShowAddPartModal(false);
        setSelectedOrderForBom(null);
        setPartSearchQuery('');
        setSelectedPart(null);
        setPartQuantity(1);
        setPartSearchResults([]);
        setShowPartSuggestions(false);
        alert(data.message || '零件添加成功');
      } else {
        alert(data.error || '添加零件失败');
      }
    } catch (error) {
      console.error('Save part error:', error);
      alert('网络错误，请重试');
    }
  };

  // 编辑零件
  const handleEditPart = async (order: Order, bomItem: any) => {
    setEditingOrderForPart(order);
    setEditingBomItem(bomItem);
    setEditPartQuantity(bomItem.quantity);
    setShowEditPartModal(true);
  };

  // 更新零件数量
  const handleUpdatePartQuantity = async () => {
    if (!editingOrderForPart || !editingBomItem || editPartQuantity <= 0) {
      alert('请输入有效数量');
      return;
    }

    try {
      const response = await fetch(`/api/orders/${editingOrderForPart.id}/parts`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bomItemId: editingBomItem.id,
          quantity: editPartQuantity
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // 立即触发BOM数据刷新
        triggerBomRefresh(editingOrderForPart.id);
        await loadOrders();
        setLastUpdated(new Date());
        setShowEditPartModal(false);
        setEditingOrderForPart(null);
        setEditingBomItem(null);
        setEditPartQuantity(1);
        alert(data.message || '零件数量更新成功');
      } else {
        alert(data.error || '更新失败');
      }
    } catch (error) {
      console.error('Update part error:', error);
      alert('网络错误，请重试');
    }
  };

  // 删除零件
  const handleDeletePart = async () => {
    if (!editingOrderForPart || !editingBomItem) {
      return;
    }

    if (!confirm('确定要删除这个零件吗？')) {
      return;
    }

    try {
      const response = await fetch(`/api/orders/${editingOrderForPart.id}/parts?bomItemId=${editingBomItem.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        // 立即触发BOM数据刷新
        triggerBomRefresh(editingOrderForPart.id);
        await loadOrders();
        setLastUpdated(new Date());
        setShowEditPartModal(false);
        setEditingOrderForPart(null);
        setEditingBomItem(null);
        setEditPartQuantity(1);
        alert(data.message || '零件删除成功');
      } else {
        alert(data.error || '删除失败');
      }
    } catch (error) {
      console.error('Delete part error:', error);
      alert('网络错误，请重试');
    }
  };

  // 获取订单的BOM项
  const getOrderBomItems = async (orderId: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/parts`);
      if (response.ok) {
        const data = await response.json();
        return data.data.bomItems || [];
      }
    } catch (error) {
      console.error('Failed to load order BOM items:', error);
    }
    return [];
  };

  const handleBomSelection = async (bomId: string) => {
    if (!selectedOrderForBom) return;

    try {
      const response = await fetch(`/api/orders/${selectedOrderForBom.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bomId: bomId
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await loadOrders();
        setLastUpdated(new Date());
        setShowBomSelectModal(false);
        setSelectedOrderForBom(null);
      } else {
        alert(data.error || '关联BOM失败');
      }
    } catch (error) {
      alert('网络错误');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const url = editingOrder ? `/api/orders/${editingOrder.id}` : '/api/orders';
      const method = editingOrder ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          plannedDate: formData.plannedDate || null
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await loadOrders();
        setShowModal(false);
        resetForm();
        setLastUpdated(new Date());
      } else {
        setError(data.error || '操作失败');
      }
    } catch (error) {
      setError('网络错误');
    }
  };

  const handleDelete = async (order: Order) => {
    if (!confirm(`确定要删除订单 "${order.orderNumber}"吗？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadOrders();
        setLastUpdated(new Date());
      } else {
        const data = await response.json();
        alert(data.error || '删除失败');
      }
    } catch (error) {
      alert('网络错误');
    }
  };

  const handleStatusChange = async (order: Order, newStatus: string) => {
    const statusLabels = {
      'PENDING': '待开始',
      'IN_PROGRESS': '进行中', 
      'COMPLETED': '已完成',
      'PAUSED': '已暂停',
      'CANCELLED': '已取消'
    };

    const currentLabel = statusLabels[order.status as keyof typeof statusLabels] || order.status;
    const newLabel = statusLabels[newStatus as keyof typeof statusLabels] || newStatus;

    if (!confirm(`确定要将订单 "${order.orderNumber}" 的状态从"${currentLabel}"变更为"${newLabel}"吗？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'changeStatus',
          status: newStatus,
          updatedBy: 'admin',
          reason: `管理员手动变更状态：${currentLabel} -> ${newLabel}`
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await loadOrders();
        setLastUpdated(new Date());
        // 显示成功消息
        alert(data.message || '订单状态变更成功');
      } else {
        alert(data.error || '状态变更失败');
      }
    } catch (error) {
      alert('网络错误');
    }
  };

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
    setFormData({
      orderNumber: order.orderNumber,
      productionNumber: order.productionNumber,
      productId: order.productId,
      processId: order.processId,
      quantity: order.quantity,
      priority: order.priority,
      plannedDate: order.plannedDate ? new Date(order.plannedDate).toISOString().split('T')[0] : '',
      notes: order.notes || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingOrder(null);
    setFormData({
      orderNumber: '',
      productionNumber: '',
      productId: '',
      processId: '',
      quantity: 1,
      priority: 0,
      plannedDate: '',
      notes: ''
    });
    setBoms([]);
    setProcesses([]);
    setError('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSelectedFile(file || null);
    setImportError('');
    setImportSuccess('');
  };

  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/orders/excel-template');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'order_import_template.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('下载模板失败');
      }
    } catch (error) {
      alert('下载模板失败');
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setImportError('请选择要导入的Excel文件');
      return;
    }

    setIsImporting(true);
    setImportError('');
    setImportSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/orders/import-excel', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setImportSuccess(data.message);
        if (data.data.errors.length > 0) {
          setImportError(`部分数据导入失败：\n${data.data.errors.slice(0, 5).join('\n')}${data.data.errors.length > 5 ? '\n...' : ''}`);
        }
        await loadOrders();
        setLastUpdated(new Date());
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setImportError(data.error || '导入失败');
      }
    } catch (error) {
      setImportError('网络错误');
    } finally {
      setIsImporting(false);
    }
  };

  const getStatusConfig = (status: string) => {
    return orderStatuses.find(s => s.value === status) || orderStatuses[0];
  };

  const canDelete = (order: Order) => {
    return order.status === 'PENDING' || order.status === 'CANCELLED';
  };

  const canEdit = (order: Order) => {
    return order.status !== 'COMPLETED';
  };

  const handleViewProgress = async (order: Order) => {
    try {
      const response = await fetch(`/api/orders/${order.id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedOrder(data.data.order);
        setShowProgressModal(true);
      }
    } catch (error) {
      console.error('Failed to load order details:', error);
    }
  };

  const getStepStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'pending':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStepStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'in_progress':
        return '进行中';
      case 'pending':
        return '待开始';
      case 'failed':
        return '失败';
      default:
        return status;
    }
  };

  const calculateProgress = (order: Order) => {
    if (!order.orderSteps || order.orderSteps.length === 0) return 0;
    const completedSteps = order.orderSteps.filter(step => step.status === 'completed').length;
    return Math.round((completedSteps / order.orderSteps.length) * 100);
  };

  const toggleOrderExpansion = async (order: Order) => {
    // 单一展开逻辑：清空所有展开状态，只展开当前点击的订单（如果未展开）
    const newExpandedOrders = new Set<string>();
    
    if (expandedOrders.has(order.id)) {
      // 如果点击已展开的订单，则折叠它（newExpandedOrders保持为空）
      console.log('折叠订单:', order.orderNumber);
    } else {
      // 展开新订单，折叠所有其他订单
      console.log('展开订单:', order.orderNumber, '产品ID:', order.productId);
      newExpandedOrders.add(order.id);
      
      // 清空所有选项卡状态，只保留当前订单
      setActiveOrderTabs({
        [order.id]: 'info'
      });
      
      // 清空所有表单数据，只保留当前订单
      setExpandedOrderFormData({
        [order.id]: {
          orderNumber: order.orderNumber,
          productionNumber: order.productionNumber,
          productId: order.productId,
          processId: order.processId,
          quantity: order.quantity,
          priority: order.priority,
          plannedDate: order.plannedDate ? new Date(order.plannedDate).toISOString().split('T')[0] : '',
          notes: order.notes || ''
        }
      });
      
      // 如果有产品ID，立即加载对应的工艺流程
      if (order.productId) {
        console.log('自动加载产品的工艺流程:', order.productId);
        await loadProcessesByProduct(order.productId);
      } else {
        console.log('订单没有关联产品，清空工艺流程选项');
        setProcesses([]);
      }
      
      // 清空所有BOM搜索过滤器，只保留当前订单
      setBomSearchFilters({
        [order.id]: {
          name: '',
          number: '',
          sapDescription: ''
        }
      });
      
      // 初始化零件过滤数据
      if (partsData.length > 0) {
        setFilteredParts({ [order.id]: partsData });
      }
      
      // 预加载BOM数据
      if (!orderBOMData[order.id] && order.bomId) {
        try {
          const response = await fetch(`/api/boms/${order.bomId}/items`);
          if (response.ok) {
            const data = await response.json();
            setOrderBOMData(prev => ({
              ...prev,
              [order.id]: data.bomItems || []
            }));
          }
        } catch (error) {
          console.error('Failed to load BOM data:', error);
        }
      }
    }
    
    setExpandedOrders(newExpandedOrders);
  };

  const setOrderTab = (orderId: string, tab: 'info' | 'bom') => {
    setActiveOrderTabs(prev => ({
      ...prev,
      [orderId]: tab
    }));
  };

  // 处理展开订单表单提交
  const handleExpandedOrderSubmit = async (orderId: string, e: React.FormEvent) => {
    e.preventDefault();
    const orderFormData = expandedOrderFormData[orderId];
    if (!orderFormData) return;

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...orderFormData,
          plannedDate: orderFormData.plannedDate || null
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await loadOrders();
        setLastUpdated(new Date());
        // 可以显示成功消息
      } else {
        alert(data.error || '保存失败');
      }
    } catch (error) {
      alert('网络错误');
    }
  };

  // 更新展开订单表单数据
  const updateExpandedOrderFormData = (orderId: string, field: string, value: any) => {
    setExpandedOrderFormData(prev => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [field]: value
      }
    }));
  };

  // BOM编辑相关函数
  const handleAddBOMItem = (order: Order) => {
    setEditingBOMOrder(order);
    setEditingBOMItem(null);
    resetBOMForm();
    setShowBOMEditModal(true);
  };

  const handleEditBOMItem = (order: Order, item: BOMItem) => {
    setEditingBOMOrder(order);
    setEditingBOMItem(item);
    setBomItemFormData({
      itemCode: item.itemCode,
      itemName: item.itemName,
      quantity: item.quantity,
      unit: item.unit,
      description: item.description || ''
    });
    setShowBOMEditModal(true);
  };

  const handleDeleteBOMItem = async (order: Order, item: BOMItem) => {
    if (!confirm(`确定要删除物料 "${item.itemName}" 吗？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/bom-items/${item.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // 更新本地BOM数据
        setOrderBOMData(prev => ({
          ...prev,
          [order.id]: prev[order.id]?.filter(bomItem => bomItem.id !== item.id) || []
        }));
        setLastUpdated(new Date());
      } else {
        const data = await response.json();
        alert(data.error || '删除失败');
      }
    } catch (error) {
      alert('网络错误');
    }
  };

  const handleBOMItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBOMOrder || !editingBOMOrder.bomId) return;

    try {
      const url = editingBOMItem 
        ? `/api/bom-items/${editingBOMItem.id}` 
        : `/api/bom-items`;
      const method = editingBOMItem ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bomId: editingBOMOrder.bomId,
          ...bomItemFormData
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // 重新加载该订单的BOM数据
        const bomResponse = await fetch(`/api/boms/${editingBOMOrder.bomId}/items`);
        if (bomResponse.ok) {
          const bomData = await bomResponse.json();
          setOrderBOMData(prev => ({
            ...prev,
            [editingBOMOrder.id]: bomData.bomItems || []
          }));
        }
        
        setShowBOMEditModal(false);
        setLastUpdated(new Date());
      } else {
        alert(data.error || '操作失败');
      }
    } catch (error) {
      alert('网络错误');
    }
  };

  // 搜索物料功能
  const searchBOMItems = async (query: string) => {
    if (query.trim().length < 1) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/bom-items/search?q=${encodeURIComponent(query)}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.items || []);
        setShowSearchResults(true);
      } else {
        console.error('Search failed');
        setSearchResults([]);
        setShowSearchResults(false);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setIsSearching(false);
    }
  };

  // BOM模态框零部件搜索功能
  const searchBomModalParts = async (query: string) => {
    if (!query || query.length < 2) {
      setBomModalPartResults([]);
      setBomModalShowPartResults(false);
      setBomModalSearchingParts(false);
      return;
    }

    setBomModalSearchingParts(true);
    try {
      const response = await fetch(`/api/parts?search=${encodeURIComponent(query)}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setBomModalPartResults(data.data?.parts || []);
        setBomModalShowPartResults(true);
      } else {
        console.error('Parts search failed');
        setBomModalPartResults([]);
        setBomModalShowPartResults(false);
      }
    } catch (error) {
      console.error('Parts search error:', error);
      setBomModalPartResults([]);
      setBomModalShowPartResults(false);
    } finally {
      setBomModalSearchingParts(false);
    }
  };

  // 处理BOM模态框零部件搜索输入
  const handleBomModalPartSearchChange = (query: string) => {
    setBomModalPartQuery(query);
    
    // 清除之前的timeout
    if (bomModalPartSearchTimeoutRef.current) {
      clearTimeout(bomModalPartSearchTimeoutRef.current);
    }
    
    // 延迟搜索以提高性能
    bomModalPartSearchTimeoutRef.current = setTimeout(() => {
      searchBomModalParts(query);
    }, 300);
  };

  // 在BOM模态框中选择零部件
  const handleBomModalSelectPart = (part: Part) => {
    setBomItemFormData({
      itemCode: part.partNumber,
      itemName: part.name,
      quantity: 1,
      unit: '个',
      description: part.sapDescription || ''
    });
    setBomModalPartQuery('');
    setBomModalShowPartResults(false);
    setBomModalPartResults([]);
  };

  const handleSearchInputChange = (value: string) => {
    setSearchQuery(value);
    // 延迟搜索，避免频繁请求
    setTimeout(() => {
      if (value === searchQuery) {
        searchBOMItems(value);
      }
    }, 300);
  };

  const selectSearchResult = (item: BOMItem) => {
    setBomItemFormData({
      itemCode: item.itemCode,
      itemName: item.itemName,
      quantity: item.quantity,
      unit: item.unit,
      description: item.description || ''
    });
    setSearchQuery('');
    setShowSearchResults(false);
    setSearchResults([]);
  };

  const resetBOMForm = () => {
    setBomItemFormData({
      itemCode: '',
      itemName: '',
      quantity: 1,
      unit: '个',
      description: ''
    });
    setSearchQuery('');
    setShowSearchResults(false);
    setSearchResults([]);
    // 重置BOM模态框零部件搜索状态
    setBomModalSearchType('bom-items');
    setBomModalPartQuery('');
    setBomModalPartResults([]);
    setBomModalShowPartResults(false);
    setBomModalSearchingParts(false);
  };

  if (isLoading) {
    return (
      <AdminLayout title="生产订单管理">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="生产订单管理">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            生产订单管理
          </h2>
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              管理生产订单和计划
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
              最后更新: {lastUpdated.toLocaleTimeString('zh-CN')}
            </p>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => {
              loadOrders();
              setLastUpdated(new Date());
            }}
            className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Excel导入
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            新增订单
          </button>
        </div>
      </div>

      {/* 搜索筛选区域 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 p-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">搜索筛选</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              生产序号
            </label>
            <input
              type="text"
              value={searchFilters.productionNumber}
              onChange={(e) => setSearchFilters({...searchFilters, productionNumber: e.target.value})}
              placeholder="输入生产序号..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              生产订单
            </label>
            <input
              type="text"
              value={searchFilters.orderNumber}
              onChange={(e) => setSearchFilters({...searchFilters, orderNumber: e.target.value})}
              placeholder="输入订单号..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              产品号
            </label>
            <input
              type="text"
              value={searchFilters.productCode}
              onChange={(e) => setSearchFilters({...searchFilters, productCode: e.target.value})}
              placeholder="输入产品号..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              工艺号
            </label>
            <input
              type="text"
              value={searchFilters.processCode}
              onChange={(e) => setSearchFilters({...searchFilters, processCode: e.target.value})}
              placeholder="输入工艺号..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setSearchFilters({
              productionNumber: '',
              orderNumber: '',
              productCode: '',
              processCode: ''
            })}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            清空筛选
          </button>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            显示 {filteredOrders.length} / {orders.length} 条订单
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                生产序号
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                生产订单
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                产品号
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                工艺号
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                工艺版本
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                数量
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                优先级
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                状态
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                计划日期
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                完成日期
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredOrders.map((order) => {
              const statusConfig = getStatusConfig(order.status);
              const isExpanded = expandedOrders.has(order.id);
              const bomItems = orderBOMData[order.id] || [];
              
              return (
                <React.Fragment key={order.id}>
                  <tr 
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => toggleOrderExpansion(order)}
                    title="点击展开订单详情"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      <div className="font-medium text-gray-900 dark:text-white">{order.productionNumber}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{order.orderNumber}</div>
                        {order.notes && (
                          <div className="text-xs text-gray-400 mt-1">{order.notes}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      <div className="font-medium text-gray-900 dark:text-white">{order.product.productCode}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      <div className="font-medium text-gray-900 dark:text-white">{order.process.processCode}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      <div className="font-medium text-gray-900 dark:text-white">{order.process.version}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      <div className="font-medium text-gray-900 dark:text-white">{order.quantity}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      <div className="font-medium text-gray-900 dark:text-white">{order.priority}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {order.plannedDate ? new Date(order.plannedDate).toLocaleDateString('zh-CN') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {order.status === 'COMPLETED' && order.completedAt ? new Date(order.completedAt).toLocaleDateString('zh-CN') : '-'}
                    </td>
                  </tr>
                  
                  {/* 订单详情展开行 */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={10} className="px-6 py-0">
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="p-4">
                            {/* 选项卡导航 */}
                            <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-600 mb-4">
                              <button
                                onClick={() => setOrderTab(order.id, 'info')}
                                className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                                  (activeOrderTabs[order.id] || 'info') === 'info'
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                              >
                                📋 信息
                              </button>
                              <button
                                onClick={() => setOrderTab(order.id, 'bom')}
                                className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                                  (activeOrderTabs[order.id] || 'info') === 'bom'
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                              >
                                📝 BOM
                              </button>
                            </div>

                            {/* 选项卡内容 */}
                            {(activeOrderTabs[order.id] || 'info') === 'info' && (
                              <div>
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="text-base font-medium text-gray-900 dark:text-white">
                                    订单信息编辑
                                  </h4>
                                  <div className="flex items-center space-x-3">
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      修改后请点击保存按钮
                                    </div>
                                  </div>
                                </div>
                                
                                {/* 状态管理按钮区域 */}
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                                  <h5 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-3">
                                    订单状态管理
                                  </h5>
                                  <div className="flex flex-wrap gap-2">
                                    {/* 状态变更按钮 */}
                                    {order.status === 'PENDING' && (
                                      <button
                                        onClick={() => handleStatusChange(order, 'IN_PROGRESS')}
                                        className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                        title="开始订单"
                                      >
                                        🚀 开始订单
                                      </button>
                                    )}
                                    {order.status === 'IN_PROGRESS' && (
                                      <>
                                        <button
                                          onClick={() => handleStatusChange(order, 'COMPLETED')}
                                          className="px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                                          title="完成订单"
                                        >
                                          ✅ 完成订单
                                        </button>
                                        <button
                                          onClick={() => handleStatusChange(order, 'PAUSED')}
                                          className="px-3 py-2 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
                                          title="暂停订单"
                                        >
                                          ⏸️ 暂停订单
                                        </button>
                                      </>
                                    )}
                                    {order.status === 'COMPLETED' && (
                                      <button
                                        onClick={() => handleStatusChange(order, 'IN_PROGRESS')}
                                        className="px-3 py-2 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
                                        title="重新开始订单"
                                      >
                                        🔄 重启订单
                                      </button>
                                    )}
                                    {order.status === 'PAUSED' && (
                                      <button
                                        onClick={() => handleStatusChange(order, 'IN_PROGRESS')}
                                        className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                        title="恢复订单"
                                      >
                                        ▶️ 恢复订单
                                      </button>
                                    )}
                                    {(order.status === 'IN_PROGRESS' || order.status === 'COMPLETED' || order.status === 'PAUSED') && (
                                      <button
                                        onClick={() => handleStatusChange(order, 'PENDING')}
                                        className="px-3 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                                        title="重置为待开始"
                                      >
                                        🔄 重置为待开始
                                      </button>
                                    )}
                                    {order.status !== 'CANCELLED' && (
                                      <button
                                        onClick={() => handleStatusChange(order, 'CANCELLED')}
                                        className="px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                                        title="取消订单"
                                      >
                                        ❌ 取消订单
                                      </button>
                                    )}
                                    {canDelete(order) && (
                                      <button
                                        onClick={() => handleDelete(order)}
                                        className="px-3 py-2 text-sm bg-red-800 text-white rounded-md hover:bg-red-900 transition-colors border-2 border-red-600"
                                        title="删除订单"
                                      >
                                        🗑️ 删除订单
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleViewProgress(order)}
                                      className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                                      title="查看执行进度"
                                    >
                                      📊 查看进度
                                    </button>
                                  </div>
                                  <div className="mt-3 text-xs text-blue-800 dark:text-blue-300">
                                    当前状态: <span className={`px-2 py-1 rounded-full ${getStatusConfig(order.status).color}`}>
                                      {getStatusConfig(order.status).label}
                                    </span>
                                  </div>
                                </div>
                                
                                <form onSubmit={(e) => handleExpandedOrderSubmit(order.id, e)} className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        订单号 *
                                      </label>
                                      <input
                                        type="text"
                                        value={expandedOrderFormData[order.id]?.orderNumber || ''}
                                        onChange={(e) => updateExpandedOrderFormData(order.id, 'orderNumber', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                        required
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        生产号 *
                                      </label>
                                      <input
                                        type="text"
                                        value={expandedOrderFormData[order.id]?.productionNumber || ''}
                                        onChange={(e) => updateExpandedOrderFormData(order.id, 'productionNumber', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                        required
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                      关联产品 *
                                    </label>
                                    <select
                                      value={expandedOrderFormData[order.id]?.productId || ''}
                                      onChange={(e) => {
                                        updateExpandedOrderFormData(order.id, 'productId', e.target.value);
                                        updateExpandedOrderFormData(order.id, 'processId', '');
                                        if (e.target.value) {
                                          loadProcessesByProduct(e.target.value);
                                        }
                                      }}
                                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                      required
                                    >
                                      <option value="">请选择产品</option>
                                      {products.map((product) => (
                                        <option key={product.id} value={product.id}>
                                          {product.name} ({product.productCode})
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                      工艺流程 *
                                    </label>
                                    <select
                                      value={expandedOrderFormData[order.id]?.processId || ''}
                                      onChange={(e) => updateExpandedOrderFormData(order.id, 'processId', e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                      required
                                      disabled={!expandedOrderFormData[order.id]?.productId}
                                    >
                                      <option value="">请选择工艺流程</option>
                                      {processes.map((process) => (
                                        <option key={process.id} value={process.id}>
                                          {process.name} ({process.processCode})
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        生产数量 *
                                      </label>
                                      <input
                                        type="number"
                                        value={expandedOrderFormData[order.id]?.quantity || 1}
                                        onChange={(e) => updateExpandedOrderFormData(order.id, 'quantity', parseInt(e.target.value) || 1)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                        min="1"
                                        required
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        优先级
                                      </label>
                                      <input
                                        type="number"
                                        value={expandedOrderFormData[order.id]?.priority || 0}
                                        onChange={(e) => updateExpandedOrderFormData(order.id, 'priority', parseInt(e.target.value) || 0)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                        min="0"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        计划日期
                                      </label>
                                      <input
                                        type="date"
                                        value={expandedOrderFormData[order.id]?.plannedDate || ''}
                                        onChange={(e) => updateExpandedOrderFormData(order.id, 'plannedDate', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                      备注
                                    </label>
                                    <textarea
                                      value={expandedOrderFormData[order.id]?.notes || ''}
                                      onChange={(e) => updateExpandedOrderFormData(order.id, 'notes', e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                      rows={3}
                                      placeholder="订单备注"
                                    />
                                  </div>

                                  <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-600">
                                    <button
                                      type="submit"
                                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                    >
                                      保存更改
                                    </button>
                                  </div>
                                </form>
                              </div>
                            )}

                            {(activeOrderTabs[order.id] || 'info') === 'bom' && (
                              <div>
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="text-base font-medium text-gray-900 dark:text-white">
                                    零件搜索选择
                                  </h4>
                                  <div className="flex items-center space-x-3">
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      搜索并选择零件来构建BOM
                                    </div>
                                    <button
                                      onClick={() => handleAddBomToOrder(order)}
                                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors flex items-center"
                                      title="从BOM管理中选择已有BOM"
                                    >
                                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                      </svg>
                                      添加BOM
                                    </button>
                                  </div>
                                </div>
                                
                                {/* 显示现有BOM项，支持点击编辑 */}
                                <div className="space-y-3">
                                  <BOMItemsForOrder 
                                    order={order} 
                                    onEditPart={handleEditPart} 
                                    refreshTrigger={bomRefreshTrigger[order.id]} 
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 订单编辑模态框 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingOrder ? '编辑订单' : '新增订单'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    订单号 *
                  </label>
                  <input
                    type="text"
                    value={formData.orderNumber}
                    onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="订单号"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    生产号 *
                  </label>
                  <input
                    type="text"
                    value={formData.productionNumber}
                    onChange={(e) => setFormData({ ...formData, productionNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="生产号"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  关联产品 *
                </label>
                <select
                  value={formData.productId}
                  onChange={(e) => setFormData({ ...formData, productId: e.target.value, processId: '' })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="">请选择产品</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.productCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    工艺流程 *
                  </label>
                  <select
                    value={formData.processId}
                    onChange={(e) => setFormData({ ...formData, processId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                    disabled={!formData.productId}
                  >
                    <option value="">请选择工艺流程</option>
                    {processes.map((process) => (
                      <option key={process.id} value={process.id}>
                        {process.name} ({process.processCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    生产数量 *
                  </label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    优先级
                  </label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    计划日期
                  </label>
                  <input
                    type="date"
                    value={formData.plannedDate}
                    onChange={(e) => setFormData({ ...formData, plannedDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  备注
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  rows={3}
                  placeholder="订单备注"
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm">{error}</div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {editingOrder ? '更新' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel导入模态框 */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Excel批量导入订单
            </h2>

            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">导入说明</h3>
                <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                  <li>• 请使用标准的Excel模板格式</li>
                  <li>• 必需字段：生产号、日期、数量、订单序号、BOM号</li>
                  <li>• BOM号必须在系统中存在</li>
                  <li>• 日期格式：YYYY-MM-DD 或 Excel日期格式</li>
                </ul>
              </div>

              <div className="flex items-center space-x-4">
                <button
                  onClick={downloadTemplate}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  下载Excel模板
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  建议先下载模板，按照格式填写数据
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  选择Excel文件
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {selectedFile && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    已选择文件: <span className="font-medium">{selectedFile.name}</span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    大小: {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              )}

              {importError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-800 dark:text-red-200 whitespace-pre-wrap">{importError}</p>
                </div>
              )}

              {importSuccess && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <p className="text-sm text-green-800 dark:text-green-200">{importSuccess}</p>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setSelectedFile(null);
                    setImportError('');
                    setImportSuccess('');
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  取消
                </button>
                <button
                  onClick={handleImport}
                  disabled={!selectedFile || isImporting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isImporting && (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {isImporting ? '导入中...' : '开始导入'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Progress Modal */}
      {showProgressModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              订单进度详情 - {selectedOrder.orderNumber}
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* 订单基本信息 */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">订单信息</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">生产号:</span>
                    <span className="font-medium">{selectedOrder.productionNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">产品:</span>
                    <span className="font-medium">{selectedOrder.product.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">数量:</span>
                    <span className="font-medium">{selectedOrder.quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">已完成:</span>
                    <span className="font-medium">{selectedOrder.completedQuantity || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">优先级:</span>
                    <span className="font-medium">{selectedOrder.priority}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">状态:</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusConfig(selectedOrder.status).color}`}>
                      {getStatusConfig(selectedOrder.status).label}
                    </span>
                  </div>
                </div>
              </div>

              {/* 当前位置 */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">当前位置</h3>
                <div className="space-y-2 text-sm">
                  {selectedOrder.currentStation ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">当前工位:</span>
                        <span className="font-medium text-blue-600 dark:text-blue-400">{selectedOrder.currentStation.name}</span>
                      </div>
                      {selectedOrder.currentStep && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">当前步骤:</span>
                          <span className="font-medium">{selectedOrder.currentStep.name}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                      订单尚未开始执行
                    </div>
                  )}
                  
                  {selectedOrder.orderSteps && selectedOrder.orderSteps.length > 0 && (
                    <div className="mt-4">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        总体进度: {calculateProgress(selectedOrder)}%
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${calculateProgress(selectedOrder)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 步骤执行进度 */}
            {selectedOrder.orderSteps && selectedOrder.orderSteps.length > 0 && (
              <div className="mb-6">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">步骤执行进度</h3>
                <div className="space-y-3">
                  {selectedOrder.orderSteps
                    .sort((a, b) => a.step.sequence - b.step.sequence)
                    .map((orderStep) => (
                    <div key={orderStep.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <span className="font-medium text-gray-900 dark:text-white mr-2">
                            步骤 {orderStep.step.sequence}: {orderStep.step.name}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full ${getStepStatusColor(orderStep.status)}`}>
                            {getStepStatusText(orderStep.status)}
                          </span>
                        </div>
                        {orderStep.workstation && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            工位: {orderStep.workstation.name}
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
                        {orderStep.startedAt && (
                          <div>
                            <span className="font-medium">开始时间:</span> {new Date(orderStep.startedAt).toLocaleString('zh-CN')}
                          </div>
                        )}
                        {orderStep.completedAt && (
                          <div>
                            <span className="font-medium">完成时间:</span> {new Date(orderStep.completedAt).toLocaleString('zh-CN')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowProgressModal(false);
                  setSelectedOrder(null);
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOM物料编辑模态框 */}
      {showBOMEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingBOMItem ? '编辑物料' : '添加物料'}
            </h2>

            {/* 物料搜索区域 - 仅在添加新物料时显示 */}
            {!editingBOMItem && (
              <div className="mb-6">
                {/* 搜索类型选择标签页 */}
                <div className="border-b border-gray-200 dark:border-gray-600 mb-4">
                  <nav className="flex space-x-8">
                    <button
                      onClick={() => setBomModalSearchType('bom-items')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        bomModalSearchType === 'bom-items'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                      }`}
                    >
                      从现有物料选择
                    </button>
                    <button
                      onClick={() => setBomModalSearchType('parts')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        bomModalSearchType === 'parts'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                      }`}
                    >
                      从零部件库选择
                    </button>
                  </nav>
                </div>

                {/* 现有物料搜索 */}
                {bomModalSearchType === 'bom-items' && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-3">
                      🔍 搜索现有物料
                    </h3>
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearchInputChange(e.target.value)}
                        className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        placeholder="输入物料编码或名称搜索..."
                      />
                      {isSearching && (
                        <div className="absolute right-3 top-2.5">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        </div>
                      )}
                    </div>
                    
                    {/* 搜索结果列表 */}
                    {showSearchResults && searchResults.length > 0 && (
                      <div className="mt-3 border border-gray-200 dark:border-gray-600 rounded-md max-h-40 overflow-y-auto bg-white dark:bg-gray-800">
                        {searchResults.map((item) => (
                          <div
                            key={`${item.id}-${item.itemCode}`}
                            onClick={() => selectSearchResult(item)}
                            className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium text-sm text-gray-900 dark:text-white">
                                  {item.itemCode} - {item.itemName}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  数量: {item.quantity} {item.unit}
                                  {item.description && ` | ${item.description}`}
                                </div>
                              </div>
                              <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                点击选择
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {showSearchResults && searchResults.length === 0 && searchQuery.trim() && !isSearching && (
                      <div className="mt-3 p-3 text-center text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-md">
                        未找到匹配的物料，您可以切换到零部件库选择或在下方手动添加新物料
                      </div>
                    )}
                  </div>
                )}

                {/* 零部件库搜索 */}
                {bomModalSearchType === 'parts' && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <h3 className="text-sm font-medium text-green-900 dark:text-green-200 mb-3">
                      🔍 从零部件库选择
                    </h3>
                    <div className="relative">
                      <input
                        type="text"
                        value={bomModalPartQuery}
                        onChange={(e) => handleBomModalPartSearchChange(e.target.value)}
                        className="w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                        placeholder="输入零部件号、名称或SAP描述搜索..."
                      />
                      {bomModalSearchingParts && (
                        <div className="absolute right-3 top-2.5">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
                        </div>
                      )}
                    </div>
                    
                    {/* 零部件搜索结果列表 */}
                    {bomModalShowPartResults && bomModalPartResults.length > 0 && (
                      <div className="mt-3 border border-gray-200 dark:border-gray-600 rounded-md max-h-40 overflow-y-auto bg-white dark:bg-gray-800">
                        {bomModalPartResults.map((part) => (
                          <div
                            key={part.id}
                            onClick={() => handleBomModalSelectPart(part)}
                            className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium text-sm text-gray-900 dark:text-white">
                                  {part.partNumber} - {part.name}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {part.sapDescription && `SAP描述: ${part.sapDescription}`}
                                  {part.category && ` | 类别: ${part.category}`}
                                </div>
                              </div>
                              <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                                点击选择
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {bomModalShowPartResults && bomModalPartResults.length === 0 && bomModalPartQuery.trim() && !bomModalSearchingParts && (
                      <div className="mt-3 p-3 text-center text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-md">
                        未找到匹配的零部件，您可以在下方手动添加新物料
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleBOMItemSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    物料编码 *
                  </label>
                  <input
                    type="text"
                    value={bomItemFormData.itemCode}
                    onChange={(e) => setBomItemFormData({ ...bomItemFormData, itemCode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="物料编码"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    物料名称 *
                  </label>
                  <input
                    type="text"
                    value={bomItemFormData.itemName}
                    onChange={(e) => setBomItemFormData({ ...bomItemFormData, itemName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="物料名称"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    需求数量 *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={bomItemFormData.quantity}
                    onChange={(e) => setBomItemFormData({ ...bomItemFormData, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    单位 *
                  </label>
                  <select
                    value={bomItemFormData.unit}
                    onChange={(e) => setBomItemFormData({ ...bomItemFormData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="个">个</option>
                    <option value="片">片</option>
                    <option value="套">套</option>
                    <option value="米">米</option>
                    <option value="根">根</option>
                    <option value="块">块</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                    <option value="ml">ml</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  物料描述
                </label>
                <textarea
                  value={bomItemFormData.description}
                  onChange={(e) => setBomItemFormData({ ...bomItemFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  rows={3}
                  placeholder="物料详细描述"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowBOMEditModal(false);
                    setEditingBOMOrder(null);
                    setEditingBOMItem(null);
                    resetBOMForm();
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {editingBOMItem ? '更新' : '添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BOM选择模态框 */}
      {showBomSelectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                选择BOM - {selectedOrderForBom?.product.name}
              </h2>
              <button
                onClick={() => {
                  setShowBomSelectModal(false);
                  setSelectedOrderForBom(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {isLoadingBoms ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600 dark:text-gray-400">加载BOM列表...</span>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {availableBoms.length > 0 ? (
                  <div className="grid gap-3">
                    {availableBoms.map((bom) => (
                      <div
                        key={bom.id}
                        className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                        onClick={() => handleBomSelection(bom.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">{bom.name}</h3>
                            <div className="flex items-center space-x-4 mt-1">
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                编码: {bom.bomCode}
                              </span>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                版本: {bom.version}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                bom.status === 'active' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                              }`}>
                                {bom.status === 'active' ? '活跃' : '草稿'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              创建时间
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-500">
                              {new Date(bom.createdAt).toLocaleDateString('zh-CN')}
                            </div>
                          </div>
                        </div>
                        {bom.description && (
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{bom.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">暂无可用BOM</h3>
                    <p className="text-sm mb-4">该产品暂时没有可用的BOM</p>
                    <p className="text-xs text-gray-400">请先在BOM管理页面为该产品创建BOM</p>
                  </div>
                )}
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 flex justify-end">
              <button
                onClick={() => {
                  setShowBomSelectModal(false);
                  setSelectedOrderForBom(null);
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 添加零件模态框 */}
      {showAddPartModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md relative">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                New product part
              </h2>
              <button
                onClick={() => {
                  setShowAddPartModal(false);
                  setSelectedOrderForBom(null);
                  setPartSearchQuery('');
                  setSelectedPart(null);
                  setPartQuantity(1);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Part <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={partSearchQuery}
                    onChange={(e) => handlePartSearchChange(e.target.value)}
                    placeholder="Start typing..."
                    className="w-full px-3 py-2 pr-20 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    autoComplete="off"
                  />
                  <div className="absolute right-2 top-2 flex items-center space-x-1">
                    {partSearchQuery && !isSearchingParts && (
                      <button
                        onClick={() => {
                          setPartSearchQuery('');
                          setSelectedPart(null);
                          setPartSearchResults([]);
                          setShowPartSuggestions(false);
                        }}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5"
                        title="清空搜索"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    {isSearchingParts && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    )}
                  </div>
                  
                  {/* 搜索建议下拉列表 */}
                  {showPartSuggestions && partSearchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {partSearchResults.map((part) => (
                        <div
                          key={part.id}
                          onClick={() => handleSelectPart(part)}
                          className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900 dark:text-white">
                            <span className="text-blue-600 dark:text-blue-400 font-mono">{part.partNumber}</span>
                            <span className="ml-2">{part.name}</span>
                          </div>
                          {part.sapDescription && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 truncate mt-1">
                              {part.sapDescription}
                            </div>
                          )}
                          {part.category && (
                            <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                              类别: {part.category}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* 无搜索结果提示 */}
                  {showPartSuggestions && partSearchResults.length === 0 && partSearchQuery.length >= 2 && !isSearchingParts && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg p-3">
                      <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
                        未找到匹配的零件
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  value={partQuantity}
                  onChange={(e) => setPartQuantity(parseInt(e.target.value) || 1)}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowAddPartModal(false);
                  setSelectedOrderForBom(null);
                  setPartSearchQuery('');
                  setSelectedPart(null);
                  setPartQuantity(1);
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePartToOrder}
                disabled={!selectedPart || partQuantity <= 0}
                className={`px-4 py-2 rounded-md transition-colors ${
                  selectedPart && partQuantity > 0
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑零件模态框 */}
      {showEditPartModal && editingOrderForPart && editingBomItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md relative">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                Edit product part
              </h2>
              <button
                onClick={() => {
                  setShowEditPartModal(false);
                  setEditingOrderForPart(null);
                  setEditingBomItem(null);
                  setEditPartQuantity(1);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Part <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingBomItem ? `${editingBomItem.itemName} (number: ${editingBomItem.itemCode})` : ''}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  value={editPartQuantity}
                  onChange={(e) => setEditPartQuantity(parseInt(e.target.value) || 1)}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-between items-center mt-6">
              <button
                onClick={handleDeletePart}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowEditPartModal(false);
                    setEditingOrderForPart(null);
                    setEditingBomItem(null);
                    setEditPartQuantity(1);
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdatePartQuantity}
                  disabled={editPartQuantity <= 0}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    editPartQuantity > 0
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}