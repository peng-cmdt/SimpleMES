# 设备通信架构设计文档

## 概述

SimpleMES系统的设备通信采用了前后端分离的架构设计：

1. **前端（Next.js）**：负责从数据库获取设备配置信息，构建设备操作请求
2. **后端（.NET Core）**：负责解析设备配置，与实际设备进行通信

## 通信流程

### 1. 设备配置管理
- 所有设备配置信息存储在数据库中（devices表）
- 包含设备的IP地址、端口、PLC类型、协议等信息
- 通过工位管理界面创建和维护设备配置

### 2. 执行Action时的流程

当执行一个Step中的Action时：

```mermaid
sequenceDiagram
    participant 前端
    participant 数据库
    participant API
    participant .NET服务
    participant 设备

    前端->>数据库: 获取Action和设备配置
    数据库-->>前端: 返回设备信息(IP, 端口, 类型等)
    前端->>API: 发送设备操作请求(JSON)
    API->>>.NET服务: 转发请求到/api/devices/execute
    .NET服务->>设备: 根据配置连接并执行操作
    设备-->>>.NET服务: 返回操作结果
    .NET服务-->>API: 返回JSON格式结果
    API-->>前端: 返回执行结果
    前端->>前端: 根据结果执行业务逻辑
```

### 3. API接口设计

#### 前端API: `/api/device-operations`

**请求格式**：
```json
{
  "deviceId": "device_plc_001",      // 数据库中的设备ID
  "deviceType": "PLC",               // 设备类型
  "deviceInfo": {                    // 设备连接信息
    "ipAddress": "192.168.1.100",
    "port": 102,
    "plcType": "Siemens_S7",
    "protocol": "TCP/IP"
  },
  "operation": {                     // 操作详情
    "type": "DEVICE_READ",           // DEVICE_READ 或 DEVICE_WRITE
    "address": "DB1.DBX0.0",         // 设备地址
    "value": null,                   // 写入时的值
    "dataType": "BOOL"               // 数据类型
  }
}
```

**响应格式**：
```json
{
  "success": true,
  "data": {
    "value": 1,                      // 读取或写入的值
    "status": "success",             // 操作状态
    "timestamp": "2024-01-01T12:00:00Z"
  },
  "error": null
}
```

#### .NET后端API: `/api/devices/execute`

接收前端转发的请求，根据设备配置信息动态创建设备连接并执行操作。

### 4. 设备地址格式

#### 西门子PLC
- 位地址：`DB1.DBX0.0` (DB块.字节.位)
- 字地址：`DB1.DBW0` (DB块.字)

#### 三菱PLC
- D寄存器：`D100` (数据寄存器)
- 位地址：`D100.0` (寄存器.位)
- M继电器：`M100`

### 5. 使用示例

#### 在前端代码中调用
```typescript
import { deviceOperationService } from '@/lib/services/device-operation';

// 读取设备数据
const result = await deviceOperationService.readDevice(
  'device_plc_001',  // 设备ID
  'DB1.DBX0.0'       // 地址
);

if (result.success) {
  console.log('读取值:', result.data.value);
}

// 写入设备数据
const writeResult = await deviceOperationService.writeDevice(
  'device_plc_001',  // 设备ID
  'DB1.DBX0.1',      // 地址
  1                  // 值
);

// 执行Action
const action = {
  id: 'action_001',
  type: 'DEVICE_READ',
  deviceId: 'device_plc_001',
  deviceAddress: 'DB1.DBX0.0',
  expectedValue: '1'
};

const actionResult = await deviceOperationService.executeAction(action);
```

### 6. 配置要求

1. **数据库设备配置**
   - 必须包含正确的IP地址和端口
   - PLC类型要正确设置（影响地址解析）
   - 设备ID必须唯一

2. **网络要求**
   - 前端能访问后端API（默认3009端口）
   - .NET服务能访问设备（默认5000端口）
   - 设备网络可达

3. **服务依赞**
   - Next.js前端服务运行在3009端口
   - .NET设备通信服务运行在5000端口

## 测试方法

1. 启动前端服务：
```bash
cd simple-mes
npm run dev -- --port 3009
```

2. 启动.NET服务：
```bash
cd DeviceCommunicationService/DeviceCommunicationService
dotnet run
```

3. 运行测试脚本：
```bash
node test-device-operation.js
```

## 优势

1. **解耦设计**：前端不需要了解设备通信细节
2. **灵活配置**：设备信息存储在数据库，易于管理
3. **统一接口**：所有设备操作通过统一的JSON接口
4. **易于扩展**：支持新设备类型只需在后端添加驱动

## 注意事项

1. 设备配置变更后立即生效，无需重启服务
2. 操作日志会自动记录到action_logs表
3. 连接失败时会返回模拟数据（开发环境）
4. 生产环境建议配置适当的超时和重试策略