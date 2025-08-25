using System.Text.Json.Serialization;

namespace DeviceCommunicationService.Models
{
    // 设备类型枚举 - 支持更多设备类型
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum DeviceType
    {
        PLC,
        SCANNER,
        CAMERA,
        READER,
        ROBOT,
        SENSOR,
        OTHER
    }

    // 连接类型枚举 - 支持更多连接方式
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum ConnectionType
    {
        TCP,
        UDP,
        SERIAL,
        USB,
        ETHERNET
    }

    // 操作类型枚举 - 支持订阅操作
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum OperationType
    {
        READ,
        WRITE,
        SUBSCRIBE,
        UNSUBSCRIBE,
        EXECUTE,
        CONNECT,
        DISCONNECT,
        STATUS
    }

    // 数据类型枚举 - 支持更多数据类型
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum DataType
    {
        BOOL,
        BYTE,
        WORD,
        DWORD,
        INT,
        DINT,
        REAL,
        STRING,
        ARRAY,
        BYTES,
        FLOAT
    }

    // 设备状态枚举 - 支持更多状态
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum DeviceStatus
    {
        ONLINE,
        OFFLINE,
        ERROR,
        CONNECTING,
        DISCONNECTED,
        CONNECTED,
        TIMEOUT,
        RECONNECTING
    }

    // 优先级枚举
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum Priority
    {
        LOW,
        NORMAL,
        HIGH,
        URGENT
    }

    // 设备错误类型枚举
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum DeviceErrorType
    {
        CONNECTION_TIMEOUT,
        CONNECTION_REFUSED,
        COMMUNICATION_ERROR,
        INVALID_ADDRESS,
        DEVICE_NOT_RESPONDING,
        PARAMETER_ERROR,
        PERMISSION_DENIED
    }

    // PLC 相关枚举
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum PlcType
    {
        Siemens_S7,
        Mitsubishi_MC,
        Omron_FINS,
        Modbus_TCP
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum CpuType
    {
        S7_200,
        S7_300,
        S7_400,
        S7_1200,
        S7_1500
    }

    // 扫码枪相关枚举
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum ScannerType
    {
        Serial,
        USB_HID,
        Network
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum Parity
    {
        None,
        Odd,
        Even
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum TriggerMode
    {
        Auto,
        Manual,
        Command
    }

    // PLC 参数
    public class PlcParameters
    {
        public PlcType PlcType { get; set; }
        public int Slot { get; set; }
        public int Rack { get; set; }
        public int Station { get; set; }
        public CpuType Cpu { get; set; }
        public int WordLength { get; set; }
        public bool IsBit { get; set; }
        public int? DbNumber { get; set; }
    }

    // 扫码枪参数
    public class ScannerParameters
    {
        public ScannerType ScannerType { get; set; }
        public int? BaudRate { get; set; }
        public int? DataBits { get; set; }
        public int? StopBits { get; set; }
        public Parity? Parity { get; set; }
        public string Encoding { get; set; } = "UTF8";
        public string? EndCharacter { get; set; }
        public string? Prefix { get; set; }
        public string? Suffix { get; set; }
        public TriggerMode TriggerMode { get; set; }
    }

    // 相机参数
    public class CameraParameters
    {
        public string Resolution { get; set; } = string.Empty;
        public int FrameRate { get; set; }
        public string Compression { get; set; } = string.Empty;
        public bool AutoFocus { get; set; }
        public int? ExposureTime { get; set; }
    }

    // 设备连接信息
    public class DeviceConnectionInfo
    {
        public string DeviceId { get; set; } = string.Empty;
        public ConnectionType ConnectionType { get; set; }
        public string Endpoint { get; set; } = string.Empty;
        public Dictionary<string, object> Parameters { get; set; } = new();
        public int Timeout { get; set; } = 5000;
        public int RetryCount { get; set; } = 3;
        public bool KeepAlive { get; set; } = true;
        public int HeartbeatInterval { get; set; } = 5000;
    }

    // 参数化设备操作
    public class DeviceOperation
    {
        public string OperationId { get; set; } = Guid.NewGuid().ToString();
        public string DeviceId { get; set; } = string.Empty;
        public OperationType Operation { get; set; }
        public string Address { get; set; } = string.Empty;
        public DataType DataType { get; set; }
        public object? Value { get; set; }
        public int? Length { get; set; }
        public OperationParameters? Parameters { get; set; }
        public Priority Priority { get; set; } = Priority.NORMAL;
        public int Timeout { get; set; } = 3000;
    }

    // 操作参数包装类
    public class OperationParameters
    {
        public PlcParameters? Plc { get; set; }
        public ScannerParameters? Scanner { get; set; }
        public CameraParameters? Camera { get; set; }
    }

    // 设备操作结果
    public class DeviceOperationResult
    {
        public string OperationId { get; set; } = string.Empty;
        public string DeviceId { get; set; } = string.Empty;
        public bool Success { get; set; }
        public object? Result { get; set; }
        public long Duration { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public DeviceOperationError? Error { get; set; }
    }

    // 设备操作错误
    public class DeviceOperationError
    {
        public DeviceErrorType Type { get; set; }
        public int Code { get; set; }
        public string Message { get; set; } = string.Empty;
        public object? Details { get; set; }
    }

    // 详细设备状态
    public class DeviceStatusDetail
    {
        public string DeviceId { get; set; } = string.Empty;
        public DeviceStatus Status { get; set; }
        public bool IsOnline { get; set; }
        public DateTime? ConnectionTime { get; set; }
        public DateTime? LastCommunication { get; set; }
        public int ErrorCount { get; set; }
        public long TotalOperations { get; set; }
        public double SuccessRate { get; set; }
        public DevicePerformance Performance { get; set; } = new();
        public DeviceDiagnostics? Diagnostics { get; set; }
    }

    // 设备性能指标
    public class DevicePerformance
    {
        public double AvgResponseTime { get; set; }
        public double MaxResponseTime { get; set; }
        public double MinResponseTime { get; set; }
    }

    // 设备诊断信息
    public class DeviceDiagnostics
    {
        public double? CpuUsage { get; set; }
        public double? MemoryUsage { get; set; }
        public double? Temperature { get; set; }
        public double? SignalStrength { get; set; }
    }

    // 设备订阅
    public class DeviceSubscription
    {
        public string SubscriptionId { get; set; } = Guid.NewGuid().ToString();
        public string DeviceId { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public DataType DataType { get; set; }
        public int Interval { get; set; } = 1000;
        public Dictionary<string, object>? Parameters { get; set; }
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    // 重试策略
    public class RetryPolicy
    {
        public int MaxRetries { get; set; } = 3;
        public int BaseDelay { get; set; } = 1000;
        public int MaxDelay { get; set; } = 30000;
        public double BackoffMultiplier { get; set; } = 2.0;
        public List<DeviceErrorType> RetryableErrors { get; set; } = new();
    }

    // 设备性能指标
    public class DeviceMetrics
    {
        public string DeviceId { get; set; } = string.Empty;
        public string TimeWindow { get; set; } = string.Empty;
        public ConnectionMetrics ConnectionMetrics { get; set; } = new();
        public OperationMetrics OperationMetrics { get; set; } = new();
        public DataQualityMetrics DataQuality { get; set; } = new();
    }

    public class ConnectionMetrics
    {
        public long Uptime { get; set; }
        public int Reconnections { get; set; }
        public int FailedConnections { get; set; }
    }

    public class OperationMetrics
    {
        public long TotalOperations { get; set; }
        public long SuccessfulOperations { get; set; }
        public long FailedOperations { get; set; }
        public double AvgResponseTime { get; set; }
        public double P95ResponseTime { get; set; }
        public double P99ResponseTime { get; set; }
    }

    public class DataQualityMetrics
    {
        public long GoodReads { get; set; }
        public long BadReads { get; set; }
        public long TimeoutReads { get; set; }
    }

    // 设备连接配置（保持兼容）
    public class DeviceConnection
    {
        public ConnectionType Type { get; set; }
        public string Address { get; set; } = string.Empty;
        public int? Port { get; set; }
        public Dictionary<string, object>? Parameters { get; set; }
    }

    // 设备配置（扩展支持）
    public class DeviceConfig
    {
        public string DeviceId { get; set; } = string.Empty;
        public string? WorkstationId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DeviceType DeviceType { get; set; }
        public DeviceConnection Connection { get; set; } = new();
        public bool Enabled { get; set; } = true;
        public Dictionary<string, object>? Settings { get; set; }
        
        // 新增字段
        public ConnectionType ConnectionType { get; set; }
        public string ConnectionString { get; set; } = string.Empty;
        public DeviceConfiguration Configuration { get; set; } = new();
        public DeviceConnectionInfo? ConnectionInfo { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    // 设备配置参数包装类
    public class DeviceConfiguration
    {
        public PlcParameters? Plc { get; set; }
        public ScannerParameters? Scanner { get; set; }
        public CameraParameters? Camera { get; set; }
        public Dictionary<string, object>? Additional { get; set; } = new();
    }

    // 设备命令（保持兼容，添加新字段）
    public class DeviceCommand
    {
        public OperationType Operation { get; set; }
        public string Target { get; set; } = string.Empty;
        public object? Data { get; set; }
        public DataType? DataType { get; set; }
        
        // 新增字段
        public string? Address { get; set; }
        public object? Value { get; set; }
        public Dictionary<string, object>? Parameters { get; set; }
    }

    // 设备请求（保持兼容）
    public class DeviceRequest
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string DeviceId { get; set; } = string.Empty;
        public DeviceCommand Command { get; set; } = new();
        public int Timeout { get; set; } = 5000;
    }

    // 设备响应（保持兼容）
    public class DeviceResponse
    {
        public string Id { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public bool Success { get; set; }
        public object? Data { get; set; }
        public DeviceError? Error { get; set; }
        public long? Duration { get; set; }
    }

    // 设备错误（保持兼容）
    public class DeviceError
    {
        public string Code { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }

    // 设备状态信息（保持兼容，添加新字段）
    public class DeviceStatusInfo
    {
        public string DeviceId { get; set; } = string.Empty;
        public string DeviceName { get; set; } = string.Empty;
        public DeviceStatus Status { get; set; }
        public bool IsOnline => Status == DeviceStatus.ONLINE || Status == DeviceStatus.CONNECTED;
        public DateTime? LastHeartbeat { get; set; }
        public DateTime? LastConnected { get; set; }
        public DateTime? LastUpdated { get; set; }
        public DateTime? ConnectionTime { get; set; }
        public string? Error { get; set; }
        public string? ErrorMessage { get; set; }
        public Dictionary<string, object>? Metadata { get; set; }
    }

    // WebSocket 消息类型
    public class WebSocketMessage
    {
        public string Type { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public object? Payload { get; set; }
    }

    public class DeviceStatusChangedMessage : WebSocketMessage
    {
        public DeviceStatusChangedMessage()
        {
            Type = "device_status_changed";
        }
    }

    public class DeviceDataUpdateMessage : WebSocketMessage
    {
        public DeviceDataUpdateMessage()
        {
            Type = "device_data_update";
        }
    }

    public class OperationCompletedMessage : WebSocketMessage
    {
        public OperationCompletedMessage()
        {
            Type = "operation_completed";
        }
    }

    // 错误码常量（保持兼容，添加数字版本）
    public static class ErrorCodes
    {
        // 连接错误 1000-1999
        public const int CONNECTION_FAILED = 1001;
        public const int CONNECTION_TIMEOUT = 1002;
        public const int CONNECTION_REFUSED = 1003;
        public const int CONNECTION_LOST = 1004;

        // 通信错误 2000-2999
        public const int COMMUNICATION_ERROR = 2001;
        public const int INVALID_RESPONSE = 2002;
        public const int CHECKSUM_ERROR = 2003;
        public const int PROTOCOL_ERROR = 2004;
        public const int INVALID_COMMAND = 2005;
        public const int UNSUPPORTED_OPERATION = 2006;

        // 设备错误 3000-3999
        public const int DEVICE_NOT_FOUND = 3001;
        public const int DEVICE_BUSY = 3002;
        public const int DEVICE_ERROR = 3003;
        public const int INVALID_ADDRESS = 3004;
        public const int PERMISSION_DENIED = 3005;

        // 参数/数据错误 4000-4999
        public const int INVALID_PARAMETER = 4001;
        public const int MISSING_PARAMETER = 4002;
        public const int PARAMETER_OUT_OF_RANGE = 4003;
        public const int INVALID_DATA = 4004;
        public const int DATA_TYPE_MISMATCH = 4005;
        public const int DATA_OUT_OF_RANGE = 4006;

        // 系统错误 5000-5999
        public const int SYSTEM_ERROR = 5001;
        public const int SERVICE_UNAVAILABLE = 5002;
        public const int OPERATION_TIMEOUT = 5003;
        public const int RESOURCE_EXHAUSTED = 5004;
        public const int INTERNAL_ERROR = 5005;
    }

    // 字符串版本的错误码（保持兼容）
    public static class ErrorCodesStr
    {
        public const string CONNECTION_FAILED = "1001";
        public const string CONNECTION_TIMEOUT = "1002";
        public const string CONNECTION_LOST = "1003";
        public const string PROTOCOL_ERROR = "2001";
        public const string INVALID_COMMAND = "2002";
        public const string UNSUPPORTED_OPERATION = "2003";
        public const string DEVICE_NOT_FOUND = "3001";
        public const string DEVICE_BUSY = "3002";
        public const string DEVICE_ERROR = "3003";
        public const string INVALID_DATA = "4001";
        public const string DATA_TYPE_MISMATCH = "4002";
        public const string DATA_OUT_OF_RANGE = "4003";
        public const string SYSTEM_ERROR = "5001";
        public const string SERVICE_UNAVAILABLE = "5002";
        public const string INTERNAL_ERROR = "5003";
    }

    // 新的协议消息格式
    public class ProtocolMessage
    {
        public string ProtocolVersion { get; set; } = "1.0";
        public string MessageId { get; set; } = Guid.NewGuid().ToString();
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string Source { get; set; } = string.Empty;
        public string Target { get; set; } = string.Empty;
        public DeviceInfo Device { get; set; } = new();
        public CommandInfo? Command { get; set; }
        public ResponseInfo? Response { get; set; }
    }

    public class DeviceInfo
    {
        public string Id { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Model { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
    }

    public class CommandInfo
    {
        public string Name { get; set; } = string.Empty;
        public Dictionary<string, object> Params { get; set; } = new();
    }

    public class ResponseInfo
    {
        public string Status { get; set; } = string.Empty; // "success" | "error"
        public string? ErrorCode { get; set; }
        public string? ErrorMessage { get; set; }
        public Dictionary<string, object>? Data { get; set; }
    }

    // 工位模型
    public class Workstation
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public string Line { get; set; } = string.Empty; // 产线
        public List<WorkstationDevice> Devices { get; set; } = new();
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    // 工位设备配置
    public class WorkstationDevice
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string WorkstationId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public DeviceType DeviceType { get; set; }
        public string Model { get; set; } = string.Empty;
        public DeviceConnectionConfig Connection { get; set; } = new();
        public Dictionary<string, object> Parameters { get; set; } = new();
        public bool IsEnabled { get; set; } = true;
        public DeviceConnectionStatus Status { get; set; } = DeviceConnectionStatus.Disconnected;
        public DateTime? LastConnected { get; set; }
        public string? LastError { get; set; }
    }

    // 设备连接配置
    public class DeviceConnectionConfig
    {
        public string IpAddress { get; set; } = string.Empty;
        public int Port { get; set; }
        public ConnectionType ConnectionType { get; set; } = ConnectionType.TCP;
        public int Timeout { get; set; } = 5000;
        public int RetryCount { get; set; } = 3;
        public Dictionary<string, object> ExtraParams { get; set; } = new();
    }

    // 设备连接状态
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum DeviceConnectionStatus
    {
        Disconnected,
        Connecting,
        Connected,
        Error,
        Timeout
    }

    // 工位会话
    public class WorkstationSession
    {
        public string SessionId { get; set; } = Guid.NewGuid().ToString();
        public string WorkstationId { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        public DateTime StartTime { get; set; } = DateTime.UtcNow;
        public DateTime? EndTime { get; set; }
        public bool IsActive { get; set; } = true;
        public List<string> ConnectedDevices { get; set; } = new();
    }

    // 设备操作请求
    public class DeviceOperationRequest
    {
        public string RequestId { get; set; } = Guid.NewGuid().ToString();
        public string WorkstationId { get; set; } = string.Empty;
        public string DeviceId { get; set; } = string.Empty;
        public string Operation { get; set; } = string.Empty; // "read" | "write"
        public string Address { get; set; } = string.Empty;
        public object? Value { get; set; }
        public string DataType { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

    // 设备操作响应
    public class DeviceOperationResponse
    {
        public string RequestId { get; set; } = string.Empty;
        public bool Success { get; set; }
        public object? Data { get; set; }
        public string? ErrorMessage { get; set; }
        public long Duration { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

    // 工位登录请求
    public class WorkstationLoginRequest
    {
        public string WorkstationId { get; set; } = string.Empty;
        public string? UserId { get; set; }
        public string? Username { get; set; }
    }

    // 工位登录结果
    public class WorkstationLoginResult
    {
        public bool Success { get; set; }
        public string? SessionId { get; set; }
        public string? WorkstationId { get; set; }
        public List<DeviceConnectionResult> ConnectedDevices { get; set; } = new();
        public DateTime? LoginTime { get; set; }
        public string? ErrorMessage { get; set; }
    }

    // 设备连接结果
    public class DeviceConnectionResult
    {
        public string DeviceId { get; set; } = string.Empty;
        public string DeviceName { get; set; } = string.Empty;
        public string DeviceType { get; set; } = string.Empty;
        public bool Success { get; set; }
        public string? ErrorMessage { get; set; }
    }
}