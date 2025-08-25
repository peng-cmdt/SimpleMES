import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/step-templates/simple - 获取步骤模板简要列表（用于下拉选择）
export async function GET() {
  try {
    const stepTemplates = await prisma.stepTemplate.findMany({
      where: {
        status: 'active'
      },
      select: {
        id: true,
        stepCode: true,
        name: true,
        category: true,
        workstationType: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      data: stepTemplates
    });

  } catch (error) {
    console.error('获取步骤模板简要列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取步骤模板简要列表失败' },
      { status: 500 }
    );
  }
}