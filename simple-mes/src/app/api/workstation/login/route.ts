import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { workstationId, userId, username, clientIp, autoLogin } = await request.json();
    
    console.log('Workstation login request:', { workstationId, userId, username, clientIp, autoLogin });

    if (!workstationId) {
      return NextResponse.json({ error: 'WorkstationId is required' }, { status: 400 });
    }

    // 验证工位是否存在
    const workstation = await prisma.workstation.findUnique({
      where: { workstationId },
      include: {
        devices: true, // 旧架构设备
        workstationDevices: { // 新架构设备
          include: {
            template: true
          }
        }
      }
    });

    if (!workstation) {
      console.log('Workstation not found:', workstationId);
      return NextResponse.json({ error: 'Workstation not found' }, { status: 404 });
    }
    
    console.log('Workstation found:', {
      id: workstation.id,
      workstationId: workstation.workstationId,
      name: workstation.name,
      devicesCount: workstation.devices?.length || 0,
      workstationDevicesCount: workstation.workstationDevices?.length || 0
    });

    // 如果是自动登录，验证IP地址匹配
    if (autoLogin && clientIp) {
      const workstationIps = workstation.configuredIp ? 
        workstation.configuredIp.split(',').map(ip => ip.trim()) : [];
      
      if (!workstationIps.includes(clientIp)) {
        return NextResponse.json({ 
          success: false,
          error: 'IP_ADDRESS_MISMATCH',
          message: `客户端IP地址 ${clientIp} 与工位配置不匹配`,
          workstationConfiguredIps: workstationIps,
          clientIp: clientIp
        }, { status: 403 });
      }

      // 更新工位当前IP
      await prisma.workstation.update({
        where: { id: workstation.id },
        data: {
          currentIp: clientIp
        }
      });
    }

    // 获取工位配置的设备，支持新旧架构
    let allDevices = [];
    
    // 处理旧架构设备
    if (workstation.devices && workstation.devices.length > 0) {
      allDevices.push(...workstation.devices.map(device => ({
        deviceId: device.deviceId,
        name: device.name,
        type: device.type,
        model: device.model || '',
        ipAddress: device.ipAddress || '',
        port: device.port || 502,
        settings: device.settings || {},
        workstationId: device.workstationId || workstationId,
        isNewArchitecture: false
      })));
    }
    
    // 处理新架构设备
    if (workstation.workstationDevices && workstation.workstationDevices.length > 0) {
      console.log('Processing new architecture devices:', workstation.workstationDevices.length);
      allDevices.push(...workstation.workstationDevices.map(wsDevice => {
        console.log('Processing device:', {
          instanceId: wsDevice.instanceId,
          displayName: wsDevice.displayName,
          templateType: wsDevice.template?.type,
          ipAddress: wsDevice.ipAddress,
          port: wsDevice.port
        });
        return {
          deviceId: wsDevice.instanceId,
          name: wsDevice.displayName,
          type: wsDevice.template?.type || 'OTHER',
          model: wsDevice.template?.model || '',
          ipAddress: wsDevice.ipAddress || '',
          port: wsDevice.port || 502,
          settings: wsDevice.config || {},
          workstationId: workstationId,
          isNewArchitecture: true
        };
      }));
    }
    
    console.log('Found devices for workstation', workstationId, ':', allDevices.length, 'devices');
    
    if (allDevices.length === 0) {
      console.log('No devices found for workstation', workstationId);
      console.log('Workstation devices data:', JSON.stringify(workstation.devices, null, 2));
      console.log('Workstation new devices data:', JSON.stringify(workstation.workstationDevices, null, 2));
      
      return NextResponse.json({ 
        success: false,
        error: 'NO_DEVICES_CONFIGURED',
        message: `No devices configured for workstation ${workstationId}`,
        debug: {
          workstationFound: true,
          workstationId: workstation.workstationId,
          oldDevicesCount: workstation.devices?.length || 0,
          newDevicesCount: workstation.workstationDevices?.length || 0,
          oldDevices: workstation.devices || [],
          newDevices: workstation.workstationDevices || []
        }
      }, { status: 400 });
    }

    // 获取工位配置的设备，转换为C#服务期望的格式
    const workstationDevices = allDevices.map(device => {
      // 映射设备类型到C#枚举值
      let deviceType = 'OTHER'; // 默认值
      switch (device.type?.toUpperCase()) {
        case 'PLC_CONTROLLER':
        case 'PLC':
          deviceType = 'PLC';
          break;
        case 'SCANNER':
          deviceType = 'SCANNER';
          break;
        case 'CAMERA':
          deviceType = 'CAMERA';
          break;
        case 'READER':
          deviceType = 'READER';
          break;
        case 'ROBOT':
          deviceType = 'ROBOT';
          break;
        case 'SENSOR':
          deviceType = 'SENSOR';
          break;
      }

      return {
        id: device.deviceId,
        workstationId: device.workstationId,
        name: device.name,
        deviceType: deviceType,
        model: device.model,
        connection: {
          ipAddress: device.ipAddress,
          port: device.port,
          connectionType: 'TCP',
          timeout: 5000,
          retryCount: 3,
          extraParams: device.settings
        },
        parameters: device.settings,
        isEnabled: true,
        status: 'Disconnected',
        lastConnected: null,
        lastError: null
      };
    });

    // 如果有设备配置，先初始化设备到C#服务
    if (workstationDevices.length > 0) {
      try {
        const initResponse = await fetch(`http://localhost:5000/api/workstation/${workstationId}/devices/initialize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(workstationDevices)
        });

        if (!initResponse.ok) {
          console.error('Failed to initialize devices in C# service');
        }
      } catch (error) {
        console.error('Error initializing devices:', error);
      }
    }

    // 调用C#设备通信服务进行工位登录
    try {
      const loginResponse = await fetch('http://localhost:5000/api/workstation/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workstationId,
          userId,
          username
        })
      });

      const loginResult = await loginResponse.json();

      if (loginResult.success) {
        // 创建工位会话记录
        const session = await prisma.workstationSession.create({
          data: {
            sessionId: loginResult.sessionId,
            workstationId: workstation.id,
            userId: userId || null,
            username: username || null,
            connectedDevices: {
              deviceIds: loginResult.connectedDevices
                .filter((d: any) => d.success)
                .map((d: any) => d.deviceId),
              connections: loginResult.connectedDevices.reduce((acc: any, device: any) => {
                acc[device.deviceId] = device.success ? 'connected' : 'error';
                return acc;
              }, {})
            }
          }
        });

        // 更新工位状态
        await prisma.workstation.update({
          where: { id: workstation.id },
          data: {
            status: 'online',
            lastConnected: new Date()
          }
        });

        return NextResponse.json({
          success: true,
          sessionId: loginResult.sessionId,
          workstation: {
            id: workstation.workstationId,
            workstationId: workstation.workstationId,
            name: workstation.name,
            description: workstation.description,
            location: workstation.location,
            type: workstation.type,
            configuredIp: workstation.configuredIp,
            currentIp: workstation.currentIp
          },
          connectedDevices: loginResult.connectedDevices,
          loginTime: new Date().toISOString(),
          autoMatched: autoLogin && clientIp ? true : false,
          ipValidated: autoLogin && clientIp ? true : false
        });
      } else {
        return NextResponse.json({ 
          error: loginResult.errorMessage || 'Failed to login workstation' 
        }, { status: 500 });
      }
    } catch (error) {
      console.error('Error calling C# service:', error);
      
      // 如果C#服务不可用，创建本地会话
      const session = await prisma.workstationSession.create({
        data: {
          sessionId: `local-${Date.now()}`,
          workstationId: workstation.id,
          userId: userId || null,
          username: username || null,
          connectedDevices: {
            deviceIds: [],
            connections: {}
          }
        }
      });

      return NextResponse.json({
        success: true,
        sessionId: session.sessionId,
        workstation: {
          id: workstation.workstationId,
          workstationId: workstation.workstationId,
          name: workstation.name,
          description: workstation.description,
          location: workstation.location,
          type: workstation.type,
          configuredIp: workstation.configuredIp,
          currentIp: workstation.currentIp
        },
        connectedDevices: [],
        loginTime: new Date().toISOString(),
        autoMatched: autoLogin && clientIp ? true : false,
        ipValidated: autoLogin && clientIp ? true : false,
        warning: 'Device communication service unavailable - working in offline mode'
      });
    }

  } catch (error) {
    console.error('Error in workstation login:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}