"use client";

import { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useLanguage } from "@/contexts/LanguageContext";

interface DeviceStatus {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  status: 'online' | 'offline' | 'error' | 'pending';
  isOnline: boolean;
  lastConnected?: string;
  lastHeartbeat?: string;
  error?: string | null;
  brand?: string;
  model?: string;
  ipAddress?: string;
  port?: number;
}

interface WorkstationSession {
  sessionId: string;
  workstation: {
    id: string;
    workstationId: string;
    name: string;
    description?: string;
    location?: string;
    type: 'VISUAL_CLIENT' | 'SERVICE_TYPE';
  };
  username: string;
  loginTime: string;
  lastActivity: string;
  isActive: boolean;
  connectedDevices?: any;
}

interface RealTimeEvent {
  id: string;
  type: string;
  message: string;
  timestamp: Date;
  severity: 'info' | 'success' | 'warning' | 'error';
  workstationId?: string;
  workstationName?: string;
}

interface OperationLog {
  id: string;
  type: string;
  operation: string;
  result: string;
  timestamp: Date;
  workstationId?: string;
  workstationName?: string;
  username?: string;
}

export default function AdminMonitoringPage() {
  const [workstationSessions, setWorkstationSessions] = useState<WorkstationSession[]>([]);
  const [allDeviceStatuses, setAllDeviceStatuses] = useState<{ [workstationId: string]: DeviceStatus[] }>({});
  const [realTimeEvents, setRealTimeEvents] = useState<RealTimeEvent[]>([]);
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
  const [selectedWorkstation, setSelectedWorkstation] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [connectionStatuses, setConnectionStatuses] = useState<{ [key: string]: string }>({});
  const { t } = useLanguage();

  useEffect(() => {
    loadMonitoringData();
    
    // 每10秒刷新数据
    const interval = setInterval(() => {
      loadMonitoringData(false);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const loadMonitoringData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    
    try {
      // 加载活跃的工位会话
      const sessionsResponse = await fetch('/api/workstation/sessions/active');
      if (sessionsResponse.ok) {
        const sessionsData = await sessionsResponse.json();
        if (sessionsData.success) {
          setWorkstationSessions(sessionsData.sessions || []);
          
          // 为每个活跃工位加载设备状态
          for (const session of sessionsData.sessions || []) {
            await loadWorkstationDevices(session.workstation.workstationId);
          }
        }
      }

      // 加载实时事件
      await loadRealTimeEvents();
      
      // 加载操作日志
      await loadOperationLogs();

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load monitoring data:', error);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const loadWorkstationDevices = async (workstationId: string) => {
    try {
      const response = await fetch(`/api/workstation/${workstationId}/devices`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.devices)) {
          const devices: DeviceStatus[] = data.devices.map((device: any) => ({
            deviceId: device.deviceId,
            deviceName: device.name,
            deviceType: device.type.replace('_CONTROLLER', '').replace('_', ' '),
            status: device.isOnline ? 'online' : 'offline',
            isOnline: device.isOnline,
            lastConnected: device.lastConnected,
            lastHeartbeat: device.lastHeartbeat,
            error: null,
            brand: device.brand,
            model: device.model,
            ipAddress: device.ipAddress,
            port: device.port
          }));
          
          setAllDeviceStatuses(prev => ({
            ...prev,
            [workstationId]: devices
          }));

          // 检查实际设备状态
          await checkWorkstationDeviceStatuses(workstationId, devices);
        }
      }
    } catch (error) {
      console.error(`Failed to load devices for workstation ${workstationId}:`, error);
    }
  };

  const checkWorkstationDeviceStatuses = async (workstationId: string, devices: DeviceStatus[]) => {
    try {
      const statusResponse = await fetch(`http://localhost:8080/api/workstation/${workstationId}/devices/status`);
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        
        const updatedDevices = devices.map(device => {
          const realStatus = statusData.find((s: any) => s.deviceId === device.deviceId);
          if (realStatus) {
            return {
              ...device,
              status: realStatus.isOnline ? 'online' : 'offline',
              isOnline: realStatus.isOnline,
              lastConnected: realStatus.lastConnected,
              lastHeartbeat: realStatus.lastHeartbeat,
              error: realStatus.error
            };
          }
          return device;
        });
        
        setAllDeviceStatuses(prev => ({
          ...prev,
          [workstationId]: updatedDevices
        }));

        setConnectionStatuses(prev => ({
          ...prev,
          [workstationId]: 'connected'
        }));
      } else {
        setConnectionStatuses(prev => ({
          ...prev,
          [workstationId]: 'offline'
        }));
      }
    } catch (error) {
      setConnectionStatuses(prev => ({
        ...prev,
        [workstationId]: 'error'
      }));
    }
  };

  const loadRealTimeEvents = async () => {
    // 模拟实时事件数据
    const mockEvents: RealTimeEvent[] = [
      {
        id: `event_${Date.now()}_1`,
        type: 'device_status',
        message: '设备 PLC-001 上线',
        timestamp: new Date(Date.now() - 5000),
        severity: 'success',
        workstationId: 'WS-001',
        workstationName: '最终检测工位'
      },
      {
        id: `event_${Date.now()}_2`,
        type: 'barcode_scan',
        message: '扫描条码: MF120250821T129',
        timestamp: new Date(Date.now() - 15000),
        severity: 'info',
        workstationId: 'WS-001',
        workstationName: '最终检测工位'
      },
      {
        id: `event_${Date.now()}_3`,
        type: 'device_error',
        message: '设备通信超时',
        timestamp: new Date(Date.now() - 30000),
        severity: 'warning',
        workstationId: 'WS-002',
        workstationName: '装配工位'
      }
    ];
    
    setRealTimeEvents(mockEvents);
  };

  const loadOperationLogs = async () => {
    // 模拟操作日志数据
    const mockLogs: OperationLog[] = [
      {
        id: `log_${Date.now()}_1`,
        type: 'device_operation',
        operation: 'PLC读取',
        result: '成功',
        timestamp: new Date(Date.now() - 10000),
        workstationId: 'WS-001',
        workstationName: '最终检测工位',
        username: 'Feng Ke'
      },
      {
        id: `log_${Date.now()}_2`,
        type: 'barcode_scan',
        operation: '条码扫描',
        result: '成功',
        timestamp: new Date(Date.now() - 20000),
        workstationId: 'WS-001',
        workstationName: '最终检测工位',
        username: 'Feng Ke'
      }
    ];
    
    setOperationLogs(mockLogs);
  };

  const getStatusColor = (status: string, isOnline?: boolean) => {
    if (isOnline === false) return 'bg-gray-500';
    switch (status.toLowerCase()) {
      case 'online':
      case 'connected':
        return 'bg-green-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('zh-CN');
  };

  if (isLoading) {
    return (
      <AdminLayout title="实时监控">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="实时监控">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            工位实时监控
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
            最后更新: {lastUpdated.toLocaleTimeString('zh-CN')}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedWorkstation}
            onChange={(e) => setSelectedWorkstation(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
          >
            <option value="">所有工位</option>
            {workstationSessions.map((session) => (
              <option key={session.workstation.id} value={session.workstation.workstationId}>
                {session.workstation.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => loadMonitoringData(true)}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center text-sm"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 活跃工位状态 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            活跃工位 ({workstationSessions.length})
          </h3>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {workstationSessions.length === 0 ? (
              <p className="text-gray-500 text-center py-4">暂无活跃工位</p>
            ) : (
              workstationSessions.map((session) => {
                const devices = allDeviceStatuses[session.workstation.workstationId] || [];
                const onlineDevices = devices.filter(d => d.isOnline).length;
                const connectionStatus = connectionStatuses[session.workstation.workstationId] || 'unknown';
                
                return (
                  <div key={session.sessionId} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {session.workstation.name}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">
                          ({session.workstation.type})
                        </span>
                      </div>
                      <div className={`w-3 h-3 rounded-full ${
                        connectionStatus === 'connected' ? 'bg-green-400' : 
                        connectionStatus === 'error' ? 'bg-red-400' : 'bg-gray-400'
                      } animate-pulse`}></div>
                    </div>
                    
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <div>操作员: {session.username}</div>
                      <div>登录时间: {new Date(session.loginTime).toLocaleTimeString('zh-CN')}</div>
                      <div>设备状态: {onlineDevices}/{devices.length} 在线</div>
                      {session.workstation.location && (
                        <div>位置: {session.workstation.location}</div>
                      )}
                    </div>

                    {/* 设备详情 */}
                    {devices.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <div className="text-xs font-medium text-gray-700 dark:text-gray-300">设备详情:</div>
                        {devices.map((device) => (
                          <div key={device.deviceId} className="flex items-center justify-between text-xs">
                            <span className="text-gray-600 dark:text-gray-400">
                              {device.deviceName} ({device.deviceType})
                            </span>
                            <div className="flex items-center">
                              <div className={`w-2 h-2 rounded-full mr-1 ${getStatusColor(device.status, device.isOnline)}`}></div>
                              <span className={`text-xs ${device.isOnline ? 'text-green-600' : 'text-gray-500'}`}>
                                {device.isOnline ? '在线' : '离线'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 实时事件 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            实时事件
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {realTimeEvents.length === 0 ? (
              <p className="text-gray-500 text-center py-4">暂无实时事件</p>
            ) : (
              realTimeEvents
                .filter(event => !selectedWorkstation || event.workstationId === selectedWorkstation)
                .map((event) => (
                  <div key={event.id} className={`border rounded-lg p-3 ${getSeverityColor(event.severity)}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {event.message}
                        </div>
                        {event.workstationName && (
                          <div className="text-xs opacity-75 mt-1">
                            工位: {event.workstationName}
                          </div>
                        )}
                        <div className="text-xs opacity-75 mt-1">
                          {formatDateTime(event.timestamp)}
                        </div>
                      </div>
                      <span className="text-xs font-medium">
                        {event.type.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* 操作日志 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            操作日志
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {operationLogs.length === 0 ? (
              <p className="text-gray-500 text-center py-4">暂无操作日志</p>
            ) : (
              operationLogs
                .filter(log => !selectedWorkstation || log.workstationId === selectedWorkstation)
                .map((log) => (
                  <div key={log.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {log.operation}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          结果: <span className={`font-medium ${log.result === '成功' ? 'text-green-600' : 'text-red-600'}`}>
                            {log.result}
                          </span>
                        </div>
                        {log.workstationName && (
                          <div className="text-xs text-gray-500 mt-1">
                            工位: {log.workstationName}
                          </div>
                        )}
                        {log.username && (
                          <div className="text-xs text-gray-500">
                            操作员: {log.username}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          {formatDateTime(log.timestamp)}
                        </div>
                      </div>
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {log.type.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {/* 统计概览 */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="text-3xl text-blue-500">🏭</div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                活跃工位
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {workstationSessions.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="text-3xl text-green-500">⚙️</div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                在线设备
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Object.values(allDeviceStatuses).flat().filter(d => d.isOnline).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="text-3xl text-yellow-500">📊</div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                实时事件
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {realTimeEvents.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="text-3xl text-purple-500">📝</div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                操作日志
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {operationLogs.length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}