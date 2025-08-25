import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { clientId } = await request.json()

    if (!clientId) {
      return NextResponse.json(
        { error: '缺少客户端ID' },
        { status: 400 }
      )
    }

    // 更新客户端的最后连接时间
    await prisma.client.update({
      where: { id: clientId },
      data: {
        lastConnected: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Heartbeat error:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
}