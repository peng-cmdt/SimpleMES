import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/workstation-devices - 获取所有工位设备实例
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workstationId = searchParams.get('workstationId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    
    const offset = (page - 1) * limit

    // 构建查询条件
    const where: any = {}
    if (workstationId) {
      where.workstationId = workstationId
    }

    // 获取工位设备实例
    const [devices, total] = await Promise.all([
      prisma.workstationDevice.findMany({
        where,
        skip: offset,
        take: limit,
        include: {
          template: {
            select: {
              id: true,
              templateId: true,
              name: true,
              type: true,
              brand: true,
              model: true,
              capabilities: true,
              configSchema: true
            }
          },
          workstation: {
            select: {
              id: true,
              workstationId: true,
              name: true
            }
          }
        },
        orderBy: [
          { workstation: { name: 'asc' } },
          { template: { type: 'asc' } },
          { displayName: 'asc' }
        ]
      }),
      prisma.workstationDevice.count({ where })
    ])

    return NextResponse.json({
      success: true,
      data: {
        devices,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    console.error('Get workstation devices error:', error)
    return NextResponse.json(
      { error: '获取工位设备失败' },
      { status: 500 }
    )
  }
}

// POST /api/workstation-devices - 创建工位设备实例
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: '请求必须包含JSON内容' },
        { status: 400 }
      )
    }

    const body = await request.text()
    if (!body.trim()) {
      return NextResponse.json(
        { error: '请求体不能为空' },
        { status: 400 }
      )
    }

    let requestData
    try {
      requestData = JSON.parse(body)
    } catch (parseError) {
      return NextResponse.json(
        { error: '无效的JSON格式' },
        { status: 400 }
      )
    }

    const {
      workstationId,
      templateId,
      displayName,
      ipAddress,
      port,
      protocol,
      connectionString,
      config,
      status
    } = requestData

    // 验证必填字段
    if (!workstationId || !templateId || !displayName || !ipAddress || !port) {
      return NextResponse.json(
        { error: '工位ID、模板ID、显示名称、IP地址和端口为必填项' },
        { status: 400 }
      )
    }

    // 检查工位是否存在
    const workstation = await prisma.workstation.findUnique({
      where: { id: workstationId }
    })

    if (!workstation) {
      return NextResponse.json(
        { error: '工位不存在' },
        { status: 404 }
      )
    }

    // 检查设备模板是否存在
    const template = await prisma.deviceTemplate.findUnique({
      where: { id: templateId }
    })

    if (!template) {
      return NextResponse.json(
        { error: '设备模板不存在' },
        { status: 404 }
      )
    }

    // 检查同一工位内IP地址和端口是否冲突
    const existingDevice = await prisma.workstationDevice.findFirst({
      where: {
        workstationId,
        ipAddress,
        port
      }
    })

    if (existingDevice) {
      return NextResponse.json(
        { error: '此IP地址和端口在工位内已被其他设备使用' },
        { status: 409 }
      )
    }

    // 创建工位设备实例
    const device = await prisma.workstationDevice.create({
      data: {
        workstationId,
        templateId,
        displayName,
        ipAddress,
        port,
        protocol: protocol || 'TCP',
        connectionString,
        config: config || {},
        status: status || 'OFFLINE',
        isOnline: false
      },
      include: {
        template: {
          select: {
            id: true,
            templateId: true,
            name: true,
            type: true,
            brand: true,
            model: true,
            driver: true,
            capabilities: true,
            configSchema: true
          }
        },
        workstation: {
          select: {
            id: true,
            workstationId: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: device
    })
  } catch (error) {
    console.error('Create workstation device error:', error)
    return NextResponse.json(
      { error: '创建工位设备失败' },
      { status: 500 }
    )
  }
}