/**
 * 设备缓存管理器 - 工业性能优化
 * 用于缓存设备配置和连接状态，减少数据库查询和重复连接
 */

interface CachedDevice {
  deviceId: string;
  instanceId: string;
  name: string;
  type: string;
  ipAddress: string;
  port: number;
  brand?: string;
  protocol?: string;
  isConnected: boolean;
  lastHeartbeat: Date;
  cachedAt: number;
  ttl: number;
}

interface ConnectionPoolEntry {
  deviceId: string;
  isConnected: boolean;
  connectionTime: number;
  lastActivity: number;
  connectionCount: number;
}

class DeviceCacheManager {
  private static instance: DeviceCacheManager;
  
  // 设备配置缓存
  private deviceCache: Map<string, CachedDevice> = new Map();
  
  // 连接池管理
  private connectionPool: Map<string, ConnectionPoolEntry> = new Map();
  
  // 设备状态缓存
  private statusCache: Map<string, {
    status: any;
    timestamp: number;
    ttl: number;
  }> = new Map();
  
  // 缓存配置
  private readonly DEFAULT_DEVICE_CACHE_TTL = 60000; // 60秒设备配置缓存
  private readonly DEFAULT_STATUS_CACHE_TTL = 500; // 500ms状态缓存
  private readonly CONNECTION_POOL_TTL = 300000; // 5分钟连接保持
  private readonly MAX_POOL_SIZE = 50; // 最大连接池大小
  
  private constructor() {
    // 启动定期清理任务
    this.startCleanupTask();
  }
  
  static getInstance(): DeviceCacheManager {
    if (!DeviceCacheManager.instance) {
      DeviceCacheManager.instance = new DeviceCacheManager();
    }
    return DeviceCacheManager.instance;
  }
  
  // 获取缓存的设备配置
  getDevice(deviceId: string): CachedDevice | null {
    const cached = this.deviceCache.get(deviceId);
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.cachedAt > cached.ttl) {
      this.deviceCache.delete(deviceId);
      return null;
    }
    
    return cached;
  }
  
  // 设置设备配置缓存
  setDevice(device: Omit<CachedDevice, 'cachedAt' | 'ttl'>, ttl?: number): void {
    this.deviceCache.set(device.instanceId, {
      ...device,
      cachedAt: Date.now(),
      ttl: ttl || this.DEFAULT_DEVICE_CACHE_TTL
    });
  }
  
  // 获取设备连接状态
  isDeviceConnected(deviceId: string): boolean | null {
    const poolEntry = this.connectionPool.get(deviceId);
    if (!poolEntry) return null;
    
    const now = Date.now();
    // 检查连接是否过期
    if (now - poolEntry.lastActivity > this.CONNECTION_POOL_TTL) {
      this.connectionPool.delete(deviceId);
      return null;
    }
    
    return poolEntry.isConnected;
  }
  
  // 更新设备连接状态
  updateConnectionStatus(deviceId: string, isConnected: boolean): void {
    const existing = this.connectionPool.get(deviceId);
    const now = Date.now();
    
    if (existing) {
      existing.isConnected = isConnected;
      existing.lastActivity = now;
      if (isConnected && !existing.isConnected) {
        existing.connectionTime = now;
        existing.connectionCount++;
      }
    } else {
      // 限制连接池大小
      if (this.connectionPool.size >= this.MAX_POOL_SIZE) {
        this.cleanOldestConnection();
      }
      
      this.connectionPool.set(deviceId, {
        deviceId,
        isConnected,
        connectionTime: isConnected ? now : 0,
        lastActivity: now,
        connectionCount: isConnected ? 1 : 0
      });
    }
  }
  
  // 获取设备状态缓存
  getDeviceStatus(deviceId: string): any | null {
    const cached = this.statusCache.get(deviceId);
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.statusCache.delete(deviceId);
      return null;
    }
    
    return cached.status;
  }
  
  // 设置设备状态缓存
  setDeviceStatus(deviceId: string, status: any, ttl?: number): void {
    this.statusCache.set(deviceId, {
      status,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_STATUS_CACHE_TTL
    });
  }
  
  // 批量预热设备缓存
  async warmupDeviceCache(deviceIds: string[]): Promise<void> {
    // 这里可以批量查询数据库并填充缓存
    // 实际实现需要调用数据库查询
    console.log(`Warming up cache for ${deviceIds.length} devices`);
  }
  
  // 清理最旧的连接
  private cleanOldestConnection(): void {
    let oldestTime = Date.now();
    let oldestKey = '';
    
    for (const [key, entry] of this.connectionPool) {
      if (entry.lastActivity < oldestTime) {
        oldestTime = entry.lastActivity;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.connectionPool.delete(oldestKey);
    }
  }
  
  // 定期清理过期缓存
  private startCleanupTask(): void {
    setInterval(() => {
      const now = Date.now();
      
      // 清理设备配置缓存
      for (const [key, device] of this.deviceCache) {
        if (now - device.cachedAt > device.ttl) {
          this.deviceCache.delete(key);
        }
      }
      
      // 清理状态缓存
      for (const [key, status] of this.statusCache) {
        if (now - status.timestamp > status.ttl) {
          this.statusCache.delete(key);
        }
      }
      
      // 清理连接池
      for (const [key, conn] of this.connectionPool) {
        if (now - conn.lastActivity > this.CONNECTION_POOL_TTL) {
          this.connectionPool.delete(key);
        }
      }
    }, 30000); // 每30秒清理一次
  }
  
  // 获取缓存统计信息
  getStats() {
    return {
      deviceCacheSize: this.deviceCache.size,
      statusCacheSize: this.statusCache.size,
      connectionPoolSize: this.connectionPool.size,
      activeConnections: Array.from(this.connectionPool.values()).filter(c => c.isConnected).length
    };
  }
  
  // 清除所有缓存
  clearAll(): void {
    this.deviceCache.clear();
    this.statusCache.clear();
    this.connectionPool.clear();
  }
  
  // 清除特定设备的所有缓存
  clearDevice(deviceId: string): void {
    this.deviceCache.delete(deviceId);
    this.statusCache.delete(deviceId);
    this.connectionPool.delete(deviceId);
  }
}

export default DeviceCacheManager;
export { DeviceCacheManager, type CachedDevice, type ConnectionPoolEntry };