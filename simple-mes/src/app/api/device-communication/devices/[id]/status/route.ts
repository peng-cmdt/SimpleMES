import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: { id: string }
}

// 获取设备状态（新架构）
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    console.log('Status API - Received device ID:', id);
    
    // 尝试从两种架构中获取设备信息
    // 1. 首先尝试从旧架构（devices表）获取
    let device = await prisma.device.findUnique({
      where: { id }
    });
    
    let deviceInfo: any = null;
    
    if (device) {
      console.log('Status API - Found device in legacy architecture:', device.name);
      deviceInfo = {
        deviceId: device.deviceId,
        name: device.name,
        type: device.type,
        ipAddress: device.ipAddress,
        port: device.port,
        brand: device.brand,
        protocol: device.protocol
      };
    } else {
      // 2. 如果旧架构没找到，尝试从新架构（workstationDevices表）获取
      const workstationDevice = await prisma.workstationDevice.findUnique({
        where: { id },
        include: { template: true }
      });
      
      if (workstationDevice) {
        console.log('Status API - Found device in new architecture:', workstationDevice.displayName);
        deviceInfo = {
          deviceId: workstationDevice.instanceId,
          name: workstationDevice.displayName,
          type: workstationDevice.template.type,
          ipAddress: workstationDevice.ipAddress,
          port: workstationDevice.port,
          brand: workstationDevice.template.brand,
          protocol: workstationDevice.protocol
        };
      }
    }
    
    if (!deviceInfo) {
      console.log('Status API - Device not found in either architecture');
      return NextResponse.json({
        success: false,
        isConnected: false,
        error: 'Device not found'
      }, { status: 404 });
    }
    
    // 尝试向.NET服务查询设备状态
    try {
      const dotnetServiceUrl = 'http://localhost:5000';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2秒超时
      
      const response = await fetch(`${dotnetServiceUrl}/api/devices/${deviceInfo.deviceId}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const status = await response.json();
        return NextResponse.json({ 
          success: true,
          isConnected: status.isOnline || status.status === 'ONLINE' || status.status === 'Connected',
          status: status.status,
          data: { 
            deviceId: deviceInfo.deviceId, 
            deviceName: deviceInfo.name,
            ipAddress: deviceInfo.ipAddress,
            port: deviceInfo.port,
            status 
          }
        });
      }
    } catch (error) {
      console.log('Device not registered in .NET service yet, returning offline status');
    }
    
    // 如果.NET服务没有该设备信息，返回离线状态
    return NextResponse.json({ 
      success: true,
      isConnected: false,
      status: 'OFFLINE',
      data: { 
        deviceId: deviceInfo.deviceId,
        deviceName: deviceInfo.name,
        ipAddress: deviceInfo.ipAddress,
        port: deviceInfo.port,
        status: {
          deviceId: deviceInfo.deviceId,
          status: 'OFFLINE',
          isOnline: false,
          error: 'Device not registered in communication service'
        }
      }
    });
  } catch (error) {
    console.error('Get device status API error:', error);
    return NextResponse.json(
      { 
        success: false,
        isConnected: false,
        error: 'Failed to get device status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}