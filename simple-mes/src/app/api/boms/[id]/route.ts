import { NextRequest, NextResponse } from 'next/server';
import { bomManagementService } from '@/lib/services/bom-management';

// GET /api/boms/[id] - 获取单个BOM详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const includeUsage = searchParams.get('includeUsage') === 'true';

    const bom = await bomManagementService.getBOMDetail(id);

    let result = { ...bom };
    
    if (includeUsage) {
      const usage = await bomManagementService.getBOMUsageStatistics(id);
      result = { ...bom, usage };
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('获取BOM详情失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '获取BOM详情失败' 
      },
      { status: error instanceof Error && error.message === 'BOM不存在' ? 404 : 500 }
    );
  }
}

// PUT /api/boms/[id] - 更新BOM
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { 
      bomCode, 
      name, 
      version, 
      description, 
      status, 
      bomItems, 
      updatedBy 
    } = body;

    const updatedBom = await bomManagementService.updateBOM({
      bomId: id,
      bomCode,
      name,
      version,
      description,
      status,
      bomItems,
      updatedBy
    });

    return NextResponse.json({
      success: true,
      data: updatedBom,
      message: 'BOM更新成功'
    });

  } catch (error) {
    console.error('更新BOM失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '更新BOM失败' 
      },
      { status: error instanceof Error && error.message === 'BOM不存在' ? 404 : 500 }
    );
  }
}

// DELETE /api/boms/[id] - 删除BOM
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await bomManagementService.deleteBOM(id);

    return NextResponse.json({
      success: true,
      message: 'BOM删除成功'
    });

  } catch (error) {
    console.error('删除BOM失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '删除BOM失败' 
      },
      { status: error instanceof Error && error.message === 'BOM不存在' ? 404 : 500 }
    );
  }
}