/**
 * WebSocket性能测试脚本
 * 对比HTTP轮询和WebSocket的延迟差异
 */

const { io } = require('socket.io-client');

// 测试配置
const TEST_CONFIG = {
  httpUrl: 'http://localhost:3000',
  wsUrl: 'http://localhost:3000',
  deviceId: 'plc-001',
  plcAddress: 'DB10.DBX0.0',
  testDuration: 30000, // 30秒测试
  httpPollInterval: 200 // HTTP轮询间隔
};

// 性能统计
const stats = {
  http: {
    requests: 0,
    totalLatency: 0,
    minLatency: Infinity,
    maxLatency: 0,
    errors: 0
  },
  websocket: {
    messages: 0,
    totalLatency: 0,
    minLatency: Infinity,
    maxLatency: 0,
    errors: 0
  }
};

// HTTP轮询测试
async function testHTTPPolling() {
  console.log('开始HTTP轮询测试...');
  const startTime = Date.now();
  
  const pollInterval = setInterval(async () => {
    const requestStart = Date.now();
    
    try {
      const response = await fetch(`${TEST_CONFIG.httpUrl}/api/device-communication/devices/${TEST_CONFIG.deviceId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: TEST_CONFIG.plcAddress,
          type: 'DB',
          dbNumber: 10,
          byte: 0,
          bit: 0
        })
      });
      
      if (response.ok) {
        const latency = Date.now() - requestStart;
        stats.http.requests++;
        stats.http.totalLatency += latency;
        stats.http.minLatency = Math.min(stats.http.minLatency, latency);
        stats.http.maxLatency = Math.max(stats.http.maxLatency, latency);
        
        if (stats.http.requests % 10 === 0) {
          console.log(`HTTP - 请求数: ${stats.http.requests}, 平均延迟: ${(stats.http.totalLatency / stats.http.requests).toFixed(2)}ms`);
        }
      } else {
        stats.http.errors++;
      }
    } catch (error) {
      stats.http.errors++;
      console.error('HTTP请求错误:', error.message);
    }
    
    // 检查是否完成测试
    if (Date.now() - startTime >= TEST_CONFIG.testDuration) {
      clearInterval(pollInterval);
      console.log('HTTP轮询测试完成');
    }
  }, TEST_CONFIG.httpPollInterval);
}

// WebSocket测试
async function testWebSocket() {
  console.log('开始WebSocket测试...');
  
  return new Promise((resolve) => {
    const socket = io(TEST_CONFIG.wsUrl, {
      transports: ['websocket']
    });
    
    const startTime = Date.now();
    let messageTimestamps = new Map();
    
    socket.on('connect', () => {
      console.log('WebSocket已连接:', socket.id);
      
      // 认证
      socket.emit('authenticate', {
        userId: 'test-user',
        workstationId: 'test-workstation'
      });
      
      // 订阅PLC数据
      socket.emit('subscribe:plc', {
        deviceId: TEST_CONFIG.deviceId,
        address: TEST_CONFIG.plcAddress,
        interval: 50 // 50ms监控间隔
      });
    });
    
    // 记录订阅确认时间
    socket.on('subscribed:plc', (data) => {
      console.log('已订阅PLC数据:', data.subscriptionKey);
    });
    
    // 接收PLC数据更新
    socket.on('plc:data:update', (data) => {
      const receiveTime = Date.now();
      
      // 计算延迟（从服务器timestamp到接收时间）
      if (data.timestamp) {
        const latency = receiveTime - data.timestamp;
        stats.websocket.messages++;
        stats.websocket.totalLatency += latency;
        stats.websocket.minLatency = Math.min(stats.websocket.minLatency, latency);
        stats.websocket.maxLatency = Math.max(stats.websocket.maxLatency, latency);
        
        if (stats.websocket.messages % 20 === 0) {
          console.log(`WebSocket - 消息数: ${stats.websocket.messages}, 平均延迟: ${(stats.websocket.totalLatency / stats.websocket.messages).toFixed(2)}ms`);
        }
      }
      
      // 检查是否完成测试
      if (Date.now() - startTime >= TEST_CONFIG.testDuration) {
        socket.disconnect();
        console.log('WebSocket测试完成');
        resolve();
      }
    });
    
    socket.on('error', (error) => {
      stats.websocket.errors++;
      console.error('WebSocket错误:', error);
    });
  });
}

// 打印测试结果
function printResults() {
  console.log('\n' + '='.repeat(60));
  console.log('性能测试结果');
  console.log('='.repeat(60));
  
  console.log('\nHTTP轮询性能:');
  console.log(`  总请求数: ${stats.http.requests}`);
  console.log(`  平均延迟: ${stats.http.requests > 0 ? (stats.http.totalLatency / stats.http.requests).toFixed(2) : 'N/A'}ms`);
  console.log(`  最小延迟: ${stats.http.minLatency === Infinity ? 'N/A' : stats.http.minLatency}ms`);
  console.log(`  最大延迟: ${stats.http.maxLatency}ms`);
  console.log(`  错误数: ${stats.http.errors}`);
  console.log(`  吞吐量: ${(stats.http.requests / (TEST_CONFIG.testDuration / 1000)).toFixed(2)} req/s`);
  
  console.log('\nWebSocket性能:');
  console.log(`  总消息数: ${stats.websocket.messages}`);
  console.log(`  平均延迟: ${stats.websocket.messages > 0 ? (stats.websocket.totalLatency / stats.websocket.messages).toFixed(2) : 'N/A'}ms`);
  console.log(`  最小延迟: ${stats.websocket.minLatency === Infinity ? 'N/A' : stats.websocket.minLatency}ms`);
  console.log(`  最大延迟: ${stats.websocket.maxLatency}ms`);
  console.log(`  错误数: ${stats.websocket.errors}`);
  console.log(`  吞吐量: ${(stats.websocket.messages / (TEST_CONFIG.testDuration / 1000)).toFixed(2)} msg/s`);
  
  // 计算改善
  if (stats.http.requests > 0 && stats.websocket.messages > 0) {
    const httpAvgLatency = stats.http.totalLatency / stats.http.requests;
    const wsAvgLatency = stats.websocket.totalLatency / stats.websocket.messages;
    const improvement = ((httpAvgLatency - wsAvgLatency) / httpAvgLatency * 100).toFixed(2);
    const throughputImprovement = ((stats.websocket.messages - stats.http.requests) / stats.http.requests * 100).toFixed(2);
    
    console.log('\n性能改善:');
    console.log(`  延迟降低: ${improvement}%`);
    console.log(`  吞吐量提升: ${throughputImprovement}%`);
    console.log(`  延迟改善: ${httpAvgLatency.toFixed(2)}ms -> ${wsAvgLatency.toFixed(2)}ms`);
  }
  
  console.log('='.repeat(60));
}

// 运行测试
async function runTests() {
  console.log('开始性能对比测试...');
  console.log(`测试时长: ${TEST_CONFIG.testDuration / 1000}秒`);
  console.log(`HTTP轮询间隔: ${TEST_CONFIG.httpPollInterval}ms`);
  console.log(`WebSocket监控间隔: 50ms`);
  console.log('-'.repeat(60));
  
  // 先测试HTTP轮询
  await new Promise(resolve => {
    testHTTPPolling();
    setTimeout(resolve, TEST_CONFIG.testDuration + 1000);
  });
  
  console.log('\n等待5秒后开始WebSocket测试...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // 测试WebSocket
  await testWebSocket();
  
  // 打印结果
  printResults();
  
  process.exit(0);
}

// 检查是否有WebSocket服务器运行
async function checkWebSocketServer() {
  try {
    const response = await fetch(`${TEST_CONFIG.httpUrl}/api/websocket`);
    if (!response.ok) {
      console.error('WebSocket服务器未运行，请先启动服务器');
      process.exit(1);
    }
  } catch (error) {
    console.error('无法连接到服务器:', error.message);
    console.log('请确保服务器正在运行: npm run dev');
    process.exit(1);
  }
}

// 主函数
async function main() {
  console.log('WebSocket vs HTTP 性能测试工具');
  console.log('================================\n');
  
  // 检查服务器
  await checkWebSocketServer();
  
  // 运行测试
  await runTests();
}

// 处理错误
process.on('unhandledRejection', (error) => {
  console.error('未处理的错误:', error);
  process.exit(1);
});

// 启动测试
main();