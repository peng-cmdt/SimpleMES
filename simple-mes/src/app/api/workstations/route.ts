import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const workstations = await prisma.workstation.findMany({
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      workstations
    })
  } catch (error) {
    console.error('Get workstations error:', error)
    return NextResponse.json(
      { error: '获取工位列表失败' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
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

    // 检查工位ID是否已存在
    const existingWorkstation = await prisma.workstation.findUnique({
      where: { workstationId }
    })

    if (existingWorkstation) {
      return NextResponse.json(
        { error: '工位ID已存在' },
        { status: 400 }
      )
    }

    const workstation = await prisma.workstation.create({
      data: {
        workstationId,
        name,
        description: description || null,
        location: location || null,
        configuredIp,
        settings: settings || {},
        status: 'offline',
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
    console.error('Create workstation error:', error)
    return NextResponse.json(
      { error: '创建工位失败' },
      { status: 500 }
    )
  }
}