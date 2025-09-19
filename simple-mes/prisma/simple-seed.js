const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('Starting simple seed...')

  try {
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

    // 创建操作员用户
    const operatorPassword = await bcrypt.hash('operator', 10)
    const operatorUser = await prisma.user.upsert({
      where: { username: 'operator' },
      update: {},
      create: {
        username: 'operator',
        email: 'operator@example.com',
        password: operatorPassword,
        role: 'OPERATOR',
        status: 'active'
      }
    })
    console.log('Created operator user')

    // 创建工程师用户
    const engineerPassword = await bcrypt.hash('engineer', 10)
    const engineerUser = await prisma.user.upsert({
      where: { username: 'engineer' },
      update: {},
      create: {
        username: 'engineer',
        email: 'engineer@example.com',
        password: engineerPassword,
        role: 'ENGINEER',
        status: 'active'
      }
    })
    console.log('Created engineer user')

    // 创建监督员用户
    const supervisorPassword = await bcrypt.hash('supervisor', 10)
    const supervisorUser = await prisma.user.upsert({
      where: { username: 'supervisor' },
      update: {},
      create: {
        username: 'supervisor',
        email: 'supervisor@example.com',
        password: supervisorPassword,
        role: 'SUPERVISOR',
        status: 'active'
      }
    })
    console.log('Created supervisor user')

    // 创建客户用户
    const clientPassword = await bcrypt.hash('client', 10)
    const clientUser = await prisma.user.upsert({
      where: { username: 'client' },
      update: {},
      create: {
        username: 'client',
        email: 'client@example.com',
        password: clientPassword,
        role: 'CLIENT',
        status: 'active'
      }
    })
    console.log('Created client user')

    // 创建工位M1
    const workstationM1 = await prisma.workstation.upsert({
      where: { workstationId: 'M1' },
      update: {},
      create: {
        workstationId: 'M1',
        name: '装配工位M1',
        description: '主要装配工位',
        location: '车间A区',
        type: 'VISUAL_CLIENT',
        configuredIp: '192.168.1.100',
        status: 'offline'
      }
    })
    console.log('Created workstation M1')

    console.log('Simple seed completed successfully!')
  } catch (error) {
    console.error('Error during seed:', error)
    throw error
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })