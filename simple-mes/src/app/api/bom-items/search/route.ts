import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!query || query.trim().length < 1) {
      return NextResponse.json({
        success: true,
        items: []
      })
    }

    // 搜索BOM物料项，支持物料编码和物料名称的模糊搜索
    const items = await prisma.bOMItem.findMany({
      where: {
        OR: [
          {
            itemCode: {
              contains: query.trim()
            }
          },
          {
            itemName: {
              contains: query.trim()
            }
          }
        ]
      },
      include: {
        bom: {
          select: {
            id: true,
            bomCode: true,
            name: true,
            version: true,
            product: {
              select: {
                id: true,
                name: true,
                productCode: true
              }
            }
          }
        }
      },
      orderBy: [
        {
          itemCode: 'asc'
        },
        {
          itemName: 'asc'
        }
      ],
      take: limit,
      distinct: ['itemCode', 'itemName'] // 去重相同的物料
    })

    // 对结果进行去重处理，合并相同物料编码的项目
    const uniqueItems = items.reduce((acc, item) => {
      const key = `${item.itemCode}-${item.itemName}`
      if (!acc.find(existing => `${existing.itemCode}-${existing.itemName}` === key)) {
        acc.push(item)
      }
      return acc
    }, [] as typeof items)

    return NextResponse.json({
      success: true,
      items: uniqueItems
    })

  } catch (error) {
    console.error('Search BOM items error:', error)
    return NextResponse.json(
      { error: '搜索物料失败' },
      { status: 500 }
    )
  }
}