import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeFile } from 'fs/promises'
import { join } from 'path'

// 上传用户头像
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id
    const data = await request.formData()
    const file: File | null = data.get('avatar') as unknown as File

    if (!file) {
      return NextResponse.json(
        { error: '没有上传文件' },
        { status: 400 }
      )
    }

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: '文件必须是图片格式' },
        { status: 400 }
      )
    }

    // 验证文件大小 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: '文件大小不能超过5MB' },
        { status: 400 }
      )
    }

    // 验证用户存在
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 生成文件名
    const fileExtension = file.name.split('.').pop()
    const fileName = `avatar_${userId}_${Date.now()}.${fileExtension}`
    
    // 保存文件到 public/uploads/avatars 目录
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'avatars')
    const filePath = join(uploadDir, fileName)
    
    // 确保目录存在
    const fs = require('fs')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    await writeFile(filePath, buffer)
    
    // 生成访问URL
    const avatarUrl = `/uploads/avatars/${fileName}`

    // 更新用户头像URL
    await prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl }
    })

    return NextResponse.json({
      message: '头像上传成功',
      avatarUrl: avatarUrl
    })

  } catch (error) {
    console.error('Upload avatar error:', error)
    return NextResponse.json(
      { error: '头像上传失败' },
      { status: 500 }
    )
  }
}