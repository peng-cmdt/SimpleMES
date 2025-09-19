import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 查询设备配置信息 - 用于预加载
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // 查询设备配置
    const device = await prisma.workstationDevice.findUnique({
      where: { instanceId: id },
      include: { 
        template: true,
        workstation: true
      }
    });
    
    if (!device) {
      return NextResponse.json({
        success: false,
        error: 'Device not found'
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      data: device
    });
    
  } catch (error) {
    console.error('Device lookup error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Lookup failed'
    }, { status: 500 });
  }
}