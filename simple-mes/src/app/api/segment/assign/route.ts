import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { workstationOrderQueueService } from '@/lib/services/workstation-order-queue';

export async function POST(request: NextRequest) {
  try {
    const { orderNumber, workstationId, assignedBy } = await request.json();

    if (!orderNumber || !workstationId || !assignedBy) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

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

    // 根据workstationId查找工位（支持UUID和workstationId字符串）
    const workstation = await prisma.workstation.findFirst({
      where: {
        OR: [
          { id: workstationId },
          { workstationId: workstationId }
        ]
      },
      select: { id: true }
    });

    if (!workstation) {
      return NextResponse.json(
        { success: false, error: '工位不存在' },
        { status: 404 }
      );
    }

    // 手动分配订单到工位
    const assignment = await workstationOrderQueueService.manualAssignOrderToWorkstation(
      order.id,
      workstation.id,
      assignedBy
    );

    return NextResponse.json({
      success: true,
      data: assignment,
      message: '订单分配成功'
    });
  } catch (error) {
    console.error('手动分配订单失败:', error);
    const errorMessage = error instanceof Error ? error.message : '手动分配订单失败';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}