import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const startTime = performance.now();
    const { username, password, userType, selectedClientId } = await request.json()

    if (!username || !password || !userType) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    // 第一步：只查询用户基本信息和密码（性能优化）
    const userQueryStart = performance.now();
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        password: true,
        email: true,
        role: true
      }
    });
    const userQueryTime = performance.now() - userQueryStart;

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
      passwordHashLength: user.password?.length
    });

    // 第二步：验证密码（在获取权限之前）
    console.log('Starting password comparison...');
    const passwordStart = performance.now();

    // 性能优化：对于开发环境，考虑使用更快的验证方式
    let isPasswordValid = false;
    if (process.env.NODE_ENV === 'development' && password === 'admin') {
      // 开发环境快速验证（仅限特定密码）
      isPasswordValid = user.password && await bcrypt.compare(password, user.password);
    } else {
      // 生产环境标准验证
      isPasswordValid = await bcrypt.compare(password, user.password);
    }

    const passwordTime = performance.now() - passwordStart;
    console.log('Password comparison result:', isPasswordValid, `(${passwordTime.toFixed(2)}ms)`);
    if (!isPasswordValid) {
      console.log('Password validation failed for user:', username, 'Password:', password);
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      )
    }

    console.log('Password validated successfully for user:', username);

    // 第三步：密码验证成功后才查询权限（性能优化）
    const permissionsStart = performance.now();
    const userWithRoles = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        userRoles: {
          select: {
            role: {
              select: {
                name: true,
                rolePermissions: {
                  select: {
                    permission: {
                      select: {
                        name: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const permissions = userWithRoles?.userRoles.flatMap(userRole =>
      userRole.role.rolePermissions.map(rp => rp.permission.name)
    ) || [];

    const permissionsTime = performance.now() - permissionsStart;

    // 验证用户类型 - 支持新旧角色系统
    const userRoles = userWithRoles?.userRoles.map(ur => ur.role.name) || [];
    const hasClientRole = userRoles.includes('CLIENT') || user.role === 'CLIENT';
    const hasAdminRole = userRoles.includes('ADMIN') || user.role === 'ADMIN';
    const hasSupervisorRole = userRoles.includes('SUPERVISOR') || user.role === 'SUPERVISOR';
    const hasEngineerRole = userRoles.includes('ENGINEER') || user.role === 'ENGINEER';
    const hasOperatorRole = userRoles.includes('OPERATOR') || user.role === 'OPERATOR';
    
    const totalTime = performance.now() - startTime;
    console.log('Performance metrics:', {
      userQuery: `${userQueryTime.toFixed(2)}ms`,
      passwordCheck: `${passwordTime.toFixed(2)}ms`,
      permissionsQuery: `${permissionsTime.toFixed(2)}ms`,
      totalTime: `${totalTime.toFixed(2)}ms`
    });

    console.log('Role validation:', {
      userRoles,
      directRole: user.role,
      hasClientRole,
      hasAdminRole,
      hasSupervisorRole,
      hasEngineerRole,
      hasOperatorRole,
      requestedType: userType,
      permissionsCount: permissions.length
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
      console.log(`Client login successful for ${username} in ${totalTime.toFixed(2)}ms`);
      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          permissions
        },
        performance: {
          totalTime: Math.round(totalTime),
          breakdown: {
            userQuery: Math.round(userQueryTime),
            passwordCheck: Math.round(passwordTime),
            permissionsQuery: Math.round(permissionsTime)
          }
        }
      })
    }

    console.log(`Admin login successful for ${username} in ${totalTime.toFixed(2)}ms`);
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions
      },
      performance: {
        totalTime: Math.round(totalTime),
        breakdown: {
          userQuery: Math.round(userQueryTime),
          passwordCheck: Math.round(passwordTime),
          permissionsQuery: Math.round(permissionsTime)
        }
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