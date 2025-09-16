'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface USBScannerConfig {
  targetCode?: string;
  minInputLength?: number;
  maxInputLength?: number;
  inputTimeout?: number;
  autoStart?: boolean;
}

interface ScanResult {
  code: string;
  timestamp: Date;
  deviceId?: string;
}

interface USBScannerHook {
  isDeviceDetected: boolean;
  isListening: boolean;
  lastScanResult: ScanResult | null;
  scanHistory: ScanResult[];
  startListening: () => void;
  stopListening: () => void;
  setConfig: (config: USBScannerConfig) => void;
}

const DEFAULT_CONFIG: Required<USBScannerConfig> = {
  targetCode: '',
  minInputLength: 3,
  maxInputLength: 50,
  inputTimeout: 500,
  autoStart: true,
};

export function useUSBScannerDetector(
  onScanSuccess?: (result: ScanResult) => void,
  onScanError?: (error: string) => void,
  initialConfig?: USBScannerConfig
): USBScannerHook {
  // 状态管理
  const [isDeviceDetected, setIsDeviceDetected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [config, setConfigState] = useState<Required<USBScannerConfig>>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  });

  // 输入缓冲和状态
  const inputBufferRef = useRef<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 检测USB设备 - 简化版本，适用于模拟键盘的扫码枪
  const checkUSBDevices = useCallback(async () => {
    // USB扫码枪通常模拟键盘输入，无需特殊检测
    // 直接设置为已检测到设备，通过实际输入验证设备是否工作
    setIsDeviceDetected(true);
    
    // 可选：如果需要更严格的检测，可以尝试WebUSB API
    if ((navigator as any).usb) {
      try {
        const devices = await (navigator as any).usb.getDevices();
        console.log('检测到的USB设备数量:', devices.length);
        // 即使没有检测到特定设备，也保持 true，因为扫码枪可能作为标准键盘设备工作
      } catch (error) {
        // USB设备检测失败是正常情况，扫码枪通常作为标准键盘设备工作
        // 不需要输出错误信息，静默处理
      }
    }
  }, []);

  // 处理键盘输入（USB扫码枪模拟键盘输入）
  const handleKeyboardInput = useCallback((event: KeyboardEvent) => {
    // 只在监听状态下处理
    if (!isListening) return;
    
    // 忽略在输入框中的输入
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      return;
    }

    // 阻止默认行为
    event.preventDefault();
    
    // 检测回车键，表示用户输入完成
    if (event.key === 'Enter') {
      if (inputBufferRef.current.trim()) {
        const scannedCode = inputBufferRef.current.trim();
        console.log('USB扫码枪输入完成，等待验证:', scannedCode);
        // 等待用户输入完成后再进行验证
        handleScanComplete(scannedCode);
      }
      inputBufferRef.current = '';
      return;
    }

    // 累积字符输入 - 不立即验证，等待回车键
    if (event.key.length === 1) {
      inputBufferRef.current += event.key;
      console.log('USB扫码枪输入中:', inputBufferRef.current);
      
      // 检查输入长度限制
      if (inputBufferRef.current.length > config.maxInputLength) {
        inputBufferRef.current = '';
        onScanError?.('输入过长，已重置');
        return;
      }
      
      // 清除之前的超时
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // 设置新的超时，如果指定时间内没有新输入，清空缓冲区
      // 增加超时时间，给用户更多时间完成输入
      timeoutRef.current = setTimeout(() => {
        console.log('USB扫码枪输入超时，清空缓冲区');
        inputBufferRef.current = '';
      }, config.inputTimeout * 2); // 延长超时时间
    }
  }, [isListening, config, onScanError]);

  // 处理扫码完成 - 用户按回车键后才进行验证
  const handleScanComplete = useCallback((scannedCode: string) => {
    console.log('开始验证扫码结果:', scannedCode);
    
    if (scannedCode.length < config.minInputLength) {
      console.log('输入长度不足，验证失败');
      onScanError?.(`输入太短，最少需要${config.minInputLength}个字符`);
      return;
    }

    const result: ScanResult = {
      code: scannedCode,
      timestamp: new Date(),
    };

    // 更新状态
    setLastScanResult(result);
    setScanHistory(prev => [result, ...prev.slice(0, 19)]); // 保留最近20条记录

    // 验证扫码结果是否匹配预期值
    if (config.targetCode && scannedCode !== config.targetCode) {
      console.log('扫码验证失败，不匹配预期值:', { scanned: scannedCode, expected: config.targetCode });
      onScanError?.(`验证失败：扫描值 "${scannedCode}" 不匹配预期值 "${config.targetCode}"`);
      return;
    }

    console.log('扫码验证成功');
    // 调用成功回调
    onScanSuccess?.(result);
  }, [config.minInputLength, config.targetCode, onScanSuccess, onScanError]);

  // 开始监听
  const startListening = useCallback(() => {
    if (!isDeviceDetected) {
      onScanError?.('未检测到USB扫码枪设备');
      return;
    }
    
    setIsListening(true);
    inputBufferRef.current = '';
  }, [isDeviceDetected, onScanError]);

  // 停止监听
  const stopListening = useCallback(() => {
    setIsListening(false);
    inputBufferRef.current = '';
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // 设置配置
  const setConfig = useCallback((newConfig: USBScannerConfig) => {
    setConfigState(prev => ({
      ...prev,
      ...newConfig,
    }));
  }, []);

  // 初始化设备检测状态
  useEffect(() => {
    checkUSBDevices(); // 初始检查，直接设置为已检测到
  }, [checkUSBDevices]);

  // 键盘事件监听
  useEffect(() => {
    if (isListening) {
      document.addEventListener('keydown', handleKeyboardInput, true);
      return () => {
        document.removeEventListener('keydown', handleKeyboardInput, true);
      };
    }
  }, [isListening, handleKeyboardInput]);

  // 自动启动监听
  useEffect(() => {
    if (config.autoStart && isDeviceDetected && !isListening) {
      startListening();
    }
  }, [config.autoStart, isDeviceDetected, isListening, startListening]);

  // 清理函数
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isDeviceDetected,
    isListening,
    lastScanResult,
    scanHistory,
    startListening,
    stopListening,
    setConfig,
  };
}