import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/orders/monitoring - 获取订单监测数据（以订单为维度）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status'); // 订单状态筛选
    const workstationStatus = searchParams.get('workstationStatus'); // 工位状态筛选
    const productId = searchParams.get('productId');

    const skip = (page - 1) * limit;

    // 构建订单查询条件
    const orderWhere: any = {};
    
    if (search) {
      orderWhere.OR = [
        { orderNumber: { contains: search } },
        { productionNumber: { contains: search } }
      ];
    }
    
    if (status) {
      const statusList = status.split(',').map(s => s.trim().toUpperCase());
      orderWhere.status = { in: statusList };
    }
    
    if (productId) {
      orderWhere.productId = productId;
    }

    // 获取总数
    const total = await prisma.order.count({ where: orderWhere });

    // 获取订单列表及其工位分配状态
    const orders = await prisma.order.findMany({
      where: orderWhere,
      include: {
        product: {
          select: {
            id: true,
            productCode: true,
            name: true
          }
        },
        process: {
          select: {
            id: true,
            processCode: true,
            name: true,
            version: true
          }
        },
        currentStation: {
          select: {
            id: true,
            workstationId: true,
            name: true
          }
        },
        currentStep: {
          select: {
            id: true,
            stepCode: true,
            name: true,
            sequence: true
          }
        },
        workstationOrderQueues: {
          where: {
            // 移除isVisible过滤，显示所有工位状态
            ...(workstationStatus && {
              status: { in: workstationStatus.split(',').map(s => s.trim().toUpperCase()) }
            })
          },
          include: {
            workstation: {
              select: {
                id: true,
                workstationId: true,
                name: true,
                isOrderCompleteStation: true
              }
            }
          },
          orderBy: {
            assignedAt: 'asc'
          }
        },
        // 获取订单步骤执行状态
        orderSteps: {
          include: {
            step: {
              select: {
                id: true,
                stepCode: true,
                name: true,
                sequence: true,
                workstationId: true
              }
            },
            workstation: {
              select: {
                id: true,
                workstationId: true,
                name: true
              }
            }
          },
          orderBy: {
            step: {
              sequence: 'asc'
            }
          }
        }
      },
      orderBy: [
        { priority: 'asc' },
        { sequence: 'asc' },
        { createdAt: 'desc' }
      ],
      skip,
      take: limit
    });

    // 转换数据格式，以订单为中心展示工位状态
    const orderMonitoringData = orders.map(order => {
      // 统计工位状态
      const workstationStatusSummary = {
        pending: order.workstationOrderQueues.filter(q => q.status === 'PENDING').length,
        inProgress: order.workstationOrderQueues.filter(q => q.status === 'IN_PROGRESS').length,
        completed: order.workstationOrderQueues.filter(q => q.status === 'COMPLETED').length,
        cancelled: order.workstationOrderQueues.filter(q => q.status === 'CANCELLED').length,
        skipped: order.workstationOrderQueues.filter(q => q.status === 'SKIPPED').length,
        total: order.workstationOrderQueues.length
      };

      // 统计步骤状态
      const stepStatusSummary = {
        pending: order.orderSteps.filter(s => s.status === 'pending').length,
        inProgress: order.orderSteps.filter(s => s.status === 'in_progress').length,
        completed: order.orderSteps.filter(s => s.status === 'completed').length,
        error: order.orderSteps.filter(s => s.status === 'error').length,
        total: order.orderSteps.length
      };

      // 计算整体进度（基于工位数量）
      const progressPercentage = workstationStatusSummary.total > 0 
        ? Math.round((workstationStatusSummary.completed / workstationStatusSummary.total) * 100)
        : 0;

      // 找出当前活跃的工位（有进行中状态的工位）
      const activeWorkstations = order.workstationOrderQueues
        .filter(q => q.status === 'IN_PROGRESS')
        .map(q => ({
          workstationId: q.workstation.workstationId,
          name: q.workstation.name,
          startedAt: q.startedAt
        }));

      // 按工位组织数据
      const workstationStatuses = order.workstationOrderQueues.map(queue => ({
        workstation: queue.workstation,
        queueStatus: queue.status,
        assignedAt: queue.assignedAt,
        startedAt: queue.startedAt,
        completedAt: queue.completedAt,
        priority: queue.priority,
        sequence: queue.sequence,
        isVisible: queue.isVisible,
        notes: queue.notes,
        // 该工位相关的步骤状态
        relatedSteps: order.orderSteps
          .filter(step => step.workstationId === queue.workstation.id)
          .map(step => ({
            stepId: step.step.id,
            stepCode: step.step.stepCode,
            stepName: step.step.name,
            sequence: step.step.sequence,
            status: step.status,
            startedAt: step.startedAt,
            completedAt: step.completedAt,
            executedBy: step.executedBy,
            actualTime: step.actualTime,
            errorMessage: step.errorMessage,
            notes: step.notes
          }))
      }));

      // 重新计算订单状态：基于工位完成情况
      let calculatedStatus = order.status;
      if (order.status !== 'CANCELLED' && order.status !== 'ERROR') {
        if (workstationStatuses.length === 0) {
          // 没有工位分配
          calculatedStatus = 'PENDING';
        } else {
          // 检查是否所有工位都已完成
          const hasIncompleteWorkstations = workstationStatuses.some(ws => 
            ws.queueStatus !== 'COMPLETED' && ws.queueStatus !== 'SKIPPED'
          );
          
          if (!hasIncompleteWorkstations) {
            // 所有工位都已完成或跳过
            calculatedStatus = 'COMPLETED';
          } else if (workstationStatuses.some(ws => ws.queueStatus === 'IN_PROGRESS')) {
            // 有工位正在进行中
            calculatedStatus = 'IN_PROGRESS';
          } else if (workstationStatuses.some(ws => 
            ws.queueStatus === 'COMPLETED' || ws.queueStatus === 'SKIPPED' || ws.queueStatus === 'CANCELLED'
          )) {
            // 有工位已经开始过（已完成/跳过/取消），但还有工位等待中
            calculatedStatus = 'IN_PROGRESS';
          } else {
            // 所有工位都是等待状态
            calculatedStatus = 'PENDING';
          }
        }
      }

      // 找到当前正在进行的工位作为当前工位
      const currentActiveWorkstation = workstationStatuses.find(ws => ws.queueStatus === 'IN_PROGRESS');
      const actualCurrentStation = currentActiveWorkstation ? {
        id: currentActiveWorkstation.workstation.id,
        workstationId: currentActiveWorkstation.workstation.workstationId,
        name: currentActiveWorkstation.workstation.name
      } : order.currentStation;

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        productionNumber: order.productionNumber,
        quantity: order.quantity,
        completedQuantity: order.completedQuantity,
        priority: order.priority,
        sequence: order.sequence,
        status: calculatedStatus, // 使用重新计算的状态
        plannedDate: order.plannedDate,
        startedAt: order.startedAt,
        completedAt: order.completedAt,
        notes: order.notes,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        product: order.product,
        process: order.process,
        currentStation: actualCurrentStation, // 使用实际当前工位
        currentStep: order.currentStep,
        progressPercentage,
        activeWorkstations,
        workstationStatusSummary,
        stepStatusSummary,
        workstationStatuses: workstationStatuses.sort((a, b) => a.sequence - b.sequence)
      };
    });

    // 获取统计汇总（基于重新计算的状态）
    const overallStatistics = {
      totalOrders: total,
      statusBreakdown: {
        pending: orderMonitoringData.filter(o => o.status === 'PENDING').length,
        inProgress: orderMonitoringData.filter(o => o.status === 'IN_PROGRESS').length,
        completed: orderMonitoringData.filter(o => o.status === 'COMPLETED').length,
        paused: orderMonitoringData.filter(o => o.status === 'PAUSED').length,
        cancelled: orderMonitoringData.filter(o => o.status === 'CANCELLED').length,
        error: orderMonitoringData.filter(o => o.status === 'ERROR').length
      },
      averageProgress: orderMonitoringData.length > 0 
        ? Math.round(orderMonitoringData.reduce((sum, order) => sum + order.progressPercentage, 0) / orderMonitoringData.length)
        : 0
    };

    return NextResponse.json({
      success: true,
      data: {
        orders: orderMonitoringData,
        statistics: overallStatistics,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('获取订单监测数据失败:', error);
    return NextResponse.json(
      { success: false, error: '获取订单监测数据失败' },
      { status: 500 }
    );
  }
}

