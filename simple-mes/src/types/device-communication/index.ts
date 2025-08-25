// 设备通讯相关类型定义 - v2.0
// 支持参数化操作和多设备类型

// 基础枚举定义
export enum DeviceType {
  PLC = 'PLC',
  SCANNER = 'SCANNER', 
  CAMERA = 'CAMERA',
  READER = 'READER',
  ROBOT = 'ROBOT',
  SENSOR = 'SENSOR',
  OTHER = 'OTHER'
}

export enum ConnectionType {
  TCP = 'TCP',
  UDP = 'UDP', 
  SERIAL = 'SERIAL',
  USB = 'USB',
  ETHERNET = 'ETHERNET'
}

export enum OperationType {
  READ = 'READ',
  WRITE = 'WRITE',
  SUBSCRIBE = 'SUBSCRIBE',
  UNSUBSCRIBE = 'UNSUBSCRIBE',
  EXECUTE = 'EXECUTE',
  CONNECT = 'CONNECT',
  DISCONNECT = 'DISCONNECT',
  STATUS = 'STATUS'
}

export enum DataType {
  BOOL = 'BOOL',
  BYTE = 'BYTE', 
  WORD = 'WORD',
  DWORD = 'DWORD',
  INT = 'INT',
  DINT = 'DINT',
  REAL = 'REAL',
  STRING = 'STRING',
  ARRAY = 'ARRAY',
  BYTES = 'BYTES',
  FLOAT = 'FLOAT'
}

export enum DeviceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  ERROR = 'ERROR',
  CONNECTING = 'CONNECTING',
  DISCONNECTED = 'DISCONNECTED',
  CONNECTED = 'CONNECTED',
  TIMEOUT = 'TIMEOUT',
  RECONNECTING = 'RECONNECTING'
}

export enum Priority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH', 
  URGENT = 'URGENT'
}

export enum DeviceErrorType {
  CONNECTION_TIMEOUT = 'connection_timeout',
  CONNECTION_REFUSED = 'connection_refused',
  COMMUNICATION_ERROR = 'communication_error', 
  INVALID_ADDRESS = 'invalid_address',
  DEVICE_NOT_RESPONDING = 'device_not_responding',
  PARAMETER_ERROR = 'parameter_error',
  PERMISSION_DENIED = 'permission_denied'
}

// PLC 相关类型
export enum PlcType {
  SIEMENS_S7 = 'Siemens_S7',
  MITSUBISHI_MC = 'Mitsubishi_MC',
  OMRON_FINS = 'Omron_FINS', 
  MODBUS_TCP = 'Modbus_TCP'
}

export enum CpuType {
  S7_200 = 'S7_200',
  S7_300 = 'S7_300',
  S7_400 = 'S7_400',
  S7_1200 = 'S7_1200', 
  S7_1500 = 'S7_1500'
}

// 扫码枪相关类型
export enum ScannerType {
  SERIAL = 'Serial',
  USB_HID = 'USB_HID',
  NETWORK = 'Network'
}

export enum Parity {
  NONE = 'None',
  ODD = 'Odd', 
  EVEN = 'Even'
}

export enum TriggerMode {
  AUTO = 'Auto',
  MANUAL = 'Manual',
  COMMAND = 'Command'
}

// 设备特定参数接口
export interface PlcParameters {
  plcType: PlcType;
  slot: number;
  rack: number;
  station: number; 
  cpu: CpuType;
  wordLength: number;
  isBit: boolean;
  dbNumber?: number;
}

export interface ScannerParameters {
  scannerType: ScannerType;
  baudRate?: number;
  dataBits?: number;
  stopBits?: number;
  parity?: Parity;
  encoding: 'UTF8' | 'ASCII' | 'GBK';
  endCharacter?: string;
  prefix?: string;
  suffix?: string;
  triggerMode: TriggerMode;
}

export interface CameraParameters {
  resolution: string;
  frameRate: number;
  compression: string;
  autoFocus: boolean;
  exposureTime?: number;
}

// 设备连接信息
export interface DeviceConnectionInfo {
  deviceId: string;
  connectionType: ConnectionType;
  endpoint: string;
  parameters: Record<string, any>;
  timeout: number;
  retryCount: number;
  keepAlive: boolean;
  heartbeatInterval: number;
}

// 参数化设备操作
export interface DeviceOperation {
  operationId: string;
  deviceId: string;
  operation: OperationType;
  address: string;
  dataType: DataType;
  value?: any;
  length?: number;
  parameters?: {
    plc?: PlcParameters;
    scanner?: ScannerParameters;
    camera?: CameraParameters;
  };
  priority: Priority;
  timeout: number;
}

// 设备操作结果
export interface DeviceOperationResult {
  operationId: string;
  deviceId: string;
  success: boolean;
  result?: any;
  duration: number;
  timestamp: string;
  error?: {
    type: DeviceErrorType;
    code: number;
    message: string;
    details?: any;
  };
}

// 详细设备状态
export interface DeviceStatusDetail {
  deviceId: string;
  status: DeviceStatus;
  isOnline: boolean;
  connectionTime?: string;
  lastCommunication?: string;
  errorCount: number;
  totalOperations: number;
  successRate: number;
  performance: {
    avgResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
  };
  diagnostics?: {
    cpuUsage?: number;
    memoryUsage?: number;
    temperature?: number;
    signalStrength?: number;
  };
}

// 设备连接配置（保持兼容）
export interface DeviceConnection {
  type: ConnectionType;
  address: string;
  port?: number;
  parameters?: Record<string, any>;
}

// 设备配置（扩展原有配置）
export interface DeviceConfig {
  deviceId: string;
  workstationId?: string;
  name: string;
  description?: string;
  deviceType: DeviceType;
  connection: DeviceConnection;
  enabled: boolean;
  settings?: Record<string, any>;
  // 新增字段
  connectionType: ConnectionType;
  connectionString: string;
  configuration: {
    plc?: PlcParameters;
    scanner?: ScannerParameters;
    camera?: CameraParameters;
    [key: string]: any;
  };
  connectionInfo?: DeviceConnectionInfo;
  createdAt?: string;
  updatedAt?: string;
}

// 设备订阅
export interface DeviceSubscription {
  subscriptionId: string;
  deviceId: string;
  address: string;
  dataType: DataType;
  interval: number;
  parameters?: Record<string, any>;
  isActive: boolean;
  createdAt: string;
}

// 重试策略
export interface RetryPolicy {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: DeviceErrorType[];
}

// 设备性能指标
export interface DeviceMetrics {
  deviceId: string;
  timeWindow: string;
  connectionMetrics: {
    uptime: number;
    reconnections: number;
    failedConnections: number;
  };
  operationMetrics: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  dataQuality: {
    goodReads: number;
    badReads: number;
    timeoutReads: number;
  };
}

// WebSocket 消息类型
export interface WebSocketMessage {
  type: string;
  timestamp: string;
  payload: any;
}

export interface DeviceStatusChangedMessage extends WebSocketMessage {
  type: 'device_status_changed';
  payload: {
    deviceId: string;
    oldStatus: DeviceStatus;
    newStatus: DeviceStatus;
    details: DeviceStatusDetail;
  };
}

export interface DeviceDataUpdateMessage extends WebSocketMessage {
  type: 'device_data_update';
  payload: {
    deviceId: string;
    address: string;
    value: any;
    dataType: DataType;
    quality: 'Good' | 'Bad' | 'Uncertain';
    subscriptionId: string;
  };
}

export interface OperationCompletedMessage extends WebSocketMessage {
  type: 'operation_completed';
  payload: DeviceOperationResult;
}

// 设备配置模板
export interface DeviceTemplate {
  templateId: string;
  deviceType: DeviceType;
  name: string;
  defaultParameters: Record<string, any>;
  requiredParameters: string[];
  validationRules: ValidationRule[];
  operationTemplates: OperationTemplate[];
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'range' | 'pattern' | 'custom';
  value?: any;
  message: string;
}

export interface OperationTemplate {
  name: string;
  operation: OperationType;
  addressPattern: string;
  dataType: DataType;
  description: string;
  parameters?: Record<string, any>;
}

// 原有类型保持兼容
export interface DeviceCommand {
  operation: OperationType;
  target: string;
  data?: any;
  dataType?: DataType;
  // 新增字段
  address?: string;
  value?: any;
  parameters?: Record<string, any>;
}

export interface DeviceRequest {
  id: string;
  timestamp: string;
  deviceId: string;
  command: DeviceCommand;
  timeout?: number;
}

export interface DeviceResponse {
  id: string;
  timestamp: string;
  success: boolean;
  data?: any;
  error?: {
    code: string | number;
    message: string;
  };
  duration?: number;
}

export interface DeviceStatusInfo {
  deviceId: string;
  status: DeviceStatus;
  lastHeartbeat?: string;
  lastConnected?: string;
  lastUpdated?: string;
  connectionTime?: string;
  error?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

// 服务配置
export interface DeviceCommunicationServiceConfig {
  baseUrl: string;
  websocketUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

// 错误码常量（保持向后兼容，同时添加数字版本）
export const ERROR_CODES = {
  // 1000-1999: 连接相关错误
  CONNECTION_FAILED: 1001,
  CONNECTION_TIMEOUT: 1002,
  CONNECTION_REFUSED: 1003,
  CONNECTION_LOST: 1004,
  
  // 2000-2999: 通信相关错误
  COMMUNICATION_ERROR: 2001,
  INVALID_RESPONSE: 2002,
  CHECKSUM_ERROR: 2003,
  PROTOCOL_ERROR: 2004,
  INVALID_COMMAND: 2005,
  UNSUPPORTED_OPERATION: 2006,
  
  // 3000-3999: 设备相关错误
  DEVICE_NOT_FOUND: 3001,
  DEVICE_BUSY: 3002,
  DEVICE_ERROR: 3003,
  INVALID_ADDRESS: 3004,
  PERMISSION_DENIED: 3005,
  
  // 4000-4999: 参数/数据相关错误
  INVALID_PARAMETER: 4001,
  MISSING_PARAMETER: 4002,
  PARAMETER_OUT_OF_RANGE: 4003,
  INVALID_DATA: 4004,
  DATA_TYPE_MISMATCH: 4005,
  DATA_OUT_OF_RANGE: 4006,
  
  // 5000-5999: 系统相关错误
  SYSTEM_ERROR: 5001,
  SERVICE_UNAVAILABLE: 5002,
  OPERATION_TIMEOUT: 5003,
  RESOURCE_EXHAUSTED: 5004,
  INTERNAL_ERROR: 5005
} as const;

// 字符串版本的错误码（保持兼容）
export const ERROR_CODES_STR = {
  CONNECTION_FAILED: '1001',
  CONNECTION_TIMEOUT: '1002',
  CONNECTION_LOST: '1003',
  PROTOCOL_ERROR: '2001',
  INVALID_COMMAND: '2002',
  UNSUPPORTED_OPERATION: '2003',
  DEVICE_NOT_FOUND: '3001',
  DEVICE_BUSY: '3002',
  DEVICE_ERROR: '3003',
  INVALID_DATA: '4001',
  DATA_TYPE_MISMATCH: '4002',
  DATA_OUT_OF_RANGE: '4003',
  SYSTEM_ERROR: '5001',
  SERVICE_UNAVAILABLE: '5002',
  INTERNAL_ERROR: '5003'
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
export type ErrorCodeStr = typeof ERROR_CODES_STR[keyof typeof ERROR_CODES_STR];