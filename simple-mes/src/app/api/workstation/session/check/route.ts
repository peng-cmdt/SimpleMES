import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { workstationId } = await request.json();

    if (!workstationId) {
      return NextResponse.json({ error: 'WorkstationId is required' }, { status: 400 });
    }

    // 验证工位是否存在
    const workstation = await prisma.workstation.findUnique({
      where: { workstationId }
    });

    if (!workstation) {
      return NextResponse.json({ error: 'Workstation not found' }, { status: 404 });
    }

    // 查找活跃的会话
    const activeSession = await prisma.workstationSession.findFirst({
      where: {
        workstationId: workstation.id,
        isActive: true,
        logoutTime: null
      },
      orderBy: {
        loginTime: 'desc'
      }
    });

    if (activeSession) {
      // 检查会话是否超时（超过2小时视为超时）
      const sessionTimeout = 2 * 60 * 60 * 1000; // 2小时
      const isTimeout = new Date().getTime() - new Date(activeSession.lastActivity).getTime() > sessionTimeout;

      if (isTimeout) {
        // 会话超时，自动结束会话
        await prisma.workstationSession.update({
          where: { id: activeSession.id },
          data: {
            isActive: false,
            logoutTime: new Date()
          }
        });

        return NextResponse.json({
          success: true,
          hasActiveSession: false,
          canLogin: true,
          message: 'Previous session timeout, can login'
        });
      }

      // 有活跃会话
      return NextResponse.json({
        success: true,
        hasActiveSession: true,
        canLogin: false,
        activeSession: {
          sessionId: activeSession.sessionId,
          username: activeSession.username,
          loginTime: activeSession.loginTime,
          lastActivity: activeSession.lastActivity
        },
        message: 'Workstation has active session'
      });
    }

    // 没有活跃会话，可以登录
    return NextResponse.json({
      success: true,
      hasActiveSession: false,
      canLogin: true,
      message: 'No active session, can login'
    });

  } catch (error) {
    console.error('Error checking workstation session:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}