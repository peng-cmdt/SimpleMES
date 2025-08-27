import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const template = await prisma.deviceTemplate.findUnique({
      where: { id },
      include: {
        workstationDevices: {
          include: {
            workstation: {
              select: {
                id: true,
                name: true,
                workstationId: true
              }
            }
          }
        }
      }
    })

    if (!template) {
      return NextResponse.json(
        { error: '设备模板不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: template
    })
  } catch (error) {
    console.error('Get device template error:', error)
    return NextResponse.json(
      { error: '获取设备模板失败' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // 检查请求体
    const contentType = request.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: '请求必须包含JSON内容' },
        { status: 400 }
      )
    }

    const body = await request.text()
    if (!body.trim()) {
      return NextResponse.json(
        { error: '请求体不能为空' },
        { status: 400 }
      )
    }

    let requestData
    try {
      requestData = JSON.parse(body)
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
      driver,
      description,
      capabilities,
      configSchema
    } = requestData

    // 检查模板是否存在
    const existingTemplate = await prisma.deviceTemplate.findUnique({
      where: { id }
    })

    if (!existingTemplate) {
      return NextResponse.json(
        { error: '设备模板不存在' },
        { status: 404 }
      )
    }

    // 更新设备模板
    const template = await prisma.deviceTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(brand !== undefined && { brand }),
        ...(model !== undefined && { model }),
        ...(driver !== undefined && { driver }),
        ...(description !== undefined && { description }),
        ...(capabilities !== undefined && { capabilities }),
        ...(configSchema !== undefined && { configSchema })
      },
      include: {
        _count: {
          select: { workstationDevices: true }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: template
    })
  } catch (error) {
    console.error('Update device template error:', error)
    return NextResponse.json(
      { error: '更新设备模板失败' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // 检查模板是否存在
    const template = await prisma.deviceTemplate.findUnique({
      where: { id },
      include: {
        _count: {
          select: { workstationDevices: true }
        }
      }
    })

    if (!template) {
      return NextResponse.json(
        { error: '设备模板不存在' },
        { status: 404 }
      )
    }

    // 检查是否有工位设备在使用此模板
    if (template._count.workstationDevices > 0) {
      return NextResponse.json(
        { error: `无法删除设备模板：仍有 ${template._count.workstationDevices} 个工位设备在使用此模板` },
        { status: 400 }
      )
    }

    // 删除设备模板
    await prisma.deviceTemplate.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: '设备模板删除成功'
    })
  } catch (error) {
    console.error('Delete device template error:', error)
    return NextResponse.json(
      { error: '删除设备模板失败' },
      { status: 500 }
    )
  }
}