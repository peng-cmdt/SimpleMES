import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 工位设备预加载API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workstationId, forceReload = false } = body;
    
    if (!workstationId) {
      return NextResponse.json({
        success: false,
        error: 'workstationId is required'
      }, { status: 400 });
    }
    
    // 查询工位关联的所有设备
    const workstationDevices = await prisma.workstationDevice.findMany({
      where: { workstationId },
      include: { 
        template: true
      },
      orderBy: { createdAt: 'asc' }
    });
    
    if (workstationDevices.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No devices to preload for this workstation',
        data: {
          workstationId,
          deviceCount: 0,
          devices: []
        }
      });
    }
    
    // 准备设备列表
    const devices = workstationDevices.map(device => ({
      id: device.id,
      instanceId: device.instanceId,
      name: device.displayName,
      type: device.template.type,
      ipAddress: device.ipAddress,
      port: device.port,
      brand: device.template.brand,
      protocol: device.protocol,
      status: device.status,
      priority: device.template.type === 'PLC_CONTROLLER' ? 1 : 2 // PLC优先
    }));
    
    // 按优先级排序
    devices.sort((a, b) => a.priority - b.priority);
    
    console.log(`工位 ${workstationId} 需要预加载 ${devices.length} 个设备`);
    
    return NextResponse.json({
      success: true,
      data: {
        workstationId,
        deviceCount: devices.length,
        devices: devices.map(d => ({
          instanceId: d.instanceId,
          name: d.name,
          type: d.type,
          ipAddress: d.ipAddress,
          port: d.port
        }))
      }
    });
    
  } catch (error) {
    console.error('Workstation preload API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Preload failed'
    }, { status: 500 });
  }
}

// 获取预加载状态
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workstationId = searchParams.get('workstationId');
    
    if (!workstationId) {
      return NextResponse.json({
        success: false,
        error: 'workstationId is required'
      }, { status: 400 });
    }
    
    // 这里可以查询预加载状态
    // 由于我们使用内存管理，这个API主要用于状态查询
    
    return NextResponse.json({
      success: true,
      data: {
        workstationId,
        status: 'ready' // 简化实现
      }
    });
    
  } catch (error) {
    console.error('Get preload status error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Status query failed'
    }, { status: 500 });
  }
}