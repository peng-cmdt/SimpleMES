using Microsoft.AspNetCore.Mvc;
using DeviceCommunicationService.Interfaces;
using DeviceCommunicationService.Models;
using DeviceCommunicationService.Services;

namespace DeviceCommunicationService.Controllers
{
    [ApiController]
    [Route("api/workstation")]
    public class WorkstationController : ControllerBase
    {
        private readonly ILogger<WorkstationController> _logger;
        private readonly IWorkstationDeviceManager _workstationManager;

        public WorkstationController(
            ILogger<WorkstationController> logger,
            IWorkstationDeviceManager workstationManager)
        {
            _logger = logger;
            _workstationManager = workstationManager;
        }

        /// <summary>
        /// 工位登录并连接设备
        /// </summary>
        [HttpPost("login")]
        public async Task<ActionResult<WorkstationLoginResult>> LoginWorkstation([FromBody] WorkstationLoginRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.WorkstationId))
                {
                    return BadRequest("WorkstationId is required");
                }

                var result = await _workstationManager.LoginWorkstationAsync(request);
                
                if (result.Success)
                {
                    return Ok(result);
                }
                else
                {
                    return BadRequest(result);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to login workstation {WorkstationId}", request.WorkstationId);
                return StatusCode(500, new { Error = "Internal server error", Message = ex.Message });
            }
        }

        /// <summary>
        /// 工位登出并断开设备
        /// </summary>
        [HttpPost("logout/{sessionId}")]
        public async Task<ActionResult<bool>> LogoutWorkstation(string sessionId)
        {
            try
            {
                if (string.IsNullOrEmpty(sessionId))
                {
                    return BadRequest("SessionId is required");
                }

                var result = await _workstationManager.LogoutWorkstationAsync(sessionId);
                return Ok(new { Success = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to logout session {SessionId}", sessionId);
                return StatusCode(500, new { Error = "Internal server error", Message = ex.Message });
            }
        }

        /// <summary>
        /// 执行设备操作
        /// </summary>
        [HttpPost("device/operation")]
        public async Task<ActionResult<DeviceOperationResponse>> ExecuteDeviceOperation([FromBody] DeviceOperationRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.DeviceId))
                {
                    return BadRequest("DeviceId is required");
                }

                if (string.IsNullOrEmpty(request.Operation))
                {
                    return BadRequest("Operation is required");
                }

                var result = await _workstationManager.ExecuteDeviceOperationAsync(request);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to execute device operation {RequestId}", request.RequestId);
                return StatusCode(500, new { Error = "Internal server error", Message = ex.Message });
            }
        }

        /// <summary>
        /// 获取工位设备状态
        /// </summary>
        [HttpGet("{workstationId}/devices/status")]
        public async Task<ActionResult<List<DeviceStatusInfo>>> GetWorkstationDeviceStatus(string workstationId)
        {
            try
            {
                if (string.IsNullOrEmpty(workstationId))
                {
                    return BadRequest("WorkstationId is required");
                }

                var result = await _workstationManager.GetWorkstationDeviceStatusAsync(workstationId);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get device status for workstation {WorkstationId}", workstationId);
                return StatusCode(500, new { Error = "Internal server error", Message = ex.Message });
            }
        }

        /// <summary>
        /// 获取活跃会话
        /// </summary>
        [HttpGet("sessions")]
        public async Task<ActionResult<List<WorkstationSession>>> GetActiveSessions()
        {
            try
            {
                var result = await _workstationManager.GetActiveSessionsAsync();
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get active sessions");
                return StatusCode(500, new { Error = "Internal server error", Message = ex.Message });
            }
        }

        /// <summary>
        /// 初始化工位设备配置
        /// </summary>
        [HttpPost("{workstationId}/devices/initialize")]
        public async Task<ActionResult<bool>> InitializeWorkstationDevices(string workstationId, [FromBody] List<WorkstationDevice> devices)
        {
            try
            {
                if (string.IsNullOrEmpty(workstationId))
                {
                    return BadRequest("WorkstationId is required");
                }

                if (devices == null || !devices.Any())
                {
                    return BadRequest("Devices list is required");
                }

                var result = await _workstationManager.InitializeWorkstationDevicesAsync(workstationId, devices);
                return Ok(new { Success = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to initialize devices for workstation {WorkstationId}", workstationId);
                return StatusCode(500, new { Error = "Internal server error", Message = ex.Message });
            }
        }
    }
}