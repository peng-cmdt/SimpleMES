import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { workstationId, deviceId, operation, address, value, dataType } = await request.json();

    if (!deviceId || !operation) {
      return NextResponse.json({ error: 'DeviceId and operation are required' }, { status: 400 });
    }

    // 调用C#设备通信服务执行设备操作
    const operationResponse = await fetch('http://localhost:8080/api/workstation/device/operation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requestId: `req-${Date.now()}`,
        workstationId,
        deviceId,
        operation,
        address,
        value,
        dataType,
        timestamp: new Date().toISOString()
      })
    });

    if (!operationResponse.ok) {
      const error = await operationResponse.text();
      return NextResponse.json({ 
        error: `Device operation failed: ${error}` 
      }, { status: operationResponse.status });
    }

    const result = await operationResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in device operation:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}