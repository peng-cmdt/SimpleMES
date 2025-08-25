import { NextRequest, NextResponse } from 'next/server';
import { workflowExecutionEngine } from '@/lib/services/workflow-execution';

// GET /api/workflow/[orderId]/status - 获取订单工作流执行状态
export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;

    const state = await workflowExecutionEngine.getWorkflowExecutionState(orderId);

    return NextResponse.json({
      success: true,
      data: state
    });

  } catch (error) {
    console.error('获取工作流状态失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '获取工作流状态失败' 
      },
      { status: 500 }
    );
  }
}