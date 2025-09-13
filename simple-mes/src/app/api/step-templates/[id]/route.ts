import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET - 获取单个步骤模板
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    
    const stepTemplate = await prisma.stepTemplate.findUnique({
      where: { id },
      include: {
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
    const processedActionTemplates = stepTemplate.actionTemplates.map(action => {
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
    console.error('获取步骤模板失败:', error);
    return NextResponse.json(
      { success: false, error: '获取步骤模板失败' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
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

    // 检查步骤编码是否已被其他模板使用
    const existingTemplate = await prisma.stepTemplate.findFirst({
      where: { 
        stepCode,
        id: { not: id }
      }
    });

    if (existingTemplate) {
      return NextResponse.json(
        { success: false, error: '步骤编码已被其他模板使用' },
        { status: 400 }
      );
    }

    // 动作类型映射函数
    const mapActionType = (frontendType: string): string => {
      const typeMapping: { [key: string]: string } = {
        'PLC_READ': 'DEVICE_READ',
        'PLC_WRITE': 'DEVICE_WRITE',
        'MANUAL_CONFIRM': 'MANUAL_CONFIRM',
        'DATA_VALIDATION': 'DATA_VALIDATION',
        'DELAY_WAIT': 'DELAY_WAIT',
        'BARCODE_SCAN': 'BARCODE_SCAN',
        'CAMERA_CHECK': 'CAMERA_CHECK',
        'CUSTOM_SCRIPT': 'CUSTOM_SCRIPT'
      };
      return typeMapping[frontendType] || 'DEVICE_READ'; // 默认为设备读取
    };

    const stepTemplate = await prisma.$transaction(async (tx) => {
      // 先获取现有的步骤模板数据
      const existingTemplate = await tx.stepTemplate.findUnique({
        where: { id },
        include: { actionTemplates: true }
      });

      if (!existingTemplate) {
        throw new Error('步骤模板不存在');
      }

      // 删除现有的动作模板
      await tx.actionTemplate.deleteMany({
        where: { stepTemplateId: id }
      });

      // 为每个动作生成全局唯一的动作编码
      const processedActionTemplates = [];
      for (let index = 0; index < actionTemplates.length; index++) {
        const action = actionTemplates[index];
        let uniqueActionCode = action.actionCode;
        
        // 如果没有提供actionCode或actionCode已存在，生成新的
        if (!uniqueActionCode) {
          let attempts = 0;
          do {
            attempts++;
            uniqueActionCode = `${stepCode}-A${index + 1}-${Date.now()}-${attempts}`;
            const existingAction = await tx.actionTemplate.findUnique({
              where: { actionCode: uniqueActionCode }
            });
            if (!existingAction) break;
          } while (attempts < 10);
        } else {
          // 检查提供的actionCode是否已存在
          const existingAction = await tx.actionTemplate.findUnique({
            where: { actionCode: uniqueActionCode }
          });
          
          if (existingAction && existingAction.stepTemplateId !== id) {
            // 如果actionCode被其他步骤模板使用，生成新的
            let attempts = 0;
            do {
              attempts++;
              uniqueActionCode = `${action.actionCode}-${Date.now()}-${attempts}`;
              const conflictAction = await tx.actionTemplate.findUnique({
                where: { actionCode: uniqueActionCode }
              });
              if (!conflictAction) break;
            } while (attempts < 10);
          }
        }

        // 将前端特有字段存储在parameters中
        const dbParameters = {
          ...(action.parameters || {}),
          // 前端特有字段
          deviceId: action.deviceId,
          sensorType: action.sensorType,
          sensor: action.sensor,
          sensorValue: action.sensorValue,
          nameLocal: action.nameLocal,
          componentType: action.componentType,
          sensorInit: action.sensorInit,
          maxExecutionTime: action.maxExecutionTime,
          expectedExecutionTime: action.expectedExecutionTime,
          idleTime: action.idleTime,
          okPin: action.okPin,
          errorPin: action.errorPin,
          dSign: action.dSign,
          sSign: action.sSign,
          actionAfterError: action.actionAfterError,
          image: action.image,
          imageWidth: action.imageWidth,
          imageHeight: action.imageHeight,
          fullSizeImage: action.fullSizeImage,
          imagePosition: action.imagePosition,
          soundFile: action.soundFile
        };

        processedActionTemplates.push({
          actionCode: uniqueActionCode,
          name: action.name || '',
          type: mapActionType(action.type),
          category: action.category,
          deviceType: action.deviceType,
          deviceAddress: action.deviceAddress,
          expectedValue: action.expectedValue,
          validationRule: action.validationRule,
          parameters: dbParameters,
          description: action.description,
          instructions: action.instructions,
          isRequired: action.isRequired ?? true,
          timeout: action.timeout || null,
          retryCount: action.retryCount ?? 0,
        });
      }

      // 更新步骤模板并创建新的动作模板
      const updatedTemplate = await tx.stepTemplate.update({
        where: { id },
        data: {
          stepCode,
          name,
          workstationId,
          description,
          instructions,
          image,
          actionTemplates: {
            create: processedActionTemplates
          }
        },
        include: {
          actionTemplates: true,
          workstation: true,
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

      // 同步更新所有使用该模板的Steps中的Actions
      const relatedSteps = await tx.step.findMany({
        where: { stepTemplateId: id },
        include: { actions: true }
      });

      console.log(`Found ${relatedSteps.length} steps using template ${stepCode}`);

      for (const step of relatedSteps) {
        // 删除旧的Actions
        await tx.action.deleteMany({
          where: { stepId: step.id }
        });
        
        console.log(`Deleted ${step.actions.length} old actions for step ${step.stepCode}`);

        // 从新的ActionTemplates创建Actions
        for (let actionIndex = 0; actionIndex < processedActionTemplates.length; actionIndex++) {
          const actionTemplate = processedActionTemplates[actionIndex];
          const parameters = actionTemplate.parameters as any || {};
          
          // 解析设备ID
          let resolvedDeviceId = null;
          if (parameters.deviceId && parameters.deviceId.trim() !== '') {
            // 查找设备ID
            const existingDevices = await tx.workstationDevice.findMany({
              select: { 
                id: true, 
                instanceId: true, 
                displayName: true
              }
            });
            
            const foundDevice = existingDevices.find(d => 
              d.id === parameters.deviceId || d.instanceId === parameters.deviceId
            );
            
            if (foundDevice) {
              resolvedDeviceId = foundDevice.id;
              console.log(`Resolved deviceId "${parameters.deviceId}" to "${foundDevice.id}" for action ${actionTemplate.actionCode}`);
            } else {
              console.warn(`Device not found: "${parameters.deviceId}" for action ${actionTemplate.actionCode}`);
            }
          }

          await tx.action.create({
            data: {
              stepId: step.id,
              actionCode: actionTemplate.actionCode,
              name: actionTemplate.name,
              type: actionTemplate.type,
              sequence: actionIndex + 1, // 按顺序设置序号
              deviceId: resolvedDeviceId,
              deviceAddress: actionTemplate.deviceAddress || '',
              expectedValue: actionTemplate.expectedValue || '',
              validationRule: actionTemplate.validationRule || '',
              parameters: actionTemplate.parameters || {},
              description: actionTemplate.description || '',
              isRequired: actionTemplate.isRequired ?? true,
              timeout: actionTemplate.timeout || null,
              retryCount: actionTemplate.retryCount ?? 0
            }
          });
        }
        
        console.log(`Created ${processedActionTemplates.length} new actions for step ${step.stepCode}`);
      }

      return updatedTemplate;
    });

    // 处理返回的动作模板数据，与GET方法保持一致
    const processedActionTemplates = stepTemplate.actionTemplates.map(action => {
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
    console.error('更新步骤模板失败:', error);
    return NextResponse.json(
      { success: false, error: '更新步骤模板失败: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

// DELETE - 删除步骤模板
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;

    // 检查是否有正在使用此模板的步骤
    const stepsUsingTemplate = await prisma.step.count({
      where: { stepTemplateId: id }
    });

    if (stepsUsingTemplate > 0) {
      return NextResponse.json(
        { success: false, error: `无法删除，还有 ${stepsUsingTemplate} 个步骤正在使用此模板` },
        { status: 400 }
      );
    }

    await prisma.stepTemplate.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: '步骤模板已删除',
    });
  } catch (error) {
    console.error('删除步骤模板失败:', error);
    return NextResponse.json(
      { success: false, error: '删除步骤模板失败' },
      { status: 500 }
    );
  }
}