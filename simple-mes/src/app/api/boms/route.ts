import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { bomManagementService } from '@/lib/services/bom-management';

// GET /api/boms - 获取BOM列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const productId = searchParams.get('productId');
    const status = searchParams.get('status');
    const includeUsage = searchParams.get('includeUsage') === 'true';

    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: {
      OR?: Array<{ [key: string]: { contains: string } }>;
      productId?: string;
      status?: string;
    } = {};
    
    if (search) {
      where.OR = [
        { bomCode: { contains: search } },
        { name: { contains: search } },
        { description: { contains: search } }
      ];
    }
    
    if (productId) {
      where.productId = productId;
    }
    
    if (status) {
      where.status = status;
    }

    // 获取总数
    const total = await prisma.bOM.count({ where });

    // 获取BOM列表
    const boms = await prisma.bOM.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            productCode: true,
            name: true
          }
        },
        bomItems: {
          select: {
            id: true,
            itemCode: true,
            itemName: true,
            quantity: true,
            unit: true,
            description: true
          }
        },
        _count: {
          select: {
            bomItems: true,
            orders: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });

    // 如果需要使用统计信息
    let bomsWithUsage = boms;
    if (includeUsage) {
      bomsWithUsage = await Promise.all(
        boms.map(async (bom) => {
          const usage = await bomManagementService.getBOMUsageStatistics(bom.id);
          return { ...bom, usage };
        })
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        boms: bomsWithUsage,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('获取BOM列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取BOM列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/boms - 创建新BOM或批量导入
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action = 'create', ...data } = body;

    if (action === 'batchImport') {
      // 批量导入BOM
      const { boms } = data;
      
      if (!Array.isArray(boms) || boms.length === 0) {
        return NextResponse.json(
          { success: false, error: '批量导入数据不能为空' },
          { status: 400 }
        );
      }

      const results = await bomManagementService.batchImportBOMs(boms);

      return NextResponse.json({
        success: true,
        data: results,
        message: `批量导入完成 - 成功: ${results.success}, 失败: ${results.failed}`
      });

    } else if (action === 'copy') {
      // 复制BOM
      const { sourceBomId, newBomCode, newName, newVersion, newDescription, copyItems } = data;

      if (!sourceBomId || !newBomCode) {
        return NextResponse.json(
          { success: false, error: '源BOM ID和新BOM编码不能为空' },
          { status: 400 }
        );
      }

      const newBom = await bomManagementService.copyBOM({
        sourceBomId,
        newBomCode,
        newName,
        newVersion,
        newDescription,
        copyItems
      });

      return NextResponse.json({
        success: true,
        data: newBom,
        message: 'BOM复制成功'
      });

    } else {
      // 创建单个BOM
      const { bomCode, name, productId, version, description, status, bomItems = [], createdBy } = data;

      // 验证必填字段
      if (!bomCode || !name) {
        return NextResponse.json(
          { success: false, error: 'BOM编码和名称不能为空' },
          { status: 400 }
        );
      }

      const bom = await bomManagementService.createBOM({
        bomCode,
        name,
        productId,
        version,
        description,
        status,
        bomItems,
        createdBy
      });

      return NextResponse.json({
        success: true,
        data: bom,
        message: 'BOM创建成功'
      });
    }

  } catch (error) {
    console.error('BOM操作失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'BOM操作失败' 
      },
      { status: 500 }
    );
  }
}