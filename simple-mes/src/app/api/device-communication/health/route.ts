import { NextRequest, NextResponse } from 'next/server';
import { deviceCommunicationClient } from '@/lib/device-communication/client';

// 健康检查 - 检查C#服务是否可用
export async function GET() {
  try {
    const isAvailable = await deviceCommunicationClient.isServiceAvailable();
    
    if (isAvailable) {
      const serviceInfo = await deviceCommunicationClient.getServiceInfo();
      return NextResponse.json({
        status: 'healthy',
        service: serviceInfo,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json(
        {
          status: 'unhealthy',
          error: 'Device communication service is not available',
          timestamp: new Date().toISOString()
        },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('Health check API error:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}