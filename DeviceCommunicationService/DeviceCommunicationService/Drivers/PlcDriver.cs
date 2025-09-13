using DeviceCommunicationService.Interfaces;
using DeviceCommunicationService.Models;
using System.Collections.Concurrent;
using HslCommunication.Profinet.Siemens;
using HslCommunication.Profinet.Melsec;
using HslCommunication.ModBus;
using HslCommunication;
using System.Text.Json;

namespace DeviceCommunicationService.Drivers
{
    // PLC驱动实现（简化版本，专注核心功能）
    public class PlcDriver : IDeviceDriver
    {
        private readonly ILogger<PlcDriver> _logger;
        private readonly ConcurrentDictionary<string, PlcDriverContext> _contexts;
        private readonly Timer _heartbeatTimer;

        public string DriverName => "PLC Driver";
        public DeviceType[] SupportedDeviceTypes => new[] { DeviceType.PLC };

        public PlcDriver(ILogger<PlcDriver> logger)
        {
            _logger = logger;
            _contexts = new ConcurrentDictionary<string, PlcDriverContext>();
            
            // 每5秒检查一次心跳
            _heartbeatTimer = new Timer(CheckHeartbeat, null, TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(5));
        }

        public ValidationResult ValidateConfig(DeviceConfig config)
        {
            var errors = new List<string>();

            if (config.DeviceType != DeviceType.PLC)
            {
                errors.Add("Device type must be PLC");
            }

            if (config.Connection?.Address == null)
            {
                errors.Add("Connection string is required");
            }

            // 为PLC连接参数提供默认值
            if (config.Connection?.Parameters == null)
            {
                config.Connection.Parameters = new Dictionary<string, object>();
            }

            // 根据端口自动设置PLC类型
            var port = config.Connection?.Port ?? 102;
            string plcType = "Siemens_S7";
            
            if (port == 6000)
            {
                plcType = "Mitsubishi_MC";
            }
            else if (port == 502)
            {
                plcType = "Modbus_TCP";
            }
            
            // 检查用户是否手动指定了PLC类型
            if (config.Connection.Parameters.TryGetValue("plcType", out var userPlcType))
            {
                plcType = userPlcType?.ToString() ?? plcType;
            }
            else
            {
                config.Connection.Parameters["plcType"] = plcType;
            }

            // 只对西门子PLC检查并设置rack和slot参数
            if (plcType.ToUpper().Contains("SIEMENS") || plcType.ToUpper().Contains("S7"))
            {
                if (!config.Connection.Parameters.ContainsKey("rack"))
                {
                    config.Connection.Parameters["rack"] = 0;
                }
                
                if (!config.Connection.Parameters.ContainsKey("slot"))
                {
                    config.Connection.Parameters["slot"] = 1;
                }
            }

            return errors.Any() ? ValidationResult.Failure(errors.ToArray()) : ValidationResult.Success();
        }

        public async Task<DeviceResponse> ConnectAsync(DeviceConfig config, CancellationToken cancellationToken = default)
        {
            try
            {
                // Check if simulation mode is explicitly enabled for this device
                // 不再自动将127.0.0.1视为模拟设备，因为可能是真实的本地PLC
                bool isSimulationMode = (config.Connection?.Parameters?.ContainsKey("simulation") == true && 
                                       config.Connection.Parameters["simulation"].ToString() == "true");

                if (isSimulationMode)
                {
                    _logger.LogInformation("Connecting to PLC device {DeviceId} in SIMULATION MODE at {Address}:{Port}", 
                        config.DeviceId, config.Connection?.Address, config.Connection?.Port);
                    
                    // Simulate successful connection for testing
                    await Task.Delay(500, cancellationToken); // Simulate connection delay
                    
                    // Create simulated connection context
                    var simulatedConnectionInfo = new DeviceConnectionInfo
                    {
                        DeviceId = config.DeviceId,
                        ConnectionType = ConnectionType.TCP,
                        Endpoint = $"{config.Connection?.Address}:{config.Connection?.Port} (SIMULATED)",
                        Parameters = new Dictionary<string,object> 
                        { 
                            { "mode", "simulation" },
                            { "plcType", "Simulated_PLC" }
                        },
                        KeepAlive = true,
                        HeartbeatInterval = 1000
                    };

                    _contexts[config.DeviceId] = new PlcDriverContext
                    {
                        DeviceId = config.DeviceId,
                        ConnectionInfo = simulatedConnectionInfo,
                        PlcClient = null, // No real client in simulation
                        PlcType = "Simulated_PLC",
                        IsConnected = true,
                        ConnectedTime = DateTime.UtcNow,
                        LastHeartbeat = DateTime.UtcNow,
                        TotalOperations = 0,
                        SuccessfulOperations = 0,
                        ErrorCount = 0
                    };

                    _logger.LogInformation("Successfully connected to SIMULATED PLC device {DeviceId}", config.DeviceId);
                    
                    return new DeviceResponse
                    {
                        Id = Guid.NewGuid().ToString(),
                        Success = true,
                        Data = "Connected to simulated device successfully",
                        Timestamp = DateTime.UtcNow
                    };
                }

                _logger.LogInformation("Connecting to PLC device {DeviceId} at {Address}:{Port}", 
                    config.DeviceId, config.Connection?.Address, config.Connection?.Port);

                // 解析PLC连接参数
                var ipAddress = config.Connection?.Address ?? "";
                var port = config.Connection?.Port ?? 102;
                
                // 获取PLC类型参数
                string plcType = "Siemens_S7"; // 默认西门子
                int rack = 0, slot = 1;
                
                // 根据端口自动检测协议类型
                if (port == 6000)
                {
                    plcType = "Mitsubishi_MC"; // 端口6000通常是三菱Q系列PLC
                }
                else if (port == 502)
                {
                    plcType = "Modbus_TCP"; // 标准Modbus TCP端口
                }
                
                if (config.Connection?.Parameters != null)
                {
                    if (config.Connection.Parameters.TryGetValue("plcType", out var plcTypeObj))
                    {
                        plcType = plcTypeObj?.ToString() ?? plcType;
                    }
                    
                    if (config.Connection.Parameters.TryGetValue("rack", out var rackObj))
                    {
                        if (rackObj is JsonElement rackElement && rackElement.ValueKind == JsonValueKind.Number)
                        {
                            rack = rackElement.GetInt32();
                        }
                        else
                        {
                            rack = Convert.ToInt32(rackObj.ToString());
                        }
                    }
                    if (config.Connection.Parameters.TryGetValue("slot", out var slotObj))
                    {
                        if (slotObj is JsonElement slotElement && slotElement.ValueKind == JsonValueKind.Number)
                        {
                            slot = slotElement.GetInt32();
                        }
                        else
                        {
                            slot = Convert.ToInt32(slotObj.ToString());
                        }
                    }
                }

                // 根据PLC类型创建连接
                object plcClient;
                OperateResult connectResult;
                
                switch (plcType.ToUpper())
                {
                    case "MITSUBISHI_MC":
                    case "MITSUBISHI":
                        var mitsubishiMc = new MelsecMcNet(ipAddress, port)
                        {
                            ConnectTimeOut = 3000 // Increased timeout for better network reliability
                        };
                        _logger.LogInformation("Attempting to connect to Mitsubishi PLC at {IpAddress}:{Port}", 
                            ipAddress, port);
                        connectResult = await mitsubishiMc.ConnectServerAsync();
                        plcClient = mitsubishiMc;
                        break;
                        
                    case "MODBUS_TCP":
                    case "MODBUS":
                        var modbusTcp = new ModbusTcpNet(ipAddress, port)
                        {
                            ConnectTimeOut = 3000 // Increased timeout for better network reliability
                        };
                        _logger.LogInformation("Attempting to connect to Modbus TCP device at {IpAddress}:{Port}", 
                            ipAddress, port);
                        connectResult = await modbusTcp.ConnectServerAsync();
                        plcClient = modbusTcp;
                        break;
                        
                    case "SIEMENS_S7":
                    case "SIEMENS":
                    default:
                        var siemensS7 = new SiemensS7Net(SiemensPLCS.S1500)
                        {
                            IpAddress = ipAddress,
                            Port = port,
                            Rack = (byte)rack,
                            Slot = (byte)slot,
                            ConnectTimeOut = 3000 // Increased timeout for better network reliability
                        };
                        _logger.LogInformation("Attempting to connect to Siemens PLC at {IpAddress}:{Port}, Rack={Rack}, Slot={Slot}", 
                            ipAddress, port, rack, slot);
                        connectResult = await siemensS7.ConnectServerAsync();
                        plcClient = siemensS7;
                        break;
                }
                
                if (!connectResult.IsSuccess)
                {
                    if (plcClient is IDisposable disposable)
                        disposable.Dispose();
                    return CreateErrorResponse(config.DeviceId, ErrorCodes.CONNECTION_FAILED.ToString(), 
                        $"Failed to connect to {plcType} PLC: {connectResult.Message}");
                }

                // 存储连接上下文
                var connectionInfo = new DeviceConnectionInfo
                {
                    DeviceId = config.DeviceId,
                    ConnectionType = ConnectionType.TCP,
                    Endpoint = $"{ipAddress}:{port}",
                    Parameters = new Dictionary<string, object> 
                    { 
                        { "plcType", plcType },
                        { "rack", rack }, 
                        { "slot", slot },
                        { "ipAddress", ipAddress },
                        { "port", port }
                    },
                    KeepAlive = true,
                    HeartbeatInterval = 1000
                };

                _contexts[config.DeviceId] = new PlcDriverContext
                {
                    DeviceId = config.DeviceId,
                    ConnectionInfo = connectionInfo,
                    PlcClient = plcClient,
                    PlcType = plcType,
                    IsConnected = true,
                    ConnectedTime = DateTime.UtcNow,
                    LastHeartbeat = DateTime.UtcNow,
                    TotalOperations = 0,
                    SuccessfulOperations = 0,
                    ErrorCount = 0
                };

                _logger.LogInformation("Successfully connected to PLC device {DeviceId}", config.DeviceId);
                
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
                _logger.LogError(ex, "Error connecting to PLC device {DeviceId}", config.DeviceId);
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
                    context.DisconnectPlc();
                    context.Dispose();
                    _logger.LogInformation("Disconnected from PLC device {DeviceId}", deviceId);
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
                _logger.LogError(ex, "Error disconnecting from PLC device {DeviceId}", deviceId);
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

                // Check if device is in simulation mode
                bool isSimulationMode = context.PlcType == "Simulated_PLC" || 
                                      (context.ConnectionInfo?.Parameters?.ContainsKey("mode") == true &&
                                       context.ConnectionInfo.Parameters["mode"].ToString() == "simulation");

                // 更新操作统计
                context.TotalOperations++;
                context.LastCommunication = DateTime.UtcNow;

                object? result = null;

                if (isSimulationMode)
                {
                    _logger.LogInformation("Executing {Operation} command on SIMULATED device {DeviceId}", command.Operation, deviceId);
                    
                    // Simulate operation delay
                    await Task.Delay(100, cancellationToken);
                    
                    switch (command.Operation)
                    {
                        case OperationType.READ:
                            // Simulate reading data
                            result = SimulateReadData(command);
                            break;
                        case OperationType.WRITE:
                            // Simulate writing data (always successful)
                            result = $"Simulated write to {command.Address} with value {command.Value}";
                            break;
                        default:
                            return CreateErrorResponse(deviceId, ErrorCodes.UNSUPPORTED_OPERATION.ToString(), "Unsupported operation in simulation mode");
                    }
                }
                else
                {
                    switch (command.Operation)
                    {
                        case OperationType.READ:
                            result = await ExecuteReadCommand(command, context);
                            break;
                        case OperationType.WRITE:
                            result = await ExecuteWriteCommand(command, context);
                            break;
                        default:
                            return CreateErrorResponse(deviceId, ErrorCodes.UNSUPPORTED_OPERATION.ToString(), "Unsupported operation");
                    }
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

        /// <summary>
        /// Simulate reading data from a PLC device for testing
        /// </summary>
        private object SimulateReadData(DeviceCommand command)
        {
            // Simulate different data types
            var address = command.Address?.ToUpper() ?? "";
            var dataType = command.DataType;
            
            // Simulate different PLC memory areas
            if (address.StartsWith("DB") || address.StartsWith("M"))
            {
                // Data block or memory area - return simulated values
                switch (dataType)
                {
                    case DataType.BOOL:
                        return true; // Simulate boolean value
                    case DataType.INT:
                        return new Random().Next(0, 100); // Simulate integer 0-99
                    case DataType.DINT:
                        return new Random().Next(0, 1000); // Simulate double integer
                    case DataType.REAL:
                        return Math.Round(new Random().NextDouble() * 100, 2); // Simulate float
                    case DataType.STRING:
                        return $"Simulated_{address}"; // Simulate string
                    default:
                        return $"Simulated_{dataType}_data";
                }
            }
            else if (address.StartsWith("I"))
            {
                // Input area - simulate input signals
                return address.EndsWith("0") ? false : true; // Alternate true/false
            }
            else if (address.StartsWith("Q"))
            {
                // Output area - simulate output status
                return true;
            }
            
            // Default simulation
            return $"Simulated_{dataType}_value_for_{address}";
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

            // Check if device is in simulation mode
            bool isSimulationMode = context.PlcType == "Simulated_PLC" || 
                                  (context.ConnectionInfo?.Parameters?.ContainsKey("mode") == true &&
                                   context.ConnectionInfo.Parameters["mode"].ToString() == "simulation");

            var metadata = new Dictionary<string, object>
            {
                { "totalOperations", context.TotalOperations },
                { "successfulOperations", context.SuccessfulOperations },
                { "errorCount", context.ErrorCount },
                { "successRate", successRate },
                { "avgResponseTime", context.AvgResponseTime },
                { "maxResponseTime", context.MaxResponseTime },
                { "minResponseTime", context.MinResponseTime }
            };

            if (isSimulationMode)
            {
                metadata["mode"] = "simulation";
                metadata["plcType"] = "Simulated_PLC";
            }

            return await Task.FromResult(new DeviceStatusInfo
            {
                DeviceId = deviceId,
                Status = context.IsConnected ? DeviceStatus.ONLINE : DeviceStatus.DISCONNECTED,
                LastHeartbeat = context.LastHeartbeat,
                LastConnected = context.ConnectedTime,
                ConnectionTime = context.ConnectedTime,
                LastUpdated = context.LastCommunication,
                Metadata = metadata
            });
        }

        public bool IsConnected(string deviceId)
        {
            return _contexts.TryGetValue(deviceId, out var context) && context.IsConnected;
        }

        public async Task DisposeAsync()
        {
            _heartbeatTimer?.Dispose();
            
            // 断开所有PLC连接
            foreach (var context in _contexts.Values)
            {
                try
                {
                    context.Dispose();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error disposing PLC context for device {DeviceId}", context.DeviceId);
                }
            }
            
            _contexts.Clear();
            await Task.CompletedTask;
        }

        private async Task<object?> ExecuteReadCommand(DeviceCommand command, PlcDriverContext context)
        {
            var address = command.Address ?? command.Target;
            var dataType = command.DataType ?? DataType.BOOL;
            
            if (context.PlcClient == null)
            {
                throw new InvalidOperationException("PLC client is not connected");
            }

            _logger.LogInformation("Reading {PlcType} PLC address {Address} with data type {DataType}", 
                context.PlcType, address, dataType);
            
            // 根据PLC类型执行读取操作
            object? value = null;

            switch (context.PlcType.ToUpper())
            {
                case "MITSUBISHI_MC":
                case "MITSUBISHI":
                    value = await ExecuteMitsubishiRead(address, dataType, (MelsecMcNet)context.PlcClient);
                    break;
                    
                case "MODBUS_TCP":
                case "MODBUS":
                    value = await ExecuteModbusRead(address, dataType, (ModbusTcpNet)context.PlcClient);
                    break;
                    
                case "SIEMENS_S7":
                case "SIEMENS":
                default:
                    value = await ExecuteSiemensRead(address, dataType, (SiemensS7Net)context.PlcClient);
                    break;
            }

            _logger.LogInformation("Successfully read {PlcType} PLC address {Address}: {Value}", 
                context.PlcType, address, value);
            return value;
        }
        
        private async Task<object?> ExecuteSiemensRead(string address, DataType dataType, SiemensS7Net client)
        {
            switch (dataType)
            {
                case DataType.BOOL:
                    var boolResult = await client.ReadBoolAsync(address);
                    if (!boolResult.IsSuccess)
                        throw new Exception($"Siemens PLC read failed: {boolResult.Message}");
                    return boolResult.Content;

                case DataType.INT:
                    var intResult = await client.ReadInt16Async(address);
                    if (!intResult.IsSuccess)
                        throw new Exception($"Siemens PLC read failed: {intResult.Message}");
                    return intResult.Content;

                case DataType.DINT:
                    var dintResult = await client.ReadInt32Async(address);
                    if (!dintResult.IsSuccess)
                        throw new Exception($"Siemens PLC read failed: {dintResult.Message}");
                    return dintResult.Content;

                case DataType.REAL:
                    var realResult = await client.ReadFloatAsync(address);
                    if (!realResult.IsSuccess)
                        throw new Exception($"Siemens PLC read failed: {realResult.Message}");
                    return realResult.Content;

                case DataType.STRING:
                    var stringResult = await client.ReadStringAsync(address);
                    if (!stringResult.IsSuccess)
                        throw new Exception($"Siemens PLC read failed: {stringResult.Message}");
                    return stringResult.Content;

                default:
                    throw new ArgumentException($"Unsupported data type for Siemens: {dataType}");
            }
        }
        
        private async Task<object?> ExecuteMitsubishiRead(string address, DataType dataType, MelsecMcNet client)
        {
            switch (dataType)
            {
                case DataType.BOOL:
                    var boolResult = await client.ReadBoolAsync(address);
                    if (!boolResult.IsSuccess)
                        throw new Exception($"Mitsubishi PLC read failed: {boolResult.Message}");
                    return boolResult.Content;

                case DataType.INT:
                    var intResult = await client.ReadInt16Async(address);
                    if (!intResult.IsSuccess)
                        throw new Exception($"Mitsubishi PLC read failed: {intResult.Message}");
                    return intResult.Content;

                case DataType.DINT:
                    var dintResult = await client.ReadInt32Async(address);
                    if (!dintResult.IsSuccess)
                        throw new Exception($"Mitsubishi PLC read failed: {dintResult.Message}");
                    return dintResult.Content;

                case DataType.REAL:
                case DataType.FLOAT:
                    var realResult = await client.ReadFloatAsync(address);
                    if (!realResult.IsSuccess)
                        throw new Exception($"Mitsubishi PLC read failed: {realResult.Message}");
                    return realResult.Content;

                case DataType.STRING:
                    var stringResult = await client.ReadStringAsync(address, 10); // 指定长度
                    if (!stringResult.IsSuccess)
                        throw new Exception($"Mitsubishi PLC read failed: {stringResult.Message}");
                    return stringResult.Content;

                default:
                    throw new ArgumentException($"Unsupported data type for Mitsubishi: {dataType}");
            }
        }
        
        private async Task<object?> ExecuteModbusRead(string address, DataType dataType, ModbusTcpNet client)
        {
            // Modbus地址解析：通常格式为寄存器类型+地址，如"40001"表示保持寄存器1
            var parsedAddress = ParseModbusAddress(address);
            
            switch (dataType)
            {
                case DataType.BOOL:
                    var boolResult = await client.ReadCoilAsync(parsedAddress);
                    if (!boolResult.IsSuccess)
                        throw new Exception($"Modbus read failed: {boolResult.Message}");
                    return boolResult.Content;

                case DataType.INT:
                    var intResult = await client.ReadInt16Async(parsedAddress);
                    if (!intResult.IsSuccess)
                        throw new Exception($"Modbus read failed: {intResult.Message}");
                    return intResult.Content;

                case DataType.DINT:
                    var dintResult = await client.ReadInt32Async(parsedAddress);
                    if (!dintResult.IsSuccess)
                        throw new Exception($"Modbus read failed: {dintResult.Message}");
                    return dintResult.Content;

                case DataType.REAL:
                case DataType.FLOAT:
                    var realResult = await client.ReadFloatAsync(parsedAddress);
                    if (!realResult.IsSuccess)
                        throw new Exception($"Modbus read failed: {realResult.Message}");
                    return realResult.Content;

                default:
                    throw new ArgumentException($"Unsupported data type for Modbus: {dataType}");
            }
        }
        
        private string ParseModbusAddress(string address)
        {
            // 简单的Modbus地址解析，可以根据需要扩展
            if (address.StartsWith("4") && address.Length > 1)
            {
                // 保持寄存器：40001 -> 0
                return (int.Parse(address) - 40001).ToString();
            }
            if (address.StartsWith("3") && address.Length > 1)
            {
                // 输入寄存器：30001 -> 0
                return (int.Parse(address) - 30001).ToString();
            }
            return address; // 直接返回原地址
        }

        private async Task<object?> ExecuteWriteCommand(DeviceCommand command, PlcDriverContext context)
        {
            if (command.Value == null && command.Data == null)
                throw new ArgumentException("Write command requires a value");

            var value = command.Value ?? command.Data;
            var address = command.Address ?? command.Target;
            var dataType = command.DataType ?? DataType.BOOL;

            if (context.PlcClient == null)
            {
                throw new InvalidOperationException("PLC client is not connected");
            }
            
            _logger.LogInformation("Writing value {Value} to {PlcType} PLC address {Address} with data type {DataType}", 
                value, context.PlcType, address, dataType);

            // 根据PLC类型执行写入操作
            OperateResult result;

            switch (context.PlcType.ToUpper())
            {
                case "MITSUBISHI_MC":
                case "MITSUBISHI":
                    result = await ExecuteMitsubishiWrite(address, dataType, value, (MelsecMcNet)context.PlcClient);
                    break;
                    
                case "MODBUS_TCP":
                case "MODBUS":
                    result = await ExecuteModbusWrite(address, dataType, value, (ModbusTcpNet)context.PlcClient);
                    break;
                    
                case "SIEMENS_S7":
                case "SIEMENS":
                default:
                    result = await ExecuteSiemensWrite(address, dataType, value, (SiemensS7Net)context.PlcClient);
                    break;
            }

            if (!result.IsSuccess)
            {
                throw new Exception($"{context.PlcType} PLC write failed: {result.Message}");
            }

            _logger.LogInformation("Successfully wrote value {Value} to {PlcType} PLC address {Address}", 
                value, context.PlcType, address);
            return value;
        }
        
        // 辅助方法：安全地从JsonElement或其他类型中提取值
        private T ExtractValue<T>(object? value)
        {
            if (value == null)
                return default(T)!;
                
            if (value is JsonElement jsonElement)
            {
                return JsonSerializer.Deserialize<T>(jsonElement.GetRawText());
            }
            
            if (value is T directValue)
                return directValue;
                
            return (T)Convert.ChangeType(value, typeof(T));
        }
        
        private async Task<OperateResult> ExecuteSiemensWrite(string address, DataType dataType, object? value, SiemensS7Net client)
        {
            switch (dataType)
            {
                case DataType.BOOL:
                    var boolValue = ExtractValue<bool>(value);
                    return await client.WriteAsync(address, boolValue);

                case DataType.INT:
                    var intValue = ExtractValue<short>(value);
                    return await client.WriteAsync(address, intValue);

                case DataType.DINT:
                    var dintValue = ExtractValue<int>(value);
                    return await client.WriteAsync(address, dintValue);

                case DataType.REAL:
                    var realValue = ExtractValue<float>(value);
                    return await client.WriteAsync(address, realValue);

                case DataType.STRING:
                    var stringValue = ExtractValue<string>(value) ?? "";
                    return await client.WriteAsync(address, stringValue);

                default:
                    throw new ArgumentException($"Unsupported data type for Siemens: {dataType}");
            }
        }
        
        private async Task<OperateResult> ExecuteMitsubishiWrite(string address, DataType dataType, object? value, MelsecMcNet client)
        {
            switch (dataType)
            {
                case DataType.BOOL:
                    var boolValue = ExtractValue<bool>(value);
                    
                    _logger.LogInformation("Writing bool value {Value} to Mitsubishi address {Address}", boolValue, address);
                    
                    // 尝试使用WriteAsync而不是WriteBoolAsync
                    // 因为ReadAsync能成功，WriteAsync可能也能成功处理相同的地址格式
                    try
                    {
                        return await client.WriteAsync(address, boolValue);
                    }
                    catch (Exception ex1)
                    {
                        _logger.LogWarning("WriteAsync failed for {Address}: {Error}, trying WriteAsync with boolean", address, ex1.Message);
                        // 如果WriteAsync失败，尝试使用另一种方式写入布尔值
                        try
                        {
                            return await client.WriteAsync(address, new bool[] { boolValue });
                        }
                        catch (Exception ex2)
                        {
                            _logger.LogError("Both WriteAsync methods failed for {Address}. WriteAsync: {Error1}, WriteAsync array: {Error2}", 
                                address, ex1.Message, ex2.Message);
                            throw new Exception($"Mitsubishi PLC write failed. WriteAsync error: {ex1.Message}, WriteAsync array error: {ex2.Message}");
                        }
                    }

                case DataType.INT:
                    var intValue = ExtractValue<short>(value);
                    return await client.WriteAsync(address, intValue);

                case DataType.DINT:
                    var dintValue = ExtractValue<int>(value);
                    return await client.WriteAsync(address, dintValue);

                case DataType.REAL:
                case DataType.FLOAT:
                    var realValue = ExtractValue<float>(value);
                    return await client.WriteAsync(address, realValue);

                case DataType.STRING:
                    var stringValue = ExtractValue<string>(value) ?? "";
                    return await client.WriteAsync(address, stringValue);

                default:
                    throw new ArgumentException($"Unsupported data type for Mitsubishi: {dataType}");
            }
        }
        
        private async Task<OperateResult> ExecuteModbusWrite(string address, DataType dataType, object? value, ModbusTcpNet client)
        {
            var parsedAddress = ParseModbusAddress(address);
            
            switch (dataType)
            {
                case DataType.BOOL:
                    var boolValue = Convert.ToBoolean(value);
                    return await client.WriteAsync(parsedAddress, boolValue);

                case DataType.INT:
                    var intValue = Convert.ToInt16(value);
                    return await client.WriteAsync(parsedAddress, intValue);

                case DataType.DINT:
                    var dintValue = Convert.ToInt32(value);
                    return await client.WriteAsync(parsedAddress, dintValue);

                case DataType.REAL:
                case DataType.FLOAT:
                    var realValue = Convert.ToSingle(value);
                    return await client.WriteAsync(parsedAddress, realValue);

                default:
                    throw new ArgumentException($"Unsupported data type for Modbus: {dataType}");
            }
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

                try
                {
                    // 检查PLC连接状态
                    if (context.PlcClient != null)
                    {
                        // 根据PLC类型执行心跳检查
                        var heartbeatTask = Task.Run(async () =>
                        {
                            try
                            {
                                return await context.CheckConnection();
                            }
                            catch
                            {
                                return false;
                            }
                        });

                        // 等待最多1秒
                        var isHealthy = heartbeatTask.Wait(1000) && heartbeatTask.Result;
                        
                        if (isHealthy)
                        {
                            context.LastHeartbeat = now;
                        }
                        else
                        {
                            // 心跳失败，标记为离线
                            context.IsConnected = false;
                            _logger.LogWarning("Device {DeviceId} ({PlcType}) heartbeat failed - connection unhealthy", 
                                context.DeviceId, context.PlcType);
                        }
                    }
                    else
                    {
                        // 连接已断开
                        context.IsConnected = false;
                        _logger.LogWarning("Device {DeviceId} connection is closed", context.DeviceId);
                    }
                }
                catch (Exception ex)
                {
                    // 心跳检查异常，标记为离线
                    context.IsConnected = false;
                    _logger.LogWarning(ex, "Device {DeviceId} heartbeat check failed", context.DeviceId);
                }
            }
        }
    }

    // PLC驱动上下文
    internal class PlcDriverContext
    {
        public string DeviceId { get; set; } = string.Empty;
        public DeviceConnectionInfo ConnectionInfo { get; set; } = new();
        public PlcParameters PlcParameters { get; set; } = new();
        public object? PlcClient { get; set; }
        public string PlcType { get; set; } = "Siemens_S7";
        public bool IsConnected { get; set; }
        public DateTime ConnectedTime { get; set; }
        public DateTime LastHeartbeat { get; set; }
        public DateTime? LastCommunication { get; set; }
        public long TotalOperations { get; set; }
        public long SuccessfulOperations { get; set; }
        public int ErrorCount { get; set; }
        public double AvgResponseTime { get; set; }
        public double MaxResponseTime { get; set; }
        public double MinResponseTime { get; set; } = double.MaxValue;
        
        public async Task<bool> CheckConnection()
        {
            if (PlcClient == null) return false;
            
            switch (PlcType.ToUpper())
            {
                case "MITSUBISHI_MC":
                case "MITSUBISHI":
                    if (PlcClient is MelsecMcNet mitsubishi)
                    {
                        var result = await mitsubishi.ReadBoolAsync("M0");
                        return result.IsSuccess;
                    }
                    break;
                    
                case "MODBUS_TCP":
                case "MODBUS":
                    if (PlcClient is ModbusTcpNet modbus)
                    {
                        var result = await modbus.ReadCoilAsync("0");
                        return result.IsSuccess;
                    }
                    break;
                    
                case "SIEMENS_S7":
                case "SIEMENS":
                default:
                    if (PlcClient is SiemensS7Net siemens)
                    {
                        var result = await siemens.ReadBoolAsync("M0.0");
                        return result.IsSuccess;
                    }
                    break;
            }
            
            return false;
        }
        
        public void DisconnectPlc()
        {
            switch (PlcClient)
            {
                case SiemensS7Net siemens:
                    siemens.ConnectClose();
                    break;
                case MelsecMcNet mitsubishi:
                    mitsubishi.ConnectClose();
                    break;
                case ModbusTcpNet modbus:
                    modbus.ConnectClose();
                    break;
            }
        }
        
        public void Dispose()
        {
            DisconnectPlc();
            if (PlcClient is IDisposable disposable)
            {
                disposable.Dispose();
            }
        }
    }
}