import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: { id: string }
}

// 获取单个用户
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({ user })

  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json(
      { error: '获取用户信息失败' },
      { status: 500 }
    )
  }
}

// 更新用户
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { username, email, role, status, password } = await request.json()

    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id }
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      )
    }

    // 如果要更新用户名，检查是否重复
    if (username && username !== existingUser.username) {
      const duplicateUser = await prisma.user.findUnique({
        where: { username }
      })
      if (duplicateUser) {
        return NextResponse.json(
          { error: '用户名已存在' },
          { status: 400 }
        )
      }
    }

    // 准备更新数据
    const updateData: any = {}
    if (username) updateData.username = username
    if (email !== undefined) updateData.email = email
    if (role) updateData.role = role
    if (status) updateData.status = status

    // 如果要更新密码
    if (password) {
      updateData.password = await bcrypt.hash(password, 12)
    }

    // 更新用户
    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return NextResponse.json({
      success: true,
      user
    })

  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json(
      { error: '更新用户失败' },
      { status: 500 }
    )
  }
}

// 删除用户
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id }
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      )
    }

    // 不能删除管理员用户
    if (existingUser.role === 'ADMIN') {
      return NextResponse.json(
        { error: '不能删除管理员用户' },
        { status: 400 }
      )
    }

    // 删除用户
    await prisma.user.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      success: true,
      message: '用户已删除'
    })

  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json(
      { error: '删除用户失败' },
      { status: 500 }
    )
  }
}