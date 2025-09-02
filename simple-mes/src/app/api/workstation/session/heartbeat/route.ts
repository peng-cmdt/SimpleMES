import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'SessionId is required' }, { status: 400 });
    }

    // 查找会话
    const session = await prisma.workstationSession.findUnique({
      where: { 
        sessionId,
        isActive: true
      },
      include: {
        workstation: {
          select: {
            workstationId: true,
            name: true
          }
        }
      }
    });

    if (!session) {
      return NextResponse.json({ 
        success: false,
        error: 'SESSION_TERMINATED',
        message: 'Session not found or has been terminated',
        shouldLogout: true
      }, { status: 404 });
    }

    // 检查会话是否被强制退出
    const sessionSettings = session.settings as any;
    if (sessionSettings?.forcedLogout) {
      return NextResponse.json({ 
        success: false,
        error: 'SESSION_TAKEN_OVER',
        message: 'Session has been taken over by another user',
        shouldLogout: true,
        takenOverBy: sessionSettings.loggedOutBy,
        takenOverAt: session.logoutTime
      }, { status: 403 });
    }

    // 更新最后活动时间
    await prisma.workstationSession.update({
      where: { id: session.id },
      data: {
        lastActivity: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Heartbeat updated',
      sessionId: sessionId,
      workstation: session.workstation,
      lastActivity: new Date().toISOString(),
      isActive: true
    });

  } catch (error) {
    console.error('Error updating session heartbeat:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}