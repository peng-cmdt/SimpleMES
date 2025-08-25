import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/workstations/simple - 获取工位简要列表（用于下拉选择）
export async function GET() {
  try {
    const workstations = await prisma.workstation.findMany({
      where: {
        status: { not: 'deleted' }
      },
      select: {
        id: true,
        workstationId: true,
        name: true,
        type: true
      },
      orderBy: { workstationId: 'asc' }
    });

    return NextResponse.json({
      success: true,
      data: workstations
    });

  } catch (error) {
    console.error('获取工位简要列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取工位简要列表失败' },
      { status: 500 }
    );
  }
}