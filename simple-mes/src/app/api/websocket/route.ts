import { NextRequest, NextResponse } from 'next/server';
import { createServer } from 'http';
import { WebSocketServer } from '@/lib/websocket/server';

// 全局WebSocket服务器实例
let wsServer: WebSocketServer | null = null;

// 初始化WebSocket服务器
export function initWebSocketServer(httpServer: any) {
  if (!wsServer) {
    wsServer = new WebSocketServer(httpServer);
    console.log('WebSocket服务器已初始化');
  }
  return wsServer;
}

// 获取WebSocket服务器实例
export function getWebSocketServer(): WebSocketServer | null {
  return wsServer;
}

// GET请求 - 返回WebSocket服务器状态
export async function GET(request: NextRequest) {
  try {
    if (!wsServer) {
      return NextResponse.json({
        success: false,
        error: 'WebSocket服务器未初始化'
      }, { status: 503 });
    }
    
    const status = wsServer.getStatus();
    
    return NextResponse.json({
      success: true,
      data: {
        status: 'running',
        ...status
      }
    });
  } catch (error) {
    console.error('获取WebSocket状态失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '获取状态失败'
    }, { status: 500 });
  }
}

// POST请求 - 触发WebSocket事件
export async function POST(request: NextRequest) {
  try {
    if (!wsServer) {
      return NextResponse.json({
        success: false,
        error: 'WebSocket服务器未初始化'
      }, { status: 503 });
    }
    
    const body = await request.json();
    const { type, workstationId, data } = body;
    
    switch (type) {
      case 'orderUpdate':
        // 广播订单更新
        if (workstationId && data.orders) {
          wsServer.broadcastOrderUpdate(workstationId, data.orders);
          return NextResponse.json({
            success: true,
            message: '订单更新已广播'
          });
        }
        break;
        
      case 'deviceStatus':
        // 广播设备状态
        if (data.deviceId && data.status) {
          wsServer.broadcastDeviceStatus(data.deviceId, data.status);
          return NextResponse.json({
            success: true,
            message: '设备状态已广播'
          });
        }
        break;
        
      case 'workstationMessage':
        // 发送消息给特定工位
        if (workstationId && data.event && data.payload) {
          wsServer.sendToWorkstation(workstationId, data.event, data.payload);
          return NextResponse.json({
            success: true,
            message: '消息已发送到工位'
          });
        }
        break;
        
      default:
        return NextResponse.json({
          success: false,
          error: '未知的事件类型'
        }, { status: 400 });
    }
    
    return NextResponse.json({
      success: false,
      error: '缺少必要参数'
    }, { status: 400 });
    
  } catch (error) {
    console.error('处理WebSocket事件失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '处理事件失败'
    }, { status: 500 });
  }
}