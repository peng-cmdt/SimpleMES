"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  getDeviceTypes, 
  getBrandsByDeviceType, 
  getModelsByBrand, 
  getDriversByDeviceType,
  getDeviceConfig,
  getBrandCodeByName,
  getModelCodeByName,
  type DeviceModel,
  type DeviceSpec
} from "@/lib/device-configurations";

interface Device {
  id: string;
  deviceId: string;
  name: string;
  type: string;
  brand: string | null;
  model: string | null;
  description: string | null;
  workstationId: string | null;
  workstation?: {
    id: string;
    name: string;
    workstationId: string;
  } | null;
  ipAddress: string | null;
  port: number | null;
  protocol: string | null;
  connectionString: string | null;
  status: string;
  isOnline: boolean;
  lastConnected: string | null;
  lastHeartbeat: string | null;
  createdAt: string;
  updatedAt: string;
  driver: string | null;
}

interface Workstation {
  id: string;
  workstationId: string;
  name: string;
}

interface DeviceFormData {
  name: string;
  type: string;
  brand: string;
  model: string;
  driver: string;
  description: string;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [formData, setFormData] = useState<DeviceFormData>({
    name: '',
    type: '',
    brand: '',
    model: '',
    description: '',
    driver: ''
  });
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  // 级联选择相关状态
  const [availableBrands, setAvailableBrands] = useState<{value: string; label: string; description: string}[]>([]);
  const [availableModels, setAvailableModels] = useState<{value: string; label: string; description: string; driver: string; plcType?: string; defaultPort?: number; specifications?: DeviceSpec[]}[]>([]);
  const [selectedModelConfig, setSelectedModelConfig] = useState<DeviceModel | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    loadDevices();
    
    // 设置自动刷新，每10秒检查一次设备状态
    const interval = setInterval(() => {
      loadDevices();
      setLastUpdated(new Date());
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // 设备类型改变时更新品牌列表
  useEffect(() => {
    if (formData.type) {
      const brands = getBrandsByDeviceType(formData.type);
      setAvailableBrands(brands);
      // 只在非编辑模式下重置品牌和型号选择
      if (!editingDevice) {
        setFormData(prev => ({ ...prev, brand: '', model: '', driver: '', plcType: '' }));
        setAvailableModels([]);
        setSelectedModelConfig(null);
      }
    }
  }, [formData.type, editingDevice]);

  // 品牌改变时更新型号列表
  useEffect(() => {
    if (formData.type && formData.brand) {
      const models = getModelsByBrand(formData.type, formData.brand);
      setAvailableModels(models);
      // 只在非编辑模式下重置型号选择
      if (!editingDevice) {
        setFormData(prev => ({ ...prev, model: '', driver: '', plcType: '' }));
        setSelectedModelConfig(null);
      }
    }
  }, [formData.type, formData.brand, editingDevice]);

  // 型号改变时自动填充驱动等信息
  useEffect(() => {
    if (formData.type && formData.brand && formData.model) {
      const config = getDeviceConfig(formData.type, formData.brand, formData.model);
      if (config) {
        setSelectedModelConfig(config);
        setFormData(prev => ({
          ...prev,
          driver: config.driver,
          plcType: config.plcType || '',
          port: config.defaultPort || prev.port
        }));
      }
    }
  }, [formData.type, formData.brand, formData.model]);

  const loadDevices = async () => {
    try {
      const response = await fetch('/api/devices');
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices);
      }
    } catch (error) {
      console.error('Load devices error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    setError('');

    try {
      const url = editingDevice ? `/api/devices/${editingDevice.id}` : '/api/devices';
      const method = editingDevice ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        await loadDevices();
        setShowModal(false);
        resetForm();
      } else {
        setError(data.error || t('error.operationFailed'));
      }
    } catch (error) {
      setError(t('error.networkError'));
    }
  };

  const handleDelete = async (device: Device) => {
    if (!confirm(`${t('admin.devices.deleteConfirm')} "${device.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/devices/${device.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadDevices();
      } else {
        const data = await response.json();
        alert(data.error || t('error.deleteFailed'));
      }
    } catch (error) {
      alert(t('error.networkError'));
    }
  };

  const handleEdit = (device: Device) => {
    setEditingDevice(device);
    
    // 调试信息
    console.log('🔍 编辑设备调试信息:');
    console.log('设备信息:', device);
    console.log('品牌值:', device.brand);
    console.log('型号值:', device.model);
    
    // 立即设置表单数据
    setFormData({
      name: device.name,
      type: device.type,
      brand: device.brand || '',
      model: device.model || '',
      description: device.description || '',
      driver: device.driver || ''
    });
    
    // 立即初始化级联选择选项
    if (device.type) {
      const brands = getBrandsByDeviceType(device.type);
      setAvailableBrands(brands);
      console.log('可用品牌:', brands);
      
      if (device.brand) {
        const models = getModelsByBrand(device.type, device.brand);
        setAvailableModels(models);
        console.log('可用型号:', models);
        
        if (device.model) {
          const config = getDeviceConfig(device.type, device.brand, device.model);
          setSelectedModelConfig(config);
          console.log('设备配置:', config);
        }
      }
    }
    
    console.log('表单数据将设置为:', {
      name: device.name,
      type: device.type,
      brand: device.brand || '',
      model: device.model || '',
      description: device.description || '',
      driver: device.driver || ''
    });
    
    // 显示模态框
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingDevice(null);
    setFormData({
      name: '',
      type: '',
      brand: '',
      model: '',
      description: '',
      driver: ''
    });
    setAvailableBrands([]);
    setAvailableModels([]);
    setSelectedModelConfig(null);
    setError('');
  };

  const getDeviceTypeName = (type: string) => {
    const deviceTypes = getDeviceTypes();
    const deviceType = deviceTypes.find(dt => dt.value === type);
    return deviceType ? deviceType.label : type;
  };

  const getStatusColor = (status: string, isOnline: boolean) => {
    if (isOnline && status?.toUpperCase() === 'ONLINE') {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    } else if (status?.toUpperCase() === 'ERROR') {
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    } else if (status?.toUpperCase() === 'MAINTENANCE') {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    } else {
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string, isOnline: boolean) => {
    if (isOnline && status?.toUpperCase() === 'ONLINE') {
      return t('admin.devices.statusOnline');
    } else if (status?.toUpperCase() === 'ERROR') {
      return t('admin.devices.statusError');
    } else if (status?.toUpperCase() === 'MAINTENANCE') {
      return t('admin.devices.statusMaintenance');
    } else {
      return t('admin.devices.statusOffline');
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title={t('admin.devices.title')}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={t('admin.devices.title')}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            {t('admin.devices.title')}
          </h2>
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('admin.devices.subtitle')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
              {t('common.lastUpdated')}: {lastUpdated.toLocaleTimeString('zh-CN')}
            </p>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => {
              loadDevices();
              setLastUpdated(new Date());
            }}
            className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t('common.refresh')}
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {t('admin.devices.addDevice')}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('admin.devices.deviceName')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('admin.devices.deviceType')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                品牌
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                驱动名称
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                型号
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('common.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {devices.map((device) => (
              <tr key={device.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{device.name}</div>
                    <div className="text-xs text-gray-400">{device.description || '暂无描述'}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {getDeviceTypeName(device.type)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {device.brand || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {device.driver || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {device.model || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleEdit(device)}
                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(device)}
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
              {editingDevice ? t('admin.devices.editDevice') : t('admin.devices.addDevice')}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('admin.devices.deviceName')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="设备名称"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin.devices.deviceType')}
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="">请选择设备类型</option>
                    {getDeviceTypes().map((deviceType) => (
                      <option key={deviceType.value} value={deviceType.value}>
                        {deviceType.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    设备驱动
                  </label>
                  <select
                    value={formData.driver}
                    onChange={(e) => setFormData({ ...formData, driver: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    disabled
                  >
                    <option value="">{formData.type ? '请先选择型号' : '请先选择设备类型'}</option>
                    {formData.driver && (
                      <option value={formData.driver}>{formData.driver}</option>
                    )}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">驱动程序会根据选择的型号自动设置</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin.devices.brand')}
                  </label>
                  <select
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="">{availableBrands.length > 0 ? '请选择品牌' : '请先选择设备类型'}</option>
                    {availableBrands.map((brand) => (
                      <option key={brand.value} value={brand.value}>
                        {brand.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin.devices.model')}
                  </label>
                  <select
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="">{availableModels.length > 0 ? '请选择型号' : '请先选择品牌'}</option>
                    {availableModels.map((model) => (
                      <option key={model.value} value={model.value}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                  {selectedModelConfig && (
                    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs">
                      <p><strong>描述:</strong> {selectedModelConfig.description}</p>
                      {selectedModelConfig.specifications && (
                        <div className="mt-1">
                          <strong>规格:</strong>
                          {selectedModelConfig.specifications.map((spec, index) => (
                            <span key={index} className="ml-2">
                              {spec.name}: {spec.value}{spec.unit ? ` ${spec.unit}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('admin.devices.description')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  rows={3}
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
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {editingDevice ? t('common.update') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}