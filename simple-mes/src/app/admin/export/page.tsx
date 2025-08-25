"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/layout/AdminLayout";
import { useLanguage } from "@/contexts/LanguageContext";

interface ExportRecord {
  id: string;
  exportType: 'excel' | 'markdown';
  exportScope: string;
  filters?: string;
  startDate?: string;
  endDate?: string;
  exportedBy: string;
  exportedAt: string;
  status: 'processing' | 'completed' | 'failed';
  filePath?: string;
  fileSize?: number;
  recordCount?: number;
  errorMessage?: string;
}

interface ExportOptions {
  type: 'excel' | 'markdown';
  scope: 'orders' | 'action_logs' | 'boms' | 'products' | 'specific_order';
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    orderId?: string;
    workstationId?: string;
    productId?: string;
    status?: string;
  };
}

const exportScopes = [
  { value: 'orders', label: '生产订单数据' },
  { value: 'action_logs', label: '动作执行日志' },
  { value: 'boms', label: 'BOM数据' },
  { value: 'products', label: '产品数据' },
  { value: 'specific_order', label: '特定订单详情' }
];

export default function DataExportPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [exportRecords, setExportRecords] = useState<ExportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Export form state
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    type: 'excel',
    scope: 'orders',
    filters: {}
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    const adminAuth = localStorage.getItem("adminAuth");
    const userInfoStr = localStorage.getItem("adminUserInfo");
    
    if (adminAuth === "true" && userInfoStr) {
      const user = JSON.parse(userInfoStr);
      setUserInfo(user);
      setIsAuthenticated(true);
      loadExportRecords();
    } else {
      router.push("/admin/login");
    }
  }, [router]);

  // 定期刷新导出记录
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      loadExportRecords(false);
    }, 10000); // 每10秒刷新一次

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const loadExportRecords = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    
    try {
      const response = await fetch('/api/export');
      if (response.ok) {
        const data = await response.json();
        setExportRecords(data.data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to load export records:', error);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...exportOptions,
          exportedBy: userInfo?.username || 'admin'
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`导出成功！文件: ${data.data.fileName}，记录数: ${data.data.recordCount}`);
        setShowExportModal(false);
        loadExportRecords();
        resetForm();
      } else {
        setError(data.error || '导出失败');
      }
    } catch (error) {
      setError('网络错误');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = async (record: ExportRecord) => {
    try {
      const response = await fetch(`/api/export/${record.id}/download`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = record.filePath || `export_${record.id}.${record.exportType === 'excel' ? 'xlsx' : 'md'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const data = await response.json();
        alert(data.error || '下载失败');
      }
    } catch (error) {
      alert('下载失败');
    }
  };

  const resetForm = () => {
    setExportOptions({
      type: 'excel',
      scope: 'orders',
      filters: {}
    });
    setError('');
    setSuccess('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'processing':
        return '处理中';
      case 'failed':
        return '失败';
      default:
        return '未知';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isAuthenticated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <AdminLayout title="数据导出">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            数据导出管理
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
            最后更新: {lastUpdated.toLocaleTimeString('zh-CN')}
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => loadExportRecords(true)}
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
              setShowExportModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            新建导出
          </button>
        </div>
      </div>

      {/* Success message */}
      {success && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-green-800 dark:text-green-200">{success}</p>
        </div>
      )}

      {/* Export Records Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                导出信息
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                类型/范围
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                状态
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                文件信息
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                导出时间
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {exportRecords.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  暂无导出记录
                </td>
              </tr>
            ) : (
              exportRecords.map((record) => (
                <tr key={record.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {record.exportedBy}
                      </div>
                      {record.recordCount !== undefined && (
                        <div className="text-xs text-gray-400">
                          记录数: {record.recordCount}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    <div>
                      <div className="font-medium">
                        {record.exportType === 'excel' ? 'Excel' : 'Markdown'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {exportScopes.find(s => s.value === record.exportScope)?.label || record.exportScope}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(record.status)}`}>
                      {getStatusText(record.status)}
                    </span>
                    {record.status === 'failed' && record.errorMessage && (
                      <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                        {record.errorMessage}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {record.filePath && (
                      <div>
                        <div className="font-medium">{record.filePath}</div>
                        {record.fileSize && (
                          <div className="text-xs text-gray-400">
                            {formatFileSize(record.fileSize)}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {new Date(record.exportedAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {record.status === 'completed' && record.filePath && (
                      <button
                        onClick={() => handleDownload(record)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        下载
                      </button>
                    )}
                    {record.status === 'processing' && (
                      <span className="text-gray-400">处理中...</span>
                    )}
                    {record.status === 'failed' && (
                      <span className="text-red-400">失败</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              新建数据导出
            </h2>

            <div className="space-y-4">
              {/* Export Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  导出格式
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="type"
                      value="excel"
                      checked={exportOptions.type === 'excel'}
                      onChange={(e) => setExportOptions({ ...exportOptions, type: e.target.value as 'excel' | 'markdown' })}
                      className="mr-2"
                    />
                    Excel (.xlsx)
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="type"
                      value="markdown"
                      checked={exportOptions.type === 'markdown'}
                      onChange={(e) => setExportOptions({ ...exportOptions, type: e.target.value as 'excel' | 'markdown' })}
                      className="mr-2"
                    />
                    Markdown (.md)
                  </label>
                </div>
              </div>

              {/* Export Scope */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  导出范围
                </label>
                <select
                  value={exportOptions.scope}
                  onChange={(e) => setExportOptions({ ...exportOptions, scope: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  {exportScopes.map((scope) => (
                    <option key={scope.value} value={scope.value}>
                      {scope.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    开始日期
                  </label>
                  <input
                    type="date"
                    value={exportOptions.filters?.dateFrom || ''}
                    onChange={(e) => setExportOptions({
                      ...exportOptions,
                      filters: { ...exportOptions.filters, dateFrom: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    结束日期
                  </label>
                  <input
                    type="date"
                    value={exportOptions.filters?.dateTo || ''}
                    onChange={(e) => setExportOptions({
                      ...exportOptions,
                      filters: { ...exportOptions.filters, dateTo: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              {/* Specific Order ID for specific_order scope */}
              {exportOptions.scope === 'specific_order' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    订单ID *
                  </label>
                  <input
                    type="text"
                    value={exportOptions.filters?.orderId || ''}
                    onChange={(e) => setExportOptions({
                      ...exportOptions,
                      filters: { ...exportOptions.filters, orderId: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="请输入订单ID"
                    required
                  />
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="text-red-600 text-sm">{error}</div>
              )}

              {/* Action buttons */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowExportModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  取消
                </button>
                <button
                  onClick={handleExport}
                  disabled={isExporting || (exportOptions.scope === 'specific_order' && !exportOptions.filters?.orderId)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isExporting && (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {isExporting ? '导出中...' : '开始导出'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}