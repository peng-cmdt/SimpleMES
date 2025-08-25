import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    // 查找超过2分钟没有心跳的在线设备
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    
    const result = await prisma.device.updateMany({
      where: {
        isOnline: true,
        OR: [
          {
            lastHeartbeat: {
              lt: twoMinutesAgo
            }
          },
          {
            lastHeartbeat: null,
            lastConnected: {
              lt: twoMinutesAgo
            }
          }
        ]
      },
      data: {
        status: 'OFFLINE',
        isOnline: false
      }
    });

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
      message: `已将 ${result.count} 个设备设置为离线状态`
    });

  } catch (error) {
    console.error('Cleanup inactive devices error:', error);
    return NextResponse.json(
      { error: '清理非活跃设备失败' },
      { status: 500 }
    );
  }
}