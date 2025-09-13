import {
  DeviceRequest,
  DeviceResponse,
  DeviceConfig,
  DeviceStatusInfo,
  DeviceCommunicationServiceConfig,
  ERROR_CODES
} from '@/types/device-communication';

// 默认配置
const DEFAULT_CONFIG: DeviceCommunicationServiceConfig = {
  baseUrl: 'http://localhost:5000',
  websocketUrl: 'ws://localhost:5000',
  timeout: 800, // 减少到800ms总体超时，快速失败
  retryAttempts: 3,
  retryDelay: 100 // 减少重试延迟到100ms
};

export class DeviceCommunicationClient {
  private config: DeviceCommunicationServiceConfig;
  private websocket: WebSocket | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor(config: Partial<DeviceCommunicationServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
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

  // 获取设备状态
  async getDeviceStatus(deviceId: string): Promise<DeviceStatusInfo> {
    return this.makeRequest<DeviceStatusInfo>(`/api/devices/${deviceId}/status`);
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

  // PLC读取操作
  async readPLC(deviceId: string, params: {
    address: string;
    type: string;
    dbNumber: number;
    byte: number;
    bit: number;
  }): Promise<{ value: any }> {
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
      timeout: 600 // 减少到600ms PLC读取超时，快速响应
    };

    return this.makeRequest<{ value: any }>('/api/devices/command', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  // PLC写入操作
  async writePLC(deviceId: string, params: {
    address: string;
    type: string;
    dbNumber: number;
    byte: number;
    bit: number;
    value: any;
  }): Promise<{ success: boolean }> {
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
      timeout: 600 // 减少到600ms PLC写入超时，快速响应
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
}

// 创建全局实例
export const deviceCommunicationClient = new DeviceCommunicationClient();