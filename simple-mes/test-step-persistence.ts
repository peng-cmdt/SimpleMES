import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testStepPersistence() {
  console.log('🧪 开始测试步骤保存和数据持久化...')

  try {
    // 1. 检查现有数据
    const processes = await prisma.process.findMany({
      include: {
        product: true,
        steps: {
          include: {
            workstation: true,
            actions: true
          }
        }
      }
    })

    const stepTemplates = await prisma.stepTemplate.findMany({
      include: {
        workstation: true,
        actionTemplates: true
      }
    })

    const workstations = await prisma.workstation.findMany()

    console.log('📊 当前数据库状态:')
    console.log(`- 工艺流程: ${processes.length} 个`)
    console.log(`- 步骤模板: ${stepTemplates.length} 个`)
    console.log(`- 工位: ${workstations.length} 个`)

    if (processes.length > 0) {
      console.log(`- 工艺流程 "${processes[0].name}" 包含 ${processes[0].steps.length} 个步骤`)
    }

    // 2. 测试添加步骤的API数据结构
    if (processes.length > 0 && stepTemplates.length > 0) {
      const testProcess = processes[0]
      const testTemplate = stepTemplates[0]

      console.log('\n🔧 测试数据结构:')
      console.log('测试工艺流程:', {
        id: testProcess.id,
        name: testProcess.name,
        currentStepsCount: testProcess.steps.length
      })

      console.log('测试步骤模板:', {
        id: testTemplate.id,
        stepCode: testTemplate.stepCode,
        name: testTemplate.name,
        workstationId: testTemplate.workstationId,
        workstation: testTemplate.workstation?.name || '无',
        actionTemplatesCount: testTemplate.actionTemplates.length
      })

      // 模拟前端传递的数据结构
      const simulatedStepData = {
        stepCode: testTemplate.stepCode,
        name: testTemplate.name,
        workstationId: testTemplate.workstationId || '',
        sequence: testProcess.steps.length + 1,
        description: testTemplate.description || '',
        estimatedTime: testTemplate.estimatedTime || 0,
        isRequired: testTemplate.isRequired,
        actions: testTemplate.actionTemplates.map((actionTemplate, index) => ({
          actionCode: `A${index + 1}`,
          name: actionTemplate.name,
          type: actionTemplate.type,
          sequence: index + 1,
          deviceId: '',
          deviceAddress: actionTemplate.deviceAddress || '',
          expectedValue: actionTemplate.expectedValue || '',
          validationRule: actionTemplate.validationRule || '',
          parameters: actionTemplate.parameters || {},
          description: actionTemplate.description || '',
        }))
      }

      console.log('\n📝 模拟前端数据结构:', JSON.stringify(simulatedStepData, null, 2))

      // 3. 测试创建步骤 (模拟API调用)
      console.log('\n🚀 模拟创建步骤...')
      
      const maxSequence = testProcess.steps.length > 0
        ? Math.max(...testProcess.steps.map(step => step.sequence))
        : 0

      const createdStep = await prisma.step.create({
        data: {
          processId: testProcess.id,
          stepCode: `${simulatedStepData.stepCode}-TEST`,
          name: `${simulatedStepData.name} (测试)`,
          workstationId: simulatedStepData.workstationId || null,
          sequence: maxSequence + 1,
          description: simulatedStepData.description,
          estimatedTime: simulatedStepData.estimatedTime,
          isRequired: simulatedStepData.isRequired
        }
      })

      console.log('✅ 步骤创建成功:', {
        id: createdStep.id,
        stepCode: createdStep.stepCode,
        name: createdStep.name,
        sequence: createdStep.sequence
      })

      // 4. 验证步骤是否持久化
      const verificationStep = await prisma.step.findUnique({
        where: { id: createdStep.id },
        include: {
          process: true,
          workstation: true,
          actions: true
        }
      })

      if (verificationStep) {
        console.log('✅ 步骤持久化验证成功')
        console.log('持久化的步骤数据:', {
          id: verificationStep.id,
          stepCode: verificationStep.stepCode,
          name: verificationStep.name,
          processName: verificationStep.process.name,
          workstationName: verificationStep.workstation?.name || '无',
          sequence: verificationStep.sequence
        })

        // 清理测试数据
        await prisma.step.delete({ where: { id: createdStep.id } })
        console.log('🧹 测试数据已清理')
      } else {
        console.log('❌ 步骤持久化验证失败')
      }
    } else {
      console.log('⚠️  无足够测试数据，请先运行备份种子文件')
    }

  } catch (error) {
    console.error('❌ 测试失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testStepPersistence()