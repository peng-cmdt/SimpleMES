"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";

export default function AdminLogin() {
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loginProgress, setLoginProgress] = useState(0);
  const [loginStatus, setLoginStatus] = useState("");
  const [performanceData, setPerformanceData] = useState<any>(null);
  const router = useRouter();
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setLoginProgress(0);
    setLoginStatus("开始登录...");
    setPerformanceData(null);

    // 调试信息
    console.log('Login attempt with credentials:', {
      username: credentials.username,
      passwordLength: credentials.password?.length,
      userType: 'admin'
    });

    try {
      const startTime = performance.now();

      setLoginProgress(25);
      setLoginStatus("验证用户信息...");

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password,
          userType: 'admin'
        }),
      });

      setLoginProgress(75);
      setLoginStatus("获取用户权限...");

      const data = await response.json();
      const clientTime = performance.now() - startTime;

      setLoginProgress(100);

      if (response.ok && data.success) {
        setLoginStatus("登录成功！");

        // 显示性能数据
        if (data.performance) {
          setPerformanceData({
            server: data.performance,
            client: Math.round(clientTime),
            total: Math.round(clientTime)
          });

          console.log('Login Performance:', {
            server: data.performance,
            client: `${clientTime.toFixed(2)}ms`,
            total: `${clientTime.toFixed(2)}ms`
          });
        }

        localStorage.setItem("adminAuth", "true");
        localStorage.setItem("adminUserInfo", JSON.stringify(data.user));

        // 延迟跳转，让用户看到性能数据
        setTimeout(() => {
          router.push("/admin/dashboard");
        }, 1500);
      } else {
        setLoginProgress(0);
        setLoginStatus("");
        setError(data.error || t('error.loginFailed'));
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginProgress(0);
      setLoginStatus("");
      setError(t('error.networkError'));
    }

    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {t('login.adminTitle')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('login.enterCredentials')}
          </p>
        </div>

        <div className="mb-6">
          <LanguageSelector />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('login.username')}
            </label>
            <input
              type="text"
              value={credentials.username}
              onChange={(e) =>
                setCredentials({ ...credentials, username: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('login.password')}
            </label>
            <input
              type="password"
              value={credentials.password}
              onChange={(e) =>
                setCredentials({ ...credentials, password: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}

          {/* 登录进度条 */}
          {isLoading && (
            <div className="space-y-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${loginProgress}%` }}
                ></div>
              </div>
              <div className="text-center text-sm text-blue-600 font-medium">
                {loginStatus}
              </div>
            </div>
          )}

          {/* 性能监控显示 */}
          {performanceData && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
              <div className="font-medium text-green-800 mb-2">登录性能分析</div>
              <div className="space-y-1 text-green-700">
                <div>总耗时: {performanceData.total}ms</div>
                <div className="text-xs space-y-1">
                  <div>• 用户查询: {performanceData.server.breakdown.userQuery}ms</div>
                  <div>• 密码验证: {performanceData.server.breakdown.passwordCheck}ms</div>
                  <div>• 权限查询: {performanceData.server.breakdown.permissionsQuery}ms</div>
                </div>
                {performanceData.total < 200 && (
                  <div className="text-green-600 font-medium">⚡ 性能优秀</div>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
          >
            {isLoading ? loginStatus || t('login.loggingIn') : t('login.loginButton')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            {t('login.backToHome')}
          </Link>
        </div>

        <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('login.defaultAccount')}: {t('login.credentials.admin')}
          </p>
        </div>
      </div>
    </div>
  );
}