import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';

// POST /api/orders/import-excel - Excel导入订单
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const overwriteExisting = formData.get('overwriteExisting') === 'true';

    if (!file) {
      return NextResponse.json(
        { success: false, error: '请选择要导入的Excel文件' },
        { status: 400 }
      );
    }

    // 验证文件类型
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: '文件格式不正确，请上传Excel文件' },
        { status: 400 }
      );
    }

    // 读取Excel文件
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Excel文件内容为空或格式不正确' },
        { status: 400 }
      );
    }

    // 解析表头
    const headers = jsonData[0] as string[];
    const requiredFields = ['生产号', '日期', '数量', '订单序号', 'BOM号'];
    
    // 验证必需字段
    const missingFields = requiredFields.filter(field => !headers.includes(field));
    if (missingFields.length > 0) {
      return NextResponse.json(
        { success: false, error: `缺少必需字段: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // 获取字段索引
    const fieldIndexes = {
      productionNumber: headers.indexOf('生产号'),
      date: headers.indexOf('日期'),
      quantity: headers.indexOf('数量'),
      orderSequence: headers.indexOf('订单序号'),
      bomCode: headers.indexOf('BOM号')
    };

    // 解析数据行
    const dataRows = jsonData.slice(1);
    const importBatchId = uuidv4();
    const importResults = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
      batchId: importBatchId
    };

    // 预先获取产品和BOM映射
    const boms = await prisma.bOM.findMany({
      include: {
        product: {
          include: {
            processes: {
              where: { status: 'active' },
              orderBy: { createdAt: 'asc' },
              take: 1 // 取第一个活跃的工艺流程
            }
          }
        }
      }
    });

    const bomMap = new Map();
    boms.forEach(bom => {
      bomMap.set(bom.bomCode, bom);
    });

    // 获取当前最大序号用于设置新订单的序号
    const lastOrder = await prisma.order.findFirst({
      orderBy: { sequence: 'desc' },
      where: { sequence: { not: null } }
    });
    let currentSequence = (lastOrder?.sequence || 0) + 1;

    // 使用事务批量处理订单数据
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i] as any[];
        const rowNumber = i + 2; // Excel行号（从1开始，加上标题行）

        try {
          // 提取字段值
          const productionNumber = row[fieldIndexes.productionNumber]?.toString()?.trim();
          const dateValue = row[fieldIndexes.date];
          const quantity = parseInt(row[fieldIndexes.quantity]?.toString() || '0');
          const orderSequence = row[fieldIndexes.orderSequence]?.toString()?.trim();
          const bomCode = row[fieldIndexes.bomCode]?.toString()?.trim();

          // 验证必填字段
          if (!productionNumber || !quantity || !orderSequence || !bomCode) {
            importResults.failed++;
            importResults.errors.push(`第${rowNumber}行: 必填字段不能为空`);
            continue;
          }

          // 验证数量
          if (quantity <= 0 || isNaN(quantity)) {
            importResults.failed++;
            importResults.errors.push(`第${rowNumber}行: 数量必须为正整数`);
            continue;
          }

          // 生成订单号
          const orderNumber = `${orderSequence}-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}`;

          // 检查订单号是否已存在
          const existingOrder = await tx.order.findUnique({
            where: { orderNumber }
          });

          if (existingOrder) {
            if (overwriteExisting) {
              // 如果允许覆盖，先删除现有订单
              await tx.order.delete({
                where: { id: existingOrder.id }
              });
              importResults.skipped++;
            } else {
              importResults.failed++;
              importResults.errors.push(`第${rowNumber}行: 订单号 ${orderNumber} 已存在`);
              continue;
            }
          }

          // 验证BOM
          const bom = bomMap.get(bomCode);
          if (!bom) {
            importResults.failed++;
            importResults.errors.push(`第${rowNumber}行: BOM编码 ${bomCode} 不存在`);
            continue;
          }

          // 验证产品是否有可用的工艺流程
          if (!bom.product.processes || bom.product.processes.length === 0) {
            importResults.failed++;
            importResults.errors.push(`第${rowNumber}行: 产品 ${bom.product.name} 没有可用的工艺流程`);
            continue;
          }

          // 解析日期
          let plannedDate: Date | null = null;
          if (dateValue) {
            try {
              if (typeof dateValue === 'number') {
                // Excel日期数字格式
                plannedDate = new Date((dateValue - 25569) * 86400 * 1000);
              } else {
                // 字符串格式
                plannedDate = new Date(dateValue.toString());
              }
              
              if (isNaN(plannedDate.getTime())) {
                plannedDate = null;
              }
            } catch {
              plannedDate = null;
            }
          }

          // 创建订单
          const newOrder = await tx.order.create({
            data: {
              orderNumber,
              productionNumber,
              productId: bom.product.id,
              bomId: bom.id,
              processId: bom.product.processes[0].id,
              quantity,
              priority: 0,
              sequence: currentSequence++,
              status: 'PENDING',
              plannedDate,
              notes: `Excel导入 - 序号: ${orderSequence}`,
              createdBy: 'excel_import',
              importSource: 'excel',
              importBatch: importBatchId
            }
          });

          // 记录订单状态变更历史
          await tx.orderStatusHistory.create({
            data: {
              orderId: newOrder.id,
              fromStatus: null,
              toStatus: 'PENDING',
              changedBy: 'excel_import',
              reason: 'Excel导入创建订单',
              notes: `导入批次: ${importBatchId}`
            }
          });

          // 根据工艺流程创建订单步骤记录
          const process = bom.product.processes[0];
          const steps = await tx.step.findMany({
            where: { processId: process.id },
            orderBy: { sequence: 'asc' }
          });

          for (const step of steps) {
            await tx.orderStep.create({
              data: {
                orderId: newOrder.id,
                stepId: step.id,
                workstationId: step.workstationId,
                status: 'pending'
              }
            });
          }

          importResults.success++;

        } catch (error) {
          importResults.failed++;
          importResults.errors.push(`第${rowNumber}行: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: importResults,
      message: `导入完成 - 成功: ${importResults.success}, 失败: ${importResults.failed}, 跳过: ${importResults.skipped}`
    });

  } catch (error) {
    console.error('Excel导入失败:', error);
    return NextResponse.json(
      { success: false, error: 'Excel导入失败' },
      { status: 500 }
    );
  }
}