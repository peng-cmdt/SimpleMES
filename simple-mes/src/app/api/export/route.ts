import { NextRequest, NextResponse } from 'next/server';
import { dataExportService } from '@/lib/services/data-export';

// POST /api/export - 数据导出
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type = 'excel',
      scope = 'orders',
      filters,
      exportedBy
    } = body;

    // 验证导出类型
    if (!['excel', 'markdown'].includes(type)) {
      return NextResponse.json(
        { success: false, error: '不支持的导出类型' },
        { status: 400 }
      );
    }

    // 验证导出范围
    if (!['orders', 'action_logs', 'boms', 'products', 'specific_order'].includes(scope)) {
      return NextResponse.json(
        { success: false, error: '不支持的导出范围' },
        { status: 400 }
      );
    }

    // 如果是特定订单导出，验证订单ID
    if (scope === 'specific_order' && !filters?.orderId) {
      return NextResponse.json(
        { success: false, error: '导出特定订单需要提供订单ID' },
        { status: 400 }
      );
    }

    // 处理日期过滤器
    const processedFilters = { ...filters };
    if (filters?.dateFrom) {
      processedFilters.dateFrom = new Date(filters.dateFrom);
    }
    if (filters?.dateTo) {
      processedFilters.dateTo = new Date(filters.dateTo);
    }

    // 执行导出
    const result = await dataExportService.exportData({
      type,
      scope,
      filters: processedFilters,
      exportedBy
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.errorMessage },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        exportRecordId: result.exportRecordId,
        fileName: result.filePath,
        fileSize: result.fileSize,
        recordCount: result.recordCount
      },
      message: '数据导出成功'
    });

  } catch (error) {
    console.error('数据导出失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '数据导出失败' 
      },
      { status: 500 }
    );
  }
}

// GET /api/export - 获取导出记录列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const exportedBy = searchParams.get('exportedBy');
    const status = searchParams.get('status');

    const filters: {
      dateFrom?: Date;
      dateTo?: Date;
      exportedBy?: string;
      status?: string;
    } = {};

    if (dateFrom) filters.dateFrom = new Date(dateFrom);
    if (dateTo) filters.dateTo = new Date(dateTo);
    if (exportedBy) filters.exportedBy = exportedBy;
    if (status) filters.status = status;

    const records = await dataExportService.getExportRecords(filters);

    return NextResponse.json({
      success: true,
      data: records
    });

  } catch (error) {
    console.error('获取导出记录失败:', error);
    return NextResponse.json(
      { success: false, error: '获取导出记录失败' },
      { status: 500 }
    );
  }
}