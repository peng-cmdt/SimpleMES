import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workstationId: string }> }
) {
  try {
    const { workstationId } = await params;

    if (!workstationId) {
      return NextResponse.json({ error: 'Workstation ID is required' }, { status: 400 });
    }

    // 查找工位（支持两种查找方式）
    let workstation = await prisma.workstation.findUnique({
      where: { workstationId },
      include: {
        devices: {
          orderBy: {
            name: 'asc'
          }
        }
      }
    });

    // 如果通过workstationId没找到，尝试通过数据库ID查找
    if (!workstation) {
      workstation = await prisma.workstation.findUnique({
        where: { id: workstationId },
        include: {
          devices: {
            orderBy: {
              name: 'asc'
            }
          }
        }
      });
    }

    if (!workstation) {
      return NextResponse.json({ 
        error: 'Workstation not found', 
        searchedId: workstationId 
      }, { status: 404 });
    }

    // 转换设备数据格式
    const devices = workstation.devices.map(device => ({
      id: device.id,
      deviceId: device.deviceId,
      name: device.name,
      type: device.type,
      brand: device.brand,
      model: device.model,
      description: device.description,
      ipAddress: device.ipAddress,
      port: device.port,
      protocol: device.protocol,
      status: device.status,
      isOnline: device.isOnline,
      lastConnected: device.lastConnected?.toISOString(),
      lastHeartbeat: device.lastHeartbeat?.toISOString(),
      settings: device.settings,
      capabilities: device.capabilities,
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString()
    }));

    return NextResponse.json({
      success: true,
      workstation: {
        id: workstation.id,
        workstationId: workstation.workstationId,
        name: workstation.name,
        description: workstation.description,
        location: workstation.location,
        type: workstation.type,
        configuredIp: workstation.configuredIp,
        currentIp: workstation.currentIp
      },
      devices,
      deviceCount: devices.length
    });

  } catch (error) {
    console.error('Error fetching workstation devices:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}