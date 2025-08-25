using DeviceCommunicationService.Models;

namespace DeviceCommunicationService.Interfaces
{
    /// <summary>
    /// 设备驱动接口
    /// </summary>
    public interface IDeviceDriver
    {
        /// <summary>
        /// 驱动名称
        /// </summary>
        string DriverName { get; }

        /// <summary>
        /// 支持的设备类型
        /// </summary>
        DeviceType[] SupportedDeviceTypes { get; }

        /// <summary>
        /// 连接设备
        /// </summary>
        Task<DeviceResponse> ConnectAsync(DeviceConfig config, CancellationToken cancellationToken = default);

        /// <summary>
        /// 断开设备连接
        /// </summary>
        Task<DeviceResponse> DisconnectAsync(string deviceId, CancellationToken cancellationToken = default);

        /// <summary>
        /// 执行设备命令
        /// </summary>
        Task<DeviceResponse> ExecuteCommandAsync(string deviceId, DeviceCommand command, CancellationToken cancellationToken = default);

        /// <summary>
        /// 获取设备状态
        /// </summary>
        Task<DeviceStatusInfo> GetStatusAsync(string deviceId, CancellationToken cancellationToken = default);

        /// <summary>
        /// 检查设备是否已连接
        /// </summary>
        bool IsConnected(string deviceId);

        /// <summary>
        /// 验证设备配置
        /// </summary>
        ValidationResult ValidateConfig(DeviceConfig config);

        /// <summary>
        /// 释放资源
        /// </summary>
        Task DisposeAsync();
    }

    /// <summary>
    /// 设备管理器接口
    /// </summary>
    public interface IDeviceManager
    {
        /// <summary>
        /// 注册设备驱动
        /// </summary>
        void RegisterDriver(IDeviceDriver driver);

        /// <summary>
        /// 添加设备配置
        /// </summary>
        Task<DeviceConfig> AddDeviceAsync(DeviceConfig config);

        /// <summary>
        /// 更新设备配置
        /// </summary>
        Task<DeviceConfig> UpdateDeviceAsync(string deviceId, DeviceConfig config);

        /// <summary>
        /// 删除设备配置
        /// </summary>
        Task<bool> RemoveDeviceAsync(string deviceId);

        /// <summary>
        /// 获取设备配置
        /// </summary>
        Task<DeviceConfig?> GetDeviceAsync(string deviceId);

        /// <summary>
        /// 获取所有设备配置
        /// </summary>
        Task<IEnumerable<DeviceConfig>> GetAllDevicesAsync();

        /// <summary>
        /// 连接设备
        /// </summary>
        Task<DeviceResponse> ConnectDeviceAsync(string deviceId);

        /// <summary>
        /// 断开设备连接
        /// </summary>
        Task<DeviceResponse> DisconnectDeviceAsync(string deviceId);

        /// <summary>
        /// 发送设备命令
        /// </summary>
        Task<DeviceResponse> SendCommandAsync(DeviceRequest request);

        /// <summary>
        /// 获取设备状态
        /// </summary>
        Task<DeviceStatusInfo> GetDeviceStatusAsync(string deviceId);

        /// <summary>
        /// 获取所有设备状态
        /// </summary>
        Task<IEnumerable<DeviceStatusInfo>> GetAllDeviceStatusAsync();
    }

    /// <summary>
    /// 配置验证结果
    /// </summary>
    public class ValidationResult
    {
        public bool IsValid { get; set; }
        public List<string> Errors { get; set; } = new();

        public static ValidationResult Success() => new() { IsValid = true };
        public static ValidationResult Failure(params string[] errors) => new() 
        { 
            IsValid = false, 
            Errors = errors.ToList() 
        };
    }

    /// <summary>
    /// WebSocket消息接口
    /// </summary>
    public interface IWebSocketManager
    {
        /// <summary>
        /// 广播消息到所有客户端
        /// </summary>
        Task BroadcastAsync(string message);

        /// <summary>
        /// 发送消息到指定客户端
        /// </summary>
        Task SendToClientAsync(string connectionId, string message);

        /// <summary>
        /// 获取在线客户端数量
        /// </summary>
        int GetConnectedClientsCount();
    }

    /// <summary>
    /// 工位设备管理接口
    /// </summary>
    public interface IWorkstationDeviceManager
    {
        /// <summary>
        /// 初始化工位设备配置
        /// </summary>
        Task<bool> InitializeWorkstationDevicesAsync(string workstationId, List<WorkstationDevice> devices);

        /// <summary>
        /// 工位登录并连接设备
        /// </summary>
        Task<WorkstationLoginResult> LoginWorkstationAsync(WorkstationLoginRequest request);

        /// <summary>
        /// 工位登出并断开设备
        /// </summary>
        Task<bool> LogoutWorkstationAsync(string sessionId);

        /// <summary>
        /// 执行设备操作
        /// </summary>
        Task<DeviceOperationResponse> ExecuteDeviceOperationAsync(DeviceOperationRequest request);

        /// <summary>
        /// 获取工位设备状态
        /// </summary>
        Task<List<DeviceStatusInfo>> GetWorkstationDeviceStatusAsync(string workstationId);

        /// <summary>
        /// 获取活跃会话
        /// </summary>
        Task<List<WorkstationSession>> GetActiveSessionsAsync();
    }
}