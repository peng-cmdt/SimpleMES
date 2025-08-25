import { NextRequest, NextResponse } from 'next/server';
import { workflowExecutionEngine } from '@/lib/services/workflow-execution';
import { orderManagementService } from '@/lib/services/order-management';

// GET /api/workstation/[workstationId]/tasks - 获取工位任务列表
export async function GET(
  request: NextRequest,
  { params }: { params: { workstationId: string } }
) {
  try {
    const { workstationId } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const tasks = await workflowExecutionEngine.getWorkstationTasks(workstationId, limit);

    return NextResponse.json({
      success: true,
      data: tasks
    });

  } catch (error) {
    console.error('获取工位任务失败:', error);
    return NextResponse.json(
      { success: false, error: '获取工位任务失败' },
      { status: 500 }
    );
  }
}

// POST /api/workstation/[workstationId]/execute - 执行工位操作
export async function POST(
  request: NextRequest,
  { params }: { params: { workstationId: string } }
) {
  try {
    const { workstationId } = params;
    const body = await request.json();
    const { 
      action, 
      orderId, 
      stepId, 
      actionId, 
      executedBy, 
      sessionId, 
      parameters,
      success,
      notes 
    } = body;

    if (!action || !orderId || !stepId) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const context = {
      orderId,
      stepId,
      workstationId,
      executedBy,
      sessionId
    };

    let result;

    switch (action) {
      case 'startStep':
        result = await workflowExecutionEngine.startStepExecution(context);
        break;

      case 'executeAction':
        if (!actionId) {
          return NextResponse.json(
            { success: false, error: '缺少动作ID参数' },
            { status: 400 }
          );
        }
        result = await workflowExecutionEngine.executeAction(context, actionId, parameters);
        break;

      case 'completeStep':
        if (success === undefined) {
          return NextResponse.json(
            { success: false, error: '缺少成功状态参数' },
            { status: 400 }
          );
        }
        result = await workflowExecutionEngine.completeStepExecution(context, success, notes);
        break;

      default:
        return NextResponse.json(
          { success: false, error: `不支持的操作: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: `${action} 操作完成`
    });

  } catch (error) {
    console.error('工位操作执行失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '工位操作执行失败' 
      },
      { status: 500 }
    );
  }
}