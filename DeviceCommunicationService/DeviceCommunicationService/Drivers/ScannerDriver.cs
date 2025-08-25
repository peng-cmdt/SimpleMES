using DeviceCommunicationService.Interfaces;
using DeviceCommunicationService.Models;
using System.Collections.Concurrent;

namespace DeviceCommunicationService.Drivers
{
    // 扫码枪驱动实现（简化版本）
    public class ScannerDriver : IDeviceDriver
    {
        private readonly ILogger<ScannerDriver> _logger;
        private readonly ConcurrentDictionary<string, ScannerDriverContext> _contexts;
        private readonly Timer _heartbeatTimer;

        public string DriverName => "Scanner Driver";
        public DeviceType[] SupportedDeviceTypes => new[] { DeviceType.SCANNER };

        public ScannerDriver(ILogger<ScannerDriver> logger)
        {
            _logger = logger;
            _contexts = new ConcurrentDictionary<string, ScannerDriverContext>();
            
            // 每10秒检查一次心跳
            _heartbeatTimer = new Timer(CheckHeartbeat, null, TimeSpan.FromSeconds(10), TimeSpan.FromSeconds(10));
        }

        public ValidationResult ValidateConfig(DeviceConfig config)
        {
            var errors = new List<string>();

            if (config.DeviceType != DeviceType.SCANNER)
            {
                errors.Add("Device type must be SCANNER");
            }

            if (string.IsNullOrEmpty(config.ConnectionString))
            {
                errors.Add("Connection string is required");
            }

            if (config.Configuration?.Scanner == null)
            {
                errors.Add("Scanner parameters are required");
            }

            return errors.Any() ? ValidationResult.Failure(errors.ToArray()) : ValidationResult.Success();
        }

        public async Task<DeviceResponse> ConnectAsync(DeviceConfig config, CancellationToken cancellationToken = default)
        {
            try
            {
                _logger.LogInformation("Connecting to Scanner device {DeviceId} at {ConnectionString}", 
                    config.DeviceId, config.ConnectionString);

                var scannerParams = config.Configuration?.Scanner;
                if (scannerParams == null)
                {
                    return CreateErrorResponse(config.DeviceId, ErrorCodes.MISSING_PARAMETER.ToString(), "No Scanner parameters found");
                }

                // 模拟连接过程
                await Task.Delay(100, cancellationToken);

                // 存储连接上下文
                var connectionInfo = new DeviceConnectionInfo
                {
                    DeviceId = config.DeviceId,
                    ConnectionType = scannerParams.ScannerType == ScannerType.Serial ? ConnectionType.SERIAL : 
                                   scannerParams.ScannerType == ScannerType.USB_HID ? ConnectionType.USB : ConnectionType.TCP,
                    Endpoint = config.ConnectionString,
                    Parameters = new Dictionary<string, object> { { "scanner", scannerParams } },
                    KeepAlive = true,
                    HeartbeatInterval = 10000
                };

                _contexts[config.DeviceId] = new ScannerDriverContext
                {
                    DeviceId = config.DeviceId,
                    ConnectionInfo = connectionInfo,
                    ScannerParameters = scannerParams,
                    IsConnected = true,
                    ConnectedTime = DateTime.UtcNow,
                    LastHeartbeat = DateTime.UtcNow,
                    TotalOperations = 0,
                    SuccessfulOperations = 0,
                    ErrorCount = 0,
                    ScanCount = 0
                };

                _logger.LogInformation("Successfully connected to Scanner device {DeviceId}", config.DeviceId);
                
                return new DeviceResponse
                {
                    Id = Guid.NewGuid().ToString(),
                    Success = true,
                    Data = "Connected successfully",
                    Timestamp = DateTime.UtcNow
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error connecting to Scanner device {DeviceId}", config.DeviceId);
                return CreateErrorResponse(config.DeviceId, ErrorCodes.INTERNAL_ERROR.ToString(), ex.Message);
            }
        }

        public async Task<DeviceResponse> DisconnectAsync(string deviceId, CancellationToken cancellationToken = default)
        {
            try
            {
                if (_contexts.TryRemove(deviceId, out var context))
                {
                    context.IsConnected = false;
                    _logger.LogInformation("Disconnected from Scanner device {DeviceId}", deviceId);
                }

                return new DeviceResponse
                {
                    Id = Guid.NewGuid().ToString(),
                    Success = true,
                    Data = "Disconnected successfully",
                    Timestamp = DateTime.UtcNow
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error disconnecting from Scanner device {DeviceId}", deviceId);
                return CreateErrorResponse(deviceId, ErrorCodes.INTERNAL_ERROR.ToString(), ex.Message);
            }
        }

        public async Task<DeviceResponse> ExecuteCommandAsync(string deviceId, DeviceCommand command, CancellationToken cancellationToken = default)
        {
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            
            try
            {
                if (!_contexts.TryGetValue(deviceId, out var context))
                {
                    return CreateErrorResponse(deviceId, ErrorCodes.DEVICE_NOT_FOUND.ToString(), "Device not connected");
                }

                // 更新操作统计
                context.TotalOperations++;
                context.LastCommunication = DateTime.UtcNow;

                object? result = null;

                switch (command.Operation)
                {
                    case OperationType.READ:
                        result = await ExecuteReadCommand(command, context);
                        break;
                    case OperationType.EXECUTE:
                        result = await ExecuteCustomCommand(command, context);
                        break;
                    default:
                        return CreateErrorResponse(deviceId, ErrorCodes.UNSUPPORTED_OPERATION.ToString(), "Unsupported operation");
                }

                context.SuccessfulOperations++;
                stopwatch.Stop();

                return new DeviceResponse
                {
                    Id = Guid.NewGuid().ToString(),
                    Success = true,
                    Data = result,
                    Duration = stopwatch.ElapsedMilliseconds,
                    Timestamp = DateTime.UtcNow
                };
            }
            catch (Exception ex)
            {
                if (_contexts.TryGetValue(deviceId, out var context))
                {
                    context.ErrorCount++;
                }

                stopwatch.Stop();
                _logger.LogError(ex, "Error executing command on device {DeviceId}", deviceId);

                return CreateErrorResponse(deviceId, ErrorCodes.COMMUNICATION_ERROR.ToString(), ex.Message, stopwatch.ElapsedMilliseconds);
            }
        }

        public async Task<DeviceStatusInfo> GetStatusAsync(string deviceId, CancellationToken cancellationToken = default)
        {
            if (!_contexts.TryGetValue(deviceId, out var context))
            {
                return new DeviceStatusInfo
                {
                    DeviceId = deviceId,
                    Status = DeviceStatus.DISCONNECTED
                };
            }

            var successRate = context.TotalOperations > 0 
                ? (double)context.SuccessfulOperations / context.TotalOperations * 100 
                : 0;

            return await Task.FromResult(new DeviceStatusInfo
            {
                DeviceId = deviceId,
                Status = context.IsConnected ? DeviceStatus.ONLINE : DeviceStatus.DISCONNECTED,
                LastHeartbeat = context.LastHeartbeat,
                LastConnected = context.ConnectedTime,
                ConnectionTime = context.ConnectedTime,
                LastUpdated = context.LastCommunication,
                Metadata = new Dictionary<string, object>
                {
                    { "totalOperations", context.TotalOperations },
                    { "successfulOperations", context.SuccessfulOperations },
                    { "errorCount", context.ErrorCount },
                    { "successRate", successRate },
                    { "scanCount", context.ScanCount },
                    { "lastScanData", context.LastScanData ?? "" },
                    { "lastScanTime", context.LastScanTime?.ToString("yyyy-MM-ddTHH:mm:ssZ") ?? "" }
                }
            });
        }

        public bool IsConnected(string deviceId)
        {
            return _contexts.TryGetValue(deviceId, out var context) && context.IsConnected;
        }

        public async Task DisposeAsync()
        {
            _heartbeatTimer?.Dispose();
            _contexts.Clear();
            await Task.CompletedTask;
        }

        private async Task<object?> ExecuteReadCommand(DeviceCommand command, ScannerDriverContext context)
        {
            // 模拟扫码操作
            await Task.Delay(100);
            
            var scanData = $"SCAN_{DateTime.Now:HHmmss}_{Random.Shared.Next(1000, 9999)}";
            context.ScanCount++;
            context.LastScanData = scanData;
            context.LastScanTime = DateTime.UtcNow;
            
            _logger.LogInformation("Scanner {DeviceId} scanned: {ScanData}", context.DeviceId, scanData);
            
            return scanData;
        }

        private async Task<object?> ExecuteCustomCommand(DeviceCommand command, ScannerDriverContext context)
        {
            var cmdValue = command.Value?.ToString() ?? command.Data?.ToString() ?? "";
            
            // 模拟命令执行
            await Task.Delay(50);
            
            _logger.LogInformation("Scanner {DeviceId} executed command: {Command}", context.DeviceId, cmdValue);
            
            return $"Command '{cmdValue}' executed successfully";
        }

        private DeviceResponse CreateErrorResponse(string deviceId, string errorCode, string errorMessage, long? duration = null)
        {
            return new DeviceResponse
            {
                Id = Guid.NewGuid().ToString(),
                Success = false,
                Duration = duration ?? 0,
                Timestamp = DateTime.UtcNow,
                Error = new DeviceError
                {
                    Code = errorCode,
                    Message = errorMessage
                }
            };
        }

        private void CheckHeartbeat(object? state)
        {
            var now = DateTime.UtcNow;
            var contexts = _contexts.Values.ToList();

            foreach (var context in contexts)
            {
                if (!context.IsConnected) continue;

                var timeSinceLastHeartbeat = now - context.LastHeartbeat;
                if (timeSinceLastHeartbeat.TotalMilliseconds > context.ConnectionInfo.HeartbeatInterval * 3)
                {
                    // 心跳超时，标记为离线
                    context.IsConnected = false;
                    _logger.LogWarning("Scanner {DeviceId} heartbeat timeout", context.DeviceId);
                }
                else
                {
                    // 更新心跳
                    context.LastHeartbeat = DateTime.UtcNow;
                }
            }
        }
    }

    // 扫码枪驱动上下文
    internal class ScannerDriverContext
    {
        public string DeviceId { get; set; } = string.Empty;
        public DeviceConnectionInfo ConnectionInfo { get; set; } = new();
        public ScannerParameters ScannerParameters { get; set; } = new();
        public bool IsConnected { get; set; }
        public DateTime ConnectedTime { get; set; }
        public DateTime LastHeartbeat { get; set; }
        public DateTime? LastCommunication { get; set; }
        public long TotalOperations { get; set; }
        public long SuccessfulOperations { get; set; }
        public int ErrorCount { get; set; }
        
        // 扫码枪特有属性
        public long ScanCount { get; set; }
        public string? LastScanData { get; set; }
        public DateTime? LastScanTime { get; set; }
    }
}