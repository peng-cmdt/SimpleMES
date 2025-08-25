import { NextRequest, NextResponse } from 'next/server';
import { deviceCommunicationClient } from '@/lib/device-communication/client';

// 获取所有设备配置
export async function GET() {
  try {
    const devices = await deviceCommunicationClient.getDevices();
    return NextResponse.json({ devices });
  } catch (error) {
    console.error('Get devices API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get devices',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// 创建新设备配置
export async function POST(request: NextRequest) {
  try {
    const deviceConfig = await request.json();
    
    // 基本验证
    if (!deviceConfig.name || !deviceConfig.deviceType || !deviceConfig.connection) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const newDevice = await deviceCommunicationClient.createDevice(deviceConfig);
    return NextResponse.json({ device: newDevice });
  } catch (error) {
    console.error('Create device API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create device',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}