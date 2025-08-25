"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useLanguage } from "@/contexts/LanguageContext";

interface Product {
  id: string;
  productCode: string;
  name: string;
  description: string | null;
  version: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  productWorkstations?: {
    id: string;
    workstationId: string;
    sequence: number;
    workstation: {
      id: string;
      workstationId: string;
      name: string;
      type: string;
    };
  }[];
  _count: {
    boms: number;
    processes: number;
    orders: number;
  };
}

interface ProductFormData {
  productCode: string;
  name: string;
  description: string;
  version: string;
  status: string;
  workstationIds: string[]; // 新增工位ID数组
}

interface Workstation {
  id: string;
  workstationId: string;
  name: string;
  type: string;
  description?: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>({
    productCode: '',
    name: '',
    description: '',
    version: '1.0',
    status: 'active',
    workstationIds: []
  });
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { t } = useLanguage();

  useEffect(() => {
    loadProducts();
    loadWorkstations();
  }, []);

  const loadWorkstations = async () => {
    try {
      console.log('Loading workstations...');
      const response = await fetch('/api/workstations/simple');
      console.log('Workstations response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Workstations data:', data);
        setWorkstations(data.data || []);
      }
    } catch (error) {
      console.error('Load workstations error:', error);
    }
  };

  const loadProducts = async () => {
    try {
      // 使用默认分页获取产品列表，避免一次性获取太多数据
      const response = await fetch('/api/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data.data.products);
      }
    } catch (error) {
      console.error('Load products error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        await loadProducts();
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

  const handleDelete = async (product: Product) => {
    if (!confirm(`确定要删除产品 "${product.name}"吗？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadProducts();
        setLastUpdated(new Date());
      } else {
        const data = await response.json();
        alert(data.error || '删除失败');
      }
    } catch (error) {
      alert('网络错误');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    const workstationIds = product.productWorkstations?.map(pw => pw.workstation.id) || [];
    setFormData({
      productCode: product.productCode,
      name: product.name,
      description: product.description || '',
      version: product.version,
      status: product.status,
      workstationIds: workstationIds
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({
      productCode: '',
      name: '',
      description: '',
      version: '1.0',
      status: 'active',
      workstationIds: []
    });
    setError('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '启用';
      case 'inactive':
        return '禁用';
      default:
        return status;
    }
  };

  const canDelete = (product: Product) => {
    return product._count.boms === 0 && product._count.processes === 0 && product._count.orders === 0;
  };

  if (isLoading) {
    return (
      <AdminLayout title="产品管理">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="产品管理">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            产品管理
          </h2>
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              管理生产产品信息
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
              loadProducts();
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
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            新增产品
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                产品信息
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                版本
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                状态
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                工艺路线
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                关联数据
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                创建时间
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {products.map((product) => (
              <tr key={product.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{product.name}</div>
                    <div className="text-xs text-gray-400">{product.productCode}</div>
                    {product.description && (
                      <div className="text-xs text-gray-400 mt-1">{product.description}</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {product.version}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(product.status)}`}>
                    {getStatusText(product.status)}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
                  {product.productWorkstations && product.productWorkstations.length > 0 ? (
                    <div className="space-y-1">
                      <div className="text-xs text-gray-400 mb-1">工艺路线 ({product.productWorkstations.length}个工位):</div>
                      <div className="flex flex-wrap gap-1">
                        {product.productWorkstations
                          .sort((a, b) => a.sequence - b.sequence)
                          .map((pw, index) => (
                          <span
                            key={pw.id}
                            className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          >
                            {index + 1}. {pw.workstation.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">未配置工艺路线</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
                        BOM: {product._count.boms}
                      </span>
                      <span className="flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                        工艺: {product._count.processes}
                      </span>
                    </div>
                    <div>
                      <span className="flex items-center">
                        <span className="w-2 h-2 bg-purple-500 rounded-full mr-1"></span>
                        订单: {product._count.orders}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {new Date(product.createdAt).toLocaleDateString('zh-CN')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleEdit(product)}
                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(product)}
                    className={`${
                      canDelete(product)
                        ? 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300'
                        : 'text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={!canDelete(product)}
                    title={
                      canDelete(product)
                        ? '删除产品'
                        : '该产品已被BOM、工艺流程或订单使用，无法删除'
                    }
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 模态框 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingProduct ? '编辑产品' : '新增产品'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    产品编码 *
                  </label>
                  <input
                    type="text"
                    value={formData.productCode}
                    onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="产品编码"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    产品名称 *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="产品名称"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    版本
                  </label>
                  <input
                    type="text"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="版本号"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    状态
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="active">启用</option>
                    <option value="inactive">禁用</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  产品描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  rows={4}
                  placeholder="产品详细描述..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  工艺路线 - 选择工位 *
                </label>
                <div className="border border-gray-300 dark:border-gray-600 rounded-md p-3 max-h-48 overflow-y-auto">
                  {workstations.length === 0 ? (
                    <p className="text-gray-500 text-sm">暂无可用工位</p>
                  ) : (
                    <div className="space-y-2">
                      {workstations.map((workstation) => (
                        <label key={workstation.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.workstationIds.includes(workstation.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  workstationIds: [...formData.workstationIds, workstation.id]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  workstationIds: formData.workstationIds.filter(id => id !== workstation.id)
                                });
                              }
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {workstation.name} ({workstation.workstationId})
                            {workstation.description && (
                              <span className="text-gray-500 ml-1">- {workstation.description}</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  选择的工位将构成此产品的工艺路线，订单将按照选择的工位顺序执行
                </p>
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
                  {editingProduct ? '更新' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}