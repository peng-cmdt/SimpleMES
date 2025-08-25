import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/actions/[id] - 获取单个动作详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const action = await prisma.action.findUnique({
      where: { id },
      include: {
        step: {
          select: {
            id: true,
            stepCode: true,
            name: true,
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
            }
          }
        },
        device: {
          select: {
            id: true,
            deviceId: true,
            name: true,
            type: true,
            brand: true,
            model: true,
            ipAddress: true,
            port: true,
            protocol: true
          }
        }
      }
    });

    if (!action) {
      return NextResponse.json(
        { success: false, error: '动作不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: action
    });

  } catch (error) {
    console.error('获取动作详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取动作详情失败' },
      { status: 500 }
    );
  }
}

// PUT /api/actions/[id] - 更新动作
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { 
      actionCode, 
      name, 
      type, 
      sequence, 
      deviceId, 
      deviceAddress, 
      expectedValue, 
      validationRule, 
      parameters, 
      description, 
      isRequired, 
      timeout, 
      retryCount 
    } = body;

    // 验证动作是否存在
    const existingAction = await prisma.action.findUnique({
      where: { id }
    });

    if (!existingAction) {
      return NextResponse.json(
        { success: false, error: '动作不存在' },
        { status: 404 }
      );
    }

    // 检查序号是否与其他动作冲突
    if (sequence !== undefined && sequence !== existingAction.sequence) {
      const conflictAction = await prisma.action.findUnique({
        where: { 
          stepId_sequence: { 
            stepId: existingAction.stepId, 
            sequence 
          } 
        }
      });

      if (conflictAction) {
        return NextResponse.json(
          { success: false, error: '动作序号已存在' },
          { status: 400 }
        );
      }
    }

    // 验证设备是否存在
    if (deviceId) {
      const device = await prisma.device.findUnique({
        where: { id: deviceId }
      });

      if (!device) {
        return NextResponse.json(
          { success: false, error: '指定的设备不存在' },
          { status: 400 }
        );
      }
    }

    // 更新动作
    const updatedAction = await prisma.action.update({
      where: { id },
      data: {
        ...(actionCode && { actionCode }),
        ...(name && { name }),
        ...(type && { type }),
        ...(sequence !== undefined && { sequence }),
        ...(deviceId !== undefined && { deviceId }),
        ...(deviceAddress !== undefined && { deviceAddress }),
        ...(expectedValue !== undefined && { expectedValue }),
        ...(validationRule !== undefined && { validationRule }),
        ...(parameters !== undefined && { parameters }),
        ...(description !== undefined && { description }),
        ...(isRequired !== undefined && { isRequired }),
        ...(timeout !== undefined && { timeout }),
        ...(retryCount !== undefined && { retryCount })
      },
      include: {
        device: {
          select: {
            id: true,
            deviceId: true,
            name: true,
            type: true,
            brand: true,
            model: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedAction,
      message: '动作更新成功'
    });

  } catch (error) {
    console.error('更新动作失败:', error);
    return NextResponse.json(
      { success: false, error: '更新动作失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/actions/[id] - 删除动作
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 验证动作是否存在
    const existingAction = await prisma.action.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            actionLogs: true
          }
        }
      }
    });

    if (!existingAction) {
      return NextResponse.json(
        { success: false, error: '动作不存在' },
        { status: 404 }
      );
    }

    // 检查是否有执行日志（如果有日志，说明已经被执行过）
    if (existingAction._count.actionLogs > 0) {
      return NextResponse.json(
        { success: false, error: '动作已有执行记录，无法删除' },
        { status: 400 }
      );
    }

    // 删除动作
    await prisma.action.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: '动作删除成功'
    });

  } catch (error) {
    console.error('删除动作失败:', error);
    return NextResponse.json(
      { success: false, error: '删除动作失败' },
      { status: 500 }
    );
  }
}