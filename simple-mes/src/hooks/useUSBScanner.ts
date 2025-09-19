import { useState, useEffect, useCallback, useRef } from 'react';

export interface ScannerConfig {
  timeout: number;
  keyInterval: number;
  minLength: number;
  maxLength: number;
}

export interface ScanResult {
  code: string;
  isValid: boolean;
  timestamp: Date;
}

interface UseUSBScannerOptions {
  config?: Partial<ScannerConfig>;
  validator?: (code: string) => boolean;
  onScan?: (result: ScanResult) => void;
}

const defaultConfig: ScannerConfig = {
  timeout: 500,
  keyInterval: 100,
  minLength: 1,
  maxLength: 100
};

export const useUSBScanner = (options: UseUSBScannerOptions = {}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);
  const [currentInput, setCurrentInput] = useState('');
  
  const config = { ...defaultConfig, ...options.config };
  const inputBufferRef = useRef<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastKeyTimeRef = useRef<number>(0);

  const handleScanComplete = useCallback((scannedCode: string) => {
    const isValid = options.validator ? options.validator(scannedCode) : true;
    const result: ScanResult = {
      code: scannedCode,
      isValid,
      timestamp: new Date()
    };

    setLastScanResult(result);
    options.onScan?.(result);
  }, [options]);

  useEffect(() => {
    if (!isScanning) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      const now = Date.now();
      
      // 检测是否是扫码枪输入（快速连续输入）
      const timeSinceLastKey = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // 如果间隔太长，可能是手动输入，重置缓冲区
      if (timeSinceLastKey > config.keyInterval && inputBufferRef.current.length > 0) {
        inputBufferRef.current = '';
        setCurrentInput('');
      }

      // 检测回车键，表示扫码完成
      if (event.key === 'Enter') {
        if (inputBufferRef.current.trim() && 
            inputBufferRef.current.length >= config.minLength &&
            inputBufferRef.current.length <= config.maxLength) {
          handleScanComplete(inputBufferRef.current.trim());
        }
        inputBufferRef.current = '';
        setCurrentInput('');
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
        
        // 设置新的超时
        timeoutRef.current = setTimeout(() => {
          inputBufferRef.current = '';
          setCurrentInput('');
        }, config.timeout);
      }
    };

    // 添加键盘事件监听器
    document.addEventListener('keydown', handleKeyPress, true);

    return () => {
      document.removeEventListener('keydown', handleKeyPress, true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isScanning, config, handleScanComplete]);

  const startScanning = useCallback(() => {
    setIsScanning(true);
    inputBufferRef.current = '';
    setCurrentInput('');
    setLastScanResult(null);
  }, []);

  const stopScanning = useCallback(() => {
    setIsScanning(false);
    inputBufferRef.current = '';
    setCurrentInput('');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return {
    isScanning,
    currentInput,
    lastScanResult,
    startScanning,
    stopScanning
  };
};