/**
 * 设备通信性能测试脚本
 * 用于验证优化后的响应时间
 */

const TEST_CONFIG = {
  baseUrl: 'http://localhost:4000',
  deviceId: 'dev-plc-001', // 需要替换为实际的设备ID
  iterations: 10,
  targetResponseTime: 400 // 目标响应时间400ms
};

// 测试单次设备读取性能
async function testSingleRead() {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/device-communication/devices/${TEST_CONFIG.deviceId}/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: 'DB100.DBX0.0',
        type: 'DB',
        dbNumber: 100,
        byte: 0,
        bit: 0
      })
    });
    
    const result = await response.json();
    const responseTime = Date.now() - startTime;
    
    return {
      success: result.success,
      responseTime,
      isWithinTarget: responseTime <= TEST_CONFIG.targetResponseTime
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      success: false,
      responseTime,
      error: error.message,
      isWithinTarget: false
    };
  }
}

// 测试单次设备写入性能
async function testSingleWrite() {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/device-communication/devices/${TEST_CONFIG.deviceId}/write`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: 'DB100.DBX0.0',
        type: 'DB',
        dbNumber: 100,
        byte: 0,
        bit: 0,
        value: true
      })
    });
    
    const result = await response.json();
    const responseTime = Date.now() - startTime;
    
    return {
      success: result.success,
      responseTime,
      isWithinTarget: responseTime <= TEST_CONFIG.targetResponseTime
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      success: false,
      responseTime,
      error: error.message,
      isWithinTarget: false
    };
  }
}

// 测试批量读取性能
async function testBatchRead() {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/device-communication/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'READ',
        requests: [{
          deviceId: TEST_CONFIG.deviceId,
          addresses: [
            { address: 'DB100.DBX0.0', type: 'DB', dbNumber: 100, byte: 0, bit: 0 },
            { address: 'DB100.DBX0.1', type: 'DB', dbNumber: 100, byte: 0, bit: 1 },
            { address: 'DB100.DBX0.2', type: 'DB', dbNumber: 100, byte: 0, bit: 2 },
            { address: 'DB100.DBX0.3', type: 'DB', dbNumber: 100, byte: 0, bit: 3 },
            { address: 'DB100.DBX0.4', type: 'DB', dbNumber: 100, byte: 0, bit: 4 }
          ]
        }]
      })
    });
    
    const result = await response.json();
    const responseTime = Date.now() - startTime;
    
    return {
      success: result.success,
      responseTime,
      isWithinTarget: responseTime <= TEST_CONFIG.targetResponseTime * 1.5, // 批量操作允许1.5倍时间
      itemCount: 5,
      avgTimePerItem: responseTime / 5
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      success: false,
      responseTime,
      error: error.message,
      isWithinTarget: false
    };
  }
}

// 测试连接池效果
async function testConnectionPool() {
  console.log('\\n测试连接池效果...');
  
  // 第一次连接（冷启动）
  const connectStart = Date.now();
  const connectResponse = await fetch(`${TEST_CONFIG.baseUrl}/api/device-communication/devices/${TEST_CONFIG.deviceId}/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const connectTime = Date.now() - connectStart;
  
  // 立即进行第二次操作（使用连接池）
  const poolStart = Date.now();
  const poolResponse = await fetch(`${TEST_CONFIG.baseUrl}/api/device-communication/devices/${TEST_CONFIG.deviceId}/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: 'DB100.DBX0.0',
      type: 'DB',
      dbNumber: 100,
      byte: 0,
      bit: 0
    })
  });
  const poolTime = Date.now() - poolStart;
  
  return {
    coldStartTime: connectTime,
    pooledTime: poolTime,
    improvement: `${Math.round((1 - poolTime/connectTime) * 100)}%`
  };
}

// 运行完整性能测试
async function runPerformanceTest() {
  console.log('='.repeat(60));
  console.log('设备通信性能测试');
  console.log('='.repeat(60));
  console.log(`目标响应时间: ${TEST_CONFIG.targetResponseTime}ms`);
  console.log(`测试迭代次数: ${TEST_CONFIG.iterations}`);
  console.log('');
  
  // 测试单次读取
  console.log('1. 测试单次读取性能');
  console.log('-'.repeat(40));
  const readResults = [];
  for (let i = 0; i < TEST_CONFIG.iterations; i++) {
    const result = await testSingleRead();
    readResults.push(result);
    console.log(`  第${i+1}次: ${result.responseTime}ms ${result.isWithinTarget ? '✅' : '❌'} ${result.success ? '' : '(失败)'}`);
  }
  
  const avgReadTime = readResults.reduce((sum, r) => sum + r.responseTime, 0) / readResults.length;
  const successRate = readResults.filter(r => r.isWithinTarget).length / readResults.length * 100;
  console.log(`\\n  平均响应时间: ${Math.round(avgReadTime)}ms`);
  console.log(`  达标率: ${successRate.toFixed(1)}%`);
  
  // 测试单次写入
  console.log('\\n2. 测试单次写入性能');
  console.log('-'.repeat(40));
  const writeResults = [];
  for (let i = 0; i < TEST_CONFIG.iterations; i++) {
    const result = await testSingleWrite();
    writeResults.push(result);
    console.log(`  第${i+1}次: ${result.responseTime}ms ${result.isWithinTarget ? '✅' : '❌'} ${result.success ? '' : '(失败)'}`);
  }
  
  const avgWriteTime = writeResults.reduce((sum, r) => sum + r.responseTime, 0) / writeResults.length;
  const writeSuccessRate = writeResults.filter(r => r.isWithinTarget).length / writeResults.length * 100;
  console.log(`\\n  平均响应时间: ${Math.round(avgWriteTime)}ms`);
  console.log(`  达标率: ${writeSuccessRate.toFixed(1)}%`);
  
  // 测试批量读取
  console.log('\\n3. 测试批量读取性能');
  console.log('-'.repeat(40));
  const batchResult = await testBatchRead();
  console.log(`  批量读取5个点位: ${batchResult.responseTime}ms ${batchResult.isWithinTarget ? '✅' : '❌'}`);
  console.log(`  平均每个点位: ${Math.round(batchResult.avgTimePerItem)}ms`);
  
  // 测试连接池
  console.log('\\n4. 测试连接池优化效果');
  console.log('-'.repeat(40));
  const poolResult = await testConnectionPool();
  console.log(`  冷启动时间: ${poolResult.coldStartTime}ms`);
  console.log(`  连接池时间: ${poolResult.pooledTime}ms`);
  console.log(`  性能提升: ${poolResult.improvement}`);
  
  // 总结
  console.log('\\n' + '='.repeat(60));
  console.log('测试总结');
  console.log('='.repeat(60));
  console.log(`读取平均响应: ${Math.round(avgReadTime)}ms ${avgReadTime <= TEST_CONFIG.targetResponseTime ? '✅ 达标' : '❌ 未达标'}`);
  console.log(`写入平均响应: ${Math.round(avgWriteTime)}ms ${avgWriteTime <= TEST_CONFIG.targetResponseTime ? '✅ 达标' : '❌ 未达标'}`);
  console.log(`整体达标率: ${((successRate + writeSuccessRate) / 2).toFixed(1)}%`);
  
  const overallSuccess = avgReadTime <= TEST_CONFIG.targetResponseTime && avgWriteTime <= TEST_CONFIG.targetResponseTime;
  console.log(`\\n最终结果: ${overallSuccess ? '✅ 性能优化成功！' : '⚠️ 需要进一步优化'}`);
}

// 运行测试
runPerformanceTest().catch(console.error);