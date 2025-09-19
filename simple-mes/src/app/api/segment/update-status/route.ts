import { NextRequest, NextResponse } from 'next/server';
import { workstationOrderQueueService } from '@/lib/services/workstation-order-queue';
import { WorkstationOrderStatus } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const { orderId, workstationId, status, notes, updatedBy } = await request.json();

    if (!orderId || !workstationId || !status) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 验证状态值
    const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'SKIPPED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: '无效的状态值' },
        { status: 400 }
      );
    }

    // 更新工位订单状态
    const updated = await workstationOrderQueueService.updateWorkstationOrderStatus({
      orderId,
      workstationId,
      status: status as WorkstationOrderStatus,
      notes,
      updatedBy: updatedBy || 'admin'
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: '状态更新成功'
    });
  } catch (error) {
    console.error('更新工位订单状态失败:', error);
    const errorMessage = error instanceof Error ? error.message : '更新工位订单状态失败';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}