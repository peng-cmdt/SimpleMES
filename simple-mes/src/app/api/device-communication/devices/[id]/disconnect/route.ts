import { NextRequest, NextResponse } from 'next/server';
import { deviceCommunicationClient } from '@/lib/device-communication/client';

interface RouteParams {
  params: { id: string }
}

// 断开设备连接
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const response = await deviceCommunicationClient.disconnectDevice(params.id);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Disconnect device API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to disconnect device',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}