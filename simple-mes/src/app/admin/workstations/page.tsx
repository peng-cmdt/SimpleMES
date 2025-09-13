"use client";

import { useEffect, useState, Fragment } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useLanguage } from "@/contexts/LanguageContext";

// Interfaces
interface Workstation {
  id: string;
  workstationId: string;
  name: string;
  description: string | null;
  location: string | null;
  configuredIp: string;
  currentIp: string | null;
  status: string;
  lastConnected: string | null;
  settings: any;
  createdAt: string;
  updatedAt: string;
  devices?: Device[];
}

interface Device {
  id: string;
  deviceId: string;
  name: string;
  type: string;
  brand: string | null;
  model: string | null;
  ipAddress: string | null;
  port: number | null;
  status: string | null;
  workstationId: string | null;
}

interface WorkstationFormData {
  workstationId: string;
  name: string;
  description: string;
  location: string;
  configuredIp: string;
}

export default function WorkstationsPage() {
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [showEditDeviceModal, setShowEditDeviceModal] = useState(false);
  const [expandedWorkstationId, setExpandedWorkstationId] = useState<string | null>(null);
  const [editingWorkstation, setEditingWorkstation] = useState<Workstation | null>(null);
  const [selectedWorkstation, setSelectedWorkstation] = useState<Workstation | null>(null);
  const [availableDeviceTypes, setAvailableDeviceTypes] = useState<any[]>([]);
  const [showAddWorkstationModal, setShowAddWorkstationModal] = useState(false);
  const [newWorkstationFormData, setNewWorkstationFormData] = useState<WorkstationFormData>({
    workstationId: '',
    name: '',
    description: '',
    location: '',
    configuredIp: ''
  });
  const [newDeviceFormData, setNewDeviceFormData] = useState<{
    name: string;
    deviceTypeId: string;
    ipAddress: string;
    port: string;
    plcType: string;
    rack: string;
    slot: string;
  }>({
    name: '',
    deviceTypeId: '',
    ipAddress: '',
    port: '',
    plcType: '',
    rack: '0',
    slot: '1'
  });
  const [activeTab, setActiveTab] = useState('info');
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deviceFormData, setDeviceFormData] = useState<Partial<Device>>({});
  const [formData, setFormData] = useState<Partial<WorkstationFormData>>({});
  const [error, setError] = useState('');
  const { t } = useLanguage();

  useEffect(() => {
    loadWorkstations();
    loadAvailableDeviceTypes();
  }, []);

  const loadAvailableDeviceTypes = async () => {
    try {
      // 获取所有设备模板用作设备类型选择，设置高限制以获取所有模板
      const response = await fetch('/api/device-templates?limit=1000&_t=' + Date.now());
      if (response.ok) {
        const data = await response.json();
        // 这些是设备管理中创建的设备模板
        // 可以在工位中基于这些模板创建具体的设备实例
        setAvailableDeviceTypes(data.data.templates || []);
        
        console.log('Available device templates:', data.data.templates?.length || 0);
      }
    } catch (error) {
      console.error('Load available device types error:', error);
    }
  };

  const loadWorkstations = async () => {
    try {
      // 添加缓存破坏参数
      const response = await fetch(`/api/workstations?_t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        console.log('加载工位数据:', data.workstations); // Debug log
        setWorkstations(data.workstations);
        
        // 如果当前有编辑中的工位，从新数据中更新它
        if (editingWorkstation?.id) {
          const updatedEditingWorkstation = data.workstations.find(ws => ws.id === editingWorkstation.id);
          if (updatedEditingWorkstation) {
            setEditingWorkstation(updatedEditingWorkstation);
            console.log('更新编辑工位数据:', updatedEditingWorkstation.devices?.length, '个设备'); // Debug log
          }
        }
      }
    } catch (error) {
      console.error('Load workstations error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowClick = (workstation: Workstation) => {
    if (expandedWorkstationId === workstation.id) {
      setExpandedWorkstationId(null);
      setEditingWorkstation(null);
    } else {
      setEditingWorkstation(workstation);
      setFormData({ ...workstation });
      setExpandedWorkstationId(workstation.id);
      setActiveTab('info');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkstation) return;
    try {
      await fetch(`/api/workstations/${editingWorkstation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      // 只需要重新加载工位数据，loadWorkstations会自动更新editingWorkstation
      await loadWorkstations();
      setExpandedWorkstationId(null);
    } catch (err) { setError('Failed to save workstation') }
  };

  const handleDelete = async (workstationId: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await fetch(`/api/workstations/${workstationId}`, { method: 'DELETE' });
      // 只需要重新加载工位数据，loadWorkstations会自动更新editingWorkstation
      await loadWorkstations();
    } catch (err) { alert('Failed to delete') }
  };

  const handleAddWorkstation = () => {
    setNewWorkstationFormData({
      workstationId: '',
      name: '',
      description: '',
      location: '',
      configuredIp: ''
    });
    setShowAddWorkstationModal(true);
  };

  const handleCreateWorkstation = async () => {
    try {
      const response = await fetch('/api/workstations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWorkstationFormData),
      });

      if (response.ok) {
        setShowAddWorkstationModal(false);
        // 重置表单
        setNewWorkstationFormData({
          workstationId: '',
          name: '',
          description: '',
          location: '',
          configuredIp: ''
        });
        // 只需要重新加载工位数据，loadWorkstations会自动更新editingWorkstation
        await loadWorkstations();
      } else {
        const errorData = await response.json();
        alert(`创建工位失败: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Create workstation error:', error);
      alert('创建工位失败');
    }
  };

  const handleEditDeviceClick = (device: Device) => {
    setEditingDevice(device);
    setDeviceFormData(device);
    setShowEditDeviceModal(true);
  };

  const handleUpdateDevice = async () => {
    if (!deviceFormData.id) return;
    try {
      // 准备工位设备更新数据，映射到正确的字段名
      const updateData = {
        displayName: deviceFormData.name, // 前端使用name，后端使用displayName
        ipAddress: deviceFormData.ipAddress,
        port: deviceFormData.port ? parseInt(deviceFormData.port.toString()) : null,
        protocol: deviceFormData.protocol || 'TCP',
        status: deviceFormData.status || 'OFFLINE'
      };

      const response = await fetch(`/api/workstation-devices/${deviceFormData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      
      if (response.ok) {
        setShowEditDeviceModal(false);
        setEditingDevice(null);
        setDeviceFormData({});
        
        // 只需要重新加载工位数据，loadWorkstations会自动更新editingWorkstation
        await loadWorkstations();
        
        alert('设备更新成功！');
      } else {
        const errorData = await response.json();
        alert(`更新设备失败: ${errorData.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('Update device error:', error);
      alert(`更新设备时发生错误: ${error.message}`);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    // 找到要删除的设备
    const deviceToDelete = editingWorkstation?.devices?.find(d => d.id === deviceId);
    
    if (!confirm('确定要删除这个设备吗？此操作将清理所有相关数据且不可恢复。')) return;
    
    try {
      console.log('正在删除设备:', deviceId, '设备名称:', deviceToDelete?.name); // Debug log
      
      const response = await fetch(`/api/workstation-devices/${deviceId}`, { 
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      console.log('删除响应状态:', response.status); // Debug log
      console.log('响应Content-Type:', response.headers.get('content-type')); // Debug log
      
      // 先获取响应文本
      const responseText = await response.text();
      console.log('原始响应:', responseText.substring(0, 200)); // Debug log
      
      // 检查是否为HTML响应（错误页面）
      if (responseText.startsWith('<!DOCTYPE') || responseText.startsWith('<html')) {
        throw new Error(`服务器返回了错误页面，状态码: ${response.status}`);
      }
      
      // 尝试解析JSON
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`无法解析服务器响应: ${parseError.message}`);
      }
      
      if (response.ok) {
        setShowEditDeviceModal(false);
        setEditingDevice(null);
        setDeviceFormData({});
        
        // 只需要重新加载工位数据，loadWorkstations会自动更新editingWorkstation
        await loadWorkstations();
        
        const archType = result.deviceType === 'device' ? '旧架构' : '新架构';
        alert(`${archType}设备删除成功！`);
      } else {
        alert(`删除失败：${result.error || result.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('Delete device error:', error);
      alert(`删除设备时发生错误：${error.message}`);
    }
  };

  const handleAddDeviceToWorkstation = async () => {
    if (!editingWorkstation) return;
    setSelectedWorkstation(editingWorkstation);
    await loadAvailableDeviceTypes();
    // 重置表单数据
    setNewDeviceFormData({
      name: '',
      deviceTypeId: '',
      ipAddress: '',
      port: '',
      plcType: '',
      rack: '0',
      slot: '1'
    });
    setShowAddDeviceModal(true);
  };


  const handleCreateDeviceInstance = async () => {
    if (!selectedWorkstation || !newDeviceFormData.deviceTypeId) return;
    
    try {
      // 获取选中的设备模板信息
      const selectedTemplate = availableDeviceTypes.find(d => d.id === newDeviceFormData.deviceTypeId);
      if (!selectedTemplate) {
        alert('请选择设备模板');
        return;
      }

      // 基于设备模板创建工位设备实例
      const deviceData: any = {
        workstationId: selectedWorkstation.id,
        templateId: selectedTemplate.id,
        displayName: newDeviceFormData.name || `${selectedTemplate.name} - ${selectedWorkstation.name}`,
        ipAddress: newDeviceFormData.ipAddress,
        port: newDeviceFormData.port ? parseInt(newDeviceFormData.port) : null,
        protocol: 'TCP',
        status: 'OFFLINE'
      };

      // 如果是PLC设备，添加PLC特定配置
      if (selectedTemplate.type === 'PLC_CONTROLLER') {
        const config: any = {};
        
        // 添加PLC类型
        if (newDeviceFormData.plcType) {
          config.plcType = newDeviceFormData.plcType;
        }
        
        // 只对西门子PLC添加rack和slot参数
        if (newDeviceFormData.plcType === 'Siemens_S7') {
          if (newDeviceFormData.rack) {
            config.rack = parseInt(newDeviceFormData.rack);
          }
          if (newDeviceFormData.slot) {
            config.slot = parseInt(newDeviceFormData.slot);
          }
        }
        
        deviceData.config = config;
      }

      const response = await fetch('/api/workstation-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deviceData)
      });

      if (response.ok) {
        setShowAddDeviceModal(false);
        // 重置表单
        setNewDeviceFormData({
          name: '',
          deviceTypeId: '',
          ipAddress: '',
          port: '',
          plcType: '',
          rack: '0',
          slot: '1'
        });
        
        // 只需要重新加载工位数据，loadWorkstations会自动更新editingWorkstation
        await loadWorkstations();
        
        alert('设备创建成功！');
      } else {
        const errorData = await response.json();
        alert(`创建工位设备失败: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Create workstation device error:', error);
      alert('创建工位设备实例失败');
    }
  };

  const getDeviceTypeName = (type: string) => t(`admin.devices.${type.toLowerCase().replace(/_/g, '')}`) || type;
  const getStatusColor = (status: string) => {
    const upperStatus = status?.toUpperCase();
    switch (upperStatus) {
      case 'ONLINE':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'OFFLINE':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'UNAUTHORIZED':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'ERROR':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  if (isLoading) {
    return <AdminLayout title={t('admin.workstations.title') || '工位管理'}><div>{t('common.loading') || 'Loading...'}</div></AdminLayout>;
  }

  return (
    <AdminLayout title={t('admin.workstations.title') || '工位管理'}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">
          {t('admin.workstations.workstationList') || '工位列表'}
        </h2>
        <button 
          onClick={handleAddWorkstation} 
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          {t('admin.workstations.addWorkstation') || '添加新工位'}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('admin.workstations.workstationId') || '工位ID'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('common.name') || '名称'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('admin.workstations.configuredIp') || '配置IP'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('common.status') || '状态'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('admin.workstations.deviceCount') || '设备数量'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('common.actions') || '操作'}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {workstations.map((workstation) => (
              <Fragment key={workstation.id}>
                <tr onClick={() => handleRowClick(workstation)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4">{workstation.workstationId}</td>
                  <td className="px-6 py-4">{workstation.name}</td>
                  <td className="px-6 py-4">{workstation.configuredIp}</td>
                  <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(workstation.status)}`}>{workstation.status}</span></td>
                  <td className="px-6 py-4">{workstation.devices?.length || 0}</td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(workstation.id); }}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      {t('common.delete') || '删除'}
                    </button>
                  </td>
                </tr>
                {expandedWorkstationId === workstation.id && (
                  <tr>
                    <td colSpan={6} className="p-4 bg-gray-100 dark:bg-gray-900">
                      <div className="border-b border-gray-200 dark:border-gray-700">
                        <nav className="-mb-px flex space-x-8">
                          <button 
                            onClick={() => setActiveTab('info')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${
                              activeTab === 'info'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                          >
                            {t('admin.workstations.tab.info') || 'Info'}
                          </button>
                          <button 
                            onClick={() => setActiveTab('devices')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${
                              activeTab === 'devices'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                          >
                            {t('admin.workstations.tab.devices') || 'Devices'}
                          </button>
                        </nav>
                      </div>
                      <div className="py-6">
                        {activeTab === 'info' && (
                          <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  {t('admin.workstations.workstationId') || 'Workstation ID'}
                                </label>
                                <input 
                                  type="text" 
                                  value={formData.workstationId || ''} 
                                  onChange={(e) => setFormData({ ...formData, workstationId: e.target.value })} 
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white" 
                                  required 
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  {t('admin.workstations.workstationName') || 'Workstation Name'}
                                </label>
                                <input 
                                  type="text" 
                                  value={formData.name || ''} 
                                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white" 
                                  required 
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  {t('admin.workstations.configuredIpAddress') || 'Configured IP Address'}
                                </label>
                                <input 
                                  type="text" 
                                  value={formData.configuredIp || ''} 
                                  onChange={(e) => setFormData({ ...formData, configuredIp: e.target.value })} 
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white" 
                                  required 
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  {t('common.description') || 'Description'}
                                </label>
                                <input 
                                  type="text" 
                                  value={formData.description || ''} 
                                  onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white" 
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {t('admin.workstations.location') || 'Location'}
                              </label>
                              <input 
                                type="text" 
                                value={formData.location || ''} 
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })} 
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white" 
                              />
                            </div>
                            <div className="flex justify-end pt-4">
                              <button 
                                type="submit" 
                                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                              >
                                {t('common.save') || 'Save'}
                              </button>
                            </div>
                          </form>
                        )}
                        {activeTab === 'devices' && (
                          <div className="space-y-6">
                            <div className="flex justify-between items-center">
                              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                {t('admin.workstations.workstationDevices') || 'Associated Devices'}
                              </h3>
                              <button 
                                onClick={handleAddDeviceToWorkstation} 
                                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
                              >
                                {t('admin.workstations.addDeviceToWorkstation') || 'Add Device'}
                              </button>
                            </div>
                            
                            {editingWorkstation?.devices && editingWorkstation.devices.length > 0 ? (
                              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <div className="grid grid-cols-1 gap-1">
                                  {editingWorkstation.devices.map((device, index) => (
                                    <div 
                                      key={device.id} 
                                      onClick={() => handleEditDeviceClick(device)} 
                                      className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                                        index !== editingWorkstation.devices.length - 1 ? 'border-b border-gray-200 dark:border-gray-700' : ''
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center space-x-3">
                                            <div className="flex-shrink-0">
                                              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                                <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                                                  {device.name.charAt(0).toUpperCase()}
                                                </span>
                                              </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center space-x-2">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                  {device.name}
                                                </p>
                                                <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(device.status || 'offline')}`}>
                                                  {device.status || 'offline'}
                                                </span>
                                              </div>
                                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                                {getDeviceTypeName(device.type)}
                                                {device.brand && ` • ${device.brand}`}
                                                {device.model && ` ${device.model}`}
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex-1 min-w-0 ml-4">
                                          <div className="flex items-center space-x-2">
                                            <div className="text-sm text-gray-900 dark:text-white">
                                              <span className="font-medium">IP:</span> {device.ipAddress || 'N/A'}
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                              <span className="font-medium">端口:</span> {device.port || 'N/A'}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-8">
                                <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                  </svg>
                                </div>
                                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                                  {t('admin.workstations.noDevices') || 'No devices'}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {t('admin.workstations.noDevicesDesc') || 'Click the button above to add devices to this workstation'}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* 新增工位模态框 */}
      {showAddWorkstationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {t('admin.workstations.addWorkstation') || '添加新工位'}
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin.workstations.workstationId') || '工位ID'}
                  </label>
                  <input
                    type="text"
                    value={newWorkstationFormData.workstationId}
                    onChange={(e) => setNewWorkstationFormData({...newWorkstationFormData, workstationId: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="例如: WS001"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin.workstations.workstationName') || '工位名称'}
                  </label>
                  <input
                    type="text"
                    value={newWorkstationFormData.name}
                    onChange={(e) => setNewWorkstationFormData({...newWorkstationFormData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="例如: 装配工位1"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin.workstations.configuredIpAddress') || '配置IP地址'}
                  </label>
                  <input
                    type="text"
                    value={newWorkstationFormData.configuredIp}
                    onChange={(e) => setNewWorkstationFormData({...newWorkstationFormData, configuredIp: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="192.168.1.100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin.workstations.location') || '位置'}
                  </label>
                  <input
                    type="text"
                    value={newWorkstationFormData.location}
                    onChange={(e) => setNewWorkstationFormData({...newWorkstationFormData, location: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="例如: 车间A区域1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('common.description') || '描述'}
                </label>
                <textarea
                  value={newWorkstationFormData.description}
                  onChange={(e) => setNewWorkstationFormData({...newWorkstationFormData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  rows={3}
                  placeholder="工位描述信息"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button 
                type="button" 
                onClick={() => {
                  setShowAddWorkstationModal(false);
                  setNewWorkstationFormData({
                    workstationId: '',
                    name: '',
                    description: '',
                    location: '',
                    configuredIp: ''
                  });
                }} 
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                {t('common.cancel') || '取消'}
              </button>
              <button 
                onClick={handleCreateWorkstation}
                disabled={!newWorkstationFormData.workstationId || !newWorkstationFormData.name || !newWorkstationFormData.configuredIp}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.create') || '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddDeviceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">为 {selectedWorkstation?.name} 添加新设备</h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    选择设备类型
                  </label>
                  <button
                    type="button"
                    onClick={loadAvailableDeviceTypes}
                    className="text-blue-600 hover:text-blue-800 text-xs underline"
                  >
                    🔄 刷新设备列表
                  </button>
                </div>
                {availableDeviceTypes.length === 0 ? (
                  <div className="w-full px-3 py-2 border border-orange-300 bg-orange-50 dark:bg-orange-900/20 rounded-md">
                    <div className="flex items-center justify-between">
                      <span className="text-orange-700 dark:text-orange-400 text-sm">
                        暂无可用的设备模板
                      </span>
                      <a 
                        href="/admin/devices" 
                        target="_blank"
                        className="text-blue-600 hover:text-blue-800 text-sm underline"
                      >
                        前往设备管理创建 →
                      </a>
                    </div>
                  </div>
                ) : (
                  <select
                    value={newDeviceFormData.deviceTypeId}
                    onChange={(e) => setNewDeviceFormData({...newDeviceFormData, deviceTypeId: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="">请选择设备类型</option>
                    {availableDeviceTypes.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} ({template.brand} {template.model})
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {availableDeviceTypes.length > 0 
                    ? '从设备管理中创建的设备模板中选择，将基于此模板创建工位专用的设备实例' 
                    : '请先到设备管理页面创建设备模板'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  设备实例名称
                </label>
                <input
                  type="text"
                  value={newDeviceFormData.name}
                  onChange={(e) => setNewDeviceFormData({...newDeviceFormData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="例如: M1工位PLC"
                />
                <p className="text-xs text-gray-500 mt-1">为空时将自动生成名称</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    IP地址
                  </label>
                  <input
                    type="text"
                    value={newDeviceFormData.ipAddress}
                    onChange={(e) => setNewDeviceFormData({...newDeviceFormData, ipAddress: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="192.168.1.100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    端口
                  </label>
                  <input
                    type="number"
                    value={newDeviceFormData.port}
                    onChange={(e) => setNewDeviceFormData({...newDeviceFormData, port: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="502"
                    required
                  />
                </div>
              </div>

              {/* PLC配置参数 */}
              {newDeviceFormData.deviceTypeId && (() => {
                const selectedTemplate = availableDeviceTypes.find(d => d.id === newDeviceFormData.deviceTypeId);
                return selectedTemplate?.type === 'PLC_CONTROLLER' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        PLC类型
                      </label>
                      <select
                        value={newDeviceFormData.plcType}
                        onChange={(e) => setNewDeviceFormData({...newDeviceFormData, plcType: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">自动检测（基于端口）</option>
                        <option value="Siemens_S7">西门子 S7</option>
                        <option value="Mitsubishi_MC">三菱 Q系列</option>
                        <option value="Modbus_TCP">Modbus TCP</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">留空将根据端口自动检测协议类型</p>
                    </div>

                    {/* 只对西门子PLC显示Rack和Slot配置 */}
                    {newDeviceFormData.plcType === 'Siemens_S7' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Rack
                          </label>
                          <input
                            type="number"
                            value={newDeviceFormData.rack}
                            onChange={(e) => setNewDeviceFormData({...newDeviceFormData, rack: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            placeholder="0"
                          />
                          <p className="text-xs text-gray-500 mt-1">西门子PLC的机架号，通常为0</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Slot
                          </label>
                          <input
                            type="number"
                            value={newDeviceFormData.slot}
                            onChange={(e) => setNewDeviceFormData({...newDeviceFormData, slot: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            placeholder="1"
                          />
                          <p className="text-xs text-gray-500 mt-1">西门子PLC的插槽号，通常为1</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null;
              })()}

              {/* 显示选中设备模板的详细信息 */}
              {newDeviceFormData.deviceTypeId && (() => {
                const selectedTemplate = availableDeviceTypes.find(d => d.id === newDeviceFormData.deviceTypeId);
                return selectedTemplate ? (
                  <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">设备模板信息</h4>
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      <p><strong>类型:</strong> {selectedTemplate.type}</p>
                      <p><strong>品牌:</strong> {selectedTemplate.brand}</p>
                      <p><strong>型号:</strong> {selectedTemplate.model}</p>
                      <p><strong>驱动:</strong> {selectedTemplate.driver}</p>
                      {selectedTemplate.description && <p><strong>描述:</strong> {selectedTemplate.description}</p>}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button 
                type="button" 
                onClick={() => {
                  setShowAddDeviceModal(false);
                  setNewDeviceFormData({
                    name: '',
                    deviceTypeId: '',
                    ipAddress: '',
                    port: '',
                    plcType: '',
                    rack: '0',
                    slot: '1'
                  });
                }} 
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                取消
              </button>
              <button 
                onClick={handleCreateDeviceInstance}
                disabled={!newDeviceFormData.deviceTypeId || !newDeviceFormData.ipAddress || !newDeviceFormData.port}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                创建设备实例
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditDeviceModal && editingDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-lg font-bold mb-4">编辑设备: {editingDevice.name}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">名称</label>
                <input type="text" value={deviceFormData.name || ''} onChange={e => setDeviceFormData({...deviceFormData, name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IP 地址</label>
                <input type="text" value={deviceFormData.ipAddress || ''} onChange={e => setDeviceFormData({...deviceFormData, ipAddress: e.target.value})} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">端口</label>
                <input type="number" value={deviceFormData.port || ''} onChange={e => setDeviceFormData({...deviceFormData, port: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md" />
              </div>
            </div>
            <div className="flex justify-between mt-6">
              <button onClick={() => handleDeleteDevice(editingDevice.id)} className="px-4 py-2 bg-red-600 text-white rounded-md">删除设备</button>
              <div>
                <button onClick={() => setShowEditDeviceModal(false)} className="px-4 py-2">取消</button>
                <button onClick={handleUpdateDevice} className="px-4 py-2 bg-blue-600 text-white rounded-md">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}