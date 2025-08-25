import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/products/simple - 获取产品简要列表（用于下拉选择）
export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: {
        status: 'active'
      },
      select: {
        id: true,
        productCode: true,
        name: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      data: products
    });

  } catch (error) {
    console.error('获取产品简要列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取产品简要列表失败' },
      { status: 500 }
    );
  }
}