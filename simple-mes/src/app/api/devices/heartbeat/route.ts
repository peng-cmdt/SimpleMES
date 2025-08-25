import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { deviceId, status, data } = await request.json()

    if (!deviceId) {
      return NextResponse.json(
        { error: '缺少设备ID' },
        { status: 400 }
      )
    }

    // 查找设备
    const device = await prisma.device.findUnique({
      where: { deviceId }
    })

    if (!device) {
      return NextResponse.json(
        { error: '设备不存在' },
        { status: 404 }
      )
    }

    // 更新设备状态和心跳时间
    await prisma.device.update({
      where: { id: device.id },
      data: {
        status: status || 'ONLINE',
        isOnline: true,
        lastHeartbeat: new Date(),
        lastConnected: new Date(),
        // 如果有设备数据，可以存储到settings字段
        settings: data ? { ...device.settings as any, lastData: data } : device.settings
      }
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Device heartbeat error:', error)
    return NextResponse.json(
      { error: '设备心跳更新失败' },
      { status: 500 }
    )
  }
}