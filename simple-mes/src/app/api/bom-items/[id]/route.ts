import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { itemCode, itemName, quantity, unit, description } = body

    // 验证必需字段
    if (!itemCode || !itemName || quantity === undefined || !unit) {
      return NextResponse.json(
        { error: '缺少必需字段' },
        { status: 400 }
      )
    }

    // 检查BOM项目是否存在
    const existingItem = await prisma.bOMItem.findUnique({
      where: { id }
    })

    if (!existingItem) {
      return NextResponse.json(
        { error: 'BOM物料项目不存在' },
        { status: 404 }
      )
    }

    // 如果物料编码发生变化，检查新编码是否与同BOM的其他项目冲突
    if (itemCode !== existingItem.itemCode) {
      const conflictItem = await prisma.bOMItem.findFirst({
        where: {
          bomId: existingItem.bomId,
          itemCode: itemCode,
          id: { not: id }
        }
      })

      if (conflictItem) {
        return NextResponse.json(
          { error: '物料编码在此BOM中已存在' },
          { status: 409 }
        )
      }
    }

    // 更新BOM项目
    const updatedItem = await prisma.bOMItem.update({
      where: { id },
      data: {
        itemCode,
        itemName,
        quantity: parseFloat(quantity.toString()),
        unit,
        description: description || null
      }
    })

    return NextResponse.json({
      success: true,
      bomItem: updatedItem
    })

  } catch (error) {
    console.error('Update BOM item error:', error)
    return NextResponse.json(
      { error: '更新BOM物料失败' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 检查BOM项目是否存在
    const existingItem = await prisma.bOMItem.findUnique({
      where: { id }
    })

    if (!existingItem) {
      return NextResponse.json(
        { error: 'BOM物料项目不存在' },
        { status: 404 }
      )
    }

    // 删除BOM项目
    await prisma.bOMItem.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'BOM物料删除成功'
    })

  } catch (error) {
    console.error('Delete BOM item error:', error)
    return NextResponse.json(
      { error: '删除BOM物料失败' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const bomItem = await prisma.bOMItem.findUnique({
      where: { id },
      include: {
        bom: {
          select: {
            id: true,
            bomCode: true,
            name: true,
            version: true
          }
        }
      }
    })

    if (!bomItem) {
      return NextResponse.json(
        { error: 'BOM物料项目不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      bomItem
    })

  } catch (error) {
    console.error('Get BOM item error:', error)
    return NextResponse.json(
      { error: '获取BOM物料失败' },
      { status: 500 }
    )
  }
}