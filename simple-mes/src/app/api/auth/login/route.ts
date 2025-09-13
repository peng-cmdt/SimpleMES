import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { username, password, userType, selectedClientId } = await request.json()

    if (!username || !password || !userType) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      )
    }

    console.log('Login attempt:', { username, userType, passwordLength: password?.length });
    console.log('User found:', { 
      id: user.id, 
      username: user.username, 
      role: user.role,
      userRolesCount: user.userRoles.length,
      passwordHashLength: user.password?.length 
    });

    // 验证密码
    console.log('Starting password comparison...');
    const isPasswordValid = await bcrypt.compare(password, user.password)
    console.log('Password comparison result:', isPasswordValid);
    if (!isPasswordValid) {
      console.log('Password validation failed for user:', username, 'Password:', password);
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      )
    }

    console.log('Password validated successfully for user:', username);

    // 获取用户权限
    const permissions = user.userRoles.flatMap(userRole =>
      userRole.role.rolePermissions.map(rp => rp.permission.name)
    )

    // 验证用户类型 - 支持新旧角色系统
    const userRoles = user.userRoles.map(ur => ur.role.name);
    const hasClientRole = userRoles.includes('CLIENT') || user.role === 'CLIENT';
    const hasAdminRole = userRoles.includes('ADMIN') || user.role === 'ADMIN';
    const hasSupervisorRole = userRoles.includes('SUPERVISOR') || user.role === 'SUPERVISOR';
    const hasEngineerRole = userRoles.includes('ENGINEER') || user.role === 'ENGINEER';
    const hasOperatorRole = userRoles.includes('OPERATOR') || user.role === 'OPERATOR';
    
    console.log('Role validation:', {
      userRoles,
      directRole: user.role,
      hasClientRole,
      hasAdminRole,
      hasSupervisorRole,
      hasEngineerRole,
      hasOperatorRole,
      requestedType: userType,
      permissions
    });
    
    if (userType === 'admin' && !hasAdminRole) {
      console.log('Admin access denied for user:', username);
      return NextResponse.json(
        { error: '无权限访问管理后台' },
        { status: 403 }
      )
    }

    // 客户端访问权限验证 - 基于权限系统检查是否有工位控制权限
    if (userType === 'client') {
      const hasWorkstationControlPermission = permissions.includes('workstations:control')
      if (!hasWorkstationControlPermission) {
        console.log('Client access denied for user:', username, 'Missing workstations:control permission');
        return NextResponse.json(
          { error: '权限不足，无法访问客户端系统。请联系管理员为您分配工位操作权限。' },
          { status: 403 }
        )
      }
    }

    // 如果是客户端登录，使用简化的认证流程（IP匹配由前端处理）
    if (userType === 'client') {
      // 客户端登录成功，返回用户信息
      // IP匹配和工位选择逻辑由前端客户端登录页面处理
      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          permissions
        }
      })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions
      }
    })

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
}