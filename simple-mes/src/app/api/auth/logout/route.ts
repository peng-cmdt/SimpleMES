import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    let clientId, userType;
    
    // 处理不同的内容类型
    const contentType = request.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      const body = await request.json();
      clientId = body.clientId;
      userType = body.userType;
    } else {
      // 处理sendBeacon发送的数据
      const text = await request.text();
      try {
        const parsed = JSON.parse(text);
        clientId = parsed.clientId;
        userType = parsed.userType;
      } catch {
        // 如果解析失败，从URL参数获取
        const url = new URL(request.url);
        clientId = url.searchParams.get('clientId');
        userType = url.searchParams.get('userType');
      }
    }

    if (userType === 'client' && clientId) {
      // 将客户端状态设置为离线
      await prisma.client.update({
        where: { id: clientId },
        data: {
          status: 'offline',
          currentIp: null,
          lastConnected: new Date()
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: '退出成功'
    })

  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
}