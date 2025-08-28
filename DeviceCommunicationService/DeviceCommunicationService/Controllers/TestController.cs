using Microsoft.AspNetCore.Mvc;
using DeviceCommunicationService.Services;
using DeviceCommunicationService.Models;
using DeviceCommunicationService.Interfaces;

namespace DeviceCommunicationService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TestController : ControllerBase
    {
        private readonly ILogger<TestController> _logger;
        private readonly IDeviceManager _deviceManager;

        public TestController(ILogger<TestController> logger, IDeviceManager deviceManager)
        {
            _logger = logger;
            _deviceManager = deviceManager;
        }

        /// <summary>
        /// 手动添加PLC设备用于测试
        /// </summary>
        [HttpPost("add-plc-device")]
        public async Task<IActionResult> AddPlcDevice()
        {
            try
            {
                var deviceConfig = new DeviceConfig
                {
                    DeviceId = "cmeu267pm000ztm18haxdg7oe",
                    WorkstationId = "cmes6s081006htmuwhsl0gpri", 
                    Name = "PLC_10.102.11.64",
                    Description = "Test PLC device at 10.102.11.64",
                    DeviceType = DeviceType.PLC,
                    ConnectionType = ConnectionType.TCP,
                    ConnectionString = "",
                    Enabled = true,
                    Connection = new DeviceConnection
                    {
                        Type = ConnectionType.TCP,
                        Address = "10.102.11.64",
                        Port = 102,
                        Parameters = new Dictionary<string, object>
                        {
                            {"plcType", "Siemens_S7"},
                            {"rack", 0},
                            {"slot", 1}
                        }
                    },
                    Settings = new Dictionary<string, object>
                    {
                        {"plcType", "Siemens_S7"}
                    },
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var result = await _deviceManager.AddDeviceAsync(deviceConfig);
                
                _logger.LogInformation("Test PLC device added successfully: {DeviceId}", result.DeviceId);
                
                return Ok(new
                {
                    success = true,
                    message = "PLC device added successfully",
                    deviceId = result.DeviceId,
                    name = result.Name,
                    address = $"{result.Connection?.Address}:{result.Connection?.Port}"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to add test PLC device");
                return StatusCode(500, new
                {
                    success = false,
                    message = "Failed to add PLC device",
                    error = ex.Message
                });
            }
        }

        /// <summary>
        /// 测试前端API连接
        /// </summary>
        [HttpGet("test-frontend-api")]
        public async Task<IActionResult> TestFrontendApi()
        {
            try
            {
                // 创建一个简单的HttpClient进行测试
                var handler = new HttpClientHandler()
                {
                    Proxy = null,
                    UseProxy = false,
                    UseDefaultCredentials = false
                };
                
                using (var httpClient = new HttpClient(handler))
                {
                    httpClient.Timeout = TimeSpan.FromSeconds(10);
                    httpClient.DefaultRequestHeaders.Add("User-Agent", "TestController/1.0");
                    
                    _logger.LogInformation("Testing connection to frontend API at http://localhost:3009/api/workstations");
                    
                    var response = await httpClient.GetAsync("http://localhost:3009/api/workstations");
                    
                    if (response.IsSuccessStatusCode)
                    {
                        var content = await response.Content.ReadAsStringAsync();
                        _logger.LogInformation("Frontend API test successful. Status: {StatusCode}", response.StatusCode);
                        
                        return Ok(new
                        {
                            success = true,
                            message = "Frontend API connection successful",
                            statusCode = response.StatusCode,
                            contentLength = content.Length,
                            content = content.Length > 500 ? content.Substring(0, 500) + "..." : content
                        });
                    }
                    else
                    {
                        _logger.LogWarning("Frontend API test failed. Status: {StatusCode}", response.StatusCode);
                        return StatusCode(500, new
                        {
                            success = false,
                            message = "Frontend API returned error status",
                            statusCode = response.StatusCode
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Frontend API test failed with exception");
                return StatusCode(500, new
                {
                    success = false,
                    message = "Frontend API test failed",
                    error = ex.Message,
                    innerException = ex.InnerException?.Message
                });
            }
        }
    }
}