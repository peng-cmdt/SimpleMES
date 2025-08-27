const { PrismaClient } = require('@prisma/client');

async function checkDatabase() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Database Analysis\n');
    
    // 检查设备数量和详情
    const devices = await prisma.device.findMany({
      include: {
        workstation: {
          select: { name: true, workstationId: true }
        }
      }
    });
    
    console.log(`📱 Devices Found: ${devices.length}`);
    devices.forEach((device, index) => {
      console.log(`${index + 1}. ${device.name} (${device.type}) - Status: ${device.status}`);
    });
    
    // 检查工位数量
    const workstations = await prisma.workstation.findMany();
    console.log(`\n🏭 Workstations Found: ${workstations.length}`);
    workstations.forEach((ws, index) => {
      console.log(`${index + 1}. ${ws.name} (${ws.workstationId}) - Status: ${ws.status}`);
    });
    
    // 检查产品数量
    const products = await prisma.product.findMany();
    console.log(`\n📦 Products Found: ${products.length}`);
    
    // 检查订单数量
    const orders = await prisma.order.findMany();
    console.log(`📋 Orders Found: ${orders.length}`);
    
    // 检查零件数量
    const parts = await prisma.part.findMany();
    console.log(`🔩 Parts Found: ${parts.length}`);
    
    // 检查角色和权限
    const roles = await prisma.role.findMany();
    console.log(`👑 Roles Found: ${roles.length}`);
    
    const permissions = await prisma.permission.findMany();
    console.log(`🔐 Permissions Found: ${permissions.length}`);
    
  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();