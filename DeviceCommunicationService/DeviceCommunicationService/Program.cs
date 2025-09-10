using DeviceCommunicationService.Interfaces;
using DeviceCommunicationService.Services;
using DeviceCommunicationService.Drivers;
using DeviceCommunicationService.Models;
using Serilog;
using System.Net.WebSockets;
using DeviceWebSocketManager = DeviceCommunicationService.Services.WebSocketManager;

var builder = WebApplication.CreateBuilder(args);

// 配置 Serilog
builder.Host.UseSerilog((context, configuration) =>
    configuration.ReadFrom.Configuration(context.Configuration));

// 添加服务到容器
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 注册设备驱动
builder.Services.AddSingleton<PlcDriver>();
builder.Services.AddSingleton<ScannerDriver>();

// 注册HTTP客户端 - 用于与前台API通信
builder.Services.AddHttpClient<IDeviceConfigSyncService, DeviceConfigSyncService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
    client.DefaultRequestHeaders.Add("User-Agent", "SimpleMES-DeviceCommunicationService/1.0");
    client.DefaultRequestHeaders.Add("Accept", "application/json");
})
.ConfigurePrimaryHttpMessageHandler(() => 
{
    // 创建自定义代理配置，明确绕过localhost
    var proxy = new System.Net.WebProxy();
    proxy.BypassProxyOnLocal = true;
    proxy.BypassList = new string[] { "localhost", "127.0.0.1", "::1" };
    
    return new HttpClientHandler
    {
        Proxy = proxy,  // 使用自定义代理配置
        UseProxy = true,  // 启用代理以便使用BypassProxyOnLocal
        UseDefaultCredentials = false,
        ServerCertificateCustomValidationCallback = (sender, certificate, chain, sslPolicyErrors) => true,
        MaxConnectionsPerServer = 5,
        PreAuthenticate = false,
        UseCookies = false
    };
})
.SetHandlerLifetime(TimeSpan.FromMinutes(5));

// 注册自定义服务
builder.Services.AddHttpClient<WorkstationDeviceManager>();
// 只注册一次DeviceManager，确保所有组件使用同一个实例
builder.Services.AddSingleton<DeviceManager>();
builder.Services.AddSingleton<IDeviceManager>(provider => provider.GetRequiredService<DeviceManager>());
builder.Services.AddSingleton<IWorkstationDeviceManager, WorkstationDeviceManager>();
builder.Services.AddSingleton<DeviceWebSocketManager>();
builder.Services.AddSingleton<IWebSocketManager>(provider => provider.GetService<DeviceWebSocketManager>()!);

// 注册PLC模拟器（开发环境用）
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddHostedService<PlcSimulator>();
    builder.Services.Configure<PlcSimulatorOptions>(builder.Configuration.GetSection("PlcSimulator"));
}

// 配置 CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// 配置 JSON 选项
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNameCaseInsensitive = true;
    options.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
});

var app = builder.Build();

// 在应用启动时注册驱动到DeviceManager
var plcDriver = app.Services.GetRequiredService<PlcDriver>();
var scannerDriver = app.Services.GetRequiredService<ScannerDriver>();

var deviceManager = app.Services.GetRequiredService<DeviceManager>();
deviceManager.RegisterDriver(plcDriver);
deviceManager.RegisterDriver(scannerDriver);

app.Logger.LogInformation("Registered PLC Driver for device types: {DeviceTypes}", string.Join(", ", plcDriver.SupportedDeviceTypes));
app.Logger.LogInformation("Registered Scanner Driver for device types: {DeviceTypes}", string.Join(", ", scannerDriver.SupportedDeviceTypes));

// 配置 HTTP 请求管道
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseSerilogRequestLogging();

app.UseCors("AllowAll");

app.UseRouting();

// 配置 WebSocket
app.UseWebSockets();

app.Map("/ws", async (HttpContext context) =>
{
    if (context.WebSockets.IsWebSocketRequest)
    {
        var webSocket = await context.WebSockets.AcceptWebSocketAsync();
        var connectionId = Guid.NewGuid().ToString();
        var webSocketManager = context.RequestServices.GetRequiredService<DeviceWebSocketManager>();
        
        await webSocketManager.HandleWebSocketAsync(webSocket, connectionId);
    }
    else
    {
        context.Response.StatusCode = 400;
    }
});

app.MapControllers();

// 添加根路径欢迎页面
app.MapGet("/", () => Results.Content(@"
<!DOCTYPE html>
<html>
<head>
    <title>Device Communication Service</title>
    <meta charset='utf-8'>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2563eb; margin-top: 0; }
        .status { background: #10b981; color: white; padding: 8px 16px; border-radius: 4px; display: inline-block; margin: 10px 0; }
        .endpoint { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; padding: 10px; margin: 5px 0; font-family: 'Courier New', monospace; }
        .endpoint code { color: #e83e8c; }
        .link { color: #2563eb; text-decoration: none; }
        .link:hover { text-decoration: underline; }
        .messages-section { margin-top: 30px; }
        .messages-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
        .message-box { border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; background: #f8f9fa; height: 400px; overflow-y: auto; }
        .message-box h3 { margin-top: 0; color: #2563eb; }
        .message-item { background: white; border: 1px solid #e9ecef; border-radius: 4px; padding: 12px; margin: 8px 0; font-family: 'Courier New', monospace; font-size: 12px; }
        .message-time { color: #6c757d; font-size: 10px; margin-bottom: 5px; }
        .message-content { color: #333; word-break: break-all; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
        .stat-card { background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 15px; text-align: center; }
        .stat-number { font-size: 24px; font-weight: bold; color: #2563eb; }
        .stat-label { font-size: 12px; color: #6c757d; margin-top: 5px; }
        .clear-btn { background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px; }
        .clear-btn:hover { background: #c82333; }
    </style>
</head>
<body>
    <div class='container'>
        <h1>🔗 Device Communication Service</h1>
        <div class='status'>✅ Service Running</div>
        
        <div class='stats'>
            <div class='stat-card'>
                <div class='stat-number' id='totalMessages'>0</div>
                <div class='stat-label'>总消息数</div>
            </div>
            <div class='stat-card'>
                <div class='stat-number' id='successMessages'>0</div>
                <div class='stat-label'>成功处理</div>
            </div>
            <div class='stat-card'>
                <div class='stat-number' id='errorMessages'>0</div>
                <div class='stat-label'>处理失败</div>
            </div>
        </div>

        <div class='messages-section'>
            <h2>📨 实时消息监控</h2>
            <div class='messages-container'>
                <div class='message-box'>
                    <div style='display: flex; justify-content: space-between; align-items: center;'>
                        <h3>📥 接收的消息</h3>
                        <button class='clear-btn' onclick='clearMessages(""received"")'>清空</button>
                    </div>
                    <div id='receivedMessages'></div>
                </div>
                
                <div class='message-box'>
                    <div style='display: flex; justify-content: space-between; align-items: center;'>
                        <h3>📤 发送的响应</h3>
                        <button class='clear-btn' onclick='clearMessages(""sent"")'>清空</button>
                    </div>
                    <div id='sentMessages'></div>
                </div>
            </div>
        </div>

        <h2>📋 Available Endpoints</h2>
        
        <h3>🏥 Health & Info</h3>
        <div class='endpoint'><code>GET</code> <a href='/api/health' class='link'>/api/health</a> - Health check</div>
        <div class='endpoint'><code>GET</code> <a href='/api/info' class='link'>/api/info</a> - Service information</div>
        
        <h3>🔧 Device Management</h3>
        <div class='endpoint'><code>GET</code> <a href='/api/devices' class='link'>/api/devices</a> - List all devices</div>
        <div class='endpoint'><code>POST</code> /api/devices - Create device</div>
        <div class='endpoint'><code>GET</code> /api/devices/{id} - Get device</div>
        <div class='endpoint'><code>PUT</code> /api/devices/{id} - Update device</div>
        <div class='endpoint'><code>DELETE</code> /api/devices/{id} - Delete device</div>
        
        <h3>📊 Device Status & Control</h3>
        <div class='endpoint'><code>GET</code> /api/devices/{id}/status - Get device status</div>
        <div class='endpoint'><code>POST</code> /api/devices/{id}/connect - Connect device</div>
        <div class='endpoint'><code>POST</code> /api/devices/{id}/disconnect - Disconnect device</div>
        <div class='endpoint'><code>POST</code> /api/devices/command - Send command</div>
        
        <h3>📚 Documentation</h3>
        <div class='endpoint'>📖 <a href='/swagger' class='link'>/swagger</a> - API Documentation (Swagger UI)</div>
        
        <h3>🔌 WebSocket</h3>
        <div class='endpoint'>🌐 <code>ws://localhost:8080/ws</code> - WebSocket connection</div>
        
        <hr style='margin: 30px 0; border: none; border-top: 1px solid #e9ecef;'>
        
        <h2>🎯 Demo Application</h2>
        <p>Try the complete integration demo: <a href='http://localhost:3006/admin/device-communication' class='link'>Device Communication Demo</a></p>
        
        <p style='color: #6c757d; font-size: 14px; margin-top: 30px;'>
            SimpleMES Device Communication Service v1.0.0<br>
            Built with ASP.NET Core 9.0 + HslCommunication
        </p>
    </div>

    <script>
        let totalMessages = 0;
        let successMessages = 0;
        let errorMessages = 0;
        let lastReceivedCount = 0;
        let lastSentCount = 0;
        
        function addMessage(container, messageRecord) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message-item';
            
            const timeDiv = document.createElement('div');
            timeDiv.className = 'message-time';
            timeDiv.textContent = new Date(messageRecord.timestamp).toLocaleString();
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            
            try {
                const content = JSON.parse(messageRecord.content);
                contentDiv.textContent = JSON.stringify(content, null, 2);
            } catch {
                contentDiv.textContent = messageRecord.content;
            }
            
            messageDiv.appendChild(timeDiv);
            messageDiv.appendChild(contentDiv);
            
            if (!messageRecord.isSuccess) {
                messageDiv.style.borderLeft = '4px solid #dc3545';
            } else {
                messageDiv.style.borderLeft = '4px solid #28a745';
            }
            
            const containerEl = document.getElementById(container);
            containerEl.appendChild(messageDiv);
            
            // 限制显示最多50条消息
            if (containerEl.children.length > 50) {
                containerEl.removeChild(containerEl.firstChild);
            }
        }
        
        function updateStats() {
            document.getElementById('totalMessages').textContent = totalMessages;
            document.getElementById('successMessages').textContent = successMessages;
            document.getElementById('errorMessages').textContent = errorMessages;
        }
        
        function clearMessages(type) {
            document.getElementById(type + 'Messages').innerHTML = '';
        }
        
        // 获取并显示消息
        async function loadMessages() {
            try {
                // 获取统计信息
                const statsResponse = await fetch('/api/messages/stats');
                const stats = await statsResponse.json();
                
                totalMessages = stats.totalMessages;
                successMessages = stats.successCount;
                errorMessages = stats.errorCount;
                updateStats();
                
                // 获取接收的消息
                const receivedResponse = await fetch('/api/messages/received');
                const receivedMessages = await receivedResponse.json();
                
                // 只显示新的接收消息
                if (receivedMessages.length > lastReceivedCount) {
                    const newReceivedMessages = receivedMessages.slice(0, receivedMessages.length - lastReceivedCount);
                    const receivedContainer = document.getElementById('receivedMessages');
                    
                    // 添加新消息到顶部
                    newReceivedMessages.reverse().forEach(msg => {
                        const messageDiv = document.createElement('div');
                        messageDiv.className = 'message-item';
                        
                        const timeDiv = document.createElement('div');
                        timeDiv.className = 'message-time';
                        timeDiv.textContent = new Date(msg.timestamp).toLocaleString();
                        
                        const contentDiv = document.createElement('div');
                        contentDiv.className = 'message-content';
                        
                        try {
                            const content = JSON.parse(msg.content);
                            contentDiv.textContent = JSON.stringify(content, null, 2);
                        } catch {
                            contentDiv.textContent = msg.content;
                        }
                        
                        messageDiv.appendChild(timeDiv);
                        messageDiv.appendChild(contentDiv);
                        messageDiv.style.borderLeft = '4px solid #007bff';
                        
                        receivedContainer.insertBefore(messageDiv, receivedContainer.firstChild);
                    });
                    
                    lastReceivedCount = receivedMessages.length;
                }
                
                // 获取发送的消息
                const sentResponse = await fetch('/api/messages/sent');
                const sentMessages = await sentResponse.json();
                
                // 只显示新的发送消息
                if (sentMessages.length > lastSentCount) {
                    const newSentMessages = sentMessages.slice(0, sentMessages.length - lastSentCount);
                    const sentContainer = document.getElementById('sentMessages');
                    
                    // 添加新消息到顶部
                    newSentMessages.reverse().forEach(msg => {
                        const messageDiv = document.createElement('div');
                        messageDiv.className = 'message-item';
                        
                        const timeDiv = document.createElement('div');
                        timeDiv.className = 'message-time';
                        timeDiv.textContent = new Date(msg.timestamp).toLocaleString();
                        
                        const contentDiv = document.createElement('div');
                        contentDiv.className = 'message-content';
                        
                        try {
                            const content = JSON.parse(msg.content);
                            contentDiv.textContent = JSON.stringify(content, null, 2);
                        } catch {
                            contentDiv.textContent = msg.content;
                        }
                        
                        messageDiv.appendChild(timeDiv);
                        messageDiv.appendChild(contentDiv);
                        
                        if (msg.isSuccess) {
                            messageDiv.style.borderLeft = '4px solid #28a745';
                        } else {
                            messageDiv.style.borderLeft = '4px solid #dc3545';
                        }
                        
                        sentContainer.insertBefore(messageDiv, sentContainer.firstChild);
                    });
                    
                    lastSentCount = sentMessages.length;
                }
                
            } catch (error) {
                console.error('Failed to load messages:', error);
            }
        }
        
        // 初始加载
        loadMessages();
        
        // 每30秒检查一次新消息，减少性能影响
        setInterval(loadMessages, 30000);
    </script>
</body>
</html>
", "text/html; charset=utf-8"));

// 配置监听端口
app.Urls.Add("http://localhost:5000");

app.Logger.LogInformation("Device Communication Service starting...");

app.Run();
