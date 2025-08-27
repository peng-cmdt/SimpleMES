import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const device = await prisma.device.findUnique({
      where: { id },
      include: {
        workstation: {
          select: {
            id: true,
            name: true,
            workstationId: true,
          }
        }
      }
    })

    if (!device) {
      return NextResponse.json(
        { error: '设备不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      device
    })
  } catch (error) {
    console.error('Get device error:', error)
    return NextResponse.json(
      { error: '获取设备信息失败' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 检查请求体是否为空
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: '请求必须包含JSON内容' },
        { status: 400 }
      )
    }

    const body = await request.text();
    if (!body.trim()) {
      return NextResponse.json(
        { error: '请求体不能为空' },
        { status: 400 }
      )
    }

    let requestData;
    try {
      requestData = JSON.parse(body);
    } catch (parseError) {
      return NextResponse.json(
        { error: '无效的JSON格式' },
        { status: 400 }
      )
    }

    const {
      name,
      type,
      brand,
      model,
      description,
      driver
    } = requestData

    // 检查设备是否存在
    const existingDevice = await prisma.device.findUnique({
      where: { id }
    })

    if (!existingDevice) {
      return NextResponse.json(
        { error: '设备不存在' },
        { status: 404 }
      )
    }

    const device = await prisma.device.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(brand !== undefined && { brand: brand || null }),
        ...(model !== undefined && { model: model || null }),
        ...(description !== undefined && { description: description || null }),
        ...(driver !== undefined && { driver: driver || null })
      },
      include: {
        workstation: {
          select: {
            id: true,
            name: true,
            workstationId: true,
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      device
    })
  } catch (error) {
    console.error('Update device error:', error)
    return NextResponse.json(
      { error: '更新设备失败' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 检查设备是否存在
    const device = await prisma.device.findUnique({
      where: { id },
      include: {
        actionLogs: true,
        actions: true
      }
    })

    if (!device) {
      return NextResponse.json(
        { error: '设备不存在' },
        { status: 404 }
      )
    }

    // 使用事务来确保完整删除
    await prisma.$transaction(async (tx) => {
      // 1. 删除相关的ActionLog记录
      if (device.actionLogs.length > 0) {
        await tx.actionLog.deleteMany({
          where: { deviceId: id }
        })
      }

      // 2. 清理相关的Action记录中的deviceId引用
      if (device.actions.length > 0) {
        await tx.action.updateMany({
          where: { deviceId: id },
          data: { deviceId: null }
        })
      }

      // 3. 删除设备
      await tx.device.delete({
        where: { id }
      })
    })

    return NextResponse.json({
      success: true,
      message: '设备删除成功'
    })
  } catch (error) {
    console.error('Delete device error:', error)
    
    // 更详细的错误信息
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: '无法删除设备：设备仍被其他记录引用。请先清理相关数据。' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: `删除设备失败: ${error.message}` },
      { status: 500 }
    )
  }
}