import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 获取权限列表
export async function GET(request: NextRequest) {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: [
        { resource: 'asc' },
        { action: 'asc' }
      ]
    })

    return NextResponse.json({
      permissions
    })

  } catch (error) {
    console.error('Get permissions error:', error)
    return NextResponse.json(
      { error: '获取权限列表失败' },
      { status: 500 }
    )
  }
}