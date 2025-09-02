import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;

    // 尝试通过ID或workstationId查找工位
    const workstation = await prisma.workstation.findFirst({
      where: {
        OR: [
          { id }, // 数据库主键
          { workstationId: id } // 工位标识符
        ]
      },
      include: {
        workstationDevices: {
          include: {
            template: {
              select: {
                id: true,
                templateId: true,
                name: true,
                type: true,
                brand: true,
                model: true,
                driver: true
              }
            }
          }
        }
      }
    })

    if (!workstation) {
      console.log(`Workstation ID not found in database: ${id}`)
      return NextResponse.json(
        { error: '工位不存在' },
        { status: 404 }
      )
    }

    // 转换工位设备数据格式以兼容前端
    const workstationWithDevices = {
      ...workstation,
      devices: workstation.workstationDevices?.map(wd => ({
        id: wd.id,
        deviceId: wd.instanceId,
        name: wd.displayName,
        type: wd.template.type,
        brand: wd.template.brand,
        model: wd.template.model,
        status: wd.status,
        ipAddress: wd.ipAddress,
        port: wd.port,
        workstationId: wd.workstationId
      })) || []
    }

    // 删除原始的workstationDevices字段
    delete workstationWithDevices.workstationDevices

    return NextResponse.json({
      success: true,
      workstation: workstationWithDevices
    })
  } catch (error) {
    console.error('Get workstation error:', error)
    return NextResponse.json(
      { error: '获取工位信息失败' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const {
      workstationId,
      name,
      description,
      location,
      configuredIp,
      settings
    } = await request.json()

    if (!workstationId || !name || !configuredIp) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    const existingWorkstation = await prisma.workstation.findUnique({
      where: { id }
    })

    if (!existingWorkstation) {
      return NextResponse.json(
        { error: '工位不存在' },
        { status: 404 }
      )
    }

    if (workstationId !== existingWorkstation.workstationId) {
      const duplicateWorkstation = await prisma.workstation.findUnique({
        where: { workstationId }
      })

      if (duplicateWorkstation) {
        return NextResponse.json(
          { error: '工位ID已被其他工位使用' },
          { status: 400 }
        )
      }
    }

    const workstation = await prisma.workstation.update({
      where: { id },
      data: {
        workstationId,
        name,
        description: description || null,
        location: location || null,
        configuredIp,
        settings: settings || {}
      },
      include: {
        workstationDevices: {
          include: {
            template: {
              select: {
                id: true,
                templateId: true,
                name: true,
                type: true,
                brand: true,
                model: true,
                driver: true
              }
            }
          }
        }
      }
    })

    // 转换工位设备数据格式以兼容前端
    const workstationWithDevices = {
      ...workstation,
      devices: workstation.workstationDevices?.map(wd => ({
        id: wd.id,
        deviceId: wd.instanceId,
        name: wd.displayName,
        type: wd.template.type,
        brand: wd.template.brand,
        model: wd.template.model,
        status: wd.status,
        ipAddress: wd.ipAddress,
        port: wd.port,
        workstationId: wd.workstationId
      })) || []
    }

    // 删除原始的workstationDevices字段
    delete workstationWithDevices.workstationDevices

    return NextResponse.json({
      success: true,
      workstation: workstationWithDevices
    })
  } catch (error) {
    console.error('Update workstation error:', error)
    return NextResponse.json(
      { error: '更新工位失败' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;

    const existingWorkstation = await prisma.workstation.findUnique({
      where: { id },
      include: {
        workstationDevices: true
      }
    })

    if (!existingWorkstation) {
      return NextResponse.json(
        { error: '工位不存在' },
        { status: 404 }
      )
    }

    await prisma.workstation.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: '工位删除成功'
    })
  } catch (error) {
    console.error('Delete workstation error:', error)
    return NextResponse.json(
      { error: '删除工位失败' },
      { status: 500 }
    )
  }
}