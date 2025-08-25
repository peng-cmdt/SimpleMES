import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

// GET /api/orders/excel-template - 下载Excel导入模板
export async function GET(request: NextRequest) {
  try {
    // 创建示例数据
    const templateData = [
      // 表头
      ['生产号', '日期', '数量', '订单序号', 'BOM号'],
      // 示例数据
      ['PROD-20250817-001', '2025-08-18', 10, 'ORD-001', 'BOM-A001-V1'],
      ['PROD-20250817-002', '2025-08-19', 5, 'ORD-002', 'BOM-B001-V1'],
      ['PROD-20250817-003', '2025-08-20', 8, 'ORD-003', 'BOM-A001-V1']
    ];

    // 创建工作簿
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(templateData);

    // 设置列宽
    worksheet['!cols'] = [
      { wch: 20 }, // 生产号
      { wch: 12 }, // 日期
      { wch: 8 },  // 数量
      { wch: 15 }, // 订单序号
      { wch: 15 }  // BOM号
    ];

    // 添加数据验证说明
    const instructions = [
      ['字段说明'],
      ['生产号：产品的生产批次号，必填'],
      ['日期：计划生产日期，格式：YYYY-MM-DD'],
      ['数量：生产数量，必须为正整数'],
      ['订单序号：订单的序列号，必填'],
      ['BOM号：物料清单编码，必须在系统中存在']
    ];

    const instructionSheet = XLSX.utils.aoa_to_sheet(instructions);
    instructionSheet['!cols'] = [{ wch: 40 }];

    // 添加工作表
    XLSX.utils.book_append_sheet(workbook, worksheet, '订单数据');
    XLSX.utils.book_append_sheet(workbook, instructionSheet, '填写说明');

    // 生成Excel文件
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 设置响应头
    const headers = new Headers();
    headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    headers.set('Content-Disposition', 'attachment; filename="order_import_template.xlsx"');

    return new NextResponse(excelBuffer, { headers });

  } catch (error) {
    console.error('生成Excel模板失败:', error);
    return NextResponse.json(
      { success: false, error: '生成Excel模板失败' },
      { status: 500 }
    );
  }
}