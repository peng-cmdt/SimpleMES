import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/orders/monitoring/[orderId] - 获取单个订单的详细监测数据
export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        product: {
          select: {
            id: true,
            productCode: true,
            name: true,
            version: true
          }
        },
        bom: {
          select: {
            id: true,
            bomCode: true,
            name: true,
            version: true
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
          include: {
            workstation: {
              select: {
                id: true,
                workstationId: true,
                name: true,
                isOrderCompleteStation: true,
                location: true
              }
            }
          },
          orderBy: {
            assignedAt: 'asc'
          }
        },
        orderSteps: {
          include: {
            step: {
              include: {
                actions: {
                  select: {
                    id: true,
                    actionCode: true,
                    name: true,
                    type: true,
                    sequence: true
                  },
                  orderBy: {
                    sequence: 'asc'
                  }
                }
              }
            },
            workstation: {
              select: {
                id: true,
                workstationId: true,
                name: true
              }
            },
            actionLogs: {
              select: {
                id: true,
                status: true,
                executedAt: true,
                executedBy: true,
                executionTime: true,
                requestValue: true,
                responseValue: true,
                actualValue: true,
                validationResult: true,
                errorCode: true,
                errorMessage: true,
                action: {
                  select: {
                    actionCode: true,
                    name: true,
                    type: true
                  }
                }
              },
              orderBy: {
                executedAt: 'desc'
              }
            }
          },
          orderBy: {
            step: {
              sequence: 'asc'
            }
          }
        },
        statusHistory: {
          orderBy: {
            changedAt: 'desc'
          },
          take: 20 // 最近20次状态变更
        }
      }
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: '订单不存在' },
        { status: 404 }
      );
    }

    // 按工位组织详细数据
    const workstationDetails = order.workstationOrderQueues.map(queue => {
      // 该工位相关的步骤
      const relatedSteps = order.orderSteps
        .filter(step => step.workstationId === queue.workstation.id)
        .map(step => ({
          ...step,
          actionsCount: step.step.actions.length,
          completedActionsCount: step.actionLogs.filter(log => log.status === 'completed').length,
          stepProgress: step.step.actions.length > 0 
            ? Math.round((step.actionLogs.filter(log => log.status === 'completed').length / step.step.actions.length) * 100)
            : 0
        }));

      // 计算工位进度
      const totalSteps = relatedSteps.length;
      const completedSteps = relatedSteps.filter(step => step.status === 'completed').length;
      const workstationProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

      return {
        workstation: queue.workstation,
        queueInfo: {
          status: queue.status,
          assignedAt: queue.assignedAt,
          startedAt: queue.startedAt,
          completedAt: queue.completedAt,
          priority: queue.priority,
          sequence: queue.sequence,
          isVisible: queue.isVisible,
          notes: queue.notes
        },
        progress: workstationProgress,
        steps: relatedSteps
      };
    });

    // 计算总体进度
    const totalSteps = order.orderSteps.length;
    const completedSteps = order.orderSteps.filter(step => step.status === 'completed').length;
    const overallProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    // 统计信息
    const statistics = {
      overallProgress,
      totalSteps,
      completedSteps,
      workstationCount: order.workstationOrderQueues.length,
      activeWorkstations: order.workstationOrderQueues.filter(q => q.status === 'IN_PROGRESS').length,
      completedWorkstations: order.workstationOrderQueues.filter(q => q.status === 'COMPLETED').length,
      totalActions: order.orderSteps.reduce((sum, step) => sum + step.step.actions.length, 0),
      completedActions: order.orderSteps.reduce((sum, step) => 
        sum + step.actionLogs.filter(log => log.status === 'completed').length, 0
      ),
      estimatedTotalTime: order.orderSteps.reduce((sum, step) => sum + (step.step.estimatedTime || 0), 0),
      actualTotalTime: order.orderSteps.reduce((sum, step) => sum + (step.actualTime || 0), 0)
    };

    const detailedOrder = {
      ...order,
      statistics,
      workstationDetails: workstationDetails.sort((a, b) => a.queueInfo.sequence - b.queueInfo.sequence)
    };

    return NextResponse.json({
      success: true,
      data: detailedOrder
    });

  } catch (error) {
    console.error('获取订单详细监测数据失败:', error);
    return NextResponse.json(
      { success: false, error: '获取订单详细监测数据失败' },
      { status: 500 }
    );
  }
}