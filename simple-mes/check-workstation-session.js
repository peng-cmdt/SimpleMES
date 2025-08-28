const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkWorkstationSession() {
  try {
    console.log('🔍 检查工作站会话数据...');
    
    // 查找最近的工作站会话
    const sessions = await prisma.workstationSession.findMany({
      include: {
        workstation: true,
        user: true
      },
      orderBy: { loginTime: 'desc' },
      take: 5
    });
    
    console.log(`📊 找到 ${sessions.length} 个工作站会话:`);
    
    sessions.forEach((session, index) => {
      console.log(`\n${index + 1}. 会话 ${session.sessionId}`);
      console.log(`   用户: ${session.username || session.user?.username || '未知'}`);
      console.log(`   工作站ID: ${session.workstationId}`);
      console.log(`   工作站存在: ${session.workstation ? '是' : '否'}`);
      if (session.workstation) {
        console.log(`   工作站名称: ${session.workstation.name}`);
        console.log(`   工作站标识: ${session.workstation.workstationId}`);
      }
      console.log(`   登录时间: ${session.loginTime}`);
      console.log(`   是否活跃: ${session.isActive}`);
    });
    
    // 检查所有工作站
    console.log('\n🏭 所有工作站:');
    const workstations = await prisma.workstation.findMany();
    workstations.forEach((ws, index) => {
      console.log(`   ${index + 1}. ${ws.name} (${ws.workstationId}) - ID: ${ws.id}`);
    });
    
    // 测试特定的工作站ID
    const testWorkstationId = 'cmes6s081006htmuwhsl0gpri'; // 从之前的日志中看到的ID
    const testWorkstation = await prisma.workstation.findUnique({
      where: { id: testWorkstationId }
    });
    
    console.log(`\n🧪 测试工作站ID ${testWorkstationId}: ${testWorkstation ? '存在' : '不存在'}`);
    if (testWorkstation) {
      console.log(`   名称: ${testWorkstation.name}`);
      console.log(`   标识: ${testWorkstation.workstationId}`);
    }
    
  } catch (error) {
    console.error('❌ 检查过程中出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkWorkstationSession();