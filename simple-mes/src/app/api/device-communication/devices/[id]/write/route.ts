import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: { id: string }
}

// PLC写入操作 - 仅使用新架构（WorkstationDevice + DeviceTemplate）
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { address, type, dbNumber, byte, bit, value } = body;

    console.log(`PLC Write request for device ${id}:`, {
      address,
      type,
      dbNumber,
      byte,
      bit,
      value
    });

    // 获取设备信息（仅使用新架构）
    const workstationDevice = await prisma.workstationDevice.findUnique({
      where: { instanceId: id },
      include: { template: true }
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

    // 根据PLC类型构造正确的地址格式
    let fullAddress = '';
    const isPlc6000Port = deviceInfo?.port === 6000 || 
                         deviceInfo?.brand?.toLowerCase().includes('mitsubishi') ||
                         deviceInfo?.type?.toLowerCase().includes('mitsubishi');
    
    if (isPlc6000Port) {
      // 三菱PLC地址格式
      if (type === 'DB') {
        // 三菱PLC使用D寄存器 (数据寄存器)
        if (bit !== undefined && bit !== null && (byte !== undefined && byte !== null)) {
          // 位操作：D寄存器的位寻址 D100.0 表示D100寄存器的第0位
          const bitPosition = byte * 8 + bit;
          fullAddress = `D${dbNumber}.${bitPosition}`;
        } else if (bit !== undefined && bit !== null) {
          // 仅有位号，直接使用
          fullAddress = `D${dbNumber}.${bit}`;
        } else {
          // 字操作：使用D寄存器 D100 表示整个16位寄存器
          fullAddress = `D${dbNumber}`;
        }
      } else {
        // 其他寄存器类型 (M, X, Y等)
        fullAddress = `${type}${dbNumber}${bit !== undefined ? '.' + bit : ''}`;
      }
    } else {
      // 西门子PLC地址格式（原有逻辑）
      if (type === 'DB') {
        fullAddress = `DB${dbNumber}.DBX${byte}.${bit}`;
      } else {
        fullAddress = `${type}${dbNumber}.${bit}`;
      }
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
        type: 'WRITE',  // 修正为后端支持的操作类型
        address: fullAddress,
        value: value,
        dataType: 'BOOL'
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('Sending write request for device:', deviceInfo.name, deviceExecutionRequest);

    try {
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

      console.log(`PLC Write response:`, result);

      // 检查响应格式
      if (result && result.success) {
        return NextResponse.json({
          success: true,
          value: value,
          address: fullAddress,
          message: `成功写入 ${fullAddress} = ${value}`,
          timestamp: new Date().toISOString()
        });
      } else {
        // 设备执行失败
        throw new Error(result.error || result.message || 'Device execution failed');
      }

    } catch (serviceError) {
      console.error('Device communication service error:', serviceError);
      
      // 设备通信服务不可用，返回错误而不是假成功
      return NextResponse.json({
        success: false,
        error: serviceError instanceof Error ? serviceError.message : '设备通信服务不可用',
        message: `写入失败: 无法连接到设备通信服务 (${fullAddress})`,
        timestamp: new Date().toISOString(),
        address: fullAddress,
        value: value,
        serviceError: true
      }, { status: 503 });
    }

  } catch (error) {
    console.error('PLC Write API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '写入失败',
      message: 'PLC写入操作失败',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}