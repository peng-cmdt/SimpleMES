import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    // 查找超过5分钟没有活动的在线客户端
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const result = await prisma.client.updateMany({
      where: {
        status: {
          in: ['online', 'unauthorized']
        },
        lastConnected: {
          lt: fiveMinutesAgo
        }
      },
      data: {
        status: 'offline',
        currentIp: null
      }
    });

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
      message: `已将 ${result.count} 个客户端设置为离线状态`
    });

  } catch (error) {
    console.error('Cleanup inactive clients error:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}