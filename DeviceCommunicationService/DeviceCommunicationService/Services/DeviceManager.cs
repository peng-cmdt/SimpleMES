using DeviceCommunicationService.Interfaces;
using DeviceCommunicationService.Models;
using System.Collections.Concurrent;
using System.Text.Json;

namespace DeviceCommunicationService.Services
{
    public class DeviceManager : IDeviceManager
    {
        private readonly ILogger<DeviceManager> _logger;
        private readonly IDeviceConfigSyncService _syncService;
        private readonly ConcurrentDictionary<string, DeviceConfig> _devices = new();
        private readonly ConcurrentDictionary<DeviceType, IDeviceDriver> _drivers = new();
        private readonly ConcurrentDictionary<string, DeviceStatusInfo> _deviceStatus = new();
        private readonly CancellationTokenSource _cancellationTokenSource = new();

        public DeviceManager(ILogger<DeviceManager> logger, IDeviceConfigSyncService syncService)
        {
            _logger = logger;
            _syncService = syncService;
            
            // 订阅配置更新事件
            _syncService.OnDeviceConfigsUpdated += OnDeviceConfigsUpdated;
            
            // 在启动时加载设备配置
            _ = Task.Run(LoadDeviceConfigsAsync);
            
            // 启动定期同步
            _ = Task.Run(() => _syncService.StartPeriodicSyncAsync(_cancellationTokenSource.Token));
        }

        public void RegisterDriver(IDeviceDriver driver)
        {
            foreach (var deviceType in driver.SupportedDeviceTypes)
            {
                _drivers.TryAdd(deviceType, driver);
                _logger.LogInformation("Registered driver {DriverName} for device type {DeviceType}", 
                    driver.DriverName, deviceType);
            }
        }

        public async Task<DeviceConfig> AddDeviceAsync(DeviceConfig config)
        {
            try
            {
                // 生成设备ID如果未提供
                if (string.IsNullOrEmpty(config.DeviceId))
                {
                    config.DeviceId = Guid.NewGuid().ToString();
                }

                // 验证设备配置
                var driver = GetDriverForDeviceType(config.DeviceType);
                if (driver != null)
                {
                    var validation = driver.ValidateConfig(config);
                    if (!validation.IsValid)
                    {
                        throw new ArgumentException($"Invalid device configuration: {string.Join(", ", validation.Errors)}");
                    }
                }

                config.CreatedAt = DateTime.UtcNow;
                config.UpdatedAt = DateTime.UtcNow;

                _devices.TryAdd(config.DeviceId, config);
                
                // 初始化设备状态
                _deviceStatus.TryAdd(config.DeviceId, new DeviceStatusInfo
                {
                    DeviceId = config.DeviceId,
                    Status = DeviceStatus.DISCONNECTED
                });

                await SaveDeviceConfigsAsync();
                
                _logger.LogInformation("Added device {DeviceId} ({DeviceName})", config.DeviceId, config.Name);
                return config;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to add device {DeviceId}", config.DeviceId);
                throw;
            }
        }

        public async Task<DeviceConfig> UpdateDeviceAsync(string deviceId, DeviceConfig config)
        {
            try
            {
                if (!_devices.ContainsKey(deviceId))
                {
                    throw new KeyNotFoundException($"Device {deviceId} not found");
                }

                config.DeviceId = deviceId;
                config.UpdatedAt = DateTime.UtcNow;

                // 验证配置
                var driver = GetDriverForDeviceType(config.DeviceType);
                if (driver != null)
                {
                    var validation = driver.ValidateConfig(config);
                    if (!validation.IsValid)
                    {
                        throw new ArgumentException($"Invalid device configuration: {string.Join(", ", validation.Errors)}");
                    }
                }

                _devices.TryUpdate(deviceId, config, _devices[deviceId]);
                await SaveDeviceConfigsAsync();
                
                _logger.LogInformation("Updated device {DeviceId} ({DeviceName})", deviceId, config.Name);
                return config;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update device {DeviceId}", deviceId);
                throw;
            }
        }

        public async Task<bool> RemoveDeviceAsync(string deviceId)
        {
            try
            {
                // 先断开设备连接
                await DisconnectDeviceAsync(deviceId);

                var removed = _devices.TryRemove(deviceId, out _);
                _deviceStatus.TryRemove(deviceId, out _);

                if (removed)
                {
                    await SaveDeviceConfigsAsync();
                    _logger.LogInformation("Removed device {DeviceId}", deviceId);
                }

                return removed;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to remove device {DeviceId}", deviceId);
                return false;
            }
        }

        public Task<DeviceConfig?> GetDeviceAsync(string deviceId)
        {
            _devices.TryGetValue(deviceId, out var device);
            return Task.FromResult(device);
        }

        public Task<IEnumerable<DeviceConfig>> GetAllDevicesAsync()
        {
            return Task.FromResult<IEnumerable<DeviceConfig>>(_devices.Values.ToList());
        }

        public async Task<DeviceResponse> ConnectDeviceAsync(string deviceId)
        {
            try
            {
                _logger.LogInformation("ConnectDeviceAsync - Starting connection for device: {DeviceId}", deviceId);
                
                if (!_devices.TryGetValue(deviceId, out var config))
                {
                    _logger.LogError("ConnectDeviceAsync - Device not found: {DeviceId}", deviceId);
                    return CreateErrorResponse(deviceId, ErrorCodes.DEVICE_NOT_FOUND.ToString(), $"Device {deviceId} not found");
                }

                _logger.LogInformation("ConnectDeviceAsync - Found device config: DeviceType={DeviceType}, Name={Name}", config.DeviceType, config.Name);
                
                var driver = GetDriverForDeviceType(config.DeviceType);
                if (driver == null)
                {
                    _logger.LogError("ConnectDeviceAsync - No driver found for device type: {DeviceType}. Available drivers: {Drivers}", 
                        config.DeviceType, string.Join(", ", _drivers.Keys));
                    return CreateErrorResponse(deviceId, ErrorCodes.SYSTEM_ERROR.ToString(), $"No driver found for device type {config.DeviceType}");
                }
                
                _logger.LogInformation("ConnectDeviceAsync - Found driver: {DriverName} for device type: {DeviceType}", driver.DriverName, config.DeviceType);

                var startTime = DateTime.UtcNow;
                var response = await driver.ConnectAsync(config);
                response.Duration = (long)(DateTime.UtcNow - startTime).TotalMilliseconds;

                // 更新设备状态
                UpdateDeviceStatus(deviceId, response.Success ? DeviceStatus.ONLINE : DeviceStatus.ERROR, response.Error?.Message);

                _logger.LogInformation("Connect device {DeviceId} result: {Success}", deviceId, response.Success);
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to connect device {DeviceId}", deviceId);
                UpdateDeviceStatus(deviceId, DeviceStatus.ERROR, ex.Message);
                return CreateErrorResponse(deviceId, ErrorCodes.INTERNAL_ERROR.ToString(), ex.Message);
            }
        }

        public async Task<DeviceResponse> DisconnectDeviceAsync(string deviceId)
        {
            try
            {
                if (!_devices.TryGetValue(deviceId, out var config))
                {
                    return CreateErrorResponse(deviceId, ErrorCodes.DEVICE_NOT_FOUND.ToString(), $"Device {deviceId} not found");
                }

                var driver = GetDriverForDeviceType(config.DeviceType);
                if (driver == null)
                {
                    return CreateErrorResponse(deviceId, ErrorCodes.SYSTEM_ERROR.ToString(), $"No driver found for device type {config.DeviceType}");
                }

                var startTime = DateTime.UtcNow;
                var response = await driver.DisconnectAsync(deviceId);
                response.Duration = (long)(DateTime.UtcNow - startTime).TotalMilliseconds;

                // 更新设备状态
                UpdateDeviceStatus(deviceId, DeviceStatus.DISCONNECTED);

                _logger.LogInformation("Disconnect device {DeviceId} result: {Success}", deviceId, response.Success);
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to disconnect device {DeviceId}", deviceId);
                return CreateErrorResponse(deviceId, ErrorCodes.INTERNAL_ERROR.ToString(), ex.Message);
            }
        }

        public async Task<DeviceResponse> SendCommandAsync(DeviceRequest request)
        {
            try
            {
                if (!_devices.TryGetValue(request.DeviceId, out var config))
                {
                    return CreateErrorResponse(request.Id, ErrorCodes.DEVICE_NOT_FOUND.ToString(), $"Device {request.DeviceId} not found");
                }

                var driver = GetDriverForDeviceType(config.DeviceType);
                if (driver == null)
                {
                    return CreateErrorResponse(request.Id, ErrorCodes.SYSTEM_ERROR.ToString(), $"No driver found for device type {config.DeviceType}");
                }

                var startTime = DateTime.UtcNow;
                var response = await driver.ExecuteCommandAsync(request.DeviceId, request.Command);
                response.Id = request.Id;
                response.Duration = (long)(DateTime.UtcNow - startTime).TotalMilliseconds;

                _logger.LogDebug("Command {Operation} on device {DeviceId} completed in {Duration}ms", 
                    request.Command.Operation, request.DeviceId, response.Duration);

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to execute command on device {DeviceId}", request.DeviceId);
                return CreateErrorResponse(request.Id, ErrorCodes.INTERNAL_ERROR.ToString(), ex.Message);
            }
        }

        public async Task<DeviceStatusInfo> GetDeviceStatusAsync(string deviceId)
        {
            if (_deviceStatus.TryGetValue(deviceId, out var status))
            {
                // 尝试从驱动获取实时状态
                if (_devices.TryGetValue(deviceId, out var config))
                {
                    var driver = GetDriverForDeviceType(config.DeviceType);
                    if (driver != null)
                    {
                        try
                        {
                            var liveStatus = await driver.GetStatusAsync(deviceId);
                            return liveStatus;
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to get live status for device {DeviceId}", deviceId);
                        }
                    }
                }
                return status;
            }

            return new DeviceStatusInfo 
            { 
                DeviceId = deviceId, 
                Status = DeviceStatus.DISCONNECTED 
            };
        }

        public async Task<IEnumerable<DeviceStatusInfo>> GetAllDeviceStatusAsync()
        {
            var statuses = new List<DeviceStatusInfo>();
            
            foreach (var deviceId in _devices.Keys)
            {
                var status = await GetDeviceStatusAsync(deviceId);
                statuses.Add(status);
            }

            return statuses;
        }

        private IDeviceDriver? GetDriverForDeviceType(DeviceType deviceType)
        {
            _logger.LogDebug("GetDriverForDeviceType - Looking for driver for device type: {DeviceType}. Available drivers count: {Count}", 
                deviceType, _drivers.Count);
            
            if (_drivers.Count == 0)
            {
                _logger.LogWarning("GetDriverForDeviceType - No drivers registered!");
                return null;
            }
            
            foreach (var kvp in _drivers)
            {
                _logger.LogDebug("GetDriverForDeviceType - Available driver: {DeviceType} => {DriverName}", 
                    kvp.Key, kvp.Value.DriverName);
            }
            
            _drivers.TryGetValue(deviceType, out var driver);
            
            if (driver != null)
            {
                _logger.LogDebug("GetDriverForDeviceType - Found driver: {DriverName} for device type: {DeviceType}", 
                    driver.DriverName, deviceType);
            }
            else
            {
                _logger.LogWarning("GetDriverForDeviceType - No driver found for device type: {DeviceType}", deviceType);
            }
            
            return driver;
        }

        private void UpdateDeviceStatus(string deviceId, DeviceStatus status, string? error = null)
        {
            _deviceStatus.AddOrUpdate(deviceId, 
                new DeviceStatusInfo 
                { 
                    DeviceId = deviceId, 
                    Status = status, 
                    LastHeartbeat = DateTime.UtcNow,
                    Error = error
                },
                (key, oldStatus) => 
                {
                    oldStatus.Status = status;
                    oldStatus.LastHeartbeat = DateTime.UtcNow;
                    oldStatus.Error = error;
                    if (status == DeviceStatus.ONLINE)
                    {
                        oldStatus.LastConnected = DateTime.UtcNow;
                    }
                    return oldStatus;
                });
        }

        private static DeviceResponse CreateErrorResponse(string id, string errorCode, string errorMessage)
        {
            return new DeviceResponse
            {
                Id = id,
                Success = false,
                Error = new DeviceError
                {
                    Code = errorCode,
                    Message = errorMessage
                }
            };
        }

        private async Task LoadDeviceConfigsAsync()
        {
            try
            {
                // 从前台API获取设备配置而不是读取静态文件
                var configs = await _syncService.FetchDeviceConfigsAsync();
                
                if (configs.Any())
                {
                    OnDeviceConfigsUpdated(configs);
                    _logger.LogInformation("Loaded {Count} device configurations from frontend API", configs.Count);
                }
                else
                {
                    _logger.LogWarning("No device configurations received from frontend API");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load device configurations from frontend API");
            }
        }

        private void OnDeviceConfigsUpdated(List<DeviceConfig> configs)
        {
            try
            {
                // 记录现有设备ID
                var oldDeviceIds = _devices.Keys.ToList();
                var newDeviceIds = configs.Select(c => c.DeviceId).ToHashSet();
                
                // 添加或更新设备（不清除整个列表）
                foreach (var config in configs)
                {
                    // 检查设备是否是最近添加的（10秒内）
                    if (_devices.TryGetValue(config.DeviceId, out var existingDevice))
                    {
                        // 如果是最近通过AddDeviceAsync添加的设备，保留原始信息
                        if (existingDevice.CreatedAt.AddSeconds(10) > DateTime.UtcNow)
                        {
                            _logger.LogDebug("Preserving recently added device: {DeviceId}", config.DeviceId);
                            continue;
                        }
                    }
                    
                    // 更新或添加设备
                    _devices.AddOrUpdate(config.DeviceId, config, (key, old) => {
                        // 保留创建时间
                        config.CreatedAt = old.CreatedAt;
                        config.UpdatedAt = DateTime.UtcNow;
                        return config;
                    });
                    
                    // 初始化或更新设备状态
                    if (!_deviceStatus.ContainsKey(config.DeviceId))
                    {
                        _deviceStatus.TryAdd(config.DeviceId, new DeviceStatusInfo
                        {
                            DeviceId = config.DeviceId,
                            Status = DeviceStatus.DISCONNECTED
                        });
                    }
                }
                
                // 只删除不在新列表中且不是最近添加的设备
                foreach (var oldDeviceId in oldDeviceIds)
                {
                    if (!newDeviceIds.Contains(oldDeviceId))
                    {
                        if (_devices.TryGetValue(oldDeviceId, out var device))
                        {
                            // 如果设备是最近添加的（10秒内），不要删除
                            if (device.CreatedAt.AddSeconds(10) > DateTime.UtcNow)
                            {
                                _logger.LogInformation("Keeping recently added device: {DeviceId} (added {Seconds}s ago)", 
                                    oldDeviceId, (DateTime.UtcNow - device.CreatedAt).TotalSeconds);
                                continue;
                            }
                        }
                        
                        _devices.TryRemove(oldDeviceId, out _);
                        _deviceStatus.TryRemove(oldDeviceId, out _);
                        _logger.LogInformation("Removed device status for deleted device: {DeviceId}", oldDeviceId);
                    }
                }
                
                _logger.LogInformation("Device configurations updated: {Count} devices active", _devices.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update device configurations");
            }
        }

        // 添加手动同步方法
        public async Task<bool> RefreshDeviceConfigurationsAsync(string? workstationId = null)
        {
            try
            {
                _logger.LogInformation("Manually refreshing device configurations for workstation: {WorkstationId}", workstationId ?? "all");
                return await _syncService.SyncDeviceConfigsAsync(workstationId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to refresh device configurations");
                return false;
            }
        }

        // 移除文件保存逻辑，改为更轻量级的实现
        private Task SaveDeviceConfigsAsync()
        {
            // 不再保存到文件，配置由前台管理
            // 如果需要持久化，可以选择性地同步回前台API
            _logger.LogDebug("Device configurations are managed by frontend API, no file save needed");
            return Task.CompletedTask;
        }
    }
}