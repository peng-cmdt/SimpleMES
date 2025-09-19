import { NextRequest, NextResponse } from 'next/server';
import { workstationOrderQueueService } from '@/lib/services/workstation-order-queue';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workstationId = searchParams.get('workstationId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!workstationId) {
      return NextResponse.json(
        { success: false, error: '缺少工位ID参数' },
        { status: 400 }
      );
    }

    // 查找工位（支持UUID和workstationId字符串）
    const workstation = await prisma.workstation.findFirst({
      where: {
        OR: [
          { id: workstationId },
          { workstationId: workstationId }
        ]
      },
      select: { id: true }
    });

    if (!workstation) {
      return NextResponse.json(
        { success: false, error: '工位不存在' },
        { status: 404 }
      );
    }

    // 解析状态过滤条件
    let statusFilter: any[] | undefined;
    if (status) {
      const statusList = status.split(',').map(s => s.trim().toUpperCase());
      // 映射前端状态到工位订单状态
      const statusMap: { [key: string]: string } = {
        'PENDING': 'PENDING',
        'IN_PROGRESS': 'IN_PROGRESS', 
        'COMPLETED': 'COMPLETED',
        'CANCELLED': 'CANCELLED'
      };
      
      statusFilter = statusList
        .map(s => statusMap[s] || s)
        .filter(Boolean);
    }

    // 获取工位的订单列表
    const workstationOrders = await workstationOrderQueueService.getWorkstationOrders({
      workstationId: workstation.id,
      status: statusFilter as any,
      isVisible: true,
      limit
    });

    // 转换为前端需要的格式
    const orders = workstationOrders.map(wo => ({
      id: wo.order.id,
      orderNumber: wo.order.orderNumber,
      productionNumber: wo.order.productionNumber,
      productFamily: wo.order.product?.name || wo.order.product?.productCode || 'N/A',
      carrierId: `CARR-${wo.order.id.slice(-6)}`, 
      status: wo.status.toLowerCase(), // 使用工位级别的状态
      priority: wo.priority,
      product: wo.order.product,
      workstationStatus: wo.status, // 保留原始工位状态
      workstationOrderId: wo.id, // 工位订单队列ID
      assignedAt: wo.assignedAt,
      startedAt: wo.startedAt,
      completedAt: wo.completedAt,
      globalOrderStatus: wo.order.status // 全局订单状态（用于参考）
    }));

    // 按优先级和序号排序
    orders.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // 按订单号排序
      const getOrderNumber = (orderNumber: string) => {
        const match = orderNumber.match(/T(\d+)/);
        return match ? parseInt(match[1]) : 0;
      };
      return getOrderNumber(a.orderNumber) - getOrderNumber(b.orderNumber);
    });

    return NextResponse.json({
      success: true,
      data: {
        orders,
        statistics: {
          total: orders.length,
          pending: orders.filter(o => o.status === 'pending').length,
          inProgress: orders.filter(o => o.status === 'in_progress').length,
          completed: orders.filter(o => o.status === 'completed').length
        }
      }
    });

  } catch (error) {
    console.error('获取工位订单列表失败:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      workstationId: searchParams.get('workstationId'),
      status: searchParams.get('status'),
      limit: searchParams.get('limit')
    });
    
    // 返回更详细的错误信息用于调试
    return NextResponse.json(
      { 
        success: false, 
        error: '获取工位订单列表失败',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}