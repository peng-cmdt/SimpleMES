import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: { id: string }
}

// 获取单个客户端
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const client = await prisma.client.findUnique({
      where: { id: params.id }
    })

    if (!client) {
      return NextResponse.json(
        { error: '客户端不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({ client })

  } catch (error) {
    console.error('Get client error:', error)
    return NextResponse.json(
      { error: '获取客户端信息失败' },
      { status: 500 }
    )
  }
}

// 更新客户端
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { clientId, name, configuredIp, settings, status } = await request.json()

    // 检查客户端是否存在
    const existingClient = await prisma.client.findUnique({
      where: { id: params.id }
    })

    if (!existingClient) {
      return NextResponse.json(
        { error: '客户端不存在' },
        { status: 404 }
      )
    }

    // 如果要更新客户端ID，检查是否重复
    if (clientId && clientId !== existingClient.clientId) {
      const duplicateClient = await prisma.client.findUnique({
        where: { clientId }
      })
      if (duplicateClient) {
        return NextResponse.json(
          { error: '客户端ID已存在' },
          { status: 400 }
        )
      }
    }

    // 准备更新数据
    const updateData: any = {}
    if (clientId) updateData.clientId = clientId
    if (name) updateData.name = name
    if (configuredIp) updateData.configuredIp = configuredIp
    if (settings !== undefined) updateData.settings = settings
    if (status) updateData.status = status

    // 更新客户端
    const client = await prisma.client.update({
      where: { id: params.id },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      client
    })

  } catch (error) {
    console.error('Update client error:', error)
    return NextResponse.json(
      { error: '更新客户端失败' },
      { status: 500 }
    )
  }
}

// 删除客户端
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // 检查客户端是否存在
    const existingClient = await prisma.client.findUnique({
      where: { id: params.id }
    })

    if (!existingClient) {
      return NextResponse.json(
        { error: '客户端不存在' },
        { status: 404 }
      )
    }

    // 删除客户端
    await prisma.client.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      success: true,
      message: '客户端已删除'
    })

  } catch (error) {
    console.error('Delete client error:', error)
    return NextResponse.json(
      { error: '删除客户端失败' },
      { status: 500 }
    )
  }
}