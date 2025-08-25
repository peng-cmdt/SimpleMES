import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json({ error: 'SessionId is required' }, { status: 400 });
    }

    // 查找会话
    const session = await prisma.workstationSession.findUnique({
      where: { sessionId },
      include: {
        workstation: true
      }
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 调用C#设备通信服务进行工位登出
    try {
      const logoutResponse = await fetch(`http://localhost:8080/api/workstation/logout/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!logoutResponse.ok) {
        console.error('Failed to logout from C# service');
      }
    } catch (error) {
      console.error('Error calling C# logout service:', error);
    }

    // 更新本地会话状态
    await prisma.workstationSession.update({
      where: { sessionId },
      data: {
        logoutTime: new Date(),
        isActive: false
      }
    });

    // 更新工位状态
    if (session.workstation) {
      await prisma.workstation.update({
        where: { id: session.workstation.id },
        data: {
          status: 'offline'
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Workstation logout successful'
    });

  } catch (error) {
    console.error('Error in workstation logout:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}