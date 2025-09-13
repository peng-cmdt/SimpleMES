using DeviceCommunicationService.Models;
using System.Text.Json;
using DeviceCommunicationService.Interfaces;

namespace DeviceCommunicationService.Services
{
        public interface IDeviceConfigSyncService
    {
        Task<List<DeviceConfig>> FetchDeviceConfigsAsync(string? workstationId = null);
        Task<bool> SyncDeviceConfigsAsync(string? workstationId = null);
        Task StartPeriodicSyncAsync(CancellationToken cancellationToken = default);
        
        // 配置更新事件
        event Action<List<DeviceConfig>>? OnDeviceConfigsUpdated;
    }

    public class DeviceConfigSyncService : IDeviceConfigSyncService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<DeviceConfigSyncService> _logger;
        private readonly IConfiguration _configuration;
        private readonly string _frontendApiBaseUrl;
        private readonly int _syncIntervalMinutes;

        public DeviceConfigSyncService(
            HttpClient httpClient, 
            ILogger<DeviceConfigSyncService> logger,
            IConfiguration configuration)
        {
            _httpClient = httpClient;
            _logger = logger;
            _configuration = configuration;
            
            // 从配置读取前台API地址，默认为localhost:3009
            _frontendApiBaseUrl = _configuration.GetValue<string>("FrontendApi:BaseUrl") ?? "http://localhost:3009";
            _syncIntervalMinutes = _configuration.GetValue<int>("DeviceConfigSync:IntervalMinutes", 5);
            
            // 设置HTTP客户端默认请求头
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "DeviceCommunicationService/1.0");
            _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
            
            _logger.LogInformation("DeviceConfigSyncService initialized with frontend API: {BaseUrl}", _frontendApiBaseUrl);
        }

        public async Task<List<DeviceConfig>> FetchDeviceConfigsAsync(string? workstationId = null)
        {
            try
            {
                var deviceConfigs = new List<DeviceConfig>();

                if (!string.IsNullOrEmpty(workstationId))
                {
                    // 获取特定工位的设备配置
                    var configs = await FetchWorkstationDevicesAsync(workstationId);
                    deviceConfigs.AddRange(configs);
                }
                else
                {
                    // 获取所有工位的设备配置
                    var workstations = await FetchWorkstationsAsync();
                    foreach (var ws in workstations)
                    {
                        var configs = await FetchWorkstationDevicesAsync(ws.WorkstationId);
                        deviceConfigs.AddRange(configs);
                    }
                }

                _logger.LogInformation("Fetched {Count} device configurations from frontend API", deviceConfigs.Count);
                return deviceConfigs;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to fetch device configurations from frontend API");
                return new List<DeviceConfig>();
            }
        }

        public async Task<bool> SyncDeviceConfigsAsync(string? workstationId = null)
        {
            try
            {
                var configs = await FetchDeviceConfigsAsync(workstationId);
                
                if (configs.Any())
                {
                    // 触发设备配置更新事件
                    OnDeviceConfigsUpdated?.Invoke(configs);
                    _logger.LogInformation("Successfully synced {Count} device configurations", configs.Count);
                    return true;
                }
                else
                {
                    _logger.LogWarning("No device configurations found during sync. Check frontend API connectivity.");
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to sync device configurations");
                return false;
            }
        }

        public async Task StartPeriodicSyncAsync(CancellationToken cancellationToken = default)
        {
            _logger.LogInformation("Starting periodic device config sync every {Minutes} minutes", _syncIntervalMinutes);
            
            while (!cancellationToken.IsCancellationRequested)
            {
                try
                {
                    await SyncDeviceConfigsAsync();
                    await Task.Delay(TimeSpan.FromMinutes(_syncIntervalMinutes), cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    _logger.LogInformation("Periodic sync cancelled");
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error during periodic sync");
                    await Task.Delay(TimeSpan.FromMinutes(1), cancellationToken); // 错误时短暂延迟
                }
            }
        }

        // 事件：当设备配置更新时触发
        public event Action<List<DeviceConfig>>? OnDeviceConfigsUpdated;

        private async Task<List<WorkstationInfo>> FetchWorkstationsAsync()
        {
            try
            {
                using (var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10)))
                {
                    var response = await _httpClient.GetAsync($"{_frontendApiBaseUrl}/api/workstations", cts.Token);
                    
                    if (!response.IsSuccessStatusCode)
                    {
                        _logger.LogWarning("Failed to fetch workstations. Status: {StatusCode}", response.StatusCode);
                        return new List<WorkstationInfo>();
                    }

                    var jsonContent = await response.Content.ReadAsStringAsync();
                    
                    // 解析响应，支持 { success: true, workstations: [...] } 格式
                    using var document = JsonDocument.Parse(jsonContent);
                    var root = document.RootElement;
                    
                    if (root.TryGetProperty("workstations", out var workstationsElement))
                    {
                        var workstations = JsonSerializer.Deserialize<List<WorkstationInfo>>(workstationsElement.GetRawText(), new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        });
                        return workstations ?? new List<WorkstationInfo>();
                    }
                    
                    return new List<WorkstationInfo>();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to fetch workstations from frontend API");
                return new List<WorkstationInfo>();
            }
        }

        private async Task<List<DeviceConfig>> FetchWorkstationDevicesAsync(string workstationId)
        {
            try
            {
                using (var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10)))
                {
                    var response = await _httpClient.GetAsync($"{_frontendApiBaseUrl}/api/workstation/{workstationId}/devices", cts.Token);
                    
                    if (!response.IsSuccessStatusCode)
                    {
                        _logger.LogWarning("Failed to fetch devices for workstation {WorkstationId}. Status: {StatusCode}", 
                            workstationId, response.StatusCode);
                        return new List<DeviceConfig>();
                    }

                    var jsonContent = await response.Content.ReadAsStringAsync();
                    var apiResponse = JsonSerializer.Deserialize<WorkstationDevicesApiResponse>(jsonContent, new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    });

                    if (apiResponse?.Success != true || apiResponse.Devices == null)
                    {
                        return new List<DeviceConfig>();
                    }

                    // 转换前台设备数据格式为.NET服务的DeviceConfig格式
                    var deviceConfigs = new List<DeviceConfig>();
                    
                    foreach (var device in apiResponse.Devices)
                    {
                        var deviceConfig = ConvertToDeviceConfig(device, apiResponse.Workstation);
                        if (deviceConfig != null)
                        {
                            deviceConfigs.Add(deviceConfig);
                        }
                    }

                    return deviceConfigs;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to fetch devices for workstation {WorkstationId}", workstationId);
                return new List<DeviceConfig>();
            }
        }

        private DeviceConfig? ConvertToDeviceConfig(FrontendDeviceInfo device, WorkstationInfo? workstation)
        {
            try
            {
                // 映射设备类型 - 处理前端的PLC_CONTROLLER到后端的PLC
                var mappedType = device.Type?.ToUpper() switch
                {
                    "PLC_CONTROLLER" => "PLC",
                    "BARCODE_SCANNER" => "SCANNER",
                    "VISION_CAMERA" => "CAMERA",
                    "RFID_READER" => "READER",
                    _ => device.Type
                };
                
                if (!Enum.TryParse<DeviceType>(mappedType, true, out var deviceType))
                {
                    _logger.LogWarning("Unknown device type: {Type} for device {DeviceId}", device.Type, device.DeviceId);
                    deviceType = DeviceType.OTHER;
                }

                var config = new DeviceConfig
                {
                    DeviceId = device.DeviceId,
                    WorkstationId = workstation?.Id ?? string.Empty,
                    Name = device.Name,
                    Description = device.Description ?? $"{workstation?.Name}工位{device.Type}设备",
                    DeviceType = deviceType,
                    ConnectionType = device.Protocol?.ToUpper() == "TCP" ? ConnectionType.TCP : ConnectionType.TCP,
                    ConnectionString = string.Empty,
                    Enabled = device.Status != "MAINTENANCE",
                    CreatedAt = DateTime.TryParse(device.CreatedAt, out var createdAt) ? createdAt : DateTime.UtcNow,
                    UpdatedAt = DateTime.TryParse(device.UpdatedAt, out var updatedAt) ? updatedAt : DateTime.UtcNow
                };

                // 设置连接参数
                config.Connection = new DeviceConnection
                {
                    Type = ConnectionType.TCP,
                    Address = device.IpAddress ?? "127.0.0.1",
                    Port = device.Port ?? 502,
                    Parameters = new Dictionary<string, object>()
                };

                // 根据设备类型和设置配置参数
                config.Settings = device.Settings ?? new Dictionary<string, object>();
                
                if (device.Type.Contains("PLC") || device.Type.Contains("plc"))
                {
                    // PLC设备特殊处理
                    if (device.Settings?.ContainsKey("plcType") == true)
                    {
                        config.Connection.Parameters["plcType"] = device.Settings["plcType"];
                    }
                    else if (!string.IsNullOrEmpty(device.Brand))
                    {
                        // 根据品牌推断PLC类型
                        var plcType = device.Brand.ToUpper() switch
                        {
                            "SIEMENS" => "Siemens_S7",
                            "MITSUBISHI" => "Mitsubishi_MC",
                            "OMRON" => "Omron_FINS",
                            _ => "Modbus_TCP"
                        };
                        config.Connection.Parameters["plcType"] = plcType;
                        config.Settings["plcType"] = plcType;
                    }

                    // 添加默认PLC参数
                    if (!config.Connection.Parameters.ContainsKey("rack"))
                        config.Connection.Parameters["rack"] = 0;
                    if (!config.Connection.Parameters.ContainsKey("slot"))
                        config.Connection.Parameters["slot"] = 1;
                }

                // 配置其他信息
                config.Configuration = new DeviceConfiguration
                {
                    Additional = new Dictionary<string, object>
                    {
                        ["brand"] = device.Brand ?? "",
                        ["model"] = device.Model ?? "",
                        ["source"] = device.Source ?? "frontend",
                        ["templateId"] = device.TemplateId ?? "",
                        ["templateName"] = device.TemplateName ?? ""
                    }
                };

                if (deviceType == DeviceType.PLC)
                {
                    // 根据品牌确定PLC类型和CPU类型
                    var plcType = PlcType.Modbus_TCP;
                    var cpuType = CpuType.S7_1200;
                    
                    if (!string.IsNullOrEmpty(device.Brand))
                    {
                        plcType = device.Brand.ToUpper() switch
                        {
                            "SIEMENS" => PlcType.Siemens_S7,
                            "MITSUBISHI" => PlcType.Mitsubishi_MC,
                            "OMRON" => PlcType.Omron_FINS,
                            _ => PlcType.Modbus_TCP
                        };
                        
                        cpuType = device.Brand.ToUpper() switch
                        {
                            "SIEMENS" => CpuType.S7_1200,
                            _ => CpuType.S7_1200
                        };
                    }
                    
                    config.Configuration.Plc = new PlcParameters
                    {
                        PlcType = plcType,
                        Slot = 1,
                        Rack = 0,
                        Station = 0,
                        Cpu = cpuType,
                        WordLength = 2,
                        IsBit = false
                    };
                }

                return config;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to convert device {DeviceId} to DeviceConfig", device.DeviceId);
                return null;
            }
        }

        // API响应模型类
        private class WorkstationsApiResponse
        {
            public bool Success { get; set; }
            public List<WorkstationInfo> Workstations { get; set; } = new();
        }

        private class WorkstationDevicesApiResponse
        {
            public bool Success { get; set; }
            public WorkstationInfo? Workstation { get; set; }
            public List<FrontendDeviceInfo> Devices { get; set; } = new();
            public int DeviceCount { get; set; }
        }

        private class WorkstationInfo
        {
            public string Id { get; set; } = string.Empty;
            public string WorkstationId { get; set; } = string.Empty;
            public string Name { get; set; } = string.Empty;
            public string? Description { get; set; }
            public string? Location { get; set; }
            public string Type { get; set; } = string.Empty;
        }

        private class FrontendDeviceInfo
        {
            public string Id { get; set; } = string.Empty;
            public string DeviceId { get; set; } = string.Empty;
            public string Name { get; set; } = string.Empty;
            public string Type { get; set; } = string.Empty;
            public string? Brand { get; set; }
            public string? Model { get; set; }
            public string? Description { get; set; }
            public string? IpAddress { get; set; }
            public int? Port { get; set; }
            public string? Protocol { get; set; }
            public string Status { get; set; } = string.Empty;
            public bool IsOnline { get; set; }
            public string? LastConnected { get; set; }
            public string? LastHeartbeat { get; set; }
            public Dictionary<string, object>? Settings { get; set; }
            public Dictionary<string, object>? Capabilities { get; set; }
            public string CreatedAt { get; set; } = string.Empty;
            public string UpdatedAt { get; set; } = string.Empty;
            public string? Source { get; set; }
            public string? TemplateId { get; set; }
            public string? TemplateName { get; set; }
        }
    }
}