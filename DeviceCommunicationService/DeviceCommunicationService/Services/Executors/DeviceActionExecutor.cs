using DeviceCommunicationService.Interfaces;
using DeviceCommunicationService.Models;

namespace DeviceCommunicationService.Services.Executors
{
    public class DeviceActionExecutor : IDeviceActionExecutor
    {
        private readonly ILogger<DeviceActionExecutor> _logger;
        private IDeviceManager _deviceManager = null!;

        public ActionType[] SupportedActionTypes => new[] { ActionType.DEVICE_READ, ActionType.DEVICE_WRITE };

        public DeviceActionExecutor(ILogger<DeviceActionExecutor> logger)
        {
            _logger = logger;
        }

        public void SetDeviceManager(IDeviceManager deviceManager)
        {
            _deviceManager = deviceManager ?? throw new ArgumentNullException(nameof(deviceManager));
        }

        public async Task<ActionExecutionResult> ExecuteAsync(ActionExecutionRequest request, ActionExecutionContext context)
        {
            var startTime = DateTime.UtcNow;
            
            try
            {
                return request.Type switch
                {
                    ActionType.DEVICE_READ => await ExecuteDeviceReadAsync(request, context),
                    ActionType.DEVICE_WRITE => await ExecuteDeviceWriteAsync(request, context),
                    _ => new ActionExecutionResult
                    {
                        ExecutionId = request.ExecutionId,
                        ActionId = request.ActionId,
                        Status = ActionExecutionStatus.FAILED,
                        Success = false,
                        StartTime = startTime,
                        ErrorMessage = $"Unsupported action type: {request.Type}"
                    }
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error executing device action {ActionCode}", request.ActionCode);
                
                return new ActionExecutionResult
                {
                    ExecutionId = request.ExecutionId,
                    ActionId = request.ActionId,
                    Status = ActionExecutionStatus.FAILED,
                    Success = false,
                    StartTime = startTime,
                    EndTime = DateTime.UtcNow,
                    Duration = (long)(DateTime.UtcNow - startTime).TotalMilliseconds,
                    ErrorMessage = ex.Message
                };
            }
        }

        public async Task<ActionExecutionResult> ExecuteDeviceReadAsync(ActionExecutionRequest request, ActionExecutionContext context)
        {
            var startTime = DateTime.UtcNow;
            
            try
            {
                if (string.IsNullOrEmpty(request.DeviceId))
                {
                    throw new ArgumentException("DeviceId is required for device read operation");
                }

                if (string.IsNullOrEmpty(request.DeviceAddress))
                {
                    throw new ArgumentException("DeviceAddress is required for device read operation");
                }

                // 创建设备读取请求
                var deviceRequest = new DeviceRequest
                {
                    DeviceId = request.DeviceId,
                    Command = new DeviceCommand
                    {
                        Operation = OperationType.READ,
                        Target = request.DeviceAddress,
                        Address = request.DeviceAddress,
                        Parameters = request.Parameters
                    },
                    Timeout = request.Timeout
                };

                _logger.LogDebug("Executing device read: Device={DeviceId}, Address={Address}", 
                    request.DeviceId, request.DeviceAddress);

                // 执行设备读取
                var deviceResponse = await _deviceManager.SendCommandAsync(deviceRequest);
                
                var result = new ActionExecutionResult
                {
                    ExecutionId = request.ExecutionId,
                    ActionId = request.ActionId,
                    Status = deviceResponse.Success ? ActionExecutionStatus.COMPLETED : ActionExecutionStatus.FAILED,
                    Success = deviceResponse.Success,
                    Result = deviceResponse.Data,
                    ResultValue = deviceResponse.Data?.ToString(),
                    StartTime = startTime,
                    EndTime = DateTime.UtcNow,
                    Duration = deviceResponse.Duration ?? 0,
                    ErrorMessage = deviceResponse.Error?.Message,
                    Metadata = new Dictionary<string, object>
                    {
                        ["deviceId"] = request.DeviceId,
                        ["address"] = request.DeviceAddress,
                        ["operation"] = "READ"
                    }
                };

                // 如果指定了期望值，进行比较
                if (!string.IsNullOrEmpty(request.ExpectedValue) && deviceResponse.Success)
                {
                    var actualValue = deviceResponse.Data?.ToString();
                    var expectedValue = request.ExpectedValue;
                    
                    if (actualValue != expectedValue)
                    {
                        result.Success = false;
                        result.Status = ActionExecutionStatus.FAILED;
                        result.ErrorMessage = $"Value mismatch. Expected: {expectedValue}, Actual: {actualValue}";
                        
                        result.Metadata!["expectedValue"] = expectedValue;
                        result.Metadata["actualValue"] = actualValue ?? "null";
                        result.Metadata["valueMismatch"] = true;
                    }
                    else
                    {
                        result.Metadata!["valueMatched"] = true;
                    }
                }

                _logger.LogInformation("Device read completed: Device={DeviceId}, Address={Address}, Success={Success}", 
                    request.DeviceId, request.DeviceAddress, result.Success);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in device read operation: Device={DeviceId}, Address={Address}", 
                    request.DeviceId, request.DeviceAddress);
                
                return new ActionExecutionResult
                {
                    ExecutionId = request.ExecutionId,
                    ActionId = request.ActionId,
                    Status = ActionExecutionStatus.FAILED,
                    Success = false,
                    StartTime = startTime,
                    EndTime = DateTime.UtcNow,
                    Duration = (long)(DateTime.UtcNow - startTime).TotalMilliseconds,
                    ErrorMessage = ex.Message,
                    Metadata = new Dictionary<string, object>
                    {
                        ["deviceId"] = request.DeviceId ?? "unknown",
                        ["address"] = request.DeviceAddress ?? "unknown",
                        ["operation"] = "READ",
                        ["error"] = ex.Message
                    }
                };
            }
        }

        public async Task<ActionExecutionResult> ExecuteDeviceWriteAsync(ActionExecutionRequest request, ActionExecutionContext context)
        {
            var startTime = DateTime.UtcNow;
            
            try
            {
                if (string.IsNullOrEmpty(request.DeviceId))
                {
                    throw new ArgumentException("DeviceId is required for device write operation");
                }

                if (string.IsNullOrEmpty(request.DeviceAddress))
                {
                    throw new ArgumentException("DeviceAddress is required for device write operation");
                }

                // 从期望值或参数中获取要写入的值
                var writeValue = request.ExpectedValue;
                if (request.Parameters != null && request.Parameters.ContainsKey("value"))
                {
                    writeValue = request.Parameters["value"]?.ToString();
                }

                if (writeValue == null)
                {
                    throw new ArgumentException("Write value is required for device write operation (use ExpectedValue or Parameters['value'])");
                }

                // 创建设备写入请求
                var deviceRequest = new DeviceRequest
                {
                    DeviceId = request.DeviceId,
                    Command = new DeviceCommand
                    {
                        Operation = OperationType.WRITE,
                        Target = request.DeviceAddress,
                        Address = request.DeviceAddress,
                        Value = writeValue,
                        Data = writeValue,
                        Parameters = request.Parameters
                    },
                    Timeout = request.Timeout
                };

                _logger.LogDebug("Executing device write: Device={DeviceId}, Address={Address}, Value={Value}", 
                    request.DeviceId, request.DeviceAddress, writeValue);

                // 执行设备写入
                var deviceResponse = await _deviceManager.SendCommandAsync(deviceRequest);
                
                var result = new ActionExecutionResult
                {
                    ExecutionId = request.ExecutionId,
                    ActionId = request.ActionId,
                    Status = deviceResponse.Success ? ActionExecutionStatus.COMPLETED : ActionExecutionStatus.FAILED,
                    Success = deviceResponse.Success,
                    Result = deviceResponse.Data,
                    ResultValue = writeValue,
                    StartTime = startTime,
                    EndTime = DateTime.UtcNow,
                    Duration = deviceResponse.Duration ?? 0,
                    ErrorMessage = deviceResponse.Error?.Message,
                    Metadata = new Dictionary<string, object>
                    {
                        ["deviceId"] = request.DeviceId,
                        ["address"] = request.DeviceAddress,
                        ["operation"] = "WRITE",
                        ["writeValue"] = writeValue
                    }
                };

                _logger.LogInformation("Device write completed: Device={DeviceId}, Address={Address}, Value={Value}, Success={Success}", 
                    request.DeviceId, request.DeviceAddress, writeValue, result.Success);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in device write operation: Device={DeviceId}, Address={Address}", 
                    request.DeviceId, request.DeviceAddress);
                
                return new ActionExecutionResult
                {
                    ExecutionId = request.ExecutionId,
                    ActionId = request.ActionId,
                    Status = ActionExecutionStatus.FAILED,
                    Success = false,
                    StartTime = startTime,
                    EndTime = DateTime.UtcNow,
                    Duration = (long)(DateTime.UtcNow - startTime).TotalMilliseconds,
                    ErrorMessage = ex.Message,
                    Metadata = new Dictionary<string, object>
                    {
                        ["deviceId"] = request.DeviceId ?? "unknown",
                        ["address"] = request.DeviceAddress ?? "unknown",
                        ["operation"] = "WRITE",
                        ["error"] = ex.Message
                    }
                };
            }
        }

        public async Task<bool> CancelAsync(string executionId)
        {
            // 设备操作通常很快完成，取消操作较为复杂
            // 这里返回false表示不支持取消
            _logger.LogWarning("Device action cancellation not supported for execution {ExecutionId}", executionId);
            return await Task.FromResult(false);
        }

        public async Task<ActionExecutionProgress?> GetProgressAsync(string executionId)
        {
            // 设备操作通常很快完成，不提供详细进度
            return await Task.FromResult<ActionExecutionProgress?>(null);
        }

        public ValidationResult ValidateParameters(ActionExecutionRequest request)
        {
            var errors = new List<string>();

            if (string.IsNullOrEmpty(request.DeviceId))
            {
                errors.Add("DeviceId is required");
            }

            if (string.IsNullOrEmpty(request.DeviceAddress))
            {
                errors.Add("DeviceAddress is required");
            }

            if (request.Type == ActionType.DEVICE_WRITE)
            {
                var hasWriteValue = !string.IsNullOrEmpty(request.ExpectedValue) ||
                                  (request.Parameters != null && request.Parameters.ContainsKey("value"));
                
                if (!hasWriteValue)
                {
                    errors.Add("Write value is required (use ExpectedValue or Parameters['value'])");
                }
            }

            if (request.Timeout <= 0)
            {
                errors.Add("Timeout must be greater than 0");
            }

            return errors.Count == 0 ? ValidationResult.Success() : ValidationResult.Failure(errors.ToArray());
        }
    }
}