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
  const [formData, setFormData] = useState<any>({
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
      const response = await fetch('/api/device-templates?limit=1000&_t=' + Date.now());
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

  const getAvailableBrands = (type: string): string[] => {
    if (type === 'BARCODE_SCANNER') return ['NETWORK', 'USB_KEYBOARD'];
    return (DEVICE_BRANDS as Record<string, string[]>)[type] || [];
  };

  const getAvailableModels = (type: string, brand: string): string[] => {
    if (type === 'BARCODE_SCANNER') {
        if (brand === 'NETWORK') return ['Honeywell', 'KEYENCE', 'IFM', 'COGNEX'];
        return [];
    }
    const key = `${type}-${brand}`;
    return DEVICE_MODELS[key] || [];
  };

  const generateDriver = (type: string, brand: string, model: string): string => {
    if (type === 'BARCODE_SCANNER' && brand === 'USB_KEYBOARD') {
      return 'hid_keyboard'; // No special driver needed
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    let validationError = '';
    if (!formData.name.trim() || !formData.type) {
      validationError = '请填写模板名称和选择设备类型';
    } else if (formData.type === 'BARCODE_SCANNER') {
      if (!formData.brand) validationError = '请选择扫码枪类型';
    } else if (!formData.brand || !formData.model) {
      validationError = '请选择品牌和型号';
    }

    if (validationError) {
      setError(validationError);
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
        templateId: editingTemplate?.templateId || `${formData.type}_${formData.brand}_${formData.model || ''}`.replace(/[^A-Z0-9_]/gi, '_').toUpperCase(),
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

  const closeModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
    setError('');
    setSuccess('');
    setIsSubmitting(false);
  };

  const handleFormChange = (field: string, value: any) => {
    const newFormData = { ...formData, [field]: value };
    if (field === 'type') {
      newFormData.brand = '';
      newFormData.model = '';
    }
    if (field === 'brand') {
      newFormData.model = '';
    }
    newFormData.driver = generateDriver(newFormData.type, newFormData.brand, newFormData.model);
    setFormData(newFormData);
  };

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
      {/* 页面头部 */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">设备模板管理</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">管理和配置设备模板，用于创建设备实例</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors duration-200"
          >
            添加设备模板
          </button>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-blue-600">{templates.length}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">总模板数</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-600">{templates.filter(t => t._count?.workstationDevices > 0).length}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">已使用模板</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-purple-600">{templates.reduce((sum, t) => sum + (t._count?.workstationDevices || 0), 0)}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">设备实例数</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-orange-600">{new Set(templates.map(t => t.type)).size}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">设备类型数</div>
        </div>
      </div>

      {/* 设备模板列表 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {templates.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 dark:text-gray-400 mb-4">暂无设备模板</div>
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors duration-200"
            >
              创建第一个模板
            </button>
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
                    设备类型
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    品牌/型号
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    驱动
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    使用统计
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {templates.map((template) => (
                  <tr key={template.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{template.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{template.templateId}</div>
                        {template.description && (
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{template.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">{getTypeLabel(template.type)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {template.brand || '-'}
                        {template.model && ` / ${template.model}`}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">{template.driver || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {template._count?.workstationDevices || 0} 个实例
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openEditModal(template)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(template)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 模态框 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{editingTemplate ? '编辑设备模板' : '添加设备模板'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md text-sm">{error}</div>}
                {success && <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-md text-sm">{success}</div>}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">模板名称 *</label>
                  <input type="text" value={formData.name} onChange={(e) => handleFormChange('name', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">设备类型 *</label>
                  <select value={formData.type} onChange={(e) => handleFormChange('type', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md" required>
                    <option value="">选择设备类型</option>
                    {DEVICE_TYPES.map((type) => (<option key={type.value} value={type.value}>{type.label}</option>))}
                  </select>
                </div>

                {formData.type === 'BARCODE_SCANNER' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">扫码枪类型 *</label>
                    <select value={formData.brand} onChange={(e) => handleFormChange('brand', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md" required>
                      <option value="">选择类型</option>
                      <option value="NETWORK">网络型</option>
                      <option value="USB_KEYBOARD">USB键盘模式</option>
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">品牌 *</label>
                      <select value={formData.brand} onChange={(e) => handleFormChange('brand', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md" disabled={!formData.type} required>
                        <option value="">选择品牌</option>
                        {getAvailableBrands(formData.type).map((brand) => (<option key={brand} value={brand}>{brand}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">型号 *</label>
                      <select value={formData.model} onChange={(e) => handleFormChange('model', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md" disabled={!formData.brand} required>
                        <option value="">选择型号</option>
                        {getAvailableModels(formData.type, formData.brand).map((model) => (<option key={model} value={model}>{model}</option>))}
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">驱动名称 *</label>
                  <input type="text" value={formData.driver} onChange={(e) => handleFormChange('driver', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">描述</label>
                  <textarea value={formData.description} onChange={(e) => handleFormChange('description', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md" rows={3} />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md">取消</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md" disabled={isSubmitting}>{isSubmitting ? '处理中...' : (editingTemplate ? '更新' : '创建')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}