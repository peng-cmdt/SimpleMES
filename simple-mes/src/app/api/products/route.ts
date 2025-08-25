import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/products - 获取产品列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');

    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: any = {};
    
    if (search) {
      where.OR = [
        { productCode: { contains: search } },
        { name: { contains: search } },
        { description: { contains: search } }
      ];
    }
    
    if (status) {
      where.status = status;
    }

    // 获取总数
    const total = await prisma.product.count({ where });

    // 获取产品列表
    const products = await prisma.product.findMany({
      where,
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
        },
        _count: {
          select: {
            boms: true,
            processes: true,
            orders: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });

    return NextResponse.json({
      success: true,
      data: {
        products,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('获取产品列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取产品列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/products - 创建新产品
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      productCode, 
      name, 
      description, 
      version = '1.0', 
      status = 'active',
      workstationIds = []
    } = body;

    // 验证必填字段
    if (!productCode || !name) {
      return NextResponse.json(
        { success: false, error: '产品编码和名称不能为空' },
        { status: 400 }
      );
    }

    // 验证工位选择
    if (!Array.isArray(workstationIds) || workstationIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '至少需要选择一个工位' },
        { status: 400 }
      );
    }

    // 检查产品编码是否已存在
    const existingProduct = await prisma.product.findUnique({
      where: { productCode }
    });

    if (existingProduct) {
      return NextResponse.json(
        { success: false, error: '产品编码已存在' },
        { status: 400 }
      );
    }

    // 验证工位是否存在
    const workstations = await prisma.workstation.findMany({
      where: { id: { in: workstationIds } }
    });

    if (workstations.length !== workstationIds.length) {
      return NextResponse.json(
        { success: false, error: '选择的工位中包含无效的工位' },
        { status: 400 }
      );
    }

    // 使用事务创建产品和工位关联
    const product = await prisma.$transaction(async (tx) => {
      // 创建产品
      const newProduct = await tx.product.create({
        data: {
          productCode,
          name,
          description,
          version,
          status
        }
      });

      // 创建产品工位关联（按顺序）
      for (let i = 0; i < workstationIds.length; i++) {
        await tx.productWorkstation.create({
          data: {
            productId: newProduct.id,
            workstationId: workstationIds[i],
            sequence: i + 1
          }
        });
      }

      // 返回带有工位信息的产品
      return await tx.product.findUnique({
        where: { id: newProduct.id },
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
      data: product,
      message: '产品创建成功'
    });

  } catch (error) {
    console.error('创建产品失败:', error);
    return NextResponse.json(
      { success: false, error: '创建产品失败' },
      { status: 500 }
    );
  }
}