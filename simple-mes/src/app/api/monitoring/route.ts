import { NextRequest, NextResponse } from 'next/server';
import { realTimeMonitoringService } from '@/lib/services/real-time-monitoring';

// GET /api/monitoring/overview - 获取系统总览
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint') || 'overview';

    switch (endpoint) {
      case 'overview':
        const overview = await realTimeMonitoringService.getSystemOverview();
        return NextResponse.json({
          success: true,
          data: overview
        });

      case 'workstations':
        const workstations = await realTimeMonitoringService.getWorkstationStatuses();
        return NextResponse.json({
          success: true,
          data: workstations
        });

      case 'active-orders':
        const limit = parseInt(searchParams.get('limit') || '20');
        const activeOrders = await realTimeMonitoringService.getActiveOrders(limit);
        return NextResponse.json({
          success: true,
          data: activeOrders
        });

      case 'production-stats':
        const timeRange = (searchParams.get('timeRange') || 'today') as 'today' | 'week' | 'month';
        const stats = await realTimeMonitoringService.getProductionStatistics(timeRange);
        return NextResponse.json({
          success: true,
          data: stats
        });

      case 'order-progress':
        const orderId = searchParams.get('orderId');
        if (!orderId) {
          return NextResponse.json(
            { success: false, error: '缺少订单ID参数' },
            { status: 400 }
          );
        }
        
        const progress = await realTimeMonitoringService.getOrderProgress(orderId);
        return NextResponse.json({
          success: true,
          data: progress
        });

      default:
        return NextResponse.json(
          { success: false, error: `不支持的端点: ${endpoint}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('获取监控数据失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '获取监控数据失败' 
      },
      { status: 500 }
    );
  }
}