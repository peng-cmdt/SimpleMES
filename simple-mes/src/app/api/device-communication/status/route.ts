import { NextRequest, NextResponse } from 'next/server';
import { deviceCommunicationClient } from '@/lib/device-communication/client';

// 获取所有设备状态
export async function GET() {
  try {
    const statuses = await deviceCommunicationClient.getAllDeviceStatus();
    return NextResponse.json(statuses);
  } catch (error) {
    console.error('Get all device status API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get device statuses',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}