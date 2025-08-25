using System.Text.Json.Serialization;

namespace DeviceCommunicationService.Models
{
    /// <summary>
    /// Action执行状态枚举
    /// </summary>
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum ActionExecutionStatus
    {
        PENDING,        // 待执行
        RUNNING,        // 执行中
        COMPLETED,      // 已完成
        FAILED,         // 执行失败
        TIMEOUT,        // 超时
        CANCELLED,      // 已取消
        WAITING_INPUT,  // 等待输入
        RETRYING        // 重试中
    }

    /// <summary>
    /// Action类型枚举
    /// </summary>
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum ActionType
    {
        DEVICE_READ,     // 设备读取
        DEVICE_WRITE,    // 设备写入
        MANUAL_CONFIRM,  // 人工确认
        DATA_VALIDATION, // 数据校验
        DELAY_WAIT,      // 延时等待
        BARCODE_SCAN,    // 扫码操作
        CAMERA_CHECK,    // 相机检测
        CUSTOM_SCRIPT    // 自定义脚本
    }

    /// <summary>
    /// Action执行请求
    /// </summary>
    public class ActionExecutionRequest
    {
        public string ExecutionId { get; set; } = Guid.NewGuid().ToString();
        public string ActionId { get; set; } = string.Empty;
        public string ActionCode { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public ActionType Type { get; set; }
        public int Sequence { get; set; }
        public string? DeviceId { get; set; }
        public string? DeviceAddress { get; set; }
        public string? ExpectedValue { get; set; }
        public string? ValidationRule { get; set; }
        public Dictionary<string, object>? Parameters { get; set; }
        public string? Description { get; set; }
        public bool IsRequired { get; set; } = true;
        public int Timeout { get; set; } = 30000; // 30秒默认超时
        public int RetryCount { get; set; } = 0;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        // 工单和步骤信息
        public string? OrderId { get; set; }
        public string? StepId { get; set; }
        public string? WorkstationId { get; set; }
        public string? UserId { get; set; }
    }

    /// <summary>
    /// Action执行结果
    /// </summary>
    public class ActionExecutionResult
    {
        public string ExecutionId { get; set; } = string.Empty;
        public string ActionId { get; set; } = string.Empty;
        public ActionExecutionStatus Status { get; set; }
        public bool Success { get; set; }
        public object? Result { get; set; }
        public string? ResultValue { get; set; }
        public long Duration { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public string? ErrorMessage { get; set; }
        public int RetryAttempts { get; set; }
        public Dictionary<string, object>? Metadata { get; set; }
    }

    /// <summary>
    /// Action执行上下文
    /// </summary>
    public class ActionExecutionContext
    {
        public string SessionId { get; set; } = string.Empty;
        public string WorkstationId { get; set; } = string.Empty;
        public string? UserId { get; set; }
        public string? OrderId { get; set; }
        public string? StepId { get; set; }
        public Dictionary<string, object> SharedData { get; set; } = new();
        public CancellationToken CancellationToken { get; set; }
    }

    /// <summary>
    /// 人工确认请求
    /// </summary>
    public class ManualConfirmationRequest
    {
        public string ExecutionId { get; set; } = string.Empty;
        public string ActionCode { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? ImageUrl { get; set; }
        public List<string> Options { get; set; } = new() { "确认", "取消" };
        public int Timeout { get; set; } = 300000; // 5分钟默认超时
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// 人工确认响应
    /// </summary>
    public class ManualConfirmationResponse
    {
        public string ExecutionId { get; set; } = string.Empty;
        public bool Confirmed { get; set; }
        public string? SelectedOption { get; set; }
        public string? UserInput { get; set; }
        public string? UserId { get; set; }
        public DateTime ResponseTime { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// 数据校验请求
    /// </summary>
    public class DataValidationRequest
    {
        public string ExecutionId { get; set; } = string.Empty;
        public object Value { get; set; } = new();
        public string ValidationRule { get; set; } = string.Empty;
        public string? ExpectedValue { get; set; }
        public Dictionary<string, object>? Parameters { get; set; }
    }

    /// <summary>
    /// 数据校验结果
    /// </summary>
    public class DataValidationResult
    {
        public bool IsValid { get; set; }
        public object? ValidatedValue { get; set; }
        public string? ErrorMessage { get; set; }
        public List<string> ValidationErrors { get; set; } = new();
    }

    /// <summary>
    /// 扫码操作请求
    /// </summary>
    public class BarcodeScanRequest
    {
        public string ExecutionId { get; set; } = string.Empty;
        public string? DeviceId { get; set; }
        public string? ExpectedPattern { get; set; }
        public bool ContinuousMode { get; set; } = false;
        public int Timeout { get; set; } = 30000;
        public Dictionary<string, object>? Parameters { get; set; }
    }

    /// <summary>
    /// 扫码操作结果
    /// </summary>
    public class BarcodeScanResult
    {
        public bool Success { get; set; }
        public string? BarcodeData { get; set; }
        public string? BarcodeType { get; set; }
        public DateTime ScanTime { get; set; } = DateTime.UtcNow;
        public string? DeviceId { get; set; }
    }

    /// <summary>
    /// 相机检测请求
    /// </summary>
    public class CameraCheckRequest
    {
        public string ExecutionId { get; set; } = string.Empty;
        public string? DeviceId { get; set; }
        public string CheckType { get; set; } = string.Empty; // "presence", "quality", "measurement", etc.
        public Dictionary<string, object>? Parameters { get; set; }
        public int Timeout { get; set; } = 30000;
    }

    /// <summary>
    /// 相机检测结果
    /// </summary>
    public class CameraCheckResult
    {
        public bool Success { get; set; }
        public bool CheckPassed { get; set; }
        public string? ImagePath { get; set; }
        public Dictionary<string, object>? DetectionData { get; set; }
        public string? ErrorMessage { get; set; }
        public DateTime CheckTime { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// 自定义脚本请求
    /// </summary>
    public class CustomScriptRequest
    {
        public string ExecutionId { get; set; } = string.Empty;
        public string ScriptType { get; set; } = "javascript"; // "javascript", "python", "csharp"
        public string ScriptCode { get; set; } = string.Empty;
        public Dictionary<string, object>? InputParameters { get; set; }
        public int Timeout { get; set; } = 60000;
    }

    /// <summary>
    /// 自定义脚本结果
    /// </summary>
    public class CustomScriptResult
    {
        public bool Success { get; set; }
        public object? Result { get; set; }
        public string? Output { get; set; }
        public string? ErrorMessage { get; set; }
        public long ExecutionTime { get; set; }
    }

    /// <summary>
    /// Action执行进度
    /// </summary>
    public class ActionExecutionProgress
    {
        public string ExecutionId { get; set; } = string.Empty;
        public ActionExecutionStatus Status { get; set; }
        public int ProgressPercentage { get; set; }
        public string? CurrentStep { get; set; }
        public string? Message { get; set; }
        public DateTime UpdateTime { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// Action执行统计
    /// </summary>
    public class ActionExecutionStats
    {
        public string ActionId { get; set; } = string.Empty;
        public ActionType ActionType { get; set; }
        public long TotalExecutions { get; set; }
        public long SuccessfulExecutions { get; set; }
        public long FailedExecutions { get; set; }
        public double SuccessRate => TotalExecutions > 0 ? (double)SuccessfulExecutions / TotalExecutions * 100 : 0;
        public double AverageExecutionTime { get; set; }
        public long MinExecutionTime { get; set; }
        public long MaxExecutionTime { get; set; }
        public DateTime LastExecuted { get; set; }
    }

    /// <summary>
    /// 批量Action执行请求
    /// </summary>
    public class BatchActionExecutionRequest
    {
        public string BatchId { get; set; } = Guid.NewGuid().ToString();
        public List<ActionExecutionRequest> Actions { get; set; } = new();
        public bool SequentialExecution { get; set; } = true; // 顺序执行还是并行执行
        public bool StopOnFirstFailure { get; set; } = true;
        public ActionExecutionContext Context { get; set; } = new();
    }

    /// <summary>
    /// 批量Action执行结果
    /// </summary>
    public class BatchActionExecutionResult
    {
        public string BatchId { get; set; } = string.Empty;
        public bool Success { get; set; }
        public List<ActionExecutionResult> Results { get; set; } = new();
        public long TotalDuration { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public int CompletedCount { get; set; }
        public int FailedCount { get; set; }
        public string? ErrorMessage { get; set; }
    }
}