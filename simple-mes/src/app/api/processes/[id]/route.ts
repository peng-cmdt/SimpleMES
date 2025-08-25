import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/processes/[id] - 获取单个工艺流程详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const process = await prisma.process.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            productCode: true,
            name: true,
            description: true
          }
        },
        steps: {
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
            },
            _count: {
              select: {
                actions: true
              }
            }
          },
          orderBy: { sequence: 'asc' }
        },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            productionNumber: true,
            quantity: true,
            status: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 10 // 只显示最近10个订单
        },
        _count: {
          select: {
            steps: true,
            orders: true
          }
        }
      }
    });

    if (!process) {
      return NextResponse.json(
        { success: false, error: '工艺流程不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: process
    });

  } catch (error) {
    console.error('获取工艺流程详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取工艺流程详情失败' },
      { status: 500 }
    );
  }
}

// PUT /api/processes/[id] - 更新工艺流程
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { processCode, name, productId, version, description, status, steps = [] } = body;

    // 验证工艺流程是否存在
    const existingProcess = await prisma.process.findUnique({
      where: { id }
    });

    if (!existingProcess) {
      return NextResponse.json(
        { success: false, error: '工艺流程不存在' },
        { status: 404 }
      );
    }

    // 检查工艺流程编码是否与其他流程冲突
    if (processCode && processCode !== existingProcess.processCode) {
      const conflictProcess = await prisma.process.findUnique({
        where: { processCode }
      });

      if (conflictProcess) {
        return NextResponse.json(
          { success: false, error: '工艺流程编码已存在' },
          { status: 400 }
        );
      }
    }

    // 验证产品是否存在
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId }
      });

      if (!product) {
        return NextResponse.json(
          { success: false, error: '指定的产品不存在' },
          { status: 400 }
        );
      }
    }

    // 更新工艺流程及其步骤
    const updatedProcess = await prisma.$transaction(async (tx) => {
      // 更新工艺流程基本信息
      const process = await tx.process.update({
        where: { id },
        data: {
          ...(processCode && { processCode }),
          ...(name && { name }),
          ...(productId && { productId }),
          ...(version && { version }),
          ...(description !== undefined && { description }),
          ...(status && { status })
        }
      });

      // 如果提供了steps数据，更新步骤和动作
      if (steps.length >= 0) {
        // 删除现有的步骤（动作会因为级联删除而自动删除）
        await tx.step.deleteMany({
          where: { processId: id }
        });

        // 创建新的步骤和动作
        for (const stepData of steps) {
          const step = await tx.step.create({
            data: {
              processId: id,
              stepCode: stepData.stepCode,
              name: stepData.name,
              workstationId: stepData.workstationId,
              sequence: stepData.sequence,
              description: stepData.description,
              estimatedTime: stepData.estimatedTime,
              isRequired: stepData.isRequired ?? true
            }
          });

          // 创建步骤的动作
          if (stepData.actions && stepData.actions.length > 0) {
            await tx.action.createMany({
              data: stepData.actions.map((actionData: any) => ({
                stepId: step.id,
                actionCode: actionData.actionCode,
                name: actionData.name,
                type: actionData.type,
                sequence: actionData.sequence,
                deviceId: actionData.deviceId,
                deviceAddress: actionData.deviceAddress,
                expectedValue: actionData.expectedValue,
                validationRule: actionData.validationRule,
                parameters: actionData.parameters,
                description: actionData.description,
                isRequired: actionData.isRequired ?? true,
                timeout: actionData.timeout,
                retryCount: actionData.retryCount ?? 0
              }))
            });
          }
        }
      }

      return process;
    });

    // 重新获取完整的工艺流程数据
    const fullProcess = await prisma.process.findUnique({
      where: { id },
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
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: fullProcess,
      message: '工艺流程更新成功'
    });

  } catch (error) {
    console.error('更新工艺流程失败:', error);
    return NextResponse.json(
      { success: false, error: '更新工艺流程失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/processes/[id] - 删除工艺流程
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 验证工艺流程是否存在
    const existingProcess = await prisma.process.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orders: true
          }
        }
      }
    });

    if (!existingProcess) {
      return NextResponse.json(
        { success: false, error: '工艺流程不存在' },
        { status: 404 }
      );
    }

    // 检查是否有关联的订单
    if (existingProcess._count.orders > 0) {
      return NextResponse.json(
        { success: false, error: '工艺流程已被订单使用，无法删除' },
        { status: 400 }
      );
    }

    // 删除工艺流程（步骤和动作会因为级联删除而自动删除）
    await prisma.process.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: '工艺流程删除成功'
    });

  } catch (error) {
    console.error('删除工艺流程失败:', error);
    return NextResponse.json(
      { success: false, error: '删除工艺流程失败' },
      { status: 500 }
    );
  }
}