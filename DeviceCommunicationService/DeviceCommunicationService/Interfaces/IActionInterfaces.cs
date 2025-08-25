using DeviceCommunicationService.Models;

namespace DeviceCommunicationService.Interfaces
{
    /// <summary>
    /// Action执行器接口
    /// </summary>
    public interface IActionExecutor
    {
        /// <summary>
        /// 支持的Action类型
        /// </summary>
        ActionType[] SupportedActionTypes { get; }

        /// <summary>
        /// 执行Action
        /// </summary>
        Task<ActionExecutionResult> ExecuteAsync(ActionExecutionRequest request, ActionExecutionContext context);

        /// <summary>
        /// 取消Action执行
        /// </summary>
        Task<bool> CancelAsync(string executionId);

        /// <summary>
        /// 获取执行进度
        /// </summary>
        Task<ActionExecutionProgress?> GetProgressAsync(string executionId);

        /// <summary>
        /// 验证Action参数
        /// </summary>
        ValidationResult ValidateParameters(ActionExecutionRequest request);
    }

    /// <summary>
    /// Action执行引擎接口
    /// </summary>
    public interface IActionExecutionEngine
    {
        /// <summary>
        /// 注册Action执行器
        /// </summary>
        void RegisterExecutor(IActionExecutor executor);

        /// <summary>
        /// 执行单个Action
        /// </summary>
        Task<ActionExecutionResult> ExecuteActionAsync(ActionExecutionRequest request, ActionExecutionContext context);

        /// <summary>
        /// 批量执行Actions
        /// </summary>
        Task<BatchActionExecutionResult> ExecuteBatchActionsAsync(BatchActionExecutionRequest request);

        /// <summary>
        /// 取消Action执行
        /// </summary>
        Task<bool> CancelActionAsync(string executionId);

        /// <summary>
        /// 获取执行进度
        /// </summary>
        Task<ActionExecutionProgress?> GetExecutionProgressAsync(string executionId);

        /// <summary>
        /// 获取执行结果
        /// </summary>
        Task<ActionExecutionResult?> GetExecutionResultAsync(string executionId);

        /// <summary>
        /// 获取活跃的执行任务
        /// </summary>
        Task<List<ActionExecutionProgress>> GetActiveExecutionsAsync(string? workstationId = null);

        /// <summary>
        /// 获取Action执行统计
        /// </summary>
        Task<ActionExecutionStats?> GetActionStatsAsync(string actionId);

        /// <summary>
        /// 响应人工确认
        /// </summary>
        Task<bool> RespondToManualConfirmationAsync(ManualConfirmationResponse response);
    }

    /// <summary>
    /// 人工确认管理器接口
    /// </summary>
    public interface IManualConfirmationManager
    {
        /// <summary>
        /// 创建人工确认请求
        /// </summary>
        Task<string> CreateConfirmationRequestAsync(ManualConfirmationRequest request);

        /// <summary>
        /// 响应人工确认
        /// </summary>
        Task<bool> RespondToConfirmationAsync(ManualConfirmationResponse response);

        /// <summary>
        /// 获取待确认的请求
        /// </summary>
        Task<List<ManualConfirmationRequest>> GetPendingConfirmationsAsync(string? workstationId = null);

        /// <summary>
        /// 等待人工确认结果
        /// </summary>
        Task<ManualConfirmationResponse?> WaitForConfirmationAsync(string executionId, int timeoutMs = 300000);

        /// <summary>
        /// 取消人工确认请求
        /// </summary>
        Task<bool> CancelConfirmationAsync(string executionId);
    }

    /// <summary>
    /// 数据校验器接口
    /// </summary>
    public interface IDataValidator
    {
        /// <summary>
        /// 验证数据
        /// </summary>
        Task<DataValidationResult> ValidateAsync(DataValidationRequest request);

        /// <summary>
        /// 注册自定义校验规则
        /// </summary>
        void RegisterValidationRule(string ruleName, Func<object, string?, Dictionary<string, object>?, DataValidationResult> validator);

        /// <summary>
        /// 获取支持的校验规则
        /// </summary>
        List<string> GetSupportedRules();
    }

    /// <summary>
    /// 扫码服务接口
    /// </summary>
    public interface IBarcodeScanService
    {
        /// <summary>
        /// 执行扫码操作
        /// </summary>
        Task<BarcodeScanResult> ScanBarcodeAsync(BarcodeScanRequest request);

        /// <summary>
        /// 开始连续扫码模式
        /// </summary>
        Task<string> StartContinuousScanAsync(string deviceId, string sessionId);

        /// <summary>
        /// 停止连续扫码模式
        /// </summary>
        Task<bool> StopContinuousScanAsync(string sessionId);

        /// <summary>
        /// 获取扫码结果
        /// </summary>
        Task<List<BarcodeScanResult>> GetScanResultsAsync(string sessionId);
    }

    /// <summary>
    /// 相机检测服务接口
    /// </summary>
    public interface ICameraCheckService
    {
        /// <summary>
        /// 执行相机检测
        /// </summary>
        Task<CameraCheckResult> CheckAsync(CameraCheckRequest request);

        /// <summary>
        /// 注册检测算法
        /// </summary>
        void RegisterCheckAlgorithm(string checkType, Func<string, Dictionary<string, object>?, Task<CameraCheckResult>> algorithm);

        /// <summary>
        /// 获取支持的检测类型
        /// </summary>
        List<string> GetSupportedCheckTypes();
    }

    /// <summary>
    /// 自定义脚本执行器接口
    /// </summary>
    public interface ICustomScriptExecutor
    {
        /// <summary>
        /// 执行自定义脚本
        /// </summary>
        Task<CustomScriptResult> ExecuteScriptAsync(CustomScriptRequest request);

        /// <summary>
        /// 验证脚本语法
        /// </summary>
        Task<ValidationResult> ValidateScriptAsync(string scriptType, string scriptCode);

        /// <summary>
        /// 获取支持的脚本类型
        /// </summary>
        List<string> GetSupportedScriptTypes();
    }

    /// <summary>
    /// Action执行日志接口
    /// </summary>
    public interface IActionExecutionLogger
    {
        /// <summary>
        /// 记录Action执行开始
        /// </summary>
        Task LogExecutionStartAsync(ActionExecutionRequest request, ActionExecutionContext context);

        /// <summary>
        /// 记录Action执行结果
        /// </summary>
        Task LogExecutionResultAsync(ActionExecutionResult result);

        /// <summary>
        /// 记录执行进度
        /// </summary>
        Task LogExecutionProgressAsync(ActionExecutionProgress progress);

        /// <summary>
        /// 获取执行历史
        /// </summary>
        Task<List<ActionExecutionResult>> GetExecutionHistoryAsync(string? actionId = null, string? workstationId = null, DateTime? startTime = null, DateTime? endTime = null);

        /// <summary>
        /// 获取执行统计
        /// </summary>
        Task<Dictionary<ActionType, ActionExecutionStats>> GetExecutionStatsAsync(string? workstationId = null, DateTime? startTime = null, DateTime? endTime = null);
    }

    /// <summary>
    /// 设备Action执行器接口
    /// </summary>
    public interface IDeviceActionExecutor : IActionExecutor
    {
        /// <summary>
        /// 设置设备管理器
        /// </summary>
        void SetDeviceManager(IDeviceManager deviceManager);

        /// <summary>
        /// 执行设备读取操作
        /// </summary>
        Task<ActionExecutionResult> ExecuteDeviceReadAsync(ActionExecutionRequest request, ActionExecutionContext context);

        /// <summary>
        /// 执行设备写入操作
        /// </summary>
        Task<ActionExecutionResult> ExecuteDeviceWriteAsync(ActionExecutionRequest request, ActionExecutionContext context);
    }
}