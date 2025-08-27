"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useLanguage } from "@/contexts/LanguageContext";

// 简化的接口定义
interface DeviceTemplate {
  id: string;
  templateId: string;
  name: string;
  type: string;
  brand: string | null;
  model: string | null;
  driver: string | null;
  description: string | null;
  capabilities: Record<string, unknown>;
  configSchema: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  _count?: {
    workstationDevices: number;
  };
}

interface FormData {
  name: string;
  type: string;
  brand: string;
  model: string;
  driver: string;
  description: string;
}

// 设备类型配置
const DEVICE_TYPES = [
  { value: 'PLC_CONTROLLER', label: 'PLC控制器' },
  { value: 'BARCODE_SCANNER', label: '扫码器' },
  { value: 'SCREWDRIVER', label: '拧紧枪控制器' },
  { value: 'PRINTER', label: '标签打印机' },
  { value: 'SENSOR', label: '传感器' },
  { value: 'CAMERA', label: '相机' },
  { value: 'ROBOT', label: '机器人' },
  { value: 'OTHER', label: '其他' }
];

const DEVICE_BRANDS = {
  PLC_CONTROLLER: ['SIEMENS', 'MITSUBISHI', 'OMRON', 'SCHNEIDER'],
  BARCODE_SCANNER: ['Honeywell', 'KEYENCE', 'IFM', 'COGNEX'],
  SCREWDRIVER: ['CLECO', 'ATLAS_COPCO', 'BOSCH'],
  PRINTER: ['Zebra', 'SATO', 'TSC'],
  SENSOR: ['KEYENCE', 'OMRON', 'SICK'],
  CAMERA: ['COGNEX', 'KEYENCE', 'BASLER'],
  ROBOT: ['ABB', 'KUKA', 'FANUC'],
  OTHER: ['Generic']
};

const DEVICE_MODELS: Record<string, string[]> = {
  'PLC_CONTROLLER-SIEMENS': ['S7_1200', 'S7_1500', 'S7_300'],
  'PLC_CONTROLLER-MITSUBISHI': ['Q_SERIES', 'FX_SERIES'],
  'BARCODE_SCANNER-Honeywell': ['Voyager_1200g', 'Xenon_1900'],
  'BARCODE_SCANNER-KEYENCE': ['SR_751', 'SR_700'],
  'SCREWDRIVER-CLECO': ['PF_3000_4000', 'Livewire'],
  'PRINTER-Zebra': ['ZT410', 'ZT230']
};

export default function DeviceManagementPage() {
  const [templates, setTemplates] = useState<DeviceTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DeviceTemplate | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    type: '',
    brand: '',
    model: '',
    driver: '',
    description: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useLanguage();

  // 加载设备模板
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/device-templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.data.templates || []);
      }
    } catch (error) {
      console.error('加载设备模板失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 获取可用品牌
  const getAvailableBrands = (type: string): string[] => {
    return (DEVICE_BRANDS as Record<string, string[]>)[type] || [];
  };

  // 获取可用型号
  const getAvailableModels = (type: string, brand: string): string[] => {
    const key = `${type}-${brand}`;
    return DEVICE_MODELS[key] || [];
  };

  // 生成驱动名称
  const generateDriver = (type: string, brand: string, model: string): string => {
    const typeMap: Record<string, string> = {
      'PLC_CONTROLLER': 'plc',
      'BARCODE_SCANNER': 'scanner',
      'SCREWDRIVER': 'screwdriver',
      'PRINTER': 'printer',
      'SENSOR': 'sensor',
      'CAMERA': 'camera',
      'ROBOT': 'robot',
      'OTHER': 'other'
    };
    
    const driverType = typeMap[type] || 'generic';
    const driverBrand = brand.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `${driverType}_${driverBrand}`;
  };

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    if (!formData.name.trim() || !formData.type || !formData.brand || !formData.model) {
      setError('请填写所有必填字段');
      setIsSubmitting(false);
      return;
    }

    try {
      const url = editingTemplate 
        ? `/api/device-templates/${editingTemplate.id}` 
        : '/api/device-templates';
      const method = editingTemplate ? 'PUT' : 'POST';

      const templateData = {
        ...formData,
        templateId: editingTemplate?.templateId || `${formData.type}_${formData.brand}_${formData.model}`.replace(/[^A-Z0-9_]/gi, '_').toUpperCase(),
        driver: formData.driver || generateDriver(formData.type, formData.brand, formData.model),
        capabilities: {},
        configSchema: {}
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(editingTemplate ? '设备模板更新成功！' : '设备模板创建成功！');
        await loadTemplates();
        // 延迟关闭模态框，让用户看到成功消息
        setTimeout(() => {
          closeModal();
        }, 1500);
      } else {
        setError(result.error || '操作失败');
      }
    } catch (error) {
      console.error('Submit error:', error);
      setError('网络错误，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 删除模板
  const handleDelete = async (template: DeviceTemplate) => {
    if (!confirm(`确定要删除设备模板 "${template.name}" 吗？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/device-templates/${template.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadTemplates();
      } else {
        const result = await response.json();
        alert(result.error || '删除失败');
      }
    } catch (error) {
      alert('删除时发生错误');
    }
  };

  // 打开编辑模态框
  const openEditModal = (template: DeviceTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      type: template.type,
      brand: template.brand || '',
      model: template.model || '',
      driver: template.driver || '',
      description: template.description || ''
    });
    setShowModal(true);
  };

  // 打开添加模态框
  const openAddModal = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      type: '',
      brand: '',
      model: '',
      driver: '',
      description: ''
    });
    setError('');
    setShowModal(true);
  };

  // 关闭模态框
  const closeModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
    setError('');
    setSuccess('');
    setIsSubmitting(false);
  };

  // 处理类型变化
  const handleTypeChange = (type: string) => {
    setFormData({
      ...formData,
      type,
      brand: '',
      model: '',
      driver: ''
    });
  };

  // 处理品牌变化
  const handleBrandChange = (brand: string) => {
    setFormData({
      ...formData,
      brand,
      model: '',
      driver: generateDriver(formData.type, brand, '')
    });
  };

  // 处理型号变化
  const handleModelChange = (model: string) => {
    setFormData({
      ...formData,
      model,
      driver: generateDriver(formData.type, formData.brand, model)
    });
  };

  // 获取设备类型显示名称
  const getTypeLabel = (type: string): string => {
    const found = DEVICE_TYPES.find(t => t.value === type);
    return found ? found.label : type;
  };

  if (isLoading) {
    return (
      <AdminLayout title="设备管理">
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">加载中...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="设备管理">
      <div className="space-y-6">
        {/* 页面标题和操作 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">设备模板管理</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              管理抽象设备模板，定义设备类型、品牌、型号和驱动信息
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            添加设备模板
          </button>
        </div>

        {/* 设备模板列表 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {templates.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 dark:text-gray-400">
                暂无设备模板，点击上方按钮添加第一个模板
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      模板信息
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      类型
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      品牌型号
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      驱动
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      实例数
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {templates.map((template) => (
                    <tr key={template.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {template.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {template.description || '无描述'}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            ID: {template.templateId}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {getTypeLabel(template.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        <div>{template.brand || 'N/A'}</div>
                        <div className="text-gray-500">{template.model || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                          {template.driver || 'N/A'}
                        </code>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {template._count?.workstationDevices || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                        <button
                          onClick={() => openEditModal(template)}
                          className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(template)}
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
          )}
        </div>
      </div>

      {/* 模态框 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {editingTemplate ? '编辑设备模板' : '添加设备模板'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md text-sm">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-md text-sm">
                    {success}
                  </div>
                )}

                {/* 模板名称 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    模板名称 *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                    placeholder="例如：PLC SIEMENS"
                    disabled={isSubmitting}
                    required
                  />
                </div>

                {/* 设备类型 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    设备类型 *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                    disabled={isSubmitting}
                    required
                  >
                    <option value="">选择设备类型</option>
                    {DEVICE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 品牌 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      品牌 *
                    </label>
                    <select
                      value={formData.brand}
                      onChange={(e) => handleBrandChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                      disabled={!formData.type || isSubmitting}
                      required
                    >
                      <option value="">选择品牌</option>
                      {getAvailableBrands(formData.type).map((brand) => (
                        <option key={brand} value={brand}>
                          {brand}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 型号 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      型号 *
                    </label>
                    <select
                      value={formData.model}
                      onChange={(e) => handleModelChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                      disabled={!formData.brand || isSubmitting}
                      required
                    >
                      <option value="">选择型号</option>
                      {getAvailableModels(formData.type, formData.brand).map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 驱动 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    驱动名称 *
                  </label>
                  <input
                    type="text"
                    value={formData.driver}
                    onChange={(e) => setFormData({ ...formData, driver: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                    placeholder="系统会自动生成，也可手动修改"
                    disabled={isSubmitting}
                    required
                  />
                </div>

                {/* 描述 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    描述
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                    rows={3}
                    placeholder="设备模板的详细描述..."
                    disabled={isSubmitting}
                  />
                </div>

                {/* 按钮 */}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50"
                    disabled={isSubmitting}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {editingTemplate ? '更新中...' : '创建中...'}
                      </>
                    ) : (
                      editingTemplate ? '更新' : '创建'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}