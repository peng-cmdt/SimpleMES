import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { partId, partName, partNumber, quantity, sapDescription } = await request.json();
    const { id: orderId } = await params;

    if (!partName || !partNumber || !quantity || quantity <= 0) {
      return NextResponse.json(
        { success: false, error: '请提供完整的零件信息' },
        { status: 400 }
      );
    }

    // 获取订单信息
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { bom: true, product: true }
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: '订单不存在' },
        { status: 404 }
      );
    }

    let bomId = order.bomId;

    // 如果订单还没有BOM，先创建一个
    if (!bomId) {
      const newBom = await prisma.bOM.create({
        data: {
          bomCode: `BOM-${order.orderNumber}-${Date.now()}`,
          name: `${order.product.name} - ${order.orderNumber} BOM`,
          version: '1.0',
          description: `为订单 ${order.orderNumber} 自动创建的BOM`,
          productId: order.productId,
          status: 'active'
        }
      });

      // 更新订单关联到新创建的BOM
      await prisma.order.update({
        where: { id: orderId },
        data: { bomId: newBom.id }
      });

      bomId = newBom.id;
    }

    // 检查该零件是否已经存在于BOM中
    const existingBomItem = await prisma.bOMItem.findFirst({
      where: {
        bomId: bomId,
        OR: [
          { itemCode: partNumber },
          { itemName: partName }
        ]
      }
    });

    if (existingBomItem) {
      // 如果存在，更新数量
      const updatedBomItem = await prisma.bOMItem.update({
        where: { id: existingBomItem.id },
        data: {
          quantity: existingBomItem.quantity + quantity,
          description: sapDescription || existingBomItem.description
        }
      });

      return NextResponse.json({
        success: true,
        data: { bomItem: updatedBomItem },
        message: '零件数量已更新'
      });
    } else {
      // 如果不存在，创建新的BOM项
      const newBomItem = await prisma.bOMItem.create({
        data: {
          bomId: bomId,
          itemCode: partNumber,
          itemName: partName,
          quantity: quantity,
          unit: 'pcs', // 默认单位
          description: sapDescription || ''
        }
      });

      return NextResponse.json({
        success: true,
        data: { bomItem: newBomItem },
        message: '零件添加成功'
      });
    }

  } catch (error) {
    console.error('Add part to order error:', error);
    return NextResponse.json(
      { success: false, error: '添加零件失败' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    // 获取订单及其BOM信息
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        bom: {
          include: {
            bomItems: {
              orderBy: { createdAt: 'asc' }
            }
          }
        }
      }
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: '订单不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        bomItems: order.bom?.bomItems || []
      }
    });

  } catch (error) {
    console.error('Get order parts error:', error);
    return NextResponse.json(
      { success: false, error: '获取零件列表失败' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { bomItemId, quantity } = await request.json();
    const { id: orderId } = await params;

    if (!bomItemId || !quantity || quantity <= 0) {
      return NextResponse.json(
        { success: false, error: '请提供有效的BOM项ID和数量' },
        { status: 400 }
      );
    }

    // 获取订单信息
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { bom: true }
    });

    if (!order || !order.bom) {
      return NextResponse.json(
        { success: false, error: '订单或BOM不存在' },
        { status: 404 }
      );
    }

    // 更新BOM项数量
    const updatedBomItem = await prisma.bOMItem.update({
      where: { 
        id: bomItemId,
        bomId: order.bomId // 确保BOM项属于该订单
      },
      data: {
        quantity: quantity
      }
    });

    return NextResponse.json({
      success: true,
      data: { bomItem: updatedBomItem },
      message: '零件数量更新成功'
    });

  } catch (error) {
    console.error('Update part error:', error);
    return NextResponse.json(
      { success: false, error: '更新零件失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const url = new URL(request.url);
    const bomItemId = url.searchParams.get('bomItemId');
    const { id: orderId } = await params;

    if (!bomItemId) {
      return NextResponse.json(
        { success: false, error: '请提供BOM项ID' },
        { status: 400 }
      );
    }

    // 获取订单信息
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { bom: true }
    });

    if (!order || !order.bom) {
      return NextResponse.json(
        { success: false, error: '订单或BOM不存在' },
        { status: 404 }
      );
    }

    // 删除BOM项
    await prisma.bOMItem.delete({
      where: { 
        id: bomItemId,
        bomId: order.bomId // 确保BOM项属于该订单
      }
    });

    return NextResponse.json({
      success: true,
      message: '零件删除成功'
    });

  } catch (error) {
    console.error('Delete part error:', error);
    return NextResponse.json(
      { success: false, error: '删除零件失败' },
      { status: 500 }
    );
  }
}