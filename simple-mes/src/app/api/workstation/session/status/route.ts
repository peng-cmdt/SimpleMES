import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'SessionId is required' }, { status: 400 });
    }

    // 只查询会话状态，不更新任何字段（轻量级检查）
    const session = await prisma.workstationSession.findUnique({
      where: {
        sessionId,
        isActive: true
      },
      select: {
        id: true,
        isActive: true,
        settings: true,
        logoutTime: true
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

    return NextResponse.json({
      success: true,
      message: 'Session is active',
      sessionId: sessionId,
      isActive: true
    });

  } catch (error) {
    console.error('Error checking session status:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}