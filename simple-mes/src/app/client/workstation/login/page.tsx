'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Workstation {
  workstationId: string;
  name: string;
  description?: string;
  location?: string;
  status: string;
}

interface DeviceConnectionResult {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  success: boolean;
  errorMessage?: string;
}

interface LoginResult {
  success: boolean;
  sessionId?: string;
  workstation?: {
    id: string;
    name: string;
    description?: string;
    location?: string;
  };
  connectedDevices?: DeviceConnectionResult[];
  loginTime?: string;
  warning?: string;
  error?: string;
}

export default function WorkstationLoginPage() {
  const router = useRouter();
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [selectedWorkstation, setSelectedWorkstation] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingWorkstations, setIsLoadingWorkstations] = useState<boolean>(true);
  const [loginResult, setLoginResult] = useState<LoginResult | null>(null);

  // 加载工位列表
  useEffect(() => {
    const loadWorkstations = async () => {
      try {
        const response = await fetch('/api/workstations');
        if (response.ok) {
          const data = await response.json();
          // 检查返回的数据结构
          if (data.success && Array.isArray(data.workstations)) {
            setWorkstations(data.workstations);
          } else if (Array.isArray(data)) {
            setWorkstations(data);
          } else {
            console.error('Invalid workstation data format:', data);
            setWorkstations([]);
          }
        } else {
          console.error('Failed to load workstations');
          setWorkstations([]);
        }
      } catch (error) {
        console.error('Error loading workstations:', error);
        setWorkstations([]);
      } finally {
        setIsLoadingWorkstations(false);
      }
    };

    loadWorkstations();
  }, []);

  const handleLogin = async () => {
    if (!selectedWorkstation) {
      alert('请选择工位');
      return;
    }

    if (!username.trim()) {
      alert('请输入用户名');
      return;
    }

    setIsLoading(true);
    setLoginResult(null);

    try {
      const response = await fetch('/api/workstation/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workstationId: selectedWorkstation,
          username: username.trim()
        })
      });

      const result = await response.json();
      setLoginResult(result);

      if (result.success) {
        // 保存会话信息到localStorage
        localStorage.setItem('workstationSession', JSON.stringify({
          sessionId: result.sessionId,
          workstation: result.workstation,
          username: username.trim(),
          loginTime: result.loginTime
        }));

        // 跳转到工位工作台
        setTimeout(() => {
          router.push('/client/workstation');
        }, 2000);
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginResult({
        success: false,
        error: '登录失败，请检查网络连接'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-600';
      case 'offline':
        return 'text-gray-500';
      default:
        return 'text-yellow-600';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return '在线';
      case 'offline':
        return '离线';
      default:
        return '未知';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">工位登录</h1>
          <p className="text-gray-600 mt-2">选择工位并登录以开始工作</p>
        </div>

        {isLoadingWorkstations ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">加载工位列表中...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 工位选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择工位 *
              </label>
              <select
                value={selectedWorkstation}
                onChange={(e) => setSelectedWorkstation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              >
                <option value="">请选择工位...</option>
                {workstations.map((workstation) => (
                  <option key={workstation.workstationId} value={workstation.workstationId}>
                    {workstation.name} ({workstation.workstationId})
                    {workstation.location && ` - ${workstation.location}`}
                  </option>
                ))}
              </select>
              
              {/* 显示选中工位的状态 */}
              {selectedWorkstation && (
                <div className="mt-2">
                  {(() => {
                    const workstation = workstations.find(w => w.workstationId === selectedWorkstation);
                    return workstation ? (
                      <div className="flex items-center text-sm">
                        <span className="text-gray-600">状态: </span>
                        <span className={`ml-1 font-medium ${getStatusColor(workstation.status)}`}>
                          {getStatusText(workstation.status)}
                        </span>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
            </div>

            {/* 用户名输入 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                用户名 *
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              />
            </div>

            {/* 登录按钮 */}
            <button
              onClick={handleLogin}
              disabled={isLoading || !selectedWorkstation || !username.trim()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  登录中...
                </div>
              ) : (
                '登录工位'
              )}
            </button>

            {/* 登录结果显示 */}
            {loginResult && (
              <div className={`mt-4 p-4 rounded-md ${
                loginResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                {loginResult.success ? (
                  <div>
                    <div className="flex items-center mb-2">
                      <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium text-green-900">登录成功！</span>
                    </div>
                    <p className="text-green-800 mb-2">
                      已登录到工位: {loginResult.workstation?.name}
                    </p>
                    
                    {loginResult.warning && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mb-2">
                        <p className="text-yellow-800 text-sm">{loginResult.warning}</p>
                      </div>
                    )}

                    {loginResult.connectedDevices && loginResult.connectedDevices.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-green-800 mb-1">设备连接状态:</p>
                        <div className="space-y-1">
                          {loginResult.connectedDevices.map((device, index) => (
                            <div key={index} className="flex items-center text-sm">
                              <span className={`w-2 h-2 rounded-full mr-2 ${
                                device.success ? 'bg-green-500' : 'bg-red-500'
                              }`}></span>
                              <span className="text-gray-700">
                                {device.deviceName} ({device.deviceType})
                              </span>
                              {!device.success && device.errorMessage && (
                                <span className="text-red-600 ml-2 text-xs">
                                  - {device.errorMessage}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <p className="text-green-700 text-sm mt-2">
                      正在跳转到工作台...
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center mb-2">
                      <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium text-red-900">登录失败</span>
                    </div>
                    <p className="text-red-800">{loginResult.error}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>SimpleMES 工位管理系统</p>
        </div>
      </div>
    </div>
  );
}