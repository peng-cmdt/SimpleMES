import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/processes - 获取工艺流程列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const productId = searchParams.get('productId');
    const status = searchParams.get('status');

    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: any = {};
    
    if (search) {
      where.OR = [
        { processCode: { contains: search } },
        { name: { contains: search } },
        { description: { contains: search } }
      ];
    }
    
    if (productId) {
      where.productId = productId;
    }
    
    if (status) {
      where.status = status;
    }

    // 获取总数
    const total = await prisma.process.count({ where });

    // 获取工艺流程列表 (轻量级版本)
    const processes = await prisma.process.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            productCode: true,
            name: true
          }
        },
        _count: {
          select: {
            steps: true,
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
        processes,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('获取工艺流程列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取工艺流程列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/processes - 创建新工艺流程
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { processCode, name, productId, version = '1.0', description, status = 'active' } = body;

    // 验证必填字段
    if (!processCode || !name || !productId) {
      return NextResponse.json(
        { success: false, error: '工艺流程编码、名称和产品ID不能为空' },
        { status: 400 }
      );
    }

    // 检查工艺流程编码是否已存在
    const existingProcess = await prisma.process.findUnique({
      where: { processCode }
    });

    if (existingProcess) {
      return NextResponse.json(
        { success: false, error: '工艺流程编码已存在' },
        { status: 400 }
      );
    }

    // 验证产品是否存在
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: '指定的产品不存在' },
        { status: 400 }
      );
    }

    // 创建工艺流程
    const process = await prisma.process.create({
      data: {
        processCode,
        name,
        productId,
        version,
        description,
        status
      },
      include: {
        product: {
          select: {
            id: true,
            productCode: true,
            name: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: process,
      message: '工艺流程创建成功'
    });

  } catch (error) {
    console.error('创建工艺流程失败:', error);
    return NextResponse.json(
      { success: false, error: '创建工艺流程失败' },
      { status: 500 }
    );
  }
}