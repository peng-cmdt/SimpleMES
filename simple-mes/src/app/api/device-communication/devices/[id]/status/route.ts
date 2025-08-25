import { NextRequest, NextResponse } from 'next/server';
import { deviceCommunicationClient } from '@/lib/device-communication/client';

interface RouteParams {
  params: { id: string }
}

// 获取设备状态
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const status = await deviceCommunicationClient.getDeviceStatus(params.id);
    return NextResponse.json({ status });
  } catch (error) {
    console.error('Get device status API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get device status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}