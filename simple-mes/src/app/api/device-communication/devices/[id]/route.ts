import { NextRequest, NextResponse } from 'next/server';
import { deviceCommunicationClient } from '@/lib/device-communication/client';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>
}

// 获取单个设备配置
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    // 直接从数据库获取设备信息，不依赖.NET服务
    const workstationDevice = await prisma.workstationDevice.findUnique({
      where: { instanceId: id },
      include: { 
        template: true,
        workstation: {
          select: {
            id: true,
            workstationId: true,
            name: true
          }
        }
      }
    });
    
    if (!workstationDevice) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }
    
    // 转换为设备通信客户端期望的格式
    const device = {
      deviceId: workstationDevice.instanceId,
      name: workstationDevice.displayName,
      type: workstationDevice.template.type,
      ipAddress: workstationDevice.ipAddress,
      port: workstationDevice.port,
      brand: workstationDevice.template.brand,
      model: workstationDevice.template.model,
      protocol: workstationDevice.protocol,
      connectionString: workstationDevice.connectionString,
      status: workstationDevice.status,
      isOnline: workstationDevice.isOnline,
      lastHeartbeat: workstationDevice.lastHeartbeat
    };
    
    return NextResponse.json({ device });
  } catch (error) {
    console.error('Get device API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get device',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// 更新设备配置
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const deviceConfig = await request.json();
    const updatedDevice = await deviceCommunicationClient.updateDevice(id, deviceConfig);
    return NextResponse.json({ device: updatedDevice });
  } catch (error) {
    console.error('Update device API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update device',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// 删除设备配置
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deviceCommunicationClient.deleteDevice(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete device API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete device',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}