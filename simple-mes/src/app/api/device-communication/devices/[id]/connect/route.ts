import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: { id: string }
}

// 连接设备 - 直接调用.NET设备通信服务
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    // 直接调用.NET设备通信服务的连接API，添加超时控制
    const dotnetServiceUrl = 'http://localhost:5000';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时
    
    const response = await fetch(`${dotnetServiceUrl}/api/devices/${id}/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Device service returned ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Connect device API error:', error);
    
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Connection timeout',
          message: '设备连接超时 - 请检查设备是否在线并可访问'
        },
        { status: 408 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to connect device',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}