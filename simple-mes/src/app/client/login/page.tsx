"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

interface Workstation {
  workstationId: string;
  name: string;
  description?: string;
  location?: string;
  status: string;
  type: 'VISUAL_CLIENT' | 'SERVICE_TYPE';
  configuredIp?: string;
}

interface DeviceConnectionResult {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  success: boolean;
  errorMessage?: string;
}

interface WorkstationLoginResult {
  success: boolean;
  sessionId?: string;
  workstation?: Workstation;
  connectedDevices?: DeviceConnectionResult[];
  loginTime?: string;
  warning?: string;
  error?: string;
}

export default function ClientLogin() {
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showWorkstationSelector, setShowWorkstationSelector] = useState(false);
  const [availableWorkstations, setAvailableWorkstations] = useState<Workstation[]>([]);
  const [selectedWorkstationId, setSelectedWorkstationId] = useState("");
  const [loginResult, setLoginResult] = useState<WorkstationLoginResult | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [clientIpAddress, setClientIpAddress] = useState<string>("");
  const [matchedWorkstation, setMatchedWorkstation] = useState<Workstation | null>(null);
  const [isIpMatching, setIsIpMatching] = useState(false);
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();

  // 获取客户端IP地址
  const getClientIpAddress = async (): Promise<string> => {
    try {
      // 首先尝试通过公共API获取外网IP
      const response = await fetch('https://api.ipify.org?format=json');
      if (response.ok) {
        const data = await response.json();
        return data.ip;
      }
    } catch (error) {
      console.log('Failed to get public IP, trying local network detection');
    }

    try {
      // 如果获取外网IP失败，尝试通过WebRTC获取本地网络IP
      return new Promise((resolve) => {
        const rtc = new RTCPeerConnection({ iceServers: [] });
        rtc.createDataChannel('');
        
        rtc.onicecandidate = (e) => {
          if (!e.candidate) return;
          const candidate = e.candidate.candidate;
          const match = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
          if (match && !match[1].startsWith('169.254')) {
            resolve(match[1]);
            rtc.close();
          }
        };
        
        rtc.createOffer().then(offer => rtc.setLocalDescription(offer));
        
        // 5秒超时
        setTimeout(() => {
          resolve('127.0.0.1');
          rtc.close();
        }, 5000);
      });
    } catch (error) {
      console.error('Failed to get local IP:', error);
      return '127.0.0.1';
    }
  };

  // 查找匹配的工位
  const findMatchingWorkstation = (workstations: Workstation[], clientIp: string): Workstation | null => {
    return workstations.find(ws => 
      ws.configuredIp && 
      (ws.configuredIp === clientIp || 
       ws.configuredIp.split(',').map(ip => ip.trim()).includes(clientIp))
    ) || null;
  };

  // 自动登录匹配的工位
  const autoLoginWorkstation = async (workstation: Workstation, user: any) => {
    setIsIpMatching(true);
    setMatchedWorkstation(workstation);
    
    try {
      const response = await fetch('/api/workstation/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workstationId: workstation.workstationId,
          username: credentials.username.trim(),
          clientIp: clientIpAddress,
          autoLogin: true
        })
      });

      const result = await response.json();
      setLoginResult(result);

      if (result.success) {
        // 保存工位会话信息
        localStorage.setItem('workstationSession', JSON.stringify({
          sessionId: result.sessionId,
          workstation: result.workstation,
          username: credentials.username.trim(),
          loginTime: result.loginTime,
          clientIp: clientIpAddress,
          autoMatched: true
        }));

        // 跳转到工位操作界面
        setTimeout(() => {
          router.push('/client/workstation');
        }, 1500);
      } else {
        // 自动登录失败，显示工位选择界面
        setShowWorkstationSelector(true);
      }
    } catch (error) {
      console.error('Auto workstation login error:', error);
      // 自动登录失败，显示工位选择界面
      setShowWorkstationSelector(true);
    } finally {
      setIsIpMatching(false);
    }
  };

  // 加载工位列表
  const loadWorkstations = async () => {
    try {
      const response = await fetch('/api/workstations');
      if (response.ok) {
        const data = await response.json();
        console.log('Workstations API response:', data);
        if (data && data.success && Array.isArray(data.workstations)) {
          setAvailableWorkstations(data.workstations);
        } else if (data && Array.isArray(data.workstations)) {
          setAvailableWorkstations(data.workstations);
        } else if (Array.isArray(data)) {
          setAvailableWorkstations(data);
        } else {
          console.error('Invalid workstation data format:', data);
          setAvailableWorkstations([]);
        }
      } else {
        console.error('Failed to load workstations, status:', response.status);
        setAvailableWorkstations([]);
      }
    } catch (error) {
      console.error('Error loading workstations:', error);
      setAvailableWorkstations([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // 第一步：用户认证
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password,
          userType: 'client'
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 存储用户信息
        setUserInfo(data.user);
        localStorage.setItem("clientAuth", "true");
        localStorage.setItem("clientUserInfo", JSON.stringify(data.user));
        
        // 第二步：获取客户端IP地址
        const clientIp = await getClientIpAddress();
        setClientIpAddress(clientIp);
        
        // 第三步：加载工位列表
        await loadWorkstations();
        
        // 第四步：尝试匹配工位IP
        const workstationsResponse = await fetch('/api/workstations');
        if (workstationsResponse.ok) {
          const workstationsData = await workstationsResponse.json();
          const workstations = workstationsData.workstations || [];
          
          // 查找匹配的工位
          const matchedWorkstation = findMatchingWorkstation(workstations, clientIp);
          
          if (matchedWorkstation) {
            // 找到匹配的工位，自动登录
            console.log(`Found matching workstation: ${matchedWorkstation.name} (IP: ${matchedWorkstation.configuredIp})`);
            await autoLoginWorkstation(matchedWorkstation, data.user);
          } else {
            // 没有找到匹配的工位，显示工位选择界面
            console.log(`No matching workstation found for IP: ${clientIp}`);
            setAvailableWorkstations(workstations);
            setShowWorkstationSelector(true);
          }
        } else {
          // 获取工位列表失败，显示选择界面
          setShowWorkstationSelector(true);
        }
      } else {
        setError(data.error || t('error.loginFailed'));
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(t('error.networkError'));
    }

    setIsLoading(false);
  };

  const handleWorkstationLogin = async () => {
    if (!selectedWorkstationId) {
      setError(t('clientSelect.pleaseSelect'));
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
          workstationId: selectedWorkstationId,
          username: credentials.username.trim()
        })
      });

      const result = await response.json();
      setLoginResult(result);

      if (result.success) {
        // 保存工位会话信息
        localStorage.setItem('workstationSession', JSON.stringify({
          sessionId: result.sessionId,
          workstation: result.workstation,
          username: credentials.username.trim(),
          loginTime: result.loginTime
        }));

        // 跳转到工位操作界面
        setTimeout(() => {
          router.push('/client/workstation');
        }, 2000);
      }
    } catch (error) {
      console.error('Workstation login error:', error);
      setLoginResult({
        success: false,
        error: t('error.networkError')
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setShowWorkstationSelector(false);
    setSelectedWorkstationId("");
    setLoginResult(null);
    setError("");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-500';
      case 'offline':
        return 'text-gray-400';
      case 'busy':
        return 'text-orange-500';
      default:
        return 'text-yellow-500';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'offline':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      case 'busy':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return '可用';
      case 'offline':
        return '离线';
      case 'busy':
        return '繁忙';
      default:
        return '未知';
    }
  };

  const getWorkstationIcon = (type: string) => {
    switch (type) {
      case 'VISUAL_CLIENT':
        return '🖥️';
      case 'SERVICE_TYPE':
        return '⚙️';
      default:
        return '📱';
    }
  };

  // 全屏超大尺寸工位选择界面
  if (showWorkstationSelector) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* 标题区域 */}
        <div className="flex-shrink-0 px-12 pt-20 pb-12">
          <h1 className="text-6xl sm:text-7xl lg:text-8xl xl:text-9xl font-bold text-gray-900 text-center leading-tight">
            {t('workstationSelect.title')}
          </h1>
        </div>

        {/* 主要内容区域 - 占据剩余空间并居中 */}
        <div className="flex-1 flex items-center justify-center px-12">
          <div className="w-full max-w-6xl">
            {/* 语言切换按钮 */}
            <div className="mb-12 flex justify-center">
              <div className="flex bg-white rounded-3xl shadow-lg border-4 border-gray-200 overflow-hidden">
                <button
                  onClick={() => setLanguage('zh')}
                  className={`px-8 py-4 text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold transition-all duration-200 ${
                    language === 'zh'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  中文
                </button>
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-8 py-4 text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold transition-all duration-200 ${
                    language === 'en'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  English
                </button>
              </div>
            </div>

            {/* 工位选择下拉框 */}
            <div className="mb-20">
              <div className="relative">
                <select
                  value={selectedWorkstationId}
                  onChange={(e) => setSelectedWorkstationId(e.target.value)}
                  className="w-full h-40 px-12 text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold text-gray-900 bg-white border-8 border-gray-300 rounded-3xl appearance-none focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xl"
                >
                  <option value="" className="text-gray-500">
                    {t('workstationSelect.chooseStation')}
                  </option>
                  {availableWorkstations.map((workstation) => (
                    <option 
                      key={workstation.workstationId} 
                      value={workstation.workstationId}
                      className="text-gray-900"
                    >
                      {workstation.name}
                    </option>
                  ))}
                </select>
                
                {/* 自定义箭头指示器 */}
                <div className="absolute right-12 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <div className="flex flex-col items-center space-y-3">
                    <svg className="w-16 h-16 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={5} d="M5 15l7-7 7 7" />
                    </svg>
                    <svg className="w-16 h-16 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* 错误消息 */}
            {error && (
              <div className="mb-16 p-8 bg-red-50 border-4 border-red-200 rounded-3xl text-center">
                <p className="text-red-600 text-3xl sm:text-4xl xl:text-5xl font-medium">{error}</p>
              </div>
            )}

            {/* 登录结果显示 */}
            {loginResult && (
              <div className={`mb-16 p-12 rounded-3xl border-4 ${ 
                loginResult.success 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                {loginResult.success ? (
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-8">
                      <div className="w-28 h-28 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-16 h-16 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-4xl sm:text-5xl xl:text-6xl font-semibold text-green-900 mb-6">{t('workstationSelect.connectionSuccessful')}</h3>
                    <p className="text-green-800 text-3xl sm:text-4xl xl:text-5xl mb-8">
                      {t('workstationSelect.connectedTo')}: <span className="font-medium">{loginResult.workstation?.name}</span>
                    </p>
                    
                    {loginResult.warning && (
                      <div className="bg-yellow-50 border-4 border-yellow-200 rounded-2xl p-6 mb-8">
                        <p className="text-yellow-800 text-2xl sm:text-3xl xl:text-4xl">{loginResult.warning}</p>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-center text-2xl sm:text-3xl xl:text-4xl text-green-600">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-green-600 mr-6"></div>
                      {t('workstationSelect.enteringWorkstation')}
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-8">
                      <div className="w-28 h-28 bg-red-100 rounded-full flex items-center justify-center">
                        <svg className="w-16 h-16 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-4xl sm:text-5xl xl:text-6xl font-semibold text-red-900 mb-6">{t('workstationSelect.connectionFailed')}</h3>
                    <p className="text-red-800 text-3xl sm:text-4xl xl:text-5xl">{loginResult.error}</p>
                  </div>
                )}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="grid grid-cols-2 gap-12">
              <button
                onClick={handleWorkstationLogin}
                disabled={isLoading || !selectedWorkstationId}
                className="h-40 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold rounded-3xl transition-all duration-200 touch-manipulation shadow-2xl"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-6 border-white mr-6"></div>
                    <span className="text-4xl sm:text-5xl">{t('workstationSelect.connecting')}</span>
                  </div>
                ) : (
                  t('workstationSelect.select')
                )}
              </button>
              
              <button
                onClick={handleBack}
                className="h-40 bg-gray-300 hover:bg-gray-400 active:bg-gray-500 text-gray-800 text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold rounded-3xl transition-all duration-200 touch-manipulation shadow-2xl"
              >
                {t('workstationSelect.cancel')}
              </button>
            </div>

            {/* IP匹配信息显示（如果需要的话） */}
            {clientIpAddress && !selectedWorkstationId && (
              <div className="mt-16 text-center">
                <p className="text-gray-600 text-2xl sm:text-3xl xl:text-4xl">
                  {t('workstationSelect.detectedIp')}: <span className="font-mono bg-gray-100 px-4 py-3 rounded-xl">{clientIpAddress}</span>
                </p>
                <p className="text-gray-500 text-xl sm:text-2xl xl:text-3xl mt-4">
                  {t('workstationSelect.noMatchingStation')}
                </p>
              </div>
            )}

            {/* 空状态 */}
            {availableWorkstations.length === 0 && (
              <div className="text-center py-16">
                <div className="text-9xl mb-8">🚫</div>
                <h3 className="text-4xl sm:text-5xl xl:text-6xl font-semibold text-gray-900 mb-6">{t('workstationSelect.noStationsAvailable')}</h3>
                <p className="text-gray-600 text-3xl sm:text-4xl xl:text-5xl">{t('workstationSelect.contactAdmin')}</p>
              </div>
            )}
          </div>
        </div>

        {/* 底部区域（可选，用于额外信息） */}
        <div className="flex-shrink-0 h-20"></div>
      </div>
    );
  }

  // 主登录界面
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-indigo-400/20 to-pink-400/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* 登录卡片 */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
            {/* Logo和标题 */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mb-4">
                <span className="text-2xl">🏭</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                SimpleMES
              </h1>
              <p className="text-gray-600">
                {t('login.enterClientCredentials')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 用户名输入 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('login.username')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={credentials.username}
                    onChange={(e) =>
                      setCredentials({ ...credentials, username: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                    placeholder={t('login.username')}
                    required
                  />
                </div>
              </div>

              {/* 密码输入 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('login.password')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    value={credentials.password}
                    onChange={(e) =>
                      setCredentials({ ...credentials, password: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                    placeholder={t('login.password')}
                    required
                  />
                </div>
              </div>

              {/* 错误消息 */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-red-600 text-sm">{error}</span>
                  </div>
                </div>
              )}

              {/* 登录按钮 */}
              <button
                type="submit"
                disabled={isLoading || isIpMatching}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center"
              >
                {isLoading || isIpMatching ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    {isIpMatching ? t('smartMatching.loginProgress') : t('login.loggingIn')}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    {t('common.login')}
                  </>
                )}
              </button>
            </form>

            {/* IP匹配进度显示 */}
            {isIpMatching && matchedWorkstation && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center mb-2">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-blue-800 font-medium">{t('smartMatching.title')}</span>
                </div>
                <p className="text-blue-700 text-sm">
                  {t('smartMatching.detectingIp')}：<span className="font-mono bg-blue-100 px-1 rounded">{clientIpAddress}</span>
                </p>
                <p className="text-blue-700 text-sm mt-1">
                  {t('smartMatching.autoLoginWorkstation')}：<span className="font-medium">{matchedWorkstation.name}</span>
                </p>
                <div className="mt-3 flex items-center">
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '75%'}}></div>
                  </div>
                  <span className="ml-3 text-xs text-blue-600">{t('smartMatching.loginProgress')}</span>
                </div>
              </div>
            )}

            {/* 显示当前检测到的IP地址 */}
            {clientIpAddress && !isIpMatching && !showWorkstationSelector && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-600 text-center">
                  <span className="text-gray-500">{t('workstationSelect.detectedIp')}:</span> 
                  <span className="font-mono text-gray-700 ml-1">{clientIpAddress}</span>
                </p>
              </div>
            )}

            {/* 返回首页链接 */}
            <div className="mt-6 text-center">
              <Link
                href="/"
                className="text-gray-600 hover:text-gray-800 text-sm transition-colors duration-200 inline-flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                {t('login.backToHome')}
              </Link>
            </div>

            {/* 底部提示 */}
            <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-600 text-center">
                💡 {t('login.defaultAccount')}: {t('login.credentials.client')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}