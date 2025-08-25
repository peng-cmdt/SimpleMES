import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/steps - 获取步骤列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const processId = searchParams.get('processId');

    if (!processId) {
      return NextResponse.json(
        { success: false, error: '工艺流程ID不能为空' },
        { status: 400 }
      );
    }

    const steps = await prisma.step.findMany({
      where: { processId },
      include: {
        workstation: {
          select: {
            id: true,
            workstationId: true,
            name: true,
            type: true
          }
        },
        _count: {
          select: {
            actions: true
          }
        }
      },
      orderBy: { sequence: 'asc' }
    });

    return NextResponse.json({
      success: true,
      data: steps
    });

  } catch (error) {
    console.error('获取步骤列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取步骤列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/steps - 创建新步骤
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      processId, 
      stepCode, 
      name, 
      workstationId, 
      sequence, 
      description, 
      estimatedTime, 
      isRequired = true 
    } = body;

    // 验证必填字段
    if (!processId || !stepCode || !name || sequence === undefined) {
      return NextResponse.json(
        { success: false, error: '工艺流程ID、步骤编码、名称和顺序不能为空' },
        { status: 400 }
      );
    }

    // 验证工艺流程是否存在
    const process = await prisma.process.findUnique({
      where: { id: processId }
    });

    if (!process) {
      return NextResponse.json(
        { success: false, error: '指定的工艺流程不存在' },
        { status: 400 }
      );
    }

    // 检查序号是否冲突
    const existingStep = await prisma.step.findUnique({
      where: { processId_sequence: { processId, sequence } }
    });

    if (existingStep) {
      return NextResponse.json(
        { success: false, error: '步骤序号已存在' },
        { status: 400 }
      );
    }

    // 验证工位是否存在
    if (workstationId) {
      const workstation = await prisma.workstation.findUnique({
        where: { id: workstationId }
      });

      if (!workstation) {
        return NextResponse.json(
          { success: false, error: '指定的工位不存在' },
          { status: 400 }
        );
      }
    }

    // 创建步骤
    const step = await prisma.step.create({
      data: {
        processId,
        stepCode,
        name,
        workstationId,
        sequence,
        description,
        estimatedTime,
        isRequired
      },
      include: {
        workstation: {
          select: {
            id: true,
            workstationId: true,
            name: true,
            type: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: step,
      message: '步骤创建成功'
    });

  } catch (error) {
    console.error('创建步骤失败:', error);
    return NextResponse.json(
      { success: false, error: '创建步骤失败' },
      { status: 500 }
    );
  }
}