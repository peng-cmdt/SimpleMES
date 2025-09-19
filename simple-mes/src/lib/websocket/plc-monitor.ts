// PLC实时监控器
import { DeviceManager, PLCAddress } from './device-manager';
import { WebSocketServer } from './server';

export interface MonitorTask {
  subscriptionKey: string;
  deviceId: string;
  address: PLCAddress;
  interval: number;
  timer?: NodeJS.Timeout;
  lastValue?: any;
  lastUpdate?: Date;
  errorCount: number;
}

export class PLCMonitor {
  private tasks: Map<string, MonitorTask> = new Map();
  private deviceManager: DeviceManager;
  private wsServer: WebSocketServer;
  private readonly MAX_ERROR_COUNT = 5;
  
  constructor(deviceManager: DeviceManager, wsServer: WebSocketServer) {
    this.deviceManager = deviceManager;
    this.wsServer = wsServer;
  }
  
  // 开始监控
  public async startMonitoring(
    deviceId: string,
    addressStr: string,
    interval: number,
    subscriptionKey: string
  ): Promise<void> {
    // 如果已经在监控，先停止
    if (this.tasks.has(subscriptionKey)) {
      await this.stopMonitoring(subscriptionKey);
    }
    
    // 解析地址
    const address = this.parseAddress(addressStr);
    
    // 创建监控任务
    const task: MonitorTask = {
      subscriptionKey,
      deviceId,
      address,
      interval: Math.max(interval, 50), // 最小50ms
      errorCount: 0
    };
    
    // 立即读取一次
    await this.readAndBroadcast(task);
    
    // 设置定时监控
    task.timer = setInterval(async () => {
      await this.readAndBroadcast(task);
    }, task.interval);
    
    this.tasks.set(subscriptionKey, task);
    

  }
  
  // 停止监控
  public async stopMonitoring(subscriptionKey: string): Promise<void> {
    const task = this.tasks.get(subscriptionKey);
    if (!task) return;
    
    // 清除定时器
    if (task.timer) {
      clearInterval(task.timer);
    }
    
    this.tasks.delete(subscriptionKey);
    

  }
  
  // 读取并广播数据
  private async readAndBroadcast(task: MonitorTask): Promise<void> {
    try {
      // 读取PLC值
      const value = await this.deviceManager.readPLC(task.deviceId, task.address);
      
      // 检查值是否变化（可选的优化）
      const hasChanged = task.lastValue !== value;
      
      // 更新任务状态
      task.lastValue = value;
      task.lastUpdate = new Date();
      task.errorCount = 0;
      
      // 广播数据更新（即使值没变化也推送，保证实时性）
      this.wsServer.broadcastPLCUpdate(task.subscriptionKey, {
        deviceId: task.deviceId,
        address: task.address.address,
        value: value,
        changed: hasChanged,
        timestamp: task.lastUpdate.getTime()
      });
      
    } catch (error) {
      task.errorCount++;
      

      
      // 广播错误
      this.wsServer.broadcastPLCUpdate(task.subscriptionKey, {
        deviceId: task.deviceId,
        address: task.address.address,
        error: error instanceof Error ? error.message : 'Read failed',
        timestamp: Date.now()
      });
      
      // 错误次数过多，自动停止监控
      if (task.errorCount >= this.MAX_ERROR_COUNT) {

        await this.stopMonitoring(task.subscriptionKey);
      }
    }
  }
  
  // 解析PLC地址
  private parseAddress(addressStr: string): PLCAddress {
    let cleanAddress = addressStr.trim();
    let expectedValue = '1';
    
    // 分离地址和期望值
    if (addressStr.includes('=')) {
      const parts = addressStr.split('=');
      cleanAddress = parts[0].trim();
      expectedValue = parts[1].trim();
    }
    
    // 解析DB格式地址
    const dbMatch = cleanAddress.match(/DB(\d+)\.DBX(\d+)\.(\d+)/);
    if (dbMatch) {
      return {
        type: 'DB',
        dbNumber: parseInt(dbMatch[1]),
        byte: parseInt(dbMatch[2]),
        bit: parseInt(dbMatch[3]),
        address: cleanAddress
      };
    }
    
    // 解析其他格式...
    
    // 默认返回
    return {
      type: 'DB',
      dbNumber: 0,
      byte: 0,
      bit: 0,
      address: cleanAddress
    };
  }
  
  // 批量监控
  public async startBatchMonitoring(
    deviceId: string,
    addresses: string[],
    interval: number
  ): Promise<string[]> {
    const subscriptionKeys: string[] = [];
    
    for (const address of addresses) {
      const subscriptionKey = `plc:${deviceId}:${address}`;
      await this.startMonitoring(deviceId, address, interval, subscriptionKey);
      subscriptionKeys.push(subscriptionKey);
    }
    
    return subscriptionKeys;
  }
  
  // 停止批量监控
  public async stopBatchMonitoring(subscriptionKeys: string[]): Promise<void> {
    for (const key of subscriptionKeys) {
      await this.stopMonitoring(key);
    }
  }
  
  // 获取监控状态
  public getMonitoringStatus(): any[] {
    const status: any[] = [];
    
    for (const [key, task] of this.tasks) {
      status.push({
        subscriptionKey: key,
        deviceId: task.deviceId,
        address: task.address.address,
        interval: task.interval,
        lastValue: task.lastValue,
        lastUpdate: task.lastUpdate,
        errorCount: task.errorCount,
        isActive: !!task.timer
      });
    }
    
    return status;
  }
  
  // 清理所有监控任务
  public async cleanup(): Promise<void> {
    for (const subscriptionKey of this.tasks.keys()) {
      await this.stopMonitoring(subscriptionKey);
    }
    
    this.tasks.clear();
  }
}