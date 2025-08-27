import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const type = searchParams.get('type') // 可选的设备类型过滤
    const search = searchParams.get('search') // 搜索关键词
    
    const offset = (page - 1) * limit

    // 构建查询条件
    const where: any = {}
    if (type) {
      where.type = type
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    // 获取设备模板
    const [templates, total] = await Promise.all([
      prisma.deviceTemplate.findMany({
        where,
        skip: offset,
        take: limit,
        include: {
          _count: {
            select: { workstationDevices: true }
          }
        },
        orderBy: [
          { type: 'asc' },
          { brand: 'asc' },
          { model: 'asc' }
        ]
      }),
      prisma.deviceTemplate.count({ where })
    ])

    return NextResponse.json({
      success: true,
      data: {
        templates,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    console.error('Get device templates error:', error)
    return NextResponse.json(
      { error: '获取设备模板失败' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      templateId,
      name,
      type,
      brand,
      model,
      driver,
      description,
      capabilities,
      configSchema
    } = await request.json()

    // 验证必填字段
    if (!templateId || !name || !type) {
      return NextResponse.json(
        { error: '模板ID、名称和类型为必填字段' },
        { status: 400 }
      )
    }

    // 检查模板ID是否已存在
    const existing = await prisma.deviceTemplate.findUnique({
      where: { templateId }
    })

    if (existing) {
      return NextResponse.json(
        { error: '模板ID已存在' },
        { status: 409 }
      )
    }

    // 创建设备模板
    const template = await prisma.deviceTemplate.create({
      data: {
        templateId,
        name,
        type,
        brand,
        model,
        driver,
        description,
        capabilities,
        configSchema
      }
    })

    return NextResponse.json({
      success: true,
      data: template
    })
  } catch (error) {
    console.error('Create device template error:', error)
    return NextResponse.json(
      { error: '创建设备模板失败' },
      { status: 500 }
    )
  }
}