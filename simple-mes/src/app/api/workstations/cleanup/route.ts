import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    // 清理超过10分钟没有心跳的工位状态
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
    
    await prisma.workstation.updateMany({
      where: {
        OR: [
          {
            lastConnected: {
              lt: tenMinutesAgo
            },
            status: 'online'
          },
          {
            lastConnected: null,
            status: 'online'
          }
        ]
      },
      data: {
        status: 'offline',
        currentIp: null
      }
    })

    return NextResponse.json({
      success: true,
      message: '工位状态清理完成'
    })
  } catch (error) {
    console.error('Workstation cleanup error:', error)
    return NextResponse.json(
      { error: '工位状态清理失败' },
      { status: 500 }
    )
  }
}