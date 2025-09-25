import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - 获取单个步骤模板的详细信息（包含动作模板和条件）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const stepTemplate = await prisma.stepTemplate.findUnique({
      where: { id: resolvedParams.id },
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

// PUT - 更新步骤模板
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const body = await request.json();
    const {
      stepCode,
      name,
      workstationId,
      description,
      instructions,
      image,
      actionTemplates
    } = body;

    // 验证步骤模板是否存在
    const existingTemplate = await prisma.stepTemplate.findUnique({
      where: { id: resolvedParams.id }
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, error: '步骤模板不存在' },
        { status: 404 }
      );
    }

    // 使用事务来确保数据一致性
    const result = await prisma.$transaction(async (tx) => {
      // 更新步骤模板基本信息
      const updatedStepTemplate = await tx.stepTemplate.update({
        where: { id: resolvedParams.id },
        data: {
          stepCode,
          name,
          workstationId,
          description,
          instructions,
          image
        },
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

      // 如果提供了actionTemplates，更新相关的动作模板
      if (actionTemplates && Array.isArray(actionTemplates)) {
        // 获取现有的动作模板
        const existingActionTemplates = await tx.actionTemplate.findMany({
          where: { stepTemplateId: resolvedParams.id }
        });

        // 删除现有的动作模板（只删除属于这个步骤模板的）
        await tx.actionTemplate.deleteMany({
          where: { stepTemplateId: resolvedParams.id }
        });

        // 创建新的动作模板
        for (let i = 0; i < actionTemplates.length; i++) {
          const actionTemplate = actionTemplates[i];

          // 将特殊字段打包到parameters中，其他字段直接映射到数据库列
          const parameters = {
            deviceId: actionTemplate.deviceId,
            sensorType: actionTemplate.sensorType,
            sensor: actionTemplate.sensor,
            sensorValue: actionTemplate.sensorValue,
            sensorInit: actionTemplate.sensorInit,
            nameLocal: actionTemplate.nameLocal,
            componentType: actionTemplate.componentType,
            maxExecutionTime: actionTemplate.maxExecutionTime,
            expectedExecutionTime: actionTemplate.expectedExecutionTime,
            idleTime: actionTemplate.idleTime,
            okPin: actionTemplate.okPin,
            errorPin: actionTemplate.errorPin,
            dSign: actionTemplate.dSign,
            sSign: actionTemplate.sSign,
            actionAfterError: actionTemplate.actionAfterError,
            image: actionTemplate.image,
            imageWidth: actionTemplate.imageWidth,
            imageHeight: actionTemplate.imageHeight,
            fullSizeImage: actionTemplate.fullSizeImage,
            imagePosition: actionTemplate.imagePosition,
            soundFile: actionTemplate.soundFile
          };

          // 生成唯一的actionCode，如果原来的actionCode被其他使用了
          let actionCode = actionTemplate.actionCode;
          if (!actionCode) {
            // 如果没有actionCode，生成一个基于步骤模板和序号的
            actionCode = `${stepCode}_ACTION_${i + 1}`;
          }

          // 检查actionCode是否已被其他步骤模板使用
          let uniqueActionCode = actionCode;
          let counter = 1;
          while (true) {
            const existing = await tx.actionTemplate.findUnique({
              where: { actionCode: uniqueActionCode }
            });

            if (!existing) {
              break; // actionCode可用
            }

            // 生成新的actionCode
            uniqueActionCode = `${actionCode}_${counter}`;
            counter++;
          }

          // 映射前端ActionType到数据库枚举
          let dbActionType = actionTemplate.type || 'MANUAL_CONFIRM';
          if (dbActionType === 'PLC_READ' || dbActionType === 'PLC_WRITE') {
            dbActionType = dbActionType === 'PLC_READ' ? 'DEVICE_READ' : 'DEVICE_WRITE';
          } else if (dbActionType === 'SCAN_BARCODE') {
            dbActionType = 'BARCODE_SCAN';
          }

          await tx.actionTemplate.create({
            data: {
              stepTemplateId: resolvedParams.id,
              actionCode: uniqueActionCode,
              name: actionTemplate.name || '未命名动作',
              type: dbActionType,
              category: actionTemplate.category,
              deviceType: actionTemplate.deviceType,
              deviceAddress: actionTemplate.deviceAddress,
              expectedValue: actionTemplate.expectedValue,
              validationRule: actionTemplate.validationRule,
              description: actionTemplate.description,
              instructions: actionTemplate.instructions,
              isRequired: actionTemplate.isRequired ?? true,
              timeout: actionTemplate.timeout,
              retryCount: actionTemplate.retryCount ?? 0,
              parameters
            }
          });
        }
      }

      return updatedStepTemplate;
    });

    // 处理动作模板数据，将parameters中的字段恢复到顶层
    const processedActionTemplates = result.actionTemplates.map((action: any) => {
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

    const processedResult = {
      ...result,
      actionTemplates: processedActionTemplates
    };

    return NextResponse.json({
      success: true,
      data: { stepTemplate: processedResult }
    });

  } catch (error) {
    console.error('更新步骤模板失败:', error);
    return NextResponse.json(
      { success: false, error: '更新步骤模板失败' },
      { status: 500 }
    );
  }
}