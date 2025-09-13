import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 执行设备操作 - 仅使用新架构（WorkstationDevice + DeviceTemplate）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { actionId, actionType, deviceId, actionData } = body;

    // 获取设备配置信息（仅使用新架构）
    const workstationDevice = await prisma.workstationDevice.findUnique({
      where: { id: deviceId },
      include: { 
        template: true,
        workstation: true
      }
    });
    
    if (!workstationDevice) {
      return NextResponse.json({
        success: false,
        error: 'Workstation device not found'
      }, { status: 404 });
    }

    const deviceInfo = {
      deviceId: workstationDevice.instanceId,
      name: workstationDevice.displayName,
      type: workstationDevice.template.type,
      ipAddress: workstationDevice.ipAddress,
      port: workstationDevice.port,
      brand: workstationDevice.template.brand,
      protocol: workstationDevice.protocol
    };

    // 构建设备操作请求的JSON格式
    const deviceRequest = {
      deviceId: deviceInfo.deviceId,
      deviceType: deviceInfo.type,
      deviceInfo: {
        ipAddress: deviceInfo.ipAddress,
        port: deviceInfo.port,
        plcType: deviceInfo.brand || deviceInfo.type,
        protocol: deviceInfo.protocol || 'TCP/IP'
      },
      operation: {
        type: actionType, // DEVICE_READ 或 DEVICE_WRITE
        address: actionData.address || actionData.deviceAddress,
        value: actionData.value || null,
        dataType: actionData.dataType || 'BOOL',
        parameters: actionData.parameters || {}
      },
      timestamp: new Date().toISOString()
    };

    console.log('Sending device operation request:', JSON.stringify(deviceRequest, null, 2));

    // 发送请求到.NET后端服务
    const response = await fetch('http://localhost:5001/api/devices/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deviceRequest),
      signal: AbortSignal.timeout(5000) // 5秒超时
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('.NET service error:', errorText);
      return NextResponse.json({
        success: false,
        error: `Device service error: ${response.status}`,
        details: errorText
      }, { status: 500 });
    }

    const result = await response.json();
    console.log('Device operation result:', result);

    // 记录操作日志
    if (actionId) {
      await prisma.actionLog.create({
        data: {
          actionId: actionId,
          orderStepId: actionData.orderStepId || '',
          deviceId: deviceId,  // Use the ID passed from frontend
          status: result.success ? 'SUCCESS' : 'FAILED',
          requestValue: JSON.stringify(deviceRequest),
          responseValue: JSON.stringify(result),
          actualValue: result.data?.value?.toString() || null,
          validationResult: result.success,
          executionTime: Date.now() - new Date(deviceRequest.timestamp).getTime(),
          errorMessage: result.error || null,
          parameters: deviceRequest.operation.parameters,
          result: result
        }
      });
    }

    // 返回标准格式的响应
    return NextResponse.json({
      success: result.success,
      data: {
        value: result.data?.value,
        status: result.data?.status,
        message: result.message,
        timestamp: result.timestamp || new Date().toISOString()
      },
      error: result.error || null
    });

  } catch (error) {
    console.error('Device operation API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}