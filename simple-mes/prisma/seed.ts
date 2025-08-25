import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // 创建默认权限
  const permissions = [
    { name: 'users:create', description: '创建用户', resource: 'users', action: 'create' },
    { name: 'users:read', description: '查看用户', resource: 'users', action: 'read' },
    { name: 'users:update', description: '更新用户', resource: 'users', action: 'update' },
    { name: 'users:delete', description: '删除用户', resource: 'users', action: 'delete' },
    { name: 'clients:create', description: '创建客户端', resource: 'clients', action: 'create' },
    { name: 'clients:read', description: '查看客户端', resource: 'clients', action: 'read' },
    { name: 'clients:update', description: '更新客户端', resource: 'clients', action: 'update' },
    { name: 'clients:delete', description: '删除客户端', resource: 'clients', action: 'delete' },
    { name: 'workstations:create', description: '创建工位', resource: 'workstations', action: 'create' },
    { name: 'workstations:read', description: '查看工位', resource: 'workstations', action: 'read' },
    { name: 'workstations:update', description: '更新工位', resource: 'workstations', action: 'update' },
    { name: 'workstations:delete', description: '删除工位', resource: 'workstations', action: 'delete' },
    { name: 'devices:create', description: '创建设备', resource: 'devices', action: 'create' },
    { name: 'devices:read', description: '查看设备', resource: 'devices', action: 'read' },
    { name: 'devices:update', description: '更新设备', resource: 'devices', action: 'update' },
    { name: 'devices:delete', description: '删除设备', resource: 'devices', action: 'delete' },
    { name: 'roles:create', description: '创建角色', resource: 'roles', action: 'create' },
    { name: 'roles:read', description: '查看角色', resource: 'roles', action: 'read' },
    { name: 'roles:update', description: '更新角色', resource: 'roles', action: 'update' },
    { name: 'roles:delete', description: '删除角色', resource: 'roles', action: 'delete' },
    { name: 'menus:read', description: '查看菜单', resource: 'menus', action: 'read' },
    { name: 'menus:update', description: '管理菜单', resource: 'menus', action: 'update' },
    { name: 'dashboard:read', description: '查看仪表盘', resource: 'dashboard', action: 'read' },
    { name: 'device-communication:read', description: '查看设备通信', resource: 'device-communication', action: 'read' },
    { name: 'device-communication:create', description: '创建设备通信配置', resource: 'device-communication', action: 'create' },
    { name: 'device-communication:update', description: '更新设备通信配置', resource: 'device-communication', action: 'update' },
    { name: 'device-communication:delete', description: '删除设备通信配置', resource: 'device-communication', action: 'delete' },
    { name: 'device-communication:test', description: '测试设备通信', resource: 'device-communication', action: 'test' },
    { name: 'step-templates:create', description: '创建步骤模板', resource: 'step-templates', action: 'create' },
    { name: 'step-templates:read', description: '查看步骤模板', resource: 'step-templates', action: 'read' },
    { name: 'step-templates:update', description: '更新步骤模板', resource: 'step-templates', action: 'update' },
    { name: 'step-templates:delete', description: '删除步骤模板', resource: 'step-templates', action: 'delete' },
  ]

  const createdPermissions = []
  for (const permission of permissions) {
    const created = await prisma.permission.upsert({
      where: { name: permission.name },
      update: {},
      create: permission
    })
    createdPermissions.push(created)
  }

  // 创建预定义角色
  const roles = [
    { name: 'admin', description: '系统管理员' },
    { name: 'supervisor', description: '班长' },
    { name: 'engineer', description: '工程师' },
    { name: 'operator', description: '普通员工' },
    { name: 'user', description: '普通用户' },
    { name: 'client', description: '客户端用户' }
  ]

  const createdRoles = {}
  for (const role of roles) {
    const created = await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role
    })
    createdRoles[role.name] = created
  }

  // 角色权限分配
  const rolePermissionMap = {
    admin: createdPermissions, // 管理员拥有所有权限
    supervisor: createdPermissions.filter(p => 
      p.resource === 'users' || p.resource === 'dashboard' || p.resource === 'menus' || 
      p.resource === 'devices' || p.resource === 'workstations' || p.resource === 'device-communication' ||
      p.resource === 'step-templates'
    ), // 班长可以管理用户、设备、工位、设备通信、步骤模板和查看仪表盘
    engineer: createdPermissions.filter(p => 
      p.resource === 'clients' || p.resource === 'devices' || p.resource === 'workstations' || 
      p.resource === 'dashboard' || p.resource === 'device-communication' || p.resource === 'step-templates' ||
      (p.resource === 'users' && p.action === 'read')
    ), // 工程师可以管理客户端、设备、工位、设备通信、步骤模板
    operator: createdPermissions.filter(p => 
      p.resource === 'dashboard' && p.action === 'read' ||
      (p.resource === 'device-communication' && (p.action === 'read' || p.action === 'test'))
    ), // 普通员工可以查看仪表盘和进行设备通信测试
    user: createdPermissions.filter(p => 
      p.resource === 'dashboard' && p.action === 'read'
    ), // 普通用户只能查看仪表盘
    client: createdPermissions.filter(p => 
      p.resource === 'clients' && (p.action === 'read' || p.action === 'update')
    ) // 客户端用户只能查看和更新客户端信息
  }

  // 分配权限给角色
  for (const [roleName, permissions] of Object.entries(rolePermissionMap)) {
    const role = createdRoles[roleName]
    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id
          }
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id
        }
      })
    }
  }

  // 创建默认用户
  const hashedAdminPassword = await bcrypt.hash('admin', 12)
  const hashedClientPassword = await bcrypt.hash('client', 12)
  const hashedSupervisorPassword = await bcrypt.hash('supervisor', 12)
  const hashedEngineerPassword = await bcrypt.hash('engineer', 12)
  const hashedOperatorPassword = await bcrypt.hash('operator', 12)

  const users = [
    {
      username: 'admin',
      password: hashedAdminPassword,
      email: 'admin@example.com',
      role: 'ADMIN'
    },
    {
      username: 'supervisor',
      password: hashedSupervisorPassword,
      email: 'supervisor@example.com',
      role: 'SUPERVISOR'
    },
    {
      username: 'engineer',
      password: hashedEngineerPassword,
      email: 'engineer@example.com',
      role: 'ENGINEER'
    },
    {
      username: 'operator',
      password: hashedOperatorPassword,
      email: 'operator@example.com',
      role: 'OPERATOR'
    },
    {
      username: 'client',
      password: hashedClientPassword,
      email: 'client@example.com',
      role: 'CLIENT'
    }
  ]

  const createdUsers = {}
  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: { username: userData.username },
      update: {},
      create: userData
    })
    createdUsers[userData.username] = user
  }

  // 分配角色给用户
  const userRoleMap = {
    admin: 'admin',
    supervisor: 'supervisor',
    engineer: 'engineer',
    operator: 'operator',
    client: 'client'
  }

  for (const [username, roleName] of Object.entries(userRoleMap)) {
    const user = createdUsers[username]
    const role = createdRoles[roleName]
    
    await prisma.userRoleAssignment.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id
        }
      },
      update: {},
      create: {
        userId: user.id,
        roleId: role.id
      }
    })
  }

  // 创建默认菜单
  const menus = [
    {
      name: '仪表盘',
      path: '/admin/dashboard',
      icon: '📊',
      order: 1,
      permissions: JSON.stringify(['dashboard:read'])
    },
    {
      name: '用户管理',
      path: '/admin/users',
      icon: '👥',
      order: 2,
      permissions: JSON.stringify(['users:read'])
    },
    {
      name: '工位管理',
      path: '/admin/workstations',
      icon: '🏭',
      order: 3,
      permissions: JSON.stringify(['workstations:read'])
    },
    {
      name: '步骤模板管理',
      path: '/admin/step-templates',
      icon: '📋',
      order: 4,
      permissions: JSON.stringify(['step-templates:read'])
    },
    {
      name: '设备管理',
      path: '/admin/devices',
      icon: '🔧',
      order: 5,
      permissions: JSON.stringify(['devices:read'])
    },
    {
      name: '设备通信管理',
      path: '/admin/device-communication',
      icon: '📡',
      order: 6,
      permissions: JSON.stringify(['device-communication:read'])
    },
    {
      name: '客户端配置',
      path: '/admin/clients',
      icon: '💻',
      order: 7,
      permissions: JSON.stringify(['clients:read'])
    },
    {
      name: '角色权限',
      path: '/admin/roles',
      icon: '🔐',
      order: 8,
      permissions: JSON.stringify(['roles:read'])
    },
    {
      name: '系统设置',
      path: '/admin/settings',
      icon: '⚙️',
      order: 9,
      permissions: JSON.stringify(['menus:update'])
    }
  ]

  for (const menu of menus) {
    const existingMenu = await prisma.menu.findFirst({
      where: { name: menu.name }
    })
    if (!existingMenu) {
      await prisma.menu.create({
        data: menu
      })
    }
  }

  // 创建默认客户端配置
  const existingClient = await prisma.client.findUnique({
    where: { clientId: 'CLIENT-001' }
  })
  if (!existingClient) {
    await prisma.client.create({
      data: {
        clientId: 'CLIENT-001',
        name: '默认客户端',
        configuredIp: '192.168.1.100',
        status: 'offline',
        settings: {
          autoConnect: true,
          timeout: 30000,
          retryCount: 3
        }
      }
    })
  }

  // 创建默认工位
  const existingWorkstation = await prisma.workstation.findUnique({
    where: { workstationId: 'WS-001' }
  })
  let workstation;
  if (!existingWorkstation) {
    workstation = await prisma.workstation.create({
      data: {
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
  } else {
    workstation = existingWorkstation;
  }

  // 为工位创建设备
  const deviceData = [
    {
      deviceId: 'AUTOSTART',
      name: 'AUTOSTART',
      type: 'PLC_CONTROLLER',
      brand: 'Siemens',
      model: 'S7-1200',
      description: 'Siemens PLC line input',
      ipAddress: '192.168.1.100',
      port: 502,
      protocol: 'TCP',
      status: 'ONLINE',
      isOnline: true
    },
    {
      deviceId: 'CLECO_BIG',
      name: 'CLECO BIG',
      type: 'SCREWDRIVER_CONTROLLER',
      brand: 'CLECO',
      model: 'PF 3000/4000',
      description: 'PF 3000/4000 senzor 4',
      ipAddress: '192.168.1.101',
      port: 502,
      protocol: 'TCP',
      status: 'ONLINE',
      isOnline: true
    },
    {
      deviceId: 'CLECO_BIG_WIRED',
      name: 'CLECO BIG WIRED',
      type: 'SCREWDRIVER_CONTROLLER',
      brand: 'CLECO',
      model: 'PF 3000/4000',
      description: 'PF 3000/4000 senzor 1',
      ipAddress: '192.168.1.102',
      port: 502,
      protocol: 'TCP',
      status: 'ONLINE',
      isOnline: true
    },
    {
      deviceId: 'CLECO_SMALL',
      name: 'CLECO SMALL',
      type: 'SCREWDRIVER_CONTROLLER',
      brand: 'CLECO',
      model: 'PF 3000/4000',
      description: 'PF 3000/4000 senzor 2',
      ipAddress: '192.168.1.103',
      port: 502,
      protocol: 'TCP',
      status: 'OFFLINE',
      isOnline: false
    },
    {
      deviceId: 'EKF_PLC',
      name: 'EKF PLC_10.102.10.33',
      type: 'PLC_CONTROLLER',
      brand: 'Siemens',
      model: 'SIMATIC Step7/300',
      description: 'PLC1 SIMATIC Step7 / 300',
      ipAddress: '10.102.10.33',
      port: 102,
      protocol: 'TCP',
      status: 'ONLINE',
      isOnline: true
    },
    {
      deviceId: 'HONEYWELL_SCANNER',
      name: 'HONEYWELL SCANNER',
      type: 'BARCODE_SCANNER',
      brand: 'Honeywell',
      model: 'Voyager 1200g',
      description: 'BarCode reader 1',
      ipAddress: '192.168.1.104',
      port: 9100,
      protocol: 'TCP',
      status: 'ONLINE',
      isOnline: true
    },
    {
      deviceId: 'IFM_CAMERA_LEFT',
      name: 'IFM CAMERA CRASH(LH)',
      type: 'CAMERA',
      brand: 'IFM',
      model: 'O2D220',
      description: 'IFM Camera 2',
      ipAddress: '192.168.1.105',
      port: 80,
      protocol: 'HTTP',
      status: 'ONLINE',
      isOnline: true
    },
    {
      deviceId: 'IFM_CAMERA_RIGHT',
      name: 'IFM CAMERA CRASH(RH)',
      type: 'CAMERA',
      brand: 'IFM',
      model: 'O2D220',
      description: 'IFM Camera 1',
      ipAddress: '192.168.1.106',
      port: 80,
      protocol: 'HTTP',
      status: 'ONLINE',
      isOnline: true
    },
    {
      deviceId: 'IFM_SCANNER_BEAM',
      name: 'IFM SCANNER (BumperBeam)',
      type: 'BARCODE_SCANNER',
      brand: 'IFM',
      model: 'LR3000',
      description: 'IFM Multicode 2',
      ipAddress: '192.168.1.107',
      port: 80,
      protocol: 'HTTP',
      status: 'ERROR',
      isOnline: false
    },
    {
      deviceId: 'IFM_SCANNER_CARRIER',
      name: 'IFM SCANNER (Carrier)',
      type: 'BARCODE_SCANNER',
      brand: 'IFM',
      model: 'LR3000',
      description: 'IFM Multicode 3',
      ipAddress: '192.168.1.108',
      port: 80,
      protocol: 'HTTP',
      status: 'ONLINE',
      isOnline: true
    },
    {
      deviceId: 'IFM_SCANNER_FEM',
      name: 'IFM SCANNER (FEM LABEL)',
      type: 'BARCODE_SCANNER',
      brand: 'IFM',
      model: 'LR3000',
      description: 'IFM Multicode 1',
      ipAddress: '192.168.1.109',
      port: 80,
      protocol: 'HTTP',
      status: 'ONLINE',
      isOnline: true
    },
    {
      deviceId: 'KEYENCE_SCANNER',
      name: 'KEYENCE SCANNER',
      type: 'BARCODE_SCANNER',
      brand: 'Keyence',
      model: 'SR751',
      description: 'Keyence SR751',
      ipAddress: '192.168.1.110',
      port: 8000,
      protocol: 'TCP',
      status: 'ONLINE',
      isOnline: true
    },
    {
      deviceId: 'SYS',
      name: 'SYS',
      type: 'OTHER',
      brand: 'System',
      model: 'System',
      description: 'System',
      status: 'ONLINE',
      isOnline: true
    },
    {
      deviceId: 'ZEBRA',
      name: 'ZEBRA',
      type: 'PRINTER',
      brand: 'Zebra',
      model: 'ZT410',
      description: 'Zebra Label Printer',
      ipAddress: '192.168.1.111',
      port: 9100,
      protocol: 'TCP',
      status: 'OFFLINE',
      isOnline: false
    }
  ];

  // 创建设备并关联到工位
  for (const device of deviceData) {
    const existingDevice = await prisma.device.findUnique({
      where: { deviceId: device.deviceId }
    });
    
    if (!existingDevice) {
      await prisma.device.create({
        data: {
          ...device,
          workstationId: workstation.id, // 关联到工位
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }
  }

  // 创建零件数据
  const partsData = [
    { partNumber: 'A1776008801', name: '-Z177 MOPF', sapDescription: 'LU VORBAU WV177 MOPF AMG Line + Entry' },
    { partNumber: 'A1776008802', name: '-Z178 MOPF', sapDescription: 'LU VORBAU WV178 MOPF AMG Line + Entry' },
    { partNumber: 'A1776008803', name: '-Z179 MOPF', sapDescription: 'LU VORBAU WV179 MOPF AMG Line + Entry' },
    { partNumber: 'A1776008804', name: '-Z180 MOPF', sapDescription: 'LU VORBAU WV180 MOPF AMG Line + Entry' },
    { partNumber: 'A1776008805', name: '-Z181 MOPF', sapDescription: 'LU VORBAU WV181 MOPF AMG Line + Entry' },
    { partNumber: 'EB001-V8-2024', name: 'Engine Block V8', sapDescription: 'V8 Engine Block 4.0L Turbo AMG' },
    { partNumber: 'TR009-DCT-AMG', name: 'Transmission 9G-DCT', sapDescription: '9-Speed Dual Clutch Transmission AMG' },
    { partNumber: 'BD001-FR-AMG', name: 'Brake Disc Front', sapDescription: 'Front Brake Disc 390mm AMG Performance' },
    { partNumber: 'BD002-RR-AMG', name: 'Brake Disc Rear', sapDescription: 'Rear Brake Disc 360mm AMG Performance' },
    { partNumber: 'SS001-AMG-ADJ', name: 'Suspension Strut', sapDescription: 'Adjustable Suspension Strut AMG' },
    { partNumber: 'WH001-20-AMG', name: 'Wheel Hub Assembly', sapDescription: '20 Inch Wheel Hub Assembly AMG' },
    { partNumber: 'AF001-V8-HP', name: 'Air Filter', sapDescription: 'High Performance Air Filter V8 Engine' },
    { partNumber: 'OF001-V8-SYN', name: 'Oil Filter', sapDescription: 'Synthetic Oil Filter V8 Engine' },
    { partNumber: 'FP001-HP-AMG', name: 'Fuel Pump', sapDescription: 'High Pressure Fuel Pump AMG' },
    { partNumber: 'ECU001-AMG-V8', name: 'ECU Module', sapDescription: 'Engine Control Unit AMG V8 Turbo' },
    { partNumber: 'TC001-L-V8', name: 'Turbocharger Left', sapDescription: 'Left Turbocharger V8 Engine' },
    { partNumber: 'TC002-R-V8', name: 'Turbocharger Right', sapDescription: 'Right Turbocharger V8 Engine' },
    { partNumber: 'EM001-V8-AMG', name: 'Exhaust Manifold', sapDescription: 'Exhaust Manifold V8 AMG Performance' },
    { partNumber: 'RA001-V8-LC', name: 'Radiator Assembly', sapDescription: 'Large Capacity Radiator V8 Engine' },
    { partNumber: 'IC001-V8-HP', name: 'Intercooler', sapDescription: 'High Performance Intercooler V8 Turbo' }
  ];

  for (const partData of partsData) {
    await prisma.part.upsert({
      where: { partNumber: partData.partNumber },
      update: {},
      create: {
        partNumber: partData.partNumber,
        name: partData.name,
        sapDescription: partData.sapDescription,
        visible: true,
        status: 'active'
      }
    });
  }

  console.log('数据库种子数据已创建')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })