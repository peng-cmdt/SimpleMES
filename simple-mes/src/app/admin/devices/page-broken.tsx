"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  getDeviceTypes, 
  getBrandsByDeviceType, 
  getModelsByBrand, 
  getDriversByDeviceType,
  getDeviceConfig
} from "@/lib/device-configurations";

interface DeviceTemplate {
  id: string;
  templateId: string;
  name: string;
  type: string;
  brand: string | null;
  model: string | null;
  driver: string | null;
  description: string | null;
  capabilities: any;
  configSchema: any;
  createdAt: string;
  updatedAt: string;
  _count?: {
    workstationDevices: number;
  };
}

interface DeviceTemplateFormData {
  name: string;
  type: string;
  brand: string;
  model: string;
  driver: string;
  description: string;
}

export default function DeviceTemplatesPage() {
  const [deviceTemplates, setDeviceTemplates] = useState<DeviceTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DeviceTemplate | null>(null);
  const [formData, setFormData] = useState<DeviceTemplateFormData>({
    name: '',
    type: '',
    brand: '',
    model: '',
    driver: '',
    description: ''
  });
  const [error, setError] = useState('');
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [selectedModelConfig, setSelectedModelConfig] = useState<any>(null);
  const { t } = useLanguage();

  useEffect(() => {
    loadDeviceTemplates();
  }, []);

  // 设备类型改变时更新品牌列表
  useEffect(() => {
    if (formData.type) {
      const brands = getBrandsByDeviceType(formData.type);
      setAvailableBrands(brands);
      if (!editingTemplate) {
        setFormData(prev => ({ ...prev, brand: '', model: '', driver: '' }));
        setAvailableModels([]);
        setSelectedModelConfig(null);
      }
    }
  }, [formData.type, editingTemplate]);

  // 品牌改变时更新型号列表
  useEffect(() => {
    if (formData.type && formData.brand) {
      const models = getModelsByBrand(formData.type, formData.brand);
      setAvailableModels(models);
      if (!editingTemplate) {
        setFormData(prev => ({ ...prev, model: '', driver: '' }));
        setSelectedModelConfig(null);
      }
    }
  }, [formData.type, formData.brand, editingTemplate]);

  // 型号改变时更新驱动和配置
  useEffect(() => {
    if (formData.type && formData.brand && formData.model) {
      const config = getDeviceConfig(formData.type, formData.brand, formData.model);
      if (config) {
        setSelectedModelConfig(config);
        setFormData(prev => ({
          ...prev,
          driver: config.driver
        }));
      }
    }
  }, [formData.type, formData.brand, formData.model, editingTemplate]);

  const loadDeviceTemplates = async () => {
    try {
      const response = await fetch('/api/device-templates');
      if (response.ok) {
        const data = await response.json();
        setDeviceTemplates(data.data.templates);
      }
    } catch (error) {
      console.error('Load device templates error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const url = editingTemplate ? `/api/device-templates/${editingTemplate.id}` : '/api/device-templates';
      const method = editingTemplate ? 'PUT' : 'POST';

      const templateData = {
        ...formData,
        templateId: editingTemplate?.templateId || `${formData.type}_${formData.brand}_${formData.model}`.replace(/[^A-Z0-9_]/gi, '_').toUpperCase(),
        capabilities: selectedModelConfig?.capabilities || {},
        configSchema: selectedModelConfig?.configSchema || {}
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData),
      });

      const data = await response.json();

      if (response.ok) {
        await loadDeviceTemplates();
        setShowModal(false);
        resetForm();
      } else {
        setError(data.error || t('error.operationFailed'));
      }
    } catch (error) {
      setError(t('error.networkError'));
    }
  };

  const handleDelete = async (template: DeviceTemplate) => {
    if (!confirm(`${t('admin.devices.deleteConfirm')} "${template.name}"?`)) {
      return;
    }
    try {
      const response = await fetch(`/api/device-templates/${template.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        await loadDeviceTemplates();
      } else {
        const data = await response.json();
        alert(data.error || t('error.deleteFailed'));
      }
    } catch (error) {
      alert(t('error.networkError'));
    }
  };

  const handleEdit = (template: DeviceTemplate) => {
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

  const resetForm = () => {
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
    setSelectedModelConfig(null);
  };

  const getDeviceTypeName = (type: string) => {
    if (!type || typeof type !== 'string') return type || 'Unknown';
    return t(`admin.devices.${type.toLowerCase().replace(/_/g, '')}`) || type;
  };

  if (isLoading) {
    return <AdminLayout title={t('admin.devices.title') || '设备管理'}><div>{t('common.loading') || 'Loading...'}</div></AdminLayout>;
  }

  return (
    <AdminLayout title={t('admin.devices.title') || '设备管理'}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            {t('admin.devices.deviceTemplateList') || '设备模板列表'}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t('admin.devices.deviceTemplateDescription') || '管理抽象设备模板，定义设备类型、品牌、型号和驱动信息'}
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          {t('admin.devices.addDeviceTemplate') || '添加设备模板'}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('admin.devices.templateId') || '模板ID'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('common.name') || '名称'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('admin.devices.type') || '类型'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('admin.devices.brand') || '品牌'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('admin.devices.model') || '型号'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('admin.devices.instances') || '实例数量'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('common.actions') || '操作'}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {deviceTemplates.map((template) => (
              <tr key={template.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                  {template.templateId}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-8 w-8">
                      <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                        <span className="text-white text-xs font-medium">
                          {template.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {template.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {template.description}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {getDeviceTypeName(template.type)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {template.brand || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {template.model || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {template._count?.workstationDevices || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleEdit(template)}
                    className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-4"
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(template)}
                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                  >
                    {t('common.delete')}
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
              {editingTemplate ? t('admin.devices.editDeviceTemplate') : t('admin.devices.addDeviceTemplate')}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="text-red-600 text-sm">{error}</div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('admin.devices.templateName') || '模板名称'} *
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('admin.devices.deviceType') || '设备类型'} *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="">选择设备类型</option>
                    {getDeviceTypes().map((type) => (
                      <option key={type} value={type}>
                        {getDeviceTypeName(type)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('admin.devices.brand') || '品牌'} *
                  </label>
                  <select
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                    disabled={!formData.type}
                  >
                    <option value="">选择品牌</option>
                    {availableBrands.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('admin.devices.model') || '型号'} *
                  </label>
                  <select
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                    disabled={!formData.brand}
                  >
                    <option value="">选择型号</option>
                    {availableModels.map((model, index) => (
                      <option key={`${model.model || model}-${index}`} value={model.model || model}>
                        {model.model || model}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin.devices.driver') || '驱动'} *
                </label>
                <input
                  type="text"
                  value={formData.driver}
                  onChange={(e) => setFormData({ ...formData, driver: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                  readOnly={!!selectedModelConfig}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('common.description') || '描述'}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  rows={3}
                />
              </div>

              {/* 显示配置信息 */}
              {selectedModelConfig && (
                <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">设备配置信息</h4>
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p><strong>驱动:</strong> {selectedModelConfig.driver}</p>
                    <p><strong>默认端口:</strong> {selectedModelConfig.defaultPort || 'N/A'}</p>
                    {selectedModelConfig.capabilities && (
                      <p><strong>功能:</strong> {Object.keys(selectedModelConfig.capabilities).join(', ')}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {editingTemplate ? t('common.update') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}