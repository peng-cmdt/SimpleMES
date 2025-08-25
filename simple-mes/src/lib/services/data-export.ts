import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export interface ExportOptions {
  type: 'excel' | 'markdown';
  scope: 'orders' | 'action_logs' | 'boms' | 'products' | 'specific_order';
  filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    orderId?: string;
    workstationId?: string;
    productId?: string;
    status?: string;
  };
  exportedBy?: string;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  recordCount?: number;
  exportRecordId?: string;
  errorMessage?: string;
}

export class DataExportService {

  /**
   * 导出数据
   */
  async exportData(options: ExportOptions): Promise<ExportResult> {
    const { type, scope, filters, exportedBy } = options;

    try {
      // 创建导出记录
      const exportRecord = await prisma.dataExportRecord.create({
        data: {
          exportType: type,
          exportScope: scope,
          filters: filters ? JSON.stringify(filters) : null,
          startDate: filters?.dateFrom,
          endDate: filters?.dateTo,
          exportedBy: exportedBy || 'system',
          status: 'processing'
        }
      });

      let result: ExportResult;

      try {
        // 根据导出类型执行相应的导出逻辑
        switch (scope) {
          case 'orders':
            result = await this.exportOrders(type, filters);
            break;
          case 'action_logs':
            result = await this.exportActionLogs(type, filters);
            break;
          case 'boms':
            result = await this.exportBOMs(type, filters);
            break;
          case 'products':
            result = await this.exportProducts(type, filters);
            break;
          case 'specific_order':
            if (!filters?.orderId) {
              throw new Error('导出特定订单需要提供订单ID');
            }
            result = await this.exportSpecificOrder(type, filters.orderId);
            break;
          default:
            throw new Error(`不支持的导出范围: ${scope}`);
        }

        // 更新导出记录为成功
        await prisma.dataExportRecord.update({
          where: { id: exportRecord.id },
          data: {
            status: 'completed',
            filePath: result.filePath,
            fileSize: result.fileSize,
            recordCount: result.recordCount
          }
        });

        return {
          ...result,
          exportRecordId: exportRecord.id
        };

      } catch (error) {
        // 更新导出记录为失败
        await prisma.dataExportRecord.update({
          where: { id: exportRecord.id },
          data: {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : '未知错误'
          }
        });

        throw error;
      }

    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : '导出失败'
      };
    }
  }

  /**
   * 导出订单数据
   */
  private async exportOrders(type: 'excel' | 'markdown', filters?: ExportOptions['filters']): Promise<ExportResult> {
    // 构建查询条件
    const where: {
      createdAt?: { gte?: Date; lte?: Date };
      productId?: string;
      status?: string;
      currentStationId?: string;
    } = {};

    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    if (filters?.productId) where.productId = filters.productId;
    if (filters?.status) where.status = filters.status;
    if (filters?.workstationId) where.currentStationId = filters.workstationId;

    // 获取订单数据
    const orders = await prisma.order.findMany({
      where,
      include: {
        product: true,
        bom: true,
        process: true,
        currentStation: true,
        currentStep: true,
        orderSteps: {
          include: {
            step: true,
            workstation: true
          }
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (type === 'excel') {
      return this.generateOrdersExcel(orders);
    } else {
      return this.generateOrdersMarkdown(orders);
    }
  }

  /**
   * 导出动作执行日志
   */
  private async exportActionLogs(type: 'excel' | 'markdown', filters?: ExportOptions['filters']): Promise<ExportResult> {
    const where: {
      executedAt?: { gte?: Date; lte?: Date };
      orderStep?: {
        order?: {
          productId?: string;
        };
        workstationId?: string;
      };
    } = {};

    if (filters?.dateFrom || filters?.dateTo) {
      where.executedAt = {};
      if (filters.dateFrom) where.executedAt.gte = filters.dateFrom;
      if (filters.dateTo) where.executedAt.lte = filters.dateTo;
    }

    if (filters?.productId || filters?.workstationId) {
      where.orderStep = {};
      if (filters.productId) {
        where.orderStep.order = { productId: filters.productId };
      }
      if (filters.workstationId) {
        where.orderStep.workstationId = filters.workstationId;
      }
    }

    const actionLogs = await prisma.actionLog.findMany({
      where,
      include: {
        orderStep: {
          include: {
            order: {
              include: {
                product: true
              }
            },
            step: true,
            workstation: true
          }
        },
        action: true,
        device: true
      },
      orderBy: { executedAt: 'desc' }
    });

    if (type === 'excel') {
      return this.generateActionLogsExcel(actionLogs);
    } else {
      return this.generateActionLogsMarkdown(actionLogs);
    }
  }

  /**
   * 导出BOM数据
   */
  private async exportBOMs(type: 'excel' | 'markdown', filters?: ExportOptions['filters']): Promise<ExportResult> {
    const where: {
      productId?: string;
      status?: string;
    } = {};

    if (filters?.productId) where.productId = filters.productId;
    if (filters?.status) where.status = filters.status;

    const boms = await prisma.bOM.findMany({
      where,
      include: {
        product: true,
        bomItems: true,
        _count: {
          select: { orders: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (type === 'excel') {
      return this.generateBOMsExcel(boms);
    } else {
      return this.generateBOMsMarkdown(boms);
    }
  }

  /**
   * 导出产品数据
   */
  private async exportProducts(type: 'excel' | 'markdown', filters?: ExportOptions['filters']): Promise<ExportResult> {
    const where: {
      status?: string;
    } = {};

    if (filters?.status) where.status = filters.status;

    const products = await prisma.product.findMany({
      where,
      include: {
        boms: {
          include: {
            bomItems: true
          }
        },
        processes: {
          include: {
            steps: {
              include: {
                actions: true
              }
            }
          }
        },
        _count: {
          select: { orders: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (type === 'excel') {
      return this.generateProductsExcel(products);
    } else {
      return this.generateProductsMarkdown(products);
    }
  }

  /**
   * 导出特定订单的完整信息
   */
  private async exportSpecificOrder(type: 'excel' | 'markdown', orderId: string): Promise<ExportResult> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        product: true,
        bom: {
          include: {
            bomItems: true
          }
        },
        process: {
          include: {
            steps: {
              include: {
                actions: true
              }
            }
          }
        },
        currentStation: true,
        currentStep: true,
        orderSteps: {
          include: {
            step: {
              include: {
                actions: true
              }
            },
            workstation: true,
            actionLogs: {
              include: {
                action: true,
                device: true
              }
            }
          }
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' }
        }
      }
    });

    if (!order) {
      throw new Error('订单不存在');
    }

    if (type === 'excel') {
      return this.generateSpecificOrderExcel(order);
    } else {
      return this.generateSpecificOrderMarkdown(order);
    }
  }

  // ==================== Excel 生成方法 ====================

  private generateOrdersExcel(orders: any[]): ExportResult {
    const workbook = XLSX.utils.book_new();

    // 订单基本信息表
    const orderData = orders.map(order => ({
      '订单号': order.orderNumber,
      '生产号': order.productionNumber,
      '产品编码': order.product.productCode,
      '产品名称': order.product.name,
      'BOM编码': order.bom.bomCode,
      '工艺编码': order.process.processCode,
      '数量': order.quantity,
      '已完成数量': order.completedQuantity,
      '优先级': order.priority,
      '序号': order.sequence,
      '状态': order.status,
      '当前工位': order.currentStation?.name || '',
      '当前步骤': order.currentStep?.name || '',
      '计划日期': order.plannedDate ? new Date(order.plannedDate).toLocaleDateString('zh-CN') : '',
      '开始时间': order.startedAt ? new Date(order.startedAt).toLocaleString('zh-CN') : '',
      '完成时间': order.completedAt ? new Date(order.completedAt).toLocaleString('zh-CN') : '',
      '创建时间': new Date(order.createdAt).toLocaleString('zh-CN'),
      '备注': order.notes || ''
    }));

    const orderSheet = XLSX.utils.json_to_sheet(orderData);
    XLSX.utils.book_append_sheet(workbook, orderSheet, '订单列表');

    // 订单步骤进度表
    const stepData: any[] = [];
    orders.forEach(order => {
      order.orderSteps.forEach((orderStep: any) => {
        stepData.push({
          '订单号': order.orderNumber,
          '步骤编码': orderStep.step.stepCode,
          '步骤名称': orderStep.step.name,
          '工位名称': orderStep.workstation?.name || '',
          '状态': orderStep.status,
          '开始时间': orderStep.startedAt ? new Date(orderStep.startedAt).toLocaleString('zh-CN') : '',
          '完成时间': orderStep.completedAt ? new Date(orderStep.completedAt).toLocaleString('zh-CN') : '',
          '执行人': orderStep.executedBy || '',
          '实际用时(秒)': orderStep.actualTime || '',
          '错误信息': orderStep.errorMessage || '',
          '备注': orderStep.notes || ''
        });
      });
    });

    if (stepData.length > 0) {
      const stepSheet = XLSX.utils.json_to_sheet(stepData);
      XLSX.utils.book_append_sheet(workbook, stepSheet, '订单步骤');
    }

    const fileName = `orders_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      success: true,
      filePath: fileName,
      fileSize: buffer.length,
      recordCount: orders.length
    };
  }

  private generateActionLogsExcel(actionLogs: any[]): ExportResult {
    const workbook = XLSX.utils.book_new();

    const data = actionLogs.map(log => ({
      '订单号': log.orderStep.order.orderNumber,
      '产品名称': log.orderStep.order.product.name,
      '步骤名称': log.orderStep.step.name,
      '工位名称': log.orderStep.workstation?.name || '',
      '动作编码': log.action.actionCode,
      '动作名称': log.action.name,
      '动作类型': log.action.type,
      '设备名称': log.device?.name || '',
      '状态': log.status,
      '执行时间': new Date(log.executedAt).toLocaleString('zh-CN'),
      '执行人': log.executedBy || '',
      '请求值': log.requestValue || '',
      '响应值': log.responseValue || '',
      '实际值': log.actualValue || '',
      '校验结果': log.validationResult !== null ? (log.validationResult ? '通过' : '失败') : '',
      '执行耗时(毫秒)': log.executionTime || '',
      '错误代码': log.errorCode || '',
      '错误信息': log.errorMessage || ''
    }));

    const sheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, sheet, '动作执行日志');

    const fileName = `action_logs_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      success: true,
      filePath: fileName,
      fileSize: buffer.length,
      recordCount: actionLogs.length
    };
  }

  private generateBOMsExcel(boms: any[]): ExportResult {
    const workbook = XLSX.utils.book_new();

    // BOM基本信息表
    const bomData = boms.map(bom => ({
      'BOM编码': bom.bomCode,
      'BOM名称': bom.name,
      '产品编码': bom.product.productCode,
      '产品名称': bom.product.name,
      '版本': bom.version,
      '状态': bom.status,
      '物料数量': bom.bomItems.length,
      '订单数量': bom._count.orders,
      '描述': bom.description || '',
      '创建时间': new Date(bom.createdAt).toLocaleString('zh-CN')
    }));

    const bomSheet = XLSX.utils.json_to_sheet(bomData);
    XLSX.utils.book_append_sheet(workbook, bomSheet, 'BOM列表');

    // BOM物料明细表
    const itemData: any[] = [];
    boms.forEach(bom => {
      bom.bomItems.forEach((item: any) => {
        itemData.push({
          'BOM编码': bom.bomCode,
          'BOM名称': bom.name,
          '物料编码': item.itemCode,
          '物料名称': item.itemName,
          '数量': item.quantity,
          '单位': item.unit,
          '描述': item.description || ''
        });
      });
    });

    if (itemData.length > 0) {
      const itemSheet = XLSX.utils.json_to_sheet(itemData);
      XLSX.utils.book_append_sheet(workbook, itemSheet, '物料明细');
    }

    const fileName = `boms_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      success: true,
      filePath: fileName,
      fileSize: buffer.length,
      recordCount: boms.length
    };
  }

  private generateProductsExcel(products: any[]): ExportResult {
    const workbook = XLSX.utils.book_new();

    const data = products.map(product => ({
      '产品编码': product.productCode,
      '产品名称': product.name,
      '版本': product.version,
      '状态': product.status,
      'BOM数量': product.boms.length,
      '工艺数量': product.processes.length,
      '订单数量': product._count.orders,
      '描述': product.description || '',
      '创建时间': new Date(product.createdAt).toLocaleString('zh-CN')
    }));

    const sheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, sheet, '产品列表');

    const fileName = `products_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      success: true,
      filePath: fileName,
      fileSize: buffer.length,
      recordCount: products.length
    };
  }

  private generateSpecificOrderExcel(order: any): ExportResult {
    const workbook = XLSX.utils.book_new();

    // 订单基本信息
    const orderInfo = [{
      '订单号': order.orderNumber,
      '生产号': order.productionNumber,
      '产品编码': order.product.productCode,
      '产品名称': order.product.name,
      'BOM编码': order.bom.bomCode,
      '工艺编码': order.process.processCode,
      '数量': order.quantity,
      '已完成数量': order.completedQuantity,
      '状态': order.status,
      '当前工位': order.currentStation?.name || '',
      '当前步骤': order.currentStep?.name || '',
      '开始时间': order.startedAt ? new Date(order.startedAt).toLocaleString('zh-CN') : '',
      '完成时间': order.completedAt ? new Date(order.completedAt).toLocaleString('zh-CN') : '',
      '创建时间': new Date(order.createdAt).toLocaleString('zh-CN')
    }];

    const orderSheet = XLSX.utils.json_to_sheet(orderInfo);
    XLSX.utils.book_append_sheet(workbook, orderSheet, '订单信息');

    // BOM明细
    const bomItems = order.bom.bomItems.map((item: any) => ({
      '物料编码': item.itemCode,
      '物料名称': item.itemName,
      '数量': item.quantity,
      '单位': item.unit,
      '描述': item.description || ''
    }));

    const bomSheet = XLSX.utils.json_to_sheet(bomItems);
    XLSX.utils.book_append_sheet(workbook, bomSheet, 'BOM明细');

    // 工艺步骤
    const processSteps = order.process.steps.map((step: any) => ({
      '步骤编码': step.stepCode,
      '步骤名称': step.name,
      '顺序': step.sequence,
      '工位': step.workstation?.name || '',
      '预计时间(秒)': step.estimatedTime || '',
      '是否必需': step.isRequired ? '是' : '否',
      '描述': step.description || ''
    }));

    const processSheet = XLSX.utils.json_to_sheet(processSteps);
    XLSX.utils.book_append_sheet(workbook, processSheet, '工艺步骤');

    // 执行记录
    const executionLogs: any[] = [];
    order.orderSteps.forEach((orderStep: any) => {
      orderStep.actionLogs.forEach((log: any) => {
        executionLogs.push({
          '步骤名称': orderStep.step.name,
          '工位名称': orderStep.workstation?.name || '',
          '动作名称': log.action.name,
          '动作类型': log.action.type,
          '设备名称': log.device?.name || '',
          '状态': log.status,
          '执行时间': new Date(log.executedAt).toLocaleString('zh-CN'),
          '执行人': log.executedBy || '',
          '请求值': log.requestValue || '',
          '响应值': log.responseValue || '',
          '实际值': log.actualValue || '',
          '校验结果': log.validationResult !== null ? (log.validationResult ? '通过' : '失败') : '',
          '执行耗时(毫秒)': log.executionTime || '',
          '错误信息': log.errorMessage || ''
        });
      });
    });

    if (executionLogs.length > 0) {
      const logSheet = XLSX.utils.json_to_sheet(executionLogs);
      XLSX.utils.book_append_sheet(workbook, logSheet, '执行记录');
    }

    const fileName = `order_${order.orderNumber}_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      success: true,
      filePath: fileName,
      fileSize: buffer.length,
      recordCount: 1
    };
  }

  // ==================== Markdown 生成方法 ====================

  private generateOrdersMarkdown(orders: any[]): ExportResult {
    let markdown = `# 生产订单报告\n\n`;
    markdown += `**导出时间**: ${new Date().toLocaleString('zh-CN')}\n`;
    markdown += `**订单数量**: ${orders.length}\n\n`;

    markdown += `## 订单列表\n\n`;
    markdown += `| 订单号 | 生产号 | 产品名称 | 数量 | 状态 | 当前工位 | 创建时间 |\n`;
    markdown += `|--------|--------|----------|------|------|----------|----------|\n`;

    orders.forEach(order => {
      markdown += `| ${order.orderNumber} | ${order.productionNumber} | ${order.product.name} | ${order.quantity} | ${order.status} | ${order.currentStation?.name || '-'} | ${new Date(order.createdAt).toLocaleString('zh-CN')} |\n`;
    });

    const fileName = `orders_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.md`;
    const buffer = Buffer.from(markdown, 'utf-8');

    return {
      success: true,
      filePath: fileName,
      fileSize: buffer.length,
      recordCount: orders.length
    };
  }

  private generateActionLogsMarkdown(actionLogs: any[]): ExportResult {
    let markdown = `# 动作执行日志报告\n\n`;
    markdown += `**导出时间**: ${new Date().toLocaleString('zh-CN')}\n`;
    markdown += `**日志数量**: ${actionLogs.length}\n\n`;

    markdown += `## 执行日志\n\n`;
    markdown += `| 订单号 | 步骤名称 | 动作名称 | 状态 | 执行时间 | 执行人 | 错误信息 |\n`;
    markdown += `|--------|----------|----------|------|----------|--------|----------|\n`;

    actionLogs.forEach(log => {
      markdown += `| ${log.orderStep.order.orderNumber} | ${log.orderStep.step.name} | ${log.action.name} | ${log.status} | ${new Date(log.executedAt).toLocaleString('zh-CN')} | ${log.executedBy || '-'} | ${log.errorMessage || '-'} |\n`;
    });

    const fileName = `action_logs_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.md`;
    const buffer = Buffer.from(markdown, 'utf-8');

    return {
      success: true,
      filePath: fileName,
      fileSize: buffer.length,
      recordCount: actionLogs.length
    };
  }

  private generateBOMsMarkdown(boms: any[]): ExportResult {
    let markdown = `# BOM管理报告\n\n`;
    markdown += `**导出时间**: ${new Date().toLocaleString('zh-CN')}\n`;
    markdown += `**BOM数量**: ${boms.length}\n\n`;

    boms.forEach(bom => {
      markdown += `## ${bom.bomCode} - ${bom.name}\n\n`;
      markdown += `**产品**: ${bom.product.name} (${bom.product.productCode})\n`;
      markdown += `**版本**: ${bom.version}\n`;
      markdown += `**状态**: ${bom.status}\n\n`;

      if (bom.bomItems.length > 0) {
        markdown += `### 物料清单\n\n`;
        markdown += `| 物料编码 | 物料名称 | 数量 | 单位 | 描述 |\n`;
        markdown += `|----------|----------|------|------|------|\n`;

        bom.bomItems.forEach((item: any) => {
          markdown += `| ${item.itemCode} | ${item.itemName} | ${item.quantity} | ${item.unit} | ${item.description || '-'} |\n`;
        });

        markdown += `\n`;
      }
    });

    const fileName = `boms_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.md`;
    const buffer = Buffer.from(markdown, 'utf-8');

    return {
      success: true,
      filePath: fileName,
      fileSize: buffer.length,
      recordCount: boms.length
    };
  }

  private generateProductsMarkdown(products: any[]): ExportResult {
    let markdown = `# 产品管理报告\n\n`;
    markdown += `**导出时间**: ${new Date().toLocaleString('zh-CN')}\n`;
    markdown += `**产品数量**: ${products.length}\n\n`;

    markdown += `| 产品编码 | 产品名称 | 版本 | 状态 | BOM数量 | 工艺数量 | 订单数量 |\n`;
    markdown += `|----------|----------|------|------|---------|----------|----------|\n`;

    products.forEach(product => {
      markdown += `| ${product.productCode} | ${product.name} | ${product.version} | ${product.status} | ${product.boms.length} | ${product.processes.length} | ${product._count.orders} |\n`;
    });

    const fileName = `products_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.md`;
    const buffer = Buffer.from(markdown, 'utf-8');

    return {
      success: true,
      filePath: fileName,
      fileSize: buffer.length,
      recordCount: products.length
    };
  }

  private generateSpecificOrderMarkdown(order: any): ExportResult {
    let markdown = `# 订单详细报告\n\n`;
    markdown += `**订单号**: ${order.orderNumber}\n`;
    markdown += `**生产号**: ${order.productionNumber}\n`;
    markdown += `**产品**: ${order.product.name} (${order.product.productCode})\n`;
    markdown += `**状态**: ${order.status}\n`;
    markdown += `**数量**: ${order.quantity}\n`;
    markdown += `**已完成数量**: ${order.completedQuantity}\n`;
    markdown += `**导出时间**: ${new Date().toLocaleString('zh-CN')}\n\n`;

    // BOM信息
    markdown += `## BOM信息\n\n`;
    markdown += `**BOM编码**: ${order.bom.bomCode}\n`;
    markdown += `**BOM名称**: ${order.bom.name}\n\n`;

    if (order.bom.bomItems.length > 0) {
      markdown += `### 物料清单\n\n`;
      markdown += `| 物料编码 | 物料名称 | 数量 | 单位 |\n`;
      markdown += `|----------|----------|------|------|\n`;

      order.bom.bomItems.forEach((item: any) => {
        markdown += `| ${item.itemCode} | ${item.itemName} | ${item.quantity} | ${item.unit} |\n`;
      });

      markdown += `\n`;
    }

    // 工艺流程
    markdown += `## 工艺流程\n\n`;
    markdown += `**工艺编码**: ${order.process.processCode}\n`;
    markdown += `**工艺名称**: ${order.process.name}\n\n`;

    if (order.process.steps.length > 0) {
      markdown += `### 工艺步骤\n\n`;
      markdown += `| 步骤 | 名称 | 工位 | 预计时间(秒) | 状态 |\n`;
      markdown += `|------|------|------|--------------|------|\n`;

      order.process.steps.forEach((step: any) => {
        const orderStep = order.orderSteps.find((os: any) => os.stepId === step.id);
        const status = orderStep ? orderStep.status : 'pending';
        markdown += `| ${step.sequence} | ${step.name} | ${step.workstation?.name || '-'} | ${step.estimatedTime || '-'} | ${status} |\n`;
      });

      markdown += `\n`;
    }

    // 执行历史
    if (order.statusHistory.length > 0) {
      markdown += `## 状态变更历史\n\n`;
      markdown += `| 时间 | 从状态 | 到状态 | 变更人 | 原因 |\n`;
      markdown += `|------|--------|--------|--------|------|\n`;

      order.statusHistory.forEach((history: any) => {
        markdown += `| ${new Date(history.changedAt).toLocaleString('zh-CN')} | ${history.fromStatus || '-'} | ${history.toStatus} | ${history.changedBy || '-'} | ${history.reason || '-'} |\n`;
      });
    }

    const fileName = `order_${order.orderNumber}_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.md`;
    const buffer = Buffer.from(markdown, 'utf-8');

    return {
      success: true,
      filePath: fileName,
      fileSize: buffer.length,
      recordCount: 1
    };
  }

  /**
   * 获取导出记录列表
   */
  async getExportRecords(filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    exportedBy?: string;
    status?: string;
  }) {
    const where: {
      exportedAt?: { gte?: Date; lte?: Date };
      exportedBy?: string;
      status?: string;
    } = {};

    if (filters?.dateFrom || filters?.dateTo) {
      where.exportedAt = {};
      if (filters.dateFrom) where.exportedAt.gte = filters.dateFrom;
      if (filters.dateTo) where.exportedAt.lte = filters.dateTo;
    }

    if (filters?.exportedBy) where.exportedBy = filters.exportedBy;
    if (filters?.status) where.status = filters.status;

    return await prisma.dataExportRecord.findMany({
      where,
      orderBy: { exportedAt: 'desc' },
      take: 100
    });
  }
}

// 导出单例实例
export const dataExportService = new DataExportService();