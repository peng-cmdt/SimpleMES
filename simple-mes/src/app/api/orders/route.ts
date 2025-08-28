import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { orderManagementService } from '@/lib/services/order-management';

// GET /api/orders - 获取生产订单列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const productId = searchParams.get('productId');
    const workstationId = searchParams.get('workstationId');
    const includeStatistics = searchParams.get('includeStatistics') === 'true';

    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: any = {};
    
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { productionNumber: { contains: search } },
        { notes: { contains: search } }
      ];
    }
    
    if (status) {
      // 支持多个状态查询，用逗号分隔，如：status=pending,in_progress
      const statusList = status.split(',').map(s => s.trim());
      const statusMap: { [key: string]: string } = {
        'pending': 'PENDING',
        'in_progress': 'IN_PROGRESS', 
        'completed': 'COMPLETED',
        'paused': 'PAUSED',
        'cancelled': 'CANCELLED',
        'error': 'ERROR'
      };
      
      const mappedStatuses = statusList
        .map(s => statusMap[s.toLowerCase()] || s.toUpperCase())
        .filter(Boolean); // 过滤掉无效状态
      
      if (mappedStatuses.length > 0) {
        where.status = { in: mappedStatuses };
      }
    }
    
    if (productId) {
      where.productId = productId;
    }

    if (workstationId) {
      // 根据产品工艺路线筛选订单 - 查找包含该工位的产品的订单
      // 注意：workstationId参数可能是字符串标识符或UUID，需要同时查找
      where.product = {
        productWorkstations: {
          some: {
            OR: [
              // 直接匹配UUID（如果传入的是workstation.id）
              { workstationId: workstationId },
              // 通过workstationId字符串标识符匹配（如果传入的是workstation.workstationId）
              { 
                workstation: {
                  workstationId: workstationId
                }
              }
            ]
          }
        }
      };
    }

    // 获取总数
    const total = await prisma.order.count({ where });

    // 获取订单列表
    const orders = await prisma.order.findMany({
      where,
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
        _count: {
          select: {
            orderSteps: true
          }
        }
      },
      orderBy: [
        // 首先按订单号排序（提取数字部分进行排序）
        { orderNumber: 'asc' },
        { priority: 'asc' },
        { sequence: 'asc' },
        { plannedDate: 'asc' },
        { createdAt: 'desc' }
      ],
      skip,
      take: limit
    });

    // 如果需要统计信息
    let statistics = null;
    if (includeStatistics) {
      statistics = await orderManagementService.getOrderStatistics({
        ...(productId && { productId }),
        ...(workstationId && { workstationId })
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        orders,
        statistics,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('获取订单列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取订单列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/orders - 创建新订单
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      orderNumber, 
      productionNumber, 
      productId, 
      bomId, 
      processId, 
      quantity, 
      priority = 0, 
      plannedDate, 
      notes, 
      createdBy 
    } = body;

    // 验证必填字段
    if (!orderNumber || !productionNumber || !productId || !processId || !quantity) {
      return NextResponse.json(
        { success: false, error: '订单号、生产号、产品、工艺流程和数量不能为空' },
        { status: 400 }
      );
    }

    // 验证数量
    if (quantity <= 0 || !Number.isInteger(quantity)) {
      return NextResponse.json(
        { success: false, error: '数量必须为正整数' },
        { status: 400 }
      );
    }

    // 检查订单号是否已存在
    const existingOrderByNumber = await prisma.order.findUnique({
      where: { orderNumber }
    });

    if (existingOrderByNumber) {
      return NextResponse.json(
        { success: false, error: '订单号已存在，请使用不同的订单号' },
        { status: 400 }
      );
    }

    // 检查生产号是否已存在
    const existingOrderByProduction = await prisma.order.findFirst({
      where: { productionNumber }
    });

    if (existingOrderByProduction) {
      return NextResponse.json(
        { success: false, error: '生产号已存在，请使用不同的生产号' },
        { status: 400 }
      );
    }

    // 验证产品是否存在
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: '指定的产品不存在' },
        { status: 400 }
      );
    }

    // 自动选择产品的第一个可用BOM（可选）
    let selectedBomId = bomId;
    if (!selectedBomId) {
      const firstBom = await prisma.bOM.findFirst({
        where: { 
          productId: productId,
          status: 'active' 
        },
        orderBy: { createdAt: 'asc' }
      });

      // 如果有可用的BOM则自动选择，没有也不强制要求
      if (firstBom) {
        selectedBomId = firstBom.id;
      }
    }

    // 验证BOM（仅当指定了BOM时）
    if (selectedBomId) {
      const bom = await prisma.bOM.findUnique({
        where: { id: selectedBomId }
      });

      if (!bom || bom.productId !== productId) {
        return NextResponse.json(
          { success: false, error: '指定的BOM不存在或与产品不匹配' },
          { status: 400 }
        );
      }
    }

    const process = await prisma.process.findUnique({
      where: { id: processId }
    });

    if (!process || process.productId !== productId) {
      return NextResponse.json(
        { success: false, error: '指定的工艺流程不存在或与产品不匹配' },
        { status: 400 }
      );
    }

    // 获取当前最大序号
    const lastOrder = await prisma.order.findFirst({
      orderBy: { sequence: 'desc' },
      where: { sequence: { not: null } }
    });
    const sequence = (lastOrder?.sequence || 0) + 1;

    // 使用事务创建订单和相关记录
    const order = await prisma.$transaction(async (tx) => {
      // 创建订单
      const orderData: any = {
        orderNumber,
        productionNumber,
        productId,
        processId,
        quantity,
        priority,
        sequence,
        plannedDate: plannedDate ? new Date(plannedDate) : null,
        notes,
        createdBy: createdBy || 'manual',
        importSource: 'manual'
      };

      // 只有当selectedBomId存在时才添加bomId字段
      if (selectedBomId) {
        orderData.bomId = selectedBomId;
      }

      const newOrder = await tx.order.create({
        data: orderData,
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

      // 记录订单状态变更历史
      await tx.orderStatusHistory.create({
        data: {
          orderId: newOrder.id,
          fromStatus: null,
          toStatus: 'PENDING',
          changedBy: createdBy || 'manual',
          reason: '手动创建订单'
        }
      });

      // 根据工艺流程创建订单步骤记录
      const steps = await tx.step.findMany({
        where: { processId },
        orderBy: { sequence: 'asc' }
      });

      for (const step of steps) {
        await tx.orderStep.create({
          data: {
            orderId: newOrder.id,
            stepId: step.id,
            workstationId: step.workstationId,
            status: 'pending'
          }
        });
      }

      return newOrder;
    });

    const message = selectedBomId ? '订单创建成功' : '订单创建成功，请在订单详情中配置BOM';
    
    return NextResponse.json({
      success: true,
      data: order,
      message: message
    });

  } catch (error) {
    console.error('创建订单失败:', error);
    return NextResponse.json(
      { success: false, error: '创建订单失败' },
      { status: 500 }
    );
  }
}

// PUT /api/orders - 批量更新订单状态
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, orderIds, newStatus, changedBy, reason, priority, sequence } = body;

    if (!action || !orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    let results;

    switch (action) {
      case 'changeStatus':
        if (!newStatus) {
          return NextResponse.json(
            { success: false, error: '缺少新状态参数' },
            { status: 400 }
          );
        }
        results = await orderManagementService.batchUpdateOrderStatus(
          orderIds,
          newStatus,
          changedBy,
          reason
        );
        break;

      case 'updatePriority':
        if (priority === undefined) {
          return NextResponse.json(
            { success: false, error: '缺少优先级参数' },
            { status: 400 }
          );
        }
        results = [];
        for (const orderId of orderIds) {
          try {
            const result = await orderManagementService.updateOrderPriority({
              orderId,
              newPriority: priority,
              newSequence: sequence,
              updatedBy: changedBy,
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
        break;

      default:
        return NextResponse.json(
          { success: false, error: `不支持的操作: ${action}` },
          { status: 400 }
        );
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      data: results,
      message: `批量操作完成 - 成功: ${successCount}, 失败: ${failCount}`
    });

  } catch (error) {
    console.error('批量更新订单失败:', error);
    return NextResponse.json(
      { success: false, error: '批量更新订单失败' },
      { status: 500 }
    );
  }
}