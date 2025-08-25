import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/actions - 获取动作列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stepId = searchParams.get('stepId');

    if (!stepId) {
      return NextResponse.json(
        { success: false, error: '步骤ID不能为空' },
        { status: 400 }
      );
    }

    const actions = await prisma.action.findMany({
      where: { stepId },
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
      },
      orderBy: { sequence: 'asc' }
    });

    return NextResponse.json({
      success: true,
      data: actions
    });

  } catch (error) {
    console.error('获取动作列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取动作列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/actions - 创建新动作
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      stepId, 
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
      isRequired = true, 
      timeout, 
      retryCount = 0 
    } = body;

    // 验证必填字段
    if (!stepId || !actionCode || !name || !type || sequence === undefined) {
      return NextResponse.json(
        { success: false, error: '步骤ID、动作编码、名称、类型和顺序不能为空' },
        { status: 400 }
      );
    }

    // 验证步骤是否存在
    const step = await prisma.step.findUnique({
      where: { id: stepId }
    });

    if (!step) {
      return NextResponse.json(
        { success: false, error: '指定的步骤不存在' },
        { status: 400 }
      );
    }

    // 检查序号是否冲突
    const existingAction = await prisma.action.findFirst({
      where: { 
        stepId: stepId,
        sequence: sequence 
      }
    });

    if (existingAction) {
      return NextResponse.json(
        { success: false, error: `动作序号 ${sequence} 已存在于此步骤中` },
        { status: 400 }
      );
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

    // 创建动作
    console.log('Creating action with data:', {
      stepId,
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
    });

    const action = await prisma.action.create({
      data: {
        stepId,
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

    console.log('Action created successfully:', action);

    return NextResponse.json({
      success: true,
      data: action,
      message: '动作创建成功'
    });

  } catch (error) {
    console.error('创建动作失败:', error);
    return NextResponse.json(
      { success: false, error: '创建动作失败' },
      { status: 500 }
    );
  }
}