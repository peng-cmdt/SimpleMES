import { ActionType } from '@prisma/client';

export interface DeviceOperationRequest {
  actionId?: string;
  actionType: ActionType;
  deviceId: string;
  actionData: {
    address?: string;
    deviceAddress?: string;
    value?: any;
    dataType?: string;
    parameters?: Record<string, any>;
    orderStepId?: string;
  };
}

export interface DeviceOperationResponse {
  success: boolean;
  data?: {
    value: any;
    status?: string;
    message?: string;
    timestamp: string;
  };
  error?: string;
}

class DeviceOperationService {
  /**
   * 执行设备操作（读取或写入）
   * 从数据库获取设备配置，发送到.NET后端执行
   */
  async executeOperation(request: DeviceOperationRequest): Promise<DeviceOperationResponse> {
    try {
      const response = await fetch('/api/device-operations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Device operation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Device operation failed',
      };
    }
  }

  /**
   * 读取设备数据
   */
  async readDevice(
    deviceId: string,
    address: string,
    actionId?: string,
    orderStepId?: string
  ): Promise<DeviceOperationResponse> {
    return this.executeOperation({
      actionId,
      actionType: 'DEVICE_READ',
      deviceId,
      actionData: {
        address,
        orderStepId,
      },
    });
  }

  /**
   * 写入设备数据
   */
  async writeDevice(
    deviceId: string,
    address: string,
    value: any,
    actionId?: string,
    orderStepId?: string
  ): Promise<DeviceOperationResponse> {
    return this.executeOperation({
      actionId,
      actionType: 'DEVICE_WRITE',
      deviceId,
      actionData: {
        address,
        value,
        orderStepId,
      },
    });
  }

  /**
   * 执行Action（根据Action类型自动判断操作）
   */
  async executeAction(action: {
    id: string;
    type: ActionType;
    deviceId?: string | null;
    deviceAddress?: string | null;
    expectedValue?: string | null;
    parameters?: any;
  }, orderStepId?: string): Promise<DeviceOperationResponse> {
    if (!action.deviceId || !action.deviceAddress) {
      return {
        success: false,
        error: 'Device ID or address not specified for action',
      };
    }

    switch (action.type) {
      case 'DEVICE_READ':
        return this.readDevice(
          action.deviceId,
          action.deviceAddress,
          action.id,
          orderStepId
        );

      case 'DEVICE_WRITE':
        const writeValue = action.parameters?.value || action.expectedValue || '1';
        return this.writeDevice(
          action.deviceId,
          action.deviceAddress,
          writeValue,
          action.id,
          orderStepId
        );

      default:
        return {
          success: false,
          error: `Unsupported action type: ${action.type}`,
        };
    }
  }
}

export const deviceOperationService = new DeviceOperationService();