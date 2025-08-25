import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // 查询T001订单
    const order = await prisma.order.findFirst({
      where: { productionNumber: 'T001' },
      include: {
        process: {
          include: {
            steps: {
              include: {
                actions: {
                  include: {
                    device: true
                  },
                  orderBy: { sequence: 'asc' }
                },
                stepTemplate: {
                  include: {
                    actionTemplates: true
                  }
                },
                workstation: true
              },
              orderBy: { sequence: 'asc' }
            }
          }
        }
      }
    });

    // 检查步骤模板数据
    const stepTemplates = await prisma.stepTemplate.findMany({
      where: {
        OR: [
          { stepCode: 'WS001.00.S1' },
          { stepCode: 'WS001.00.S2' },
          { id: 'cmejes2hq000stmy8oj1wwn16' },
          { id: 'cmejeqedw000qtmy8hsjhoack' }
        ]
      },
      include: {
        actionTemplates: true,
        workstation: true
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        order: {
          id: order?.id,
          processName: order?.process?.name,
          processId: order?.process?.id,
          stepCount: order?.process?.steps?.length || 0,
        },
        steps: order?.process?.steps?.map(step => ({
          id: step.id,
          name: step.name,
          stepCode: step.stepCode,
          stepTemplateId: step.stepTemplateId,
          actionCount: step.actions?.length || 0,
          actions: step.actions?.map(action => ({
            id: action.id,
            name: action.name,
            type: action.type,
            deviceId: action.deviceId,
            deviceAddress: action.deviceAddress,
            expectedValue: action.expectedValue,
            parameters: action.parameters,
            device: action.device ? {
              id: action.device.id,
              name: action.device.name,
              type: action.device.type
            } : null
          })) || []
        })) || [],
        stepTemplates: stepTemplates.map(template => ({
          id: template.id,
          stepCode: template.stepCode,
          name: template.name,
          actionTemplateCount: template.actionTemplates?.length || 0,
          actionTemplates: template.actionTemplates?.map(at => ({
            id: at.id,
            name: at.name,
            type: at.type,
            deviceId: at.deviceId,
            deviceAddress: at.deviceAddress,
            expectedValue: at.expectedValue,
            parameters: at.parameters
          })) || []
        }))
      }
    });
  } catch (error) {
    console.error('Test API error:', error);
    return NextResponse.json({ success: false, error: String(error) });
  }
}