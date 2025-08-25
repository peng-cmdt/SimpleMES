import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 获取客户端列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''

    const skip = (page - 1) * limit

    const where = search ? {
      OR: [
        { clientId: { contains: search } },
        { name: { contains: search } },
        { configuredIp: { contains: search } }
      ]
    } : {}

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.client.count({ where })
    ])

    return NextResponse.json({
      clients,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Get clients error:', error)
    return NextResponse.json(
      { error: '获取客户端列表失败' },
      { status: 500 }
    )
  }
}

// 创建客户端配置
export async function POST(request: NextRequest) {
  try {
    const { clientId, name, configuredIp, settings } = await request.json()

    if (!clientId || !name || !configuredIp) {
      return NextResponse.json(
        { error: '客户端ID、名称和IP地址是必需的' },
        { status: 400 }
      )
    }

    // 检查客户端ID是否已存在
    const existingClient = await prisma.client.findUnique({
      where: { clientId }
    })

    if (existingClient) {
      return NextResponse.json(
        { error: '客户端ID已存在' },
        { status: 400 }
      )
    }

    // 创建客户端配置
    const client = await prisma.client.create({
      data: {
        clientId,
        name,
        configuredIp,
        settings: settings || {},
        status: 'offline'
      }
    })

    return NextResponse.json({
      success: true,
      client
    }, { status: 201 })

  } catch (error) {
    console.error('Create client error:', error)
    return NextResponse.json(
      { error: '创建客户端配置失败' },
      { status: 500 }
    )
  }
}