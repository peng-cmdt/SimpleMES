'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DebugPage() {
  const router = useRouter();
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [allSessions, setAllSessions] = useState<any[]>([]);

  useEffect(() => {
    // 检查 localStorage 状态
    const clientUserInfo = localStorage.getItem('clientUserInfo');
    if (clientUserInfo) {
      try {
        setUserInfo(JSON.parse(clientUserInfo));
      } catch (e) {
        console.error('Invalid user info:', e);
      }
    }

    // 扫描所有工位 session
    const sessions = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('workstationSession_')) {
        const sessionStr = localStorage.getItem(key);
        if (sessionStr) {
          try {
            const session = JSON.parse(sessionStr);
            sessions.push({ key, session });
          } catch (e) {
            console.error('Invalid session:', key, e);
          }
        }
      }
    }
    setAllSessions(sessions);
  }, []);

  const createTestSession = () => {
    // 创建测试用户信息
    const testUserInfo = {
      id: 'test-user',
      username: 'admin',
      role: 'ADMIN'
    };
    localStorage.setItem('clientUserInfo', JSON.stringify(testUserInfo));

    // 创建测试工位 session
    const testSession = {
      sessionId: 'test-session-' + Date.now(),
      workstation: {
        id: 'cmfgfiby20083tm64mj6j5sq8',
        workstationId: 'M0',
        name: 'M0'
      },
      username: 'admin',
      loginTime: new Date().toISOString()
    };
    localStorage.setItem('workstationSession_M0', JSON.stringify(testSession));

    alert('测试 session 已创建！现在可以访问工位页面了');
    window.location.reload();
  };

  const clearAllSessions = () => {
    localStorage.clear();
    alert('所有 session 已清除');
    window.location.reload();
  };

  const goToWorkstation = () => {
    router.push('/client/workstation?workstationId=M0');
  };

  const goToLogin = () => {
    router.push('/client/login');
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">客户端调试页面</h1>
        
        {/* 用户信息 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">用户信息</h2>
          {userInfo ? (
            <pre className="bg-gray-100 p-3 rounded text-sm">
              {JSON.stringify(userInfo, null, 2)}
            </pre>
          ) : (
            <p className="text-red-600">❌ 没有找到用户信息</p>
          )}
        </div>

        {/* 工位 Sessions */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">工位 Sessions</h2>
          {allSessions.length > 0 ? (
            <div className="space-y-3">
              {allSessions.map(({ key, session }, index) => (
                <div key={index} className="border-l-4 border-blue-500 pl-4">
                  <h3 className="font-medium text-lg">{key}</h3>
                  <pre className="bg-gray-100 p-3 rounded text-sm mt-2">
                    {JSON.stringify(session, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-red-600">❌ 没有找到工位 sessions</p>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">操作</h2>
          <div className="space-x-4">
            <button
              onClick={createTestSession}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              创建测试 Session
            </button>
            <button
              onClick={clearAllSessions}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              清除所有 Sessions
            </button>
            <button
              onClick={goToLogin}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              前往登录页面
            </button>
            <button
              onClick={goToWorkstation}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              前往工位页面
            </button>
          </div>
        </div>

        {/* 问题诊断 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4 text-yellow-800">问题诊断</h2>
          <div className="space-y-2 text-sm">
            <p className="flex items-center">
              <span className={`mr-2 ${userInfo ? 'text-green-600' : 'text-red-600'}`}>
                {userInfo ? '✅' : '❌'}
              </span>
              用户信息: {userInfo ? '正常' : '缺失'}
            </p>
            <p className="flex items-center">
              <span className={`mr-2 ${allSessions.length > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {allSessions.length > 0 ? '✅' : '❌'}
              </span>
              工位Sessions: {allSessions.length > 0 ? `找到 ${allSessions.length} 个` : '缺失'}
            </p>
            {!userInfo || allSessions.length === 0 ? (
              <div className="mt-4 p-3 bg-yellow-100 rounded">
                <p className="font-medium text-yellow-800">解决方案:</p>
                <p className="text-yellow-700">
                  1. 点击 "创建测试 Session" 创建临时session<br/>
                  2. 或者点击 "前往登录页面" 进行正常登录
                </p>
              </div>
            ) : (
              <div className="mt-4 p-3 bg-green-100 rounded">
                <p className="font-medium text-green-800">状态正常，可以访问工位页面</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}