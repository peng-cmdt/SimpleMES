"use client";

import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useLanguage } from "@/contexts/LanguageContext";

interface StepCondition {
  id?: string;
  type: string;
  value: string;
  description?: string;
}

interface ActionTemplate {
  id?: string;
  actionCode: string;
  name: string;
  nameLocal?: string;
  type: string;
  deviceId?: string; // 添加设备ID字段
  sensorType?: string;
  sensor?: string;
  category?: string;
  deviceType?: string;
  deviceAddress?: string;
  expectedValue?: string;
  validationRule?: string;
  parameters?: any;
  description?: string;
  instructions?: string;
  isRequired: boolean;
  componentType?: string;
  sensorInit?: string;
  sensorValue?: string;
  maxExecutionTime?: number;
  expectedExecutionTime?: number;
  idleTime?: number;
  okPin?: string;
  errorPin?: string;
  dSign?: boolean;
  sSign?: boolean;
  actionAfterError?: string;
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  fullSizeImage?: boolean;
  imagePosition?: string;
  soundFile?: string;
  timeout?: number;
  retryCount: number;
}

interface Workstation {
  id: string;
  workstationId: string;
  name: string;
  location: string;
}

interface StepTemplate {
  id: string;
  stepCode: string;
  name: string;
  workstationId?: string;
  workstation?: Workstation;
  description?: string;
  instructions?: string;
  image?: string;
  createdAt: string;
  updatedAt: string;
  actionTemplates: ActionTemplate[];
  _count: {
    actionTemplates: number;
    steps: number;
  };
}

interface StepTemplateFormData {
  name: string;
  workstationId: string;
  description: string;
  instructions: string;
  image?: string;
}

export default function StepTemplatesPage() {
  const [stepTemplates, setStepTemplates] = useState<StepTemplate[]>([]);
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<StepTemplate | null>(null);
  const [editingAction, setEditingAction] = useState<ActionTemplate | null>(null);
  const [currentActionIndex, setCurrentActionIndex] = useState<number>(-1);
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'actions' | 'conditions' | 'references'>('info');
  const [infoEditing, setInfoEditing] = useState(false);
  const [conditionItems, setConditionItems] = useState<StepCondition[]>([]);
  const [editingConditionIndex, setEditingConditionIndex] = useState<number | null>(null);
  const [conditionInput, setConditionInput] = useState('');
  const [conditionType, setConditionType] = useState('');
  const [conditionValue, setConditionValue] = useState('');
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [processReferences, setProcessReferences] = useState<any[]>([]);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState<any>(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');
  
  // 动作表单的文件上传状态
  const [actionImageFile, setActionImageFile] = useState<File | null>(null);
  const [actionImagePreview, setActionImagePreview] = useState<string>('');
  const [actionSoundFile, setActionSoundFile] = useState<File | null>(null);
  const [actionSoundPreview, setActionSoundPreview] = useState<string>('');
  
  // 拖拽排序状态
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [hasUnsavedOrder, setHasUnsavedOrder] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const [formData, setFormData] = useState<StepTemplateFormData>({
    name: '',
    workstationId: '',
    description: '',
    instructions: '',
    image: ''
  });
  const [actionFormData, setActionFormData] = useState<ActionTemplate>({
    actionCode: '',
    name: '',
    nameLocal: '',
    type: 'DEVICE_READ',
    sensorType: '',
    sensor: '',
    category: '',
    deviceType: '',
    deviceAddress: '',
    expectedValue: '',
    validationRule: '',
    parameters: {},
    description: '',
    instructions: '',
    isRequired: true,
    componentType: '',
    sensorInit: '',
    sensorValue: '',
    maxExecutionTime: 0,
    expectedExecutionTime: 0,
    idleTime: 0,
    okPin: '',
    errorPin: '',
    dSign: false,
    sSign: false,
    actionAfterError: 'Repeat action',
    image: '',
    imageWidth: 0,
    imageHeight: 0,
    fullSizeImage: false,
    imagePosition: 'Top-left',
    soundFile: '',
    timeout: 30,
    retryCount: 0
  });
  const [tempActionTemplates, setTempActionTemplates] = useState<ActionTemplate[]>([]);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [workstationFilter, setWorkstationFilter] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const { t } = useLanguage();

  // 条件类型选项
  const conditionTypeOptions = [
    { value: 'BOM_CHECK', label: 'BOM号检查' },
    { value: 'PART_CHECK', label: '零件号检查' },
    { value: 'PRODUCT_CHECK', label: '产品型号检查' },
    { value: 'QUANTITY_CHECK', label: '数量检查' },
    { value: 'CUSTOM_FIELD', label: '自定义字段' }
  ];

  useEffect(() => {
    loadStepTemplates();
    loadWorkstations();
    // 不在初始加载时加载设备，只在选中特定步骤模板时加载对应工位的设备
  }, []);

  // 处理URL参数高亮
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const highlightId = urlParams.get('highlightId');
      
      if (highlightId && stepTemplates.length > 0) {
        // 查找对应的步骤模板
        const targetTemplate = stepTemplates.find(template => template.id === highlightId);
        if (targetTemplate) {
          // 自动展开该步骤模板
          setExpandedTemplateId(highlightId);
          setEditingTemplate(targetTemplate);
          setActiveTab('info');
          
          // 滚动到对应位置 (延迟执行确保DOM已渲染)
          setTimeout(() => {
            const element = document.getElementById(`step-template-${highlightId}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // 添加高亮效果
              element.classList.add('ring-2', 'ring-blue-500', 'ring-opacity-50');
              setTimeout(() => {
                element.classList.remove('ring-2', 'ring-blue-500', 'ring-opacity-50');
              }, 3000);
            }
          }, 500);
        }
      }
    }
  }, [stepTemplates]);

  const loadStepTemplates = async () => {
    try {
      const response = await fetch('/api/step-templates');
      if (response.ok) {
        const data = await response.json();
        setStepTemplates(data.data.stepTemplates);
      }
    } catch (error) {
      console.error('Load step templates error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadWorkstations = async () => {
    try {
      const response = await fetch('/api/workstations');
      if (response.ok) {
        const data = await response.json();
        setWorkstations(data.workstations);
      }
    } catch (error) {
      console.error('Load workstations error:', error);
    }
  };

  const loadDevices = async (workstationId?: string) => {
    try {
      // 使用新的工位设备实例API端点
      const url = workstationId 
        ? `/api/workstation-devices?workstationId=${workstationId}&limit=100`
        : '/api/workstation-devices?limit=100';
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        // 转换数据格式以适应现有的UI组件
        const transformedDevices = (data.data?.devices || []).map((device: any) => ({
          id: device.id,
          instanceId: device.instanceId,
          name: device.displayName,
          type: device.template?.type || 'UNKNOWN',
          brand: device.template?.brand || 'Unknown',
          model: device.template?.model || 'Unknown',
          driver: device.template?.driver || '',
          ipAddress: device.ipAddress,
          port: device.port,
          status: device.status,
          isOnline: device.isOnline,
          template: device.template,
          workstation: device.workstation
        }));
        
        setDevices(transformedDevices);
        
        console.log(`Available workstation devices ${workstationId ? 'for workstation ' + workstationId : '(all)'}:`, transformedDevices.length);
        if (transformedDevices.length === 0 && workstationId) {
          console.warn(`No devices found for workstation ${workstationId}. Please check if devices are properly configured for this workstation.`);
        }
      } else {
        console.error('Failed to load workstation devices:', response.status);
        setDevices([]);
      }
    } catch (error) {
      console.error('Load workstation devices error:', error);
      setDevices([]);
    }
  };

  const generateStepCode = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `ST-${timestamp}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.name.length > 20) {
      setError('步骤名称不能超过20个字符');
      return;
    }

    try {
      const stepCode = editingTemplate ? editingTemplate.stepCode : generateStepCode();
      const url = editingTemplate ? `/api/step-templates/${editingTemplate.id}` : '/api/step-templates';
      const method = editingTemplate ? 'PUT' : 'POST';

      let imageUrl = formData.image;
      if (imageFile) {
        const imageFormData = new FormData();
        imageFormData.append('image', imageFile);
        const imageResponse = await fetch('/api/upload/image', {
          method: 'POST',
          body: imageFormData
        });
        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          imageUrl = imageData.url;
        }
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stepCode,
          name: formData.name,
          workstationId: formData.workstationId,
          description: formData.description,
          instructions: formData.instructions,
          image: imageUrl,
          actionTemplates: tempActionTemplates
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await loadStepTemplates();
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

  const handleDelete = async (template: StepTemplate) => {
    if (!confirm(`确定要删除步骤模板 "${template.name}"吗？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/step-templates/${template.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadStepTemplates();
        setLastUpdated(new Date());
      } else {
        const data = await response.json();
        alert(data.error || '删除失败');
      }
    } catch (error) {
      alert('网络错误');
    }
  };

  // 动作类型反向映射函数 - 从数据库格式转换为前端格式
  const mapActionTypeFromDB = (dbType: string): string => {
    const reverseTypeMapping: { [key: string]: string } = {
      'DEVICE_READ': 'PLC_READ',
      'DEVICE_WRITE': 'PLC_WRITE',
      'MANUAL_CONFIRM': 'MANUAL_CONFIRM',
      'DATA_VALIDATION': 'DATA_VALIDATION',
      'DELAY_WAIT': 'DELAY_WAIT',
      'BARCODE_SCAN': 'BARCODE_SCAN',
      'CAMERA_CHECK': 'CAMERA_CHECK',
      'CUSTOM_SCRIPT': 'CUSTOM_SCRIPT'
    };
    return reverseTypeMapping[dbType] || dbType;
  };

  const handleTemplateClick = (template: StepTemplate) => {
    if (expandedTemplateId === template.id) {
      setExpandedTemplateId(null);
      setEditingTemplate(null);
    } else {
      setExpandedTemplateId(template.id);
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        workstationId: template.workstationId || '',
        description: template.description || '',
        instructions: template.instructions || '',
        image: template.image || ''
      });
      
      // 重新加载该工位的设备列表
      if (template.workstationId) {
        loadDevices(template.workstationId);
      }
      
      // 映射动作模板数据，转换类型格式并从parameters中恢复前端字段
      setTempActionTemplates((template.actionTemplates || []).map(action => {
        const params = action.parameters as any || {};
        
        return {
          ...action,
          type: mapActionTypeFromDB(action.type), // 转换动作类型
          // 从parameters中恢复前端特有字段
          deviceId: params.deviceId || '',
          sensorType: params.sensorType || '',
          sensor: params.sensor || '',
          sensorValue: params.sensorValue || '',
          nameLocal: params.nameLocal || '',
          componentType: params.componentType || '',
          sensorInit: params.sensorInit || '',
          maxExecutionTime: params.maxExecutionTime || 0,
          expectedExecutionTime: params.expectedExecutionTime || 0,
          idleTime: params.idleTime || 0,
          okPin: params.okPin || '0',
          errorPin: params.errorPin || '0',
          dSign: params.dSign || false,
          sSign: params.sSign || false,
          actionAfterError: params.actionAfterError || 'Repeat action',
          image: params.image || '',
          imageWidth: params.imageWidth || 0,
          imageHeight: params.imageHeight || 0,
          fullSizeImage: params.fullSizeImage || false,
          imagePosition: params.imagePosition || 'Top-left',
          soundFile: params.soundFile || ''
        };
      }));
      
      // 从数据库加载条件数据
      if (template.conditions && Array.isArray(template.conditions)) {
        setConditionItems(template.conditions);
      } else {
        setConditionItems([]);
      }
      setActiveTab('info');
      setInfoEditing(false);
      if (template.image) {
        setImagePreview(template.image);
      }
    }
  };

  const resetForm = () => {
    setEditingTemplate(null);
    setExpandedTemplateId(null);
    setFormData({
      name: '',
      workstationId: '',
      description: '',
      instructions: '',
      image: ''
    });
    setTempActionTemplates([]);
    setConditionItems([]);
    setProcessReferences([]);
    setActiveTab('info');
    setInfoEditing(false);
    setImageFile(null);
    setImagePreview('');
    setConditionInput('');
    setEditingConditionIndex(null);
    setShowImagePreview(false);
    setPreviewImageUrl('');
    setError('');
    // 重置拖拽排序相关状态
    setHasUnsavedOrder(false);
    setDraggedIndex(null);
    setIsDragging(false);
    // 重置条件相关状态
    setConditionType('');
    setConditionValue('');
    setShowConditionModal(false);
  };

  // 信息选项卡操作函数
  const handleInfoEdit = () => {
    setInfoEditing(true);
  };

  const handleInfoSave = async () => {
    if (!editingTemplate) return;
    
    if (formData.name.length > 20) {
      setError('步骤名称不能超过20个字符');
      return;
    }

    try {
      let imageUrl = formData.image;
      if (imageFile) {
        const imageFormData = new FormData();
        imageFormData.append('image', imageFile);
        const imageResponse = await fetch('/api/upload/image', {
          method: 'POST',
          body: imageFormData
        });
        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          imageUrl = imageData.url;
        }
      }

      const response = await fetch(`/api/step-templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepCode: editingTemplate.stepCode,
          name: formData.name,
          workstationId: formData.workstationId,
          description: formData.description,
          instructions: formData.instructions,
          image: imageUrl,
          actionTemplates: tempActionTemplates
        }),
      });

      if (response.ok) {
        await loadStepTemplates();
        setInfoEditing(false);
        const updatedTemplates = stepTemplates.map(t => 
          t.id === editingTemplate.id ? { ...t, ...formData, image: imageUrl } : t
        );
        setStepTemplates(updatedTemplates);
        const updatedTemplate = updatedTemplates.find(t => t.id === editingTemplate.id);
        if (updatedTemplate) {
          setEditingTemplate(updatedTemplate);
        }
        setLastUpdated(new Date());
      } else {
        const data = await response.json();
        setError(data.error || '保存失败');
      }
    } catch (error) {
      setError('网络错误');
    }
  };

  const handleCopyTemplate = () => {
    if (!editingTemplate) return;
    const newName = `${editingTemplate.name} - 副本`;
    setFormData({
      name: newName,
      workstationId: editingTemplate.workstationId || '',
      description: editingTemplate.description || '',
      instructions: editingTemplate.instructions || '',
      image: editingTemplate.image || ''
    });
    if (editingTemplate.image) {
      setImagePreview(editingTemplate.image);
    }
    setEditingTemplate(null);
    setActiveTab('info');
    setInfoEditing(false);
    setShowModal(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 动作表单图片上传处理
  const handleActionImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setActionImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setActionImagePreview(result);
      };
      reader.readAsDataURL(file);
    }
  };

  // 动作表单声音文件上传处理
  const handleActionSoundUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setActionSoundFile(file);
      setActionSoundPreview(file.name);
    }
  };

  // 清除动作表单文件
  const clearActionFiles = () => {
    setActionImageFile(null);
    setActionImagePreview('');
    setActionSoundFile(null);
    setActionSoundPreview('');
  };

  const handleImageClick = (imageUrl: string) => {
    setPreviewImageUrl(imageUrl);
    setShowImagePreview(true);
  };

  const closeImagePreview = () => {
    setShowImagePreview(false);
    setPreviewImageUrl('');
  };

  // 条件管理函数
  const handleAddCondition = () => {
    setConditionType('BOM_CHECK');
    setConditionValue('');
    setEditingConditionIndex(-1);
    setShowConditionModal(true);
  };

  const handleEditCondition = (index: number) => {
    const condition = conditionItems[index];
    setConditionType(condition.type);
    setConditionValue(condition.value);
    setEditingConditionIndex(index);
    setShowConditionModal(true);
  };

  // 保存条件到数据库
  const saveConditionsToDatabase = async (conditions: StepCondition[]) => {
    if (!editingTemplate) return false;
    
    try {
      const response = await fetch(`/api/step-templates/${editingTemplate.id}/conditions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conditions })
      });

      if (response.ok) {
        // 重新加载步骤模板数据以获取最新的条件
        await loadStepTemplates();
        return true;
      } else {
        const errorData = await response.json();
        console.error('保存条件失败:', errorData);
        setError('保存条件失败: ' + (errorData.error || '未知错误'));
        return false;
      }
    } catch (error) {
      console.error('保存条件网络错误:', error);
      setError('网络错误，保存条件失败');
      return false;
    }
  };

  const handleSaveCondition = async () => {
    if (conditionType && conditionValue.trim()) {
      const newCondition: StepCondition = {
        id: editingConditionIndex !== null && editingConditionIndex >= 0 
          ? conditionItems[editingConditionIndex].id 
          : undefined,
        type: conditionType,
        value: conditionValue.trim(),
        description: getConditionDescription(conditionType, conditionValue.trim())
      };

      const newConditions = [...conditionItems];
      if (editingConditionIndex !== null && editingConditionIndex >= 0) {
        newConditions[editingConditionIndex] = newCondition;
      } else {
        // 为新条件创建临时ID
        newCondition.id = `temp_${Date.now()}`;
        newConditions.push(newCondition);
      }
      
      // 保存到数据库
      const success = await saveConditionsToDatabase(newConditions);
      if (success) {
        setConditionItems(newConditions);
        setShowConditionModal(false);
        setConditionType('');
        setConditionValue('');
        setEditingConditionIndex(null);
      }
    }
  };

  const handleDeleteCondition = async (index: number) => {
    const newConditions = conditionItems.filter((_, i) => i !== index);
    
    // 保存到数据库
    const success = await saveConditionsToDatabase(newConditions);
    if (success) {
      setConditionItems(newConditions);
    }
  };

  const handleCancelConditionEdit = () => {
    setShowConditionModal(false);
    setConditionType('');
    setConditionValue('');
    setEditingConditionIndex(null);
  };

  const getConditionDescription = (type: string, value: string): string => {
    const typeLabel = conditionTypeOptions.find(opt => opt.value === type)?.label || type;
    const values = value.split('||').filter(v => v.trim());
    if (values.length > 1) {
      return `${typeLabel}: 当包含 ${values.join(' 或 ')} 时显示`;
    } else {
      return `${typeLabel}: 当包含 ${value} 时显示`;
    }
  };

  // 加载工艺过程引用
  const loadProcessReferences = async (templateId: string) => {
    try {
      const response = await fetch(`/api/processes?stepTemplateId=${templateId}`);
      if (response.ok) {
        const data = await response.json();
        setProcessReferences(data.data.processes || []);
      }
    } catch (error) {
      console.error('Load process references error:', error);
    }
  };

  const handleViewProcess = (process: any) => {
    setSelectedProcess(process);
    setShowProcessModal(true);
  };

  const handleRemoveProcessReference = async (processId: string) => {
    if (!editingTemplate || !confirm('确定要从该工艺中移除此步骤吗？')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/processes/${processId}/remove-step`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepTemplateId: editingTemplate.id })
      });

      if (response.ok) {
        await loadProcessReferences(editingTemplate.id);
      } else {
        alert('移除失败');
      }
    } catch (error) {
      alert('网络错误');
    }
  };

  // 动作管理函数
  const addAction = async () => {
    // 确保设备列表是当前工位的设备
    if (editingTemplate?.workstationId) {
      await loadDevices(editingTemplate.workstationId);
    }
    
    setEditingAction(null);
    setCurrentActionIndex(-1);
    clearActionFiles(); // 清除文件状态
    setActionFormData({
      actionCode: `A${tempActionTemplates.length + 1}`,
      name: '',
      nameLocal: '',
      type: '',
      sensorType: '',
      sensor: '',
      category: '',
      deviceType: '',
      deviceAddress: '',
      expectedValue: '',
      validationRule: '',
      parameters: {},
      description: '',
      instructions: '',
      isRequired: true,
      componentType: '',
      sensorInit: '',
      sensorValue: '',
      maxExecutionTime: 0,
      expectedExecutionTime: 0,
      idleTime: 0,
      okPin: '0',
      errorPin: '0',
      dSign: false,
      sSign: false,
      actionAfterError: 'Repeat action',
      image: '',
      imageWidth: 0,
      imageHeight: 0,
      fullSizeImage: false,
      imagePosition: 'Top-left',
      soundFile: '',
      timeout: 30,
      retryCount: 0
    });
    setShowActionModal(true);
  };

  const editAction = async (index: number) => {
    const action = tempActionTemplates[index];
    setEditingAction(action);
    setCurrentActionIndex(index);
    
    // 确保设备列表是当前工位的设备 - 先加载设备
    if (editingTemplate?.workstationId) {
      await loadDevices(editingTemplate.workstationId);
      
      // 直接重新获取设备信息来确保数据正确
      const url = `/api/devices?workstationId=${editingTemplate.workstationId}`;
      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          const currentDevices = data.devices || [];
          
          const formData = { ...action };
          
          // 如果有deviceId，从最新的设备列表中获取设备信息
          if (formData.deviceId) {
            const device = currentDevices.find((d: any) => d.id === formData.deviceId);
            if (device) {
              formData.deviceType = device.type;
              formData.sensorType = device.name;
            }
          }
          
          setActionFormData(formData);
        } else {
          setActionFormData({ ...action });
        }
      } catch (error) {
        console.error('Error loading devices for edit:', error);
        setActionFormData({ ...action });
      }
    } else {
      setActionFormData({ ...action });
    }
    
    // 设置文件预览
    if (action.image) {
      setActionImagePreview(action.image);
    } else {
      setActionImagePreview('');
    }
    
    if (action.soundFile) {
      setActionSoundPreview(action.soundFile.split('/').pop() || '');
    } else {
      setActionSoundPreview('');
    }
    
    setShowActionModal(true);
  };

  const saveAction = async () => {
    if (!editingTemplate) return;

    try {
      // 更新临时状态
      const newActions = [...tempActionTemplates];
      const updatedActionData = { ...actionFormData };

      // 处理图片上传
      if (actionImageFile) {
        const imageFormData = new FormData();
        imageFormData.append('image', actionImageFile);
        const imageResponse = await fetch('/api/upload/image', {
          method: 'POST',
          body: imageFormData
        });
        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          updatedActionData.image = imageData.url;
        }
      }

      // 处理声音文件上传
      if (actionSoundFile) {
        const soundFormData = new FormData();
        soundFormData.append('audio', actionSoundFile);
        const soundResponse = await fetch('/api/upload/audio', {
          method: 'POST',
          body: soundFormData
        });
        if (soundResponse.ok) {
          const soundData = await soundResponse.json();
          updatedActionData.soundFile = soundData.url;
        }
      }

      if (currentActionIndex >= 0) {
        newActions[currentActionIndex] = updatedActionData;
      } else {
        newActions.push(updatedActionData);
      }
      
      // 直接保存到数据库
      const response = await fetch(`/api/step-templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepCode: editingTemplate.stepCode,
          name: editingTemplate.name,
          workstationId: editingTemplate.workstationId,
          description: editingTemplate.description,
          instructions: editingTemplate.instructions,
          image: editingTemplate.image,
          actionTemplates: newActions
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Action save successful:', data);
        
        // 更新本地状态
        setTempActionTemplates(newActions);
        
        // 使用API返回的数据更新当前编辑的模板
        if (data.success && data.data.stepTemplate) {
          console.log('Updating editingTemplate with saved data:', data.data.stepTemplate);
          setEditingTemplate(data.data.stepTemplate);
          setTempActionTemplates(data.data.stepTemplate.actionTemplates || []);
          
          // 更新步骤模板列表中的对应项
          setStepTemplates(prevTemplates => 
            prevTemplates.map(template => 
              template.id === data.data.stepTemplate.id 
                ? data.data.stepTemplate 
                : template
            )
          );
        } else {
          // 兜底方案：更新当前编辑的模板
          const updatedTemplate = {
            ...editingTemplate,
            actionTemplates: newActions
          };
          setEditingTemplate(updatedTemplate);
        }
        
        setLastUpdated(new Date());
        setShowActionModal(false);
        setError('');
        clearActionFiles(); // 清除文件状态
        alert('动作保存成功');
      } else {
        const errorData = await response.json();
        console.error('Save failed:', errorData);
        alert('保存失败：' + (errorData.error || '未知错误'));
      }
    } catch (error) {
      console.error('保存动作失败:', error);
      alert('网络错误，保存失败');
    }
  };

  const removeAction = async (index: number) => {
    if (!editingTemplate || !confirm('确定要删除此动作吗？')) return;

    try {
      const newActions = tempActionTemplates.filter((_, i) => i !== index);
      
      // 直接保存到数据库
      const response = await fetch(`/api/step-templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepCode: editingTemplate.stepCode,
          name: editingTemplate.name,
          workstationId: editingTemplate.workstationId,
          description: editingTemplate.description,
          instructions: editingTemplate.instructions,
          image: editingTemplate.image,
          actionTemplates: newActions
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Action remove successful:', data);
        
        // 更新本地状态
        setTempActionTemplates(newActions);
        
        // 使用API返回的数据更新当前编辑的模板
        if (data.success && data.data.stepTemplate) {
          console.log('Updating editingTemplate after action removal:', data.data.stepTemplate);
          setEditingTemplate(data.data.stepTemplate);
          setTempActionTemplates(data.data.stepTemplate.actionTemplates || []);
          
          // 更新步骤模板列表中的对应项
          setStepTemplates(prevTemplates => 
            prevTemplates.map(template => 
              template.id === data.data.stepTemplate.id 
                ? data.data.stepTemplate 
                : template
            )
          );
        } else {
          // 兜底方案：更新当前编辑的模板
          const updatedTemplate = {
            ...editingTemplate,
            actionTemplates: newActions
          };
          setEditingTemplate(updatedTemplate);
        }
        
        setLastUpdated(new Date());
        alert('动作删除成功');
      } else {
        const errorData = await response.json();
        alert('删除失败：' + (errorData.error || '未知错误'));
      }
    } catch (error) {
      console.error('删除动作失败:', error);
      alert('网络错误，删除失败');
    }
  };

  // 拖拽排序相关函数
  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    setDraggedIndex(index);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    
    // 设置拖拽时的视觉效果
    if (e.currentTarget) {
      e.currentTarget.style.opacity = '0.6';
      e.currentTarget.style.transform = 'scale(0.95)';
    }
  };

  const handleDragEnd = (e: React.DragEvent<HTMLTableRowElement>) => {
    setDraggedIndex(null);
    setIsDragging(false);
    
    // 恢复样式
    if (e.currentTarget) {
      e.currentTarget.style.opacity = '1';
      e.currentTarget.style.transform = 'scale(1)';
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // 添加视觉反馈
    if (e.currentTarget) {
      e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
      e.currentTarget.style.borderTop = '2px solid #3B82F6';
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLTableRowElement>) => {
    // 移除视觉反馈
    if (e.currentTarget) {
      e.currentTarget.style.backgroundColor = '';
      e.currentTarget.style.borderTop = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, dropIndex: number) => {
    e.preventDefault();
    
    // 移除视觉反馈
    if (e.currentTarget) {
      e.currentTarget.style.backgroundColor = '';
      e.currentTarget.style.borderTop = '';
    }
    
    const dragIndex = draggedIndex;
    if (dragIndex === null || dragIndex === dropIndex) {
      return;
    }

    // 重新排列数组
    const newActions = [...tempActionTemplates];
    const draggedAction = newActions[dragIndex];
    newActions.splice(dragIndex, 1);
    newActions.splice(dropIndex, 0, draggedAction);

    setTempActionTemplates(newActions);
    setHasUnsavedOrder(true); // 标记有未保存的顺序变更
  };

  // 保存顺序
  const saveActionOrder = async () => {
    if (!editingTemplate || !hasUnsavedOrder) return;

    try {
      // 直接保存到数据库
      const response = await fetch(`/api/step-templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepCode: editingTemplate.stepCode,
          name: editingTemplate.name,
          workstationId: editingTemplate.workstationId,
          description: editingTemplate.description,
          instructions: editingTemplate.instructions,
          image: editingTemplate.image,
          actionTemplates: tempActionTemplates
        }),
      });

      if (response.ok) {
        // 更新本地状态
        const updatedTemplate = {
          ...editingTemplate,
          actionTemplates: tempActionTemplates
        };
        setEditingTemplate(updatedTemplate);
        
        // 重新加载数据
        await loadStepTemplates();
        
        setLastUpdated(new Date());
        setHasUnsavedOrder(false); // 清除未保存状态
        setError('');
        alert('顺序保存成功！');
      } else {
        const errorData = await response.json();
        alert('保存顺序失败：' + (errorData.error || '未知错误'));
      }
    } catch (error) {
      console.error('保存顺序失败:', error);
      alert('网络错误，保存顺序失败');
    }
  };

  const moveActionUp = async (index: number) => {
    if (index <= 0 || !editingTemplate) return;
    
    try {
      const newActions = [...tempActionTemplates];
      [newActions[index - 1], newActions[index]] = [newActions[index], newActions[index - 1]];
      
      // 直接保存到数据库
      const response = await fetch(`/api/step-templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepCode: editingTemplate.stepCode,
          name: editingTemplate.name,
          workstationId: editingTemplate.workstationId,
          description: editingTemplate.description,
          instructions: editingTemplate.instructions,
          image: editingTemplate.image,
          actionTemplates: newActions
        }),
      });

      if (response.ok) {
        // 更新本地状态
        setTempActionTemplates(newActions);
        
        // 更新当前编辑的模板
        const updatedTemplate = {
          ...editingTemplate,
          actionTemplates: newActions
        };
        setEditingTemplate(updatedTemplate);
        
        // 重新加载数据
        await loadStepTemplates();
        
        setLastUpdated(new Date());
      } else {
        const errorData = await response.json();
        alert('移动失败：' + (errorData.error || '未知错误'));
      }
    } catch (error) {
      console.error('移动动作失败:', error);
      alert('网络错误，移动失败');
    }
  };

  const moveActionDown = async (index: number) => {
    if (index >= tempActionTemplates.length - 1 || !editingTemplate) return;
    
    try {
      const newActions = [...tempActionTemplates];
      [newActions[index], newActions[index + 1]] = [newActions[index + 1], newActions[index]];
      
      // 直接保存到数据库
      const response = await fetch(`/api/step-templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepCode: editingTemplate.stepCode,
          name: editingTemplate.name,
          workstationId: editingTemplate.workstationId,
          description: editingTemplate.description,
          instructions: editingTemplate.instructions,
          image: editingTemplate.image,
          actionTemplates: newActions
        }),
      });

      if (response.ok) {
        // 更新本地状态
        setTempActionTemplates(newActions);
        
        // 更新当前编辑的模板
        const updatedTemplate = {
          ...editingTemplate,
          actionTemplates: newActions
        };
        setEditingTemplate(updatedTemplate);
        
        // 重新加载数据
        await loadStepTemplates();
        
        setLastUpdated(new Date());
      } else {
        const errorData = await response.json();
        alert('移动失败：' + (errorData.error || '未知错误'));
      }
    } catch (error) {
      console.error('移动动作失败:', error);
      alert('网络错误，移动失败');
    }
  };

  const getActionTypeLabel = (type: string) => {
    switch (type) {
      case 'DEVICE_READ':
        return '设备读取';
      case 'DEVICE_WRITE':
        return '设备写入';
      case 'DEVICE_MONITOR':
        return '设备监视';
      case 'PLC_READ':
        return 'PLC读取数据';
      case 'PLC_WRITE':
        return 'PLC写入数据';
      case 'PLC_MONITOR':
        return 'PLC监视数据';
      case 'SCAN_BARCODE':
        return '扫码';
      case 'MANUAL_CHECK':
        return '人工确认';
      case 'SENSOR_READ':
        return '传感器读取';
      case 'CAMERA_CAPTURE':
        return '摄像头拍照';
      case 'PRINTER_PRINT':
        return '打印机打印';
      default:
        return type;
    }
  };

  // 根据设备类型获取可用的动作类型
  const getAvailableActionTypes = (deviceType: string) => {
    switch (deviceType?.toUpperCase()) {
      case 'PLC_CONTROLLER':
        return [
          { value: 'PLC_READ', label: 'PLC读取数据' },
          { value: 'PLC_WRITE', label: 'PLC写入数据' },
          { value: 'PLC_MONITOR', label: 'PLC监视数据' }
        ];
      case 'BARCODE_SCANNER':
        return [
          { value: 'SCAN_BARCODE', label: '扫码' }
        ];
      case 'SENSOR':
        return [
          { value: 'SENSOR_READ', label: '传感器读取' }
        ];
      case 'CAMERA':
        return [
          { value: 'CAMERA_CAPTURE', label: '摄像头拍照' }
        ];
      case 'PRINTER':
        return [
          { value: 'PRINTER_PRINT', label: '打印机打印' }
        ];
      case 'SCREWDRIVER':
        return [
          { value: 'DEVICE_READ', label: '设备读取' },
          { value: 'DEVICE_WRITE', label: '设备写入' }
        ];
      default:
        return [
          { value: 'DEVICE_READ', label: '设备读取' },
          { value: 'DEVICE_WRITE', label: '设备写入' },
          { value: 'MANUAL_CHECK', label: '人工确认' }
        ];
    }
  };

  // 根据设备ID获取设备详细信息
  const getDeviceInfo = (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return null;
    return {
      ...device,
      displayName: `${device.name} (${device.brand} ${device.model})`
    };
  };

  // 处理设备类型变化
  const handleDeviceTypeChange = (deviceId: string) => {
    const selectedDevice = devices.find(d => d.id === deviceId);
    if (selectedDevice) {
      const availableTypes = getAvailableActionTypes(selectedDevice.type);
      // 自动选择第一个可用的动作类型
      const firstType = availableTypes.length > 0 ? availableTypes[0].value : 'DEVICE_READ';
      
      setActionFormData({
        ...actionFormData,
        deviceId: deviceId, // 存储设备ID
        sensorType: selectedDevice.name, // 存储设备名称作为传感器类型
        deviceType: selectedDevice.type, // 存储设备类型
        type: firstType, // 设置动作类型
        // 清空之前的设备相关字段
        sensor: '',
        deviceAddress: ''
      });
    } else if (!deviceId) {
      // 如果没有选择设备，清空相关字段
      setActionFormData({
        ...actionFormData,
        deviceId: '',
        sensorType: '',
        deviceType: '',
        type: '',
        sensor: '',
        deviceAddress: ''
      });
    }
  };

  const filteredTemplates = stepTemplates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.stepCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesWorkstation = !workstationFilter || template.workstationId === workstationFilter;
    
    return matchesSearch && matchesWorkstation;
  });

  const workstationOptions = workstations;

  if (isLoading) {
    return (
      <AdminLayout title="工艺步骤管理">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="工艺步骤管理">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            工艺步骤管理
          </h2>
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              管理可重复使用的生产步骤模板
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
              loadStepTemplates();
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
            新增步骤
          </button>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              搜索
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="搜索步骤名称或编码..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              工位筛选
            </label>
            <select
              value={workstationFilter}
              onChange={(e) => setWorkstationFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">全部工位</option>
              {workstationOptions.map((workstation) => (
                <option key={workstation.id} value={workstation.id}>{workstation.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                步骤ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                步骤名称
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                工位
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                描述说明
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                是否被项目引用
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredTemplates.map((template) => (
              <React.Fragment key={template.id}>
                <tr 
                  id={`step-template-${template.id}`}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => handleTemplateClick(template)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <svg 
                        className={`w-4 h-4 mr-3 transform transition-transform ${expandedTemplateId === template.id ? 'rotate-90' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {template.stepCode}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {template.image && (
                        <img
                          src={template.image}
                          alt={template.name}
                          className="w-8 h-8 rounded object-cover mr-3 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImageClick(template.image!);
                          }}
                        />
                      )}
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {template.name}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {template.workstation ? template.workstation.name : '未指定'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
                    <div className="max-w-xs truncate" title={template.description || '无描述'}>
                      {template.description || '无描述'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {template._count.steps > 0 ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        已引用 ({template._count.steps})
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                        未引用
                      </span>
                    )}
                  </td>
                </tr>
                
                {/* 展开的选项卡内容 */}
                {expandedTemplateId === template.id && editingTemplate && (
                  <tr>
                    <td colSpan={5} className="p-4 bg-gray-100 dark:bg-gray-900">
                      {/* 选项卡导航 */}
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
                            信息
                          </button>
                          <button 
                            onClick={() => {
                              setActiveTab('actions');
                              // 确保设备列表是当前工位的设备
                              if (editingTemplate?.workstationId) {
                                loadDevices(editingTemplate.workstationId);
                              }
                            }}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${
                              activeTab === 'actions'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                          >
                            动作配置
                          </button>
                          <button 
                            onClick={() => setActiveTab('conditions')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${
                              activeTab === 'conditions'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                          >
                            条件
                          </button>
                          <button 
                            onClick={() => {
                              setActiveTab('references');
                              if (editingTemplate) {
                                loadProcessReferences(editingTemplate.id);
                              }
                            }}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${
                              activeTab === 'references'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                          >
                            工艺过程引用
                          </button>
                        </nav>
                      </div>
                      
                      {/* 选项卡内容 */}
                      <div className="py-6">
                        {/* 信息选项卡 */}
                        {activeTab === 'info' && (
                          <div className="space-y-4">
                            {/* 左上角操作按钮 */}
                            <div className="flex justify-between items-center mb-4">
                              <div className="flex space-x-2">
                                {editingTemplate && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={handleInfoEdit}
                                      disabled={infoEditing}
                                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {infoEditing ? '编辑中...' : '编辑'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleCopyTemplate}
                                      className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                                    >
                                      拷贝
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(editingTemplate)}
                                      className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
                                    >
                                      删除
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* 基本信息 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  步骤名称 *
                                </label>
                                {editingTemplate && !infoEditing ? (
                                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md text-sm text-gray-900 dark:text-white">
                                    {editingTemplate.name}
                                  </div>
                                ) : (
                                  <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                    placeholder="步骤名称（最多20个字符）"
                                    maxLength={20}
                                    required
                                  />
                                )}
                                <div className="text-xs text-gray-500 mt-1">
                                  {formData.name.length}/20 个字符
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  工位 *
                                </label>
                                {editingTemplate && !infoEditing ? (
                                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md text-sm text-gray-900 dark:text-white">
                                    {workstations.find(w => w.id === editingTemplate.workstationId)?.name || '未指定'}
                                  </div>
                                ) : (
                                  <select
                                    value={formData.workstationId}
                                    onChange={(e) => setFormData({ ...formData, workstationId: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                    required
                                  >
                                    <option value="">请选择工位</option>
                                    {workstations.map((workstation) => (
                                      <option key={workstation.id} value={workstation.id}>
                                        {workstation.name} ({workstation.workstationId})
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                步骤描述
                              </label>
                              {editingTemplate && !infoEditing ? (
                                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md text-sm text-gray-900 dark:text-white min-h-[80px]">
                                  {editingTemplate.description || '无描述'}
                                </div>
                              ) : (
                                <textarea
                                  value={formData.description}
                                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                  rows={3}
                                  placeholder="步骤详细描述"
                                />
                              )}
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                图片
                              </label>
                              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 bg-gray-50 dark:bg-gray-800">
                                {editingTemplate && !infoEditing ? (
                                  <div className="text-center">
                                    {imagePreview || editingTemplate.image ? (
                                      <div className="space-y-4">
                                        <img
                                          src={imagePreview || editingTemplate.image}
                                          alt="步骤图片"
                                          className="mx-auto w-48 h-48 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity shadow-md"
                                          onClick={() => handleImageClick(imagePreview || editingTemplate.image || '')}
                                        />
                                        <div className="flex items-center justify-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                          </svg>
                                          <span>点击查看大图</span>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-center py-8">
                                        <svg className="mx-auto w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">暂无图片</p>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-center">
                                    {imagePreview ? (
                                      <div className="space-y-4">
                                        <img
                                          src={imagePreview}
                                          alt="预览"
                                          className="mx-auto w-48 h-48 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity shadow-md"
                                          onClick={() => handleImageClick(imagePreview)}
                                        />
                                        <div className="flex items-center justify-center space-x-4">
                                          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                            <span>点击查看大图</span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setImageFile(null);
                                              setImagePreview('');
                                            }}
                                            className="text-red-600 hover:text-red-800 text-sm flex items-center space-x-1"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            <span>删除</span>
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="space-y-4">
                                        <svg className="mx-auto w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                        <div>
                                          <label className="cursor-pointer">
                                            <span className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                              </svg>
                                              选择图片
                                            </span>
                                            <input
                                              type="file"
                                              accept="image/*"
                                              onChange={handleImageUpload}
                                              className="hidden"
                                            />
                                          </label>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                          支持 JPG、PNG、GIF 格式，建议尺寸不超过 2MB
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {error && (
                              <div className="text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md">{error}</div>
                            )}

                            {/* 左下方保存按钮 */}
                            {(infoEditing || !editingTemplate) && (
                              <div className="flex justify-start pt-4">
                                <button
                                  type="button"
                                  onClick={editingTemplate && infoEditing ? handleInfoSave : undefined}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                >
                                  保存
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 动作配置选项卡 */}
                        {activeTab === 'actions' && (
                          <div className="space-y-6">
                            {/* 功能按钮区域 */}
                            <div className="flex items-center space-x-3 mb-4">
                              <button
                                onClick={addAction}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                添加新动作
                              </button>
                              <button
                                onClick={() => {/* TODO: 导入动作功能 */}}
                                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                                </svg>
                                导入动作
                              </button>
                              <button
                                onClick={saveActionOrder}
                                disabled={!hasUnsavedOrder}
                                className={`px-4 py-2 rounded-md transition-colors flex items-center ${
                                  hasUnsavedOrder 
                                    ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse' 
                                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                }`}
                                title={hasUnsavedOrder ? '有未保存的顺序变更' : '没有需要保存的顺序变更'}
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                保存顺序
                                {hasUnsavedOrder && (
                                  <span className="ml-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                                    !
                                  </span>
                                )}
                              </button>
                            </div>

                            {/* 动作列表 */}
                            {tempActionTemplates && tempActionTemplates.length > 0 ? (
                              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                {/* 添加拖拽提示 */}
                                {tempActionTemplates.length > 1 && (
                                  <div className={`text-center py-2 px-4 text-sm transition-colors ${
                                    hasUnsavedOrder 
                                      ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-b border-red-200' 
                                      : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-b border-blue-200'
                                  }`}>
                                    <div className="flex items-center justify-center space-x-2">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                      </svg>
                                      <span>
                                        {hasUnsavedOrder 
                                          ? '⚠️ 顺序已更改，请点击红色按钮保存' 
                                          : '💡 可拖拽动作行来重新排序'}
                                      </span>
                                    </div>
                                  </div>
                                )}
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                  <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        顺序
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        动作信息
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        设备配置
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        传感器值
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        是否必需
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        操作
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {tempActionTemplates.map((action, index) => (
                                      <tr 
                                        key={index} 
                                        className={`hover:bg-gray-50 dark:hover:bg-gray-700 cursor-move transition-all duration-200 ${
                                          isDragging && draggedIndex === index ? 'opacity-50 scale-95 shadow-lg' : ''
                                        } ${hasUnsavedOrder ? 'border-l-4 border-l-red-500' : ''}`}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, index)}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, index)}
                                        title="拖拽以重新排序"
                                      >
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                          <div className="flex items-center space-x-2">
                                            {/* 拖拽手柄 */}
                                            <div className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600">
                                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
                                              </svg>
                                            </div>
                                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                                              hasUnsavedOrder ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                                            }`}>
                                              {index + 1}
                                            </span>
                                            <div className="flex flex-col space-y-1">
                                              <button 
                                                onClick={() => moveActionUp(index)}
                                                disabled={index === 0}
                                                className="w-4 h-4 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                              >
                                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                </svg>
                                              </button>
                                              <button 
                                                onClick={() => moveActionDown(index)}
                                                disabled={index === tempActionTemplates.length - 1}
                                                className="w-4 h-4 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                              >
                                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                              </button>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-4 py-4">
                                          <div className="flex items-start space-x-3">
                                            {/* 动作图片 */}
                                            <div className="flex-shrink-0">
                                              {action.image ? (
                                                <img
                                                  src={action.image}
                                                  alt={action.name}
                                                  className="w-12 h-12 rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                                  onClick={() => handleImageClick(action.image || '')}
                                                />
                                              ) : (
                                                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center">
                                                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                  </svg>
                                                </div>
                                              )}
                                            </div>
                                            {/* 动作基本信息 */}
                                            <div className="flex-1 min-w-0">
                                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                {action.name}
                                              </div>
                                              <div className="text-xs text-gray-500 mb-1">
                                                {action.actionCode}
                                              </div>
                                              <div className="flex items-center space-x-2">
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                  {getActionTypeLabel(action.type)}
                                                </span>
                                                {action.soundFile && (
                                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                                    🔊 音频
                                                  </span>
                                                )}
                                              </div>
                                              {action.description && (
                                                <div className="text-xs text-gray-500 mt-1 max-w-xs truncate">
                                                  {action.description}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-4 py-4 text-sm">
                                          <div className="space-y-1">
                                            <div className="text-gray-900 dark:text-white font-medium">
                                              {action.deviceId ? (() => {
                                                const deviceInfo = getDeviceInfo(action.deviceId);
                                                return deviceInfo ? deviceInfo.displayName : (action.deviceType || '-');
                                              })() : (action.deviceType || '-')}
                                            </div>
                                            {action.deviceAddress && (
                                              <div className="text-xs text-gray-500">
                                                地址: {action.deviceAddress}
                                              </div>
                                            )}
                                            {action.expectedValue && (
                                              <div className="text-xs text-gray-500">
                                                期望值: {action.expectedValue}
                                              </div>
                                            )}
                                            {action.timeout && (
                                              <div className="text-xs text-gray-500">
                                                超时: {action.timeout}s
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-300">
                                          {action.sensorValue ? (
                                            <div className="space-y-1">
                                              <div className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                                {action.sensorValue}
                                              </div>
                                              {action.sensorType && (
                                                <div className="text-xs">
                                                  类型: {action.sensorType}
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-gray-400">-</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                          {action.isRequired ? (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                              必需
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                              可选
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                          <div className="flex space-x-2">
                                            <button
                                              onClick={() => editAction(index)}
                                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                            >
                                              编辑
                                            </button>
                                            <button
                                              onClick={() => removeAction(index)}
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
                            ) : (
                              <div className="text-center py-8">
                                <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                </div>
                                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                                  暂无动作
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                  点击上方"添加新动作"按钮开始配置步骤动作
                                </p>
                                <button
                                  onClick={addAction}
                                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  添加第一个动作
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {activeTab === 'conditions' && (
                          <div className="space-y-6">
                            {/* 条件管理头部 */}
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                  步骤显示条件
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  定义何时此步骤会出现在生产客户端的工艺中
                                </p>
                              </div>
                              <button
                                onClick={handleAddCondition}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                添加新条件
                              </button>
                            </div>

                            {/* 条件列表 */}
                            {conditionItems && conditionItems.length > 0 ? (
                              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                  <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-32">
                                        类型
                                      </th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        值
                                      </th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        描述
                                      </th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-24">
                                        操作
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {conditionItems.map((condition, index) => (
                                      <tr key={condition.id || index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                            {conditionTypeOptions.find(opt => opt.value === condition.type)?.label || condition.type}
                                          </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                          <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                                            {condition.value}
                                          </code>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
                                          {condition.description}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                          <div className="flex space-x-2">
                                            <button
                                              onClick={() => handleEditCondition(index)}
                                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                            >
                                              编辑
                                            </button>
                                            <button
                                              onClick={() => handleDeleteCondition(index)}
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
                            ) : (
                              <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                                <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                  </svg>
                                </div>
                                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                                  暂无显示条件
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                  添加条件来控制此步骤在生产中的显示逻辑
                                </p>
                                <button
                                  onClick={handleAddCondition}
                                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  添加第一个条件
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {activeTab === 'references' && (
                          <div className="space-y-6">
                            {/* 工艺过程引用头部 */}
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                  工艺过程引用
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  显示引用此步骤模板的所有工艺过程
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  if (editingTemplate) {
                                    loadProcessReferences(editingTemplate.id);
                                  }
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                刷新引用
                              </button>
                            </div>

                            {/* 引用统计 */}
                            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                              <div className="flex items-center space-x-4">
                                <div className="flex items-center">
                                  <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                  </svg>
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    总引用数: {editingTemplate?._count?.steps || 0}
                                  </span>
                                </div>
                                <div className="flex items-center">
                                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    已加载引用: {processReferences.length}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* 工艺过程引用列表 */}
                            {processReferences && processReferences.length > 0 ? (
                              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                  <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        工艺编码
                                      </th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        工艺名称
                                      </th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        关联产品
                                      </th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        版本
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
                                    {processReferences.map((process) => (
                                      <tr key={process.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                          {process.processCode}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                          {process.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                          {process.product ? `${process.product.name} (${process.product.productCode})` : '未关联产品'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                            v{process.version}
                                          </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                          {new Date(process.createdAt).toLocaleDateString('zh-CN')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                          <div className="flex space-x-2">
                                            <button
                                              onClick={() => handleViewProcess(process)}
                                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                            >
                                              查看详情
                                            </button>
                                            <button
                                              onClick={() => handleRemoveProcessReference(process.id)}
                                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                            >
                                              移除引用
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                                <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                  </svg>
                                </div>
                                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                                  暂无工艺过程引用
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                  {editingTemplate?._count?.steps > 0 
                                    ? '虽然显示有引用，但可能是通过其他方式引用的步骤'
                                    : '此步骤模板尚未被任何工艺过程引用'
                                  }
                                </p>
                                <div className="text-xs text-gray-400 space-y-1">
                                  <p>提示：</p>
                                  <p>• 如果引用计数 &gt; 0 但这里显示为空，请检查API接口</p>
                                  <p>• 点击"刷新引用"按钮重新加载数据</p>
                                  <p>• 可能需要检查数据库中的关联关系</p>
                                </div>
                              </div>
                            )}

                            {/* 调试信息 */}
                            {editingTemplate?._count?.steps > 0 && processReferences.length === 0 && (
                              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                                <div className="flex">
                                  <svg className="w-5 h-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                                  </svg>
                                  <div className="flex-1">
                                    <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                      数据不一致警告
                                    </h3>
                                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                                      步骤模板显示有 {editingTemplate._count.steps} 个引用，但API未返回具体的工艺过程数据。
                                      这可能是以下原因造成的：
                                    </p>
                                    <ul className="text-xs text-yellow-600 dark:text-yellow-400 mt-2 ml-4 list-disc space-y-1">
                                      <li>API接口 <code>/api/processes?stepTemplateId={editingTemplate.id}</code> 返回空数据</li>
                                      <li>数据库中的关联关系配置错误</li>
                                      <li>Step与StepTemplate的关联方式与API查询不匹配</li>
                                    </ul>
                                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                                      建议检查后端API实现和数据库关联关系。
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {filteredTemplates.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  暂无步骤模板数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 新增步骤模态框 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingTemplate ? '编辑步骤模板' : '新增步骤模板'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    步骤名称 *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="步骤名称（最多20个字符）"
                    maxLength={20}
                    required
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {formData.name.length}/20 个字符
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    工位 *
                  </label>
                  <select
                    value={formData.workstationId}
                    onChange={(e) => setFormData({ ...formData, workstationId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="">请选择工位</option>
                    {workstations.map((workstation) => (
                      <option key={workstation.id} value={workstation.id}>
                        {workstation.name} ({workstation.workstationId})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  步骤描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  rows={3}
                  placeholder="步骤详细描述"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  操作说明
                </label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  rows={3}
                  placeholder="详细操作说明"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  图片
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                {imagePreview && (
                  <div className="mt-2">
                    <img
                      src={imagePreview}
                      alt="预览"
                      className="w-64 h-64 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => handleImageClick(imagePreview)}
                    />
                  </div>
                )}
              </div>

              {error && (
                <div className="text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md">{error}</div>
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
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {editingTemplate ? '更新步骤' : '创建步骤'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 动作编辑模态框 */}
      {showActionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingAction ? '编辑动作' : '新增动作'}
              </h2>
              <button
                onClick={() => setShowActionModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* 左列 */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    设备选择 *
                  </label>
                  <select
                    value={actionFormData.deviceId || ''}
                    onChange={(e) => handleDeviceTypeChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="">
                      {devices.length > 0 ? '请选择设备' : '当前工位暂无可用设备'}
                    </option>
                    {devices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name} ({device.brand} {device.model})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">从当前工位分配的设备实例中选择</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    动作类型 *
                  </label>
                  <select
                    value={actionFormData.type}
                    onChange={(e) => setActionFormData({ ...actionFormData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                    disabled={!actionFormData.deviceType}
                  >
                    <option value="">请先选择设备</option>
                    {actionFormData.deviceType && getAvailableActionTypes(actionFormData.deviceType).map((actionType) => (
                      <option key={actionType.value} value={actionType.value}>
                        {actionType.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {actionFormData.deviceType 
                      ? `${actionFormData.deviceType} 设备支持的动作类型`
                      : '选择设备后将显示可用的动作类型'
                    }
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    名称 *
                  </label>
                  <input
                    type="text"
                    value={actionFormData.name}
                    onChange={(e) => setActionFormData({ ...actionFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="动作名称"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    名称 (本地)
                  </label>
                  <input
                    type="text"
                    value={actionFormData.nameLocal || ''}
                    onChange={(e) => setActionFormData({ ...actionFormData, nameLocal: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    描述
                  </label>
                  <textarea
                    value={actionFormData.description || ''}
                    onChange={(e) => setActionFormData({ ...actionFormData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    rows={3}
                    placeholder="动作描述"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    组件类型
                  </label>
                  <select
                    value={actionFormData.componentType || ''}
                    onChange={(e) => setActionFormData({ ...actionFormData, componentType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">请选择组件类型</option>
                    <option value="PLC">PLC控制器</option>
                    <option value="Sensor">传感器</option>
                    <option value="Actuator">执行器</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    传感器初始值
                  </label>
                  <input
                    type="text"
                    value={actionFormData.sensorInit || ''}
                    onChange={(e) => setActionFormData({ ...actionFormData, sensorInit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    完成条件 (传感器值)
                  </label>
                  <input
                    type="text"
                    value={actionFormData.sensorValue || ''}
                    onChange={(e) => setActionFormData({ ...actionFormData, sensorValue: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="例如: DB10.DBX.0.0=1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    定义动作完成条件，如PLC地址值检查：DB10.DBX.0.0=1表示读取DB10.DBX.0.0地址，值为1时动作完成
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    最大执行时间 (最小时间)
                  </label>
                  <input
                    type="number"
                    value={actionFormData.maxExecutionTime || 0}
                    onChange={(e) => setActionFormData({ ...actionFormData, maxExecutionTime: e.target.value ? parseInt(e.target.value) : 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">实现动作的最小时间 (0 = 不接受)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    预期执行时间 (最大时间)
                  </label>
                  <input
                    type="number"
                    value={actionFormData.expectedExecutionTime || 0}
                    onChange={(e) => setActionFormData({ ...actionFormData, expectedExecutionTime: e.target.value ? parseInt(e.target.value) : 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">动作的标准时间</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    空闲时间
                  </label>
                  <input
                    type="number"
                    value={actionFormData.idleTime || ''}
                    onChange={(e) => setActionFormData({ ...actionFormData, idleTime: e.target.value ? parseInt(e.target.value) : 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">此时间后开始空闲获取</p>
                </div>
              </div>

              {/* 右列 */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    OK Pin
                  </label>
                  <input
                    type="number"
                    value={actionFormData.okPin || 0}
                    onChange={(e) => setActionFormData({ ...actionFormData, okPin: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Error Pin
                  </label>
                  <input
                    type="number"
                    value={actionFormData.errorPin || 0}
                    onChange={(e) => setActionFormData({ ...actionFormData, errorPin: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    min="0"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={actionFormData.dSign || false}
                        onChange={(e) => setActionFormData({ ...actionFormData, dSign: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">D sign</span>
                    </label>
                    <span className="text-xs text-gray-500">D sign</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={actionFormData.sSign || false}
                        onChange={(e) => setActionFormData({ ...actionFormData, sSign: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">S sign</span>
                    </label>
                    <span className="text-xs text-gray-500">3 NOK后跟随SCRAP</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    错误后动作
                  </label>
                  <select
                    value={actionFormData.actionAfterError || ''}
                    onChange={(e) => setActionFormData({ ...actionFormData, actionAfterError: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="Repeat action">重复动作</option>
                    <option value="Skip action">跳过动作</option>
                    <option value="Stop process">停止流程</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    图片
                  </label>
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 bg-gray-50 dark:bg-gray-800">
                    <div className="text-center">
                      {actionImagePreview ? (
                        <div className="space-y-4">
                          <img
                            src={actionImagePreview}
                            alt="动作图片预览"
                            className="mx-auto w-32 h-32 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity shadow-md"
                            onClick={() => handleImageClick(actionImagePreview)}
                          />
                          <div className="flex items-center justify-center space-x-4">
                            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              <span>点击查看大图</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setActionImageFile(null);
                                setActionImagePreview('');
                              }}
                              className="text-red-600 hover:text-red-800 text-sm flex items-center space-x-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span>删除</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <svg className="mx-auto w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <div>
                            <label className="cursor-pointer">
                              <span className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                选择图片
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleActionImageUpload}
                                className="hidden"
                              />
                            </label>
                          </div>
                          <p className="text-xs text-gray-500">
                            支持 JPG、PNG、GIF 格式，建议尺寸不超过 2MB
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    声音文件
                  </label>
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 bg-gray-50 dark:bg-gray-800">
                    <div className="text-center">
                      {actionSoundPreview ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-center">
                            <div className="flex items-center space-x-3 bg-white dark:bg-gray-700 px-4 py-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM21 16c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                              </svg>
                              <div className="text-left">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {actionSoundPreview}
                                </div>
                                <div className="text-xs text-gray-500">
                                  音频文件
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-center space-x-4">
                            <button
                              type="button"
                              onClick={() => {
                                if (actionFormData.soundFile) {
                                  const audio = new Audio(actionFormData.soundFile);
                                  audio.play().catch(console.error);
                                }
                              }}
                              className="text-blue-600 hover:text-blue-800 text-sm flex items-center space-x-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293L14 13h3a1 1 0 011 1v3a1 1 0 01-1 1h-3l-2.707 2.707A1 1 0 0110.586 20H9a1 1 0 01-1-1v-8a1 1 0 011-1z" />
                              </svg>
                              <span>试听</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActionSoundFile(null);
                                setActionSoundPreview('');
                              }}
                              className="text-red-600 hover:text-red-800 text-sm flex items-center space-x-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span>删除</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <svg className="mx-auto w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM21 16c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                          </svg>
                          <div>
                            <label className="cursor-pointer">
                              <span className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                选择声音文件
                              </span>
                              <input
                                type="file"
                                accept="audio/*"
                                onChange={handleActionSoundUpload}
                                className="hidden"
                              />
                            </label>
                          </div>
                          <p className="text-xs text-gray-500">
                            支持 MP3、WAV、OGG 格式，建议大小不超过 10MB
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      图片宽度 (像素)
                    </label>
                    <input
                      type="number"
                      value={actionFormData.imageWidth || ''}
                      onChange={(e) => setActionFormData({ ...actionFormData, imageWidth: e.target.value ? parseInt(e.target.value) : 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      图片高度 (像素)
                    </label>
                    <input
                      type="number"
                      value={actionFormData.imageHeight || ''}
                      onChange={(e) => setActionFormData({ ...actionFormData, imageHeight: e.target.value ? parseInt(e.target.value) : 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={actionFormData.fullSizeImage || false}
                      onChange={(e) => setActionFormData({ ...actionFormData, fullSizeImage: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">全尺寸图片</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    图片位置
                  </label>
                  <select
                    value={actionFormData.imagePosition || ''}
                    onChange={(e) => setActionFormData({ ...actionFormData, imagePosition: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="Top-left">左上</option>
                    <option value="Top-center">顶部居中</option>
                    <option value="Top-right">右上</option>
                    <option value="Center-left">左侧居中</option>
                    <option value="Center">居中</option>
                    <option value="Center-right">右侧居中</option>
                    <option value="Bottom-left">左下</option>
                    <option value="Bottom-center">底部居中</option>
                    <option value="Bottom-right">右下</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    声音文件
                  </label>
                  <input
                    type="text"
                    value={actionFormData.soundFile || ''}
                    onChange={(e) => setActionFormData({ ...actionFormData, soundFile: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowActionModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveAction}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 工艺过程详细信息模态框 */}
      {showProcessModal && selectedProcess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              工艺过程详细信息
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    工艺编码
                  </label>
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md text-sm text-gray-900 dark:text-white">
                    {selectedProcess.processCode}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    工艺名称
                  </label>
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md text-sm text-gray-900 dark:text-white">
                    {selectedProcess.name}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    关联产品
                  </label>
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md text-sm text-gray-900 dark:text-white">
                    {selectedProcess.product?.name} ({selectedProcess.product?.productCode})
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    版本
                  </label>
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md text-sm text-gray-900 dark:text-white">
                    v{selectedProcess.version}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  描述
                </label>
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md text-sm text-gray-900 dark:text-white min-h-[60px]">
                  {selectedProcess.description || '无描述'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  工艺步骤 ({selectedProcess.steps?.length || 0} 个步骤)
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedProcess.steps && selectedProcess.steps.length > 0 ? (
                    selectedProcess.steps.map((step: any, index: number) => (
                      <div key={index} className="p-3 border border-gray-200 dark:border-gray-600 rounded-md">
                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            步骤 {step.sequence}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">{step.name}</span>
                          <span className="text-xs text-gray-500">({step.stepCode})</span>
                        </div>
                        {step.description && (
                          <div className="text-xs text-gray-500 mt-1">{step.description}</div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                      该工艺暂无步骤
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700 mt-6">
              <button
                onClick={() => handleRemoveProcessReference(selectedProcess.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                删除引用
              </button>
              <button
                onClick={() => setShowProcessModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 条件编辑模态框 */}
      {showConditionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingConditionIndex !== null && editingConditionIndex >= 0 ? '编辑条件' : '添加新条件'}
              </h2>
              <button
                onClick={handleCancelConditionEdit}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  条件类型 *
                </label>
                <select
                  value={conditionType}
                  onChange={(e) => setConditionType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="">请选择条件类型</option>
                  {conditionTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  条件值 *
                </label>
                <textarea
                  value={conditionValue}
                  onChange={(e) => setConditionValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  rows={3}
                  placeholder="输入条件值，多个值用 || 分隔，如：A2486227000||A2486229900"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  多个值使用 "||" 分隔，表示满足任意一个值时显示该步骤
                </p>
              </div>

              {conditionType && conditionValue && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>预览：</strong> {getConditionDescription(conditionType, conditionValue)}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4 mt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={handleCancelConditionEdit}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveCondition}
                disabled={!conditionType || !conditionValue.trim()}
                className={`px-4 py-2 rounded-md transition-colors ${
                  conditionType && conditionValue.trim()
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                }`}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 大图预览模态框 */}
      {showImagePreview && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-70">
          <div className="relative max-w-[80vw] max-h-[80vh] bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
            {/* 关闭按钮 */}
            <button
              onClick={closeImagePreview}
              className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70 transition-opacity"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* 图片 */}
            <img
              src={previewImageUrl}
              alt="步骤图片预览"
              className="w-full h-full object-contain"
              style={{ maxWidth: '80vw', maxHeight: '80vh' }}
            />
          </div>
          
          {/* 点击背景关闭 */}
          <div 
            className="absolute inset-0 -z-10"
            onClick={closeImagePreview}
          ></div>
        </div>
      )}
    </AdminLayout>
  );
}