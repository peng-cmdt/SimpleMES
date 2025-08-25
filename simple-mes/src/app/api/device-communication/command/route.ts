import { NextRequest, NextResponse } from 'next/server';
import { deviceCommunicationClient } from '@/lib/device-communication/client';

// 代理到C#服务的设备命令API
export async function POST(request: NextRequest) {
  try {
    const deviceRequest = await request.json();
    
    // 验证请求格式
    if (!deviceRequest.deviceId || !deviceRequest.command) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    // 转发到C#服务
    const response = await deviceCommunicationClient.sendCommand(deviceRequest);
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Device command API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}