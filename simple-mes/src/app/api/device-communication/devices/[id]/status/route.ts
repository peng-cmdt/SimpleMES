import { NextRequest, NextResponse } from 'next/server';
import { deviceCommunicationClient } from '@/lib/device-communication/client';

interface RouteParams {
  params: { id: string }
}

// 获取设备状态
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const status = await deviceCommunicationClient.getDeviceStatus(id);
    
    // 返回标准格式
    return NextResponse.json({ 
      success: true,
      isConnected: status.isOnline && (status.status === 'ONLINE' || status.status === 'Connected'),
      status: status.status,
      data: { deviceId: id, status }
    });
  } catch (error) {
    console.error('Get device status API error:', error);
    return NextResponse.json(
      { 
        success: false,
        isConnected: false,
        error: 'Failed to get device status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}