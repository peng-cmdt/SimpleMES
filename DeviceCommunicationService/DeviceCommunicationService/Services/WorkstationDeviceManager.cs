using DeviceCommunicationService.Interfaces;
using DeviceCommunicationService.Models;
using System.Collections.Concurrent;
using System.Text.Json;
using System.Text;

namespace DeviceCommunicationService.Services
{
    /// <summary>
    /// 工位设备管理器 - 负责管理工位设备连接和操作
    /// </summary>
    public class WorkstationDeviceManager : IWorkstationDeviceManager
    {
        private readonly ILogger<WorkstationDeviceManager> _logger;
        private readonly IDeviceManager _deviceManager;
        private readonly HttpClient _httpClient;
        private readonly ConcurrentDictionary<string, WorkstationSession> _sessions = new();
        private readonly ConcurrentDictionary<string, List<WorkstationDevice>> _workstationDevices = new();

        public WorkstationDeviceManager(
            ILogger<WorkstationDeviceManager> logger, 
            IDeviceManager deviceManager,
            HttpClient httpClient)
        {
            _logger = logger;
            _deviceManager = deviceManager;
            _httpClient = httpClient;
        }

        /// <summary>
        /// 初始化工位设备配置
        /// </summary>
        public async Task<bool> InitializeWorkstationDevicesAsync(string workstationId, List<WorkstationDevice> devices)
        {
            try
            {
                _workstationDevices.AddOrUpdate(workstationId, devices, (key, oldDevices) => devices);
                
                _logger.LogInformation("Initialized {Count} devices for workstation {WorkstationId}", 
                    devices.Count, workstationId);
                
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to initialize devices for workstation {WorkstationId}", workstationId);
                return false;
            }
        }

        /// <summary>
        /// 工位登录并连接设备
        /// </summary>
        public async Task<WorkstationLoginResult> LoginWorkstationAsync(WorkstationLoginRequest request)
        {
            try
            {
                var sessionId = Guid.NewGuid().ToString();
                var session = new WorkstationSession
                {
                    SessionId = sessionId,
                    WorkstationId = request.WorkstationId,
                    UserId = request.UserId,
                    StartTime = DateTime.UtcNow,
                    IsActive = true
                };

                // 获取工位配置的设备
                if (!_workstationDevices.TryGetValue(request.WorkstationId, out var devices))
                {
                    return new WorkstationLoginResult
                    {
                        Success = false,
                        ErrorMessage = $"No devices configured for workstation {request.WorkstationId}"
                    };
                }

                var connectionResults = new List<DeviceConnectionResult>();

                // 连接所有启用的设备
                foreach (var device in devices.Where(d => d.IsEnabled))
                {
                    try
                    {
                        // 检查设备是否已存在于设备管理器中
                        var existingDevice = await _deviceManager.GetDeviceAsync(device.Id);
                        if (existingDevice == null)
                        {
                            // 如果设备不存在，创建设备配置并添加
                            var deviceConfig = CreateDeviceConfig(device);
                            await _deviceManager.AddDeviceAsync(deviceConfig);
                            _logger.LogInformation("Added new device {DeviceId} to DeviceManager", device.Id);
                        }
                        else
                        {
                            // 如果设备已存在，更新设备配置以使用初始化的配置
                            var deviceConfig = CreateDeviceConfig(device);
                            await _deviceManager.UpdateDeviceAsync(device.Id, deviceConfig);
                            _logger.LogInformation("Updated existing device {DeviceId} configuration in DeviceManager", device.Id);
                        }
                        
                        // 连接设备
                        var connectResult = await _deviceManager.ConnectDeviceAsync(device.Id);
                        
                        var connectionResult = new DeviceConnectionResult
                        {
                            DeviceId = device.Id,
                            DeviceName = device.Name,
                            DeviceType = device.DeviceType.ToString(),
                            Success = connectResult.Success,
                            ErrorMessage = connectResult.Error?.Message
                        };
                        
                        connectionResults.Add(connectionResult);
                        
                        if (connectResult.Success)
                        {
                            session.ConnectedDevices.Add(device.Id);
                            device.Status = DeviceConnectionStatus.Connected;
                            device.LastConnected = DateTime.UtcNow;
                            
                            // 调用前端API更新数据库中的设备状态
                            _ = Task.Run(async () => await UpdateDeviceStatusInFrontend(device.Id, "ONLINE"));
                        }
                        else
                        {
                            device.Status = DeviceConnectionStatus.Error;
                            device.LastError = connectResult.Error?.Message;
                            
                            // 调用前端API更新数据库中的设备状态
                            _ = Task.Run(async () => await UpdateDeviceStatusInFrontend(device.Id, "OFFLINE"));
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to connect device {DeviceId} for workstation {WorkstationId}", 
                            device.Id, request.WorkstationId);
                        
                        connectionResults.Add(new DeviceConnectionResult
                        {
                            DeviceId = device.Id,
                            DeviceName = device.Name,
                            DeviceType = device.DeviceType.ToString(),
                            Success = false,
                            ErrorMessage = ex.Message
                        });
                        
                        device.Status = DeviceConnectionStatus.Error;
                        device.LastError = ex.Message;
                    }
                }

                // 保存会话
                _sessions.TryAdd(sessionId, session);

                var result = new WorkstationLoginResult
                {
                    Success = true,
                    SessionId = sessionId,
                    WorkstationId = request.WorkstationId,
                    ConnectedDevices = connectionResults,
                    LoginTime = session.StartTime
                };

                _logger.LogInformation("Workstation {WorkstationId} login successful. Session: {SessionId}, Connected devices: {Count}", 
                    request.WorkstationId, sessionId, session.ConnectedDevices.Count);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to login workstation {WorkstationId}", request.WorkstationId);
                return new WorkstationLoginResult
                {
                    Success = false,
                    ErrorMessage = ex.Message
                };
            }
        }

        /// <summary>
        /// 工位登出并断开设备
        /// </summary>
        public async Task<bool> LogoutWorkstationAsync(string sessionId)
        {
            try
            {
                if (!_sessions.TryRemove(sessionId, out var session))
                {
                    _logger.LogWarning("Session {SessionId} not found for logout", sessionId);
                    return false;
                }

                session.EndTime = DateTime.UtcNow;
                session.IsActive = false;

                // 断开所有连接的设备
                foreach (var deviceId in session.ConnectedDevices)
                {
                    try
                    {
                        await _deviceManager.DisconnectDeviceAsync(deviceId);
                        await _deviceManager.RemoveDeviceAsync(deviceId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to disconnect device {DeviceId} during logout", deviceId);
                    }
                }

                _logger.LogInformation("Workstation session {SessionId} logout successful", sessionId);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to logout session {SessionId}", sessionId);
                return false;
            }
        }

        /// <summary>
        /// 执行设备操作
        /// </summary>
        public async Task<DeviceOperationResponse> ExecuteDeviceOperationAsync(DeviceOperationRequest request)
        {
            try
            {
                // 验证会话是否存在（可选，根据需求）
                
                // 创建设备请求
                var deviceRequest = new DeviceRequest
                {
                    Id = request.RequestId,
                    DeviceId = request.DeviceId,
                    Command = new DeviceCommand
                    {
                        Operation = Enum.Parse<OperationType>(request.Operation, true),
                        Target = request.Address,
                        Data = request.Value,
                        DataType = Enum.TryParse<DataType>(request.DataType, true, out var dataType) ? dataType : null
                    },
                    Timeout = 5000
                };

                var startTime = DateTime.UtcNow;
                var response = await _deviceManager.SendCommandAsync(deviceRequest);
                var duration = (long)(DateTime.UtcNow - startTime).TotalMilliseconds;

                return new DeviceOperationResponse
                {
                    RequestId = request.RequestId,
                    Success = response.Success,
                    Data = response.Data,
                    ErrorMessage = response.Error?.Message,
                    Duration = duration,
                    Timestamp = DateTime.UtcNow
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to execute device operation {RequestId}", request.RequestId);
                return new DeviceOperationResponse
                {
                    RequestId = request.RequestId,
                    Success = false,
                    ErrorMessage = ex.Message,
                    Timestamp = DateTime.UtcNow
                };
            }
        }

        /// <summary>
        /// 获取工位设备状态
        /// </summary>
        public async Task<List<DeviceStatusInfo>> GetWorkstationDeviceStatusAsync(string workstationId)
        {
            var statusList = new List<DeviceStatusInfo>();

            if (_workstationDevices.TryGetValue(workstationId, out var devices))
            {
                foreach (var device in devices)
                {
                    try
                    {
                        var status = await _deviceManager.GetDeviceStatusAsync(device.Id);
                        // 确保设备名称被设置
                        status.DeviceName = device.Name;
                        statusList.Add(status);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to get status for device {DeviceId}", device.Id);
                        statusList.Add(new DeviceStatusInfo
                        {
                            DeviceId = device.Id,
                            DeviceName = device.Name,
                            Status = DeviceStatus.ERROR,
                            Error = ex.Message
                        });
                    }
                }
            }

            return statusList;
        }

        /// <summary>
        /// 获取活跃会话
        /// </summary>
        public Task<List<WorkstationSession>> GetActiveSessionsAsync()
        {
            var activeSessions = _sessions.Values
                .Where(s => s.IsActive)
                .ToList();
            
            return Task.FromResult(activeSessions);
        }

        private DeviceConfig CreateDeviceConfig(WorkstationDevice device)
        {
            // 准备连接参数，包含PLC参数
            var connectionParams = device.Connection.ExtraParams ?? new Dictionary<string, object>();
            
            // 如果device.Parameters中包含PLC参数，将其添加到连接参数中
            if (device.Parameters != null)
            {
                foreach (var param in device.Parameters)
                {
                    connectionParams[param.Key] = param.Value;
                }
            }

            return new DeviceConfig
            {
                DeviceId = device.Id,
                WorkstationId = device.WorkstationId,
                Name = device.Name,
                DeviceType = device.DeviceType,
                ConnectionType = device.Connection.ConnectionType,
                Connection = new DeviceConnection
                {
                    Type = device.Connection.ConnectionType,
                    Address = device.Connection.IpAddress,
                    Port = device.Connection.Port,
                    Parameters = connectionParams
                },
                Enabled = device.IsEnabled,
                Settings = device.Parameters
            };
        }

        /// <summary>
        /// 调用前端API更新数据库中的设备状态
        /// </summary>
        private async Task UpdateDeviceStatusInFrontend(string deviceId, string status)
        {
            try
            {
                var heartbeatData = new
                {
                    deviceId = deviceId,
                    status = status
                };

                var json = JsonSerializer.Serialize(heartbeatData);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                // 调用前端heartbeat API
                var response = await _httpClient.PostAsync("http://localhost:3008/api/devices/heartbeat", content);
                
                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Successfully updated device {DeviceId} status to {Status} in frontend database", deviceId, status);
                }
                else
                {
                    _logger.LogWarning("Failed to update device {DeviceId} status in frontend database. HTTP {StatusCode}", deviceId, response.StatusCode);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating device {DeviceId} status in frontend database", deviceId);
            }
        }
    }
}