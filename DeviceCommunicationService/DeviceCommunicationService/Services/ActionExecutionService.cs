using DeviceCommunicationService.Interfaces;
using DeviceCommunicationService.Models;
using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace DeviceCommunicationService.Services
{
    public interface IActionExecutionService
    {
        Task<ActionExecutionResult> ExecuteActionAsync(ActionExecutionRequest request, ActionExecutionContext context);
        Task<BatchActionExecutionResult> ExecuteBatchActionsAsync(BatchActionExecutionRequest request);
        Task<ActionExecutionProgress> GetExecutionProgressAsync(string executionId);
        Task<ActionExecutionStats> GetActionStatsAsync(string actionId);
        Task<bool> CancelExecutionAsync(string executionId);
        Task<ManualConfirmationResponse> SubmitManualConfirmationAsync(ManualConfirmationResponse response);
        Task<IEnumerable<ActionExecutionResult>> GetExecutionHistoryAsync(string actionId, int limit = 50);
    }

    public class ActionExecutionService : IActionExecutionService
    {
        private readonly IDeviceManager _deviceManager;
        private readonly ILogger<ActionExecutionService> _logger;
        private readonly ConcurrentDictionary<string, ActionExecutionContext> _executionContexts = new();
        private readonly ConcurrentDictionary<string, ActionExecutionProgress> _executionProgress = new();
        private readonly ConcurrentDictionary<string, ManualConfirmationRequest> _pendingConfirmations = new();
        private readonly ConcurrentDictionary<string, CancellationTokenSource> _cancellationTokens = new();
        private readonly ConcurrentQueue<ActionExecutionResult> _executionHistory = new();

        public ActionExecutionService(IDeviceManager deviceManager, ILogger<ActionExecutionService> logger)
        {
            _deviceManager = deviceManager;
            _logger = logger;
        }

        public async Task<ActionExecutionResult> ExecuteActionAsync(ActionExecutionRequest request, ActionExecutionContext context)
        {
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            var result = new ActionExecutionResult
            {
                ExecutionId = request.ExecutionId,
                ActionId = request.ActionId,
                Status = ActionExecutionStatus.RUNNING,
                StartTime = DateTime.UtcNow
            };

            try
            {
                _logger.LogInformation("开始执行Action: {ActionCode} ({ActionType}) - ExecutionId: {ExecutionId}", 
                    request.ActionCode, request.Type, request.ExecutionId);

                // 存储执行上下文
                _executionContexts[request.ExecutionId] = context;
                
                // 创建取消令牌
                var cts = CancellationTokenSource.CreateLinkedTokenSource(context.CancellationToken);
                _cancellationTokens[request.ExecutionId] = cts;

                // 更新执行进度
                await UpdateExecutionProgressAsync(request.ExecutionId, ActionExecutionStatus.RUNNING, 0, "开始执行");

                // 根据Action类型执行相应的操作
                switch (request.Type)
                {
                    case ActionType.DEVICE_READ:
                        result = await ExecuteDeviceReadAsync(request, context, cts.Token);
                        break;
                    case ActionType.DEVICE_WRITE:
                        result = await ExecuteDeviceWriteAsync(request, context, cts.Token);
                        break;
                    case ActionType.MANUAL_CONFIRM:
                        result = await ExecuteManualConfirmAsync(request, context, cts.Token);
                        break;
                    case ActionType.DATA_VALIDATION:
                        result = await ExecuteDataValidationAsync(request, context, cts.Token);
                        break;
                    case ActionType.DELAY_WAIT:
                        result = await ExecuteDelayWaitAsync(request, context, cts.Token);
                        break;
                    case ActionType.BARCODE_SCAN:
                        result = await ExecuteBarcodeScanAsync(request, context, cts.Token);
                        break;
                    case ActionType.CAMERA_CHECK:
                        result = await ExecuteCameraCheckAsync(request, context, cts.Token);
                        break;
                    case ActionType.CUSTOM_SCRIPT:
                        result = await ExecuteCustomScriptAsync(request, context, cts.Token);
                        break;
                    default:
                        result.Status = ActionExecutionStatus.FAILED;
                        result.Success = false;
                        result.ErrorMessage = $"不支持的Action类型: {request.Type}";
                        break;
                }

                result.EndTime = DateTime.UtcNow;
                result.Duration = stopwatch.ElapsedMilliseconds;

                // 更新最终状态
                if (result.Success)
                {
                    await UpdateExecutionProgressAsync(request.ExecutionId, ActionExecutionStatus.COMPLETED, 100, "执行完成");
                    _logger.LogInformation("Action执行成功: {ActionCode} - ExecutionId: {ExecutionId}, 耗时: {Duration}ms", 
                        request.ActionCode, request.ExecutionId, result.Duration);
                }
                else
                {
                    await UpdateExecutionProgressAsync(request.ExecutionId, ActionExecutionStatus.FAILED, 0, result.ErrorMessage ?? "执行失败");
                    _logger.LogError("Action执行失败: {ActionCode} - ExecutionId: {ExecutionId}, 错误: {Error}", 
                        request.ActionCode, request.ExecutionId, result.ErrorMessage);
                }

                // 记录执行历史
                _executionHistory.Enqueue(result);
                if (_executionHistory.Count > 1000) // 保持最多1000条历史记录
                {
                    _executionHistory.TryDequeue(out _);
                }

                return result;
            }
            catch (OperationCanceledException)
            {
                result.Status = ActionExecutionStatus.CANCELLED;
                result.Success = false;
                result.ErrorMessage = "执行被取消";
                result.EndTime = DateTime.UtcNow;
                result.Duration = stopwatch.ElapsedMilliseconds;
                
                _logger.LogWarning("Action执行被取消: {ActionCode} - ExecutionId: {ExecutionId}", 
                    request.ActionCode, request.ExecutionId);
                return result;
            }
            catch (Exception ex)
            {
                result.Status = ActionExecutionStatus.FAILED;
                result.Success = false;
                result.ErrorMessage = ex.Message;
                result.EndTime = DateTime.UtcNow;
                result.Duration = stopwatch.ElapsedMilliseconds;
                
                _logger.LogError(ex, "Action执行异常: {ActionCode} - ExecutionId: {ExecutionId}", 
                    request.ActionCode, request.ExecutionId);
                return result;
            }
            finally
            {
                // 清理资源
                _executionContexts.TryRemove(request.ExecutionId, out _);
                _cancellationTokens.TryRemove(request.ExecutionId, out var cts);
                cts?.Dispose();
            }
        }

        private async Task<ActionExecutionResult> ExecuteDeviceReadAsync(ActionExecutionRequest request, ActionExecutionContext context, CancellationToken cancellationToken)
        {
            var result = new ActionExecutionResult
            {
                ExecutionId = request.ExecutionId,
                ActionId = request.ActionId,
                Status = ActionExecutionStatus.RUNNING
            };

            if (string.IsNullOrEmpty(request.DeviceId) || string.IsNullOrEmpty(request.DeviceAddress))
            {
                result.Status = ActionExecutionStatus.FAILED;
                result.Success = false;
                result.ErrorMessage = "设备ID和设备地址不能为空";
                return result;
            }

            await UpdateExecutionProgressAsync(request.ExecutionId, ActionExecutionStatus.RUNNING, 25, "连接设备中...");
            
            // 创建设备读取请求
            var deviceRequest = new DeviceRequest
            {
                Id = Guid.NewGuid().ToString(),
                DeviceId = request.DeviceId,
                Command = new DeviceCommand
                {
                    Operation = OperationType.READ,
                    Address = request.DeviceAddress,
                    Parameters = new Dictionary<string, object>
                    {
                        { "address", request.DeviceAddress }
                    }
                },
                Timeout = request.Timeout
            };

            await UpdateExecutionProgressAsync(request.ExecutionId, ActionExecutionStatus.RUNNING, 50, "发送读取命令...");

            // 发送设备命令
            var deviceResponse = await _deviceManager.SendCommandAsync(deviceRequest);
            
            await UpdateExecutionProgressAsync(request.ExecutionId, ActionExecutionStatus.RUNNING, 75, "处理响应数据...");

            if (deviceResponse.Success && deviceResponse.Data != null)
            {
                result.Status = ActionExecutionStatus.COMPLETED;
                result.Success = true;
                result.Result = deviceResponse.Data;
                result.ResultValue = deviceResponse.Data.ToString();
                
                // 如果有期望值，进行比较
                if (!string.IsNullOrEmpty(request.ExpectedValue))
                {
                    var actualValue = deviceResponse.Data.ToString();
                    if (actualValue != request.ExpectedValue)
                    {
                        result.Success = false;
                        result.ErrorMessage = $"读取值不匹配，期望: {request.ExpectedValue}, 实际: {actualValue}";
                        result.Status = ActionExecutionStatus.FAILED;
                    }
                }
            }
            else
            {
                result.Status = ActionExecutionStatus.FAILED;
                result.Success = false;
                result.ErrorMessage = deviceResponse.Error?.Message ?? "设备读取失败";
            }

            return result;
        }

        private async Task<ActionExecutionResult> ExecuteDeviceWriteAsync(ActionExecutionRequest request, ActionExecutionContext context, CancellationToken cancellationToken)
        {
            var result = new ActionExecutionResult
            {
                ExecutionId = request.ExecutionId,
                ActionId = request.ActionId,
                Status = ActionExecutionStatus.RUNNING
            };

            if (string.IsNullOrEmpty(request.DeviceId) || string.IsNullOrEmpty(request.DeviceAddress) || string.IsNullOrEmpty(request.ExpectedValue))
            {
                result.Status = ActionExecutionStatus.FAILED;
                result.Success = false;
                result.ErrorMessage = "设备ID、设备地址和写入值不能为空";
                return result;
            }

            await UpdateExecutionProgressAsync(request.ExecutionId, ActionExecutionStatus.RUNNING, 25, "连接设备中...");

            // 创建设备写入请求
            var deviceRequest = new DeviceRequest
            {
                Id = Guid.NewGuid().ToString(),
                DeviceId = request.DeviceId,
                Command = new DeviceCommand
                {
                    Operation = OperationType.WRITE,
                    Address = request.DeviceAddress,
                    Value = request.ExpectedValue,
                    Parameters = new Dictionary<string, object>
                    {
                        { "address", request.DeviceAddress },
                        { "value", request.ExpectedValue }
                    }
                },
                Timeout = request.Timeout
            };

            await UpdateExecutionProgressAsync(request.ExecutionId, ActionExecutionStatus.RUNNING, 50, "发送写入命令...");

            // 发送设备命令
            var deviceResponse = await _deviceManager.SendCommandAsync(deviceRequest);
            
            await UpdateExecutionProgressAsync(request.ExecutionId, ActionExecutionStatus.RUNNING, 75, "验证写入结果...");

            if (deviceResponse.Success)
            {
                result.Status = ActionExecutionStatus.COMPLETED;
                result.Success = true;
                result.Result = deviceResponse.Data;
                result.ResultValue = "写入成功";
            }
            else
            {
                result.Status = ActionExecutionStatus.FAILED;
                result.Success = false;
                result.ErrorMessage = deviceResponse.Error?.Message ?? "设备写入失败";
            }

            return result;
        }

        private async Task<ActionExecutionResult> ExecuteManualConfirmAsync(ActionExecutionRequest request, ActionExecutionContext context, CancellationToken cancellationToken)
        {
            var result = new ActionExecutionResult
            {
                ExecutionId = request.ExecutionId,
                ActionId = request.ActionId,
                Status = ActionExecutionStatus.WAITING_INPUT
            };

            // 创建人工确认请求
            var confirmationRequest = new ManualConfirmationRequest
            {
                ExecutionId = request.ExecutionId,
                ActionCode = request.ActionCode,
                Title = request.Name,
                Message = request.Description ?? "请确认是否继续",
                Timeout = request.Timeout
            };

            // 存储待处理的确认请求
            _pendingConfirmations[request.ExecutionId] = confirmationRequest;

            await UpdateExecutionProgressAsync(request.ExecutionId, ActionExecutionStatus.WAITING_INPUT, 0, "等待人工确认...");

            // 等待人工确认或超时
            var timeoutTask = Task.Delay(request.Timeout, cancellationToken);
            var confirmationTask = WaitForManualConfirmationAsync(request.ExecutionId, cancellationToken);

            var completedTask = await Task.WhenAny(timeoutTask, confirmationTask);

            if (completedTask == timeoutTask)
            {
                result.Status = ActionExecutionStatus.TIMEOUT;
                result.Success = false;
                result.ErrorMessage = "等待人工确认超时";
            }
            else
            {
                var confirmation = await confirmationTask;
                if (confirmation.Confirmed)
                {
                    result.Status = ActionExecutionStatus.COMPLETED;
                    result.Success = true;
                    result.Result = confirmation;
                    result.ResultValue = confirmation.SelectedOption ?? "已确认";
                }
                else
                {
                    result.Status = ActionExecutionStatus.FAILED;
                    result.Success = false;
                    result.ErrorMessage = "用户取消确认";
                }
            }

            // 清理待处理的确认请求
            _pendingConfirmations.TryRemove(request.ExecutionId, out _);

            return result;
        }

        private async Task<ActionExecutionResult> ExecuteDataValidationAsync(ActionExecutionRequest request, ActionExecutionContext context, CancellationToken cancellationToken)
        {
            var result = new ActionExecutionResult
            {
                ExecutionId = request.ExecutionId,
                ActionId = request.ActionId,
                Status = ActionExecutionStatus.RUNNING
            };

            await UpdateExecutionProgressAsync(request.ExecutionId, ActionExecutionStatus.RUNNING, 50, "执行数据校验...");

            var validationRequest = new DataValidationRequest
            {
                ExecutionId = request.ExecutionId,
                Value = context.SharedData.GetValueOrDefault("inputValue", ""),
                ValidationRule = request.ValidationRule ?? "",
                ExpectedValue = request.ExpectedValue
            };

            var validationResult = await ValidateDataAsync(validationRequest);

            if (validationResult.IsValid)
            {
                result.Status = ActionExecutionStatus.COMPLETED;
                result.Success = true;
                result.Result = validationResult;
                result.ResultValue = validationResult.ValidatedValue?.ToString() ?? "";
            }
            else
            {
                result.Status = ActionExecutionStatus.FAILED;
                result.Success = false;
                result.ErrorMessage = validationResult.ErrorMessage ?? "数据校验失败";
            }

            return result;
        }

        private async Task<ActionExecutionResult> ExecuteDelayWaitAsync(ActionExecutionRequest request, ActionExecutionContext context, CancellationToken cancellationToken)
        {
            var result = new ActionExecutionResult
            {
                ExecutionId = request.ExecutionId,
                ActionId = request.ActionId,
                Status = ActionExecutionStatus.RUNNING
            };

            var delayMs = request.Timeout;
            if (request.Parameters?.ContainsKey("delayMs") == true)
            {
                if (int.TryParse(request.Parameters["delayMs"].ToString(), out var customDelay))
                {
                    delayMs = customDelay;
                }
            }

            await UpdateExecutionProgressAsync(request.ExecutionId, ActionExecutionStatus.RUNNING, 0, $"等待 {delayMs}ms...");

            try
            {
                await Task.Delay(delayMs, cancellationToken);
                
                result.Status = ActionExecutionStatus.COMPLETED;
                result.Success = true;
                result.ResultValue = $"延时等待 {delayMs}ms 完成";
            }
            catch (OperationCanceledException)
            {
                result.Status = ActionExecutionStatus.CANCELLED;
                result.Success = false;
                result.ErrorMessage = "延时等待被取消";
            }

            return result;
        }

        private async Task<ActionExecutionResult> ExecuteBarcodeScanAsync(ActionExecutionRequest request, ActionExecutionContext context, CancellationToken cancellationToken)
        {
            var result = new ActionExecutionResult
            {
                ExecutionId = request.ExecutionId,
                ActionId = request.ActionId,
                Status = ActionExecutionStatus.RUNNING
            };

            if (string.IsNullOrEmpty(request.DeviceId))
            {
                result.Status = ActionExecutionStatus.FAILED;
                result.Success = false;
                result.ErrorMessage = "扫码设备ID不能为空";
                return result;
            }

            await UpdateExecutionProgressAsync(request.ExecutionId, ActionExecutionStatus.RUNNING, 25, "初始化扫码设备...");

            // 模拟扫码操作（实际实现需要连接真实的扫码设备）
            var scanRequest = new BarcodeScanRequest
            {
                ExecutionId = request.ExecutionId,
                DeviceId = request.DeviceId,
                ExpectedPattern = request.ValidationRule,
                Timeout = request.Timeout
            };

            await UpdateExecutionProgressAsync(request.ExecutionId, ActionExecutionStatus.RUNNING, 50, "等待扫码...");

            // 这里应该调用实际的扫码设备驱动
            // 现在使用模拟数据
            await Task.Delay(2000, cancellationToken); // 模拟扫码时间

            var scanResult = new BarcodeScanResult
            {
                Success = true,
                BarcodeData = "TEST_BARCODE_" + DateTime.Now.Ticks,
                BarcodeType = "CODE128",
                DeviceId = request.DeviceId
            };

            if (scanResult.Success)
            {
                result.Status = ActionExecutionStatus.COMPLETED;
                result.Success = true;
                result.Result = scanResult;
                result.ResultValue = scanResult.BarcodeData;
            }
            else
            {
                result.Status = ActionExecutionStatus.FAILED;
                result.Success = false;
                result.ErrorMessage = "扫码失败";
            }

            return result;
        }

        private async Task<ActionExecutionResult> ExecuteCameraCheckAsync(ActionExecutionRequest request, ActionExecutionContext context, CancellationToken cancellationToken)
        {
            var result = new ActionExecutionResult
            {
                ExecutionId = request.ExecutionId,
                ActionId = request.ActionId,
                Status = ActionExecutionStatus.RUNNING
            };

            await UpdateExecutionProgressAsync(request.ExecutionId, ActionExecutionStatus.RUNNING, 25, "初始化相机设备...");

            // 模拟相机检测操作
            await Task.Delay(3000, cancellationToken); // 模拟检测时间

            await UpdateExecutionProgressAsync(request.ExecutionId, ActionExecutionStatus.RUNNING, 75, "分析检测结果...");

            var checkResult = new CameraCheckResult
            {
                Success = true,
                CheckPassed = true,
                ImagePath = $"/images/capture_{DateTime.Now:yyyyMMdd_HHmmss}.jpg",
                DetectionData = new Dictionary<string, object>
                {
                    { "quality_score", 0.95 },
                    { "defects_count", 0 },
                    { "dimensions", "100x50mm" }
                }
            };

            if (checkResult.Success && checkResult.CheckPassed)
            {
                result.Status = ActionExecutionStatus.COMPLETED;
                result.Success = true;
                result.Result = checkResult;
                result.ResultValue = "检测通过";
            }
            else
            {
                result.Status = ActionExecutionStatus.FAILED;
                result.Success = false;
                result.ErrorMessage = checkResult.ErrorMessage ?? "相机检测失败";
            }

            return result;
        }

        private async Task<ActionExecutionResult> ExecuteCustomScriptAsync(ActionExecutionRequest request, ActionExecutionContext context, CancellationToken cancellationToken)
        {
            var result = new ActionExecutionResult
            {
                ExecutionId = request.ExecutionId,
                ActionId = request.ActionId,
                Status = ActionExecutionStatus.RUNNING
            };

            await UpdateExecutionProgressAsync(request.ExecutionId, ActionExecutionStatus.RUNNING, 25, "准备执行自定义脚本...");

            // 从参数中获取脚本代码
            var scriptCode = request.Parameters?.GetValueOrDefault("scriptCode", "")?.ToString() ?? "";
            if (string.IsNullOrEmpty(scriptCode))
            {
                result.Status = ActionExecutionStatus.FAILED;
                result.Success = false;
                result.ErrorMessage = "脚本代码不能为空";
                return result;
            }

            await UpdateExecutionProgressAsync(request.ExecutionId, ActionExecutionStatus.RUNNING, 50, "执行脚本中...");

            try
            {
                // 这里应该实现脚本执行引擎
                // 现在只是模拟执行
                await Task.Delay(1000, cancellationToken);

                var scriptResult = new CustomScriptResult
                {
                    Success = true,
                    Result = "脚本执行成功",
                    Output = $"Script executed at {DateTime.Now}",
                    ExecutionTime = 1000
                };

                result.Status = ActionExecutionStatus.COMPLETED;
                result.Success = true;
                result.Result = scriptResult;
                result.ResultValue = scriptResult.Result?.ToString() ?? "";
            }
            catch (Exception ex)
            {
                result.Status = ActionExecutionStatus.FAILED;
                result.Success = false;
                result.ErrorMessage = $"脚本执行失败: {ex.Message}";
            }

            return result;
        }

        public async Task<BatchActionExecutionResult> ExecuteBatchActionsAsync(BatchActionExecutionRequest request)
        {
            var result = new BatchActionExecutionResult
            {
                BatchId = request.BatchId,
                StartTime = DateTime.UtcNow
            };

            _logger.LogInformation("开始执行批量Actions: BatchId: {BatchId}, 总数: {Count}, 顺序执行: {Sequential}", 
                request.BatchId, request.Actions.Count, request.SequentialExecution);

            try
            {
                if (request.SequentialExecution)
                {
                    // 顺序执行
                    foreach (var action in request.Actions)
                    {
                        var actionResult = await ExecuteActionAsync(action, request.Context);
                        result.Results.Add(actionResult);

                        if (actionResult.Success)
                        {
                            result.CompletedCount++;
                        }
                        else
                        {
                            result.FailedCount++;
                            if (request.StopOnFirstFailure)
                            {
                                result.ErrorMessage = $"Action {action.ActionCode} 执行失败，停止批量执行";
                                break;
                            }
                        }
                    }
                }
                else
                {
                    // 并行执行
                    var tasks = request.Actions.Select(action => ExecuteActionAsync(action, request.Context));
                    var results = await Task.WhenAll(tasks);
                    
                    result.Results.AddRange(results);
                    result.CompletedCount = results.Count(r => r.Success);
                    result.FailedCount = results.Count(r => !r.Success);
                }

                result.Success = result.FailedCount == 0;
                result.EndTime = DateTime.UtcNow;
                result.TotalDuration = (long)(result.EndTime.Value - result.StartTime).TotalMilliseconds;

                _logger.LogInformation("批量Actions执行完成: BatchId: {BatchId}, 成功: {Completed}, 失败: {Failed}, 耗时: {Duration}ms", 
                    request.BatchId, result.CompletedCount, result.FailedCount, result.TotalDuration);

                return result;
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.ErrorMessage = ex.Message;
                result.EndTime = DateTime.UtcNow;
                result.TotalDuration = (long)(result.EndTime.Value - result.StartTime).TotalMilliseconds;

                _logger.LogError(ex, "批量Actions执行异常: BatchId: {BatchId}", request.BatchId);
                return result;
            }
        }

        public async Task<ActionExecutionProgress> GetExecutionProgressAsync(string executionId)
        {
            _executionProgress.TryGetValue(executionId, out var progress);
            return progress ?? new ActionExecutionProgress 
            { 
                ExecutionId = executionId, 
                Status = ActionExecutionStatus.PENDING,
                Message = "执行状态未找到"
            };
        }

        public async Task<ActionExecutionStats> GetActionStatsAsync(string actionId)
        {
            var history = _executionHistory.Where(h => h.ActionId == actionId).ToList();
            
            return new ActionExecutionStats
            {
                ActionId = actionId,
                TotalExecutions = history.Count,
                SuccessfulExecutions = history.Count(h => h.Success),
                FailedExecutions = history.Count(h => !h.Success),
                AverageExecutionTime = history.Any() ? history.Average(h => h.Duration) : 0,
                MinExecutionTime = history.Any() ? history.Min(h => h.Duration) : 0,
                MaxExecutionTime = history.Any() ? history.Max(h => h.Duration) : 0,
                LastExecuted = history.Any() ? history.Max(h => h.EndTime ?? DateTime.MinValue) : DateTime.MinValue
            };
        }

        public async Task<bool> CancelExecutionAsync(string executionId)
        {
            if (_cancellationTokens.TryGetValue(executionId, out var cts))
            {
                cts.Cancel();
                await UpdateExecutionProgressAsync(executionId, ActionExecutionStatus.CANCELLED, 0, "执行已取消");
                _logger.LogInformation("Action执行已取消: ExecutionId: {ExecutionId}", executionId);
                return true;
            }
            return false;
        }

        public async Task<ManualConfirmationResponse> SubmitManualConfirmationAsync(ManualConfirmationResponse response)
        {
            // 这个方法将由外部调用来提交人工确认
            // 实际的实现可能需要使用事件或信号量来通知等待的执行线程
            return response;
        }

        public async Task<IEnumerable<ActionExecutionResult>> GetExecutionHistoryAsync(string actionId, int limit = 50)
        {
            return _executionHistory
                .Where(h => h.ActionId == actionId)
                .OrderByDescending(h => h.StartTime)
                .Take(limit);
        }

        private async Task UpdateExecutionProgressAsync(string executionId, ActionExecutionStatus status, int percentage, string message)
        {
            var progress = new ActionExecutionProgress
            {
                ExecutionId = executionId,
                Status = status,
                ProgressPercentage = percentage,
                Message = message,
                UpdateTime = DateTime.UtcNow
            };

            _executionProgress[executionId] = progress;
        }

        private async Task<ManualConfirmationResponse> WaitForManualConfirmationAsync(string executionId, CancellationToken cancellationToken)
        {
            // 这里应该实现等待人工确认的逻辑
            // 可以使用 TaskCompletionSource 来实现异步等待
            // 现在使用简单的轮询方式模拟
            
            var timeout = DateTime.UtcNow.AddMilliseconds(300000); // 5分钟超时
            
            while (DateTime.UtcNow < timeout && !cancellationToken.IsCancellationRequested)
            {
                // 检查是否有人工确认响应
                // 在实际实现中，这里应该监听WebSocket或其他实时通信
                await Task.Delay(1000, cancellationToken);
            }

            // 模拟用户确认
            return new ManualConfirmationResponse
            {
                ExecutionId = executionId,
                Confirmed = true,
                SelectedOption = "确认",
                UserId = "system"
            };
        }

        private async Task<DataValidationResult> ValidateDataAsync(DataValidationRequest request)
        {
            var result = new DataValidationResult();

            try
            {
                var value = request.Value?.ToString() ?? "";
                var rule = request.ValidationRule;

                if (string.IsNullOrEmpty(rule))
                {
                    result.IsValid = true;
                    result.ValidatedValue = value;
                    return result;
                }

                // 实现各种验证规则
                if (rule.StartsWith("regex:"))
                {
                    var pattern = rule.Substring(6);
                    var regex = new Regex(pattern);
                    result.IsValid = regex.IsMatch(value);
                    if (!result.IsValid)
                    {
                        result.ErrorMessage = $"值 '{value}' 不匹配正则表达式 '{pattern}'";
                    }
                }
                else if (rule.StartsWith("range:"))
                {
                    var rangeParts = rule.Substring(6).Split('-');
                    if (rangeParts.Length == 2 && 
                        double.TryParse(rangeParts[0], out var min) && 
                        double.TryParse(rangeParts[1], out var max) &&
                        double.TryParse(value, out var numValue))
                    {
                        result.IsValid = numValue >= min && numValue <= max;
                        if (!result.IsValid)
                        {
                            result.ErrorMessage = $"值 {numValue} 不在范围 [{min}, {max}] 内";
                        }
                    }
                    else
                    {
                        result.IsValid = false;
                        result.ErrorMessage = "无效的范围验证规则或数值格式";
                    }
                }
                else if (rule == "required")
                {
                    result.IsValid = !string.IsNullOrEmpty(value);
                    if (!result.IsValid)
                    {
                        result.ErrorMessage = "值不能为空";
                    }
                }
                else if (rule.StartsWith("equals:"))
                {
                    var expectedValue = rule.Substring(7);
                    result.IsValid = value.Equals(expectedValue, StringComparison.OrdinalIgnoreCase);
                    if (!result.IsValid)
                    {
                        result.ErrorMessage = $"值 '{value}' 不等于期望值 '{expectedValue}'";
                    }
                }

                if (result.IsValid)
                {
                    result.ValidatedValue = value;
                }
            }
            catch (Exception ex)
            {
                result.IsValid = false;
                result.ErrorMessage = $"验证过程中发生错误: {ex.Message}";
            }

            return result;
        }
    }
}