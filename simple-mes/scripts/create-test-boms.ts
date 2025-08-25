import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 生成测试BOM数据
function generateTestBOMs(count: number) {
  const boms = []
  
  // 产品类别
  const categories = ['手机', '电脑', '平板', '手表', '耳机', '音响', '摄像头', '路由器', '充电器', '数据线']
  
  // 版本号
  const versions = ['1.0', '1.1', '1.2', '2.0', '2.1', '3.0', '3.1', '4.0', '5.0']
  
  // 状态
  const statuses = ['active', 'inactive']
  
  for (let i = 1; i <= count; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)]
    const version = versions[Math.floor(Math.random() * versions.length)]
    const status = i <= count * 0.8 ? 'active' : statuses[Math.floor(Math.random() * statuses.length)] // 80%为启用状态
    
    const bom = {
      bomCode: `BOM-${String(i).padStart(4, '0')}`,
      name: `${category}组装清单-${String(i).padStart(3, '0')}`,
      version: version,
      description: `${category}产品的物料清单，包含主要组件和辅助材料，版本${version}`,
      status: status,
      bomItems: generateBOMItems(category, i)
    }
    
    boms.push(bom)
  }
  
  return boms
}

// 为每个BOM生成物料明细
function generateBOMItems(category: string, bomIndex: number) {
  const items = []
  
  // 根据产品类别生成不同的物料
  const materialsByCategory = {
    '手机': [
      { code: 'CPU', name: '处理器芯片', units: ['个', '片'] },
      { code: 'MEM', name: '内存模块', units: ['个', '片'] },
      { code: 'BAT', name: '电池组', units: ['个', '块'] },
      { code: 'SCR', name: '显示屏', units: ['个', '片'] },
      { code: 'CAM', name: '摄像头模组', units: ['个'] },
      { code: 'SPK', name: '扬声器', units: ['个'] },
      { code: 'MIC', name: '麦克风', units: ['个'] },
      { code: 'PCB', name: '主板', units: ['个', '片'] }
    ],
    '电脑': [
      { code: 'CPU', name: 'CPU处理器', units: ['个'] },
      { code: 'GPU', name: '显卡', units: ['个', '片'] },
      { code: 'RAM', name: '内存条', units: ['个', '条'] },
      { code: 'SSD', name: '固态硬盘', units: ['个'] },
      { code: 'MB', name: '主板', units: ['个', '片'] },
      { code: 'PSU', name: '电源', units: ['个'] },
      { code: 'FAN', name: '散热风扇', units: ['个'] },
      { code: 'CASE', name: '机箱', units: ['个'] }
    ],
    '平板': [
      { code: 'SOC', name: '系统芯片', units: ['个', '片'] },
      { code: 'LCD', name: 'LCD屏幕', units: ['个', '片'] },
      { code: 'TP', name: '触摸面板', units: ['个', '片'] },
      { code: 'BAT', name: '锂电池', units: ['个'] },
      { code: 'CAM', name: '摄像头', units: ['个'] },
      { code: 'SPK', name: '立体声扬声器', units: ['个'] }
    ],
    '手表': [
      { code: 'MCU', name: '微控制器', units: ['个', '片'] },
      { code: 'OLED', name: 'OLED显示屏', units: ['个', '片'] },
      { code: 'BAT', name: '纽扣电池', units: ['个'] },
      { code: 'SEN', name: '传感器模组', units: ['个', '套'] },
      { code: 'STRAP', name: '表带', units: ['个', '条'] },
      { code: 'CASE', name: '表壳', units: ['个'] }
    ],
    '耳机': [
      { code: 'DRV', name: '驱动单元', units: ['个', '对'] },
      { code: 'CABLE', name: '音频线缆', units: ['根', '米'] },
      { code: 'PLUG', name: '音频插头', units: ['个'] },
      { code: 'PAD', name: '耳垫', units: ['个', '对'] },
      { code: 'BAND', name: '头带', units: ['个'] }
    ],
    '音响': [
      { code: 'WOOF', name: '低音单元', units: ['个'] },
      { code: 'TWEET', name: '高音单元', units: ['个'] },
      { code: 'AMP', name: '功放电路', units: ['个', '片'] },
      { code: 'CASE', name: '音箱外壳', units: ['个'] },
      { code: 'GRILL', name: '防护网', units: ['个', '片'] }
    ],
    '摄像头': [
      { code: 'LENS', name: '镜头组件', units: ['个', '套'] },
      { code: 'CCD', name: '图像传感器', units: ['个', '片'] },
      { code: 'PCB', name: '控制电路板', units: ['个', '片'] },
      { code: 'CASE', name: '外壳', units: ['个'] },
      { code: 'CABLE', name: '数据线', units: ['根', '条'] }
    ],
    '路由器': [
      { code: 'CPU', name: '网络处理器', units: ['个', '片'] },
      { code: 'RAM', name: '内存', units: ['个', '片'] },
      { code: 'FLASH', name: '闪存芯片', units: ['个', '片'] },
      { code: 'ANT', name: '天线', units: ['个', '根'] },
      { code: 'ETH', name: '以太网口', units: ['个'] },
      { code: 'PWR', name: '电源模块', units: ['个'] }
    ],
    '充电器': [
      { code: 'TRANS', name: '变压器', units: ['个'] },
      { code: 'RECT', name: '整流电路', units: ['个', '套'] },
      { code: 'CAP', name: '电容', units: ['个', '只'] },
      { code: 'CASE', name: '外壳', units: ['个'] },
      { code: 'CABLE', name: '充电线', units: ['根', '条'] }
    ],
    '数据线': [
      { code: 'WIRE', name: '导线', units: ['米', '根'] },
      { code: 'CONN1', name: 'USB连接头', units: ['个'] },
      { code: 'CONN2', name: 'Type-C连接头', units: ['个'] },
      { code: 'SHIELD', name: '屏蔽层', units: ['米'] },
      { code: 'JACKET', name: '外护套', units: ['米'] }
    ]
  }
  
  const materials = materialsByCategory[category] || materialsByCategory['手机']
  const itemCount = Math.floor(Math.random() * 5) + 3 // 3-7个物料项
  
  for (let i = 0; i < itemCount; i++) {
    const material = materials[Math.floor(Math.random() * materials.length)]
    const unit = material.units[Math.floor(Math.random() * material.units.length)]
    const quantity = Math.round((Math.random() * 10 + 1) * 100) / 100 // 1-10之间的数字，保留2位小数
    
    const item = {
      itemCode: `${material.code}-${String(bomIndex).padStart(3, '0')}-${String(i + 1).padStart(2, '0')}`,
      itemName: `${material.name} - ${category}专用`,
      quantity: quantity,
      unit: unit,
      description: `用于${category}产品的${material.name}，规格编号${bomIndex}-${i + 1}`
    }
    
    items.push(item)
  }
  
  return items
}

async function main() {
  console.log('开始生成100个测试BOM数据...')
  
  try {
    // 生成100个BOM数据
    const testBOMs = generateTestBOMs(100)
    
    console.log(`生成了${testBOMs.length}个BOM数据，开始插入数据库...`)
    
    // 批量插入BOM数据
    for (let i = 0; i < testBOMs.length; i++) {
      const bom = testBOMs[i]
      
      console.log(`正在创建第${i + 1}个BOM: ${bom.bomCode} - ${bom.name}`)
      
      await prisma.bOM.create({
        data: {
          bomCode: bom.bomCode,
          name: bom.name,
          version: bom.version,
          description: bom.description,
          status: bom.status,
          productId: null, // 独立BOM，不关联产品
          bomItems: {
            create: bom.bomItems
          }
        }
      })
      
      // 每10个输出一次进度
      if ((i + 1) % 10 === 0) {
        console.log(`✅ 已完成 ${i + 1}/100 个BOM`)
      }
    }
    
    console.log('🎉 成功创建100个测试BOM数据！')
    
    // 统计信息
    const stats = await prisma.bOM.groupBy({
      by: ['status'],
      _count: { id: true }
    })
    
    const itemStats = await prisma.bOMItem.count()
    
    console.log('\n📊 统计信息:')
    stats.forEach(stat => {
      console.log(`  ${stat.status}: ${stat._count.id} 个BOM`)
    })
    console.log(`  总物料项: ${itemStats} 个`)
    
  } catch (error) {
    console.error('❌ 创建测试数据失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()