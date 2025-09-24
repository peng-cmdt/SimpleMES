'use client';

import { useState, useEffect } from 'react';

interface TestResult {
  test: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  duration?: number;
  data?: any;
}

export default function WorkstationTestPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([
    { test: '1. 测试C#设备通信服务连接', status: 'pending' },
    { test: '2. 获取工位列表', status: 'pending' },
    { test: '3. 工位登录测试', status: 'pending' },
    { test: '4. 获取工位设备状态', status: 'pending' },
    { test: '5. 执行设备读操作', status: 'pending' },
    { test: '6. 执行设备写操作', status: 'pending' },
    { test: '7. 工位登出测试', status: 'pending' }
  ]);
  
  const [isRunning, setIsRunning] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [selectedWorkstationId, setSelectedWorkstationId] = useState<string>('WS001');
  
  const updateTestResult = (index: number, updates: Partial<TestResult>) => {
    setTestResults(prev => prev.map((result, i) => 
      i === index ? { ...result, ...updates } : result
    ));
  };

  const runAllTests = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setCurrentSessionId(null);
    
    // 重置所有测试状态
    setTestResults(prev => prev.map(test => ({ 
      ...test, 
      status: 'pending', 
      message: undefined,
      duration: undefined,
      data: undefined
    })));

    try {
      // 测试1: 检查C#服务连接
      await runTest(0, async () => {
        const response = await fetch('http://localhost:8080/api/health');
        if (!response.ok) throw new Error('C#服务无响应');
        const data = await response.json();
        return data;
      });

      // 测试2: 获取工位列表
      await runTest(1, async () => {
        const response = await fetch('/api/workstations');
        if (!response.ok) throw new Error('获取工位列表失败');
        const data = await response.json();
        
        // 检查返回的数据结构
        let workstations;
        if (data.success && Array.isArray(data.workstations)) {
          workstations = data.workstations;
        } else if (Array.isArray(data)) {
          workstations = data;
        } else {
          throw new Error('工位数据格式错误');
        }
        
        if (workstations.length === 0) {
          throw new Error('没有找到工位数据');
        }
        return { count: workstations.length, workstations: workstations.slice(0, 3) };
      });

      // 测试3: 工位登录
      const loginResult = await runTest(2, async () => {
        const response = await fetch('/api/workstation/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workstationId: selectedWorkstationId,
            username: 'test-user'
          })
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`登录失败: ${error}`);
        }
        
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || '登录失败');
        }
        
        setCurrentSessionId(data.sessionId);
        return data;
      });

      // 如果登录成功，继续后续测试
      if (currentSessionId || loginResult?.data?.sessionId) {
        const sessionId = currentSessionId || loginResult?.data?.sessionId;

        // 测试4: 获取设备状态
        await runTest(3, async () => {
          const response = await fetch(`http://localhost:8080/api/workstation/${selectedWorkstationId}/devices/status`);
          if (!response.ok) throw new Error('获取设备状态失败');
          const data = await response.json();
          return { deviceCount: data.length, devices: data };
        });

        // 测试5: 读操作测试
        await runTest(4, async () => {
          const response = await fetch('/api/workstation/device/operation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workstationId: selectedWorkstationId,
              deviceId: `PLC-${selectedWorkstationId}-01`,
              operation: 'READ',
              address: 'DB1.DBW0',
              dataType: 'INT'
            })
          });
          
          const data = await response.json();
          return data;
        });

        // 测试6: 写操作测试
        await runTest(5, async () => {
          const response = await fetch('/api/workstation/device/operation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workstationId: selectedWorkstationId,
              deviceId: `PLC-${selectedWorkstationId}-01`,
              operation: 'WRITE',
              address: 'DB1.DBW0',
              value: 123,
              dataType: 'INT'
            })
          });
          
          const data = await response.json();
          return data;
        });

        // 测试7: 登出测试
        await runTest(6, async () => {
          const response = await fetch(`/api/workstation/logout/${sessionId}`, {
            method: 'POST'
          });
          
          if (!response.ok) throw new Error('登出失败');
          const data = await response.json();
          setCurrentSessionId(null);
          return data;
        });
      }

    } catch (error) {
      console.error('测试过程中出现错误:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const runTest = async (index: number, testFn: () => Promise<any>) => {
    updateTestResult(index, { status: 'running' });
    const startTime = Date.now();
    
    try {
      const result = await testFn();
      const duration = Date.now() - startTime;
      updateTestResult(index, { 
        status: 'success', 
        duration,
        data: result,
        message: '测试通过'
      });
      
      // 等待一下再执行下一个测试
      await new Promise(resolve => setTimeout(resolve, 500));
      return { success: true, data: result };
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTestResult(index, { 
        status: 'error', 
        duration,
        message: error instanceof Error ? error.message : '未知错误'
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      return { success: false, error };
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return '⏸️';
      case 'running':
        return '🔄';
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '❓';
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return 'text-gray-600';
      case 'running':
        return 'text-blue-600';
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">工位设备管理系统测试</h1>
              <p className="text-gray-600 mt-2">测试前端和后端的完整功能链路</p>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={selectedWorkstationId}
                onChange={(e) => setSelectedWorkstationId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isRunning}
              >
                <option value="WS001">装配工位1 (WS001)</option>
                <option value="WS002">测试工位1 (WS002)</option>
              </select>
              <button
                onClick={runAllTests}
                disabled={isRunning}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isRunning ? '测试中...' : '开始测试'}
              </button>
            </div>
          </div>

          {/* 系统状态概览 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">FE</span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-900">前端服务</p>
                  <p className="text-xs text-blue-700">Next.js (port 3000)</p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">BE</span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-900">后端服务</p>
                  <p className="text-xs text-green-700">C# DeviceComm (port 8080)</p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">DB</span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-purple-900">数据库</p>
                  <p className="text-xs text-purple-700">PostgreSQL + Prisma</p>
                </div>
              </div>
            </div>
          </div>

          {/* 测试结果列表 */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">测试执行结果</h2>
            
            {testResults.map((result, index) => (
              <div key={index} className={`border rounded-lg p-4 ${
                result.status === 'error' ? 'border-red-200 bg-red-50' :
                result.status === 'success' ? 'border-green-200 bg-green-50' :
                result.status === 'running' ? 'border-blue-200 bg-blue-50' :
                'border-gray-200 bg-white'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{getStatusIcon(result.status)}</span>
                    <div>
                      <h3 className={`font-medium ${getStatusColor(result.status)}`}>
                        {result.test}
                      </h3>
                      {result.message && (
                        <p className={`text-sm mt-1 ${getStatusColor(result.status)}`}>
                          {result.message}
                        </p>
                      )}
                      {result.duration !== undefined && (
                        <p className="text-xs text-gray-500 mt-1">
                          耗时: {result.duration}ms
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {result.status === 'running' && (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  )}
                </div>

                {/* 展示测试数据 */}
                {result.data && result.status === 'success' && (
                  <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded">
                    <p className="text-xs font-medium text-gray-700 mb-2">测试数据:</p>
                    <pre className="text-xs text-gray-600 overflow-x-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 测试说明 */}
          <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">测试说明</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>测试1:</strong> 检查C#设备通信服务是否可访问</p>
              <p><strong>测试2:</strong> 验证前端能否正确获取工位列表</p>
              <p><strong>测试3:</strong> 测试工位登录功能，包括设备初始化和连接</p>
              <p><strong>测试4:</strong> 获取工位下所有设备的连接状态</p>
              <p><strong>测试5:</strong> 执行设备读操作测试</p>
              <p><strong>测试6:</strong> 执行设备写操作测试</p>
              <p><strong>测试7:</strong> 测试工位登出功能，断开所有设备连接</p>
            </div>
          </div>

          {/* 快速操作 */}
          <div className="mt-6 flex space-x-4">
            <a
              href="/client/workstation/login"
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              打开工位登录页面
            </a>
            <a
              href="http://localhost:8080"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              查看C#服务状态
            </a>
            <a
              href="/admin/workstations"
              className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 text-sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              管理工位配置
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}