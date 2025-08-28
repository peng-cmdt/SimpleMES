using Microsoft.AspNetCore.Mvc;
using DeviceCommunicationService.Services;
using DeviceCommunicationService.Models;
using DeviceCommunicationService.Interfaces;
using System.Text.Json;

namespace DeviceCommunicationService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ConfigSyncController : ControllerBase
    {
        private readonly ILogger<ConfigSyncController> _logger;
        private readonly IDeviceConfigSyncService _syncService;
        private readonly DeviceManager _deviceManager;

        public ConfigSyncController(
            ILogger<ConfigSyncController> logger,
            IDeviceConfigSyncService syncService,
            DeviceManager deviceManager)
        {
            _logger = logger;
            _syncService = syncService;
            _deviceManager = deviceManager;
        }

        /// <summary>
        /// 刷新所有设备配置
        /// </summary>
        [HttpPost("refresh")]
        public async Task<IActionResult> RefreshAllConfigurations()
        {
            try
            {
                _logger.LogInformation("Received request to refresh all device configurations");
                
                var result = await _deviceManager.RefreshDeviceConfigurationsAsync();
                
                if (result)
                {
                    return Ok(new
                    {
                        success = true,
                        message = "Device configurations refreshed successfully",
                        timestamp = DateTime.UtcNow
                    });
                }

                return BadRequest(new
                {
                    success = false,
                    message = "Failed to refresh device configurations",
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error refreshing device configurations");
                return StatusCode(500, new
                {
                    success = false,
                    message = "Internal server error while refreshing configurations",
                    error = ex.Message,
                    timestamp = DateTime.UtcNow
                });
            }
        }

        /// <summary>
        /// 刷新指定工位的设备配置
        /// </summary>
        [HttpPost("refresh/{workstationId}")]
        public async Task<IActionResult> RefreshWorkstationConfigurations(string workstationId)
        {
            try
            {
                _logger.LogInformation("Received request to refresh device configurations for workstation: {WorkstationId}", workstationId);
                
                var result = await _deviceManager.RefreshDeviceConfigurationsAsync(workstationId);
                
                if (result)
                {
                    return Ok(new
                    {
                        success = true,
                        message = $"Device configurations for workstation {workstationId} refreshed successfully",
                        workstationId = workstationId,
                        timestamp = DateTime.UtcNow
                    });
                }

                return BadRequest(new
                {
                    success = false,
                    message = $"Failed to refresh device configurations for workstation {workstationId}",
                    workstationId = workstationId,
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error refreshing device configurations for workstation {WorkstationId}", workstationId);
                return StatusCode(500, new
                {
                    success = false,
                    message = "Internal server error while refreshing configurations",
                    workstationId = workstationId,
                    error = ex.Message,
                    timestamp = DateTime.UtcNow
                });
            }
        }

        /// <summary>
        /// 获取当前配置同步状态
        /// </summary>
        [HttpGet("status")]
        public async Task<IActionResult> GetSyncStatus()
        {
            try
            {
                var devices = await _deviceManager.GetAllDevicesAsync();
                var deviceStatuses = await _deviceManager.GetAllDeviceStatusAsync();

                return Ok(new
                {
                    success = true,
                    configurationSource = "Frontend API",
                    totalDevices = devices.Count(),
                    connectedDevices = deviceStatuses.Count(d => d.Status == DeviceStatus.ONLINE),
                    lastSyncTime = DateTime.UtcNow, // 可以添加真实的同步时间跟踪
                    devices = devices.Select(d => new
                    {
                        deviceId = d.DeviceId,
                        name = d.Name,
                        type = d.DeviceType.ToString(),
                        enabled = d.Enabled,
                        workstationId = d.WorkstationId,
                        lastUpdated = d.UpdatedAt
                    })
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting sync status");
                return StatusCode(500, new
                {
                    success = false,
                    message = "Internal server error while getting sync status",
                    error = ex.Message,
                    timestamp = DateTime.UtcNow
                });
            }
        }

        /// <summary>
        /// 前台通知设备配置变更 - Webhook端点
        /// </summary>
        [HttpPost("notify-change")]
        public async Task<IActionResult> NotifyConfigurationChange([FromBody] ConfigChangeNotification notification)
        {
            try
            {
                _logger.LogInformation("Received device configuration change notification: {ChangeType} for workstation {WorkstationId}", 
                    notification.ChangeType, notification.WorkstationId);

                // 处理设备添加通知
                if (notification.ChangeType == "device_added" && notification.DeviceData != null)
                {
                    try
                    {
                        _logger.LogInformation("Processing device_added notification for device: {DeviceName}", notification.DeviceData.Name);

                        // 直接从通知数据创建设备配置
                        var deviceType = MapDeviceType(notification.DeviceData.Type);
                        var deviceConfig = new DeviceConfig
                        {
                            DeviceId = notification.DeviceData.DeviceId,
                            WorkstationId = notification.WorkstationId ?? "",
                            Name = notification.DeviceData.Name,
                            Description = $"前端添加的{notification.DeviceData.Type}设备 {notification.DeviceData.IpAddress}",
                            DeviceType = deviceType,
                            ConnectionType = ConnectionType.TCP,
                            ConnectionString = "",
                            Enabled = true,
                            Connection = new DeviceConnection
                            {
                                Type = ConnectionType.TCP,
                                Address = notification.DeviceData.IpAddress,
                                Port = notification.DeviceData.Port,
                                Parameters = new Dictionary<string, object>
                                {
                                    {"plcType", GetPlcTypeFromBrand(notification.DeviceData.Brand)},
                                    {"rack", 0},
                                    {"slot", 1}
                                }
                            },
                            Settings = new Dictionary<string, object>
                            {
                                {"plcType", GetPlcTypeFromBrand(notification.DeviceData.Brand)}
                            },
                            Configuration = new DeviceConfiguration
                            {
                                Plc = new PlcParameters
                                {
                                    PlcType = GetPlcTypeEnum(notification.DeviceData.Brand),
                                    Slot = 1,
                                    Rack = 0,
                                    Station = 0,
                                    Cpu = CpuType.S7_1200,
                                    WordLength = 2,
                                    IsBit = false
                                },
                                Additional = new Dictionary<string, object>
                                {
                                    {"brand", notification.DeviceData.Brand ?? ""},
                                    {"model", notification.DeviceData.Model ?? ""},
                                    {"source", "frontend_notification"}
                                }
                            },
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };

                        // 检查设备是否已存在
                        var existingDevice = await _deviceManager.GetDeviceAsync(deviceConfig.DeviceId);
                        
                        if (existingDevice == null)
                        {
                            // 添加新设备
                            await _deviceManager.AddDeviceAsync(deviceConfig);
                            _logger.LogInformation("Successfully added device {DeviceId} ({DeviceName}) from frontend notification", 
                                deviceConfig.DeviceId, deviceConfig.Name);
                        }
                        else
                        {
                            // 更新现有设备
                            await _deviceManager.UpdateDeviceAsync(deviceConfig.DeviceId, deviceConfig);
                            _logger.LogInformation("Successfully updated device {DeviceId} ({DeviceName}) from frontend notification", 
                                deviceConfig.DeviceId, deviceConfig.Name);
                        }

                        return Ok(new
                        {
                            success = true,
                            message = "Device synchronized successfully from notification",
                            deviceId = deviceConfig.DeviceId,
                            deviceName = deviceConfig.Name,
                            changeType = notification.ChangeType,
                            workstationId = notification.WorkstationId,
                            timestamp = DateTime.UtcNow
                        });
                    }
                    catch (Exception deviceEx)
                    {
                        _logger.LogError(deviceEx, "Failed to add device from notification: {DeviceName}", notification.DeviceData?.Name);
                        
                        return StatusCode(500, new
                        {
                            success = false,
                            message = "Failed to add device from notification",
                            error = deviceEx.Message,
                            timestamp = DateTime.UtcNow
                        });
                    }
                }
                // 对于device_removed类型，处理设备移除
                else if (notification.ChangeType == "device_removed" && notification.AffectedDevices?.Count > 0)
                {
                    foreach (var deviceId in notification.AffectedDevices)
                    {
                        await _deviceManager.RemoveDeviceAsync(deviceId);
                    }
                    
                    return Ok(new
                    {
                        success = true,
                        message = "Devices removed successfully",
                        changeType = notification.ChangeType,
                        workstationId = notification.WorkstationId,
                        affectedDevices = notification.AffectedDevices,
                        timestamp = DateTime.UtcNow
                    });
                }
                // 对于其他类型的通知，进行完整的同步
                else
                {
                    string? workstationId = notification.ChangeType == "workstation" ? notification.WorkstationId : null;
                    var result = await _deviceManager.RefreshDeviceConfigurationsAsync(workstationId);
                    
                    if (result)
                    {
                        return Ok(new
                        {
                            success = true,
                            message = "Configuration synchronized successfully",
                            changeType = notification.ChangeType,
                            workstationId = notification.WorkstationId,
                            affectedDevices = notification.AffectedDevices,
                            timestamp = DateTime.UtcNow
                        });
                    }

                    return BadRequest(new
                    {
                        success = false,
                        message = "Failed to synchronize configuration changes",
                        changeType = notification.ChangeType,
                        workstationId = notification.WorkstationId,
                        timestamp = DateTime.UtcNow
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing configuration change notification");
                return StatusCode(500, new
                {
                    success = false,
                    message = "Internal server error while processing notification",
                    error = ex.Message,
                    timestamp = DateTime.UtcNow
                });
            }
        }

        private string GetPlcTypeFromBrand(string? brand)
        {
            if (string.IsNullOrEmpty(brand)) return "Siemens_S7";
            
            return brand.ToUpper() switch
            {
                "SIEMENS" => "Siemens_S7",
                "MITSUBISHI" => "Mitsubishi_MC",
                "OMRON" => "Omron_FINS",
                _ => "Siemens_S7"
            };
        }

        private DeviceType MapDeviceType(string? type)
        {
            if (string.IsNullOrEmpty(type)) return DeviceType.PLC;
            
            return type.ToUpper() switch
            {
                "PLC_CONTROLLER" => DeviceType.PLC,
                "PLC" => DeviceType.PLC,
                "BARCODE_SCANNER" => DeviceType.SCANNER,
                "SCANNER" => DeviceType.SCANNER,
                "VISION_CAMERA" => DeviceType.CAMERA,
                "CAMERA" => DeviceType.CAMERA,
                "RFID_READER" => DeviceType.READER,
                "READER" => DeviceType.READER,
                "ROBOT" => DeviceType.ROBOT,
                "SENSOR" => DeviceType.SENSOR,
                _ => DeviceType.OTHER
            };
        }

        private PlcType GetPlcTypeEnum(string? brand)
        {
            if (string.IsNullOrEmpty(brand)) return PlcType.Siemens_S7;
            
            return brand.ToUpper() switch
            {
                "SIEMENS" => PlcType.Siemens_S7,
                "MITSUBISHI" => PlcType.Mitsubishi_MC,
                "OMRON" => PlcType.Omron_FINS,
                _ => PlcType.Siemens_S7
            };
        }

        /// <summary>
        /// 配置变更通知模型
        /// </summary>
        public class ConfigChangeNotification
        {
            public string ChangeType { get; set; } = string.Empty; // "device_added", "device", "workstation", "global"
            public string? WorkstationId { get; set; }
            public List<string>? AffectedDevices { get; set; }
            public string? UserId { get; set; }
            public DateTime Timestamp { get; set; } = DateTime.UtcNow;
            public string? Description { get; set; }
            public DeviceNotificationData? DeviceData { get; set; } // 新添加的设备数据
        }

        /// <summary>
        /// 设备通知数据模型
        /// </summary>
        public class DeviceNotificationData
        {
            public string DeviceId { get; set; } = string.Empty;
            public string Name { get; set; } = string.Empty;
            public string Type { get; set; } = string.Empty;
            public string? Brand { get; set; }
            public string? Model { get; set; }
            public string IpAddress { get; set; } = string.Empty;
            public int Port { get; set; }
            public string Status { get; set; } = string.Empty;
            public string WorkstationId { get; set; } = string.Empty;
        }
    }
}