import { NextRequest, NextResponse } from 'next/server';
import { deviceCommunicationClient } from '@/lib/device-communication/client';

interface RouteParams {
  params: { id: string }
}

// 获取单个设备配置
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const device = await deviceCommunicationClient.getDevice(params.id);
    return NextResponse.json({ device });
  } catch (error) {
    console.error('Get device API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get device',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// 更新设备配置
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const deviceConfig = await request.json();
    const updatedDevice = await deviceCommunicationClient.updateDevice(params.id, deviceConfig);
    return NextResponse.json({ device: updatedDevice });
  } catch (error) {
    console.error('Update device API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update device',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// 删除设备配置
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await deviceCommunicationClient.deleteDevice(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete device API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete device',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}