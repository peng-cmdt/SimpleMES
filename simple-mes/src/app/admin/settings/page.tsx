"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useLanguage } from "@/contexts/LanguageContext";

interface SystemSettings {
  autoRefreshInterval: number;
  defaultLanguage: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    autoRefreshInterval: 3000,
    defaultLanguage: 'zh'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const { t } = useLanguage();

  // 加载当前系统设置
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/system/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.settings) {
          setSettings(data.settings);
        }
      } else {
        // 如果API不存在或失败，使用默认设置
        console.log('Using default settings');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      // 使用默认设置
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });

      const response = await fetch('/api/system/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMessage({ type: 'success', text: '设置保存成功！' });
          // 清除消息
          setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } else {
          setMessage({ type: 'error', text: data.error || '保存失败' });
        }
      } else {
        setMessage({ type: 'error', text: '保存失败，请检查网络连接' });
      }
    } catch (error) {
      console.error('Save settings error:', error);
      setMessage({ type: 'error', text: '保存失败，请稍后重试' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('确定要重置为默认设置吗？')) {
      setSettings({
        autoRefreshInterval: 3000,
        defaultLanguage: 'zh'
      });
      setMessage({ type: 'info', text: '已重置为默认设置，请点击保存生效' });
    }
  };

  const handleInputChange = (field: keyof SystemSettings, value: string | number) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <AdminLayout title="系统设置">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-4 text-gray-600">加载设置中...</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="系统设置">
      <div className="max-w-4xl mx-auto">
        {/* 消息提示 */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
            message.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
            'bg-blue-100 text-blue-800 border border-blue-200'
          }`}>
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">系统配置</h2>
            <p className="text-sm text-gray-600 mt-2">管理系统全局设置和参数配置</p>
          </div>

          <div className="p-6 space-y-8">
            {/* 系统设置 */}
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                系统设置
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    自动刷新间隔（秒）
                  </label>
                  <select
                    value={settings.autoRefreshInterval}
                    onChange={(e) => handleInputChange('autoRefreshInterval', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={1000}>1 秒</option>
                    <option value={2000}>2 秒</option>
                    <option value={3000}>3 秒</option>
                    <option value={5000}>5 秒</option>
                    <option value={10000}>10 秒</option>
                    <option value={30000}>30 秒</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    系统数据自动刷新的时间间隔
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    默认语言
                  </label>
                  <select
                    value={settings.defaultLanguage}
                    onChange={(e) => handleInputChange('defaultLanguage', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="zh">中文</option>
                    <option value="en">English</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    新用户的默认界面语言设置
                  </p>
                </div>
              </div>
            </div>

            {/* 当前设置预览 */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">当前配置预览</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">刷新间隔:</span>
                  <span className="ml-2 font-medium">{settings.autoRefreshInterval / 1000}秒</span>
                </div>
                <div>
                  <span className="text-gray-600">默认语言:</span>
                  <span className="ml-2 font-medium">{settings.defaultLanguage === 'zh' ? '中文' : 'English'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex justify-between items-center">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
              disabled={saving}
            >
              重置默认
            </button>
            
            <div className="space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                disabled={saving}
              >
                刷新页面
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    保存中...
                  </>
                ) : (
                  '保存设置'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 使用说明 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-3">设置说明</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>• <strong>自动刷新间隔</strong>：系统数据自动刷新的频率，较短的间隔可以保证数据实时性，但会增加服务器负载</li>
            <li>• <strong>默认语言</strong>：新用户首次登录时的界面语言，用户可以在个人设置中更改</li>
            <li>• <strong>客户端配置</strong>：客户端订单显示相关配置已移至"系统管理 → 客户端配置"页面</li>
            <li>• 修改设置后请点击"保存设置"按钮使配置生效，部分设置可能需要重启应用程序</li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
}