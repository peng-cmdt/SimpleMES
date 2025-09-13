import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/processes/[id]/steps - 向工艺中添加步骤
export async function POST(
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

    // 获取当前最大序号
    const maxSequence = existingProcess.steps.length > 0
      ? Math.max(...existingProcess.steps.map(step => step.sequence))
      : 0;

    // 在事务中创建新步骤
    const createdSteps = await prisma.$transaction(async (tx) => {
      const newSteps = [];

      // First, let's check what workstation devices exist
      const existingDevices = await tx.workstationDevice.findMany({
        select: { 
          id: true, 
          instanceId: true, 
          displayName: true,
          workstationId: true
        }
      });
      console.log('Existing workstation devices in database:', existingDevices);

      for (let i = 0; i < steps.length; i++) {
        const stepData = steps[i];
        const stepSequence = maxSequence + i + 1;

        console.log('Processing step:', stepData);

        // 创建步骤
        const step = await tx.step.create({
          data: {
            processId: processId,
            stepCode: stepData.stepCode,
            name: stepData.name,
            stepTemplateId: stepData.stepTemplateId || null,
            workstationId: stepData.workstationId || null,
            sequence: stepSequence,
            description: stepData.description || '',
            estimatedTime: stepData.estimatedTime || 0,
            isRequired: stepData.isRequired ?? true
          }
        });

        // 创建步骤的动作
        if (stepData.actions && stepData.actions.length > 0) {
          console.log('Creating actions for step:', step.id);
          console.log('Actions data:', stepData.actions);
          
          const actionsToCreate = stepData.actions.map((actionData: any) => {
            console.log('Processing action data:', actionData);
            
            let resolvedDeviceId = null;
            if (actionData.deviceId && actionData.deviceId.trim() !== '') {
              // Check if deviceId exists in our workstation device list
              const foundDevice = existingDevices.find(d => 
                d.id === actionData.deviceId || d.instanceId === actionData.deviceId
              );
              if (foundDevice) {
                resolvedDeviceId = foundDevice.id;
                console.log(`Resolved deviceId "${actionData.deviceId}" to "${foundDevice.id}"`);
              } else {
                console.warn(`Workstation device not found: "${actionData.deviceId}". Available devices:`, existingDevices.map(d => ({id: d.id, instanceId: d.instanceId, displayName: d.displayName})));
                resolvedDeviceId = null; // Don't create invalid foreign key
              }
            }
            
            const processedAction = {
              stepId: step.id,
              actionCode: actionData.actionCode,
              name: actionData.name,
              type: actionData.type,
              sequence: actionData.sequence,
              deviceId: resolvedDeviceId,
              deviceAddress: actionData.deviceAddress || '',
              expectedValue: actionData.expectedValue || '',
              validationRule: actionData.validationRule || '',
              parameters: actionData.parameters || {},
              description: actionData.description || '',
              isRequired: actionData.isRequired ?? true,
              timeout: actionData.timeout || null,
              retryCount: actionData.retryCount ?? 0
            };
            console.log('Processed action:', processedAction);
            return processedAction;
          });
          
          console.log('Final actions to create:', actionsToCreate);
          
          await tx.action.createMany({
            data: actionsToCreate
          });
        }

        newSteps.push(step);
      }

      return newSteps;
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
              orderBy: { sequence: 'asc' }
            }
          },
          orderBy: { sequence: 'asc' }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        process: updatedProcess,
        createdSteps: createdSteps
      },
      message: `成功添加 ${createdSteps.length} 个步骤`
    });

  } catch (error) {
    console.error('添加步骤失败:', error);
    return NextResponse.json(
      { success: false, error: '添加步骤失败' },
      { status: 500 }
    );
  }
}

// GET /api/processes/[id]/steps - 获取工艺的所有步骤
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: processId } = await params;

    // 验证工艺流程是否存在
    const existingProcess = await prisma.process.findUnique({
      where: { id: processId }
    });

    if (!existingProcess) {
      return NextResponse.json(
        { success: false, error: '工艺流程不存在' },
        { status: 404 }
      );
    }

    // 获取步骤数据
    const steps = await prisma.step.findMany({
      where: { processId: processId },
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
      },
      orderBy: { sequence: 'asc' }
    });

    return NextResponse.json({
      success: true,
      data: {
        processId: processId,
        steps: steps
      }
    });

  } catch (error) {
    console.error('获取步骤失败:', error);
    return NextResponse.json(
      { success: false, error: '获取步骤失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/processes/[id]/steps?stepId=xxx - 删除工艺中的指定步骤
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: processId } = await params;
    const { searchParams } = new URL(request.url);
    const stepId = searchParams.get('stepId');

    if (!stepId) {
      return NextResponse.json(
        { success: false, error: '步骤ID不能为空' },
        { status: 400 }
      );
    }

    // 验证工艺流程是否存在
    const existingProcess = await prisma.process.findUnique({
      where: { id: processId }
    });

    if (!existingProcess) {
      return NextResponse.json(
        { success: false, error: '工艺流程不存在' },
        { status: 404 }
      );
    }

    // 验证步骤是否存在且属于该工艺流程
    const existingStep = await prisma.step.findUnique({
      where: { id: stepId },
      include: { actions: true }
    });

    if (!existingStep || existingStep.processId !== processId) {
      return NextResponse.json(
        { success: false, error: '步骤不存在或不属于该工艺流程' },
        { status: 404 }
      );
    }

    // 在事务中删除步骤及其关联的数据
    await prisma.$transaction(async (tx) => {
      // 1. 首先删除相关的订单步骤执行记录
      await tx.orderStep.deleteMany({
        where: { stepId: stepId }
      });
      
      // 2. 删除相关的动作执行日志
      await tx.actionLog.deleteMany({
        where: { 
          action: {
            stepId: stepId
          }
        }
      });
      
      // 3. 删除步骤的所有动作
      await tx.action.deleteMany({
        where: { stepId: stepId }
      });
      
      // 4. 最后删除步骤本身
      await tx.step.delete({
        where: { id: stepId }
      });
    });

    // 重新获取更新后的工艺流程数据
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
              orderBy: { sequence: 'asc' }
            }
          },
          orderBy: { sequence: 'asc' }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        process: updatedProcess
      },
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