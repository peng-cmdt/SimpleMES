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

    // 查找工位（支持两种查找方式），使用新的设备架构
    let workstation = await prisma.workstation.findUnique({
      where: { workstationId },
      include: {
        workstationDevices: {
          include: {
            template: true
          },
          orderBy: {
            displayName: 'asc'
          }
        }
      }
    });

    // 如果通过workstationId没找到，尝试通过数据库ID查找
    if (!workstation) {
      workstation = await prisma.workstation.findUnique({
        where: { id: workstationId },
        include: {
          workstationDevices: {
            include: {
              template: true
            },
            orderBy: {
              displayName: 'asc'
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

    // 现在只使用新的设备架构，不再有旧设备架构
    const legacyDevices: any[] = [];

    // 转换新设备架构数据格式
    const newDevices = workstation.workstationDevices.map(workstationDevice => ({
      id: workstationDevice.id,
      deviceId: workstationDevice.instanceId,
      name: workstationDevice.displayName,
      type: workstationDevice.template.type,
      brand: workstationDevice.template.brand,
      model: workstationDevice.template.model,
      description: workstationDevice.template.description,
      ipAddress: workstationDevice.ipAddress,
      port: workstationDevice.port,
      protocol: workstationDevice.protocol,
      status: workstationDevice.status,
      isOnline: workstationDevice.isOnline,
      lastConnected: workstationDevice.lastConnected?.toISOString(),
      lastHeartbeat: workstationDevice.lastHeartbeat?.toISOString(),
      settings: workstationDevice.config,
      capabilities: workstationDevice.template.capabilities,
      createdAt: workstationDevice.createdAt.toISOString(),
      updatedAt: workstationDevice.updatedAt.toISOString(),
      source: 'new', // 标记数据源
      templateId: workstationDevice.template.templateId,
      templateName: workstationDevice.template.name
    }));

    // 合并新旧设备数据
    const devices = [...legacyDevices, ...newDevices];

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
      deviceCount: devices.length,
      legacyDeviceCount: legacyDevices.length,
      newDeviceCount: newDevices.length,
      supportsBothArchitectures: true
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