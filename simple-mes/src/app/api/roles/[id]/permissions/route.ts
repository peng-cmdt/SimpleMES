import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: { id: string }
}

// 获取角色的权限列表
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId: params.id },
      include: {
        permission: true
      }
    })

    const permissions = rolePermissions.map(rp => rp.permission)

    return NextResponse.json({
      permissions
    })

  } catch (error) {
    console.error('Get role permissions error:', error)
    return NextResponse.json(
      { error: '获取角色权限失败' },
      { status: 500 }
    )
  }
}