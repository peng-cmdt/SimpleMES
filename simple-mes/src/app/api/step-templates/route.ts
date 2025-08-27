import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - 获取所有步骤模板
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    
    const skip = (page - 1) * limit;
    
    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { stepCode: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [stepTemplatesRaw, total] = await Promise.all([
      prisma.stepTemplate.findMany({
        where,
        include: {
          workstation: {
            select: {
              id: true,
              workstationId: true,
              name: true,
              type: true
            }
          },
          actionTemplates: {
            orderBy: { actionCode: 'asc' }
          },
          conditions: {
            orderBy: { createdAt: 'asc' }
          },
          _count: {
            select: {
              actionTemplates: true,
              steps: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.stepTemplate.count({ where })
    ]);

    // 处理步骤模板数据，将parameters中的字段恢复到顶层
    const stepTemplates = stepTemplatesRaw.map(template => {
      const processedActionTemplates = template.actionTemplates.map(action => {
        const parameters = action.parameters as any || {};
        
        return {
          ...action,
          // 从parameters中恢复前端所需的字段
          deviceId: parameters.deviceId,
          sensorType: parameters.sensorType,
          sensor: parameters.sensor,
          sensorValue: parameters.sensorValue,
          sensorInit: parameters.sensorInit,
          nameLocal: parameters.nameLocal,
          componentType: parameters.componentType,
          maxExecutionTime: parameters.maxExecutionTime,
          expectedExecutionTime: parameters.expectedExecutionTime,
          idleTime: parameters.idleTime,
          okPin: parameters.okPin,
          errorPin: parameters.errorPin,
          dSign: parameters.dSign,
          sSign: parameters.sSign,
          actionAfterError: parameters.actionAfterError,
          image: parameters.image,
          imageWidth: parameters.imageWidth,
          imageHeight: parameters.imageHeight,
          fullSizeImage: parameters.fullSizeImage,
          imagePosition: parameters.imagePosition,
          soundFile: parameters.soundFile
        };
      });

      return {
        ...template,
        actionTemplates: processedActionTemplates
      };
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        stepTemplates,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error('获取步骤模板失败:', error);
    return NextResponse.json(
      { success: false, error: '获取步骤模板失败' },
      { status: 500 }
    );
  }
}

// POST - 创建新步骤模板
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      stepCode,
      name,
      workstationId,
      description,
      instructions,
      image,
      actionTemplates = []
    } = body;

    // 检查步骤编码是否已存在
    const existingTemplate = await prisma.stepTemplate.findUnique({
      where: { stepCode }
    });

    if (existingTemplate) {
      return NextResponse.json(
        { success: false, error: '步骤编码已存在' },
        { status: 400 }
      );
    }

    const stepTemplate = await prisma.stepTemplate.create({
      data: {
        stepCode,
        name,
        workstationId: workstationId || null,
        description: description || null,
        instructions: instructions || null,
        image: image || null,
        actionTemplates: {
          create: actionTemplates.map((action: any, index: number) => ({
            actionCode: action.actionCode || `${stepCode}-A${index + 1}`,
            name: action.name,
            type: action.type,
            category: action.category,
            deviceType: action.deviceType,
            deviceAddress: action.deviceAddress,
            expectedValue: action.expectedValue,
            validationRule: action.validationRule,
            parameters: action.parameters,
            description: action.description,
            instructions: action.instructions,
            isRequired: action.isRequired ?? true,
            timeout: action.timeout,
            retryCount: action.retryCount ?? 0,
          }))
        }
      },
      include: {
        workstation: true,
        actionTemplates: true,
        conditions: {
          orderBy: { createdAt: 'asc' }
        },
        _count: {
          select: {
            actionTemplates: true,
            steps: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: { stepTemplate },
    });
  } catch (error) {
    console.error('创建步骤模板失败:', error);
    return NextResponse.json(
      { success: false, error: '创建步骤模板失败' },
      { status: 500 }
    );
  }
}