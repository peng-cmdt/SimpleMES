'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface SimpleUSBScannerProps {
  onValidationSuccess?: (code: string) => void;
  onValidationFailure?: (code: string) => void;
  className?: string;
}

interface ScanResult {
  code: string;
  isValid: boolean;
  timestamp: Date;
}

export default function SimpleUSBScanner({ 
  onValidationSuccess, 
  onValidationFailure, 
  className = '' 
}: SimpleUSBScannerProps) {
  // 状态管理
  const [targetCode, setTargetCode] = useState<string>('');
  const [validationStatus, setValidationStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  
  // 扫码检测相关状态
  const [isScanning, setIsScanning] = useState(false);
  const inputBufferRef = useRef<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  // 从localStorage加载配置
  useEffect(() => {
    const savedConfig = localStorage.getItem('usbScannerConfig');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        setTargetCode(config.targetCode || '');
      } catch (error) {
        // 配置加载失败，使用默认空值
      }
    }
  }, []);

  // 保存配置到localStorage
  const saveConfig = useCallback(() => {
    const config = {
      targetCode,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('usbScannerConfig', JSON.stringify(config));
  }, [targetCode]);

  // USB扫码枪键盘事件监听
  useEffect(() => {
    if (!isScanning || isPaused) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      // 防止在其他输入框中触发
      if (document.activeElement && 
          document.activeElement !== hiddenInputRef.current &&
          (document.activeElement as HTMLElement).tagName === 'INPUT') {
        return;
      }

      // 阻止默认行为
      event.preventDefault();

      // 检测回车键，表示扫码完成
      if (event.key === 'Enter') {
        if (inputBufferRef.current.trim()) {
          handleScanComplete(inputBufferRef.current.trim());
        }
        inputBufferRef.current = '';
        return;
      }

      // 累积字符输入
      if (event.key.length === 1) {
        inputBufferRef.current += event.key;
        setCurrentInput(inputBufferRef.current);
        
        // 清除之前的超时
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        // 设置新的超时，如果500ms内没有新输入，清空缓冲区
        timeoutRef.current = setTimeout(() => {
          inputBufferRef.current = '';
          setCurrentInput('');
        }, 500);
      }
    };

    // 添加键盘事件监听器
    document.addEventListener('keydown', handleKeyPress, true);
    
    // 自动聚焦到隐藏的输入框
    if (hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyPress, true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isScanning, isPaused]);

  // 处理扫码完成
  const handleScanComplete = useCallback((scannedCode: string) => {
    const isValid = scannedCode === targetCode;
    const result: ScanResult = {
      code: scannedCode,
      isValid,
      timestamp: new Date()
    };

    // 更新扫描历史
    setScanHistory(prev => [result, ...prev.slice(0, 9)]); // 保留最近10条记录

    if (isValid) {
      setValidationStatus('success');
      onValidationSuccess?.(scannedCode);
      
      // 2秒后自动重置状态
      setTimeout(() => {
        setValidationStatus('idle');
        setCurrentInput('');
      }, 2000);
    } else {
      setValidationStatus('error');
      onValidationFailure?.(scannedCode);
      
      // 3秒后重置状态，允许重新扫描
      setTimeout(() => {
        setValidationStatus('idle');
        setCurrentInput('');
      }, 3000);
    }
  }, [targetCode, onValidationSuccess, onValidationFailure]);

  // 开始扫描
  const startScanning = () => {
    if (!targetCode.trim()) {
      alert('请先配置预期条码');
      return;
    }
    setIsScanning(true);
    setValidationStatus('scanning');
    setCurrentInput('');
    inputBufferRef.current = '';
  };

  // 停止扫描
  const stopScanning = () => {
    setIsScanning(false);
    setValidationStatus('idle');
    setCurrentInput('');
    inputBufferRef.current = '';
  };

  // 暂停/恢复扫描
  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  // 保存配置
  const handleSaveConfig = () => {
    if (!targetCode.trim()) {
      alert('请输入预期条码');
      return;
    }
    saveConfig();
    setIsConfiguring(false);
    alert('配置已保存');
  };

  // 获取状态颜色
  const getStatusColor = () => {
    switch (validationStatus) {
      case 'scanning': return 'border-blue-500 bg-blue-50';
      case 'success': return 'border-green-500 bg-green-50';
      case 'error': return 'border-red-500 bg-red-50';
      default: return 'border-gray-300 bg-white';
    }
  };

  // 获取状态文本
  const getStatusText = () => {
    switch (validationStatus) {
      case 'scanning': return isPaused ? '扫描已暂停' : '等待扫码输入...';
      case 'success': return '验证通过！';
      case 'error': return '验证失败！';
      default: return '准备就绪';
    }
  };

  return (
    <div className={className}>
      {/* 隐藏的输入框用于接收扫码枪输入 */}
      <input
        ref={hiddenInputRef}
        type="text"
        className="opacity-0 absolute -left-9999px"
        tabIndex={-1}
        onChange={() => {}} // 防止React警告
      />

      <div className={`rounded-lg border shadow-sm p-6 transition-all duration-300 ${getStatusColor()}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
              validationStatus === 'scanning' ? 'bg-blue-500 animate-pulse' :
              validationStatus === 'success' ? 'bg-green-500' :
              validationStatus === 'error' ? 'bg-red-500' :
              'bg-gray-400'
            }`}>
              <div className="h-3 w-3 bg-white rounded-full"></div>
            </div>
            <span className="text-xl font-semibold">USB扫码枪验证</span>
          </div>
          <button
            onClick={() => setIsConfiguring(!isConfiguring)}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            ⚙️ 配置
          </button>
        </div>

        {/* 配置区域 */}
        {isConfiguring && (
          <div className="p-4 bg-gray-50 rounded-lg mb-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                预期条码
              </label>
              <input
                type="text"
                value={targetCode}
                onChange={(e) => setTargetCode(e.target.value)}
                placeholder="请输入预期的条码内容"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleSaveConfig}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                保存配置
              </button>
              <button 
                onClick={() => setIsConfiguring(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* 状态显示区域 */}
        <div className="text-center py-6">
          <div className="text-2xl font-bold mb-2">
            {getStatusText()}
          </div>
          {currentInput && (
            <div className="text-sm text-gray-600 mb-2">
              当前输入: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{currentInput}</span>
            </div>
          )}
          {targetCode && (
            <div className="text-sm text-gray-500">
              预期条码: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{targetCode}</span>
            </div>
          )}
        </div>

        {/* 控制按钮 */}
        <div className="flex justify-center gap-3 mb-4">
          {!isScanning ? (
            <button 
              onClick={startScanning}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
            >
              ▶️ 开始扫描
            </button>
          ) : (
            <>
              <button 
                onClick={togglePause}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2"
              >
                {isPaused ? '▶️ 恢复' : '⏸️ 暂停'}
              </button>
              <button 
                onClick={stopScanning}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                ⏹️ 停止扫描
              </button>
            </>
          )}
        </div>

        {/* 状态提示 */}
        {validationStatus !== 'idle' && (
          <div className={`p-3 rounded-md mb-4 ${
            validationStatus === 'success' ? 'bg-green-100 border border-green-200 text-green-800' :
            validationStatus === 'error' ? 'bg-red-100 border border-red-200 text-red-800' :
            'bg-blue-100 border border-blue-200 text-blue-800'
          }`}>
            <div className="flex items-center gap-2">
              <span>
                {validationStatus === 'success' && '✅ 条码验证成功！'}
                {validationStatus === 'error' && '❌ 条码验证失败，请重新扫描'}
                {validationStatus === 'scanning' && (isPaused ? '⏸️ 扫描已暂停，点击恢复继续' : '🔍 请使用扫码枪扫描条码')}
              </span>
            </div>
          </div>
        )}

        {/* 扫描历史 */}
        {scanHistory.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">扫描历史</h4>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {scanHistory.map((result, index) => (
                <div 
                  key={index}
                  className={`text-xs p-2 rounded flex items-center justify-between ${
                    result.isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  <span className="font-mono">{result.code}</span>
                  <div className="flex items-center gap-1">
                    <span>{result.isValid ? '✅' : '❌'}</span>
                    <span>{result.timestamp.toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 使用说明 */}
        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded mt-4">
          <p className="font-medium mb-1">使用说明：</p>
          <ul className="list-disc list-inside space-y-1">
            <li>USB扫码枪即插即用，无需额外驱动</li>
            <li>扫码枪会模拟键盘输入，自动检测扫码完成</li>
            <li>扫描时请确保页面处于活动状态</li>
            <li>支持暂停/恢复功能，方便操作控制</li>
          </ul>
        </div>
      </div>
    </div>
  );
}