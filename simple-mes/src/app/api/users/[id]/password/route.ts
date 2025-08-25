import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// 修改用户密码
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { currentPassword, newPassword } = await request.json()
    const userId = params.id

    // 获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      )
    }

    // 验证当前密码
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: '当前密码错误' },
        { status: 400 }
      )
    }

    // 加密新密码
    const saltRounds = 10
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds)

    // 更新密码
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword }
    })

    return NextResponse.json({
      message: '密码修改成功'
    })

  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json(
      { error: '修改密码失败' },
      { status: 500 }
    )
  }
}