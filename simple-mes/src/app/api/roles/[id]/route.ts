import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: { id: string }
}

// 获取单个角色
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const role = await prisma.role.findUnique({
      where: { id: params.id },
      include: {
        rolePermissions: {
          include: {
            permission: true
          }
        }
      }
    })

    if (!role) {
      return NextResponse.json(
        { error: '角色不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({ role })

  } catch (error) {
    console.error('Get role error:', error)
    return NextResponse.json(
      { error: '获取角色信息失败' },
      { status: 500 }
    )
  }
}

// 更新角色
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { name, description, permissions } = await request.json()

    // 检查角色是否存在
    const existingRole = await prisma.role.findUnique({
      where: { id: params.id }
    })

    if (!existingRole) {
      return NextResponse.json(
        { error: '角色不存在' },
        { status: 404 }
      )
    }

    // 如果要更新角色名，检查是否重复
    if (name && name !== existingRole.name) {
      const duplicateRole = await prisma.role.findUnique({
        where: { name }
      })
      if (duplicateRole) {
        return NextResponse.json(
          { error: '角色名称已存在' },
          { status: 400 }
        )
      }
    }

    // 更新角色基本信息
    const updateData: any = {}
    if (name) updateData.name = name
    if (description) updateData.description = description

    const role = await prisma.role.update({
      where: { id: params.id },
      data: updateData
    })

    // 更新权限
    if (permissions !== undefined) {
      // 删除现有权限
      await prisma.rolePermission.deleteMany({
        where: { roleId: params.id }
      })

      // 添加新权限
      if (permissions.length > 0) {
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
    }

    return NextResponse.json({
      success: true,
      role
    })

  } catch (error) {
    console.error('Update role error:', error)
    return NextResponse.json(
      { error: '更新角色失败' },
      { status: 500 }
    )
  }
}

// 删除角色
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // 检查角色是否存在
    const existingRole = await prisma.role.findUnique({
      where: { id: params.id }
    })

    if (!existingRole) {
      return NextResponse.json(
        { error: '角色不存在' },
        { status: 404 }
      )
    }

    // 不能删除管理员角色
    if (existingRole.name === 'admin') {
      return NextResponse.json(
        { error: '不能删除管理员角色' },
        { status: 400 }
      )
    }

    // 检查是否有用户使用此角色
    const usersWithRole = await prisma.userRoleAssignment.findMany({
      where: { roleId: params.id }
    })

    if (usersWithRole.length > 0) {
      return NextResponse.json(
        { error: '该角色仍有用户使用，无法删除' },
        { status: 400 }
      )
    }

    // 删除角色
    await prisma.role.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      success: true,
      message: '角色已删除'
    })

  } catch (error) {
    console.error('Delete role error:', error)
    return NextResponse.json(
      { error: '删除角色失败' },
      { status: 500 }
    )
  }
}