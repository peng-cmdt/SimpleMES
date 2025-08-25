import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    // 找到工艺流程P1
    const process = await prisma.process.findFirst({
      where: { name: 'P1' },
      include: {
        steps: {
          include: {
            actions: true
          }
        }
      }
    });

    if (!process) {
      return NextResponse.json({ success: false, error: 'Process P1 not found' });
    }

    // 获取步骤模板
    const stepTemplates = await prisma.stepTemplate.findMany({
      where: {
        OR: [
          { id: 'cmejes2hq000stmy8oj1wwn16' }, // WS001.00.S2
          { id: 'cmejeqedw000qtmy8hsjhoack' }  // WS001.00.S1
        ]
      },
      include: {
        actionTemplates: true,
        workstation: true
      }
    });

    console.log('Found step templates:', stepTemplates.length);

    // 删除现有步骤和动作
    await prisma.$transaction(async (tx) => {
      // 先删除所有相关的 orderSteps
      await tx.orderStep.deleteMany({
        where: {
          step: {
            processId: process.id
          }
        }
      });
      
      // 再删除动作日志
      await tx.actionLog.deleteMany({
        where: {
          action: {
            step: {
              processId: process.id
            }
          }
        }
      });
      
      // 删除动作
      for (const step of process.steps) {
        await tx.action.deleteMany({
          where: { stepId: step.id }
        });
      }
      
      // 最后删除步骤
      await tx.step.deleteMany({
        where: { processId: process.id }
      });
    });

    // 重新创建步骤和动作
    const createdSteps = await prisma.$transaction(async (tx) => {
      const newSteps = [];

      for (let i = 0; i < stepTemplates.length; i++) {
        const template = stepTemplates[i];
        
        // 创建步骤
        const step = await tx.step.create({
          data: {
            processId: process.id,
            stepCode: template.stepCode,
            name: template.name,
            stepTemplateId: template.id,
            workstationId: template.workstationId || null,
            sequence: i + 1,
            description: template.description || '',
            estimatedTime: template.estimatedTime || 0,
            isRequired: template.isRequired ?? true
          }
        });

        // 创建动作
        if (template.actionTemplates && template.actionTemplates.length > 0) {
          const actions = await tx.action.createMany({
            data: template.actionTemplates.map((actionTemplate: any, actionIndex: number) => ({
              stepId: step.id,
              actionCode: `A${actionIndex + 1}`,
              name: actionTemplate.name,
              type: actionTemplate.type,
              sequence: actionIndex + 1,
              deviceId: actionTemplate.parameters?.deviceId || actionTemplate.deviceId || null,
              deviceAddress: actionTemplate.parameters?.sensorValue || actionTemplate.deviceAddress || '',
              expectedValue: actionTemplate.parameters?.sensorValue || actionTemplate.expectedValue || '',
              validationRule: actionTemplate.validationRule || '',
              parameters: actionTemplate.parameters || {},
              description: actionTemplate.description || '',
              isRequired: actionTemplate.isRequired ?? true,
              timeout: actionTemplate.timeout || 30,
              retryCount: actionTemplate.retryCount || 0
            }))
          });
          
          console.log(`Created ${template.actionTemplates.length} actions for step ${template.name}`);
        }

        newSteps.push(step);
      }

      return newSteps;
    });

    return NextResponse.json({
      success: true,
      message: `Successfully recreated ${createdSteps.length} steps for process P1`,
      data: {
        processId: process.id,
        stepsCreated: createdSteps.length
      }
    });
  } catch (error) {
    console.error('Fix API error:', error);
    return NextResponse.json({ success: false, error: String(error) });
  }
}