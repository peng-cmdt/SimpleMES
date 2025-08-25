using DeviceCommunicationService.Interfaces;
using DeviceCommunicationService.Models;
using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;
using System.Collections.Concurrent;

namespace DeviceCommunicationService.Controllers
{
    // 全局消息记录器
    public static class MessageLogger
    {
        private static readonly ConcurrentQueue<MessageRecord> _receivedMessages = new();
        private static readonly ConcurrentQueue<MessageRecord> _sentMessages = new();
        
        public static void LogReceivedMessage(DeviceRequest request)
        {
            _receivedMessages.Enqueue(new MessageRecord
            {
                Timestamp = DateTime.UtcNow,
                Content = System.Text.Json.JsonSerializer.Serialize(request),
                IsSuccess = true
            });
            
            // 保持最多100条记录
            while (_receivedMessages.Count > 100)
            {
                _receivedMessages.TryDequeue(out _);
            }
        }
        
        public static void LogSentMessage(DeviceResponse response, bool isSuccess = true)
        {
            _sentMessages.Enqueue(new MessageRecord
            {
                Timestamp = DateTime.UtcNow,
                Content = System.Text.Json.JsonSerializer.Serialize(response),
                IsSuccess = isSuccess
            });
            
            // 保持最多100条记录
            while (_sentMessages.Count > 100)
            {
                _sentMessages.TryDequeue(out _);
            }
        }
        
        public static IEnumerable<MessageRecord> GetReceivedMessages() => _receivedMessages.Reverse().Take(50);
        public static IEnumerable<MessageRecord> GetSentMessages() => _sentMessages.Reverse().Take(50);
    }
    
    public class MessageRecord
    {
        public DateTime Timestamp { get; set; }
        public string Content { get; set; } = string.Empty;
        public bool IsSuccess { get; set; }
    }
    [ApiController]
    [Route("api/[controller]")]
    public class DevicesController : ControllerBase
    {
        private readonly IDeviceManager _deviceManager;
        private readonly ILogger<DevicesController> _logger;

        public DevicesController(IDeviceManager deviceManager, ILogger<DevicesController> logger)
        {
            _deviceManager = deviceManager;
            _logger = logger;
        }

        /// <summary>
        /// 获取所有设备配置
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<DeviceConfig>>> GetDevices()
        {
            try
            {
                var devices = await _deviceManager.GetAllDevicesAsync();
                return Ok(devices);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get devices");
                return StatusCode(500, new { error = "Failed to get devices", message = ex.Message });
            }
        }

        /// <summary>
        /// 获取指定设备配置
        /// </summary>
        [HttpGet("{deviceId}")]
        public async Task<ActionResult<DeviceConfig>> GetDevice(string deviceId)
        {
            try
            {
                var device = await _deviceManager.GetDeviceAsync(deviceId);
                if (device == null)
                {
                    return NotFound(new { error = "Device not found", deviceId });
                }
                return Ok(device);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get device {DeviceId}", deviceId);
                return StatusCode(500, new { error = "Failed to get device", message = ex.Message });
            }
        }

        /// <summary>
        /// 创建新设备配置
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<DeviceConfig>> CreateDevice([FromBody] DeviceConfig config)
        {
            try
            {
                var device = await _deviceManager.AddDeviceAsync(config);
                return CreatedAtAction(nameof(GetDevice), new { deviceId = device.DeviceId }, device);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { error = "Invalid device configuration", message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create device");
                return StatusCode(500, new { error = "Failed to create device", message = ex.Message });
            }
        }

        /// <summary>
        /// 更新设备配置
        /// </summary>
        [HttpPut("{deviceId}")]
        public async Task<ActionResult<DeviceConfig>> UpdateDevice(string deviceId, [FromBody] DeviceConfig config)
        {
            try
            {
                var device = await _deviceManager.UpdateDeviceAsync(deviceId, config);
                return Ok(device);
            }
            catch (KeyNotFoundException)
            {
                return NotFound(new { error = "Device not found", deviceId });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { error = "Invalid device configuration", message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update device {DeviceId}", deviceId);
                return StatusCode(500, new { error = "Failed to update device", message = ex.Message });
            }
        }

        /// <summary>
        /// 删除设备配置
        /// </summary>
        [HttpDelete("{deviceId}")]
        public async Task<ActionResult> DeleteDevice(string deviceId)
        {
            try
            {
                var result = await _deviceManager.RemoveDeviceAsync(deviceId);
                if (!result)
                {
                    return NotFound(new { error = "Device not found", deviceId });
                }
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to delete device {DeviceId}", deviceId);
                return StatusCode(500, new { error = "Failed to delete device", message = ex.Message });
            }
        }

        /// <summary>
        /// 连接设备
        /// </summary>
        [HttpPost("{deviceId}/connect")]
        public async Task<ActionResult<DeviceResponse>> ConnectDevice(string deviceId)
        {
            try
            {
                var response = await _deviceManager.ConnectDeviceAsync(deviceId);
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to connect device {DeviceId}", deviceId);
                return StatusCode(500, new { error = "Failed to connect device", message = ex.Message });
            }
        }

        /// <summary>
        /// 断开设备连接
        /// </summary>
        [HttpPost("{deviceId}/disconnect")]
        public async Task<ActionResult<DeviceResponse>> DisconnectDevice(string deviceId)
        {
            try
            {
                var response = await _deviceManager.DisconnectDeviceAsync(deviceId);
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to disconnect device {DeviceId}", deviceId);
                return StatusCode(500, new { error = "Failed to disconnect device", message = ex.Message });
            }
        }

        /// <summary>
        /// 获取设备状态
        /// </summary>
        [HttpGet("{deviceId}/status")]
        public async Task<ActionResult<DeviceStatusInfo>> GetDeviceStatus(string deviceId)
        {
            try
            {
                var status = await _deviceManager.GetDeviceStatusAsync(deviceId);
                return Ok(status);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get device status {DeviceId}", deviceId);
                return StatusCode(500, new { error = "Failed to get device status", message = ex.Message });
            }
        }

        /// <summary>
        /// 发送设备命令
        /// </summary>
        [HttpPost("command")]
        public async Task<ActionResult<DeviceResponse>> SendCommand([FromBody] DeviceRequest request)
        {
            try
            {
                // 记录接收到的消息
                MessageLogger.LogReceivedMessage(request);
                _logger.LogInformation("📥 接收到设备命令: {RequestId} -> {DeviceId}", request.Id, request.DeviceId);
                
                
                var response = await _deviceManager.SendCommandAsync(request);
                
                // 记录发送的响应
                MessageLogger.LogSentMessage(response, response.Success);
                _logger.LogInformation("📤 发送响应: {RequestId} -> 成功: {Success}", request.Id, response.Success);
                
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send command to device {DeviceId}", request.DeviceId);
                
                // 创建错误响应并记录
                var errorResponse = new DeviceResponse
                {
                    Id = request.Id,
                    Timestamp = DateTime.UtcNow,
                    Success = false,
                    Error = new DeviceError
                    {
                        Code = "500",
                        Message = ex.Message
                    }
                };
                
                MessageLogger.LogSentMessage(errorResponse, false);
                
                return StatusCode(500, new { error = "Failed to send command", message = ex.Message });
            }
        }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class StatusController : ControllerBase
    {
        private readonly IDeviceManager _deviceManager;
        private readonly ILogger<StatusController> _logger;

        public StatusController(IDeviceManager deviceManager, ILogger<StatusController> logger)
        {
            _deviceManager = deviceManager;
            _logger = logger;
        }

        /// <summary>
        /// 获取所有设备状态
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<DeviceStatusInfo>>> GetAllDeviceStatus()
        {
            try
            {
                var statuses = await _deviceManager.GetAllDeviceStatusAsync();
                return Ok(statuses);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get all device status");
                return StatusCode(500, new { error = "Failed to get device statuses", message = ex.Message });
            }
        }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class HealthController : ControllerBase
    {
        private readonly ILogger<HealthController> _logger;

        public HealthController(ILogger<HealthController> logger)
        {
            _logger = logger;
        }

        /// <summary>
        /// 健康检查
        /// </summary>
        [HttpGet]
        public ActionResult GetHealth()
        {
            return Ok(new 
            { 
                status = "healthy", 
                timestamp = DateTime.UtcNow,
                version = "1.0.0"
            });
        }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class InfoController : ControllerBase
    {
        private readonly ILogger<InfoController> _logger;

        public InfoController(ILogger<InfoController> logger)
        {
            _logger = logger;
        }

        /// <summary>
        /// 获取服务信息
        /// </summary>
        [HttpGet]
        public ActionResult GetInfo()
        {
            return Ok(new 
            { 
                serviceName = "Device Communication Service",
                version = "1.0.0",
                timestamp = DateTime.UtcNow,
                uptime = DateTime.UtcNow - Process.GetCurrentProcess().StartTime
            });
        }
    }
    
    [ApiController]
    [Route("api/[controller]")]
    public class MessagesController : ControllerBase
    {
        private readonly ILogger<MessagesController> _logger;

        public MessagesController(ILogger<MessagesController> logger)
        {
            _logger = logger;
        }

        /// <summary>
        /// 获取接收的消息
        /// </summary>
        [HttpGet("received")]
        public ActionResult<IEnumerable<MessageRecord>> GetReceivedMessages()
        {
            return Ok(MessageLogger.GetReceivedMessages());
        }

        /// <summary>
        /// 获取发送的消息
        /// </summary>
        [HttpGet("sent")]
        public ActionResult<IEnumerable<MessageRecord>> GetSentMessages()
        {
            return Ok(MessageLogger.GetSentMessages());
        }

        /// <summary>
        /// 获取消息统计
        /// </summary>
        [HttpGet("stats")]
        public ActionResult GetMessageStats()
        {
            var received = MessageLogger.GetReceivedMessages().ToList();
            var sent = MessageLogger.GetSentMessages().ToList();
            
            return Ok(new
            {
                totalMessages = received.Count + sent.Count,
                receivedCount = received.Count,
                sentCount = sent.Count,
                successCount = sent.Count(m => m.IsSuccess),
                errorCount = sent.Count(m => !m.IsSuccess)
            });
        }
    }
    
    [ApiController]
    [Route("api/[controller]")]
    public class ProtocolController : ControllerBase
    {
        private readonly ILogger<ProtocolController> _logger;

        public ProtocolController(ILogger<ProtocolController> logger)
        {
            _logger = logger;
        }

        /// <summary>
        /// 处理新协议格式的消息
        /// </summary>
        [HttpPost("message")]
        public async Task<ActionResult<ProtocolMessage>> ProcessProtocolMessage([FromBody] ProtocolMessage message)
        {
            try
            {
                // 记录接收到的消息
                MessageLogger.LogReceivedMessage(new DeviceRequest 
                { 
                    Id = message.MessageId,
                    DeviceId = message.Device.Id,
                    Timestamp = message.Timestamp
                });
                
                _logger.LogInformation("📥 接收到协议消息: {MessageId} -> {DeviceId} | 命令: {CommandName}", 
                    message.MessageId, message.Device.Id, message.Command?.Name);
                
                
                // 创建响应消息
                var response = new ProtocolMessage
                {
                    ProtocolVersion = message.ProtocolVersion,
                    MessageId = Guid.NewGuid().ToString(),
                    Timestamp = DateTime.UtcNow,
                    Source = "DeviceService",
                    Target = message.Source,
                    Device = message.Device,
                    Response = new ResponseInfo()
                };

                // 模拟处理不同的命令
                if (message.Command?.Name == "readStatus")
                {
                    response.Response.Status = "success";
                    response.Response.Data = new Dictionary<string, object>
                    {
                        { "status", "RUNNING" },
                        { "temperature", 45.2 },
                        { "pressure", 2.5 },
                        { "speed", 1200 }
                    };
                    
                    _logger.LogInformation("✅ 成功处理readStatus命令");
                }
                else if (message.Command?.Name == "writeValue")
                {
                    response.Response.Status = "success";
                    response.Response.Data = new Dictionary<string, object>
                    {
                        { "result", "写入成功" },
                        { "address", message.Command.Params.GetValueOrDefault("address", "") },
                        { "value", message.Command.Params.GetValueOrDefault("value", "") }
                    };
                    
                    _logger.LogInformation("✅ 成功处理writeValue命令");
                }
                else
                {
                    response.Response.Status = "error";
                    response.Response.ErrorCode = "2002";
                    response.Response.ErrorMessage = $"不支持的命令: {message.Command?.Name}";
                    
                    _logger.LogWarning("❌ 不支持的命令: {CommandName}", message.Command?.Name);
                }
                
                // 记录发送的响应
                MessageLogger.LogSentMessage(new DeviceResponse
                {
                    Id = response.MessageId,
                    Success = response.Response.Status == "success",
                    Data = response.Response.Data,
                    Error = response.Response.Status == "error" ? new DeviceError 
                    { 
                        Code = response.Response.ErrorCode ?? "Unknown", 
                        Message = response.Response.ErrorMessage ?? "Unknown error" 
                    } : null
                });
                
                _logger.LogInformation("📤 发送协议响应: {MessageId} -> 状态: {Status}", 
                    response.MessageId, response.Response.Status);
                
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "处理协议消息失败: {MessageId}", message.MessageId);
                
                var errorResponse = new ProtocolMessage
                {
                    ProtocolVersion = message.ProtocolVersion,
                    MessageId = Guid.NewGuid().ToString(),
                    Timestamp = DateTime.UtcNow,
                    Source = "DeviceService",
                    Target = message.Source,
                    Device = message.Device,
                    Response = new ResponseInfo
                    {
                        Status = "error",
                        ErrorCode = "5001",
                        ErrorMessage = ex.Message
                    }
                };
                
                return StatusCode(500, errorResponse);
            }
        }
    }
}