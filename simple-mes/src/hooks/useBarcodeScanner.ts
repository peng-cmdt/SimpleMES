import { useEffect, useRef, useState, useCallback } from 'react';

export interface BarcodeScannerOptions {
  onScan?: (code: string) => void;
  onValidate?: (code: string, isValid: boolean) => void;
  expectedCode?: string;
  minLength?: number;
  maxLength?: number;
  scanTimeout?: number;
  preventSubmit?: boolean;
  ignoreIfFocusOn?: string[];
  enabled?: boolean;
}

interface ScanState {
  isScanning: boolean;
  lastScannedCode: string;
  lastScanTime: number;
  isValid: boolean | null;
  error: string | null;
}

/**
 * USB扫码枪检测Hook
 * 通过检测快速键盘输入来识别扫码枪输入
 */
export function useBarcodeScanner(options: BarcodeScannerOptions = {}) {
  const {
    onScan,
    onValidate,
    expectedCode,
    minLength = 3,
    maxLength = 100,
    scanTimeout = 100, // 扫码枪输入的字符间隔通常小于100ms
    preventSubmit = true,
    ignoreIfFocusOn = ['INPUT', 'TEXTAREA'],
    enabled = true
  } = options;

  const [scanState, setScanState] = useState<ScanState>({
    isScanning: false,
    lastScannedCode: '',
    lastScanTime: 0,
    isValid: null,
    error: null
  });

  const [isWaiting, setIsWaiting] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    success: boolean;
    code: string;
    message: string;
    timestamp: number;
  } | null>(null);

  const bufferRef = useRef<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastKeyTimeRef = useRef<number>(0);
  const scanStartTimeRef = useRef<number>(0);

  // 验证扫描的条码
  const validateBarcode = useCallback((scannedCode: string): boolean => {
    if (!expectedCode) {
      return true; // 没有预设条码，默认通过
    }
    return scannedCode.trim() === expectedCode.trim();
  }, [expectedCode]);

  // 处理完整的扫码输入
  const processScanComplete = useCallback((code: string) => {
    console.log('[BarcodeScanner] 扫码完成:', code);
    
    // 清理缓冲区
    bufferRef.current = '';
    
    // 验证长度
    if (code.length < minLength || code.length > maxLength) {
      setScanState(prev => ({
        ...prev,
        isScanning: false,
        error: `条码长度无效 (${code.length}字符)`,
        isValid: false
      }));
      setValidationResult({
        success: false,
        code,
        message: `条码长度必须在${minLength}-${maxLength}之间`,
        timestamp: Date.now()
      });
      return;
    }
    
    // 验证条码
    const isValid = validateBarcode(code);
    
    setScanState({
      isScanning: false,
      lastScannedCode: code,
      lastScanTime: Date.now(),
      isValid,
      error: isValid ? null : '条码不匹配'
    });
    
    setValidationResult({
      success: isValid,
      code,
      message: isValid ? '验证通过' : `条码不匹配，期望: ${expectedCode}`,
      timestamp: Date.now()
    });
    
    // 触发回调
    if (onScan) {
      onScan(code);
    }
    
    if (onValidate) {
      onValidate(code, isValid);
    }
    
    // 如果验证失败，3秒后清除错误状态
    if (!isValid) {
      setTimeout(() => {
        setValidationResult(null);
        setScanState(prev => ({ ...prev, error: null, isValid: null }));
      }, 3000);
    }
  }, [minLength, maxLength, validateBarcode, expectedCode, onScan, onValidate]);

  // 处理键盘输入
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;
    
    // 检查是否应该忽略当前焦点元素
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && ignoreIfFocusOn.includes(activeElement.tagName)) {
      // 除非是在特定的扫码输入框中
      if (!activeElement.classList.contains('barcode-input')) {
        return;
      }
    }
    
    const currentTime = Date.now();
    const timeSinceLastKey = currentTime - lastKeyTimeRef.current;
    
    // 如果按键间隔超过阈值，认为是新的扫码开始
    if (timeSinceLastKey > scanTimeout) {
      bufferRef.current = '';
      scanStartTimeRef.current = currentTime;
      setScanState(prev => ({ ...prev, isScanning: true, error: null }));
    }
    
    lastKeyTimeRef.current = currentTime;
    
    // 处理回车键（扫码结束）
    if (event.key === 'Enter') {
      if (preventSubmit) {
        event.preventDefault();
      }
      
      if (bufferRef.current.length > 0) {
        processScanComplete(bufferRef.current);
      }
      return;
    }
    
    // 累积字符
    if (event.key.length === 1) { // 只处理可打印字符
      bufferRef.current += event.key;
      
      // 清除之前的超时
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // 设置新的超时，用于处理没有回车结束的扫码
      timeoutRef.current = setTimeout(() => {
        if (bufferRef.current.length >= minLength) {
          processScanComplete(bufferRef.current);
        } else {
          // 输入太短，清除缓冲区
          bufferRef.current = '';
          setScanState(prev => ({ ...prev, isScanning: false }));
        }
      }, scanTimeout * 2);
    }
  }, [enabled, ignoreIfFocusOn, scanTimeout, preventSubmit, minLength, processScanComplete]);

  // 监听键盘事件
  useEffect(() => {
    if (!enabled) return;
    
    window.addEventListener('keydown', handleKeyPress);
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, handleKeyPress]);

  // 开始等待扫码
  const startWaiting = useCallback(() => {
    setIsWaiting(true);
    setValidationResult(null);
    setScanState({
      isScanning: false,
      lastScannedCode: '',
      lastScanTime: 0,
      isValid: null,
      error: null
    });
    bufferRef.current = '';
  }, []);

  // 停止等待扫码
  const stopWaiting = useCallback(() => {
    setIsWaiting(false);
    bufferRef.current = '';
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  // 重置状态
  const reset = useCallback(() => {
    stopWaiting();
    setValidationResult(null);
    setScanState({
      isScanning: false,
      lastScannedCode: '',
      lastScanTime: 0,
      isValid: null,
      error: null
    });
  }, [stopWaiting]);

  // 手动设置期望条码
  const setExpectedBarcode = useCallback((code: string) => {
    // 这需要在组件中管理expectedCode状态
    console.log('[BarcodeScanner] 设置期望条码:', code);
  }, []);

  return {
    // 状态
    scanState,
    isWaiting,
    validationResult,
    isScanning: scanState.isScanning,
    lastScannedCode: scanState.lastScannedCode,
    isValid: scanState.isValid,
    error: scanState.error,
    
    // 方法
    startWaiting,
    stopWaiting,
    reset,
    setExpectedBarcode,
    
    // 用于调试
    currentBuffer: bufferRef.current
  };
}