/**
 * 设备预加载管理器 - 工业性能优化
 * 在工位登录时预连接所有相关设备，提高首次操作响应速度
 */

import { DeviceCacheManager } from '@/lib/device-cache/DeviceCacheManager';
import { WebSocketDeviceClient } from '@/lib/device-communication/WebSocketDeviceClient';

interface PreloadTask {
  workstationId: string;
  deviceIds: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  completedDevices: string[];
  failedDevices: Array<{deviceId: string, error: string}>;
  totalTime?: number;
}

interface PreloadConfig {
  maxConcurrent: number; // 最大并发连接数
  connectionTimeout: number; // 单个设备连接超时
  retryAttempts: number; // 重试次数
  warmupDelay: number; // 预热延迟时间
}

class DevicePreloadManager {
  private static instance: DevicePreloadManager;
  private cache = DeviceCacheManager.getInstance();
  private wsClient = WebSocketDeviceClient.getInstance();
  private activeTasks: Map<string, PreloadTask> = new Map();
  private eventListeners: Map<string, Set<Function>> = new Map();
  
  // 工业优化配置
  private config: PreloadConfig = {
    maxConcurrent: 5, // 同时连接5个设备
    connectionTimeout: 2000, // 2秒连接超时
    retryAttempts: 2, // 重试2次
    warmupDelay: 100 // 100ms预热延迟
  };
  
  private constructor() {}
  
  static getInstance(): DevicePreloadManager {
    if (!DevicePreloadManager.instance) {
      DevicePreloadManager.instance = new DevicePreloadManager();
    }
    return DevicePreloadManager.instance;
  }
  
  // 为工位预加载所有设备
  async preloadWorkstationDevices(workstationId: string, deviceIds: string[]): Promise<PreloadTask> {
    console.log(`开始预加载工位 ${workstationId} 的 ${deviceIds.length} 个设备...`);
    
    const task: PreloadTask = {
      workstationId,
      deviceIds: [...deviceIds],
      status: 'running',
      startTime: Date.now(),
      completedDevices: [],
      failedDevices: []
    };
    
    this.activeTasks.set(workstationId, task);
    this.emit('preload_started', { workstationId, deviceCount: deviceIds.length });
    
    try {
      // 分批并发连接设备
      const batches = this.chunkArray(deviceIds, this.config.maxConcurrent);
      
      for (const batch of batches) {
        await this.processDeviceBatch(batch, task);
      }
      
      task.status = 'completed';
      task.totalTime = Date.now() - task.startTime!;
      
      console.log(`工位 ${workstationId} 设备预加载完成: ` +
        `成功 ${task.completedDevices.length}/${deviceIds.length} 个设备, ` +
        `耗时 ${task.totalTime}ms`);
      
      this.emit('preload_completed', {
        workstationId,
        successCount: task.completedDevices.length,
        totalCount: deviceIds.length,
        totalTime: task.totalTime
      });
      
    } catch (error) {
      task.status = 'failed';
      task.totalTime = Date.now() - task.startTime!;
      
      console.error(`工位 ${workstationId} 设备预加载失败:`, error);
      this.emit('preload_failed', { workstationId, error });
    }
    
    return task;
  }
  
  // 处理设备批次
  private async processDeviceBatch(deviceIds: string[], task: PreloadTask): Promise<void> {
    const promises = deviceIds.map(deviceId => this.preloadSingleDevice(deviceId, task));
    
    // 等待所有设备连接完成（允许部分失败）
    const results = await Promise.allSettled(promises);
    
    // 处理结果
    results.forEach((result, index) => {
      const deviceId = deviceIds[index];
      
      if (result.status === 'fulfilled' && result.value) {
        task.completedDevices.push(deviceId);
        this.emit('device_preloaded', { deviceId, workstationId: task.workstationId });
      } else {
        const error = result.status === 'rejected' 
          ? result.reason?.message || 'Unknown error'
          : 'Connection failed';
        
        task.failedDevices.push({ deviceId, error });
        this.emit('device_preload_failed', { deviceId, workstationId: task.workstationId, error });
      }
    });
  }
  
  // 预加载单个设备
  private async preloadSingleDevice(deviceId: string, task: PreloadTask): Promise<boolean> {
    console.log(`预连接设备: ${deviceId}`);
    
    let retries = 0;
    while (retries <= this.config.retryAttempts) {
      try {
        // 首先从数据库预加载设备配置
        await this.preloadDeviceConfig(deviceId);
        
        // 预热延迟
        if (this.config.warmupDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, this.config.warmupDelay));
        }
        
        // 建立设备连接
        const connected = await this.connectWithTimeout(deviceId, this.config.connectionTimeout);
        
        if (connected) {
          console.log(`设备 ${deviceId} 预连接成功`);
          return true;
        } else {
          throw new Error('连接返回失败状态');
        }
        
      } catch (error) {
        retries++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        
        if (retries <= this.config.retryAttempts) {
          console.warn(`设备 ${deviceId} 连接失败，第 ${retries} 次重试: ${errorMsg}`);
          await new Promise(resolve => setTimeout(resolve, retries * 500)); // 递增重试延迟
        } else {
          console.error(`设备 ${deviceId} 预连接最终失败: ${errorMsg}`);
          return false;
        }
      }
    }
    
    return false;
  }
  
  // 超时连接
  private async connectWithTimeout(deviceId: string, timeout: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('连接超时'));
      }, timeout);
      
      this.wsClient.connectDevice(deviceId)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
  
  // 预加载设备配置
  private async preloadDeviceConfig(deviceId: string): Promise<void> {
    try {
      // 检查缓存是否已存在
      const cached = this.cache.getDevice(deviceId);
      if (cached) {
        console.log(`设备 ${deviceId} 配置已在缓存中`);
        return;
      }
      
      // 从数据库查询设备配置
      const response = await fetch(`/api/workstation-devices/lookup/${deviceId}`);
      if (!response.ok) {
        throw new Error(`查询设备配置失败: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success && result.data) {
        const device = result.data;
        
        // 缓存设备配置
        this.cache.setDevice({
          deviceId: device.instanceId,
          instanceId: device.instanceId,
          name: device.displayName,
          type: device.template?.type || 'UNKNOWN',
          ipAddress: device.ipAddress,
          port: device.port,
          brand: device.template?.brand,
          protocol: device.protocol,
          isConnected: false,
          lastHeartbeat: device.lastHeartbeat || new Date()
        });
        
        console.log(`设备 ${deviceId} 配置已缓存`);
      } else {
        throw new Error('设备配置查询返回空结果');
      }
      
    } catch (error) {
      console.warn(`预加载设备 ${deviceId} 配置失败:`, error);
      throw error;
    }
  }
  
  // 获取工位预加载状态
  getPreloadStatus(workstationId: string): PreloadTask | null {
    return this.activeTasks.get(workstationId) || null;
  }
  
  // 检查设备是否已预加载
  isDevicePreloaded(deviceId: string): boolean {
    // 检查缓存和连接状态
    const cachedDevice = this.cache.getDevice(deviceId);
    const isConnected = this.cache.isDeviceConnected(deviceId);
    
    return cachedDevice !== null && isConnected === true;
  }
  
  // 批量检查设备预加载状态
  getPreloadedDevices(deviceIds: string[]): {
    preloaded: string[],
    notPreloaded: string[]
  } {
    const preloaded: string[] = [];
    const notPreloaded: string[] = [];
    
    for (const deviceId of deviceIds) {
      if (this.isDevicePreloaded(deviceId)) {
        preloaded.push(deviceId);
      } else {
        notPreloaded.push(deviceId);
      }
    }
    
    return { preloaded, notPreloaded };
  }
  
  // 清理工位预加载任务
  cleanupPreloadTask(workstationId: string): void {
    this.activeTasks.delete(workstationId);
    console.log(`清理工位 ${workstationId} 预加载任务`);
  }
  
  // 数组分块
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
  
  // 事件监听
  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }
  
  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }
  
  private emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`预加载事件监听器错误 '${event}':`, error);
        }
      });
    }
  }
  
  // 获取统计信息
  getStats() {
    const stats = {
      activeTasks: this.activeTasks.size,
      cacheStats: this.cache.getStats(),
      wsConnected: this.wsClient.connected
    };
    
    return stats;
  }
  
  // 更新配置
  updateConfig(config: Partial<PreloadConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('预加载配置已更新:', this.config);
  }
}

export default DevicePreloadManager;
export { DevicePreloadManager, type PreloadTask, type PreloadConfig };