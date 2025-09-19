# PLC读写问题解决方案

## 问题描述
在 http://localhost:3000/client/workstation 的服务测试页面中：
- PLC读取功能正常
- PLC写入失败，错误信息："写入失败: 无法连接到设备通信服务 (DB0.DBX0.0)"

## 问题根源
前端API发送的操作类型与后端枚举不匹配：
- **前端发送**：`DEVICE_READ` 和 `DEVICE_WRITE`
- **后端期望**：`READ` 和 `WRITE`

## 解决方案

### 修改文件
1. **src/app/api/device-communication/devices/[id]/read/route.ts**
   - 第91行：将 `type: 'DEVICE_READ'` 改为 `type: 'READ'`

2. **src/app/api/device-communication/devices/[id]/write/route.ts**
   - 第92行：将 `type: 'DEVICE_WRITE'` 改为 `type: 'WRITE'`

## 后端操作类型枚举
位置：`DeviceCommunicationService/Models/DeviceModels.cs`
```csharp
public enum OperationType
{
    READ,       // 读取操作
    WRITE,      // 写入操作
    SUBSCRIBE,  // 订阅
    UNSUBSCRIBE,// 取消订阅
    EXECUTE,    // 执行
    CONNECT,    // 连接
    DISCONNECT, // 断开
    STATUS      // 状态查询
}
```

## 测试验证

### 1. 测试PLC写入
```powershell
$deviceId = "cmfgfmq150005tmgo0yux6br0"  # 使用实际的instanceId
$body = @{ 
    address = "M0.0"
    type = "M"
    dbNumber = 0
    byte = 0
    bit = 0
    value = $true 
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/device-communication/devices/$deviceId/write" `
    -Method Post -Body $body -ContentType "application/json"
```

**成功响应**：
```json
{
  "success": true,
  "value": true,
  "address": "M0.0",
  "message": "成功写入 M0.0 = true",
  "timestamp": "2025-09-12T06:48:28.543Z"
}
```

### 2. 测试PLC读取
```powershell
$deviceId = "cmfgfmq150005tmgo0yux6br0"
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

**成功响应**：
```json
{
  "success": true,
  "value": true,
  "address": "M0.0",
  "message": "成功读取 M0.0: true",
  "timestamp": "2025-09-12T06:48:50.543Z"
}
```

## 数据流程说明

### 写入流程
1. **前端页面** (`handlePLCWrite`) 
   - 使用设备的 `deviceId`（即instanceId）
   - 构造写入参数（地址、值等）

2. **前端API路由** (`/api/device-communication/devices/[id]/write`)
   - 通过instanceId查找WorkstationDevice记录
   - 构建设备执行请求
   - 操作类型必须是 `WRITE`（不是 `DEVICE_WRITE`）

3. **后端设备通信服务** (`DeviceExecutionController`)
   - 解析操作类型为 OperationType.WRITE
   - 调用设备管理器执行命令

4. **PLC驱动** (`PlcDriver`)
   - 执行实际的PLC写入操作
   - 返回操作结果

### 读取流程
与写入流程类似，但操作类型为 `READ`

## 注意事项

1. **设备ID说明**
   - `id`：WorkstationDevice表的记录ID
   - `deviceId`：设备实例ID（instanceId）
   - API路由使用instanceId查找设备

2. **地址格式**
   - 西门子PLC：`DB0.DBX0.0`（DB块.字节.位）或 `M0.0`（存储区.位）
   - 三菱PLC：`D0.0`（数据寄存器.位）

3. **错误处理**
   - 如果后端服务超时，返回503错误
   - 如果设备未找到，返回404错误
   - 如果操作失败，返回具体错误信息

## 调试技巧

1. **查看浏览器控制台**
   - 前端会输出设备信息和API URL
   - 可以看到使用的deviceId

2. **查看后端日志**
   ```powershell
   Get-Content "D:\Program\SimpleMES\DeviceCommunicationService\DeviceCommunicationService\logs\device-communication-*.txt" -Tail 20
   ```

3. **使用Wireshark抓包**
   - 过滤条件：`tcp.port == 102`
   - 查看S7协议数据包

## 总结
问题的核心是前后端API之间的操作类型命名不一致。修复后，PLC的读写功能都能正常工作。