import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;

    const workstation = await prisma.workstation.findUnique({
      where: { id },
      include: {
        devices: {
          select: {
            id: true,
            deviceId: true,
            name: true,
            type: true,
            brand: true,
            model: true,
            status: true,
            ipAddress: true,
            port: true
          }
        }
      }
    })

    if (!workstation) {
      return NextResponse.json(
        { error: '工位不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      workstation
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
        devices: {
          select: {
            id: true,
            deviceId: true,
            name: true,
            type: true,
            brand: true,
            model: true,
            status: true,
            ipAddress: true,
            port: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      workstation
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
        devices: true
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