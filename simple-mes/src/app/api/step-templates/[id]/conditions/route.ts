import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET - 获取步骤模板的所有条件
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    
    const conditions = await prisma.stepCondition.findMany({
      where: { stepTemplateId: id },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json({
      success: true,
      data: { conditions },
    });
  } catch (error) {
    console.error('获取步骤条件失败:', error);
    return NextResponse.json(
      { success: false, error: '获取步骤条件失败' },
      { status: 500 }
    );
  }
}

// POST - 为步骤模板添加新条件
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const { type, value, description } = body;

    if (!type || !value) {
      return NextResponse.json(
        { success: false, error: '条件类型和值不能为空' },
        { status: 400 }
      );
    }

    // 验证步骤模板是否存在
    const stepTemplate = await prisma.stepTemplate.findUnique({
      where: { id }
    });

    if (!stepTemplate) {
      return NextResponse.json(
        { success: false, error: '步骤模板不存在' },
        { status: 404 }
      );
    }

    const condition = await prisma.stepCondition.create({
      data: {
        stepTemplateId: id,
        type,
        value,
        description
      }
    });

    return NextResponse.json({
      success: true,
      data: { condition },
    });
  } catch (error) {
    console.error('创建步骤条件失败:', error);
    return NextResponse.json(
      { success: false, error: '创建步骤条件失败' },
      { status: 500 }
    );
  }
}

// PUT - 批量更新步骤模板的条件
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const { conditions } = body;

    if (!Array.isArray(conditions)) {
      return NextResponse.json(
        { success: false, error: '条件数据格式错误' },
        { status: 400 }
      );
    }

    // 验证步骤模板是否存在
    const stepTemplate = await prisma.stepTemplate.findUnique({
      where: { id }
    });

    if (!stepTemplate) {
      return NextResponse.json(
        { success: false, error: '步骤模板不存在' },
        { status: 404 }
      );
    }

    // 使用事务处理批量更新
    const result = await prisma.$transaction(async (prisma) => {
      // 删除现有条件
      await prisma.stepCondition.deleteMany({
        where: { stepTemplateId: id }
      });

      // 创建新条件
      const newConditions = await Promise.all(
        conditions.map((condition: any) => 
          prisma.stepCondition.create({
            data: {
              stepTemplateId: id,
              type: condition.type,
              value: condition.value,
              description: condition.description || null
            }
          })
        )
      );

      return newConditions;
    });

    return NextResponse.json({
      success: true,
      data: { conditions: result },
    });
  } catch (error) {
    console.error('更新步骤条件失败:', error);
    return NextResponse.json(
      { success: false, error: '更新步骤条件失败: ' + (error as Error).message },
      { status: 500 }
    );
  }
}