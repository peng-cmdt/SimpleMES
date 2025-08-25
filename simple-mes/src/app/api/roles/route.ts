import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 获取角色列表
export async function GET(request: NextRequest) {
  try {
    const roles = await prisma.role.findMany({
      include: {
        _count: {
          select: {
            userRoles: true,
            rolePermissions: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      roles
    })

  } catch (error) {
    console.error('Get roles error:', error)
    return NextResponse.json(
      { error: '获取角色列表失败' },
      { status: 500 }
    )
  }
}

// 创建角色
export async function POST(request: NextRequest) {
  try {
    const { name, description, permissions } = await request.json()

    if (!name || !description) {
      return NextResponse.json(
        { error: '角色名称和描述是必需的' },
        { status: 400 }
      )
    }

    // 检查角色名是否已存在
    const existingRole = await prisma.role.findUnique({
      where: { name }
    })

    if (existingRole) {
      return NextResponse.json(
        { error: '角色名称已存在' },
        { status: 400 }
      )
    }

    // 创建角色
    const role = await prisma.role.create({
      data: {
        name,
        description
      }
    })

    // 分配权限
    if (permissions && permissions.length > 0) {
      await Promise.all(
        permissions.map((permissionId: string) =>
          prisma.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId
            }
          })
        )
      )
    }

    return NextResponse.json({
      success: true,
      role
    }, { status: 201 })

  } catch (error) {
    console.error('Create role error:', error)
    return NextResponse.json(
      { error: '创建角色失败' },
      { status: 500 }
    )
  }
}