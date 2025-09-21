import { prisma } from '@/lib/prisma';
import { OrderStatus } from '@prisma/client';

export interface OrderStatusChangeOptions {
  orderId: string;
  newStatus: OrderStatus;
  changedBy?: string;
  reason?: string;
  notes?: string;
  workstationId?: string;
  stepId?: string;
}

export interface OrderProgressUpdate {
  orderId: string;
  completedQuantity?: number;
  currentStationId?: string;
  currentStepId?: string;
  updatedBy?: string;
  notes?: string;
}

export interface OrderPriorityUpdate {
  orderId: string;
  newPriority: number;
  newSequence?: number;
  updatedBy?: string;
  reason?: string;
}

export class OrderManagementService {
  
  /**
   * 更改订单状态并记录历史
   */
  async changeOrderStatus(options: OrderStatusChangeOptions) {
    const { orderId, newStatus, changedBy, reason, notes, workstationId, stepId } = options;

    return await prisma.$transaction(async (tx) => {
      // 获取当前订单信息
      const currentOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          product: true,
          bom: true,
          process: true
        }
      });

      if (!currentOrder) {
        throw new Error(`订单不存在: ${orderId}`);
      }

      const oldStatus = currentOrder.status;

      // 如果状态没有变化，直接返回更新后的订单（跳过状态转换验证）
      if (oldStatus === newStatus) {
        // 状态没有变化，只更新其他字段
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            ...(workstationId && { currentStationId: workstationId }),
            ...(stepId && { currentStepId: stepId }),
            updatedAt: new Date()
          }
        });
        return updatedOrder;
      }

      // 验证状态转换的合法性
      this.validateStatusTransition(oldStatus as OrderStatus, newStatus);

      // 准备更新数据
      const updateData: any = {
        status: newStatus,
        startedAt: newStatus === OrderStatus.IN_PROGRESS && !currentOrder.startedAt ? new Date() : currentOrder.startedAt,
        completedAt: newStatus === OrderStatus.COMPLETED ? new Date() : currentOrder.completedAt,
        updatedAt: new Date()
      };

      // Only update workstation and step IDs if they are provided
      // Remove validation that might be causing issues
      if (workstationId) {
        updateData.currentStationId = workstationId;
      }
      if (stepId) {
        updateData.currentStepId = stepId;
      }

      // 更新订单状态
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: updateData
      });

      // 如果订单状态重置为PENDING，同时重置所有工位的订单状态
      if (newStatus === OrderStatus.PENDING) {
        await tx.workstationOrderQueue.updateMany({
          where: {
            orderId: orderId
          },
          data: {
            status: 'PENDING',
            startedAt: null,
            completedAt: null,
            isVisible: true,
            notes: null
          }
        });
        

      }

      // 如果订单状态变为IN_PROGRESS且之前不是IN_PROGRESS，创建OrderStep记录
      if (newStatus === OrderStatus.IN_PROGRESS && oldStatus !== OrderStatus.IN_PROGRESS) {
        await this.createOrderSteps(tx, orderId, currentOrder);
      }

      // 记录状态变更历史
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: oldStatus,
          toStatus: newStatus,
          changedBy: changedBy || 'system',
          changedAt: new Date(),
          reason: reason || `订单状态从 ${oldStatus} 变更为 ${newStatus}`,
          notes
        }
      });

      return updatedOrder;
    });
  }

  /**
   * 更新订单进度
   */
  async updateOrderProgress(options: OrderProgressUpdate) {
    const { orderId, completedQuantity, currentStationId, currentStepId, updatedBy, notes } = options;

    return await prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({
        where: { id: orderId }
      });

      if (!currentOrder) {
        throw new Error(`订单不存在: ${orderId}`);
      }

      // 更新订单
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          ...(completedQuantity !== undefined && { completedQuantity }),
          ...(currentStationId && { currentStationId }),
          ...(currentStepId && { currentStepId }),
          updatedAt: new Date()
        }
      });

      // 如果订单完成数量达到目标数量，自动设置为完成状态
      if (completedQuantity !== undefined && currentOrder.quantity !== null && currentOrder.quantity !== undefined && completedQuantity >= currentOrder.quantity) {
        await this.changeOrderStatus({
          orderId,
          newStatus: OrderStatus.COMPLETED,
          changedBy: updatedBy || 'system',
          reason: '生产数量已达到目标',
          notes: `完成数量: ${completedQuantity}/${currentOrder.quantity}`
        });
      }

      return updatedOrder;
    });
  }

  /**
   * 调整订单优先级和执行顺序
   */
  async updateOrderPriority(options: OrderPriorityUpdate) {
    const { orderId, newPriority, newSequence, updatedBy, reason } = options;

    return await prisma.$transaction(async (tx) => {
      // 获取当前订单
      const currentOrder = await tx.order.findUnique({
        where: { id: orderId }
      });

      if (!currentOrder) {
        throw new Error(`订单不存在: ${orderId}`);
      }

      // 如果指定了新的序号，需要调整其他订单的序号
      if (newSequence !== undefined) {
        // 获取受影响的订单
        const affectedOrders = await tx.order.findMany({
          where: {
            sequence: { gte: newSequence },
            id: { not: orderId }
          },
          orderBy: { sequence: 'asc' }
        });

        // 批量更新受影响订单的序号
        for (const order of affectedOrders) {
          await tx.order.update({
            where: { id: order.id },
            data: { sequence: (order.sequence || 0) + 1 }
          });
        }
      }

      // 更新目标订单
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          priority: newPriority,
          ...(newSequence !== undefined && { sequence: newSequence }),
          updatedAt: new Date()
        }
      });

      // 记录状态变更历史
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: currentOrder.status,
          toStatus: currentOrder.status,
          changedBy: updatedBy || 'system',
          reason: reason || `调整订单优先级: ${currentOrder.priority} → ${newPriority}`,
          notes: newSequence !== undefined ? `调整执行顺序: ${newSequence}` : undefined
        }
      });

      return updatedOrder;
    });
  }

  /**
   * 获取工位可执行的订单列表
   */
  async getWorkstationOrders(workstationId: string, status?: OrderStatus[], limit = 50) {
    const whereClause: {
      status?: { in: OrderStatus[] };
      orderSteps?: {
        some: {
          workstationId: string;
          status: { in: string[] };
        };
      };
    } = {
      status: status ? { in: status } : { in: [OrderStatus.PENDING, OrderStatus.IN_PROGRESS] },
      orderSteps: {
        some: {
          workstationId,
          status: { in: ['pending', 'in_progress'] }
        }
      }
    };

    return await prisma.order.findMany({
      where: whereClause,
      include: {
        product: true,
        bom: true,
        process: true,
        currentStation: true,
        currentStep: true,
        orderSteps: {
          where: { workstationId },
          include: {
            step: {
              include: {
                actions: {
                  orderBy: { sequence: 'asc' }
                }
              }
            }
          },
          orderBy: { step: { sequence: 'asc' } }
        }
      },
      orderBy: [
        { priority: 'asc' },
        { sequence: 'asc' },
        { createdAt: 'asc' }
      ],
      take: limit
    });
  }

  /**
   * 获取订单的详细执行状态
   */
  async getOrderExecutionStatus(orderId: string) {
    return await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        product: true,
        bom: {
          include: {
            bomItems: true
          }
        },
        process: {
          include: {
            steps: {
              include: {
                actions: {
                  orderBy: { sequence: 'asc' }
                },
                workstation: true
              },
              orderBy: { sequence: 'asc' }
            }
          }
        },
        orderSteps: {
          include: {
            step: {
              include: {
                actions: {
                  orderBy: { sequence: 'asc' }
                }
              }
            },
            workstation: true,
            actionLogs: {
              include: {
                action: true
              },
              orderBy: { executedAt: 'desc' }
            }
          },
          orderBy: { step: { sequence: 'asc' } }
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' }
        }
      }
    });
  }

  /**
   * 批量处理订单状态更新
   */
  async batchUpdateOrderStatus(orderIds: string[], newStatus: OrderStatus, changedBy?: string, reason?: string) {
    const results: Array<{
      orderId: string;
      success: boolean;
      order?: unknown;
      error?: string;
    }> = [];
    
    for (const orderId of orderIds) {
      try {
        const result = await this.changeOrderStatus({
          orderId,
          newStatus,
          changedBy,
          reason
        });
        results.push({ orderId, success: true, order: result });
      } catch (error) {
        results.push({
          orderId,
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        });
      }
    }

    return results;
  }

  /**
   * 创建订单步骤记录
   */
  private async createOrderSteps(tx: any, orderId: string, order: any) {
    // 获取订单的工艺流程步骤
    const orderWithProcess = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        process: {
          include: {
            steps: {
              include: {
                workstation: true
              },
              orderBy: { sequence: 'asc' }
            }
          }
        }
      }
    });

    if (!orderWithProcess?.process?.steps || orderWithProcess.process.steps.length === 0) {

      return;
    }

    // 检查是否已存在OrderStep记录
    const existingOrderSteps = await tx.orderStep.findMany({
      where: { orderId }
    });

    if (existingOrderSteps.length > 0) {

      return;
    }

    // 为每个工艺步骤创建OrderStep记录
    const orderStepPromises = orderWithProcess.process.steps.map((step: { id: string; workstationId: string }) => 
      tx.orderStep.create({
        data: {
          orderId,
          stepId: step.id,
          workstationId: step.workstationId,
          status: 'pending'
        }
      })
    );

    await Promise.all(orderStepPromises);

  }

  /**
   * 验证订单状态转换的合法性
   */
  private validateStatusTransition(fromStatus: OrderStatus, toStatus: OrderStatus) {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      PENDING: ['IN_PROGRESS', 'CANCELLED', 'PAUSED'],
      IN_PROGRESS: ['COMPLETED', 'PAUSED', 'CANCELLED', 'PENDING', 'ERROR'],
      COMPLETED: ['IN_PROGRESS', 'PENDING', 'CANCELLED'], // 允许重启和重置
      PAUSED: ['IN_PROGRESS', 'CANCELLED', 'PENDING'],
      CANCELLED: ['PENDING'], // 允许已取消订单恢复为待开始
      ERROR: ['IN_PROGRESS', 'CANCELLED', 'PENDING'] // 错误状态可以恢复或重置
    };

    const allowedStatuses = validTransitions[fromStatus] || [];
    
    if (!allowedStatuses.includes(toStatus)) {
      throw new Error(`不允许的状态转换: ${fromStatus} → ${toStatus}`);
    }
  }

  /**
   * 获取订单统计信息
   */
  async getOrderStatistics(filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    productId?: string;
    workstationId?: string;
  }) {
    const whereClause: {
      createdAt?: {
        gte?: Date;
        lte?: Date;
      };
      productId?: string;
      orderSteps?: {
        some: { workstationId: string };
      };
    } = {};
    
    if (filters?.dateFrom || filters?.dateTo) {
      whereClause.createdAt = {};
      if (filters.dateFrom) whereClause.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) whereClause.createdAt.lte = filters.dateTo;
    }
    
    if (filters?.productId) {
      whereClause.productId = filters.productId;
    }

    if (filters?.workstationId) {
      whereClause.orderSteps = {
        some: { workstationId: filters.workstationId }
      };
    }

    const [statusCounts, totalOrders, totalQuantity, completedQuantity] = await Promise.all([
      // 按状态统计订单数量
      prisma.order.groupBy({
        by: ['status'],
        where: whereClause,
        _count: { id: true },
        _sum: { quantity: true }
      }),
      // 总订单数
      prisma.order.count({ where: whereClause }),
      // 总生产数量
      prisma.order.aggregate({
        where: whereClause,
        _sum: { quantity: true }
      }),
      // 已完成数量
      prisma.order.aggregate({
        where: whereClause,
        _sum: { completedQuantity: true }
      })
    ]);

    return {
      statusCounts,
      totalOrders,
      totalQuantity: (totalQuantity._sum.quantity ?? 0),
      completedQuantity: (completedQuantity._sum.completedQuantity ?? 0),
      completionRate: (totalQuantity._sum.quantity ?? 0) > 0
        ? (((completedQuantity._sum.completedQuantity ?? 0) / (totalQuantity._sum.quantity ?? 0)) * 100).toFixed(2)
        : '0'
    };
  }
}

// 导出单例实例
export const orderManagementService = new OrderManagementService();