'use client'
import { useState, useEffect, useCallback } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'

interface Part {
  id: string
  partNumber: string
  name: string
  sapDescription?: string
  visible: boolean
  category?: string
  status: string
  createdAt: string
  updatedAt: string
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  pages: number
}

export default function PartsPage() {
  const [parts, setParts] = useState<Part[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [selectedPart, setSelectedPart] = useState<Part | null>(null)

  const [partFormData, setPartFormData] = useState({
    partNumber: '',
    name: '',
    sapDescription: '',
    visible: true,
    category: '',
    status: 'active'
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
      
      const response = await fetch(`/api/parts?${params}`)
      const result = await response.json()
      
      if (result.success) {
        setParts(result.data.parts)
        setPagination(result.data.pagination)
      } else {
        console.error('Failed to fetch parts:', result.error)
      }
    } catch (error) {
      console.error('Error fetching parts:', error)
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

  const handleSavePart = async () => {
    setSaving(true)
    setSaveMessage('')

    try {
      // 验证必填字段
      if (!partFormData.partNumber || !partFormData.name) {
        setSaveMessage('请填写所有必填字段')
        setSaving(false)
        return
      }

      const url = selectedPart ? `/api/parts/${selectedPart.id}` : '/api/parts'
      const method = selectedPart ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partFormData)
      })

      const result = await response.json()

      if (result.success) {
        setSaveMessage(selectedPart ? '零部件更新成功' : '零部件创建成功')
        fetchParts()
        setTimeout(() => {
          setShowAddModal(false)
          setShowEditModal(false)
          resetPartForm()
        }, 1500)
      } else {
        setSaveMessage(result.error || '保存失败')
      }
    } catch (error) {
      console.error('Save part error:', error)
      setSaveMessage('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePart = async (part: Part) => {
    if (!confirm(`确定要删除零部件"${part.name}"吗？此操作不可撤销。`)) {
      return
    }

    try {
      const response = await fetch(`/api/parts/${part.id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        alert('零部件删除成功')
        fetchParts()
      } else {
        alert('删除失败：' + (result.error || '未知错误'))
      }
    } catch (error) {
      console.error('Delete part error:', error)
      alert('删除失败')
    }
  }

  const handleEditPart = (part: Part) => {
    setSelectedPart(part)
    setPartFormData({
      partNumber: part.partNumber,
      name: part.name,
      sapDescription: part.sapDescription || '',
      visible: part.visible,
      category: part.category || '',
      status: part.status
    })
    setShowEditModal(true)
  }

  const resetPartForm = () => {
    setPartFormData({
      partNumber: '',
      name: '',
      sapDescription: '',
      visible: true,
      category: '',
      status: 'active'
    })
    setSelectedPart(null)
    setSaveMessage('')
  }

  const handleAddModalClose = () => {
    setShowAddModal(false)
    resetPartForm()
  }

  const handleEditModalClose = () => {
    setShowEditModal(false)
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

  const getVisibilityText = (visible: boolean) => {
    return visible ? '可见' : '隐藏'
  }

  const getVisibilityColor = (visible: boolean) => {
    return visible 
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
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
                placeholder="搜索零部件号、名称或SAP描述"
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

        {/* 零部件列表 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  零部件号
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  零部件名称
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  SAP描述
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  类别
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  可见性
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
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400 text-base">
                    加载中...
                  </td>
                </tr>
              ) : parts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400 text-base">
                    暂无零部件数据
                  </td>
                </tr>
              ) : (
                parts.map((part) => (
                  <tr key={part.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-base text-blue-600 dark:text-blue-400 font-mono font-medium">
                      {part.partNumber}
                    </td>
                    <td className="px-6 py-4 text-base text-gray-900 dark:text-white font-medium">
                      {part.name}
                    </td>
                    <td className="px-6 py-4 text-base text-gray-600 dark:text-gray-400 max-w-xs">
                      <div className="truncate" title={part.sapDescription || ''}>
                        {part.sapDescription || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-500 dark:text-gray-300">
                      {part.category || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getVisibilityColor(part.visible)}`}>
                        {getVisibilityText(part.visible)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(part.status)}`}>
                        {getStatusText(part.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-500 dark:text-gray-300">
                      {new Date(part.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base font-medium">
                      <button
                        onClick={() => handleEditPart(part)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3 font-medium"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeletePart(part)}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                    零部件号 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={partFormData.partNumber}
                    onChange={(e) => setPartFormData({ ...partFormData, partNumber: e.target.value })}
                    className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="PART-001"
                  />
                </div>
                <div>
                  <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                    零部件名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={partFormData.name}
                    onChange={(e) => setPartFormData({ ...partFormData, name: e.target.value })}
                    className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="零部件名称"
                  />
                </div>
                <div>
                  <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                    类别
                  </label>
                  <input
                    type="text"
                    value={partFormData.category}
                    onChange={(e) => setPartFormData({ ...partFormData, category: e.target.value })}
                    className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="零部件类别"
                  />
                </div>
                <div>
                  <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                    状态
                  </label>
                  <select
                    value={partFormData.status}
                    onChange={(e) => setPartFormData({ ...partFormData, status: e.target.value })}
                    className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="active">启用</option>
                    <option value="inactive">禁用</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SAP描述
                  </label>
                  <textarea
                    value={partFormData.sapDescription}
                    onChange={(e) => setPartFormData({ ...partFormData, sapDescription: e.target.value })}
                    className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="SAP描述信息"
                    rows={3}
                  />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={partFormData.visible}
                      onChange={(e) => setPartFormData({ ...partFormData, visible: e.target.checked })}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-base font-medium text-gray-700 dark:text-gray-300">可见</span>
                  </label>
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

      {/* 编辑零部件模态框 */}
      {showEditModal && selectedPart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                编辑零部件
              </h2>
              <button
                onClick={handleEditModalClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                    零部件号 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={partFormData.partNumber}
                    onChange={(e) => setPartFormData({ ...partFormData, partNumber: e.target.value })}
                    className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="PART-001"
                  />
                </div>
                <div>
                  <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                    零部件名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={partFormData.name}
                    onChange={(e) => setPartFormData({ ...partFormData, name: e.target.value })}
                    className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="零部件名称"
                  />
                </div>
                <div>
                  <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                    类别
                  </label>
                  <input
                    type="text"
                    value={partFormData.category}
                    onChange={(e) => setPartFormData({ ...partFormData, category: e.target.value })}
                    className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="零部件类别"
                  />
                </div>
                <div>
                  <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                    状态
                  </label>
                  <select
                    value={partFormData.status}
                    onChange={(e) => setPartFormData({ ...partFormData, status: e.target.value })}
                    className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="active">启用</option>
                    <option value="inactive">禁用</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SAP描述
                  </label>
                  <textarea
                    value={partFormData.sapDescription}
                    onChange={(e) => setPartFormData({ ...partFormData, sapDescription: e.target.value })}
                    className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="SAP描述信息"
                    rows={3}
                  />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={partFormData.visible}
                      onChange={(e) => setPartFormData({ ...partFormData, visible: e.target.checked })}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-base font-medium text-gray-700 dark:text-gray-300">可见</span>
                  </label>
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
                onClick={handleEditModalClose}
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
                更新
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}