using DeviceCommunicationService.Interfaces;
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace DeviceCommunicationService.Services
{
    public class WebSocketManager : IWebSocketManager
    {
        private readonly ILogger<WebSocketManager> _logger;
        private readonly ConcurrentDictionary<string, WebSocketConnection> _connections = new();

        public WebSocketManager(ILogger<WebSocketManager> logger)
        {
            _logger = logger;
        }

        public async Task HandleWebSocketAsync(WebSocket webSocket, string connectionId)
        {
            var connection = new WebSocketConnection(connectionId, webSocket);
            _connections.TryAdd(connectionId, connection);

            _logger.LogInformation("WebSocket client connected: {ConnectionId}", connectionId);

            try
            {
                var buffer = new byte[4096];
                
                while (webSocket.State == WebSocketState.Open)
                {
                    var result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                    
                    if (result.MessageType == WebSocketMessageType.Text)
                    {
                        var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                        await HandleMessageAsync(connectionId, message);
                    }
                    else if (result.MessageType == WebSocketMessageType.Close)
                    {
                        break;
                    }
                }
            }
            catch (WebSocketException ex)
            {
                _logger.LogWarning(ex, "WebSocket error for connection {ConnectionId}", connectionId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error for WebSocket connection {ConnectionId}", connectionId);
            }
            finally
            {
                _connections.TryRemove(connectionId, out _);
                _logger.LogInformation("WebSocket client disconnected: {ConnectionId}", connectionId);
                
                if (webSocket.State == WebSocketState.Open)
                {
                    await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Connection closed", CancellationToken.None);
                }
            }
        }

        public async Task BroadcastAsync(string message)
        {
            if (_connections.IsEmpty) return;

            var tasks = new List<Task>();
            var messageBytes = Encoding.UTF8.GetBytes(message);

            foreach (var connection in _connections.Values)
            {
                if (connection.WebSocket.State == WebSocketState.Open)
                {
                    tasks.Add(SendMessageAsync(connection, messageBytes));
                }
            }

            await Task.WhenAll(tasks);
        }

        public async Task SendToClientAsync(string connectionId, string message)
        {
            if (_connections.TryGetValue(connectionId, out var connection))
            {
                if (connection.WebSocket.State == WebSocketState.Open)
                {
                    var messageBytes = Encoding.UTF8.GetBytes(message);
                    await SendMessageAsync(connection, messageBytes);
                }
            }
        }

        public int GetConnectedClientsCount()
        {
            return _connections.Count(c => c.Value.WebSocket.State == WebSocketState.Open);
        }

        private async Task SendMessageAsync(WebSocketConnection connection, byte[] messageBytes)
        {
            try
            {
                await connection.WebSocket.SendAsync(
                    new ArraySegment<byte>(messageBytes),
                    WebSocketMessageType.Text,
                    true,
                    CancellationToken.None);
            }
            catch (WebSocketException ex)
            {
                _logger.LogWarning(ex, "Failed to send message to WebSocket connection {ConnectionId}", connection.Id);
                // 移除已断开的连接
                _connections.TryRemove(connection.Id, out _);
            }
        }

        private async Task HandleMessageAsync(string connectionId, string message)
        {
            try
            {
                _logger.LogDebug("Received WebSocket message from {ConnectionId}: {Message}", connectionId, message);
                
                // 解析消息并处理
                var messageObj = JsonSerializer.Deserialize<WebSocketMessage>(message);
                if (messageObj != null)
                {
                    await ProcessMessageAsync(connectionId, messageObj);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to handle WebSocket message from {ConnectionId}", connectionId);
            }
        }

        private async Task ProcessMessageAsync(string connectionId, WebSocketMessage message)
        {
            switch (message.Type?.ToLower())
            {
                case "ping":
                    await SendToClientAsync(connectionId, JsonSerializer.Serialize(new WebSocketMessage 
                    { 
                        Type = "pong", 
                        Timestamp = DateTime.UtcNow 
                    }));
                    break;

                case "subscribe":
                    // 处理订阅逻辑
                    _logger.LogInformation("Client {ConnectionId} subscribed to {Topic}", connectionId, message.Data);
                    break;

                case "unsubscribe":
                    // 处理取消订阅逻辑
                    _logger.LogInformation("Client {ConnectionId} unsubscribed from {Topic}", connectionId, message.Data);
                    break;

                default:
                    _logger.LogWarning("Unknown WebSocket message type: {MessageType}", message.Type);
                    break;
            }
        }

        // 广播设备状态更新
        public async Task BroadcastDeviceStatusAsync(string deviceId, string status)
        {
            var message = new WebSocketMessage
            {
                Type = "deviceStatus",
                Data = new { DeviceId = deviceId, Status = status },
                Timestamp = DateTime.UtcNow
            };

            await BroadcastAsync(JsonSerializer.Serialize(message));
        }

        // 广播设备数据
        public async Task BroadcastDeviceDataAsync(string deviceId, object data)
        {
            var message = new WebSocketMessage
            {
                Type = "deviceData",
                Data = new { DeviceId = deviceId, Data = data },
                Timestamp = DateTime.UtcNow
            };

            await BroadcastAsync(JsonSerializer.Serialize(message));
        }
    }

    internal class WebSocketConnection
    {
        public string Id { get; }
        public WebSocket WebSocket { get; }
        public DateTime ConnectedAt { get; }

        public WebSocketConnection(string id, WebSocket webSocket)
        {
            Id = id;
            WebSocket = webSocket;
            ConnectedAt = DateTime.UtcNow;
        }
    }

    public class WebSocketMessage
    {
        public string? Type { get; set; }
        public object? Data { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}