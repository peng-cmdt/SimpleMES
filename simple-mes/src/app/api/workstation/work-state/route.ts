import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 保存工作状态
export async function POST(request: NextRequest) {
  try {
    const { workstationId, workState } = await request.json();

    if (!workstationId) {
      return NextResponse.json({ error: 'WorkstationId is required' }, { status: 400 });
    }

    // 验证工位是否存在
    const workstation = await prisma.workstation.findUnique({
      where: { workstationId }
    });

    if (!workstation) {
      return NextResponse.json({ error: 'Workstation not found' }, { status: 404 });
    }

    // 检查是否已存在工作状态
    const existingState = await prisma.workstationWorkState.findUnique({
      where: {
        workstationId: workstation.id
      }
    });

    let savedState;
    if (existingState) {
      // 更新现有状态
      savedState = await prisma.workstationWorkState.update({
        where: {
          workstationId: workstation.id
        },
        data: {
          workState: workState,
          updatedAt: new Date(),
          isActive: true
        }
      });
    } else {
      // 创建新状态
      savedState = await prisma.workstationWorkState.create({
        data: {
          workstationId: workstation.id,
          workState: workState,
          isActive: true
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Work state saved successfully',
      stateId: savedState.id,
      savedAt: savedState.updatedAt
    });

  } catch (error) {
    console.error('Error saving work state:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// 获取工作状态  
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workstationId = searchParams.get('workstationId');

    if (!workstationId) {
      return NextResponse.json({ error: 'WorkstationId is required' }, { status: 400 });
    }

    // 验证工位是否存在
    const workstation = await prisma.workstation.findUnique({
      where: { workstationId }
    });

    if (!workstation) {
      return NextResponse.json({ error: 'Workstation not found' }, { status: 404 });
    }

    // 查找活跃的工作状态
    const workState = await prisma.workstationWorkState.findUnique({
      where: {
        workstationId: workstation.id
      }
    });

    if (!workState || !workState.isActive) {
      return NextResponse.json({
        success: true,
        hasWorkState: false,
        message: 'No active work state found'
      });
    }

    return NextResponse.json({
      success: true,
      hasWorkState: true,
      workState: workState.workState,
      savedAt: workState.updatedAt,
      message: 'Work state retrieved successfully'
    });

  } catch (error) {
    console.error('Error retrieving work state:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// 清除工作状态
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workstationId = searchParams.get('workstationId');

    if (!workstationId) {
      return NextResponse.json({ error: 'WorkstationId is required' }, { status: 400 });
    }

    // 验证工位是否存在
    const workstation = await prisma.workstation.findUnique({
      where: { workstationId }
    });

    if (!workstation) {
      return NextResponse.json({ error: 'Workstation not found' }, { status: 404 });
    }

    // 标记工作状态为非活跃
    await prisma.workstationWorkState.updateMany({
      where: {
        workstationId: workstation.id,
        isActive: true
      },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Work state cleared successfully'
    });

  } catch (error) {
    console.error('Error clearing work state:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}