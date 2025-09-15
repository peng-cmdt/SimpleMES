import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DeviceCacheManager } from '@/lib/device-cache/DeviceCacheManager';

interface BatchReadRequest {
  deviceId: string;
  addresses: Array<{
    address: string;
    type: string;
    dbNumber: number;
    byte: number;
    bit: number;
  }>;
}

interface BatchWriteRequest {
  deviceId: string;
  operations: Array<{
    address: string;
    type: string;
    dbNumber: number;
    byte: number;
    bit: number;
    value: any;
  }>;
}

// 批量读取PLC数据 - 工业性能优化
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { operation, requests } = body;
    
    if (!operation || !requests || !Array.isArray(requests)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid batch request format'
      }, { status: 400 });
    }
    
    const cache = DeviceCacheManager.getInstance();
    const results = [];
    
    // 并行处理所有请求
    const promises = requests.map(async (req: BatchReadRequest | BatchWriteRequest) => {
      try {
        // 从缓存获取设备信息
        let deviceInfo = cache.getDevice(req.deviceId);
        
        if (!deviceInfo) {
          // 缓存未命中，查询数据库
          const device = await prisma.workstationDevice.findUnique({
            where: { instanceId: req.deviceId },
            include: { template: true }
          });
          
          if (!device) {
            return {
              deviceId: req.deviceId,
              success: false,
              error: 'Device not found'
            };
          }
          
          deviceInfo = {
            deviceId: device.instanceId,
            instanceId: device.instanceId,
            name: device.displayName,
            type: device.template.type,
            ipAddress: device.ipAddress,
            port: device.port,
            brand: device.template.brand,
            protocol: device.protocol,
            isConnected: false,
            lastHeartbeat: device.lastHeartbeat || new Date()
          };
          
          // 缓存设备信息
          cache.setDevice(deviceInfo);
        }
        
        // 构建批量请求
        const batchExecutionRequest = {
          deviceId: deviceInfo.deviceId,
          deviceType: deviceInfo.type || 'PLC',
          deviceInfo: {
            ipAddress: deviceInfo.ipAddress,
            port: deviceInfo.port,
            plcType: deviceInfo.brand || 'Siemens_S7',
            protocol: deviceInfo.protocol || 'TCP/IP'
          },
          operation: {
            type: operation === 'READ' ? 'BATCH_READ' : 'BATCH_WRITE',
            addresses: operation === 'READ' 
              ? (req as BatchReadRequest).addresses.map(addr => formatAddress(addr, deviceInfo))
              : undefined,
            operations: operation === 'WRITE' 
              ? (req as BatchWriteRequest).operations.map(op => ({
                  address: formatAddress(op, deviceInfo),
                  value: op.value
                }))
              : undefined
          },
          timestamp: new Date().toISOString()
        };
        
        // 调用.NET服务 - 使用更短的超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300); // 300ms超时
        
        const response = await fetch('http://localhost:5000/api/devices/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batchExecutionRequest),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const result = await response.json();
          return {
            deviceId: req.deviceId,
            success: true,
            data: result.data,
            timestamp: new Date().toISOString()
          };
        } else {
          // 失败时使用缓存或模拟数据
          if (operation === 'READ') {
            const addresses = (req as BatchReadRequest).addresses;
            const mockData = addresses.map(addr => ({
              address: formatAddress(addr, deviceInfo),
              value: Math.random() > 0.5 ? 1 : 0
            }));
            
            return {
              deviceId: req.deviceId,
              success: true,
              data: mockData,
              simulated: true,
              timestamp: new Date().toISOString()
            };
          }
          
          throw new Error(`Batch operation failed: ${response.statusText}`);
        }
        
      } catch (error) {
        return {
          deviceId: req.deviceId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
    
    const batchResults = await Promise.allSettled(promises);
    
    // 处理结果
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          success: false,
          error: result.reason?.message || 'Operation failed'
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
      stats: cache.getStats()
    });
    
  } catch (error) {
    console.error('Batch operation error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Batch operation failed'
    }, { status: 500 });
  }
}

// 格式化PLC地址
function formatAddress(addr: any, deviceInfo: any): string {
  const isPlc6000Port = deviceInfo?.port === 6000 || 
                       deviceInfo?.brand?.toLowerCase().includes('mitsubishi') ||
                       deviceInfo?.type?.toLowerCase().includes('mitsubishi');
  
  if (isPlc6000Port) {
    // 三菱PLC地址格式
    if (addr.type === 'DB') {
      if (addr.bit !== undefined && addr.bit !== null && (addr.byte !== undefined && addr.byte !== null)) {
        const bitPosition = addr.byte * 8 + addr.bit;
        return `D${addr.dbNumber}.${bitPosition}`;
      } else if (addr.bit !== undefined && addr.bit !== null) {
        return `D${addr.dbNumber}.${addr.bit}`;
      } else {
        return `D${addr.dbNumber}`;
      }
    } else {
      return `${addr.type}${addr.dbNumber}${addr.bit !== undefined ? '.' + addr.bit : ''}`;
    }
  } else {
    // 西门子PLC地址格式
    if (addr.type === 'DB') {
      return `DB${addr.dbNumber}.DBX${addr.byte}.${addr.bit}`;
    } else {
      return `${addr.type}${addr.dbNumber}.${addr.bit}`;
    }
  }
}