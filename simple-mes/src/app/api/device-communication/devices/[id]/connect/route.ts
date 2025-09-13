import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: { id: string }
}

// 连接设备
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    console.log('Connect API - Received device ID:', id);
    
    // 获取工位设备信息
    const workstationDevice = await prisma.workstationDevice.findUnique({
      where: { instanceId: id },
      include: { template: true }
    });
    
    if (!workstationDevice) {
      console.log('Connect API - Device not found');
      return NextResponse.json({
        success: false,
        error: 'Device not found in database',
        details: `Searched for ID: ${id}`
      }, { status: 404 });
    }
    
    console.log('Connect API - Found device:', workstationDevice.displayName);
    const deviceInfo = {
      deviceId: workstationDevice.instanceId,
      name: workstationDevice.displayName,
      type: workstationDevice.template.type,
      ipAddress: workstationDevice.ipAddress,
      port: workstationDevice.port,
      brand: workstationDevice.template.brand,
      protocol: workstationDevice.protocol
    };
    
    // 构建设备执行请求 - 转换设备类型以匹配.NET后端期望的格式
    const deviceType = deviceInfo.type === 'PLC_CONTROLLER' ? 'PLC' : (deviceInfo.type || 'PLC');
    const deviceExecutionRequest = {
      deviceId: deviceInfo.deviceId,
      deviceType: deviceType,
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
      
      // Try to parse the error response from .NET service
      let detailedError = `Device service returned ${response.status}: ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error || errorJson.message) {
          detailedError = errorJson.error || errorJson.message;
        }
      } catch (parseError) {
        // If we can't parse JSON, use the raw error text
        if (errorText) {
          detailedError = errorText;
        }
      }
      
      throw new Error(detailedError);
    }

    const result = await response.json();
    
    // 更新数据库中的连接状态
    if (result.success) {
      await prisma.workstationDevice.update({
        where: { instanceId: id },
        data: {
          status: 'ONLINE',
          lastHeartbeat: new Date()
        }
      });
    }
    
    // 返回包含详细错误信息的结果
    return NextResponse.json({
      success: result.success,
      message: result.message || (result.success ? `Device ${deviceInfo.name} connected successfully` : `Failed to connect to ${deviceInfo.name}`),
      error: result.error || result.message, // 包含详细的错误信息
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
        error: error instanceof Error ? error.message : 'Failed to connect device',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}