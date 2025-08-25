import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/products/[id] - 获取单个产品详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        boms: {
          select: {
            id: true,
            bomCode: true,
            name: true,
            version: true,
            status: true,
            createdAt: true,
            _count: {
              select: {
                bomItems: true,
                orders: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        processes: {
          select: {
            id: true,
            processCode: true,
            name: true,
            version: true,
            status: true,
            createdAt: true,
            _count: {
              select: {
                steps: true,
                orders: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            productionNumber: true,
            quantity: true,
            status: true,
            plannedDate: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 10 // 只显示最近10个订单
        },
        _count: {
          select: {
            boms: true,
            processes: true,
            orders: true
          }
        }
      }
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: '产品不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: product
    });

  } catch (error) {
    console.error('获取产品详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取产品详情失败' },
      { status: 500 }
    );
  }
}

// PUT /api/products/[id] - 更新产品
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { 
      productCode, 
      name, 
      description, 
      version, 
      status,
      workstationIds = []
    } = body;

    // 验证产品是否存在
    const existingProduct = await prisma.product.findUnique({
      where: { id }
    });

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: '产品不存在' },
        { status: 404 }
      );
    }

    // 检查产品编码是否与其他产品冲突
    if (productCode && productCode !== existingProduct.productCode) {
      const conflictProduct = await prisma.product.findUnique({
        where: { productCode }
      });

      if (conflictProduct) {
        return NextResponse.json(
          { success: false, error: '产品编码已存在' },
          { status: 400 }
        );
      }
    }

    // 验证工位是否存在
    if (Array.isArray(workstationIds) && workstationIds.length > 0) {
      const workstations = await prisma.workstation.findMany({
        where: { id: { in: workstationIds } }
      });

      if (workstations.length !== workstationIds.length) {
        return NextResponse.json(
          { success: false, error: '选择的工位中包含无效的工位' },
          { status: 400 }
        );
      }
    }

    // 使用事务更新产品和工位关联
    const updatedProduct = await prisma.$transaction(async (tx) => {
      // 更新产品基本信息
      const updated = await tx.product.update({
        where: { id },
        data: {
          ...(productCode && { productCode }),
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(version && { version }),
          ...(status && { status })
        }
      });

      // 如果提供了工位ID数组，更新工位关联
      if (Array.isArray(workstationIds)) {
        // 删除现有的工位关联
        await tx.productWorkstation.deleteMany({
          where: { productId: id }
        });

        // 创建新的工位关联
        for (let i = 0; i < workstationIds.length; i++) {
          await tx.productWorkstation.create({
            data: {
              productId: id,
              workstationId: workstationIds[i],
              sequence: i + 1
            }
          });
        }
      }

      // 返回更新后的产品（包含工位信息）
      return await tx.product.findUnique({
        where: { id },
        include: {
          productWorkstations: {
            include: {
              workstation: {
                select: {
                  id: true,
                  workstationId: true,
                  name: true,
                  type: true
                }
              }
            },
            orderBy: { sequence: 'asc' }
          }
        }
      });
    });

    return NextResponse.json({
      success: true,
      data: updatedProduct,
      message: '产品更新成功'
    });

  } catch (error) {
    console.error('更新产品失败:', error);
    return NextResponse.json(
      { success: false, error: '更新产品失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/products/[id] - 删除产品
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 验证产品是否存在
    const existingProduct = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            boms: true,
            processes: true,
            orders: true
          }
        }
      }
    });

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: '产品不存在' },
        { status: 404 }
      );
    }

    // 检查是否有关联的数据
    const hasRelatedData = 
      existingProduct._count.boms > 0 ||
      existingProduct._count.processes > 0 ||
      existingProduct._count.orders > 0;

    if (hasRelatedData) {
      return NextResponse.json(
        { success: false, error: '产品已被BOM、工艺流程或订单使用，无法删除' },
        { status: 400 }
      );
    }

    // 删除产品
    await prisma.product.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: '产品删除成功'
    });

  } catch (error) {
    console.error('删除产品失败:', error);
    return NextResponse.json(
      { success: false, error: '删除产品失败' },
      { status: 500 }
    );
  }
}