import { prisma } from '@/lib/prisma';
import { orderManagementService } from './order-management';

export interface StepExecutionContext {
  orderId: string;
  stepId: string;
  workstationId: string;
  executedBy?: string;
  sessionId?: string;
}

export interface ActionExecutionResult {
  actionId: string;
  success: boolean;
  executedAt: Date;
  executionTime: number;
  requestValue?: string;
  responseValue?: string;
  actualValue?: string;
  validationResult?: boolean;
  errorCode?: string;
  errorMessage?: string;
  result?: Record<string, unknown>;
}

export interface StepExecutionResult {
  stepId: string;
  success: boolean;
  startedAt: Date;
  completedAt?: Date;
  actionResults: ActionExecutionResult[];
  errorMessage?: string;
  completedActions: number;
  totalActions: number;
}

export interface WorkflowExecutionState {
  orderId: string;
  currentStepId?: string;
  currentStationId?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'paused';
  completedSteps: string[];
  failedSteps: string[];
  totalSteps: number;
  completedActions: number;
  totalActions: number;
}

export class WorkflowExecutionEngine {

  /**
   * 获取工位可执行的订单和步骤
   */
  async getWorkstationTasks(workstationId: string, limit = 10) {
    // 获取当前工位可执行的订单步骤
    const availableOrderSteps = await prisma.orderStep.findMany({
      where: {
        workstationId,
        status: { in: ['pending', 'in_progress'] },
        order: {
          status: { in: ['PENDING', 'IN_PROGRESS'] }
        }
      },
      include: {
        order: {
          include: {
            product: true,
            bom: true,
            process: true
          }
        },
        step: {
          include: {
            actions: {
              include: {
                device: true
              },
              orderBy: { sequence: 'asc' }
            }
          }
        },
        workstation: true,
        actionLogs: {
          orderBy: { executedAt: 'desc' },
          take: 1
        }
      },
      orderBy: [
        { order: { priority: 'asc' } },
        { order: { sequence: 'asc' } },
        { step: { sequence: 'asc' } }
      ],
      take: limit
    });

    // 按订单分组并计算进度
    const orderGroups = new Map();
    
    for (const orderStep of availableOrderSteps) {
      const orderId = orderStep.orderId;
      
      if (!orderGroups.has(orderId)) {
        // 计算整个订单的步骤进度
        const allOrderSteps = await prisma.orderStep.findMany({
          where: { orderId },
          include: { step: true },
          orderBy: { step: { sequence: 'asc' } }
        });

        const completedSteps = allOrderSteps.filter(s => s.status === 'completed').length;
        const totalSteps = allOrderSteps.length;
        
        orderGroups.set(orderId, {
          order: orderStep.order,
          currentStep: orderStep,
          allSteps: allOrderSteps,
          progress: {
            completedSteps,
            totalSteps,
            percentage: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
          },
          nextSteps: []
        });
      }
      
      orderGroups.get(orderId).nextSteps.push(orderStep);
    }

    return Array.from(orderGroups.values());
  }

  /**
   * 开始执行订单步骤
   */
  async startStepExecution(context: StepExecutionContext): Promise<StepExecutionResult> {
    const { orderId, stepId, workstationId, executedBy, sessionId } = context;

    return await prisma.$transaction(async (tx) => {
      // 验证订单和步骤
      const orderStep = await tx.orderStep.findFirst({
        where: {
          orderId,
          stepId,
          workstationId
        },
        include: {
          order: true,
          step: {
            include: {
              actions: {
                include: {
                  device: true
                },
                orderBy: { sequence: 'asc' }
              }
            }
          }
        }
      });

      if (!orderStep) {
        throw new Error('订单步骤不存在或不属于当前工位');
      }

      if (orderStep.status === 'completed') {
        throw new Error('步骤已完成，无法重复执行');
      }

      if (orderStep.order.status === 'COMPLETED' || orderStep.order.status === 'CANCELLED') {
        throw new Error('订单已完成或已取消，无法执行步骤');
      }

      // 检查前置步骤是否完成（按序执行）
      const previousSteps = await tx.orderStep.findMany({
        where: {
          orderId,
          step: {
            sequence: { lt: orderStep.step.sequence }
          }
        },
        include: { step: true }
      });

      const incompletePreviousSteps = previousSteps.filter(s => s.status !== 'completed');
      if (incompletePreviousSteps.length > 0) {
        throw new Error('前置步骤尚未完成，无法开始当前步骤');
      }

      // 更新订单步骤状态
      await tx.orderStep.update({
        where: { id: orderStep.id },
        data: {
          status: 'in_progress',
          startedAt: new Date(),
          executedBy
        }
      });

      // 更新订单的当前执行位置
      await tx.order.update({
        where: { id: orderId },
        data: {
          currentStationId: workstationId,
          currentStepId: stepId,
          status: 'IN_PROGRESS',
          startedAt: orderStep.order.startedAt || new Date()
        }
      });

      // 记录订单状态变更（如果是第一次开始）
      if (orderStep.order.status === 'PENDING') {
        await orderManagementService.changeOrderStatus({
          orderId,
          newStatus: 'IN_PROGRESS',
          changedBy: executedBy || 'system',
          reason: '开始执行工艺步骤',
          workstationId,
          stepId
        });
      }

      return {
        stepId,
        success: true,
        startedAt: new Date(),
        actionResults: [],
        completedActions: 0,
        totalActions: orderStep.step.actions.length
      };
    });
  }

  /**
   * 执行单个动作
   */
  async executeAction(
    context: StepExecutionContext,
    actionId: string,
    parameters?: Record<string, unknown>
  ): Promise<ActionExecutionResult> {
    const startTime = Date.now();
    const executedAt = new Date();

    try {
      // 获取动作详情
      const action = await prisma.action.findUnique({
        where: { id: actionId },
        include: {
          device: true,
          step: true
        }
      });

      if (!action) {
        throw new Error('动作不存在');
      }

      // 验证动作是否属于当前步骤
      if (action.stepId !== context.stepId) {
        throw new Error('动作不属于当前步骤');
      }

      // 获取订单步骤
      const orderStep = await prisma.orderStep.findFirst({
        where: {
          orderId: context.orderId,
          stepId: context.stepId
        }
      });

      if (!orderStep || orderStep.status !== 'in_progress') {
        throw new Error('步骤未在执行中');
      }

      let result: ActionExecutionResult;

      // 根据动作类型执行相应操作
      switch (action.type) {
        case 'DEVICE_READ':
          result = await this.executeDeviceRead(action, parameters);
          break;
        case 'DEVICE_WRITE':
          result = await this.executeDeviceWrite(action, parameters);
          break;
        case 'MANUAL_CONFIRM':
          result = await this.executeManualConfirm(action, parameters);
          break;
        case 'DATA_VALIDATION':
          result = await this.executeDataValidation(action, parameters);
          break;
        case 'BARCODE_SCAN':
          result = await this.executeBarcodeScann(action, parameters);
          break;
        case 'CAMERA_CHECK':
          result = await this.executeCameraCheck(action, parameters);
          break;
        case 'DELAY_WAIT':
          result = await this.executeDelayWait(action, parameters);
          break;
        default:
          throw new Error(`不支持的动作类型: ${action.type}`);
      }

      // 记录动作执行日志
      await prisma.actionLog.create({
        data: {
          orderStepId: orderStep.id,
          actionId,
          status: result.success ? 'success' : 'failed',
          executedAt,
          executedBy: context.executedBy,
          deviceId: action.deviceId,
          requestValue: result.requestValue,
          responseValue: result.responseValue,
          actualValue: result.actualValue,
          validationResult: result.validationResult,
          executionTime: Date.now() - startTime,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
          parameters: parameters ? JSON.stringify(parameters) : null,
          result: result.result ? JSON.stringify(result.result) : null
        }
      });

      return {
        ...result,
        actionId,
        executedAt,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      // 记录失败的动作执行日志
      const orderStep = await prisma.orderStep.findFirst({
        where: {
          orderId: context.orderId,
          stepId: context.stepId
        }
      });

      if (orderStep) {
        await prisma.actionLog.create({
          data: {
            orderStepId: orderStep.id,
            actionId,
            status: 'failed',
            executedAt,
            executedBy: context.executedBy,
            executionTime: Date.now() - startTime,
            errorMessage,
            parameters: parameters ? JSON.stringify(parameters) : null
          }
        });
      }

      return {
        actionId,
        success: false,
        executedAt,
        executionTime: Date.now() - startTime,
        errorMessage
      };
    }
  }

  /**
   * 完成步骤执行
   */
  async completeStepExecution(
    context: StepExecutionContext,
    success: boolean,
    notes?: string
  ): Promise<StepExecutionResult> {
    const { orderId, stepId, workstationId, executedBy } = context;

    return await prisma.$transaction(async (tx) => {
      // 获取订单步骤和相关信息
      const orderStep = await tx.orderStep.findFirst({
        where: {
          orderId,
          stepId,
          workstationId
        },
        include: {
          step: {
            include: {
              actions: true
            }
          },
          actionLogs: true
        }
      });

      if (!orderStep) {
        throw new Error('订单步骤不存在');
      }

      // 更新步骤状态
      const newStatus = success ? 'completed' : 'failed';
      const completedAt = new Date();

      await tx.orderStep.update({
        where: { id: orderStep.id },
        data: {
          status: newStatus,
          completedAt,
          actualTime: completedAt.getTime() - (orderStep.startedAt?.getTime() || 0),
          errorMessage: success ? null : '步骤执行失败',
          notes
        }
      });

      // 检查是否是订单的最后一个步骤
      const allOrderSteps = await tx.orderStep.findMany({
        where: { orderId },
        include: { step: true },
        orderBy: { step: { sequence: 'asc' } }
      });

      const completedSteps = allOrderSteps.filter(s => s.status === 'completed');
      const isLastStep = completedSteps.length === allOrderSteps.length;

      if (success && isLastStep) {
        // 所有步骤完成，订单完成
        await orderManagementService.changeOrderStatus({
          orderId,
          newStatus: 'COMPLETED',
          changedBy: executedBy || 'system',
          reason: '所有工艺步骤已完成'
        });
      } else if (!success) {
        // 步骤失败，订单进入错误状态
        await orderManagementService.changeOrderStatus({
          orderId,
          newStatus: 'ERROR',
          changedBy: executedBy || 'system',
          reason: `步骤 ${orderStep.step.name} 执行失败`
        });
      } else {
        // 找下一个步骤
        const nextStep = allOrderSteps.find(s => 
          s.step.sequence > orderStep.step.sequence && s.status === 'pending'
        );
        
        if (nextStep) {
          await tx.order.update({
            where: { id: orderId },
            data: {
              currentStepId: nextStep.stepId,
              currentStationId: nextStep.workstationId
            }
          });
        }
      }

      // 统计动作执行结果
      const successfulActions = orderStep.actionLogs.filter(log => log.status === 'success').length;
      const totalActions = orderStep.step.actions.length;

      return {
        stepId,
        success,
        startedAt: orderStep.startedAt || new Date(),
        completedAt,
        actionResults: [],
        completedActions: successfulActions,
        totalActions,
        errorMessage: success ? undefined : '步骤执行失败'
      };
    });
  }

  /**
   * 获取订单的工作流执行状态
   */
  async getWorkflowExecutionState(orderId: string): Promise<WorkflowExecutionState> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderSteps: {
          include: {
            step: {
              include: {
                actions: true
              }
            },
            actionLogs: true
          },
          orderBy: { step: { sequence: 'asc' } }
        }
      }
    });

    if (!order) {
      throw new Error('订单不存在');
    }

    const completedSteps = order.orderSteps.filter(s => s.status === 'completed').map(s => s.stepId);
    const failedSteps = order.orderSteps.filter(s => s.status === 'failed').map(s => s.stepId);
    const totalSteps = order.orderSteps.length;

    // 统计已完成的动作数量
    let completedActions = 0;
    let totalActions = 0;

    for (const orderStep of order.orderSteps) {
      totalActions += orderStep.step.actions.length;
      completedActions += orderStep.actionLogs.filter(log => log.status === 'success').length;
    }

    // 确定当前状态
    let status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'paused';
    
    if (order.status === 'COMPLETED') {
      status = 'completed';
    } else if (order.status === 'ERROR') {
      status = 'failed';
    } else if (order.status === 'PAUSED') {
      status = 'paused';
    } else if (order.status === 'IN_PROGRESS') {
      status = 'in_progress';
    } else {
      status = 'pending';
    }

    return {
      orderId,
      currentStepId: order.currentStepId || undefined,
      currentStationId: order.currentStationId || undefined,
      status,
      completedSteps,
      failedSteps,
      totalSteps,
      completedActions,
      totalActions
    };
  }

  // ==================== 私有方法：动作执行实现 ====================

  private async executeDeviceRead(action: Record<string, unknown>, parameters?: Record<string, unknown>): Promise<Omit<ActionExecutionResult, 'actionId' | 'executedAt' | 'executionTime'>> {
    // 这里应该调用设备通信服务
    // 暂时返回模拟结果
    return {
      success: true,
      requestValue: action.deviceAddress as string,
      responseValue: 'success',
      actualValue: (parameters?.expectedValue as string) || 'test_value',
      validationResult: true
    };
  }

  private async executeDeviceWrite(action: Record<string, unknown>, parameters?: Record<string, unknown>): Promise<Omit<ActionExecutionResult, 'actionId' | 'executedAt' | 'executionTime'>> {
    // 这里应该调用设备通信服务
    return {
      success: true,
      requestValue: (parameters?.value as string) || (action.expectedValue as string),
      responseValue: 'success',
      actualValue: (parameters?.value as string) || (action.expectedValue as string)
    };
  }

  private async executeManualConfirm(action: Record<string, unknown>, parameters?: Record<string, unknown>): Promise<Omit<ActionExecutionResult, 'actionId' | 'executedAt' | 'executionTime'>> {
    // 人工确认动作，依赖前端用户操作
    return {
      success: parameters?.confirmed === true,
      requestValue: 'manual_confirm',
      responseValue: parameters?.confirmed ? 'confirmed' : 'rejected',
      actualValue: (parameters?.userInput as string) || ''
    };
  }

  private async executeDataValidation(action: Record<string, unknown>, parameters?: Record<string, unknown>): Promise<Omit<ActionExecutionResult, 'actionId' | 'executedAt' | 'executionTime'>> {
    // 数据校验动作
    const expectedValue = action.expectedValue as string;
    const actualValue = parameters?.value as string;
    const validationRule = action.validationRule ? JSON.parse(action.validationRule as string) : {};

    let validationResult = false;
    let errorMessage = '';

    if (validationRule.type === 'range') {
      const numValue = parseFloat(actualValue);
      const min = validationRule.min;
      const max = validationRule.max;
      validationResult = numValue >= min && numValue <= max;
      if (!validationResult) {
        errorMessage = `值 ${actualValue} 不在范围 [${min}, ${max}] 内`;
      }
    } else if (validationRule.type === 'equals') {
      validationResult = actualValue === expectedValue;
      if (!validationResult) {
        errorMessage = `期望值 ${expectedValue}，实际值 ${actualValue}`;
      }
    } else {
      validationResult = true; // 默认通过
    }

    return {
      success: validationResult,
      requestValue: expectedValue,
      responseValue: actualValue,
      actualValue,
      validationResult,
      errorMessage: validationResult ? undefined : errorMessage
    };
  }

  private async executeBarcodeScann(action: Record<string, unknown>, parameters?: Record<string, unknown>): Promise<Omit<ActionExecutionResult, 'actionId' | 'executedAt' | 'executionTime'>> {
    // 扫码动作
    const scannedValue = parameters?.scannedValue as string;
    const expectedPattern = action.expectedValue as string;

    let success = true;
    let errorMessage = '';

    if (expectedPattern && scannedValue) {
      const regex = new RegExp(expectedPattern);
      success = regex.test(scannedValue);
      if (!success) {
        errorMessage = `扫码值 ${scannedValue} 不匹配模式 ${expectedPattern}`;
      }
    } else if (!scannedValue) {
      success = false;
      errorMessage = '未获取到扫码值';
    }

    return {
      success,
      requestValue: 'barcode_scan',
      responseValue: scannedValue || '',
      actualValue: scannedValue || '',
      validationResult: success,
      errorMessage: success ? undefined : errorMessage
    };
  }

  private async executeCameraCheck(action: Record<string, unknown>, parameters?: Record<string, unknown>): Promise<Omit<ActionExecutionResult, 'actionId' | 'executedAt' | 'executionTime'>> {
    // 相机检测动作
    const checkResult = parameters?.checkResult as string;
    const confidence = (parameters?.confidence as number) || 0;

    return {
      success: checkResult === 'pass',
      requestValue: 'camera_check',
      responseValue: checkResult || 'unknown',
      actualValue: `confidence: ${confidence}`,
      validationResult: checkResult === 'pass',
      result: {
        checkResult,
        confidence
      }
    };
  }

  private async executeDelayWait(action: Record<string, unknown>, parameters?: Record<string, unknown>): Promise<Omit<ActionExecutionResult, 'actionId' | 'executedAt' | 'executionTime'>> {
    // 延时等待动作
    const delayTime = (parameters?.delayTime as number) || (action.timeout as number) || 1000;
    
    // 实际项目中这里应该是真实的延时
    await new Promise(resolve => setTimeout(resolve, delayTime));

    return {
      success: true,
      requestValue: `delay_${delayTime}ms`,
      responseValue: 'completed',
      actualValue: `waited_${delayTime}ms`
    };
  }
}

// 导出单例实例
export const workflowExecutionEngine = new WorkflowExecutionEngine();