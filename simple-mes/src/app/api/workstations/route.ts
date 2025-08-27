import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const workstations = await prisma.workstation.findMany({
      include: {
        devices: true, // 旧架构设备
        workstationDevices: { // 新架构设备
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // 转换工位设备数据格式以兼容前端，支持新旧架构
    const workstationsWithDevices = workstations.map(ws => {
      let allDevices = [];

      // 处理旧架构设备
      if (ws.devices && ws.devices.length > 0) {
        allDevices.push(...ws.devices.map(device => ({
          id: device.id,
          deviceId: device.deviceId,
          name: device.name,
          type: device.type,
          brand: device.brand || '',
          model: device.model || '',
          status: device.status || 'offline',
          ipAddress: device.ipAddress || '',
          port: device.port || 502,
          workstationId: device.workstationId
        })));
      }

      // 处理新架构设备
      if (ws.workstationDevices && ws.workstationDevices.length > 0) {
        allDevices.push(...ws.workstationDevices.map(wd => ({
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
        })));
      }

      return {
        ...ws,
        devices: allDevices,
        workstationDevices: undefined  // 删除原始字段
      };
    })

    return NextResponse.json({
      success: true,
      workstations: workstationsWithDevices
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
    console.error('Create workstation error:', error)
    return NextResponse.json(
      { error: '创建工位失败' },
      { status: 500 }
    )
  }
}