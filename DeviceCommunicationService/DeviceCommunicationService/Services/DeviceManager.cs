using DeviceCommunicationService.Interfaces;
using DeviceCommunicationService.Models;
using System.Collections.Concurrent;
using System.Text.Json;

namespace DeviceCommunicationService.Services
{
    public class DeviceManager : IDeviceManager
    {
        private readonly ILogger<DeviceManager> _logger;
        private readonly ConcurrentDictionary<string, DeviceConfig> _devices = new();
        private readonly ConcurrentDictionary<DeviceType, IDeviceDriver> _drivers = new();
        private readonly ConcurrentDictionary<string, DeviceStatusInfo> _deviceStatus = new();
        private readonly string _configFilePath;

        public DeviceManager(ILogger<DeviceManager> logger, IConfiguration configuration)
        {
            _logger = logger;
            _configFilePath = configuration.GetValue<string>("DeviceConfigPath") ?? "devices.json";
            
            // 在启动时加载设备配置
            _ = Task.Run(LoadDeviceConfigsAsync);
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
            _drivers.TryGetValue(deviceType, out var driver);
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
                if (File.Exists(_configFilePath))
                {
                    var json = await File.ReadAllTextAsync(_configFilePath);
                    var configs = JsonSerializer.Deserialize<List<DeviceConfig>>(json);
                    
                    if (configs != null)
                    {
                        foreach (var config in configs)
                        {
                            _devices.TryAdd(config.DeviceId, config);
                            _deviceStatus.TryAdd(config.DeviceId, new DeviceStatusInfo
                            {
                                DeviceId = config.DeviceId,
                                Status = DeviceStatus.DISCONNECTED
                            });
                        }
                        _logger.LogInformation("Loaded {Count} device configurations", configs.Count);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load device configurations from {FilePath}", _configFilePath);
            }
        }

        private async Task SaveDeviceConfigsAsync()
        {
            try
            {
                var configs = _devices.Values.ToList();
                var json = JsonSerializer.Serialize(configs, new JsonSerializerOptions { WriteIndented = true });
                await File.WriteAllTextAsync(_configFilePath, json);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save device configurations to {FilePath}", _configFilePath);
            }
        }
    }
}