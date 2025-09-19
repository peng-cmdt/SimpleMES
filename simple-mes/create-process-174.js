const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createProcess174() {
  try {
    console.log('=== 创建工艺174 ===');
    
    // 1. 先检查是否已存在工艺174
    const existingProcess = await prisma.process.findFirst({
      where: {
        OR: [
          { name: '174' },
          { processCode: '174' }
        ]
      }
    });
    
    if (existingProcess) {
      console.log(`❌ 工艺174已存在: ${existingProcess.name} (${existingProcess.id})`);
      return;
    }
    
    // 2. 获取订单T001使用的产品
    const orderT001 = await prisma.order.findFirst({
      where: { orderNumber: 'T001' },
      include: { product: true }
    });
    
    if (!orderT001) {
      console.log('❌ 未找到订单T001');
      return;
    }
    
    console.log(`✅ 找到订单T001，产品: ${orderT001.product?.name} (${orderT001.product?.productCode})`);
    
    // 3. 获取M0工位和M0.STP01步骤模板
    const m0Workstation = await prisma.workstation.findFirst({
      where: { workstationId: 'M0' }
    });
    
    const m0StepTemplate = await prisma.stepTemplate.findFirst({
      where: { 
        name: 'M0.STP01',
        workstationId: m0Workstation?.id 
      },
      include: {
        actions: true
      }
    });
    
    if (!m0Workstation || !m0StepTemplate) {
      console.log('❌ 未找到M0工位或M0.STP01步骤模板');
      return;
    }
    
    console.log(`✅ 找到M0工位和步骤模板`);
    
    // 4. 创建工艺174
    const process174 = await prisma.process.create({
      data: {
        processCode: '174',
        name: '174',
        description: '工艺路线174 - 包含M0工位步骤',
        version: '1.0',
        productId: orderT001.productId,
        status: 'ACTIVE',
        createdBy: 'system'
      }
    });
    
    console.log(`✅ 创建工艺174: ${process174.id}`);
    
    // 5. 在工艺174中创建M0.STP01步骤
    const step174 = await prisma.step.create({
      data: {
        stepCode: 'M0.STP01.174',
        name: 'M0.STP01',
        description: '工艺174中的M0步骤',
        sequence: 1,
        processId: process174.id,
        workstationId: m0Workstation.id,
        stepTemplateId: m0StepTemplate.id,
        estimatedTime: m0StepTemplate.estimatedTime || 60,
        instructions: m0StepTemplate.instructions,
        createdBy: 'system'
      }
    });
    
    console.log(`✅ 创建步骤: ${step174.name} (${step174.id})`);
    
    // 6. 复制动作
    if (m0StepTemplate.actions && m0StepTemplate.actions.length > 0) {
      for (const templateAction of m0StepTemplate.actions) {
        const action = await prisma.action.create({
          data: {
            actionCode: `${templateAction.actionCode}.174`,
            name: templateAction.name,
            description: templateAction.description,
            type: templateAction.type,
            sequence: templateAction.sequence,
            stepId: step174.id,
            deviceId: templateAction.deviceId,
            deviceAddress: templateAction.deviceAddress,
            expectedValue: templateAction.expectedValue,
            validationRule: templateAction.validationRule,
            parameters: templateAction.parameters,
            isRequired: templateAction.isRequired,
            timeout: templateAction.timeout,
            retryCount: templateAction.retryCount,
            createdBy: 'system'
          }
        });
        
        console.log(`  ✅ 复制动作: ${action.name}`);
      }
    }
    
    // 7. 可选：将订单T001关联到新工艺174
    const updateOrderToProcess174 = false; // 改为true启用
    
    if (updateOrderToProcess174) {
      await prisma.order.update({
        where: { id: orderT001.id },
        data: { processId: process174.id }
      });
      
      console.log(`✅ 已将订单T001关联到工艺174`);
    } else {
      console.log(`ℹ️ 订单T001仍关联原工艺，如需切换请修改updateOrderToProcess174为true`);
    }
    
    // 8. 验证创建结果
    console.log('\n=== 验证创建结果 ===');
    const createdProcess = await prisma.process.findUnique({
      where: { id: process174.id },
      include: {
        steps: {
          include: {
            workstation: true,
            actions: true
          }
        }
      }
    });
    
    console.log(`工艺174:`);
    console.log(`  名称: ${createdProcess?.name}`);
    console.log(`  代码: ${createdProcess?.processCode}`);
    console.log(`  步骤数量: ${createdProcess?.steps?.length || 0}`);
    
    if (createdProcess?.steps) {
      createdProcess.steps.forEach((step, index) => {
        console.log(`  步骤${index + 1}: ${step.name} (工位: ${step.workstation?.workstationId})`);
        console.log(`    动作数量: ${step.actions?.length || 0}`);
      });
    }
    
  } catch (error) {
    console.error('创建工艺174出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createProcess174();