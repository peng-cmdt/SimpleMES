import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/workstation-devices/:id - 获取工位设备实例详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const device = await prisma.workstationDevice.findUnique({
      where: { id },
      include: {
        template: true,
        workstation: {
          select: {
            id: true,
            workstationId: true,
            name: true
          }
        }
      }
    })

    if (!device) {
      return NextResponse.json(
        { error: '工位设备不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: device
    })
  } catch (error) {
    console.error('Get workstation device error:', error)
    return NextResponse.json(
      { error: '获取工位设备失败' },
      { status: 500 }
    )
  }
}

// PUT /api/workstation-devices/:id - 更新工位设备实例
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // 检查请求体
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
      displayName,
      ipAddress,
      port,
      protocol,
      connectionString,
      config,
      status,
      isOnline
    } = requestData

    // 检查设备是否存在
    const existingDevice = await prisma.workstationDevice.findUnique({
      where: { id }
    })

    if (!existingDevice) {
      return NextResponse.json(
        { error: '工位设备不存在' },
        { status: 404 }
      )
    }

    // 如果更新IP地址和端口，检查是否与同工位其他设备冲突
    if (ipAddress !== undefined && port !== undefined) {
      const conflictDevice = await prisma.workstationDevice.findFirst({
        where: {
          workstationId: existingDevice.workstationId,
          ipAddress,
          port,
          NOT: { id }
        }
      })

      if (conflictDevice) {
        return NextResponse.json(
          { error: '此IP地址和端口在工位内已被其他设备使用' },
          { status: 409 }
        )
      }
    }

    // 更新工位设备
    const device = await prisma.workstationDevice.update({
      where: { id },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(ipAddress !== undefined && { ipAddress }),
        ...(port !== undefined && { port }),
        ...(protocol !== undefined && { protocol }),
        ...(connectionString !== undefined && { connectionString }),
        ...(config !== undefined && { config }),
        ...(status !== undefined && { status }),
        ...(isOnline !== undefined && { isOnline })
      },
      include: {
        template: {
          select: {
            templateId: true,
            name: true,
            type: true,
            brand: true,
            model: true
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
    console.error('Update workstation device error:', error)
    return NextResponse.json(
      { error: '更新工位设备失败' },
      { status: 500 }
    )
  }
}

// DELETE /api/workstation-devices/:id - 删除工位设备实例
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // 检查设备是否存在
    const device = await prisma.workstationDevice.findUnique({
      where: { id }
    })

    if (!device) {
      return NextResponse.json(
        { error: '工位设备不存在' },
        { status: 404 }
      )
    }

    // 删除工位设备
    await prisma.workstationDevice.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: '工位设备删除成功'
    })

  } catch (error) {
    console.error('Delete workstation device error:', error)
    return NextResponse.json(
      { error: '删除工位设备失败' },
      { status: 500 }
    )
  }
}