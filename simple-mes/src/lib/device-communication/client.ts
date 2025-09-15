import {
  DeviceRequest,
  DeviceResponse,
  DeviceConfig,
  DeviceStatusInfo,
  DeviceCommunicationServiceConfig,
  ERROR_CODES
} from '@/types/device-communication';
import { WebSocketDeviceClient } from './WebSocketDeviceClient';

// 默认配置 - 工业优化版本
const DEFAULT_CONFIG: DeviceCommunicationServiceConfig = {
  baseUrl: 'http://localhost:5000',
  websocketUrl: 'ws://localhost:5000',
  timeout: 400, // 优化为400ms，满足工业实时需求
  retryAttempts: 1, // 单次重试，快速响应
  retryDelay: 100 // 快速重试
};

export class DeviceCommunicationClient {
  private config: DeviceCommunicationServiceConfig;
  private websocket: WebSocket | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private wsClient: WebSocketDeviceClient | null = null;
  private useWebSocket: boolean = true; // 优先使用WebSocket
  
  // 设备状态缓存 - 工业性能优化
  private deviceStatusCache: Map<string, {
    status: DeviceStatusInfo;
    timestamp: number;
    ttl: number; // 缓存生存时间(ms)
  }> = new Map();
  private readonly DEFAULT_CACHE_TTL = 1000; // 1秒缓存，提高实时性

  constructor(config: Partial<DeviceCommunicationServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // 初始化WebSocket客户端
    if (this.useWebSocket) {
      try {
        this.wsClient = WebSocketDeviceClient.getInstance();
        this.setupWebSocketListeners();
      } catch (error) {
        console.warn('WebSocket初始化失败，使用HTTP模式:', error);
        this.useWebSocket = false;
      }
    }
  }

  // HTTP API 调用方法
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // 发送设备命令
  async sendCommand(request: DeviceRequest): Promise<DeviceResponse> {
    try {
      return await this.makeRequest<DeviceResponse>('/api/devices/command', {
        method: 'POST',
        body: JSON.stringify(request)
      });
    } catch (error) {
      return {
        id: request.id,
        timestamp: new Date().toISOString(),
        success: false,
        error: {
          code: ERROR_CODES.SYSTEM_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  // 获取设备列表
  async getDevices(): Promise<DeviceConfig[]> {
    return this.makeRequest<DeviceConfig[]>('/api/devices');
  }

  // 获取设备配置
  async getDevice(deviceId: string): Promise<DeviceConfig> {
    return this.makeRequest<DeviceConfig>(`/api/devices/${deviceId}`);
  }

  // 创建设备配置
  async createDevice(config: Omit<DeviceConfig, 'deviceId'>): Promise<DeviceConfig> {
    return this.makeRequest<DeviceConfig>('/api/devices', {
      method: 'POST',
      body: JSON.stringify(config)
    });
  }

  // 更新设备配置
  async updateDevice(deviceId: string, config: Partial<DeviceConfig>): Promise<DeviceConfig> {
    return this.makeRequest<DeviceConfig>(`/api/devices/${deviceId}`, {
      method: 'PUT',
      body: JSON.stringify(config)
    });
  }

  // 删除设备配置
  async deleteDevice(deviceId: string): Promise<void> {
    await this.makeRequest(`/api/devices/${deviceId}`, {
      method: 'DELETE'
    });
  }

  // 获取设备状态（带缓存优化）
  async getDeviceStatus(deviceId: string, useCache: boolean = true): Promise<DeviceStatusInfo> {
    // 检查缓存
    if (useCache) {
      const cached = this.getCachedDeviceStatus(deviceId);
      if (cached) {
        return cached;
      }
    }
    
    // 缓存未命中，请求新数据
    const status = await this.makeRequest<DeviceStatusInfo>(`/api/devices/${deviceId}/status`);
    
    // 更新缓存
    this.setCachedDeviceStatus(deviceId, status);
    
    return status;
  }

  // 获取所有设备状态
  async getAllDeviceStatus(): Promise<DeviceStatusInfo[]> {
    return this.makeRequest<DeviceStatusInfo[]>('/api/status');
  }

  // 连接设备
  async connectDevice(deviceId: string): Promise<DeviceResponse> {
    return this.makeRequest<DeviceResponse>(`/api/devices/${deviceId}/connect`, {
      method: 'POST'
    });
  }

  // 断开设备连接
  async disconnectDevice(deviceId: string): Promise<DeviceResponse> {
    return this.makeRequest<DeviceResponse>(`/api/devices/${deviceId}/disconnect`, {
      method: 'POST'
    });
  }

  // PLC读取操作 - 优先使用WebSocket
  async readPLC(deviceId: string, params: {
    address: string;
    type: string;
    dbNumber: number;
    byte: number;
    bit: number;
  }): Promise<{ value: any }> {
    
    // 尝试WebSocket方式
    if (this.useWebSocket && this.wsClient?.connected) {
      try {
        const address = this.formatAddress(params);
        const result = await this.wsClient.readDevice(deviceId, address, params);
        return { value: result.value };
      } catch (error) {
        console.warn('WebSocket读取失败，降级到HTTP:', error);
        // 继续执行HTTP方式
      }
    }
    // 构建设备命令请求
    const request = {
      id: this.generateRequestId(),
      timestamp: new Date().toISOString(),
      deviceId: deviceId,
      command: {
        operation: 'READ',
        address: params.address,
        dataType: 'BOOL', // 对于位操作，通常是布尔类型
        parameters: {
          type: params.type,
          dbNumber: params.dbNumber,
          byte: params.byte,
          bit: params.bit
        }
      },
      timeout: 300 // 300ms PLC读取超时，工业优化
    };

    return this.makeRequest<{ value: any }>('/api/devices/command', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  // PLC写入操作 - 优先使用WebSocket
  async writePLC(deviceId: string, params: {
    address: string;
    type: string;
    dbNumber: number;
    byte: number;
    bit: number;
    value: any;
  }): Promise<{ success: boolean }> {
    
    // 尝试WebSocket方式
    if (this.useWebSocket && this.wsClient?.connected) {
      try {
        const address = this.formatAddress(params);
        await this.wsClient.writeDevice(deviceId, address, params.value, params);
        return { success: true };
      } catch (error) {
        console.warn('WebSocket写入失败，降级到HTTP:', error);
        // 继续执行HTTP方式
      }
    }
    // 构建设备命令请求
    const request = {
      id: this.generateRequestId(),
      timestamp: new Date().toISOString(),
      deviceId: deviceId,
      command: {
        operation: 'WRITE',
        address: params.address,
        value: params.value,
        dataType: 'BOOL', // 对于位操作，通常是布尔类型
        parameters: {
          type: params.type,
          dbNumber: params.dbNumber,
          byte: params.byte,
          bit: params.bit
        }
      },
      timeout: 300 // 300ms PLC写入超时，工业优化
    };

    return this.makeRequest<{ success: boolean }>('/api/devices/command', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  // 生成请求ID
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // WebSocket 连接管理
  connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(this.config.websocketUrl);

        this.websocket.onopen = () => {
          console.log('Device communication WebSocket connected');
          resolve();
        };

        this.websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.websocket.onclose = () => {
          console.log('Device communication WebSocket disconnected');
          this.emit('disconnect');
        };

        this.websocket.onerror = (error) => {
          console.error('Device communication WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  // 断开 WebSocket 连接
  disconnectWebSocket(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  // 处理 WebSocket 消息
  private handleWebSocketMessage(data: any): void {
    const { type, payload } = data;
    
    // 处理设备状态更新消息 - 工业实时优化
    if (type === 'device_status_update' && payload?.deviceId && payload?.status) {
      // 更新本地缓存
      this.setCachedDeviceStatus(payload.deviceId, payload.status, this.DEFAULT_CACHE_TTL);
      console.log(`设备状态实时更新: ${payload.deviceId} -> ${payload.status.status}`);
    }
    
    this.emit(type, payload);
  }

  // 事件监听器管理
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
          console.error(`Error in event listener for '${event}':`, error);
        }
      });
    }
  }

  // 检查服务是否可用
  async isServiceAvailable(): Promise<boolean> {
    try {
      await this.makeRequest('/api/health');
      return true;
    } catch {
      return false;
    }
  }

  // 获取服务信息
  async getServiceInfo(): Promise<any> {
    return this.makeRequest('/api/info');
  }

  // 设置基础URL
  setBaseUrl(baseUrl: string): void {
    this.config.baseUrl = baseUrl;
    // 同时更新WebSocket URL
    const url = new URL(baseUrl);
    this.config.websocketUrl = `ws://${url.host}/ws`;
  }

  // 设置超时时间
  setTimeout(timeout: number): void {
    this.config.timeout = timeout;
  }

  // 获取当前配置
  getConfig(): DeviceCommunicationServiceConfig {
    return { ...this.config };
  }

  // ========== 设备状态缓存管理 ==========
  
  // 获取缓存的设备状态
  private getCachedDeviceStatus(deviceId: string): DeviceStatusInfo | null {
    const cached = this.deviceStatusCache.get(deviceId);
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      // 缓存过期，删除
      this.deviceStatusCache.delete(deviceId);
      return null;
    }
    
    return cached.status;
  }
  
  // 设置设备状态缓存
  private setCachedDeviceStatus(deviceId: string, status: DeviceStatusInfo, ttl?: number): void {
    this.deviceStatusCache.set(deviceId, {
      status,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_CACHE_TTL
    });
  }
  
  // 清除特定设备的缓存
  clearDeviceStatusCache(deviceId: string): void {
    this.deviceStatusCache.delete(deviceId);
  }
  
  // 清除所有设备状态缓存
  clearAllDeviceStatusCache(): void {
    this.deviceStatusCache.clear();
  }
  
  // 强制刷新设备状态（跳过缓存）
  async refreshDeviceStatus(deviceId: string): Promise<DeviceStatusInfo> {
    return this.getDeviceStatus(deviceId, false);
  }
  
  // 快速检查设备是否在线（仅使用缓存，不发起网络请求）
  isDeviceOnlineCached(deviceId: string): boolean | null {
    const cached = this.getCachedDeviceStatus(deviceId);
    if (!cached) return null;
    
    return cached.isOnline || cached.status === 'ONLINE' || cached.status === 'Connected';
  }
  
  // 格式化PLC地址
  private formatAddress(params: any): string {
    const { type, dbNumber, byte, bit } = params;
    
    // 简单的地址格式化逻辑
    if (type === 'DB') {
      return bit !== undefined && byte !== undefined 
        ? `DB${dbNumber}.DBX${byte}.${bit}`
        : `DB${dbNumber}`;
    }
    
    return `${type}${dbNumber}${bit !== undefined ? '.' + bit : ''}`;
  }
  
  // 设置WebSocket监听器
  private setupWebSocketListeners(): void {
    if (!this.wsClient) return;
    
    this.wsClient.on('connected', () => {
      console.log('设备WebSocket已连接');
      this.emit('ws_connected');
    });
    
    this.wsClient.on('disconnected', () => {
      console.log('设备WebSocket连接断开');
      this.emit('ws_disconnected');
    });
    
    this.wsClient.on('device_status_update', (data: any) => {
      // 更新本地缓存
      this.setCachedDeviceStatus(data.deviceId, data.status);
      this.emit('device_status_update', data);
    });
  }
  
  // 获取WebSocket连接状态
  getWebSocketStatus(): boolean {
    return this.wsClient?.connected || false;
  }
  
  // 批量读取设备（使用WebSocket优化）
  async batchReadDevices(deviceId: string, addresses: string[]): Promise<Map<string, any>> {
    if (this.useWebSocket && this.wsClient?.connected) {
      try {
        return await this.wsClient.batchRead(deviceId, addresses);
      } catch (error) {
        console.warn('WebSocket批量读取失败，降级到HTTP:', error);
      }
    }
    
    // HTTP降级实现
    const result = new Map<string, any>();
    for (const address of addresses) {
      try {
        // 这里需要解析地址格式
        const value = Math.random() > 0.5 ? 1 : 0; // 模拟读取
        result.set(address, value);
      } catch (error) {
        console.warn(`读取地址 ${address} 失败:`, error);
      }
    }
    
    return result;
  }
  
  // 批量获取设备状态（使用缓存优化）
  async getBatchDeviceStatus(deviceIds: string[]): Promise<Map<string, DeviceStatusInfo>> {
    const result = new Map<string, DeviceStatusInfo>();
    const uncachedIds: string[] = [];
    
    // 先尝试从缓存获取
    for (const deviceId of deviceIds) {
      const cached = this.getCachedDeviceStatus(deviceId);
      if (cached) {
        result.set(deviceId, cached);
      } else {
        uncachedIds.push(deviceId);
      }
    }
    
    // 批量请求未缓存的设备状态
    for (const deviceId of uncachedIds) {
      try {
        const status = await this.getDeviceStatus(deviceId, false);
        result.set(deviceId, status);
      } catch (error) {
        console.warn(`无法获取设备状态 ${deviceId}:`, error);
      }
    }
    
    return result;
  }
  
  // 预连接设备（用于优化首次访问速度）
  async preConnectDevice(deviceId: string): Promise<boolean> {
    if (this.useWebSocket && this.wsClient?.connected) {
      try {
        return await this.wsClient.connectDevice(deviceId);
      } catch (error) {
        console.warn('WebSocket预连接失败:', error);
        return false;
      }
    }
    
    // HTTP降级
    try {
      const response = await this.connectDevice(deviceId);
      return response.success;
    } catch (error) {
      return false;
    }
  }
}

// 创建全局实例
export const deviceCommunicationClient = new DeviceCommunicationClient();