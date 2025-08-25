import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/steps/[id] - 获取单个步骤详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const step = await prisma.step.findUnique({
      where: { id },
      include: {
        process: {
          select: {
            id: true,
            processCode: true,
            name: true,
            product: {
              select: {
                id: true,
                productCode: true,
                name: true
              }
            }
          }
        },
        workstation: {
          select: {
            id: true,
            workstationId: true,
            name: true,
            type: true,
            location: true
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
    });

    if (!step) {
      return NextResponse.json(
        { success: false, error: '步骤不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: step
    });

  } catch (error) {
    console.error('获取步骤详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取步骤详情失败' },
      { status: 500 }
    );
  }
}

// PUT /api/steps/[id] - 更新步骤
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { stepCode, name, workstationId, sequence, description, estimatedTime, isRequired } = body;

    // 验证步骤是否存在
    const existingStep = await prisma.step.findUnique({
      where: { id }
    });

    if (!existingStep) {
      return NextResponse.json(
        { success: false, error: '步骤不存在' },
        { status: 404 }
      );
    }

    // 检查序号是否与其他步骤冲突
    if (sequence !== undefined && sequence !== existingStep.sequence) {
      const conflictStep = await prisma.step.findUnique({
        where: { 
          processId_sequence: { 
            processId: existingStep.processId, 
            sequence 
          } 
        }
      });

      if (conflictStep) {
        return NextResponse.json(
          { success: false, error: '步骤序号已存在' },
          { status: 400 }
        );
      }
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

    // 更新步骤
    const updatedStep = await prisma.step.update({
      where: { id },
      data: {
        ...(stepCode && { stepCode }),
        ...(name && { name }),
        ...(workstationId !== undefined && { workstationId }),
        ...(sequence !== undefined && { sequence }),
        ...(description !== undefined && { description }),
        ...(estimatedTime !== undefined && { estimatedTime }),
        ...(isRequired !== undefined && { isRequired })
      },
      include: {
        workstation: {
          select: {
            id: true,
            workstationId: true,
            name: true,
            type: true
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
    });

    return NextResponse.json({
      success: true,
      data: updatedStep,
      message: '步骤更新成功'
    });

  } catch (error) {
    console.error('更新步骤失败:', error);
    return NextResponse.json(
      { success: false, error: '更新步骤失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/steps/[id] - 删除步骤
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 验证步骤是否存在
    const existingStep = await prisma.step.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            actions: true,
            orderSteps: true
          }
        }
      }
    });

    if (!existingStep) {
      return NextResponse.json(
        { success: false, error: '步骤不存在' },
        { status: 404 }
      );
    }

    // 检查是否有关联的订单步骤
    if (existingStep._count.orderSteps > 0) {
      return NextResponse.json(
        { success: false, error: '步骤已被订单使用，无法删除' },
        { status: 400 }
      );
    }

    // 删除步骤（动作会因为级联删除而自动删除）
    await prisma.step.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: '步骤删除成功'
    });

  } catch (error) {
    console.error('删除步骤失败:', error);
    return NextResponse.json(
      { success: false, error: '删除步骤失败' },
      { status: 500 }
    );
  }
}