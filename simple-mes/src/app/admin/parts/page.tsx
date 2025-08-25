'use client'
import { useState, useEffect, useCallback } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'

interface PartWithBOM {
  id: string
  itemCode: string
  itemName: string
  quantity: number
  unit: string
  description?: string
  createdAt: string
  updatedAt: string
  bom: {
    id: string
    bomCode: string
    name: string
    version: string
    description?: string
    status: string
    createdAt: string
  }
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  pages: number
}

export default function PartsPage() {
  const [parts, setParts] = useState<PartWithBOM[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const [bomFormData, setBomFormData] = useState({
    bomCode: '',
    bomName: '',
    bomDescription: '',
    version: '1.0',
    status: 'active',
    itemCode: '',
    itemName: '',
    itemDescription: '',
    quantity: 1,
    unit: '件'
  })

  const fetchParts = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })
      
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim())
      }
      
      const response = await fetch(`/api/bom-items?${params}`)
      const result = await response.json()
      
      if (result.success) {
        setParts(result.data.bomItems)
        setPagination(result.data.pagination)
      }
    } catch (error) {
      console.error('Error fetching BOM items:', error)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, searchQuery])

  useEffect(() => {
    fetchParts()
  }, [fetchParts])

  const handleReset = () => {
    setSearchQuery('')
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }))
  }

  const handleLimitChange = (newLimit: number) => {
    setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }))
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportMessage('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/boms/import', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        setImportMessage(result.message)
        fetchParts()
        setTimeout(() => {
          setShowImportModal(false)
          setImportMessage('')
        }, 2000)
      } else {
        setImportMessage(result.error)
      }
    } catch (error) {
      console.error('Import error:', error)
      setImportMessage('导入失败')
    } finally {
      setImporting(false)
      // 清空文件输入
      event.target.value = ''
    }
  }

  const handleDownloadTemplate = () => {
    const link = document.createElement('a')
    link.href = '/templates/bom-import-template.csv'
    link.download = '零部件导入模板.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSavePart = async () => {
    setSaving(true)
    setSaveMessage('')

    try {
      // 验证必填字段
      if (!bomFormData.bomCode || !bomFormData.bomName || !bomFormData.itemCode || !bomFormData.itemName) {
        setSaveMessage('请填写所有必填字段')
        setSaving(false)
        return
      }

      const bomData = {
        bomCode: bomFormData.bomCode,
        name: bomFormData.bomName,
        description: bomFormData.bomDescription || null,
        version: bomFormData.version,
        status: bomFormData.status,
        bomItems: [{
          itemCode: bomFormData.itemCode,
          itemName: bomFormData.itemName,
          description: bomFormData.itemDescription || null,
          quantity: bomFormData.quantity,
          unit: bomFormData.unit
        }]
      }

      const response = await fetch('/api/boms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bomData)
      })

      const result = await response.json()

      if (result.success) {
        setSaveMessage('零部件创建成功')
        fetchParts()
        setTimeout(() => {
          setShowAddModal(false)
          resetPartForm()
        }, 1500)
      } else {
        setSaveMessage(result.error || '创建失败')
      }
    } catch (error) {
      console.error('Save BOM error:', error)
      setSaveMessage('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const resetPartForm = () => {
    setBomFormData({
      bomCode: '',
      bomName: '',
      bomDescription: '',
      version: '1.0',
      status: 'active',
      itemCode: '',
      itemName: '',
      itemDescription: '',
      quantity: 1,
      unit: '件'
    })
    setSaveMessage('')
  }

  const handleAddModalClose = () => {
    setShowAddModal(false)
    resetPartForm()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '启用'
      case 'inactive':
        return '禁用'
      default:
        return status
    }
  }

  return (
    <AdminLayout title="零部件管理">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            零部件管理
          </h1>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium"
            >
              导入零部件
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium"
            >
              添加零部件
            </button>
          </div>
        </div>

        {/* 搜索和筛选区域 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="text-right mb-4">
            <span className="text-base text-gray-600 dark:text-gray-400 font-medium">
              Total: {pagination.total}
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="搜索物料编码、物料名称或描述"
              />
            </div>
            <div>
              <select
                value={pagination.limit}
                onChange={(e) => handleLimitChange(parseInt(e.target.value))}
                className="px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value={10}>10条/页</option>
                <option value={20}>20条/页</option>
                <option value={50}>50条/页</option>
                <option value={100}>100条/页</option>
              </select>
            </div>
            <button
              onClick={() => fetchParts()}
              className="px-6 py-3 text-base bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              搜索
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-3 text-base bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors font-medium"
            >
              重置
            </button>
          </div>
        </div>

        {/* 零部件项目列表 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  物料号
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  物料名称
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  物料描述
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  版本
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  数量
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  单位
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  创建时间
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400 text-base">
                    Loading...
                  </td>
                </tr>
              ) : parts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400 text-base">
                    No parts found
                  </td>
                </tr>
              ) : (
                parts.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-base text-blue-600 dark:text-blue-400 font-mono font-medium">
                      {item.itemCode}
                    </td>
                    <td className="px-6 py-4 text-base text-gray-900 dark:text-white font-medium">
                      {item.itemName}
                    </td>
                    <td className="px-6 py-4 text-base text-gray-600 dark:text-gray-400 max-w-xs">
                      <div className="truncate" title={item.description || ''}>
                        {item.description || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-500 dark:text-gray-300">
                      {item.bom.version}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-700 dark:text-gray-300 font-medium">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-700 dark:text-gray-300">
                      {item.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(item.bom.status)}`}>
                        {getStatusText(item.bom.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-500 dark:text-gray-300">
                      {new Date(item.bom.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base font-medium">
                      <button
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3 font-medium"
                      >
                        编辑
                      </button>
                      <button
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 font-medium"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页控制 */}
        {pagination.pages > 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mt-4 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="text-base text-gray-700 dark:text-gray-300 font-medium">
                显示第 {(pagination.page - 1) * pagination.limit + 1} 到 {Math.min(pagination.page * pagination.limit, pagination.total)} 条，
                共 {pagination.total} 条记录
              </div>

              <div className="flex items-center space-x-2">
                {/* 分页按钮 */}
                <div className="flex space-x-1">
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 text-base bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    首页
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 text-base bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    上一页
                  </button>
                  
                  {/* 页码显示 */}
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    const startPage = Math.max(1, pagination.page - 2)
                    const pageNum = startPage + i
                    if (pageNum <= pagination.pages) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-4 py-2 text-base rounded font-medium ${
                            pageNum === pagination.page
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    }
                    return null
                  })}

                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                    className="px-4 py-2 text-base bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    下一页
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.pages)}
                    disabled={pagination.page === pagination.pages}
                    className="px-4 py-2 text-base bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    末页
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 导入零部件模态框 */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                导入零部件
              </h2>
              <button
                onClick={() => {
                  setShowImportModal(false)
                  setImportMessage('')
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                  选择CSV文件
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleImport}
                  disabled={importing}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="text-center">
                <button
                  onClick={handleDownloadTemplate}
                  className="text-blue-600 dark:text-blue-400 hover:underline text-base font-medium"
                >
                  下载导入模板
                </button>
              </div>

              {importing && (
                <div className="text-center text-blue-600 dark:text-blue-400 text-base font-medium">
                  导入中，请稍候...
                </div>
              )}

              {importMessage && (
                <div className={`text-center text-base font-medium ${
                  importMessage.includes('成功') 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {importMessage}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowImportModal(false)
                  setImportMessage('')
                }}
                className="px-4 py-2 text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md font-medium"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 添加零部件模态框 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                添加零部件
              </h2>
              <button
                onClick={handleAddModalClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              {/* BOM基本信息 */}
              <div className="border-b border-gray-200 dark:border-gray-600 pb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">零部件基本信息</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                      零部件编码 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={bomFormData.bomCode}
                      onChange={(e) => setBomFormData({ ...bomFormData, bomCode: e.target.value })}
                      className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="CAR-ENGINE-001"
                    />
                  </div>
                  <div>
                    <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                      零部件名称 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={bomFormData.bomName}
                      onChange={(e) => setBomFormData({ ...bomFormData, bomName: e.target.value })}
                      className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="汽车发动机零部件"
                    />
                  </div>
                  <div>
                    <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                      版本
                    </label>
                    <input
                      type="text"
                      value={bomFormData.version}
                      onChange={(e) => setBomFormData({ ...bomFormData, version: e.target.value })}
                      className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="1.0"
                    />
                  </div>
                  <div>
                    <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                      状态
                    </label>
                    <select
                      value={bomFormData.status}
                      onChange={(e) => setBomFormData({ ...bomFormData, status: e.target.value })}
                      className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="active">启用</option>
                      <option value="inactive">禁用</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                      零部件描述
                    </label>
                    <textarea
                      value={bomFormData.bomDescription}
                      onChange={(e) => setBomFormData({ ...bomFormData, bomDescription: e.target.value })}
                      className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="零部件描述信息"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* 物料信息 */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">物料信息</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                      物料号 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={bomFormData.itemCode}
                      onChange={(e) => setBomFormData({ ...bomFormData, itemCode: e.target.value })}
                      className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="ENGINE-BLOCK-001"
                    />
                  </div>
                  <div>
                    <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                      物料名称 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={bomFormData.itemName}
                      onChange={(e) => setBomFormData({ ...bomFormData, itemName: e.target.value })}
                      className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="发动机缸体"
                    />
                  </div>
                  <div>
                    <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                      数量 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={bomFormData.quantity}
                      onChange={(e) => setBomFormData({ ...bomFormData, quantity: parseFloat(e.target.value) || 1 })}
                      className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                      单位 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={bomFormData.unit}
                      onChange={(e) => setBomFormData({ ...bomFormData, unit: e.target.value })}
                      className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="件">件</option>
                      <option value="个">个</option>
                      <option value="套">套</option>
                      <option value="台">台</option>
                      <option value="kg">kg</option>
                      <option value="m">m</option>
                      <option value="L">L</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                      物料描述
                    </label>
                    <textarea
                      value={bomFormData.itemDescription}
                      onChange={(e) => setBomFormData({ ...bomFormData, itemDescription: e.target.value })}
                      className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="物料详细描述"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {saving && (
                <div className="text-center text-blue-600 dark:text-blue-400 text-base font-medium">
                  保存中，请稍候...
                </div>
              )}

              {saveMessage && (
                <div className={`text-center text-base font-medium ${
                  saveMessage.includes('成功') 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {saveMessage}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={handleAddModalClose}
                disabled={saving}
                className="px-6 py-2 text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md font-medium disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSavePart}
                disabled={saving}
                className="px-6 py-2 text-base bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}