import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('开始创建基础数据...')

  // 1. 创建权限数据
  console.log('创建权限数据...')
  const permissions = [
    // 用户管理
    { name: 'users:read', description: '查看用户', resource: 'users', action: 'read' },
    { name: 'users:create', description: '创建用户', resource: 'users', action: 'create' },
    { name: 'users:update', description: '更新用户', resource: 'users', action: 'update' },
    { name: 'users:delete', description: '删除用户', resource: 'users', action: 'delete' },
    
    // 角色管理
    { name: 'roles:read', description: '查看角色', resource: 'roles', action: 'read' },
    { name: 'roles:create', description: '创建角色', resource: 'roles', action: 'create' },
    { name: 'roles:update', description: '更新角色', resource: 'roles', action: 'update' },
    { name: 'roles:delete', description: '删除角色', resource: 'roles', action: 'delete' },
    
    // 权限管理
    { name: 'permissions:read', description: '查看权限', resource: 'permissions', action: 'read' },
    { name: 'permissions:manage', description: '管理权限', resource: 'permissions', action: 'manage' },
    
    // 菜单管理
    { name: 'menus:read', description: '查看菜单', resource: 'menus', action: 'read' },
    { name: 'menus:create', description: '创建菜单', resource: 'menus', action: 'create' },
    { name: 'menus:update', description: '更新菜单', resource: 'menus', action: 'update' },
    { name: 'menus:delete', description: '删除菜单', resource: 'menus', action: 'delete' },
    
    // 产品管理
    { name: 'products:read', description: '查看产品', resource: 'products', action: 'read' },
    { name: 'products:create', description: '创建产品', resource: 'products', action: 'create' },
    { name: 'products:update', description: '更新产品', resource: 'products', action: 'update' },
    { name: 'products:delete', description: '删除产品', resource: 'products', action: 'delete' },
    
    // BOM管理
    { name: 'boms:read', description: '查看BOM', resource: 'boms', action: 'read' },
    { name: 'boms:create', description: '创建BOM', resource: 'boms', action: 'create' },
    { name: 'boms:update', description: '更新BOM', resource: 'boms', action: 'update' },
    { name: 'boms:delete', description: '删除BOM', resource: 'boms', action: 'delete' },
    
    // 工艺管理
    { name: 'processes:read', description: '查看工艺', resource: 'processes', action: 'read' },
    { name: 'processes:create', description: '创建工艺', resource: 'processes', action: 'create' },
    { name: 'processes:update', description: '更新工艺', resource: 'processes', action: 'update' },
    { name: 'processes:delete', description: '删除工艺', resource: 'processes', action: 'delete' },
    
    // 订单管理
    { name: 'orders:read', description: '查看订单', resource: 'orders', action: 'read' },
    { name: 'orders:create', description: '创建订单', resource: 'orders', action: 'create' },
    { name: 'orders:update', description: '更新订单', resource: 'orders', action: 'update' },
    { name: 'orders:delete', description: '删除订单', resource: 'orders', action: 'delete' },
    { name: 'orders:execute', description: '执行订单', resource: 'orders', action: 'execute' },
    
    // 工位管理
    { name: 'workstations:read', description: '查看工位', resource: 'workstations', action: 'read' },
    { name: 'workstations:create', description: '创建工位', resource: 'workstations', action: 'create' },
    { name: 'workstations:update', description: '更新工位', resource: 'workstations', action: 'update' },
    { name: 'workstations:delete', description: '删除工位', resource: 'workstations', action: 'delete' },
    { name: 'workstations:control', description: '控制工位', resource: 'workstations', action: 'control' },
    
    // 设备管理
    { name: 'devices:read', description: '查看设备', resource: 'devices', action: 'read' },
    { name: 'devices:create', description: '创建设备', resource: 'devices', action: 'create' },
    { name: 'devices:update', description: '更新设备', resource: 'devices', action: 'update' },
    { name: 'devices:delete', description: '删除设备', resource: 'devices', action: 'delete' },
    { name: 'devices:control', description: '控制设备', resource: 'devices', action: 'control' },
    
    // 客户端管理
    { name: 'clients:read', description: '查看客户端', resource: 'clients', action: 'read' },
    { name: 'clients:create', description: '创建客户端', resource: 'clients', action: 'create' },
    { name: 'clients:update', description: '更新客户端', resource: 'clients', action: 'update' },
    { name: 'clients:delete', description: '删除客户端', resource: 'clients', action: 'delete' },
    
    // 数据导出
    { name: 'export:data', description: '导出数据', resource: 'export', action: 'data' },
    
    // 仪表盘
    { name: 'dashboard:view', description: '查看仪表盘', resource: 'dashboard', action: 'view' },
    
    // 系统配置
    { name: 'system:config', description: '系统配置', resource: 'system', action: 'config' }
  ]

  const createdPermissions = []
  for (const permission of permissions) {
    const created = await prisma.permission.upsert({
      where: { name: permission.name },
      update: permission,
      create: permission
    })
    createdPermissions.push(created)
  }
  console.log(`创建了 ${createdPermissions.length} 个权限`)

  // 2. 创建角色数据
  console.log('创建角色数据...')
  const roles = [
    {
      name: 'ADMIN',
      description: '系统管理员 - 拥有所有权限'
    },
    {
      name: 'SUPERVISOR', 
      description: '主管 - 生产管理和用户管理权限'
    },
    {
      name: 'ENGINEER',
      description: '工程师 - 技术配置和工艺管理权限'
    },
    {
      name: 'OPERATOR',
      description: '操作员 - 生产执行权限'
    },
    {
      name: 'CLIENT',
      description: '客户端 - 工位操作权限'
    }
  ]

  const createdRoles = []
  for (const role of roles) {
    const created = await prisma.role.upsert({
      where: { name: role.name },
      update: role,
      create: role
    })
    createdRoles.push(created)
  }
  console.log(`创建了 ${createdRoles.length} 个角色`)

  // 3. 分配角色权限
  console.log('分配角色权限...')
  
  // 管理员权限 - 所有权限
  const adminRole = createdRoles.find(r => r.name === 'ADMIN')!
  for (const permission of createdPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id
        }
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: permission.id
      }
    })
  }

  // 主管权限
  const supervisorRole = createdRoles.find(r => r.name === 'SUPERVISOR')!
  const supervisorPermissions = createdPermissions.filter(p => 
    p.resource === 'users' || 
    p.resource === 'orders' || 
    p.resource === 'products' ||
    p.resource === 'workstations' ||
    p.resource === 'dashboard' ||
    (p.resource === 'processes' && p.action === 'read') ||
    (p.resource === 'devices' && p.action !== 'delete')
  )
  for (const permission of supervisorPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: supervisorRole.id,
          permissionId: permission.id
        }
      },
      update: {},
      create: {
        roleId: supervisorRole.id,
        permissionId: permission.id
      }
    })
  }

  // 工程师权限
  const engineerRole = createdRoles.find(r => r.name === 'ENGINEER')!
  const engineerPermissions = createdPermissions.filter(p => 
    p.resource === 'products' ||
    p.resource === 'boms' ||
    p.resource === 'processes' ||
    p.resource === 'workstations' ||
    p.resource === 'devices' ||
    p.resource === 'dashboard' ||
    (p.resource === 'orders' && p.action === 'read')
  )
  for (const permission of engineerPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: engineerRole.id,
          permissionId: permission.id
        }
      },
      update: {},
      create: {
        roleId: engineerRole.id,
        permissionId: permission.id
      }
    })
  }

  // 操作员权限
  const operatorRole = createdRoles.find(r => r.name === 'OPERATOR')!
  const operatorPermissions = createdPermissions.filter(p => 
    (p.resource === 'orders' && (p.action === 'read' || p.action === 'execute')) ||
    (p.resource === 'products' && p.action === 'read') ||
    (p.resource === 'processes' && p.action === 'read') ||
    (p.resource === 'workstations' && (p.action === 'read' || p.action === 'control')) ||
    (p.resource === 'devices' && (p.action === 'read' || p.action === 'control')) ||
    p.resource === 'dashboard'
  )
  for (const permission of operatorPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: operatorRole.id,
          permissionId: permission.id
        }
      },
      update: {},
      create: {
        roleId: operatorRole.id,
        permissionId: permission.id
      }
    })
  }

  // 客户端权限
  const clientRole = createdRoles.find(r => r.name === 'CLIENT')!
  const clientPermissions = createdPermissions.filter(p => 
    p.resource === 'dashboard' ||
    (p.resource === 'workstations' && p.action === 'control') ||
    (p.resource === 'orders' && p.action === 'execute')
  )
  for (const permission of clientPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: clientRole.id,
          permissionId: permission.id
        }
      },
      update: {},
      create: {
        roleId: clientRole.id,
        permissionId: permission.id
      }
    })
  }

  // 4. 创建菜单数据
  console.log('创建菜单数据...')
  const menus = [
    {
      name: '仪表盘',
      path: '/admin/dashboard',
      icon: '📊',
      parentId: null,
      order: 1,
      permissions: 'dashboard:view',
      status: 'active'
    },
    {
      name: '生产订单',
      path: '/admin/orders',
      icon: '📋',
      parentId: null,
      order: 2,
      permissions: 'orders:read',
      status: 'active'
    },
    {
      name: '产品管理',
      path: '/admin/products',
      icon: '📦',
      parentId: null,
      order: 3,
      permissions: 'products:read',
      status: 'active'
    },
    {
      name: 'BOM管理',
      path: '/admin/boms',
      icon: '📝',
      parentId: null,
      order: 4,
      permissions: 'boms:read',
      status: 'active'
    },
    {
      name: '工艺管理',
      path: '/admin/processes',
      icon: '⚙️',
      parentId: null,
      order: 5,
      permissions: 'processes:read',
      status: 'active'
    },
    {
      name: '工位管理',
      path: '/admin/workstations',
      icon: '🏭',
      parentId: null,
      order: 6,
      permissions: 'workstations:read',
      status: 'active'
    },
    {
      name: '设备管理',
      path: '/admin/devices',
      icon: '🔧',
      parentId: null,
      order: 7,
      permissions: 'devices:read',
      status: 'active'
    },
    {
      name: '设备通信管理',
      path: '/admin/device-communication',
      icon: '📡',
      parentId: null,
      order: 8,
      permissions: 'devices:control',
      status: 'active'
    },
    {
      name: '数据导出',
      path: '/admin/export',
      icon: '📤',
      parentId: null,
      order: 9,
      permissions: 'export:data',
      status: 'active'
    },
    {
      name: '系统管理',
      path: null,
      icon: '🔧',
      parentId: null,
      order: 10,
      permissions: 'users:read,roles:read,menus:read',
      status: 'active'
    },
    {
      name: '菜单管理',
      path: '/admin/menus',
      icon: '📋',
      parentId: null, // 将在创建后更新为系统管理的ID
      order: 1,
      permissions: 'menus:read',
      status: 'active'
    },
    {
      name: '用户管理',
      path: '/admin/users',
      icon: '👥',
      parentId: null, // 将在创建后更新为系统管理的ID
      order: 2,
      permissions: 'users:read',
      status: 'active'
    },
    {
      name: '角色权限',
      path: '/admin/roles',
      icon: '🔐',
      parentId: null, // 将在创建后更新为系统管理的ID
      order: 3,
      permissions: 'roles:read',
      status: 'active'
    },
    {
      name: '客户端配置',
      path: '/admin/clients',
      icon: '💻',
      parentId: null,
      order: 11,
      permissions: 'clients:read',
      status: 'active'
    }
  ]

  const createdMenus = []
  for (const menu of menus) {
    const existing = await prisma.menu.findFirst({
      where: { 
        name: menu.name,
        parentId: menu.parentId
      }
    })
    
    let created
    if (existing) {
      created = await prisma.menu.update({
        where: { id: existing.id },
        data: menu
      })
    } else {
      created = await prisma.menu.create({
        data: menu
      })
    }
    createdMenus.push(created)
  }

  // 更新子菜单的parentId
  const systemManagementMenu = createdMenus.find(m => m.name === '系统管理')!
  const subMenus = ['菜单管理', '用户管理', '角色权限']
  for (const subMenuName of subMenus) {
    await prisma.menu.updateMany({
      where: { name: subMenuName },
      data: { parentId: systemManagementMenu.id }
    })
  }

  console.log(`创建了 ${createdMenus.length} 个菜单项`)

  // 5. 创建默认用户
  console.log('创建默认用户...')
  const hashedPassword = await bcrypt.hash('admin', 10)
  
  const users = [
    {
      username: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'ADMIN' as const,
      status: 'active'
    },
    {
      username: 'supervisor',
      email: 'supervisor@example.com', 
      password: await bcrypt.hash('supervisor', 10),
      role: 'SUPERVISOR' as const,
      status: 'active'
    },
    {
      username: 'engineer',
      email: 'engineer@example.com',
      password: await bcrypt.hash('engineer', 10),
      role: 'ENGINEER' as const,
      status: 'active'
    },
    {
      username: 'operator',
      email: 'operator@example.com',
      password: await bcrypt.hash('operator', 10),
      role: 'OPERATOR' as const,
      status: 'active'
    },
    {
      username: 'client',
      email: 'client@example.com',
      password: await bcrypt.hash('client', 10),
      role: 'CLIENT' as const,
      status: 'active'
    }
  ]

  const createdUsers = []
  for (const user of users) {
    const created = await prisma.user.upsert({
      where: { username: user.username },
      update: user,
      create: user
    })
    createdUsers.push(created)
  }
  console.log(`创建了 ${createdUsers.length} 个用户`)

  // 6. 分配用户角色
  console.log('分配用户角色...')
  for (const user of createdUsers) {
    const role = createdRoles.find(r => r.name === user.role)!
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

  // 7. 创建基础工位和设备（复用之前的逻辑）
  console.log('创建基础工位和设备...')
  
  // 创建工位M1
  const workstationM1 = await prisma.workstation.upsert({
    where: { workstationId: 'M1' },
    update: {},
    create: {
      workstationId: 'M1',
      name: 'M1',
      description: '主装配工位M1',
      location: '生产线A',
      configuredIp: '192.168.124.5',
      status: 'offline',
      type: 'VISUAL_CLIENT',
      settings: {
        autoConnect: true,
        timeout: 30000,
        retryCount: 3
      }
    }
  })

  // 创建工位WS-001（保留原有的）
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

  // 创建设备模板
  const deviceTemplates = [
    {
      templateId: 'PLC_SIEMENS_S7_1200',
      name: 'PLC SIEMENS',
      type: 'PLC_CONTROLLER' as const,
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
      type: 'BARCODE_SCANNER' as const, 
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
  ]

  const createdTemplates = []
  for (const templateData of deviceTemplates) {
    try {
      const template = await prisma.deviceTemplate.upsert({
        where: { templateId: templateData.templateId },
        update: templateData,
        create: templateData
      })
      createdTemplates.push(template)
    } catch (error) {
      console.error(`创建设备模板错误 ${templateData.name}:`, error)
    }
  }

  console.log('数据库基础数据创建完成!')
  console.log('默认用户账号:')
  console.log('- admin/admin (系统管理员)')
  console.log('- supervisor/supervisor (主管)')
  console.log('- engineer/engineer (工程师)')
  console.log('- operator/operator (操作员)')
  console.log('- client/client (客户端)')
}

main()
  .catch((e) => {
    console.error('种子数据创建失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })