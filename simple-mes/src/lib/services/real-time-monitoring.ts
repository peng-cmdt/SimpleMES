import { prisma } from '@/lib/prisma';

export interface WorkstationStatus {
  workstationId: string;
  name: string;
  type: 'VISUAL_CLIENT' | 'SERVICE_TYPE';
  status: 'online' | 'offline' | 'error' | 'maintenance';
  currentOrder?: {
    id: string;
    orderNumber: string;
    productName: string;
    quantity: number;
    completedQuantity: number;
    progress: number;
  };
  currentStep?: {
    id: string;
    name: string;
    sequence: number;
    status: string;
    startedAt?: Date;
  };
  deviceStatuses: Array<{
    deviceId: string;
    name: string;
    status: 'online' | 'offline' | 'error';
    lastHeartbeat?: Date;
  }>;
  sessionInfo?: {
    sessionId: string;
    userId?: string;
    username?: string;
    loginTime: Date;
    lastActivity: Date;
  };
  alerts: Array<{
    id: string;
    type: 'error' | 'warning' | 'info';
    message: string;
    createdAt: Date;
  }>;
}

export interface OrderProgress {
  orderId: string;
  orderNumber: string;
  productName: string;
  quantity: number;
  completedQuantity: number;
  status: string;
  currentStationId?: string;
  currentStationName?: string;
  currentStepId?: string;
  currentStepName?: string;
  progress: {
    totalSteps: number;
    completedSteps: number;
    percentage: number;
  };
  timeline: Array<{
    stepName: string;
    workstationName: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    startedAt?: Date;
    completedAt?: Date;
    duration?: number;
  }>;
  recentActions: Array<{
    actionName: string;
    status: string;
    executedAt: Date;
    executedBy?: string;
    errorMessage?: string;
  }>;
}

export interface SystemOverview {
  totalOrders: number;
  activeOrders: number;
  completedOrdersToday: number;
  errorOrders: number;
  onlineWorkstations: number;
  totalWorkstations: number;
  activeDevices: number;
  totalDevices: number;
  productionRate: {
    today: number;
    yesterday: number;
    trend: 'up' | 'down' | 'stable';
  };
  recentAlerts: Array<{
    id: string;
    type: 'error' | 'warning' | 'info';
    message: string;
    workstationName?: string;
    createdAt: Date;
  }>;
}

export class RealTimeMonitoringService {

  /**
   * 获取系统总览
   */
  async getSystemOverview(): Promise<SystemOverview> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalOrders,
      activeOrders,
      completedOrdersToday,
      errorOrders,
      workstations,
      devices,
      completedOrdersYesterday
    ] = await Promise.all([
      // 总订单数
      prisma.order.count(),
      
      // 活跃订单数
      prisma.order.count({
        where: { status: { in: ['PENDING', 'IN_PROGRESS'] } }
      }),
      
      // 今日完成订单数
      prisma.order.count({
        where: {
          status: 'COMPLETED',
          completedAt: {
            gte: today,
            lt: tomorrow
          }
        }
      }),
      
      // 错误订单数
      prisma.order.count({
        where: { status: 'ERROR' }
      }),
      
      // 工位信息
      prisma.workstation.findMany({
        select: {
          id: true,
          status: true
        }
      }),
      
      // 设备信息
      prisma.device.findMany({
        select: {
          id: true,
          status: true,
          isOnline: true
        }
      }),
      
      // 昨日完成订单数
      prisma.order.count({
        where: {
          status: 'COMPLETED',
          completedAt: {
            gte: yesterday,
            lt: today
          }
        }
      })
    ]);

    const onlineWorkstations = workstations.filter(w => w.status === 'online').length;
    const activeDevices = devices.filter(d => d.isOnline).length;

    // 计算生产趋势
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (completedOrdersToday > completedOrdersYesterday) {
      trend = 'up';
    } else if (completedOrdersToday < completedOrdersYesterday) {
      trend = 'down';
    }

    // 获取最近告警（这里简化为从订单错误中获取）
    const recentErrorOrders = await prisma.order.findMany({
      where: {
        status: 'ERROR',
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 最近24小时
        }
      },
      include: {
        currentStation: true
      },
      orderBy: { updatedAt: 'desc' },
      take: 10
    });

    const recentAlerts = recentErrorOrders.map(order => ({
      id: order.id,
      type: 'error' as const,
      message: `订单 ${order.orderNumber} 执行出错`,
      workstationName: order.currentStation?.name,
      createdAt: order.updatedAt
    }));

    return {
      totalOrders,
      activeOrders,
      completedOrdersToday,
      errorOrders,
      onlineWorkstations,
      totalWorkstations: workstations.length,
      activeDevices,
      totalDevices: devices.length,
      productionRate: {
        today: completedOrdersToday,
        yesterday: completedOrdersYesterday,
        trend
      },
      recentAlerts
    };
  }

  /**
   * 获取所有工位状态
   */
  async getWorkstationStatuses(): Promise<WorkstationStatus[]> {
    const workstations = await prisma.workstation.findMany({
      include: {
        devices: {
          select: {
            deviceId: true,
            name: true,
            status: true,
            isOnline: true,
            lastHeartbeat: true
          }
        },
        sessions: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                username: true
              }
            }
          },
          take: 1
        },
        currentOrders: {
          include: {
            product: true,
            currentStep: true
          },
          take: 1
        }
      }
    });

    const statuses: WorkstationStatus[] = [];

    for (const workstation of workstations) {
      const currentOrder = workstation.currentOrders[0];
      const session = workstation.sessions[0];

      // 获取设备状态
      const deviceStatuses = workstation.devices.map(device => ({
        deviceId: device.deviceId,
        name: device.name,
        status: device.isOnline ? 'online' : 'offline' as 'online' | 'offline' | 'error',
        lastHeartbeat: device.lastHeartbeat
      }));

      // 获取当前步骤信息
      let currentStep;
      if (currentOrder?.currentStep) {
        const orderStep = await prisma.orderStep.findFirst({
          where: {
            orderId: currentOrder.id,
            stepId: currentOrder.currentStep.id
          }
        });

        currentStep = {
          id: currentOrder.currentStep.id,
          name: currentOrder.currentStep.name,
          sequence: currentOrder.currentStep.sequence,
          status: orderStep?.status || 'pending',
          startedAt: orderStep?.startedAt
        };
      }

      // 计算订单进度
      let orderInfo;
      if (currentOrder) {
        const totalSteps = await prisma.orderStep.count({
          where: { orderId: currentOrder.id }
        });
        const completedSteps = await prisma.orderStep.count({
          where: {
            orderId: currentOrder.id,
            status: 'completed'
          }
        });

        const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

        orderInfo = {
          id: currentOrder.id,
          orderNumber: currentOrder.orderNumber,
          productName: currentOrder.product.name,
          quantity: currentOrder.quantity,
          completedQuantity: currentOrder.completedQuantity,
          progress
        };
      }

      // 简化的告警信息（实际应用中可能从专门的告警表获取）
      const alerts: WorkstationStatus['alerts'] = [];
      if (workstation.status === 'offline') {
        alerts.push({
          id: `offline-${workstation.id}`,
          type: 'warning',
          message: '工位离线',
          createdAt: workstation.updatedAt
        });
      }

      statuses.push({
        workstationId: workstation.workstationId,
        name: workstation.name,
        type: workstation.type,
        status: workstation.status as any,
        currentOrder: orderInfo,
        currentStep,
        deviceStatuses,
        sessionInfo: session ? {
          sessionId: session.sessionId,
          userId: session.user?.id,
          username: session.user?.username || session.username,
          loginTime: session.loginTime,
          lastActivity: session.lastActivity
        } : undefined,
        alerts
      });
    }

    return statuses;
  }

  /**
   * 获取订单进度详情
   */
  async getOrderProgress(orderId: string): Promise<OrderProgress> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        product: true,
        currentStation: true,
        currentStep: true,
        orderSteps: {
          include: {
            step: true,
            workstation: true,
            actionLogs: {
              include: {
                action: true
              },
              orderBy: { executedAt: 'desc' },
              take: 5
            }
          },
          orderBy: { step: { sequence: 'asc' } }
        }
      }
    });

    if (!order) {
      throw new Error('订单不存在');
    }

    // 计算进度
    const totalSteps = order.orderSteps.length;
    const completedSteps = order.orderSteps.filter(s => s.status === 'completed').length;
    const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    // 构建时间线
    const timeline = order.orderSteps.map(orderStep => ({
      stepName: orderStep.step.name,
      workstationName: orderStep.workstation?.name || '未分配',
      status: orderStep.status as 'pending' | 'in_progress' | 'completed' | 'failed',
      startedAt: orderStep.startedAt,
      completedAt: orderStep.completedAt,
      duration: orderStep.actualTime
    }));

    // 获取最近的动作执行记录
    const recentActions: OrderProgress['recentActions'] = [];
    order.orderSteps.forEach(orderStep => {
      orderStep.actionLogs.forEach(log => {
        recentActions.push({
          actionName: log.action.name,
          status: log.status,
          executedAt: log.executedAt,
          executedBy: log.executedBy,
          errorMessage: log.errorMessage
        });
      });
    });

    // 按时间排序并取最近的10条
    recentActions.sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime());
    recentActions.splice(10);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      productName: order.product.name,
      quantity: order.quantity,
      completedQuantity: order.completedQuantity,
      status: order.status,
      currentStationId: order.currentStationId,
      currentStationName: order.currentStation?.name,
      currentStepId: order.currentStepId,
      currentStepName: order.currentStep?.name,
      progress: {
        totalSteps,
        completedSteps,
        percentage
      },
      timeline,
      recentActions
    };
  }

  /**
   * 获取活跃订单列表
   */
  async getActiveOrders(limit = 20): Promise<Array<{
    id: string;
    orderNumber: string;
    productName: string;
    status: string;
    currentStationName?: string;
    progress: number;
    startedAt?: Date;
    priority: number;
  }>> {
    const orders = await prisma.order.findMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] }
      },
      include: {
        product: true,
        currentStation: true,
        orderSteps: {
          select: {
            status: true
          }
        }
      },
      orderBy: [
        { priority: 'asc' },
        { sequence: 'asc' }
      ],
      take: limit
    });

    return orders.map(order => {
      const totalSteps = order.orderSteps.length;
      const completedSteps = order.orderSteps.filter(s => s.status === 'completed').length;
      const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        productName: order.product.name,
        status: order.status,
        currentStationName: order.currentStation?.name,
        progress,
        startedAt: order.startedAt,
        priority: order.priority
      };
    });
  }

  /**
   * 获取实时生产统计
   */
  async getProductionStatistics(timeRange: 'today' | 'week' | 'month' = 'today') {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case 'today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        break;
    }

    const [
      ordersCreated,
      ordersCompleted,
      totalQuantityCompleted,
      averageCompletionTime
    ] = await Promise.all([
      // 创建的订单数
      prisma.order.count({
        where: {
          createdAt: { gte: startDate }
        }
      }),

      // 完成的订单数
      prisma.order.count({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: startDate }
        }
      }),

      // 完成的总数量
      prisma.order.aggregate({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: startDate }
        },
        _sum: { completedQuantity: true }
      }),

      // 平均完成时间（小时）
      prisma.order.findMany({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: startDate },
          startedAt: { not: null }
        },
        select: {
          startedAt: true,
          completedAt: true
        }
      })
    ]);

    // 计算平均完成时间
    let avgCompletionHours = 0;
    if (averageCompletionTime.length > 0) {
      const totalHours = averageCompletionTime.reduce((sum, order) => {
        if (order.startedAt && order.completedAt) {
          return sum + (order.completedAt.getTime() - order.startedAt.getTime()) / (1000 * 60 * 60);
        }
        return sum;
      }, 0);
      avgCompletionHours = totalHours / averageCompletionTime.length;
    }

    return {
      timeRange,
      ordersCreated,
      ordersCompleted,
      totalQuantityCompleted: totalQuantityCompleted._sum.completedQuantity || 0,
      averageCompletionTime: Math.round(avgCompletionHours * 100) / 100, // 保留2位小数
      completionRate: ordersCreated > 0 ? Math.round((ordersCompleted / ordersCreated) * 100) : 0
    };
  }
}

// 导出单例实例
export const realTimeMonitoringService = new RealTimeMonitoringService();