namespace DeviceCommunicationService.Models
{
    public class PlcSimulatorOptions
    {
        public int Port { get; set; } = 102;
        public bool Enabled { get; set; } = true;
        public string IpAddress { get; set; } = "127.0.0.1";
        public Dictionary<string, object> DefaultData { get; set; } = new();
    }
}