using DeviceCommunicationService.Interfaces;
using DeviceCommunicationService.Models;
using System.Collections.Concurrent;

namespace DeviceCommunicationService.Services
{
    public class ActionExecutionEngine : IActionExecutionEngine
    {
        private readonly ILogger<ActionExecutionEngine> _logger;
        private readonly IDeviceManager _deviceManager;
        private readonly IManualConfirmationManager _confirmationManager;
        private readonly IActionExecutionLogger _executionLogger;
        private readonly ConcurrentDictionary<ActionType, IActionExecutor> _executors = new();
        private readonly ConcurrentDictionary<string, ActionExecutionResult> _executionResults = new();
        private readonly ConcurrentDictionary<string, ActionExecutionProgress> _executionProgress = new();
        private readonly ConcurrentDictionary<string, CancellationTokenSource> _cancellationTokens = new();

        public ActionExecutionEngine(
            ILogger<ActionExecutionEngine> logger,
            IDeviceManager deviceManager,
            IManualConfirmationManager confirmationManager,
            IActionExecutionLogger executionLogger)
        {
            _logger = logger;
            _deviceManager = deviceManager;
            _confirmationManager = confirmationManager;
            _executionLogger = executionLogger;
        }

        public void RegisterExecutor(IActionExecutor executor)
        {
            foreach (var actionType in executor.SupportedActionTypes)
            {
                _executors.TryAdd(actionType, executor);
                _logger.LogInformation("Registered executor for action type {ActionType}", actionType);
            }
        }

        public async Task<ActionExecutionResult> ExecuteActionAsync(ActionExecutionRequest request, ActionExecutionContext context)
        {
            var executionId = request.ExecutionId;
            var startTime = DateTime.UtcNow;

            try
            {
                // 记录执行开始
                await _executionLogger.LogExecutionStartAsync(request, context);

                // 更新执行进度
                await UpdateProgressAsync(executionId, ActionExecutionStatus.RUNNING, 0, "开始执行Action");

                // 获取对应的执行器
                if (!_executors.TryGetValue(request.Type, out var executor))
                {
                    var errorMessage = $"No executor found for action type {request.Type}";
                    return await CreateFailedResult(request, startTime, errorMessage);
                }

                // 验证参数
                var validation = executor.ValidateParameters(request);
                if (!validation.IsValid)
                {
                    var errorMessage = $"Invalid parameters: {string.Join(", ", validation.Errors)}";
                    return await CreateFailedResult(request, startTime, errorMessage);
                }

                // 创建取消令牌
                var cts = new CancellationTokenSource(request.Timeout);
                _cancellationTokens.TryAdd(executionId, cts);
                context.CancellationToken = cts.Token;

                // 执行Action（支持重试）
                ActionExecutionResult result = null;
                var retryCount = 0;
                var maxRetries = request.RetryCount;

                do
                {
                    try
                    {
                        await UpdateProgressAsync(executionId, ActionExecutionStatus.RUNNING, 20, 
                            retryCount > 0 ? $"重试执行 (第{retryCount}次)" : "正在执行");

                        result = await executor.ExecuteAsync(request, context);
                        result.RetryAttempts = retryCount;

                        if (result.Success)
                        {
                            break;
                        }
                        
                        retryCount++;
                        if (retryCount <= maxRetries)
                        {
                            _logger.LogWarning("Action {ActionCode} failed, retrying {RetryCount}/{MaxRetries}", 
                                request.ActionCode, retryCount, maxRetries);
                            
                            await UpdateProgressAsync(executionId, ActionExecutionStatus.RETRYING, 
                                10 + (retryCount * 10), $"重试中 ({retryCount}/{maxRetries})");
                            
                            await Task.Delay(1000 * retryCount, context.CancellationToken); // 递增延迟
                        }
                    }
                    catch (OperationCanceledException)
                    {
                        result = await CreateCancelledResult(request, startTime);
                        break;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error executing action {ActionCode}, attempt {RetryCount}", 
                            request.ActionCode, retryCount + 1);
                        
                        if (retryCount >= maxRetries)
                        {
                            result = await CreateFailedResult(request, startTime, ex.Message);
                            break;
                        }
                        
                        retryCount++;
                        if (retryCount <= maxRetries)
                        {
                            await Task.Delay(1000 * retryCount, context.CancellationToken);
                        }
                    }
                } while (retryCount <= maxRetries);

                // 计算总执行时间
                result.Duration = (long)(DateTime.UtcNow - startTime).TotalMilliseconds;
                result.EndTime = DateTime.UtcNow;

                // 更新最终状态
                var finalStatus = result.Success ? ActionExecutionStatus.COMPLETED : ActionExecutionStatus.FAILED;
                await UpdateProgressAsync(executionId, finalStatus, 100, 
                    result.Success ? "执行完成" : result.ErrorMessage ?? "执行失败");

                // 存储结果
                _executionResults.TryAdd(executionId, result);

                // 记录执行结果
                await _executionLogger.LogExecutionResultAsync(result);

                // 清理资源
                _cancellationTokens.TryRemove(executionId, out var removedCts);
                removedCts?.Dispose();

                _logger.LogInformation("Action {ActionCode} execution completed. Success: {Success}, Duration: {Duration}ms",
                    request.ActionCode, result.Success, result.Duration);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error executing action {ActionCode}", request.ActionCode);
                return await CreateFailedResult(request, startTime, ex.Message);
            }
        }

        public async Task<BatchActionExecutionResult> ExecuteBatchActionsAsync(BatchActionExecutionRequest request)
        {
            var batchId = request.BatchId;
            var startTime = DateTime.UtcNow;
            var results = new List<ActionExecutionResult>();
            var completedCount = 0;
            var failedCount = 0;

            _logger.LogInformation("Starting batch execution {BatchId} with {ActionCount} actions", 
                batchId, request.Actions.Count);

            try
            {
                if (request.SequentialExecution)
                {
                    // 顺序执行
                    foreach (var action in request.Actions.OrderBy(a => a.Sequence))
                    {
                        var result = await ExecuteActionAsync(action, request.Context);
                        results.Add(result);

                        if (result.Success)
                        {
                            completedCount++;
                        }
                        else
                        {
                            failedCount++;
                            if (request.StopOnFirstFailure)
                            {
                                _logger.LogWarning("Stopping batch execution {BatchId} due to first failure in action {ActionCode}",
                                    batchId, action.ActionCode);
                                break;
                            }
                        }
                    }
                }
                else
                {
                    // 并行执行
                    var tasks = request.Actions.Select(action => ExecuteActionAsync(action, request.Context));
                    var parallelResults = await Task.WhenAll(tasks);
                    results.AddRange(parallelResults);

                    completedCount = results.Count(r => r.Success);
                    failedCount = results.Count(r => !r.Success);
                }

                var totalDuration = (long)(DateTime.UtcNow - startTime).TotalMilliseconds;
                var success = request.StopOnFirstFailure ? failedCount == 0 : completedCount > 0;

                var batchResult = new BatchActionExecutionResult
                {
                    BatchId = batchId,
                    Success = success,
                    Results = results,
                    TotalDuration = totalDuration,
                    StartTime = startTime,
                    EndTime = DateTime.UtcNow,
                    CompletedCount = completedCount,
                    FailedCount = failedCount,
                    ErrorMessage = success ? null : $"{failedCount} actions failed"
                };

                _logger.LogInformation("Batch execution {BatchId} completed. Success: {Success}, Completed: {Completed}, Failed: {Failed}",
                    batchId, success, completedCount, failedCount);

                return batchResult;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in batch execution {BatchId}", batchId);
                
                return new BatchActionExecutionResult
                {
                    BatchId = batchId,
                    Success = false,
                    Results = results,
                    TotalDuration = (long)(DateTime.UtcNow - startTime).TotalMilliseconds,
                    StartTime = startTime,
                    EndTime = DateTime.UtcNow,
                    CompletedCount = completedCount,
                    FailedCount = failedCount + 1,
                    ErrorMessage = ex.Message
                };
            }
        }

        public async Task<bool> CancelActionAsync(string executionId)
        {
            try
            {
                if (_cancellationTokens.TryGetValue(executionId, out var cts))
                {
                    cts.Cancel();
                    await UpdateProgressAsync(executionId, ActionExecutionStatus.CANCELLED, 0, "执行已取消");
                    
                    _logger.LogInformation("Action execution {ExecutionId} cancelled", executionId);
                    return true;
                }

                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cancelling action execution {ExecutionId}", executionId);
                return false;
            }
        }

        public Task<ActionExecutionProgress?> GetExecutionProgressAsync(string executionId)
        {
            _executionProgress.TryGetValue(executionId, out var progress);
            return Task.FromResult(progress);
        }

        public Task<ActionExecutionResult?> GetExecutionResultAsync(string executionId)
        {
            _executionResults.TryGetValue(executionId, out var result);
            return Task.FromResult(result);
        }

        public Task<List<ActionExecutionProgress>> GetActiveExecutionsAsync(string? workstationId = null)
        {
            var activeExecutions = _executionProgress.Values
                .Where(p => p.Status == ActionExecutionStatus.RUNNING || 
                           p.Status == ActionExecutionStatus.WAITING_INPUT ||
                           p.Status == ActionExecutionStatus.RETRYING)
                .ToList();

            return Task.FromResult(activeExecutions);
        }

        public async Task<ActionExecutionStats?> GetActionStatsAsync(string actionId)
        {
            var allStats = await _executionLogger.GetExecutionStatsAsync();
            return allStats.Values.FirstOrDefault();
        }

        public async Task<bool> RespondToManualConfirmationAsync(ManualConfirmationResponse response)
        {
            return await _confirmationManager.RespondToConfirmationAsync(response);
        }

        private async Task<ActionExecutionResult> CreateFailedResult(ActionExecutionRequest request, DateTime startTime, string errorMessage)
        {
            var result = new ActionExecutionResult
            {
                ExecutionId = request.ExecutionId,
                ActionId = request.ActionId,
                Status = ActionExecutionStatus.FAILED,
                Success = false,
                StartTime = startTime,
                EndTime = DateTime.UtcNow,
                Duration = (long)(DateTime.UtcNow - startTime).TotalMilliseconds,
                ErrorMessage = errorMessage
            };

            await UpdateProgressAsync(request.ExecutionId, ActionExecutionStatus.FAILED, 0, errorMessage);
            _executionResults.TryAdd(request.ExecutionId, result);
            await _executionLogger.LogExecutionResultAsync(result);

            return result;
        }

        private async Task<ActionExecutionResult> CreateCancelledResult(ActionExecutionRequest request, DateTime startTime)
        {
            var result = new ActionExecutionResult
            {
                ExecutionId = request.ExecutionId,
                ActionId = request.ActionId,
                Status = ActionExecutionStatus.CANCELLED,
                Success = false,
                StartTime = startTime,
                EndTime = DateTime.UtcNow,
                Duration = (long)(DateTime.UtcNow - startTime).TotalMilliseconds,
                ErrorMessage = "执行已取消"
            };

            await UpdateProgressAsync(request.ExecutionId, ActionExecutionStatus.CANCELLED, 0, "执行已取消");
            _executionResults.TryAdd(request.ExecutionId, result);
            await _executionLogger.LogExecutionResultAsync(result);

            return result;
        }

        private async Task UpdateProgressAsync(string executionId, ActionExecutionStatus status, int percentage, string? message)
        {
            var progress = new ActionExecutionProgress
            {
                ExecutionId = executionId,
                Status = status,
                ProgressPercentage = percentage,
                Message = message,
                UpdateTime = DateTime.UtcNow
            };

            _executionProgress.AddOrUpdate(executionId, progress, (key, oldValue) => progress);
            await _executionLogger.LogExecutionProgressAsync(progress);
        }
    }
}