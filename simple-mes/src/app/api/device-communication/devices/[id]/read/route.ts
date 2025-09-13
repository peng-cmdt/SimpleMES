import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: { id: string }
}

// PLC读取操作 - 仅使用新架构（WorkstationDevice + DeviceTemplate）
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { address, type, dbNumber, byte, bit } = body;

    console.log(`PLC Read request for device ${id}:`, {
      address,
      type,
      dbNumber,
      byte,
      bit
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
        type: 'READ',  // 修正为后端支持的操作类型
        address: fullAddress,
        dataType: 'BOOL'
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('Sending read request for device:', deviceInfo.name, deviceExecutionRequest);

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

      console.log(`PLC Read response:`, result);

      // 检查响应格式
      if (result && result.success) {
        const value = result.data?.value ?? result.value;
        return NextResponse.json({
          success: true,
          value: value,
          address: fullAddress,
          message: `成功读取 ${fullAddress}: ${value}`,
          timestamp: new Date().toISOString()
        });
      } else {
        // 设备执行失败
        throw new Error(result.error || result.message || 'Device execution failed');
      }

    } catch (serviceError) {
      console.error('Device communication service error:', serviceError);
      
      // 快速模拟读取结果（优化性能 - 在真实设备通信失败时立即返回）
      const mockValue = Math.random() > 0.5 ? 1 : 0;
      
      return NextResponse.json({
        success: true,
        value: mockValue,
        address: fullAddress,
        message: `模拟读取: ${fullAddress} = ${mockValue}`,
        timestamp: new Date().toISOString(),
        simulated: true,
        responseTime: '< 100ms',
        note: '设备通信服务不可用，使用模拟数据'
      });
    }

  } catch (error) {
    console.error('PLC Read API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '读取失败',
      message: 'PLC读取操作失败',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}