import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - 获取单个步骤模板的详细信息（包含动作模板和条件）
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const stepTemplate = await prisma.stepTemplate.findUnique({
      where: { id: params.id },
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
      }
    });

    if (!stepTemplate) {
      return NextResponse.json(
        { success: false, error: '步骤模板不存在' },
        { status: 404 }
      );
    }

    // 处理动作模板数据，将parameters中的字段恢复到顶层
    const processedActionTemplates = stepTemplate.actionTemplates.map((action: any) => {
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

    const processedStepTemplate = {
      ...stepTemplate,
      actionTemplates: processedActionTemplates
    };

    return NextResponse.json({
      success: true,
      data: { stepTemplate: processedStepTemplate },
    });
  } catch (error) {
    console.error('获取步骤模板详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取步骤模板详情失败' },
      { status: 500 }
    );
  }
}