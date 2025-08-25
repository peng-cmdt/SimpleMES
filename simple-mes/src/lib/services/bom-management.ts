import { prisma } from '@/lib/prisma';

export interface BOMItem {
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  description?: string;
}

export interface CreateBOMOptions {
  bomCode: string;
  name: string;
  productId?: string | null;
  version?: string;
  description?: string;
  status?: string;
  bomItems: BOMItem[];
  createdBy?: string;
}

export interface UpdateBOMOptions {
  bomId: string;
  bomCode?: string;
  name?: string;
  version?: string;
  description?: string;
  status?: string;
  bomItems?: BOMItem[];
  updatedBy?: string;
}

export interface BOMCopyOptions {
  sourceBomId: string;
  newBomCode: string;
  newName?: string;
  newVersion?: string;
  newDescription?: string;
  copyItems?: boolean;
}

export interface BOMValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class BOMManagementService {

  /**
   * 创建BOM
   */
  async createBOM(options: CreateBOMOptions) {
    const {
      bomCode,
      name,
      productId,
      version = '1.0',
      description,
      status = 'active',
      bomItems,
      createdBy
    } = options;

    // 验证BOM数据
    const validation = await this.validateBOM({
      bomCode,
      name,
      productId,
      bomItems
    });

    if (!validation.isValid) {
      throw new Error(`BOM验证失败: ${validation.errors.join(', ')}`);
    }

    return await prisma.$transaction(async (tx) => {
      // 检查BOM编码是否已存在
      const existingBom = await tx.bOM.findUnique({
        where: { bomCode }
      });

      if (existingBom) {
        throw new Error('BOM编码已存在');
      }

      // 验证产品是否存在（如果提供了productId）
      if (productId) {
        const product = await tx.product.findUnique({
          where: { id: productId }
        });

        if (!product) {
          throw new Error('指定的产品不存在');
        }
      }

      // 创建BOM
      const bom = await tx.bOM.create({
        data: {
          bomCode,
          name,
          productId,
          version,
          description,
          status,
          bomItems: {
            create: bomItems.map((item, index) => ({
              itemCode: item.itemCode,
              itemName: item.itemName,
              quantity: item.quantity,
              unit: item.unit,
              description: item.description
            }))
          }
        },
        include: {
          product: productId ? {
            select: {
              id: true,
              productCode: true,
              name: true
            }
          } : false,
          bomItems: {
            orderBy: { itemCode: 'asc' }
          }
        }
      });

      return bom;
    });
  }

  /**
   * 更新BOM
   */
  async updateBOM(options: UpdateBOMOptions) {
    const {
      bomId,
      bomCode,
      name,
      version,
      description,
      status,
      bomItems,
      updatedBy
    } = options;

    return await prisma.$transaction(async (tx) => {
      // 验证BOM是否存在
      const existingBom = await tx.bOM.findUnique({
        where: { id: bomId }
      });

      if (!existingBom) {
        throw new Error('BOM不存在');
      }

      // 检查BOM编码冲突
      if (bomCode && bomCode !== existingBom.bomCode) {
        const conflictBom = await tx.bOM.findUnique({
          where: { bomCode }
        });

        if (conflictBom) {
          throw new Error('BOM编码已存在');
        }
      }

      // 更新BOM基础信息
      const updatedBom = await tx.bOM.update({
        where: { id: bomId },
        data: {
          ...(bomCode && { bomCode }),
          ...(name && { name }),
          ...(version && { version }),
          ...(description !== undefined && { description }),
          ...(status && { status }),
          updatedAt: new Date()
        }
      });

      // 如果需要更新物料清单
      if (bomItems && bomItems.length > 0) {
        // 删除现有的物料明细
        await tx.bOMItem.deleteMany({
          where: { bomId }
        });

        // 创建新的物料明细
        await tx.bOMItem.createMany({
          data: bomItems.map(item => ({
            bomId,
            itemCode: item.itemCode,
            itemName: item.itemName,
            quantity: item.quantity,
            unit: item.unit,
            description: item.description
          }))
        });
      }

      // 返回更新后的完整BOM信息
      return await tx.bOM.findUnique({
        where: { id: bomId },
        include: {
          product: {
            select: {
              id: true,
              productCode: true,
              name: true
            }
          },
          bomItems: {
            orderBy: { itemCode: 'asc' }
          }
        }
      });
    });
  }

  /**
   * 复制BOM
   */
  async copyBOM(options: BOMCopyOptions) {
    const {
      sourceBomId,
      newBomCode,
      newName,
      newVersion,
      newDescription,
      copyItems = true
    } = options;

    return await prisma.$transaction(async (tx) => {
      // 获取源BOM
      const sourceBom = await tx.bOM.findUnique({
        where: { id: sourceBomId },
        include: {
          bomItems: true
        }
      });

      if (!sourceBom) {
        throw new Error('源BOM不存在');
      }

      // 检查新BOM编码是否已存在
      const existingBom = await tx.bOM.findUnique({
        where: { bomCode: newBomCode }
      });

      if (existingBom) {
        throw new Error('新BOM编码已存在');
      }

      // 创建新BOM
      const newBom = await tx.bOM.create({
        data: {
          bomCode: newBomCode,
          name: newName || `${sourceBom.name} (副本)`,
          productId: sourceBom.productId,
          version: newVersion || sourceBom.version,
          description: newDescription || sourceBom.description,
          status: 'active',
          bomItems: copyItems ? {
            create: sourceBom.bomItems.map(item => ({
              itemCode: item.itemCode,
              itemName: item.itemName,
              quantity: item.quantity,
              unit: item.unit,
              description: item.description
            }))
          } : undefined
        },
        include: {
          product: {
            select: {
              id: true,
              productCode: true,
              name: true
            }
          },
          bomItems: {
            orderBy: { itemCode: 'asc' }
          }
        }
      });

      return newBom;
    });
  }

  /**
   * 删除BOM
   */
  async deleteBOM(bomId: string) {
    return await prisma.$transaction(async (tx) => {
      // 检查BOM是否存在
      const bom = await tx.bOM.findUnique({
        where: { id: bomId }
      });

      if (!bom) {
        throw new Error('BOM不存在');
      }

      // 删除BOM（物料明细会因为级联删除而自动删除）
      await tx.bOM.delete({
        where: { id: bomId }
      });

      return { success: true, message: 'BOM删除成功' };
    });
  }

  /**
   * 获取BOM详情
   */
  async getBOMDetail(bomId: string) {
    const bom = await prisma.bOM.findUnique({
      where: { id: bomId },
      include: {
        product: {
          select: {
            id: true,
            productCode: true,
            name: true,
            description: true
          }
        },
        bomItems: {
          orderBy: { itemCode: 'asc' }
        },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            quantity: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        _count: {
          select: {
            orders: true
          }
        }
      }
    });

    if (!bom) {
      throw new Error('BOM不存在');
    }

    return bom;
  }

  /**
   * 获取产品的BOM列表
   */
  async getProductBOMs(productId: string) {
    return await prisma.bOM.findMany({
      where: { productId },
      include: {
        bomItems: {
          orderBy: { itemCode: 'asc' }
        },
        _count: {
          select: {
            orders: true
          }
        }
      },
      orderBy: [
        { status: 'desc' }, // active优先
        { version: 'desc' }, // 版本号倒序
        { createdAt: 'desc' }
      ]
    });
  }

  /**
   * 验证BOM数据
   */
  async validateBOM(bomData: {
    bomCode: string;
    name: string;
    productId?: string | null;
    bomItems: BOMItem[];
  }): Promise<BOMValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 验证基本字段
    if (!bomData.bomCode?.trim()) {
      errors.push('BOM编码不能为空');
    }

    if (!bomData.name?.trim()) {
      errors.push('BOM名称不能为空');
    }

    // productId现在是可选的，不再强制要求
    // if (!bomData.productId?.trim()) {
    //   errors.push('产品ID不能为空');
    // }

    // 验证物料清单
    if (!bomData.bomItems || bomData.bomItems.length === 0) {
      warnings.push('BOM没有物料明细');
    } else {
      const itemCodes = new Set<string>();
      
      for (let i = 0; i < bomData.bomItems.length; i++) {
        const item = bomData.bomItems[i];
        const itemIndex = i + 1;

        if (!item.itemCode?.trim()) {
          errors.push(`第${itemIndex}行物料编码不能为空`);
        }

        if (!item.itemName?.trim()) {
          errors.push(`第${itemIndex}行物料名称不能为空`);
        }

        if (!item.quantity || item.quantity <= 0) {
          errors.push(`第${itemIndex}行数量必须大于0`);
        }

        if (!item.unit?.trim()) {
          errors.push(`第${itemIndex}行单位不能为空`);
        }

        // 检查重复的物料编码
        if (item.itemCode && itemCodes.has(item.itemCode)) {
          errors.push(`物料编码 ${item.itemCode} 重复`);
        } else if (item.itemCode) {
          itemCodes.add(item.itemCode);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 获取BOM使用统计
   */
  async getBOMUsageStatistics(bomId: string) {
    const [orderStats, recentOrders] = await Promise.all([
      // 订单统计
      prisma.order.groupBy({
        by: ['status'],
        where: { bomId },
        _count: { id: true },
        _sum: { quantity: true }
      }),

      // 最近订单
      prisma.order.findMany({
        where: { bomId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          quantity: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);

    const totalOrders = orderStats.reduce((sum, stat) => sum + stat._count.id, 0);
    const totalQuantity = orderStats.reduce((sum, stat) => sum + (stat._sum.quantity || 0), 0);

    return {
      totalOrders,
      totalQuantity,
      statusBreakdown: orderStats,
      recentOrders
    };
  }

  /**
   * 批量导入BOM
   */
  async batchImportBOMs(bomsData: CreateBOMOptions[]) {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (let i = 0; i < bomsData.length; i++) {
      try {
        await this.createBOM(bomsData[i]);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(
          `第${i + 1}个BOM (${bomsData[i].bomCode}): ${
            error instanceof Error ? error.message : '未知错误'
          }`
        );
      }
    }

    return results;
  }
}

// 导出单例实例
export const bomManagementService = new BOMManagementService();