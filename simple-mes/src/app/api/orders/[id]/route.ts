import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { orderManagementService } from '@/lib/services/order-management';

// GET /api/orders/[id] - 获取单个订单详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const includeExecutionStatus = searchParams.get('includeExecutionStatus') === 'true';

    let order;
    
    if (includeExecutionStatus) {
      // 获取完整的执行状态信息
      order = await orderManagementService.getOrderExecutionStatus(id);
    } else {
      // 获取基本订单信息
      order = await prisma.order.findUnique({
        where: { id },
        include: {
          product: {
            select: {
              id: true,
              productCode: true,
              name: true,
              description: true
            }
          },
          bom: {
            include: {
              bomItems: {
                orderBy: { itemCode: 'asc' }
              }
            }
          },
          process: {
            include: {
              steps: {
                include: {
                  workstation: {
                    select: {
                      id: true,
                      workstationId: true,
                      name: true,
                      type: true
                    }
                  },
                  stepTemplate: {
                    select: {
                      id: true,
                      stepCode: true,
                      name: true,
                      description: true,
                      instructions: true,
                      image: true,
                      estimatedTime: true
                    }
                  },
                  actions: {
                    include: {
                      device: {
                        select: {
                          id: true,
                          deviceId: true,
                          name: true,
                          type: true
                        }
                      }
                    },
                    orderBy: { sequence: 'asc' }
                  }
                },
                orderBy: { sequence: 'asc' }
              }
            }
          },
          currentStation: {
            select: {
              id: true,
              workstationId: true,
              name: true,
              type: true
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
          orderSteps: {
            include: {
              step: {
                include: {
                  stepTemplate: {
                    select: {
                      id: true,
                      stepCode: true,
                      name: true,
                      description: true,
                      instructions: true,
                      image: true,
                      estimatedTime: true
                    }
                  },
                  actions: {
                    include: {
                      device: {
                        select: {
                          id: true,
                          deviceId: true,
                          name: true,
                          type: true
                        }
                      }
                    },
                    orderBy: { sequence: 'asc' }
                  }
                }
              },
              workstation: {
                select: {
                  id: true,
                  workstationId: true,
                  name: true,
                  type: true
                }
              }
            },
            orderBy: { step: { sequence: 'asc' } }
          }
        }
      });
    }

    if (!order) {
      return NextResponse.json(
        { success: false, error: '订单不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('获取订单详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取订单详情失败' },
      { status: 500 }
    );
  }
}

// PUT /api/orders/[id] - 更新订单
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { 
      action,
      orderNumber, 
      productionNumber, 
      productId, 
      bomId, 
      processId, 
      quantity, 
      priority, 
      status, 
      plannedDate, 
      notes,
      updatedBy,
      reason,
      completedQuantity,
      currentStationId,
      currentStepId,
      sequence
    } = body;

    // 验证订单是否存在
    const existingOrder = await prisma.order.findUnique({
      where: { id }
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: '订单不存在' },
        { status: 404 }
      );
    }

    // 根据不同的操作类型执行相应的更新
    if (action) {
      switch (action) {
        case 'changeStatus':
          if (!status) {
            return NextResponse.json(
              { success: false, error: '缺少状态参数' },
              { status: 400 }
            );
          }
          
          const updatedOrder = await orderManagementService.changeOrderStatus({
            orderId: id,
            newStatus: status,
            changedBy: updatedBy,
            reason,
            notes,
            workstationId: currentStationId,
            stepId: currentStepId
          });

          return NextResponse.json({
            success: true,
            data: updatedOrder,
            message: '订单状态更新成功'
          });

        case 'updateProgress':
          const progressOrder = await orderManagementService.updateOrderProgress({
            orderId: id,
            completedQuantity,
            currentStationId,
            currentStepId,
            updatedBy,
            notes
          });

          return NextResponse.json({
            success: true,
            data: progressOrder,
            message: '订单进度更新成功'
          });

        case 'updatePriority':
          if (priority === undefined) {
            return NextResponse.json(
              { success: false, error: '缺少优先级参数' },
              { status: 400 }
            );
          }

          const priorityOrder = await orderManagementService.updateOrderPriority({
            orderId: id,
            newPriority: priority,
            newSequence: sequence,
            updatedBy,
            reason
          });

          return NextResponse.json({
            success: true,
            data: priorityOrder,
            message: '订单优先级更新成功'
          });

        default:
          return NextResponse.json(
            { success: false, error: `不支持的操作: ${action}` },
            { status: 400 }
          );
      }
    }

    // 常规字段更新
    // 检查订单号是否与其他订单冲突
    if (orderNumber && orderNumber !== existingOrder.orderNumber) {
      const conflictOrder = await prisma.order.findUnique({
        where: { orderNumber }
      });

      if (conflictOrder) {
        return NextResponse.json(
          { success: false, error: '订单号已存在' },
          { status: 400 }
        );
      }
    }

    // 如果订单已开始执行，限制可修改的字段
    if (existingOrder.status === 'IN_PROGRESS') {
      // 只允许修改优先级、计划日期和备注
      const updatedOrder = await prisma.order.update({
        where: { id },
        data: {
          ...(priority !== undefined && { priority }),
          ...(plannedDate !== undefined && { plannedDate: plannedDate ? new Date(plannedDate) : null }),
          ...(notes !== undefined && { notes })
        },
        include: {
          product: {
            select: {
              id: true,
              productCode: true,
              name: true
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
          }
        }
      });

      return NextResponse.json({
        success: true,
        data: updatedOrder,
        message: '订单更新成功（执行中订单仅允许修改优先级、计划日期和备注）'
      });
    }

    // 验证相关数据的存在性和一致性
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId }
      });

      if (!product) {
        return NextResponse.json(
          { success: false, error: '指定的产品不存在' },
          { status: 400 }
        );
      }
    }

    if (bomId) {
      const bom = await prisma.bOM.findUnique({
        where: { id: bomId }
      });

      if (!bom || (productId && bom.productId !== productId)) {
        return NextResponse.json(
          { success: false, error: '指定的BOM不存在或与产品不匹配' },
          { status: 400 }
        );
      }
    }

    if (processId) {
      const process = await prisma.process.findUnique({
        where: { id: processId }
      });

      if (!process || (productId && process.productId !== productId)) {
        return NextResponse.json(
          { success: false, error: '指定的工艺流程不存在或与产品不匹配' },
          { status: 400 }
        );
      }
    }

    // 验证数量
    if (quantity !== undefined && (quantity <= 0 || !Number.isInteger(quantity))) {
      return NextResponse.json(
        { success: false, error: '数量必须为正整数' },
        { status: 400 }
      );
    }

    // 更新订单
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        ...(orderNumber && { orderNumber }),
        ...(productionNumber && { productionNumber }),
        ...(productId && { productId }),
        ...(bomId && { bomId }),
        ...(processId && { processId }),
        ...(quantity !== undefined && { quantity }),
        ...(priority !== undefined && { priority }),
        ...(status && { status }),
        ...(plannedDate !== undefined && { plannedDate: plannedDate ? new Date(plannedDate) : null }),
        ...(notes !== undefined && { notes }),
        // 更新状态相关的时间戳
        ...(status === 'IN_PROGRESS' && !existingOrder.startedAt && { startedAt: new Date() }),
        ...(status === 'COMPLETED' && existingOrder.status !== 'COMPLETED' && { completedAt: new Date() })
      },
      include: {
        product: {
          select: {
            id: true,
            productCode: true,
            name: true
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
        }
      }
    });

    // 如果状态发生变化，记录状态变更历史
    if (status && status !== existingOrder.status) {
      await prisma.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: existingOrder.status,
          toStatus: status,
          changedBy: updatedBy || 'manual',
          reason: reason || `订单状态从 ${existingOrder.status} 变更为 ${status}`
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: updatedOrder,
      message: '订单更新成功'
    });

  } catch (error) {
    console.error('更新订单失败:', error);
    return NextResponse.json(
      { success: false, error: '更新订单失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/orders/[id] - 删除订单
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 验证订单是否存在
    const existingOrder = await prisma.order.findUnique({
      where: { id }
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: '订单不存在' },
        { status: 404 }
      );
    }

    // 检查订单状态，只有待开始和已取消的订单可以删除
    if (existingOrder.status === 'IN_PROGRESS') {
      return NextResponse.json(
        { success: false, error: '进行中的订单无法删除' },
        { status: 400 }
      );
    }

    if (existingOrder.status === 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: '已完成的订单无法删除' },
        { status: 400 }
      );
    }

    // 删除订单（相关的订单步骤和执行日志会因为级联删除而自动删除）
    await prisma.order.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: '订单删除成功'
    });

  } catch (error) {
    console.error('删除订单失败:', error);
    return NextResponse.json(
      { success: false, error: '删除订单失败' },
      { status: 500 }
    );
  }
}