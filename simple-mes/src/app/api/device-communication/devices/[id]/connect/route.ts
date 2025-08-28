import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: { id: string }
}

// 连接设备 - 使用新架构
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    console.log('Connect API - Received device ID:', id);
    
    // 尝试从两种架构中获取设备信息
    // 1. 首先尝试从旧架构（devices表）获取
    let device = await prisma.device.findUnique({
      where: { id }
    });
    
    let deviceInfo: any = null;
    
    if (device) {
      console.log('Connect API - Found device in legacy architecture:', device.name);
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
        console.log('Connect API - Found device in new architecture:', workstationDevice.displayName);
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
      console.log('Connect API - Device not found in either architecture');
      return NextResponse.json({
        success: false,
        error: 'Device not found in database',
        details: `Searched for ID: ${id}`
      }, { status: 404 });
    }
    
    // 构建设备执行请求
    const deviceExecutionRequest = {
      deviceId: deviceInfo.deviceId,
      deviceType: deviceInfo.type || 'PLC',
      deviceInfo: {
        ipAddress: deviceInfo.ipAddress,
        port: deviceInfo.port,
        plcType: deviceInfo.brand || 'Siemens_S7',
        protocol: deviceInfo.protocol || 'TCP/IP'
      },
      operation: {
        type: 'CONNECT',
        address: '',
        dataType: 'BOOL'
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('Sending connect request for device:', deviceInfo.name, deviceExecutionRequest);
    
    // 调用.NET设备通信服务的执行API
    const dotnetServiceUrl = 'http://localhost:5000';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
    
    const response = await fetch(`${dotnetServiceUrl}/api/devices/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deviceExecutionRequest),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Device service error:', errorText);
      throw new Error(`Device service returned ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    // 更新数据库中的连接状态
    if (result.success) {
      // 根据设备架构更新不同的表
      if (device) {
        // 旧架构 - 更新devices表
        await prisma.device.update({
          where: { id },
          data: {
            status: 'ONLINE',
            lastHeartbeat: new Date()
          }
        });
      } else {
        // 新架构 - 更新workstationDevices表
        await prisma.workstationDevice.update({
          where: { id },
          data: {
            status: 'ONLINE',
            lastHeartbeat: new Date()
          }
        });
      }
    }
    
    return NextResponse.json({
      success: result.success,
      message: result.message || `Device ${deviceInfo.name} connected successfully`,
      data: {
        deviceId: deviceInfo.deviceId,
        deviceName: deviceInfo.name,
        ipAddress: deviceInfo.ipAddress,
        port: deviceInfo.port,
        status: result.success ? 'CONNECTED' : 'ERROR'
      }
    });
  } catch (error) {
    console.error('Connect device API error:', error);
    
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Connection timeout',
          message: '设备连接超时 - 请检查设备是否在线并可访问'
        },
        { status: 408 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to connect device',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}