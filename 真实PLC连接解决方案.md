# 真实PLC设备连接问题解决方案

## 问题根源

系统原本将127.0.0.1自动识别为模拟设备，导致无法连接到真实的本地PLC（西门子S7-1200）。

## 核心问题定位

### 1. 后端PLC驱动的模拟模式判断（PlcDriver.cs）
**原代码**（第96-99行）：
```csharp
bool isSimulationMode = config.Connection?.Address == "127.0.0.1" || 
                      config.Connection?.Address == "localhost" ||
                      (config.Connection?.Parameters?.ContainsKey("simulation") == true && 
                       config.Connection.Parameters["simulation"].ToString() == "true");
```

这段代码自动将127.0.0.1和localhost识别为模拟设备。

### 2. 前端的模拟模式调用
- `src/app/client/workstation/page.tsx` - 设备连接测试函数
- PLC读写操作函数（handlePLCRead和handlePLCWrite）

### 3. API端口配置错误
多个API路由文件中硬编码了错误的后端端口（5001而不是5000）

## 已实施的修复

### 1. 移除自动模拟判断（✅ 已完成）
**文件**：`DeviceCommunicationService/Drivers/PlcDriver.cs`
**修改**：
```csharp
// 不再自动将127.0.0.1视为模拟设备，因为可能是真实的本地PLC
bool isSimulationMode = (config.Connection?.Parameters?.ContainsKey("simulation") == true && 
                       config.Connection.Parameters["simulation"].ToString() == "true");
```
现在只有在设备参数中明确设置`simulation: true`时才会进入模拟模式。

### 2. 修复前端模拟模式调用（✅ 已完成）
**文件**：`src/app/client/workstation/page.tsx`
- 注释掉设备连接测试中的模拟模式代码（第1129-1178行）
- 移除PLC读取函数中的模拟调用（第1765-1780行）
- 移除PLC写入函数中的模拟调用（第1838-1853行）

### 3. 统一API端口配置（✅ 已完成）
修改以下文件的后端服务URL从5001到5000：
- `src/lib/device-communication/client.ts`
- `src/app/api/device-communication/devices/[id]/connect/route.ts`
- `src/app/api/device-communication/devices/[id]/status/route.ts`
- `src/app/api/device-communication/devices/[id]/read/route.ts`
- `src/app/api/device-communication/devices/[id]/write/route.ts`

### 4. 修复后端前端API配置（✅ 已完成）
**文件**：`DeviceCommunicationService/appsettings.json`
```json
"FrontendApi": {
  "BaseUrl": "http://localhost:3000"
}
```

## 设备配置信息

### 当前PLC设备配置
- **设备ID**：cmfeykv960003tmu887hloima
- **显示名称**：PLC_M1
- **IP地址**：127.0.0.1
- **端口**：102（标准西门子S7协议端口）
- **品牌**：SIEMENS
- **型号**：S7_1200
- **Rack**：0
- **Slot**：1

## 验证步骤

### 1. 检查后端日志
查看日志确认连接的是真实设备而非模拟：
```powershell
Get-Content "D:\Program\SimpleMES\DeviceCommunicationService\DeviceCommunicationService\logs\device-communication-*.txt" -Tail 20
```

**正确的日志应该显示**：
```
Connecting to PLC device cmfeykv960003tmu887hloima at 127.0.0.1:102
Attempting to connect to Siemens PLC at 127.0.0.1:102, Rack=0, Slot=1
```

**而不是**：
```
Connecting to PLC device in SIMULATION MODE
```

### 2. 测试设备连接
```powershell
$deviceId = "cmfeykv960003tmu887hloima"
Invoke-WebRequest -Uri "http://localhost:3000/api/device-communication/devices/$deviceId/connect" -Method Post
```

### 3. 测试PLC读取
```powershell
$body = @{ 
    address = "M0.0"
    type = "M"
    dbNumber = 0
    byte = 0
    bit = 0 
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/device-communication/devices/$deviceId/read" `
    -Method Post -Body $body -ContentType "application/json"
```

## 系统架构说明

### 数据流程
1. **配置存储**：设备参数配置在前端数据库（PostgreSQL）
2. **客户端访问**：通过前端API访问数据库获取设备配置
3. **设备连接**：后端服务根据配置连接真实PLC设备
4. **操作执行**：根据配置的Action操作真实设备

### 关键组件
- **前端数据库**：存储设备配置（WorkstationDevice表）
- **前端API**：提供设备配置访问接口
- **后端设备通信服务**：连接和操作真实PLC
- **HslCommunication库**：西门子S7协议通信实现

## 注意事项

1. **PLC连接要求**：
   - 确保PLC在网络中可达
   - 西门子PLC需要开启PUT/GET通信
   - 防火墙需要允许端口102的TCP连接

2. **设备配置**：
   - 所有设备配置存储在数据库，不使用静态文件
   - 支持多种PLC类型（西门子、三菱、欧姆龙等）
   - 端口自动识别：102（西门子）、6000（三菱）、502（Modbus）

3. **调试技巧**：
   - 查看后端日志确认连接状态
   - 使用Wireshark抓包验证S7协议通信
   - 检查PLC的诊断缓冲区

## 后续优化建议

1. **添加连接重试机制**：当PLC暂时不可达时自动重试
2. **实现连接池**：复用PLC连接，提高性能
3. **添加详细的错误诊断**：提供更具体的连接失败原因
4. **支持更多PLC型号**：扩展驱动支持其他品牌和型号
5. **添加通信监控**：实时显示PLC通信状态和数据交换

## 测试清单

- [x] 后端服务正常启动
- [x] 设备配置从数据库正确加载
- [x] API端口配置统一（5000）
- [x] 移除127.0.0.1的自动模拟判断
- [x] 设备连接API返回成功
- [x] PLC读取操作正常
- [x] PLC写入操作正常
- [ ] 工艺执行时的设备操作
- [ ] 服务模式下的设备测试界面