using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Collections.Concurrent;
using Microsoft.Extensions.Options;
using DeviceCommunicationService.Models;

namespace DeviceCommunicationService.Services
{
    /// <summary>
    /// Simple PLC Simulator for testing device connections
    /// Listens on port 102 for S7 protocol simulation
    /// </summary>
    public class PlcSimulator : BackgroundService
    {
        private readonly ILogger<PlcSimulator> _logger;
        private readonly PlcSimulatorOptions _options;
        private TcpListener? _listener;
        private readonly ConcurrentDictionary<string, PlcSimulatedData> _data;

        public PlcSimulator(ILogger<PlcSimulator> logger, IOptions<PlcSimulatorOptions> options)
        {
            _logger = logger;
            _options = options.Value;
            _data = new ConcurrentDictionary<string, PlcSimulatedData>();
            
            // Initialize some default data for testing
            InitializeTestData();
        }

        private void InitializeTestData()
        {
            // Initialize some common PLC memory areas with test data
            _data["M0.0"] = new PlcSimulatedData { Address = "M0.0", Value = false, DataType = "BOOL" };
            _data["M0.1"] = new PlcSimulatedData { Address = "M0.1", Value = true, DataType = "BOOL" };
            _data["DB1.DBW0"] = new PlcSimulatedData { Address = "DB1.DBW0", Value = (short)1234, DataType = "INT" };
            _data["DB10.DBX0.0"] = new PlcSimulatedData { Address = "DB10.DBX0.0", Value = true, DataType = "BOOL" };
            _data["DB10.DBX0.1"] = new PlcSimulatedData { Address = "DB10.DBX0.1", Value = false, DataType = "BOOL" };
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try
            {
                _listener = new TcpListener(IPAddress.Any, _options.Port);
                _listener.Start();
                _logger.LogInformation("PLC Simulator started and listening on port {Port}", _options.Port);

                while (!stoppingToken.IsCancellationRequested)
                {
                    try
                    {
                        var client = await _listener.AcceptTcpClientAsync();
                        _ = HandleClientAsync(client, stoppingToken);
                    }
                    catch (ObjectDisposedException)
                    {
                        // Listener was stopped
                        break;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error accepting client connection");
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error starting PLC simulator");
            }
            finally
            {
                _listener?.Stop();
            }
        }

        private async Task HandleClientAsync(TcpClient client, CancellationToken cancellationToken)
        {
            var clientEndpoint = client.Client.RemoteEndPoint?.ToString() ?? "unknown";
            _logger.LogInformation("PLC Simulator: Client connected from {Endpoint}", clientEndpoint);

            try
            {
                using var stream = client.GetStream();
                var buffer = new byte[4096];

                while (!cancellationToken.IsCancellationRequested && client.Connected)
                {
                    try
                    {
                        var bytesRead = await stream.ReadAsync(buffer, 0, buffer.Length, cancellationToken);
                        if (bytesRead == 0) break;

                        var request = Encoding.ASCII.GetString(buffer, 0, bytesRead);
                        _logger.LogDebug("PLC Simulator received: {Request}", Convert.ToHexString(buffer, 0, bytesRead));

                        // Simple S7 protocol simulation - respond with basic acknowledgment
                        var response = CreateSimulatedResponse(request, buffer, bytesRead);
                        
                        if (response != null)
                        {
                            await stream.WriteAsync(response, 0, response.Length, cancellationToken);
                            await stream.FlushAsync(cancellationToken);
                            _logger.LogDebug("PLC Simulator sent response: {Response}", Convert.ToHexString(response));
                        }
                    }
                    catch (IOException)
                    {
                        // Client disconnected
                        break;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error handling client {Endpoint}", clientEndpoint);
            }
            finally
            {
                client.Close();
                _logger.LogInformation("PLC Simulator: Client disconnected from {Endpoint}", clientEndpoint);
            }
        }

        private byte[]? CreateSimulatedResponse(string request, byte[] rawRequest, int length)
        {
            try
            {
                // Basic S7 protocol simulation
                // This is a simplified version that responds to basic S7 requests
                
                if (length < 4) return null;

                // Check for basic S7 protocol markers
                var response = new byte[length];
                Array.Copy(rawRequest, response, length);

                // Simple acknowledgment pattern for S7
                if (rawRequest[0] == 0x03 && rawRequest[1] == 0x00) // Basic S7 header
                {
                    // Return a simple acknowledgment
                    response[1] = 0x00; // Ack
                    response[2] = 0x00; // Status OK
                    response[3] = 0x00;
                    
                    _logger.LogDebug("PLC Simulator: Sending S7 acknowledgment");
                    return response;
                }

                // For read requests, return simulated data
                if (IsReadRequest(rawRequest, length))
                {
                    return CreateReadResponse(rawRequest, length);
                }

                // For write requests, return success acknowledgment
                if (IsWriteRequest(rawRequest, length))
                {
                    return CreateWriteResponse(rawRequest, length);
                }

                // Default: echo back with success status
                response[2] = 0x00; // Status OK
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating simulated response");
                return null;
            }
        }

        private bool IsReadRequest(byte[] data, int length)
        {
            // Simplified S7 read request detection
            // Look for common S7 read patterns
            for (int i = 0; i < length - 2; i++)
            {
                if (data[i] == 0x04 && data[i + 1] == 0x01) // Common S7 read pattern
                    return true;
            }
            return false;
        }

        private bool IsWriteRequest(byte[] data, int length)
        {
            // Simplified S7 write request detection
            // Look for common S7 write patterns
            for (int i = 0; i < length - 2; i++)
            {
                if (data[i] == 0x05 && data[i + 1] == 0x01) // Common S7 write pattern
                    return true;
            }
            return false;
        }

        private byte[] CreateReadResponse(byte[] request, int length)
        {
            // Create a response with simulated data
            var response = new byte[length + 4]; // Add space for data
            Array.Copy(request, response, length);
            
            // Simulate reading M0.0
            response[length] = 0x00; // Status: success
            response[length + 1] = 0x01; // Data: true (for M0.0)
            response[length + 2] = 0x00; // Padding
            response[length + 3] = 0x00; // Padding
            
            _logger.LogDebug("PLC Simulator: Sending read response with data");
            return response;
        }

        private byte[] CreateWriteResponse(byte[] request, int length)
        {
            // Create write acknowledgment
            var response = new byte[length];
            Array.Copy(request, response, length);
            
            // Set success status
            response[2] = 0x00; // Status: success
            
            _logger.LogDebug("PLC Simulator: Sending write acknowledgment");
            return response;
        }

        public override void Dispose()
        {
            _listener?.Stop();
            // 注意：不移用base.Dispose()，因为BackgroundService的Dispose可能有问题
        }

        // Helper class for simulated data
        private class PlcSimulatedData
        {
            public string Address { get; set; } = string.Empty;
            public object Value { get; set; } = new object();
            public string DataType { get; set; } = "BOOL";
            public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
        }
    }
}