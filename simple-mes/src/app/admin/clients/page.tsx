"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useLanguage } from "@/contexts/LanguageContext";

interface Client {
  id: string;
  clientId: string;
  name: string;
  configuredIp: string;
  currentIp: string | null;
  status: string;
  lastConnected: string | null;
  settings: any;
  createdAt: string;
  updatedAt: string;
}

interface ClientFormData {
  clientId: string;
  name: string;
  configuredIp: string;
  settings: {
    autoConnect?: boolean;
    timeout?: number;
    retryCount?: number;
  };
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<ClientFormData>({
    clientId: '',
    name: '',
    configuredIp: '',
    settings: {
      autoConnect: true,
      timeout: 30000,
      retryCount: 3
    }
  });
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { t } = useLanguage();

  useEffect(() => {
    loadClients();
    
    // 设置自动刷新，每5秒检查一次客户端状态
    const interval = setInterval(async () => {
      // 先清理非活跃客户端
      try {
        await fetch('/api/clients/cleanup', { method: 'POST' });
      } catch (error) {
        console.error('Cleanup error:', error);
      }
      
      // 然后刷新客户端列表
      loadClients();
      setLastUpdated(new Date());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadClients = async () => {
    try {
      const response = await fetch('/api/clients');
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients);
      }
    } catch (error) {
      console.error('Load clients error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const url = editingClient ? `/api/clients/${editingClient.id}` : '/api/clients';
      const method = editingClient ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        await loadClients();
        setShowModal(false);
        resetForm();
      } else {
        setError(data.error || '操作失败');
      }
    } catch (error) {
      setError('网络错误，请重试');
    }
  };

  const handleDelete = async (client: Client) => {
    if (!confirm(`确定要删除客户端 "${client.name}" 吗？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/clients/${client.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadClients();
      } else {
        const data = await response.json();
        alert(data.error || '删除失败');
      }
    } catch (error) {
      alert('网络错误，请重试');
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      clientId: client.clientId,
      name: client.name,
      configuredIp: client.configuredIp,
      settings: client.settings || {
        autoConnect: true,
        timeout: 30000,
        retryCount: 3
      }
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingClient(null);
    setFormData({
      clientId: '',
      name: '',
      configuredIp: '',
      settings: {
        autoConnect: true,
        timeout: 30000,
        retryCount: 3
      }
    });
    setError('');
  };

  const handleBack = () => {
    // Not needed anymore with AdminLayout
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'offline':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'unauthorized':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title={t('admin.clients.title')}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={t('admin.clients.title')}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            客户端列表
          </h2>
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              管理客户端配置和IP地址验证
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
              最后更新: {lastUpdated.toLocaleTimeString('zh-CN')}
            </p>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={async () => {
              try {
                await fetch('/api/clients/cleanup', { method: 'POST' });
              } catch (error) {
                console.error('Cleanup error:', error);
              }
              loadClients();
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
            添加客户端
          </button>
        </div>
      </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  客户端ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  名称
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  配置IP
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  当前IP
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  最后连接
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {clients.map((client) => (
                <tr key={client.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {client.clientId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {client.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {client.configuredIp}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {client.currentIp || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(client.status)}`}>
                      {client.status === 'online' ? '在线' : 
                       client.status === 'offline' ? '离线' : 
                       client.status === 'unauthorized' ? 'IP不匹配' : client.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {client.lastConnected ? new Date(client.lastConnected).toLocaleString('zh-CN') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(client)}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(client)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
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
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingClient ? '编辑客户端' : '添加客户端'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  客户端ID
                </label>
                <input
                  type="text"
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  客户端名称
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  配置IP地址
                </label>
                <input
                  type="text"
                  value={formData.configuredIp}
                  onChange={(e) => setFormData({ ...formData, configuredIp: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="192.168.1.100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  超时时间 (毫秒)
                </label>
                <input
                  type="number"
                  value={formData.settings.timeout}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    settings: { ...formData.settings, timeout: parseInt(e.target.value) } 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  重试次数
                </label>
                <input
                  type="number"
                  value={formData.settings.retryCount}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    settings: { ...formData.settings, retryCount: parseInt(e.target.value) } 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoConnect"
                  checked={formData.settings.autoConnect}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    settings: { ...formData.settings, autoConnect: e.target.checked } 
                  })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="autoConnect" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  自动连接
                </label>
              </div>

              {error && (
                <div className="text-red-600 text-sm">{error}</div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {editingClient ? '更新' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}