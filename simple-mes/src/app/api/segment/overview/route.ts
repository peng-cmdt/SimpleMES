import { NextResponse } from 'next/server';
import { workstationOrderQueueService } from '@/lib/services/workstation-order-queue';

export async function GET() {
  try {
    const overview = await workstationOrderQueueService.getSystemOverview();

    return NextResponse.json({
      success: true,
      data: overview
    });
  } catch (error) {
    console.error('获取系统概览失败:', error);
    return NextResponse.json(
      { success: false, error: '获取系统概览失败' },
      { status: 500 }
    );
  }
}