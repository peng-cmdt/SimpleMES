// React Hook for Device Configuration Synchronization
// 提供设备配置变更时的自动同步功能

import { useCallback, useEffect, useState } from 'react';
import { deviceSyncManager } from './DeviceConfigSyncManager';
import type { SyncResponse } from './DeviceConfigSyncManager';

interface UseDevi ceSyncOptions {
  enableAutoSync?: boolean;
  workstationId?: string;
  onSyncSuccess?: (response: SyncResponse) => void;
  onSyncError?: (error: Error) => void;
}

interface DeviceSyncState {
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncStatus: SyncResponse | null;
  error: Error | null;
}

export function useDeviceSync(options: UseDeviceSyncOptions = {}) {
  const [state, setState] = useState<DeviceSyncState>({
    isConnected: false,
    isSyncing: false,
    lastSyncTime: null,
    syncStatus: null,
    error: null
  });

  // 检查连接状态
  const checkConnection = useCallback(async () => {
    try {
      const isConnected = await deviceSyncManager.checkServiceHealth();
      setState(prev => ({ ...prev, isConnected, error: null }));
      return isConnected;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState(prev => ({ ...prev, isConnected: false, error: err }));
      return false;
    }
  }, []);

  // 同步所有配置
  const syncAll = useCallback(async (): Promise<SyncResponse> => {
    setState(prev => ({ ...prev, isSyncing: true, error: null }));
    
    try {
      const response = await deviceSyncManager.syncAllConfigurations();
      
      setState(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date(),
        syncStatus: response,
        error: response.success ? null : new Error(response.message)
      }));
      
      if (response.success && options.onSyncSuccess) {
        options.onSyncSuccess(response);
      } else if (!response.success && options.onSyncError) {
        options.onSyncError(new Error(response.message));
      }
      
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState(prev => ({
        ...prev,
        isSyncing: false,
        error: err
      }));
      
      if (options.onSyncError) {
        options.onSyncError(err);
      }
      
      throw err;
    }
  }, [options]);

  // 同步工位配置
  const syncWorkstation = useCallback(async (workstationId?: string): Promise<SyncResponse> => {
    const targetWorkstation = workstationId || options.workstationId;
    if (!targetWorkstation) {
      throw new Error('Workstation ID is required');
    }

    setState(prev => ({ ...prev, isSyncing: true, error: null }));
    
    try {
      const response = await deviceSyncManager.syncWorkstationConfigurations(targetWorkstation);
      
      setState(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date(),
        syncStatus: response,
        error: response.success ? null : new Error(response.message)
      }));
      
      if (response.success && options.onSyncSuccess) {
        options.onSyncSuccess(response);
      } else if (!response.success && options.onSyncError) {
        options.onSyncError(new Error(response.message));
      }
      
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState(prev => ({
        ...prev,
        isSyncing: false,
        error: err
      }));
      
      if (options.onSyncError) {
        options.onSyncError(err);
      }
      
      throw err;
    }
  }, [options]);

  // 设备操作后的自动同步
  const handleDeviceChange = useCallback(async (
    operation: 'create' | 'update' | 'delete',
    workstationId: string,
    deviceIds: string[],
    userId?: string
  ): Promise<SyncResponse> => {
    if (!options.enableAutoSync) {
      return {
        success: true,
        message: 'Auto-sync disabled',
        timestamp: new Date().toISOString()
      };
    }

    setState(prev => ({ ...prev, isSyncing: true, error: null }));
    
    try {
      const response = await deviceSyncManager.handleDeviceOperation(
        operation,
        workstationId,
        deviceIds,
        userId
      );
      
      setState(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date(),
        syncStatus: response,
        error: response.success ? null : new Error(response.message)
      }));
      
      if (response.success && options.onSyncSuccess) {
        options.onSyncSuccess(response);
      } else if (!response.success && options.onSyncError) {
        options.onSyncError(new Error(response.message));
      }
      
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState(prev => ({
        ...prev,
        isSyncing: false,
        error: err
      }));
      
      if (options.onSyncError) {
        options.onSyncError(err);
      }
      
      throw err;
    }
  }, [options]);

  // 工位操作后的自动同步
  const handleWorkstationChange = useCallback(async (
    operation: 'create' | 'update' | 'delete',
    workstationId: string,
    userId?: string
  ): Promise<SyncResponse> => {
    if (!options.enableAutoSync) {
      return {
        success: true,
        message: 'Auto-sync disabled',
        timestamp: new Date().toISOString()
      };
    }

    setState(prev => ({ ...prev, isSyncing: true, error: null }));
    
    try {
      const response = await deviceSyncManager.handleWorkstationOperation(
        operation,
        workstationId,
        userId
      );
      
      setState(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date(),
        syncStatus: response,
        error: response.success ? null : new Error(response.message)
      }));
      
      if (response.success && options.onSyncSuccess) {
        options.onSyncSuccess(response);
      } else if (!response.success && options.onSyncError) {
        options.onSyncError(new Error(response.message));
      }
      
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState(prev => ({
        ...prev,
        isSyncing: false,
        error: err
      }));
      
      if (options.onSyncError) {
        options.onSyncError(err);
      }
      
      throw err;
    }
  }, [options]);

  // 获取同步状态
  const getSyncStatus = useCallback(async () => {
    try {
      const status = await deviceSyncManager.getSyncStatus();
      setState(prev => ({ ...prev, error: null }));
      return status;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState(prev => ({ ...prev, error: err }));
      throw err;
    }
  }, []);

  // 初始化时检查连接
  useEffect(() => {
    checkConnection();
    
    // 定期检查连接状态（每30秒）
    const interval = setInterval(checkConnection, 30000);
    
    return () => clearInterval(interval);
  }, [checkConnection]);

  // 配置自动同步
  useEffect(() => {
    if (options.enableAutoSync !== undefined) {
      deviceSyncManager.setAutoSyncEnabled(options.enableAutoSync);
    }
  }, [options.enableAutoSync]);

  return {
    // 状态
    ...state,
    
    // 方法
    checkConnection,
    syncAll,
    syncWorkstation,
    handleDeviceChange,
    handleWorkstationChange,
    getSyncStatus,
    
    // 便捷方法
    syncCurrentWorkstation: useCallback(() => syncWorkstation(), [syncWorkstation]),
    
    // 批量操作辅助方法
    onDeviceCreated: useCallback((workstationId: string, deviceIds: string[], userId?: string) => 
      handleDeviceChange('create', workstationId, deviceIds, userId), [handleDeviceChange]),
    onDeviceUpdated: useCallback((workstationId: string, deviceIds: string[], userId?: string) => 
      handleDeviceChange('update', workstationId, deviceIds, userId), [handleDeviceChange]),
    onDeviceDeleted: useCallback((workstationId: string, deviceIds: string[], userId?: string) => 
      handleDeviceChange('delete', workstationId, deviceIds, userId), [handleDeviceChange]),
    
    onWorkstationCreated: useCallback((workstationId: string, userId?: string) => 
      handleWorkstationChange('create', workstationId, userId), [handleWorkstationChange]),
    onWorkstationUpdated: useCallback((workstationId: string, userId?: string) => 
      handleWorkstationChange('update', workstationId, userId), [handleWorkstationChange]),
    onWorkstationDeleted: useCallback((workstationId: string, userId?: string) => 
      handleWorkstationChange('delete', workstationId, userId), [handleWorkstationChange])
  };
}