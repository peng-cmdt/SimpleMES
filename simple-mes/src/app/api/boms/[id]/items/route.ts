import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 获取BOM及其物料项目
    const bomWithItems = await prisma.bOM.findUnique({
      where: { id },
      include: {
        bomItems: {
          orderBy: {
            itemCode: 'asc'
          }
        }
      }
    })

    if (!bomWithItems) {
      return NextResponse.json(
        { error: 'BOM不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      bomItems: bomWithItems.bomItems
    })

  } catch (error) {
    console.error('Get BOM items error:', error)
    return NextResponse.json(
      { error: '获取BOM物料清单失败' },
      { status: 500 }
    )
  }
}