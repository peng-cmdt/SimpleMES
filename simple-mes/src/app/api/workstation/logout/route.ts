import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, workstationId, username } = await request.json();

    if (!sessionId && !workstationId) {
      return NextResponse.json({ error: 'SessionId or WorkstationId is required' }, { status: 400 });
    }

    let session;

    // 通过sessionId查找会话
    if (sessionId) {
      session = await prisma.workstationSession.findUnique({
        where: { 
          sessionId,
          isActive: true
        }
      });
    } 
    // 通过workstationId查找活跃会话
    else if (workstationId) {
      const workstation = await prisma.workstation.findUnique({
        where: { workstationId }
      });

      if (!workstation) {
        return NextResponse.json({ error: 'Workstation not found' }, { status: 404 });
      }

      session = await prisma.workstationSession.findFirst({
        where: {
          workstationId: workstation.id,
          isActive: true,
          logoutTime: null
        },
        orderBy: {
          loginTime: 'desc'
        }
      });
    }

    if (!session) {
      return NextResponse.json({ 
        success: true,
        message: 'No active session found'
      });
    }

    // 结束会话
    await prisma.workstationSession.update({
      where: { id: session.id },
      data: {
        isActive: false,
        logoutTime: new Date(),
        settings: {
          ...((session.settings as any) || {}),
          logoutReason: 'normal_logout',
          loggedOutBy: username || session.username
        }
      }
    });

    // 如果有C#设备服务，通知服务结束会话
    try {
      await fetch('http://localhost:5000/api/workstation/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workstationId: workstationId || session.workstation?.workstationId,
          sessionId: session.sessionId,
          reason: 'normal_logout'
        })
      });
    } catch (error) {
      console.error('Error notifying C# service about logout:', error);
      // 不影响登出流程
    }

    // 更新工位状态为离线
    if (workstationId || session.workstationId) {
      try {
        await prisma.workstation.update({
          where: { 
            id: session.workstationId
          },
          data: {
            status: 'offline'
          }
        });
      } catch (error) {
        console.error('Error updating workstation status:', error);
      }
    }

    return NextResponse.json({
      success: true,
      sessionId: session.sessionId,
      logoutTime: new Date().toISOString(),
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Error during workstation logout:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}