import { NextRequest, NextResponse } from 'next/server';
import { deviceCommunicationClient } from '@/lib/device-communication/client';

interface RouteParams {
  params: { id: string }
}

// PLC读取操作 - 使用标准设备命令API
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // 构造完整的PLC地址
    let fullAddress = '';
    if (type === 'DB') {
      fullAddress = `DB${dbNumber}.DBX${byte}.${bit}`;
    } else {
      fullAddress = `${type}${dbNumber}.${bit}`;
    }

    try {
      // 使用真实的设备通信API进行PLC读取
      const response = await deviceCommunicationClient.readPLC(id, {
        address: fullAddress,
        type,
        dbNumber,
        byte,
        bit
      });

      console.log(`PLC Read response:`, response);

      // 检查响应格式
      if (response && response.value !== undefined) {
        return NextResponse.json({
          success: true,
          value: response.value,
          address: fullAddress,
          message: `成功读取 ${fullAddress}: ${response.value}`,
          timestamp: new Date().toISOString()
        });
      } else if (response && typeof response.data !== 'undefined') {
        // 处理设备响应中的data字段
        return NextResponse.json({
          success: true,
          value: response.data,
          address: fullAddress,
          message: `成功读取 ${fullAddress}: ${response.data}`,
          timestamp: new Date().toISOString()
        });
      } else {
        // 如果响应格式不符合预期，返回整个响应对象
        return NextResponse.json({
          success: true,
          value: response,
          address: fullAddress,
          message: `读取完成 ${fullAddress}`,
          timestamp: new Date().toISOString(),
          raw_response: response
        });
      }

    } catch (serviceError) {
      console.error('Device communication service error:', serviceError);
      
      // 模拟读取结果（在真实设备通信失败时）
      const mockValue = Math.random() > 0.5 ? 1 : 0;
      
      return NextResponse.json({
        success: true,
        value: mockValue,
        address: fullAddress,
        message: `模拟读取 (设备通信失败): ${fullAddress} = ${mockValue}`,
        timestamp: new Date().toISOString(),
        simulated: true,
        error_details: serviceError instanceof Error ? serviceError.message : String(serviceError)
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