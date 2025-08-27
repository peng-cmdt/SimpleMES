import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/processes/[id]/details - 获取工艺流程详细信息（包含步骤和动作）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const process = await prisma.process.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            productCode: true,
            name: true
          }
        },
        steps: {
          include: {
            workstation: {
              select: {
                id: true,
                workstationId: true,
                name: true,
                type: true
              }
            },
            stepTemplate: {
              select: {
                id: true,
                stepCode: true,
                name: true
              }
            },
            actions: {
              include: {
                device: {
                  select: {
                    id: true,
                    deviceId: true,
                    name: true,
                    type: true
                  }
                }
              },
              orderBy: { sequence: 'asc' }
            }
          },
          orderBy: { sequence: 'asc' }
        },
        _count: {
          select: {
            steps: true,
            orders: true
          }
        }
      }
    });

    if (!process) {
      return NextResponse.json(
        { success: false, error: '工艺流程不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: process
    });

  } catch (error) {
    console.error('获取工艺流程详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取工艺流程详情失败' },
      { status: 500 }
    );
  }
}