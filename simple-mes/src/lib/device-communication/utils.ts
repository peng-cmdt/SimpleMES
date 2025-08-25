import { 
  DeviceRequest, 
  DeviceCommand, 
  OperationType, 
  DataType,
  DeviceType
} from '@/types/device-communication';
import { v4 as uuidv4 } from 'uuid';

// 生成唯一请求ID
export function generateRequestId(): string {
  return uuidv4();
}

// 创建设备请求
export function createDeviceRequest(
  deviceId: string,
  command: DeviceCommand,
  timeout?: number
): DeviceRequest {
  return {
    id: generateRequestId(),
    timestamp: new Date().toISOString(),
    deviceId,
    command,
    timeout
  };
}

// 创建读取命令
export function createReadCommand(
  target: string,
  dataType: DataType = DataType.STRING
): DeviceCommand {
  return {
    operation: OperationType.READ,
    target,
    dataType
  };
}

// 创建写入命令
export function createWriteCommand(
  target: string,
  data: any,
  dataType: DataType = DataType.STRING
): DeviceCommand {
  return {
    operation: OperationType.WRITE,
    target,
    data,
    dataType
  };
}

// 创建执行命令
export function createExecuteCommand(
  target: string,
  data?: any
): DeviceCommand {
  return {
    operation: OperationType.EXECUTE,
    target,
    data
  };
}

// 验证设备配置
export function validateDeviceConfig(config: any): string[] {
  const errors: string[] = [];

  if (!config.name?.trim()) {
    errors.push('设备名称不能为空');
  }

  if (!Object.values(DeviceType).includes(config.deviceType)) {
    errors.push('无效的设备类型');
  }

  if (!config.connection?.address?.trim()) {
    errors.push('连接地址不能为空');
  }

  if (config.connection?.port && (config.connection.port < 1 || config.connection.port > 65535)) {
    errors.push('端口号必须在1-65535之间');
  }

  return errors;
}

// 格式化设备状态显示文本
export function formatDeviceStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'ONLINE': '在线',
    'OFFLINE': '离线', 
    'ERROR': '错误',
    'CONNECTING': '连接中',
    'DISCONNECTED': '已断开'
  };
  
  return statusMap[status] || status;
}

// 格式化设备类型显示文本
export function formatDeviceType(type: string): string {
  const typeMap: Record<string, string> = {
    'PLC': 'PLC控制器',
    'SCANNER': '扫码枪',
    'CAMERA': '工业相机', 
    'READER': '读码器',
    'OTHER': '其他设备'
  };
  
  return typeMap[type] || type;
}

// 解析错误代码
export function parseErrorCode(code: string): string {
  const codeNum = parseInt(code);
  
  if (codeNum >= 1000 && codeNum < 2000) {
    return '连接错误';
  } else if (codeNum >= 2000 && codeNum < 3000) {
    return '协议错误';
  } else if (codeNum >= 3000 && codeNum < 4000) {
    return '设备错误';
  } else if (codeNum >= 4000 && codeNum < 5000) {
    return '数据错误';
  } else if (codeNum >= 5000 && codeNum < 6000) {
    return '系统错误';
  }
  
  return '未知错误';
}

// 检查响应是否成功
export function isResponseSuccess(response: any): boolean {
  return response && response.success === true;
}

// 获取响应错误信息
export function getResponseError(response: any): string {
  if (response?.error) {
    return response.error.message || response.error.code || '未知错误';
  }
  return '操作失败';
}

// 格式化持续时间
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

// 重试函数
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }
  
  throw lastError!;
}