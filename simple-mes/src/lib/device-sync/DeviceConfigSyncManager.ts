// 设备配置自动同步工具类
// 当前台设备配置变更时，自动通知.NET服务进行同步

interface DeviceSyncConfig {
  dotnetServiceUrl: string;
  syncTimeoutMs: number;
  enableAutoSync: boolean;
  retryAttempts: number;
  retryDelayMs: number;
}

interface SyncNotification {
  changeType: 'device' | 'workstation' | 'global';
  workstationId?: string;
  affectedDevices?: string[];
  userId?: string;
  description?: string;
}

interface SyncResponse {
  success: boolean;
  message: string;
  timestamp: string;
  workstationId?: string;
  affectedDevices?: string[];
}

class DeviceConfigSyncManager {
  private config: DeviceSyncConfig;
  private isInitialized = false;

  constructor(config?: Partial<DeviceSyncConfig>) {
    this.config = {
      dotnetServiceUrl: process.env.NEXT_PUBLIC_DOTNET_SERVICE_URL || 'http://localhost:5000',
      syncTimeoutMs: 10000, // 10秒超时
      enableAutoSync: true,
      retryAttempts: 3,
      retryDelayMs: 1000,
      ...config
    };
  }

  /**
   * 初始化同步管理器
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🔄 Initializing DeviceConfigSyncManager...');
      
      // 检查.NET服务是否可用
      const isServiceAvailable = await this.checkServiceHealth();
      if (!isServiceAvailable) {
        console.warn('⚠️ .NET Device Communication Service is not available');
        // 即使服务不可用也标记为已初始化，避免阻塞前台功能
      }

      this.isInitialized = true;
      console.log('✅ DeviceConfigSyncManager initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize DeviceConfigSyncManager:', error);
      this.isInitialized = true; // 失败时也标记为已初始化
      return false;
    }
  }

  /**
   * 检查.NET服务健康状态
   */
  async checkServiceHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.config.dotnetServiceUrl}/api/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.debug('Service health check failed:', error);
      return false;
    }
  }

  /**
   * 同步所有设备配置
   */
  async syncAllConfigurations(): Promise<SyncResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return this.performSync('/api/configsync/refresh', {
      method: 'POST'
    });
  }

  /**
   * 同步指定工位的设备配置
   */
  async syncWorkstationConfigurations(workstationId: string): Promise<SyncResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return this.performSync(`/api/configsync/refresh/${workstationId}`, {
      method: 'POST'
    });
  }

  /**
   * 通知设备配置变更
   */
  async notifyConfigurationChange(notification: SyncNotification): Promise<SyncResponse> {
    if (!this.config.enableAutoSync) {
      console.debug('Auto-sync is disabled, skipping notification');
      return {
        success: true,
        message: 'Auto-sync disabled',
        timestamp: new Date().toISOString()
      };
    }

    if (!this.isInitialized) {
      await this.initialize();
    }

    return this.performSync('/api/configsync/notify-change', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...notification,
        timestamp: new Date().toISOString()
      })
    });
  }

  /**
   * 获取.NET服务的配置同步状态
   */
  async getSyncStatus(): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.syncTimeoutMs);

      const response = await fetch(`${this.config.dotnetServiceUrl}/api/configsync/status`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get sync status:', error);
      throw error;
    }
  }

  /**
   * 执行同步请求（带重试机制）
   */
  private async performSync(endpoint: string, options: RequestInit): Promise<SyncResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.syncTimeoutMs);

        const response = await fetch(`${this.config.dotnetServiceUrl}${endpoint}`, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          }
        });

        clearTimeout(timeoutId);

        const result = await response.json();

        if (response.ok) {
          console.log(`✅ Sync successful on attempt ${attempt}:`, result);
          return result;
        } else {
          console.warn(`⚠️ Sync failed on attempt ${attempt}:`, result);
          lastError = new Error(result.message || `HTTP ${response.status}`);
        }
      } catch (error) {
        console.warn(`⚠️ Sync attempt ${attempt} failed:`, error);
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.config.retryAttempts) {
          console.log(`🔄 Retrying in ${this.config.retryDelayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs));
        }
      }
    }

    // 所有重试都失败了
    console.error(`❌ All sync attempts failed. Last error:`, lastError);
    return {
      success: false,
      message: lastError?.message || 'Sync failed after all retries',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 批量设备操作后的自动同步
   */
  async handleDeviceOperation(
    operation: 'create' | 'update' | 'delete',
    workstationId: string,
    deviceIds: string[],
    userId?: string
  ): Promise<SyncResponse> {
    const descriptions = {
      create: `Created ${deviceIds.length} device(s)`,
      update: `Updated ${deviceIds.length} device(s)`,
      delete: `Deleted ${deviceIds.length} device(s)`
    };

    return this.notifyConfigurationChange({
      changeType: 'device',
      workstationId,
      affectedDevices: deviceIds,
      userId,
      description: descriptions[operation]
    });
  }

  /**
   * 工位配置变更后的自动同步
   */
  async handleWorkstationOperation(
    operation: 'create' | 'update' | 'delete',
    workstationId: string,
    userId?: string
  ): Promise<SyncResponse> {
    const descriptions = {
      create: `Created workstation ${workstationId}`,
      update: `Updated workstation ${workstationId}`,
      delete: `Deleted workstation ${workstationId}`
    };

    return this.notifyConfigurationChange({
      changeType: 'workstation',
      workstationId,
      userId,
      description: descriptions[operation]
    });
  }

  /**
   * 启用/禁用自动同步
   */
  setAutoSyncEnabled(enabled: boolean): void {
    this.config.enableAutoSync = enabled;
    console.log(`🔧 Auto-sync ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * 获取当前配置
   */
  getConfig(): DeviceSyncConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<DeviceSyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 DeviceConfigSyncManager configuration updated:', this.config);
  }
}

// 创建全局单例实例
const deviceSyncManager = new DeviceConfigSyncManager();

// 自动初始化
if (typeof window !== 'undefined') {
  // 延迟初始化，避免阻塞页面加载
  setTimeout(() => {
    deviceSyncManager.initialize().catch(console.error);
  }, 1000);
}

export { deviceSyncManager, DeviceConfigSyncManager };
export type { DeviceSyncConfig, SyncNotification, SyncResponse };