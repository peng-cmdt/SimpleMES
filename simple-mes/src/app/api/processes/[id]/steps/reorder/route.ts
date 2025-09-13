import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PUT /api/processes/[id]/steps/reorder - 重新排序工艺步骤
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: processId } = await params;
    const body = await request.json();
    const { steps } = body;

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { success: false, error: '步骤数据无效' },
        { status: 400 }
      );
    }

    // 验证工艺流程是否存在
    const existingProcess = await prisma.process.findUnique({
      where: { id: processId },
      include: {
        steps: {
          orderBy: { sequence: 'asc' }
        }
      }
    });

    if (!existingProcess) {
      return NextResponse.json(
        { success: false, error: '工艺流程不存在' },
        { status: 404 }
      );
    }

    // 在事务中更新步骤顺序 - 先设置为临时负值，再设置正确值
    await prisma.$transaction(async (tx) => {
      // 第一步：将所有步骤的sequence设置为负值，避免唯一约束冲突
      for (let i = 0; i < steps.length; i++) {
        const stepUpdate = steps[i];
        if (stepUpdate.id) {
          await tx.step.update({
            where: { id: stepUpdate.id },
            data: { sequence: -1 - i } // 使用负值避免冲突
          });
        }
      }
      
      // 第二步：设置正确的sequence值
      for (const stepUpdate of steps) {
        if (stepUpdate.id) {
          await tx.step.update({
            where: { id: stepUpdate.id },
            data: { sequence: stepUpdate.sequence }
          });
        }
      }
    });

    // 重新获取完整的工艺流程数据
    const updatedProcess = await prisma.process.findUnique({
      where: { id: processId },
      include: {
        product: {
          select: {
            id: true,
            productCode: true,
            name: true
          }
        },
        steps: {
          include: {
            workstation: {
              select: {
                id: true,
                workstationId: true,
                name: true
              }
            },
            stepTemplate: {
              select: {
                id: true,
                stepCode: true,
                name: true
              }
            },
            actions: {
              select: {
                id: true,
                actionCode: true,
                name: true,
                type: true,
                sequence: true,
                deviceId: true,
                deviceAddress: true,
                expectedValue: true,
                validationRule: true,
                parameters: true,
                description: true,
                isRequired: true,
                timeout: true,
                retryCount: true
              },
              orderBy: { sequence: 'asc' }
            }
          },
          orderBy: { sequence: 'asc' }
        }
      }
    });

    // 为actions添加设备信息
    if (updatedProcess) {
      // 收集所有action的deviceId
      const deviceIds = new Set<string>();
      if (updatedProcess.steps) {
        updatedProcess.steps.forEach((step: any) => {
          if (step.actions) {
            step.actions.forEach((action: any) => {
              if (action.deviceId) {
                deviceIds.add(action.deviceId);
              }
            });
          }
        });
      }

      // 查询设备信息
      const devices = await prisma.workstationDevice.findMany({
        where: {
          id: { in: Array.from(deviceIds) }
        },
        include: {
          template: true
        }
      });

      // 创建deviceId到设备信息的映射
      const deviceMap = new Map();
      devices.forEach(device => {
        deviceMap.set(device.id, {
          id: device.id,
          deviceId: device.instanceId,
          name: device.displayName,
          type: device.template.type,
          ipAddress: device.ipAddress,
          port: device.port,
          brand: device.template.brand,
          model: device.template.model,
          protocol: device.protocol,
          status: device.status,
          isOnline: device.isOnline
        });
      });

      // 为actions添加设备信息
      if (updatedProcess.steps) {
        updatedProcess.steps.forEach((step: any) => {
          if (step.actions) {
            step.actions.forEach((action: any) => {
              if (action.deviceId && deviceMap.has(action.deviceId)) {
                action.device = deviceMap.get(action.deviceId);
              }
            });
          }
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        process: updatedProcess
      },
      message: '步骤顺序保存成功'
    });

  } catch (error) {
    console.error('保存步骤顺序失败:', error);
    return NextResponse.json(
      { success: false, error: '保存步骤顺序失败' },
      { status: 500 }
    );
  }
}