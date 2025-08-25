import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unassignedOnly = searchParams.get('unassigned') === 'true';
    const assignedOnly = searchParams.get('assigned') === 'true';
    const workstationId = searchParams.get('workstationId');
    
    // 构建查询条件
    let whereCondition = {};
    if (unassignedOnly) {
      whereCondition = { workstationId: null }; // 只获取未分配给工位的设备模板
    } else if (assignedOnly) {
      whereCondition = { workstationId: { not: null } }; // 只获取已分配给工位的设备实例
    } else if (workstationId) {
      whereCondition = { workstationId: workstationId }; // 只获取特定工位的设备
    }
    // 否则获取所有设备

    const devices = await prisma.device.findMany({
      where: whereCondition,
      include: {
        workstation: {
          select: {
            id: true,
            name: true,
            workstationId: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      devices
    })
  } catch (error) {
    console.error('Get devices error:', error)
    return NextResponse.json(
      { error: '获取设备列表失败' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      name,
      type,
      brand,
      model,
      description,
      driver,
      workstationId,
      ipAddress,
      port,
      protocol,
      connectionString,
      plcParams
    } = await request.json()

    if (!name || !type) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    // 准备设备设置，包含PLC参数
    let settings = null
    if (plcParams && Object.keys(plcParams).length > 0) {
      settings = plcParams
    }

    const device = await prisma.device.create({
      data: {
        // deviceId 将由数据库自动生成 (使用 @default(cuid()))
        name,
        type,
        brand: brand || null,
        model: model || null,
        description: description || null,
        driver: driver || null,
        // 支持工位关联和具体网络配置
        workstationId: workstationId || null,
        ipAddress: ipAddress || null,
        port: port || null,
        protocol: protocol || null,
        connectionString: connectionString || null,
        settings: settings, // 存储PLC参数
        status: 'OFFLINE',
        isOnline: false
      },
      include: {
        workstation: {
          select: {
            id: true,
            name: true,
            workstationId: true,
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      device
    })
  } catch (error) {
    console.error('Create device error:', error)
    return NextResponse.json(
      { error: '创建设备失败' },
      { status: 500 }
    )
  }
}