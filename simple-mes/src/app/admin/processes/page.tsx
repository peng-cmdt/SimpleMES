"use client";

import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useLanguage } from "@/contexts/LanguageContext";

interface Product {
  id: string;
  productCode: string;
  name: string;
}

interface Workstation {
  id: string;
  workstationId: string;
  name: string;
}

interface Action {
  id?: string;
  actionCode: string;
  name: string;
  type: string;
  sequence: number;
  deviceId: string;
  deviceType?: string;
  sensorType?: string;
  sensorValue?: string;
  deviceAddress: string;
  expectedValue: string;
  validationRule: string;
  parameters: any;
  description?: string;
  isRequired?: boolean;
  timeout?: number;
  retryCount?: number;
}

interface Step {
  id?: string;
  stepCode: string;
  name: string;
  stepTemplateId?: string;
  stepTemplate?: {
    id: string;
    stepCode: string;
    name: string;
  };
  workstationId: string;
  workstation?: Workstation;
  sequence: number;
  description?: string;
  estimatedTime: number;
  isRequired: boolean;
  actions: Action[];
}

interface Process {
  id: string;
  processCode: string;
  name: string;
  productId: string;
  version: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  product: Product;
  steps: Step[];
  _count: {
    steps: number;
  };
}

interface ProcessFormData {
  processCode: string;
  name: string;
  productId: string;
  version: string;
  description: string;
  status: string;
  conditions?: string; // 新增条件字段
}

interface StepTemplate {
  id: string;
  stepCode: string;
  name: string;
  category?: string;
  description?: string;
  estimatedTime?: number;
  isRequired: boolean;
  workstationType?: string;
  workstationId?: string;
  workstation?: Workstation;
  instructions?: string;
  status: string;
  actionTemplates: ActionTemplate[];
}

interface ActionTemplate {
  id?: string;
  actionCode: string;
  name: string;
  type: string;
  deviceId?: string;
  deviceType?: string;
  sensorType?: string;
  sensorValue?: string;
  category?: string;
  deviceAddress?: string;
  expectedValue?: string;
  validationRule?: string;
  parameters?: any;
  description?: string;
  instructions?: string;
  isRequired: boolean;
  timeout?: number;
  retryCount: number;
}

export default function ProcessesPage() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [stepTemplates, setStepTemplates] = useState<StepTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showStepModal, setShowStepModal] = useState(false);
  const [showStepSelectModal, setShowStepSelectModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [editingAction, setEditingAction] = useState<Action | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [currentActionIndex, setCurrentActionIndex] = useState<number>(-1);
  const [expandedProcessId, setExpandedProcessId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'conditions' | 'steps'>('info');
  const [infoEditing, setInfoEditing] = useState(false);
  const [conditionItems, setConditionItems] = useState<string[]>([]);
  const [editingConditionIndex, setEditingConditionIndex] = useState<number | null>(null);
  const [conditionInput, setConditionInput] = useState('');
  const [formData, setFormData] = useState<ProcessFormData>({
    processCode: '',
    name: '',
    productId: '',
    version: '1.0',
    description: '',
    status: 'active',
    conditions: ''
  });
  const [stepFormData, setStepFormData] = useState<Step>({
    stepCode: '',
    name: '',
    workstationId: '',
    sequence: 1,
    description: '',
    estimatedTime: 0,
    isRequired: true,
    actions: []
  });
  const [actionFormData, setActionFormData] = useState<Action>({
    actionCode: '',
    name: '',
    type: 'DEVICE_READ',
    sequence: 1,
    deviceId: '',
    deviceType: '',
    sensorType: '',
    sensorValue: '',
    deviceAddress: '',
    expectedValue: '',
    validationRule: '',
    parameters: {},
    description: '',
    isRequired: true,
    timeout: 30,
    retryCount: 0
  });
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [stepSearchTerm, setStepSearchTerm] = useState('');
  const [stepCategoryFilter, setStepCategoryFilter] = useState('');
  const [selectedStepIds, setSelectedStepIds] = useState<string[]>([]);
  // 步骤表格搜索状态
  const [stepsTableSearch, setStepsTableSearch] = useState({
    name: '',
    stepType: '',
    stationType: '',
    description: '',
    stepId: '',
    processStepId: ''
  });
  // 拖拽排序状态
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [orderChanged, setOrderChanged] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    loadProcesses();
    loadProducts();
    loadWorkstations();
    loadStepTemplates();
  }, []);

  // 按需加载工艺流程详细信息（包含步骤和动作）
  const loadProcessDetails = async (processId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/processes/${processId}/details`);
      if (response.ok) {
        const data = await response.json();
        return data.data;
      }
    } catch (error) {
      console.error('Load process details error:', error);
    } finally {
      setIsLoading(false);
    }
    return null;
  };

  const loadProcesses = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/processes');
      if (response.ok) {
        const data = await response.json();
        setProcesses(data.data.processes);
      }
    } catch (error) {
      console.error('Load processes error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      // 使用轻量级API获取产品列表
      const response = await fetch('/api/products/simple');
      if (response.ok) {
        const data = await response.json();
        console.log('Products loaded:', data.data);
        setProducts(data.data);
      } else {
        console.error('Failed to load products:', response.status);
      }
    } catch (error) {
      console.error('Load products error:', error);
    }
  };

  const loadWorkstations = async () => {
    try {
      // 使用轻量级API获取工位列表
      const response = await fetch('/api/workstations/simple');
      if (response.ok) {
        const data = await response.json();
        setWorkstations(data.data);
      }
    } catch (error) {
      console.error('Load workstations error:', error);
    }
  };

  const loadStepTemplates = async () => {
    try {
      // 使用轻量级API获取步骤模板列表
      const response = await fetch('/api/step-templates/simple');
      if (response.ok) {
        const data = await response.json();
        setStepTemplates(data.data);
      }
    } catch (error) {
      console.error('Load step templates error:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const url = editingProcess ? `/api/processes/${editingProcess.id}` : '/api/processes';
      const method = editingProcess ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        await loadProcesses();
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

  const handleDelete = async (process: Process) => {
    if (!confirm(`确定要删除工艺 "${process.name}"吗？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/processes/${process.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadProcesses();
        setLastUpdated(new Date());
        if (expandedProcessId === process.id) {
          setExpandedProcessId(null);
        }
      } else {
        const data = await response.json();
        alert(data.error || '删除失败');
      }
    } catch (error) {
      alert('网络错误');
    }
  };

  const handleEdit = (process: Process) => {
    setEditingProcess(process);
    setFormData({
      processCode: process.processCode,
      name: process.name,
      productId: process.productId,
      version: process.version,
      description: process.description || '',
      status: process.status,
      conditions: '' // 这里可以从process中读取条件数据
    });
    setShowModal(true);
  };

  const handleProcessClick = async (process: Process) => {
    console.log('点击工艺:', process.name, 'ID:', process.id);
    console.log('当前展开的工艺ID:', expandedProcessId);
    
    // 清除任何错误状态
    setError('');
    
    if (expandedProcessId === process.id) {
      // 如果点击当前展开的工艺，折叠它
      console.log('折叠当前工艺');
      setExpandedProcessId(null);
      setEditingProcess(null);
    } else {
      // 展开新的工艺，同时折叠其他的
      console.log('展开新工艺，折叠其他工艺');
      setExpandedProcessId(process.id);
      
      // 按需加载详细数据
      const detailedProcess = await loadProcessDetails(process.id);
      if (detailedProcess) {
        setEditingProcess(detailedProcess);
        setFormData({
          processCode: detailedProcess.processCode,
          name: detailedProcess.name,
          productId: detailedProcess.productId,
          version: detailedProcess.version,
          description: detailedProcess.description || '',
          status: detailedProcess.status,
          conditions: '' // 这里可以从process中读取条件数据
        });
      } else {
        // 如果加载失败，使用基本数据
        setEditingProcess(process);
        setFormData({
          processCode: process.processCode,
          name: process.name,
          productId: process.productId,
          version: process.version,
          description: process.description || '',
          status: process.status,
          conditions: ''
        });
      }
      
      console.log('设置表单数据:', {
        processCode: process.processCode,
        productId: process.productId
      });
      setActiveTab('info');
      // 重置编辑状态
      setInfoEditing(false);
      // 重置排序状态
      setOrderChanged(false);
      setDraggedIndex(null);
    }
  };

  const resetForm = () => {
    setEditingProcess(null);
    setFormData({
      processCode: '',
      name: '',
      productId: '',
      version: '1.0',
      description: '',
      status: 'active',
      conditions: ''
    });
    setError('');
  };

  // 信息选项卡操作函数
  const handleInfoEdit = () => {
    setError(''); // 清除之前的错误
    setInfoEditing(true);
  };

  const handleInfoSave = async () => {
    console.log('保存函数被调用');
    console.log('当前编辑的工艺:', editingProcess);
    console.log('表单数据:', formData);
    
    if (!editingProcess) {
      console.log('没有选择编辑的工艺');
      return;
    }
    
    // 验证必填字段
    if (!formData.productId) {
      console.log('产品ID为空');
      setError('请选择关联产品');
      return;
    }
    
    setError('');
    
    try {
      console.log('发送保存请求...');
      const response = await fetch(`/api/processes/${editingProcess.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      console.log('API响应状态:', response.status);
      const data = await response.json();
      console.log('API响应数据:', data);

      if (response.ok) {
        console.log('保存成功，重新加载数据...');
        // 重新加载processes列表获取最新数据
        await loadProcesses();
        setInfoEditing(false);
        
        // 更新当前编辑的process数据
        if (data.data) {
          setEditingProcess(data.data);
        }
        
        setLastUpdated(new Date());
        alert('保存成功');
      } else {
        console.log('保存失败:', data);
        setError(data.error || '保存失败');
      }
    } catch (error) {
      console.error('保存错误:', error);
      setError('网络错误，请检查连接');
    }
  };

  const handleCopyProcess = () => {
    if (!editingProcess) return;
    const newProcessCode = `${editingProcess.processCode}-COPY-${Date.now().toString().slice(-6)}`;
    setFormData({
      processCode: newProcessCode,
      name: `${editingProcess.name} - 副本`,
      productId: editingProcess.productId,
      version: '1.0',
      description: editingProcess.description || '',
      status: 'active',
      conditions: formData.conditions || ''
    });
    setShowModal(true);
  };

  // 条件管理函数
  const handleAddCondition = () => {
    setConditionInput('');
    setEditingConditionIndex(-1);
  };

  const handleEditCondition = (index: number) => {
    setConditionInput(conditionItems[index]);
    setEditingConditionIndex(index);
  };

  const handleSaveCondition = () => {
    if (conditionInput.trim()) {
      const newConditions = [...conditionItems];
      if (editingConditionIndex !== null && editingConditionIndex >= 0) {
        newConditions[editingConditionIndex] = conditionInput.trim();
      } else {
        newConditions.push(conditionInput.trim());
      }
      setConditionItems(newConditions);
      setConditionInput('');
      setEditingConditionIndex(null);
    }
  };

  const handleDeleteCondition = (index: number) => {
    const newConditions = conditionItems.filter((_, i) => i !== index);
    setConditionItems(newConditions);
    setConditionInput('');
    setEditingConditionIndex(null);
  };

  const handleCancelConditionEdit = () => {
    setConditionInput('');
    setEditingConditionIndex(null);
  };

  // 步骤管理函数
  const addStep = () => {
    setShowStepSelectModal(true);
  };

  const createStepsFromTemplates = async () => {
    if (!editingProcess || selectedStepIds.length === 0) return;
    
    setIsLoading(true);
    try {
      const selectedTemplates = stepTemplates.filter(template => selectedStepIds.includes(template.id));
      const newSteps: Step[] = [];
      
      selectedTemplates.forEach((template, templateIndex) => {
        const stepSequence = (editingProcess?.steps || []).length + templateIndex + 1;
        const newStep: Step = {
          stepCode: template.stepCode,
          name: template.name,
          stepTemplateId: template.id, // 添加步骤模板ID
          workstationId: template.workstationId || '',
          sequence: stepSequence,
          description: template.description || '',
          estimatedTime: template.estimatedTime || 0,
          isRequired: template.isRequired,
          actions: template.actionTemplates.map((actionTemplate, index) => {
            // 从parameters中获取设备信息，因为实际数据存储在parameters字段中
            const params = actionTemplate.parameters as any || {};
            return {
              actionCode: `A${index + 1}`,
              name: actionTemplate.name,
              type: actionTemplate.type,
              sequence: index + 1,
              deviceId: params.deviceId || actionTemplate.deviceId || '',
              deviceType: actionTemplate.deviceType || '',
              sensorType: params.sensorType || actionTemplate.sensorType || '',
              sensorValue: params.sensorValue || actionTemplate.sensorValue || '',
              deviceAddress: params.sensorValue || actionTemplate.deviceAddress || '',
              expectedValue: params.sensorValue || actionTemplate.expectedValue || '',
              validationRule: actionTemplate.validationRule || '',
              parameters: actionTemplate.parameters || {},
              description: actionTemplate.description || '',
              isRequired: actionTemplate.isRequired,
              timeout: actionTemplate.timeout || 30,
              retryCount: actionTemplate.retryCount || 0,
            };
          })
        };
        newSteps.push(newStep);
      });

      const updatedSteps = [...(editingProcess.steps || []), ...newSteps];
      
      console.log('Saving steps to API:', {
        processId: editingProcess.id,
        stepsCount: newSteps.length,
        steps: newSteps
      });
      
      // 调用API保存到数据库
      const response = await fetch(`/api/processes/${editingProcess.id}/steps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          steps: newSteps
        }),
      });

      console.log('API Response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('API Response result:', result);
        
        // 重新加载流程列表以获取最新数据
        await loadProcesses();
        
        // 更新当前编辑的流程数据
        if (result.data && result.data.process) {
          setEditingProcess(result.data.process);
        }
        
        setSelectedStepIds([]);
        setShowStepSelectModal(false);
        setLastUpdated(new Date());
        
        // 显示成功消息
        alert(`成功添加 ${result.data?.createdSteps?.length || 0} 个步骤到工艺流程`);
      } else {
        const errorData = await response.json();
        console.error('Failed to save steps:', errorData);
        alert(t('common.saveFailed') + ': ' + (errorData.error || '未知错误'));
      }
    } catch (error) {
      console.error('Error saving steps:', error);
      alert(t('common.saveFailed') + ': ' + t('error.networkError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleStepSelection = (stepId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedStepIds(prev => [...prev, stepId]);
    } else {
      setSelectedStepIds(prev => prev.filter(id => id !== stepId));
    }
  };

  const handleSelectAllSteps = (isSelected: boolean) => {
    if (isSelected) {
      const filteredTemplateIds = stepTemplates
        .filter(template => {
          const matchesSearch = template.name.toLowerCase().includes(stepSearchTerm.toLowerCase()) ||
                              template.stepCode.toLowerCase().includes(stepSearchTerm.toLowerCase());
          const matchesCategory = !stepCategoryFilter || template.category === stepCategoryFilter;
          return matchesSearch && matchesCategory;
        })
        .map(template => template.id);
      setSelectedStepIds(filteredTemplateIds);
    } else {
      setSelectedStepIds([]);
    }
  };

  const editStep = (index: number) => {
    const step = editingProcess?.steps[index];
    if (step) {
      setEditingStep(step);
      setCurrentStepIndex(index);
      setStepFormData({ 
        ...step,
        actions: step.actions || []
      });
      setShowStepModal(true);
    }
  };

  const saveStep = async () => {
    if (!editingProcess) {
      alert('请先选择要编辑的工艺流程');
      return;
    }

    try {
      // 准备步骤数据
      const stepData = {
        stepCode: stepFormData.stepCode,
        name: stepFormData.name,
        workstationId: stepFormData.workstationId || null,
        sequence: stepFormData.sequence,
        description: stepFormData.description || null,
        estimatedTime: stepFormData.estimatedTime || 0,
        isRequired: stepFormData.isRequired
      };

      let response;
      if (editingStep && editingStep.id) {
        // 更新现有步骤
        response = await fetch(`/api/steps/${editingStep.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stepData)
        });
      } else {
        // 创建新步骤
        response = await fetch('/api/steps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...stepData,
            processId: editingProcess.id
          })
        });
      }

      if (response.ok) {
        const result = await response.json();
        
        // 重新加载当前编辑的进程详细数据以获取最新状态（包含完整的steps和actions）
        if (editingProcess?.id) {
          const processResponse = await fetch(`/api/processes/${editingProcess.id}/details`);
          if (processResponse.ok) {
            const processData = await processResponse.json();
            if (processData.success) {
              console.log('Updated process data after step save:', processData.data);
              setEditingProcess(processData.data);
              
              // 更新editingStep
              const updatedStep = processData.data.steps.find((s: any) => s.id === result.data.id || s.stepCode === stepFormData.stepCode);
              if (updatedStep) {
                setEditingStep(updatedStep);
              }
            }
          }
        }
        
        setShowStepModal(false);
        setLastUpdated(new Date());
        alert(editingStep ? '步骤更新成功' : '步骤添加成功');
      } else {
        const errorData = await response.json();
        alert('保存失败：' + (errorData.error || '未知错误'));
      }
    } catch (error) {
      console.error('保存步骤失败:', error);
      alert('网络错误，保存失败');
    }
  };

  const removeStep = async (index: number) => {
    if (!editingProcess) return;
    
    const stepToDelete = editingProcess.steps[index];
    if (!stepToDelete?.id) {
      // 如果是新创建的步骤（没有ID），只从本地状态删除
      const newSteps = editingProcess.steps.filter((_, i) => i !== index);
      setEditingProcess({
        ...editingProcess,
        steps: newSteps
      });
      return;
    }

    if (confirm('确定要删除此步骤吗？')) {
      try {
        setIsLoading(true);
        
        console.log('Deleting step:', stepToDelete);
        console.log('API URL:', `/api/processes/${editingProcess.id}/steps?stepId=${stepToDelete.id}`);
        
        const response = await fetch(`/api/processes/${editingProcess.id}/steps?stepId=${stepToDelete.id}`, {
          method: 'DELETE',
        });

        console.log('Delete response status:', response.status);
        console.log('Delete response headers:', Object.fromEntries(response.headers.entries()));
        
        const result = await response.json();
        console.log('Delete response data:', result);
        
        if (response.ok && result.success) {
          // 重新加载当前编辑的进程详细数据以获取最新状态（包含完整的steps和actions）
          if (editingProcess?.id) {
            const processResponse = await fetch(`/api/processes/${editingProcess.id}/details`);
            if (processResponse.ok) {
              const processData = await processResponse.json();
              if (processData.success) {
                console.log('Updated process data after step deletion:', processData.data);
                setEditingProcess(processData.data);
              }
            }
          }
          
          setLastUpdated(new Date());
          alert('步骤删除成功');
        } else {
          console.error('删除步骤失败:', result);
          const errorMessage = result.error || result.message || '删除步骤失败，未知错误';
          alert('删除步骤失败: ' + errorMessage);
        }
      } catch (error) {
        console.error('删除步骤时发生错误:', error);
        const errorMessage = error instanceof Error ? error.message : '网络错误';
        alert('删除步骤时发生网络错误: ' + errorMessage);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // 拖拽处理函数
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex || !editingProcess) {
      setDraggedIndex(null);
      return;
    }

    const newSteps = [...editingProcess.steps];
    const draggedStep = newSteps[draggedIndex];
    
    // 移除被拖拽的项目
    newSteps.splice(draggedIndex, 1);
    // 在新位置插入
    newSteps.splice(dropIndex, 0, draggedStep);
    
    // 重新分配sequence
    newSteps.forEach((step, index) => {
      step.sequence = index + 1;
    });

    setEditingProcess({
      ...editingProcess,
      steps: newSteps
    });
    
    setDraggedIndex(null);
    setOrderChanged(true);
  };

  // 保存步骤顺序
  const saveStepsOrder = async () => {
    if (!editingProcess || !orderChanged) return;
    
    setSavingOrder(true);
    try {
      const response = await fetch(`/api/processes/${editingProcess.id}/steps/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          steps: editingProcess.steps.map((step, index) => ({
            id: step.id,
            sequence: index + 1
          }))
        }),
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        await loadProcesses();
        if (result.data && result.data.process) {
          setEditingProcess(result.data.process);
        }
        setOrderChanged(false);
        setLastUpdated(new Date());
        alert(t('common.saveSuccess'));
      } else {
        console.error('保存步骤顺序失败:', result);
        alert(t('common.saveFailed') + ': ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('保存步骤顺序时发生错误:', error);
      alert(t('common.saveFailed') + ': ' + t('error.networkError'));
    } finally {
      setSavingOrder(false);
    }
  };

  // 动作管理函数
  const addAction = () => {
    setEditingAction(null);
    setCurrentActionIndex(-1);
    setActionFormData({
      actionCode: `A${(stepFormData.actions || []).length + 1}`,
      name: '',
      type: 'DEVICE_READ',
      sequence: (stepFormData.actions || []).length + 1,
      deviceId: '',
      deviceType: '',
      sensorType: '',
      sensorValue: '',
      deviceAddress: '',
      expectedValue: '',
      validationRule: '',
      parameters: {},
      description: '',
      isRequired: true,
      timeout: 30,
      retryCount: 0
    });
    setShowActionModal(true);
  };

  const editAction = (index: number) => {
    const action = stepFormData.actions[index];
    setEditingAction(action);
    setCurrentActionIndex(index);
    setActionFormData({ ...action });
    setShowActionModal(true);
  };

  const saveAction = async () => {
    if (!editingStep?.id) {
      // 如果步骤还没有ID，需要先保存步骤
      alert('请先保存步骤信息，然后再添加动作');
      return;
    }

    try {
      // 准备动作数据
      const actionData = {
        stepId: editingStep.id,
        actionCode: actionFormData.actionCode,
        name: actionFormData.name,
        type: actionFormData.type,
        sequence: actionFormData.sequence,
        deviceId: actionFormData.deviceId || null,
        deviceAddress: actionFormData.deviceAddress || null,
        expectedValue: actionFormData.expectedValue || null,
        validationRule: actionFormData.validationRule || null,
        parameters: actionFormData.parameters || {},
        description: actionFormData.description || null,
        isRequired: true,
        timeout: 30,
        retryCount: actionFormData.retryCount || 0
      };

      console.log('Saving action with data:', actionData);
      console.log('EditingStep info:', editingStep);

      let response;
      if (editingAction && editingAction.id) {
        // 更新现有动作
        console.log('Updating existing action:', editingAction.id);
        response = await fetch(`/api/actions/${editingAction.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(actionData)
        });
      } else {
        // 创建新动作
        console.log('Creating new action for step:', editingStep.id);
        response = await fetch('/api/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(actionData)
        });
      }

      console.log('Response status:', response.status);
      if (response.ok) {
        const result = await response.json();
        console.log('Action save response:', result);
        
        // 更新本地状态
        const newActions = [...(stepFormData.actions || [])];
        if (currentActionIndex >= 0) {
          newActions[currentActionIndex] = result.data;
        } else {
          newActions.push(result.data);
        }
        
        setStepFormData({
          ...stepFormData,
          actions: newActions
        });
        
        // 重新加载当前编辑的进程详细数据，而不是重新加载所有进程列表
        if (editingProcess?.id) {
          console.log('Reloading current process details...');
          const processResponse = await fetch(`/api/processes/${editingProcess.id}/details`);
          if (processResponse.ok) {
            const processData = await processResponse.json();
            if (processData.success) {
              console.log('Updated process data:', processData.data);
              setEditingProcess(processData.data);
              
              // 更新editingStep中的actions
              const updatedStep = processData.data.steps.find((s: any) => s.id === editingStep.id);
              if (updatedStep) {
                console.log('Updated step with actions:', updatedStep);
                setEditingStep(updatedStep);
              }
            }
          }
        }
        
        setShowActionModal(false);
        setLastUpdated(new Date());
        alert(editingAction ? '动作更新成功' : '动作添加成功');
      } else {
        const errorData = await response.json();
        console.error('Action save failed with response:', errorData);
        console.error('Response status:', response.status);
        console.error('Response headers:', Object.fromEntries(response.headers.entries()));
        alert('保存失败：' + (errorData.error || errorData.message || '未知错误'));
      }
    } catch (error) {
      console.error('保存动作失败:', error);
      alert('网络错误，保存失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  const removeAction = async (index: number) => {
    if (!confirm('确定要删除此动作吗？')) {
      return;
    }

    const actionToDelete = stepFormData.actions[index];
    
    try {
      if (actionToDelete.id) {
        // 如果动作已保存到数据库，调用API删除
        const response = await fetch(`/api/actions/${actionToDelete.id}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          const errorData = await response.json();
          alert('删除失败：' + (errorData.error || '未知错误'));
          return;
        }
      }

      // 更新本地状态
      const newActions = stepFormData.actions.filter((_, i) => i !== index);
      setStepFormData({
        ...stepFormData,
        actions: newActions
      });

      // 重新加载进程数据
      await loadProcesses();
      
      setLastUpdated(new Date());
      alert('动作删除成功');
    } catch (error) {
      console.error('删除动作失败:', error);
      alert('网络错误，删除失败');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '启用';
      case 'inactive':
        return '禁用';
      default:
        return status;
    }
  };

  const getActionTypeLabel = (type: string) => {
    switch (type) {
      case 'DEVICE_READ':
        return '设备读取';
      case 'DEVICE_WRITE':
        return '设备写入';
      case 'SCAN_BARCODE':
        return '扫码';
      case 'MANUAL_CHECK':
        return '人工确认';
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="工艺管理">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="工艺管理">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            工艺管理
          </h2>
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              管理生产工艺流程
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
              loadProcesses();
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
            新增工艺
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                工艺信息
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                关联产品
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                步骤数量
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                状态
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
            {processes.map((process) => (
              <React.Fragment key={process.id}>
                <tr 
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => handleProcessClick(process)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    <div className="flex items-center">
                      <svg 
                        className={`w-4 h-4 mr-3 transform transition-transform ${expandedProcessId === process.id ? 'rotate-90' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{process.name}</div>
                        <div className="text-xs text-gray-400">{process.processCode} - v{process.version}</div>
                        {process.description && (
                          <div className="text-xs text-gray-400 mt-1">{process.description}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    <div>
                      <div className="font-medium">{process.product.name}</div>
                      <div className="text-xs text-gray-400">{process.product.productCode}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {process._count.steps} 个步骤
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(process.status)}`}>
                      {getStatusText(process.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {new Date(process.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <span className="text-gray-500 dark:text-gray-400">点击展开详情</span>
                  </td>
                </tr>
                
                {/* 展开的选项卡内容 */}
                {expandedProcessId === process.id && editingProcess && (
                  <tr>
                    <td colSpan={6} className="p-4 bg-gray-100 dark:bg-gray-900">
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
                            onClick={() => setActiveTab('steps')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${
                              activeTab === 'steps'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                          >
                            步骤
                          </button>
                        </nav>
                      </div>
                      
                      {/* 选项卡内容 */}
                      <div className="py-6">
                        {/* 信息选项卡 */}
                        {activeTab === 'info' && (
                          <div className="space-y-4">
                            {/* 左上角操作按钮 */}
                            <div className="flex justify-between items-center">
                              <div className="flex space-x-2">
                                <button
                                  onClick={handleInfoEdit}
                                  disabled={infoEditing}
                                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {infoEditing ? '编辑中...' : '编辑'}
                                </button>
                                <button
                                  onClick={handleCopyProcess}
                                  className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                                >
                                  拷贝
                                </button>
                                <button
                                  onClick={() => handleDelete(editingProcess)}
                                  className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
                                >
                                  删除
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  工艺编码
                                </label>
                                {infoEditing ? (
                                  <input
                                    type="text"
                                    value={formData.processCode}
                                    onChange={(e) => setFormData({ ...formData, processCode: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                  />
                                ) : (
                                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md text-sm text-gray-900 dark:text-white">
                                    {editingProcess.processCode}
                                  </div>
                                )}
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  工艺名称
                                </label>
                                {infoEditing ? (
                                  <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                  />
                                ) : (
                                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md text-sm text-gray-900 dark:text-white">
                                    {editingProcess.name}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  版本
                                </label>
                                {infoEditing ? (
                                  <input
                                    type="text"
                                    value={formData.version}
                                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                  />
                                ) : (
                                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md text-sm text-gray-900 dark:text-white">
                                    {editingProcess.version}
                                  </div>
                                )}
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  状态
                                </label>
                                {infoEditing ? (
                                  <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                  >
                                    <option value="active">启用</option>
                                    <option value="inactive">禁用</option>
                                  </select>
                                ) : (
                                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(editingProcess.status)}`}>
                                      {getStatusText(editingProcess.status)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                关联产品
                              </label>
                              {infoEditing ? (
                                <select
                                  value={formData.productId}
                                  onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                >
                                  <option value="">请选择产品</option>
                                  {products.map((product) => (
                                    <option key={product.id} value={product.id}>
                                      {product.name} ({product.productCode})
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md text-sm text-gray-900 dark:text-white">
                                  {editingProcess.product.name} ({editingProcess.product.productCode})
                                </div>
                              )}
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                描述
                              </label>
                              {infoEditing ? (
                                <textarea
                                  value={formData.description}
                                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                  rows={3}
                                />
                              ) : (
                                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md text-sm text-gray-900 dark:text-white">
                                  {editingProcess.description || '无描述'}
                                </div>
                              )}
                            </div>

                            {/* 左下方保存按钮 */}
                            {infoEditing && (
                              <div className="flex flex-col items-start pt-4">
                                {error && (
                                  <div className="text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md mb-3 w-full">
                                    {error}
                                  </div>
                                )}
                                <button
                                  onClick={handleInfoSave}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                >
                                  保存
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* 条件选项卡 */}
                        {activeTab === 'conditions' && (
                          <div className="space-y-4">
                            {/* 左上角操作按钮 */}
                            <div className="flex justify-between items-center">
                              <div className="flex space-x-2">
                                <button
                                  onClick={handleAddCondition}
                                  className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                                >
                                  添加
                                </button>
                                <button
                                  onClick={() => {
                                    if (conditionItems.length > 0) {
                                      handleEditCondition(0);
                                    }
                                  }}
                                  disabled={conditionItems.length === 0}
                                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  编辑
                                </button>
                              </div>
                            </div>

                            {/* 条件输入区域 */}
                            {editingConditionIndex !== null && (
                              <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4">
                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                      {editingConditionIndex !== null && editingConditionIndex >= 0 ? '编辑条件' : '添加新条件'}
                                    </label>
                                    <textarea
                                      value={conditionInput}
                                      onChange={(e) => setConditionInput(e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                      rows={3}
                                      placeholder="请输入工艺执行条件..."
                                    />
                                  </div>
                                  <div className="flex justify-between">
                                    <button
                                      onClick={() => {
                                        if (editingConditionIndex !== null && editingConditionIndex >= 0) {
                                          handleDeleteCondition(editingConditionIndex);
                                        }
                                      }}
                                      disabled={editingConditionIndex === null || editingConditionIndex < 0}
                                      className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      删除
                                    </button>
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={handleCancelConditionEdit}
                                        className="px-3 py-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm"
                                      >
                                        取消
                                      </button>
                                      <button
                                        onClick={handleSaveCondition}
                                        disabled={!conditionInput.trim()}
                                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        保存
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 条件列表 */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                条件列表
                              </label>
                              {conditionItems.length > 0 ? (
                                <div className="space-y-2">
                                  {conditionItems.map((condition, index) => (
                                    <div
                                      key={index}
                                      onDoubleClick={() => handleEditCondition(index)}
                                      className="p-3 border border-gray-200 dark:border-gray-600 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mr-2">
                                            条件 {index + 1}
                                          </span>
                                          <span className="text-gray-900 dark:text-white">{condition}</span>
                                        </div>
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        双击编辑此条件
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                  暂无条件，点击"添加"按钮开始添加工艺执行条件
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* 步骤选项卡 */}
                        {activeTab === 'steps' && (
                          <div className="space-y-4">
                            {/* 操作按钮行 */}
                            <div className="flex justify-start items-center space-x-2">
                              <button
                                onClick={addStep}
                                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors flex items-center"
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                {t('processes.steps.addNewStep')}
                              </button>
                              <button
                                className={`px-4 py-2 text-white text-sm rounded-md transition-colors ${
                                  orderChanged && !savingOrder
                                    ? 'bg-red-600 hover:bg-red-700'
                                    : 'bg-gray-400 cursor-not-allowed'
                                }`}
                                onClick={saveStepsOrder}
                                disabled={!orderChanged || savingOrder}
                              >
                                {savingOrder ? t('common.loading') : t('processes.steps.saveOrder')}
                              </button>
                              <button
                                className="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 transition-colors"
                                onClick={() => {
                                  // 列管理功能
                                  console.log('Columns clicked');
                                }}
                              >
                                {t('processes.steps.columns')}
                              </button>
                            </div>

                            {/* 步骤表格 */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-16">
                                      <div className="flex flex-col">
                                        <span>{t('processes.steps.order')}</span>
                                        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                        </svg>
                                      </div>
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                      {t('processes.steps.name')}
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                      {t('processes.steps.stepType')}
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                      {t('processes.steps.stationType')}
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                      {t('processes.steps.description')}
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                      {t('processes.steps.stepId')}
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                      {t('processes.steps.processStepId')}
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                      操作
                                    </th>
                                  </tr>
                                  {/* 搜索行 */}
                                  <tr className="bg-gray-50 dark:bg-gray-700">
                                    <td className="px-4 py-2">
                                      {/* Order列不需要搜索 */}
                                    </td>
                                    <td className="px-4 py-2">
                                      <input
                                        type="text"
                                        placeholder="Search"
                                        value={stepsTableSearch.name}
                                        onChange={(e) => setStepsTableSearch({...stepsTableSearch, name: e.target.value})}
                                        className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                                      />
                                    </td>
                                    <td className="px-4 py-2">
                                      <input
                                        type="text"
                                        placeholder="Search"
                                        value={stepsTableSearch.stepType}
                                        onChange={(e) => setStepsTableSearch({...stepsTableSearch, stepType: e.target.value})}
                                        className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                                      />
                                    </td>
                                    <td className="px-4 py-2">
                                      <input
                                        type="text"
                                        placeholder="Search"
                                        value={stepsTableSearch.stationType}
                                        onChange={(e) => setStepsTableSearch({...stepsTableSearch, stationType: e.target.value})}
                                        className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                                      />
                                    </td>
                                    <td className="px-4 py-2">
                                      <input
                                        type="text"
                                        placeholder="Search"
                                        value={stepsTableSearch.description}
                                        onChange={(e) => setStepsTableSearch({...stepsTableSearch, description: e.target.value})}
                                        className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                                      />
                                    </td>
                                    <td className="px-4 py-2">
                                      <input
                                        type="text"
                                        placeholder="Search"
                                        value={stepsTableSearch.stepId}
                                        onChange={(e) => setStepsTableSearch({...stepsTableSearch, stepId: e.target.value})}
                                        className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                                      />
                                    </td>
                                    <td className="px-4 py-2">
                                      <input
                                        type="text"
                                        placeholder="Search"
                                        value={stepsTableSearch.processStepId}
                                        onChange={(e) => setStepsTableSearch({...stepsTableSearch, processStepId: e.target.value})}
                                        className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                                      />
                                    </td>
                                    <td className="px-4 py-2">
                                      {/* 操作列不需要搜索 */}
                                    </td>
                                  </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                  {(editingProcess.steps || [])
                                    .filter(step => {
                                      // 应用搜索过滤
                                      const nameMatch = step.name.toLowerCase().includes(stepsTableSearch.name.toLowerCase());
                                      const stepTypeMatch = stepsTableSearch.stepType === '' || 'Universal'.toLowerCase().includes(stepsTableSearch.stepType.toLowerCase());
                                      const stationMatch = stepsTableSearch.stationType === '' || (step.workstation?.name || '').toLowerCase().includes(stepsTableSearch.stationType.toLowerCase());
                                      const descMatch = stepsTableSearch.description === '' || (step.description || '').toLowerCase().includes(stepsTableSearch.description.toLowerCase());
                                      const stepIdMatch = stepsTableSearch.stepId === '' || (step.stepTemplate?.stepCode || '').toLowerCase().includes(stepsTableSearch.stepId.toLowerCase());
                                      const processStepIdMatch = stepsTableSearch.processStepId === '' || step.stepCode.toLowerCase().includes(stepsTableSearch.processStepId.toLowerCase());
                                      
                                      return nameMatch && stepTypeMatch && stationMatch && descMatch && stepIdMatch && processStepIdMatch;
                                    })
                                    .map((step, filteredIndex) => {
                                      // 找到在原始数组中的真实索引
                                      const realIndex = (editingProcess.steps || []).findIndex(s => s.id === step.id || (s.stepCode === step.stepCode && s.name === step.name));
                                      
                                      return (
                                    <tr 
                                      key={step.id || filteredIndex} 
                                      className={`hover:bg-gray-50 dark:hover:bg-gray-700 cursor-move ${
                                        draggedIndex === realIndex ? 'opacity-50' : ''
                                      }`}
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, realIndex)}
                                      onDragOver={handleDragOver}
                                      onDrop={(e) => handleDrop(e, realIndex)}
                                      onDoubleClick={() => editStep(realIndex)}
                                    >
                                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                        <div className="flex items-center space-x-2">
                                          <svg className="w-4 h-4 text-gray-400 cursor-move" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                          </svg>
                                          <span>{step.sequence}</span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-600 dark:text-blue-400 font-medium">
                                        {step.name}
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {t('processes.steps.universal')}
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {step.workstation?.name || '-'}
                                      </td>
                                      <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                        {step.description || '-'}
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-600 dark:text-blue-400">
                                        {step.stepTemplate?.stepCode ? (
                                          <a
                                            href={`/admin/step-templates?highlightId=${step.stepTemplate.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline hover:no-underline transition-colors"
                                            onClick={(e) => {
                                              e.stopPropagation(); // 阻止触发行的双击事件
                                            }}
                                          >
                                            {step.stepTemplate.stepCode}
                                          </a>
                                        ) : (
                                          <span className="text-gray-400">-</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-600 dark:text-blue-400">
                                        {editingProcess.id ? editingProcess.id.slice(-4) : '-'}
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex items-center space-x-2">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              editStep(realIndex);
                                            }}
                                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                                            title="编辑步骤"
                                          >
                                            编辑
                                          </button>
                                          <span className="text-gray-300">|</span>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              removeStep(realIndex);
                                            }}
                                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 font-medium"
                                            title="删除步骤"
                                          >
                                            删除
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                      );
                                    })}
                                  
                                  {(editingProcess.steps || []).length === 0 && (
                                    <tr>
                                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                        暂无生产步骤，点击"{t('processes.steps.addNewStep')}"开始设计工艺流程
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* 新增/编辑工艺模态框 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingProcess ? '编辑工艺' : '新增工艺'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    工艺编码 *
                  </label>
                  <input
                    type="text"
                    value={formData.processCode}
                    onChange={(e) => setFormData({ ...formData, processCode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="工艺编码"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    工艺名称 *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="工艺名称"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    关联产品 *
                  </label>
                  <select
                    value={formData.productId}
                    onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="">请选择产品</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.productCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    版本
                  </label>
                  <input
                    type="text"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="版本号"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  状态
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="active">启用</option>
                  <option value="inactive">禁用</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  rows={3}
                  placeholder="工艺描述"
                />
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
                  {editingProcess ? '更新' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 步骤编辑模态框 */}
      {showStepModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                Edit process step
              </h2>
              <button
                onClick={() => setShowStepModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Step name
              </label>
              <input
                type="text"
                value={stepFormData.name}
                onChange={(e) => setStepFormData({ ...stepFormData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="步骤名称"
              />
            </div>

            <div className="flex justify-between space-x-3">
              <button
                type="button"
                onClick={() => {
                  if (editingStep && confirm('确定要删除此步骤吗？')) {
                    if (editingProcess) {
                      const stepIndex = editingProcess.steps.findIndex(s => s.id === editingStep.id);
                      if (stepIndex >= 0) {
                        removeStep(stepIndex);
                      }
                    }
                    setShowStepModal(false);
                  }
                }}
                disabled={!editingStep}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setShowStepModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 动作编辑模态框 */}
      {showActionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingAction ? '编辑动作' : '新增动作'}
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    动作编码 *
                  </label>
                  <input
                    type="text"
                    value={actionFormData.actionCode}
                    onChange={(e) => setActionFormData({ ...actionFormData, actionCode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="动作编码"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    动作名称 *
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    动作类型 *
                  </label>
                  <select
                    value={actionFormData.type}
                    onChange={(e) => setActionFormData({ ...actionFormData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="DEVICE_READ">设备读取</option>
                    <option value="DEVICE_WRITE">设备写入</option>
                    <option value="SCAN_BARCODE">扫码</option>
                    <option value="MANUAL_CHECK">人工确认</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    设备ID
                  </label>
                  <input
                    type="text"
                    value={actionFormData.deviceId}
                    onChange={(e) => setActionFormData({ ...actionFormData, deviceId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="设备ID"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    设备地址
                  </label>
                  <input
                    type="text"
                    value={actionFormData.deviceAddress}
                    onChange={(e) => setActionFormData({ ...actionFormData, deviceAddress: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="设备地址"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    期望值
                  </label>
                  <input
                    type="text"
                    value={actionFormData.expectedValue}
                    onChange={(e) => setActionFormData({ ...actionFormData, expectedValue: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="期望值"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  验证规则
                </label>
                <input
                  type="text"
                  value={actionFormData.validationRule}
                  onChange={(e) => setActionFormData({ ...actionFormData, validationRule: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="验证规则"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  动作描述
                </label>
                <textarea
                  value={actionFormData.description || ''}
                  onChange={(e) => setActionFormData({ ...actionFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  rows={3}
                  placeholder="动作详细描述"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
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
                  {editingAction ? '更新动作' : '添加动作'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 步骤模板选择对话框 */}
      {showStepSelectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {t('processes.steps.addStepsTitle')}
            </h2>

            {/* Step ID(s) 输入框 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('processes.steps.selectedStepIds')}*
              </label>
              <input
                type="text"
                value={selectedStepIds.join(', ')}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder={t('processes.steps.selectedStepIdsPlaceholder')}
              />
            </div>

            {/* 搜索和筛选 */}
            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <input
                  type="text"
                  value={stepSearchTerm}
                  onChange={(e) => setStepSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder={t('processes.steps.searchPlaceholder')}
                />
              </div>
              <div>
                <select
                  value={stepCategoryFilter}
                  onChange={(e) => setStepCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">{t('processes.steps.allCategories')}</option>
                  {Array.from(new Set(stepTemplates.map(t => t.category).filter(Boolean))).map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 步骤模板表格 */}
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden mb-4">
              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={selectedStepIds.length > 0 && stepTemplates
                            .filter(template => {
                              const matchesSearch = template.name.toLowerCase().includes(stepSearchTerm.toLowerCase()) ||
                                                  template.stepCode.toLowerCase().includes(stepSearchTerm.toLowerCase());
                              const matchesCategory = !stepCategoryFilter || template.category === stepCategoryFilter;
                              return matchesSearch && matchesCategory;
                            })
                            .every(template => selectedStepIds.includes(template.id))}
                          onChange={(e) => handleSelectAllSteps(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {t('processes.steps.stepId')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {t('processes.steps.stepName')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {t('processes.steps.description')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {t('processes.steps.workstation')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {t('processes.steps.stepType')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {stepTemplates
                      .filter(template => {
                        const matchesSearch = template.name.toLowerCase().includes(stepSearchTerm.toLowerCase()) ||
                                            template.stepCode.toLowerCase().includes(stepSearchTerm.toLowerCase());
                        const matchesCategory = !stepCategoryFilter || template.category === stepCategoryFilter;
                        return matchesSearch && matchesCategory;
                      })
                      .map((template) => (
                        <tr
                          key={template.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                          onClick={() => {
                            const isSelected = selectedStepIds.includes(template.id);
                            handleStepSelection(template.id, !isSelected);
                          }}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedStepIds.includes(template.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleStepSelection(template.id, e.target.checked);
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {template.stepCode}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {template.name}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {template.description || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {template.workstation?.name || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {template.category || t('processes.steps.universal')}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                
                {stepTemplates.filter(template => {
                  const matchesSearch = template.name.toLowerCase().includes(stepSearchTerm.toLowerCase()) ||
                                      template.stepCode.toLowerCase().includes(stepSearchTerm.toLowerCase());
                  const matchesCategory = !stepCategoryFilter || template.category === stepCategoryFilter;
                  return matchesSearch && matchesCategory;
                }).length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    {t('processes.steps.noMatchingSteps')}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowStepSelectModal(false);
                  setSelectedStepIds([]);
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-200 dark:bg-gray-600 rounded-md"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={createStepsFromTemplates}
                disabled={selectedStepIds.length === 0 || isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t('common.loading')}
                  </div>
                ) : (
                  t('common.save')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}