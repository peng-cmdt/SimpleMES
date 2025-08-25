import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { bomId, itemCode, itemName, quantity, unit, description } = body

    // 验证必需字段
    if (!bomId || !itemCode || !itemName || quantity === undefined || !unit) {
      return NextResponse.json(
        { error: '缺少必需字段' },
        { status: 400 }
      )
    }

    // 检查BOM是否存在
    const bom = await prisma.bOM.findUnique({
      where: { id: bomId }
    })

    if (!bom) {
      return NextResponse.json(
        { error: 'BOM不存在' },
        { status: 404 }
      )
    }

    // 检查物料编码是否已存在于此BOM中
    const existingItem = await prisma.bOMItem.findFirst({
      where: {
        bomId: bomId,
        itemCode: itemCode
      }
    })

    if (existingItem) {
      return NextResponse.json(
        { error: '物料编码在此BOM中已存在' },
        { status: 409 }
      )
    }

    // 创建BOM项目
    const bomItem = await prisma.bOMItem.create({
      data: {
        bomId,
        itemCode,
        itemName,
        quantity: parseFloat(quantity.toString()),
        unit,
        description: description || null
      }
    })

    return NextResponse.json({
      success: true,
      bomItem
    })

  } catch (error) {
    console.error('Create BOM item error:', error)
    return NextResponse.json(
      { error: '创建BOM物料失败' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const bomId = searchParams.get('bomId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search')
    const skip = (page - 1) * limit

    const where: any = {}

    // 如果提供了bomId，只查询特定BOM的项目
    if (bomId) {
      where.bomId = bomId
    }

    // 如果提供了搜索条件
    if (search) {
      where.OR = [
        { itemCode: { contains: search } },
        { itemName: { contains: search } },
        { description: { contains: search } },
        { bom: { bomCode: { contains: search } } },
        { bom: { name: { contains: search } } }
      ]
    }

    const [bomItems, total] = await Promise.all([
      prisma.bOMItem.findMany({
        where,
        include: {
          bom: {
            select: {
              id: true,
              bomCode: true,
              name: true,
              version: true,
              description: true,
              status: true,
              createdAt: true
            }
          }
        },
        orderBy: [
          { bom: { bomCode: 'asc' } },
          { itemCode: 'asc' }
        ],
        skip,
        take: limit
      }),
      prisma.bOMItem.count({ where })
    ])

    return NextResponse.json({
      success: true,
      data: {
        bomItems,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('Get BOM items error:', error)
    return NextResponse.json(
      { error: '获取BOM物料列表失败' },
      { status: 500 }
    )
  }
}