'use client';

import { useState, useEffect } from 'react';
import { deviceCommunicationClient } from '@/lib/device-communication/client';
import { DeviceConfig, DeviceStatusInfo, DeviceResponse, DeviceType, ConnectionType, DataType, OperationType, PlcType } from '@/types/device-communication';

export default function DeviceCommunicationDemo() {
  // 基础状态
  const [isConnected, setIsConnected] = useState(false);
  const [serviceInfo, setServiceInfo] = useState(null);
  const [devices, setDevices] = useState<DeviceConfig[]>([]);
  const [deviceStatuses, setDeviceStatuses] = useState<DeviceStatusInfo[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 连接配置状态
  const [serviceUrl, setServiceUrl] = useState('http://localhost:8080');
  const [connectionTimeout, setConnectionTimeout] = useState(5000);

  // 设备配置状态
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [deviceForm, setDeviceForm] = useState({
    name: '',
    deviceType: 'PLC' as DeviceType,
    connectionType: 'TCP' as ConnectionType,
    connectionString: '192.168.1.2:102',
    plcType: 'SIEMENS_S7' as PlcType,
    slaveId: 0,
    station: 0,
    slot: 0,
    rack: 0,
    timeout: 3000,
    retryCount: 3,
    keepAlive: true,
    heartbeatInterval: 5000,
    enabled: true
  });

  // PLC测试状态
  const [showPlcTest, setShowPlcTest] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [plcTestForm, setPlcTestForm] = useState({
    operation: 'READ' as OperationType,
    address: 'DB1.DBX0.2',
    dataType: 'BOOL' as DataType,
    value: '',
    description: ''
  });
  const [testResults, setTestResults] = useState<any[]>([]);

  // 设备状态监控
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitoringInterval, setMonitoringInterval] = useState<NodeJS.Timeout | null>(null);

  // 添加日志
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 99)]);
  };

  // 检查服务连接
  const checkServiceConnection = async () => {
    try {
      setIsLoading(true);
      addLog(`🔍 正在检查服务连接: ${serviceUrl}`);
      
      // 更新客户端基础URL
      deviceCommunicationClient.setBaseUrl(serviceUrl);
      deviceCommunicationClient.setTimeout(connectionTimeout);
      
      const available = await deviceCommunicationClient.isServiceAvailable();
      setIsConnected(available);
      
      if (available) {
        const info = await deviceCommunicationClient.getServiceInfo();
        setServiceInfo(info);
        addLog(`✅ 成功连接到设备通信服务: ${info.serviceName || info.name} v${info.version}`);
        
        // 获取设备列表
        await loadDevices();
      } else {
        addLog(`❌ 无法连接到设备通信服务: ${serviceUrl}`);
      }
    } catch (error: any) {
      addLog(`❌ 连接错误: ${error.message}`);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  // 加载设备列表
  const loadDevices = async () => {
    try {
      const deviceList = await deviceCommunicationClient.getDevices();
      setDevices(deviceList);
      addLog(`📋 加载了 ${deviceList.length} 个设备配置`);
      
      // 获取设备状态
      if (deviceList.length > 0) {
        await loadDeviceStatuses();
      }
    } catch (error: any) {
      addLog(`❌ 加载设备列表失败: ${error.message}`);
    }
  };

  // 加载设备状态
  const loadDeviceStatuses = async () => {
    try {
      const statuses = await deviceCommunicationClient.getAllDeviceStatus();
      setDeviceStatuses(statuses);
      
      // 统计连接状态
      const connected = statuses.filter(s => s.status === 'ONLINE').length;
      const total = statuses.length;
      addLog(`📊 设备状态更新: ${connected}/${total} 设备在线`);
    } catch (error: any) {
      addLog(`❌ 获取设备状态失败: ${error.message}`);
    }
  };

  // 创建设备
  const createDevice = async () => {
    try {
      setIsLoading(true);
      
      const newDevice = {
        name: deviceForm.name,
        deviceType: deviceForm.deviceType,
        connectionType: deviceForm.connectionType,
        connectionString: deviceForm.connectionString,
        configuration: {
          plc: {
            plcType: deviceForm.plcType,
            slaveId: deviceForm.slaveId,
            station: deviceForm.station,
            slot: deviceForm.slot,
            rack: deviceForm.rack,
            timeout: deviceForm.timeout,
            retryCount: deviceForm.retryCount,
            keepAlive: deviceForm.keepAlive,
            heartbeatInterval: deviceForm.heartbeatInterval
          }
        },
        enabled: deviceForm.enabled
      };

      const device = await deviceCommunicationClient.createDevice(newDevice);
      addLog(`✅ 创建设备成功: ${device.name} (${device.deviceId})`);
      
      // 重置表单
      setDeviceForm({
        name: '',
        deviceType: 'PLC' as DeviceType,
        connectionType: 'TCP' as ConnectionType,
        connectionString: '192.168.1.2:102',
        plcType: 'SIEMENS_S7' as PlcType,
        slaveId: 0,
        station: 0,
        slot: 0,
        rack: 0,
        timeout: 3000,
        retryCount: 3,
        keepAlive: true,
        heartbeatInterval: 5000,
        enabled: true
      });
      setShowDeviceForm(false);
      
      await loadDevices();
    } catch (error: any) {
      addLog(`❌ 创建设备失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 连接设备
  const connectDevice = async (deviceId: string) => {
    try {
      setIsLoading(true);
      const response = await deviceCommunicationClient.connectDevice(deviceId);
      addLog(`🔗 设备连接: ${deviceId} - ${response.success ? '成功' : '失败'}`);
      if (!response.success && response.error) {
        addLog(`   错误: ${response.error.message}`);
      }
      await loadDeviceStatuses();
    } catch (error: any) {
      addLog(`❌ 设备连接失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 断开设备
  const disconnectDevice = async (deviceId: string) => {
    try {
      setIsLoading(true);
      const response = await deviceCommunicationClient.disconnectDevice(deviceId);
      addLog(`🔌 设备断开: ${deviceId} - ${response.success ? '成功' : '失败'}`);
      if (!response.success && response.error) {
        addLog(`   错误: ${response.error.message}`);
      }
      await loadDeviceStatuses();
    } catch (error: any) {
      addLog(`❌ 设备断开失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 删除设备
  const deleteDevice = async (deviceId: string) => {
    try {
      setIsLoading(true);
      await deviceCommunicationClient.deleteDevice(deviceId);
      addLog(`🗑️ 删除设备成功: ${deviceId}`);
      await loadDevices();
    } catch (error: any) {
      addLog(`❌ 删除设备失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 执行PLC测试
  const executePlcTest = async () => {
    try {
      setIsLoading(true);
      
      const command = {
        id: `plc-test-${Date.now()}`,
        deviceId: selectedDeviceId,
        timestamp: new Date().toISOString(),
        operation: plcTestForm.operation,
        address: plcTestForm.address,
        dataType: plcTestForm.dataType,
        value: plcTestForm.operation === 'WRITE' ? plcTestForm.value : null,
        description: plcTestForm.description
      };

      const response = await deviceCommunicationClient.sendCommand(command);
      
      const result = {
        timestamp: new Date().toLocaleTimeString(),
        operation: plcTestForm.operation,
        address: plcTestForm.address,
        dataType: plcTestForm.dataType,
        value: plcTestForm.operation === 'WRITE' ? plcTestForm.value : response.data,
        success: response.success,
        duration: response.duration,
        error: response.error?.message
      };
      
      setTestResults(prev => [result, ...prev.slice(0, 19)]);
      
      addLog(`📡 PLC测试: ${command.operation} ${command.address} - ${response.success ? '成功' : '失败'}`);
      if (response.success && response.data !== undefined) {
        addLog(`   结果: ${response.data} (${response.duration}ms)`);
      }
      if (!response.success && response.error) {
        addLog(`   错误: ${response.error.message}`);
      }
    } catch (error: any) {
      addLog(`❌ PLC测试失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 开始/停止状态监控
  const toggleMonitoring = () => {
    if (isMonitoring) {
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
        setMonitoringInterval(null);
      }
      setIsMonitoring(false);
      addLog('⏹️ 停止设备状态监控');
    } else {
      const interval = setInterval(async () => {
        if (devices.length > 0) {
          await loadDeviceStatuses();
        }
      }, 2000);
      setMonitoringInterval(interval);
      setIsMonitoring(true);
      addLog('▶️ 开始设备状态监控 (每2秒刷新)');
    }
  };

  // 页面加载时检查连接
  useEffect(() => {
    checkServiceConnection();
    return () => {
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
      }
    };
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          设备通信配置与测试中心
        </h1>
        <p className="text-gray-600">
          配置连接参数、管理设备、测试PLC读写操作、监控设备状态
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左列：服务配置与连接 */}
        <div className="lg:col-span-1 space-y-6">
          {/* 服务连接配置 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">服务连接配置</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  C# 服务地址
                </label>
                <input
                  type="text"
                  value={serviceUrl}
                  onChange={(e) => setServiceUrl(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="http://localhost:8080"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  连接超时 (ms)
                </label>
                <input
                  type="number"
                  value={connectionTimeout}
                  onChange={(e) => setConnectionTimeout(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1000"
                  max="30000"
                />
              </div>
              
              <button
                onClick={checkServiceConnection}
                disabled={isLoading}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors"
              >
                {isLoading ? '连接中...' : '测试连接'}
              </button>
            </div>
            
            {/* 连接状态 */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center mb-2">
                <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm font-medium">
                  {isConnected ? '✅ 已连接' : '❌ 未连接'}
                </span>
              </div>
              
              {serviceInfo && (
                <div className="text-xs text-gray-600 space-y-1">
                  <div>服务: {serviceInfo.serviceName || serviceInfo.name}</div>
                  <div>版本: {serviceInfo.version}</div>
                  <div>运行时间: {serviceInfo.uptime}</div>
                </div>
              )}
            </div>
          </div>

          {/* 设备创建表单 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">设备配置</h2>
              <button
                onClick={() => setShowDeviceForm(!showDeviceForm)}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md transition-colors text-sm"
              >
                {showDeviceForm ? '取消' : '新建设备'}
              </button>
            </div>

            {showDeviceForm && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">设备名称</label>
                  <input
                    type="text"
                    value={deviceForm.name}
                    onChange={(e) => setDeviceForm({...deviceForm, name: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="例: PLC-001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">设备类型</label>
                  <select
                    value={deviceForm.deviceType}
                    onChange={(e) => setDeviceForm({...deviceForm, deviceType: e.target.value as DeviceType})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PLC">PLC</option>
                    <option value="SCANNER">扫码枪</option>
                    <option value="CAMERA">相机</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">连接地址</label>
                  <input
                    type="text"
                    value={deviceForm.connectionString}
                    onChange={(e) => setDeviceForm({...deviceForm, connectionString: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="192.168.1.2:102"
                  />
                </div>

                {deviceForm.deviceType === 'PLC' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">PLC类型</label>
                      <select
                        value={deviceForm.plcType}
                        onChange={(e) => setDeviceForm({...deviceForm, plcType: e.target.value as PlcType})}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="SIEMENS_S7">西门子 S7</option>
                        <option value="MITSUBISHI_MC">三菱 MC</option>
                        <option value="OMRON_FINS">欧姆龙 FINS</option>
                        <option value="MODBUS_TCP">Modbus TCP</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">从站ID</label>
                        <input
                          type="number"
                          value={deviceForm.slaveId}
                          onChange={(e) => setDeviceForm({...deviceForm, slaveId: Number(e.target.value)})}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          max="255"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">超时(ms)</label>
                        <input
                          type="number"
                          value={deviceForm.timeout}
                          onChange={(e) => setDeviceForm({...deviceForm, timeout: Number(e.target.value)})}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="1000"
                          max="10000"
                        />
                      </div>
                    </div>
                  </>
                )}

                <button
                  onClick={createDevice}
                  disabled={!deviceForm.name || !isConnected || isLoading}
                  className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors text-sm"
                >
                  创建设备
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 中列：设备管理与状态 */}
        <div className="lg:col-span-1 space-y-6">
          {/* 设备状态监控 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">设备状态监控</h2>
              <div className="flex space-x-2">
                <button
                  onClick={toggleMonitoring}
                  disabled={!isConnected}
                  className={`px-4 py-2 rounded-md text-sm transition-colors ${
                    isMonitoring 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-400'
                  }`}
                >
                  {isMonitoring ? '⏹️ 停止监控' : '▶️ 开始监控'}
                </button>
                <button
                  onClick={loadDeviceStatuses}
                  disabled={!isConnected || isLoading}
                  className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm transition-colors"
                >
                  🔄 刷新
                </button>
              </div>
            </div>

            {/* 统计信息 */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{devices.length}</div>
                <div className="text-xs text-gray-600">总设备数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {deviceStatuses.filter(s => s.status === 'ONLINE').length}
                </div>
                <div className="text-xs text-gray-600">在线设备</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {deviceStatuses.filter(s => s.status === 'ERROR').length}
                </div>
                <div className="text-xs text-gray-600">故障设备</div>
              </div>
            </div>

            {/* 设备列表 */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {devices.length === 0 ? (
                <p className="text-gray-500 text-center py-4 text-sm">暂无设备</p>
              ) : (
                devices.map((device) => {
                  const status = deviceStatuses.find(s => s.deviceId === device.deviceId);
                  return (
                    <div key={device.deviceId} className="border rounded-md p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-sm">{device.name}</div>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          status?.status === 'ONLINE' ? 'bg-green-100 text-green-800' :
                          status?.status === 'DISCONNECTED' ? 'bg-gray-100 text-gray-800' :
                          status?.status === 'ERROR' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {status?.status || 'UNKNOWN'}
                        </span>
                      </div>
                      
                      <div className="text-xs text-gray-600 mb-2">
                        <div>{device.deviceType} | {device.connectionString}</div>
                        {status?.lastHeartbeat && (
                          <div>心跳: {new Date(status.lastHeartbeat).toLocaleTimeString()}</div>
                        )}
                      </div>
                      
                      <div className="flex space-x-1">
                        <button
                          onClick={() => connectDevice(device.deviceId)}
                          disabled={isLoading}
                          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-2 py-1 rounded text-xs"
                        >
                          连接
                        </button>
                        <button
                          onClick={() => disconnectDevice(device.deviceId)}
                          disabled={isLoading}
                          className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-2 py-1 rounded text-xs"
                        >
                          断开
                        </button>
                        <button
                          onClick={() => {
                            setSelectedDeviceId(device.deviceId);
                            setShowPlcTest(true);
                          }}
                          disabled={device.deviceType !== 'PLC'}
                          className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white px-2 py-1 rounded text-xs"
                        >
                          测试
                        </button>
                        <button
                          onClick={() => deleteDevice(device.deviceId)}
                          disabled={isLoading}
                          className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white px-2 py-1 rounded text-xs"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 右列：PLC测试与日志 */}
        <div className="lg:col-span-1 space-y-6">
          {/* PLC 读写测试 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">PLC 读写测试</h2>
              <button
                onClick={() => setShowPlcTest(!showPlcTest)}
                disabled={devices.filter(d => d.deviceType === 'PLC').length === 0}
                className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm transition-colors"
              >
                {showPlcTest ? '关闭' : '打开测试'}
              </button>
            </div>

            {showPlcTest && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">选择PLC设备</label>
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">请选择设备</option>
                    {devices.filter(d => d.deviceType === 'PLC').map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.name} ({device.connectionString})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">操作类型</label>
                  <select
                    value={plcTestForm.operation}
                    onChange={(e) => setPlcTestForm({...plcTestForm, operation: e.target.value as OperationType})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="READ">读取</option>
                    <option value="WRITE">写入</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PLC地址</label>
                  <input
                    type="text"
                    value={plcTestForm.address}
                    onChange={(e) => setPlcTestForm({...plcTestForm, address: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="例: DB1.DBX0.2"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    示例地址: DB1.DBX0.2, M0.0, Q0.1, I0.0
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">数据类型</label>
                  <select
                    value={plcTestForm.dataType}
                    onChange={(e) => setPlcTestForm({...plcTestForm, dataType: e.target.value as DataType})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="BOOL">BOOL (布尔)</option>
                    <option value="INT">INT (整数)</option>
                    <option value="DINT">DINT (双整数)</option>
                    <option value="REAL">REAL (实数)</option>
                    <option value="STRING">STRING (字符串)</option>
                  </select>
                </div>

                {plcTestForm.operation === 'WRITE' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">写入值</label>
                    <input
                      type="text"
                      value={plcTestForm.value}
                      onChange={(e) => setPlcTestForm({...plcTestForm, value: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="要写入的值"
                    />
                  </div>
                )}

                <button
                  onClick={executePlcTest}
                  disabled={!selectedDeviceId || !plcTestForm.address || isLoading}
                  className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm transition-colors"
                >
                  执行测试
                </button>
              </div>
            )}

            {/* 测试结果 */}
            {testResults.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h3 className="text-sm font-medium mb-2">测试结果</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {testResults.map((result, index) => (
                    <div key={index} className={`p-2 rounded text-xs ${
                      result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    } border`}>
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium">{result.operation} {result.address}</span>
                        <span className="text-gray-500">{result.timestamp}</span>
                      </div>
                      {result.success ? (
                        <div>
                          <div>值: {String(result.value)}</div>
                          <div>耗时: {result.duration}ms</div>
                        </div>
                      ) : (
                        <div className="text-red-600">错误: {result.error}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 操作日志 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">操作日志</h2>
              <button
                onClick={() => setLogs([])}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm transition-colors"
              >
                清空
              </button>
            </div>
            
            <div className="bg-gray-50 rounded-md p-4 h-64 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-gray-500 text-center text-sm">暂无日志</p>
              ) : (
                <div className="space-y-1">
                  {logs.map((log, index) => (
                    <div key={index} className="text-xs font-mono text-gray-700">
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}