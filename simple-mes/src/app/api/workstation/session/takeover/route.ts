import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { workstationId, newUsername, forceLogout = true, preserveWorkState } = await request.json();

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

    if (!activeSession) {
      return NextResponse.json({ 
        success: true,
        message: 'No active session found, can proceed with login'
      });
    }

    if (forceLogout) {
      // 使用事务确保原子性操作
      const result = await prisma.$transaction(async (tx) => {
        // 强制结束当前活跃的会话
        const updatedSession = await tx.workstationSession.update({
          where: { id: activeSession.id },
          data: {
            isActive: false,
            logoutTime: new Date(),
            settings: {
              ...((activeSession.settings as any) || {}),
              forcedLogout: true,
              loggedOutBy: newUsername,
              logoutReason: 'Takeover by new user'
            }
          }
        });

        // 确保没有其他活跃会话
        await tx.workstationSession.updateMany({
          where: {
            workstationId: workstation.id,
            isActive: true,
            logoutTime: null,
            id: {
              not: activeSession.id
            }
          },
          data: {
            isActive: false,
            logoutTime: new Date(),
            settings: {
              forcedLogout: true,
              loggedOutBy: newUsername,
              logoutReason: 'Takeover cleanup'
            }
          }
        });

        return updatedSession;
      });

      // 如果有C#设备服务，通知服务结束会话
      try {
        await fetch('http://localhost:5001/api/workstation/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workstationId,
            sessionId: activeSession.sessionId,
            reason: 'forced_logout'
          })
        });
      } catch (error) {
        console.error('Error notifying C# service about forced logout:', error);
      }

      // 添加短暂延迟确保数据库事务完全提交
      await new Promise(resolve => setTimeout(resolve, 100));

      return NextResponse.json({
        success: true,
        previousSession: {
          sessionId: activeSession.sessionId,
          username: activeSession.username,
          loginTime: activeSession.loginTime,
          logoutTime: result.logoutTime,
          reason: 'Forced logout due to takeover'
        },
        message: 'Previous session terminated successfully'
      });
    }

    return NextResponse.json({ 
      success: false,
      error: 'Takeover not executed',
      activeSession: {
        sessionId: activeSession.sessionId,
        username: activeSession.username,
        loginTime: activeSession.loginTime,
        lastActivity: activeSession.lastActivity
      }
    });

  } catch (error) {
    console.error('Error taking over workstation session:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}