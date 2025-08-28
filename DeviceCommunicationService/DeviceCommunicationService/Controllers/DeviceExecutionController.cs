using DeviceCommunicationService.Interfaces;
using DeviceCommunicationService.Models;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace DeviceCommunicationService.Controllers
{
    [ApiController]
    [Route("api/devices")]
    public class DeviceExecutionController : ControllerBase
    {
        private readonly IDeviceManager _deviceManager;
        private readonly ILogger<DeviceExecutionController> _logger;

        public DeviceExecutionController(IDeviceManager deviceManager, ILogger<DeviceExecutionController> logger)
        {
            _deviceManager = deviceManager;
            _logger = logger;
        }

        /// <summary>
        /// 执行设备操作（根据前端传入的设备配置信息）
        /// </summary>
        [HttpPost("execute")]
        public async Task<ActionResult> ExecuteDeviceOperation([FromBody] DeviceExecutionRequest request)
        {
            try
            {
                _logger.LogInformation("收到设备操作请求: DeviceId={DeviceId}, Type={OperationType}, Address={Address}",
                    request.DeviceId, request.Operation?.Type, request.Operation?.Address);

                // 验证请求
                if (string.IsNullOrEmpty(request.DeviceId))
                {
                    return BadRequest(new DeviceExecutionResponse
                    {
                        Success = false,
                        Error = "DeviceId is required",
                        Timestamp = DateTime.UtcNow
                    });
                }

                // 检查设备是否存在于配置中
                var existingDevice = await _deviceManager.GetDeviceAsync(request.DeviceId);
                
                if (existingDevice == null)
                {
                    // 设备不存在，使用前端传来的配置创建临时设备配置
                    _logger.LogInformation("设备 {DeviceId} 不存在于配置中，使用前端配置", request.DeviceId);
                    
                    existingDevice = new DeviceConfig
                    {
                        DeviceId = request.DeviceId,
                        Name = $"Device_{request.DeviceId}",
                        DeviceType = ParseDeviceType(request.DeviceType ?? "PLC"),
                        Connection = new DeviceConnection
                        {
                            Type = ConnectionType.TCP,
                            Address = request.DeviceInfo?.IpAddress ?? "127.0.0.1",
                            Port = request.DeviceInfo?.Port ?? 102
                        },
                        Configuration = new DeviceConfiguration
                        {
                            Plc = new PlcParameters
                            {
                                PlcType = ParsePlcType(request.DeviceInfo?.PlcType ?? "Siemens_S7"),
                                Rack = 0,
                                Slot = 1,
                                Station = 0,
                                Cpu = CpuType.S7_1200
                            }
                        },
                        Settings = new Dictionary<string, object>
                        {
                            ["Timeout"] = 5000,
                            ["RetryCount"] = 3
                        }
                    };

                    // 临时添加设备到管理器（不保存到配置文件）
                    await _deviceManager.AddDeviceAsync(existingDevice);
                }

                // 构建设备命令请求
                var deviceRequest = new DeviceRequest
                {
                    Id = Guid.NewGuid().ToString(),
                    DeviceId = request.DeviceId,
                    Timestamp = DateTime.UtcNow,
                    Command = new DeviceCommand
                    {
                        Operation = ParseOperationType(request.Operation?.Type ?? "READ"),
                        Address = request.Operation?.Address ?? "",
                        Value = request.Operation?.Value,
                        DataType = ParseDataType(request.Operation?.DataType ?? "BOOL"),
                        Parameters = request.Operation?.Parameters ?? new Dictionary<string, object>()
                    },
                    Timeout = 5000
                };

                _logger.LogInformation("发送命令到设备: {Command}", JsonSerializer.Serialize(deviceRequest));

                // 处理特殊操作类型
                if (deviceRequest.Command.Operation == OperationType.CONNECT)
                {
                    // 连接设备
                    var connectResponse = await _deviceManager.ConnectDeviceAsync(request.DeviceId);
                    
                    return Ok(new DeviceExecutionResponse
                    {
                        Success = connectResponse.Success,
                        Message = connectResponse.Success ? "Device connected successfully" : "Failed to connect device",
                        Timestamp = DateTime.UtcNow,
                        Error = connectResponse.Error?.Message
                    });
                }
                else if (deviceRequest.Command.Operation == OperationType.DISCONNECT)
                {
                    // 断开设备
                    var disconnectResponse = await _deviceManager.DisconnectDeviceAsync(request.DeviceId);
                    
                    return Ok(new DeviceExecutionResponse
                    {
                        Success = disconnectResponse.Success,
                        Message = disconnectResponse.Success ? "Device disconnected successfully" : "Failed to disconnect device",
                        Timestamp = DateTime.UtcNow,
                        Error = disconnectResponse.Error?.Message
                    });
                }

                // 执行设备命令（读写操作）
                var response = await _deviceManager.SendCommandAsync(deviceRequest);

                // 构建返回响应
                var executionResponse = new DeviceExecutionResponse
                {
                    Success = response.Success,
                    Message = response.Success ? "Operation completed successfully" : "Operation failed",
                    Timestamp = DateTime.UtcNow,
                    Data = response.Data != null ? new DeviceExecutionData
                    {
                        Value = ExtractValue(response.Data),
                        Status = ExtractStatus(response.Data)
                    } : null,
                    Error = response.Error?.Message
                };

                _logger.LogInformation("设备操作完成: Success={Success}, Value={Value}", 
                    executionResponse.Success, executionResponse.Data?.Value);

                return Ok(executionResponse);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "设备操作失败");
                return StatusCode(500, new DeviceExecutionResponse
                {
                    Success = false,
                    Error = ex.Message,
                    Timestamp = DateTime.UtcNow
                });
            }
        }

        private DeviceType ParseDeviceType(string deviceType)
        {
            return Enum.TryParse<DeviceType>(deviceType, true, out var result) ? result : DeviceType.PLC;
        }

        private PlcType ParsePlcType(string plcType)
        {
            if (plcType.Contains("Mitsubishi", StringComparison.OrdinalIgnoreCase))
                return PlcType.Mitsubishi_MC;
            if (plcType.Contains("Omron", StringComparison.OrdinalIgnoreCase))
                return PlcType.Omron_FINS;
            if (plcType.Contains("Modbus", StringComparison.OrdinalIgnoreCase))
                return PlcType.Modbus_TCP;
            return PlcType.Siemens_S7;
        }

        private OperationType ParseOperationType(string operation)
        {
            return Enum.TryParse<OperationType>(operation, true, out var result) ? result : OperationType.READ;
        }

        private DataType ParseDataType(string dataType)
        {
            return Enum.TryParse<DataType>(dataType, true, out var result) ? result : DataType.BOOL;
        }

        private object? ExtractValue(object data)
        {
            if (data is Dictionary<string, object> dict)
            {
                if (dict.TryGetValue("value", out var value))
                    return value;
                if (dict.TryGetValue("Value", out value))
                    return value;
            }
            return data;
        }

        private string ExtractStatus(object data)
        {
            if (data is Dictionary<string, object> dict)
            {
                if (dict.TryGetValue("status", out var status))
                    return status?.ToString() ?? "unknown";
                if (dict.TryGetValue("Status", out status))
                    return status?.ToString() ?? "unknown";
            }
            return "unknown";
        }
    }

    // 请求和响应模型
    public class DeviceExecutionRequest
    {
        public string DeviceId { get; set; } = string.Empty;
        public string? DeviceType { get; set; }
        public DeviceInfoDto? DeviceInfo { get; set; }
        public OperationDto? Operation { get; set; }
        public DateTime Timestamp { get; set; }
    }

    public class DeviceInfoDto
    {
        public string? IpAddress { get; set; }
        public int? Port { get; set; }
        public string? PlcType { get; set; }
        public string? Protocol { get; set; }
    }

    public class OperationDto
    {
        public string Type { get; set; } = "READ";
        public string Address { get; set; } = string.Empty;
        public object? Value { get; set; }
        public string DataType { get; set; } = "BOOL";
        public Dictionary<string, object> Parameters { get; set; } = new();
    }

    public class DeviceExecutionResponse
    {
        public bool Success { get; set; }
        public string? Message { get; set; }
        public DeviceExecutionData? Data { get; set; }
        public string? Error { get; set; }
        public DateTime Timestamp { get; set; }
    }

    public class DeviceExecutionData
    {
        public object? Value { get; set; }
        public string Status { get; set; } = "unknown";
    }
}