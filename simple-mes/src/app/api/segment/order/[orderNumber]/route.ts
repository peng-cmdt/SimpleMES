import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { orderNumber: string } }
) {
  try {
    const { orderNumber } = await params;

    // 根据订单号查找订单
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: { id: true }
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: '订单不存在' },
        { status: 404 }
      );
    }

    // 获取订单的分配状态
    const allocations = await prisma.workstationOrderQueue.findMany({
      where: { orderId: order.id },
      include: {
        order: {
          select: {
            orderNumber: true,
            productionNumber: true,
            status: true,
            product: {
              select: {
                productCode: true,
                name: true
              }
            }
          }
        },
        workstation: {
          select: {
            workstationId: true,
            name: true,
            isOrderCompleteStation: true
          }
        }
      },
      orderBy: {
        assignedAt: 'asc'
      }
    });

    return NextResponse.json({
      success: true,
      data: allocations
    });
  } catch (error) {
    console.error('获取订单分配详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取订单分配详情失败' },
      { status: 500 }
    );
  }
}