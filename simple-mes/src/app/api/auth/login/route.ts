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

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      )
    }

    // 验证用户类型
    if (userType === 'admin' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '无权限访问管理后台' },
        { status: 403 }
      )
    }

    if (userType === 'client' && user.role !== 'CLIENT') {
      return NextResponse.json(
        { error: '无权限访问客户端' },
        { status: 403 }
      )
    }

    // 获取用户权限
    const permissions = user.userRoles.flatMap(userRole =>
      userRole.role.rolePermissions.map(rp => rp.permission.name)
    )

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