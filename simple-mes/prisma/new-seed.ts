import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed with new device architecture...')

  // 创建默认用户
  const hashedPassword = await bcrypt.hash('admin', 10)
  
  // 创建管理员用户
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'ADMIN',
      status: 'active'
    }
  })
  console.log('Created admin user')

  // 创建工位
  const workstation = await prisma.workstation.upsert({
    where: { workstationId: 'WS-001' },
    update: {},
    create: {
      workstationId: 'WS-001',
      name: '生产工位A',
      description: '主装配工位',
      location: '车间一区',
      configuredIp: '192.168.1.101',
      status: 'offline',
      settings: {
        autoConnect: true,
        timeout: 30000,
        retryCount: 3
      }
    }
  })
  console.log('Created workstation')

  // 创建设备模板（抽象设备定义）
  const deviceTemplates = [
    {
      templateId: 'PLC_SIEMENS_S7_1200',
      name: 'PLC SIEMENS',
      type: 'PLC_CONTROLLER',
      brand: 'SIEMENS',
      model: 'S7_1200',
      driver: 'siemens_s7',
      description: 'Siemens S7-1200 PLC Controller',
      capabilities: {
        read: true,
        write: true,
        monitoring: true
      },
      configSchema: {
        rack: { type: 'number', default: 0, description: 'PLC机架号' },
        slot: { type: 'number', default: 1, description: 'PLC插槽号' }
      }
    },
    {
      templateId: 'BARCODE_SCANNER_HONEYWELL',
      name: '扫码器',
      type: 'BARCODE_SCANNER', 
      brand: 'Honeywell',
      model: 'Voyager 1200g',
      driver: 'honeywell_voyager',
      description: 'Honeywell Voyager 1200g Barcode Scanner',
      capabilities: {
        scan: true,
        continuous_scan: true
      },
      configSchema: {
        timeout: { type: 'number', default: 5000, description: '扫描超时时间(ms)' }
      }
    }
  ];

  console.log('Creating device templates...');
  const createdTemplates = [];
  for (const templateData of deviceTemplates) {
    try {
      const template = await prisma.deviceTemplate.upsert({
        where: { templateId: templateData.templateId },
        update: templateData,
        create: templateData
      });
      console.log(`Created/updated device template: ${template.name}`);
      createdTemplates.push(template);
    } catch (error) {
      console.error(`Error creating device template ${templateData.name}:`, error);
    }
  }

  // 为工位创建具体的设备实例
  if (createdTemplates.length > 0) {
    const plcTemplate = createdTemplates.find(t => t.type === 'PLC_CONTROLLER');
    const scannerTemplate = createdTemplates.find(t => t.type === 'BARCODE_SCANNER');

    const workstationDevices = [];
    
    if (plcTemplate) {
      workstationDevices.push({
        workstationId: workstation.id,
        templateId: plcTemplate.id,
        displayName: 'PLC SIEMENS',
        ipAddress: '127.1.1.0',
        port: 102,
        protocol: 'TCP',
        config: {
          plcType: 'Siemens_S7',
          rack: 0,
          slot: 1
        },
        status: 'OFFLINE',
        isOnline: false
      });
    }

    if (scannerTemplate) {
      workstationDevices.push({
        workstationId: workstation.id,
        templateId: scannerTemplate.id,
        displayName: '扫码器',
        ipAddress: '192.168.1.104',
        port: 9100,
        protocol: 'TCP',
        config: {
          timeout: 5000
        },
        status: 'OFFLINE',
        isOnline: false
      });
    }

    console.log('Creating workstation device instances...');
    for (const deviceData of workstationDevices) {      
      try {
        const existingDevice = await prisma.workstationDevice.findFirst({
          where: {
            workstationId: deviceData.workstationId,
            templateId: deviceData.templateId,
            ipAddress: deviceData.ipAddress,
            port: deviceData.port
          }
        });

        if (!existingDevice) {
          const device = await prisma.workstationDevice.create({
            data: deviceData
          });
          console.log(`Created workstation device: ${device.displayName}`);
        } else {
          console.log(`Workstation device exists: ${existingDevice.displayName}`);
        }
      } catch (error) {
        console.error(`Error creating workstation device ${deviceData.displayName}:`, error);
      }
    }
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });