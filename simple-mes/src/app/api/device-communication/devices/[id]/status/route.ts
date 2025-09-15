import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 简单的内存缓存 - 工业性能优化
const deviceInfoCache = new Map<string, {
  data: any;
  timestamp: number;
  ttl: number;
}>();
const CACHE_TTL = 5000; // 5秒缓存

interface RouteParams {
  params: { id: string }
}

// 获取设备状态 - 仅使用新架构（WorkstationDevice + DeviceTemplate）
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    console.log('Status API - Received device ID:', id);
    
    // 检查缓存 - 工业性能优化
    const cached = deviceInfoCache.get(id);
    let workstationDevice = null;
    
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      console.log('Status API - Using cached device info for:', id);
      workstationDevice = cached.data;
    } else {
      // 缓存未命中或过期，查询数据库
      workstationDevice = await prisma.workstationDevice.findUnique({
        where: { instanceId: id },
        include: { template: true }
      });
      
      // 如果通过instanceId没找到，尝试通过数据库ID查找
      if (!workstationDevice) {
        console.log('Status API - Device not found by instanceId, trying database ID...');
        workstationDevice = await prisma.workstationDevice.findUnique({
          where: { id: id },
          include: { template: true }
        });
      }
      
      // 更新缓存
      if (workstationDevice) {
        deviceInfoCache.set(id, {
          data: workstationDevice,
          timestamp: Date.now(),
          ttl: CACHE_TTL
        });
      }
    }
    
    if (!workstationDevice) {
      console.log('Status API - Workstation device not found by either instanceId or database ID');
      return NextResponse.json({
        success: false,
        isConnected: false,
        error: 'Workstation device not found'
      }, { status: 404 });
    }

    console.log('Status API - Found workstation device:', workstationDevice.displayName);
    const deviceInfo = {
      deviceId: workstationDevice.instanceId,
      name: workstationDevice.displayName,
      type: workstationDevice.template.type,
      ipAddress: workstationDevice.ipAddress,
      port: workstationDevice.port,
      brand: workstationDevice.template.brand,
      protocol: workstationDevice.protocol
    };
    
    // 尝试向.NET服务查询设备状态
    try {
      const dotnetServiceUrl = 'http://localhost:5000';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5秒超时，工业优化
      
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