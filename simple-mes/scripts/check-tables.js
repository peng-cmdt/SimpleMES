const { PrismaClient } = require('@prisma/client')

async function checkTables() {
  const prisma = new PrismaClient()
  try {
    console.log('检查表是否存在:')
    const tables = ['user', 'workstation', 'device', 'product', 'bom', 'process', 'order', 'part', 'permission', 'role']
    for (const table of tables) {
      try {
        const count = await prisma[table].count()
        console.log(`${table}: ${count} 条记录`)
      } catch (error) {
        console.log(`${table}: 错误 - ${error.message.split('\n')[0]}`)
      }
    }
    await prisma.$disconnect()
  } catch (error) {
    console.log('Error:', error.message)
  }
}

checkTables()