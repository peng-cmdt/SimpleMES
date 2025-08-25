const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedBOMData() {
  try {
    console.log('开始创建BOM模拟数据...');

    // 获取现有产品
    const products = await prisma.product.findMany();
    console.log(`找到 ${products.length} 个产品`);

    if (products.length === 0) {
      console.log('没有找到产品，先创建一些产品...');
      
      // 创建产品
      const productsData = [
        {
          productCode: 'PROD-001',
          name: '智能控制器A型',
          description: '工业级智能控制器，支持多种通信协议',
          version: '1.0'
        },
        {
          productCode: 'PROD-002', 
          name: '传感器模块B型',
          description: '高精度温湿度传感器模块',
          version: '1.0'
        },
        {
          productCode: 'PROD-003',
          name: '显示屏C型',
          description: '7寸工业级触摸显示屏',
          version: '1.0'
        }
      ];

      for (const productData of productsData) {
        await prisma.product.create({ data: productData });
      }
      
      console.log('已创建3个产品');
    }

    // 重新获取产品列表
    const allProducts = await prisma.product.findMany();

    // 为每个产品创建BOM
    for (const product of allProducts) {
      console.log(`为产品 ${product.name} 创建BOM...`);

      // 检查是否已存在BOM
      const existingBom = await prisma.bOM.findFirst({
        where: { productId: product.id }
      });

      let bom;
      if (existingBom) {
        console.log(`产品 ${product.name} 已有BOM，跳过创建`);
        bom = existingBom;
        
        // 检查是否已有BOM项目
        const existingItems = await prisma.bOMItem.findMany({
          where: { bomId: bom.id }
        });
        
        if (existingItems.length > 0) {
          console.log(`BOM ${bom.bomCode} 已有 ${existingItems.length} 个物料项目，跳过创建`);
          continue;
        }
      } else {
        // 创建主BOM
        bom = await prisma.bOM.create({
          data: {
            bomCode: `BOM-${product.productCode}`,
            name: `${product.name} 物料清单`,
            version: '1.0',
            productId: product.id,
            description: `${product.name}的完整物料清单`,
            status: 'active'
          }
        });
      }

      // 根据产品类型创建不同的BOM项目
      let bomItems = [];
      
      if (product.productCode === 'PROD-001') {
        // 智能控制器的BOM
        bomItems = [
          {
            itemCode: 'MCU-001',
            itemName: 'STM32F407VET6 主控芯片',
            quantity: 1,
            unit: '个',
            description: '32位ARM Cortex-M4处理器，主频168MHz'
          },
          {
            itemCode: 'PCB-001',
            itemName: '主控板PCB',
            quantity: 1,
            unit: '片',
            description: '4层PCB板，尺寸100x80mm'
          },
          {
            itemCode: 'CAP-001',
            itemName: '电解电容 100uF/25V',
            quantity: 8,
            unit: '个',
            description: '铝电解电容，径向引线'
          },
          {
            itemCode: 'RES-001',
            itemName: '贴片电阻 10KΩ ±1%',
            quantity: 20,
            unit: '个',
            description: '0805封装贴片电阻'
          },
          {
            itemCode: 'CONN-001',
            itemName: 'DB9连接器',
            quantity: 2,
            unit: '个',
            description: '9针D型连接器，公头'
          },
          {
            itemCode: 'LED-001',
            itemName: '状态指示LED',
            quantity: 4,
            unit: '个',
            description: '3mm LED灯，红绿蓝白各一个'
          },
          {
            itemCode: 'CASE-001',
            itemName: '铝合金外壳',
            quantity: 1,
            unit: '套',
            description: '阳极氧化铝合金外壳，含上下盖'
          },
          {
            itemCode: 'SCREW-001',
            itemName: 'M3×8十字螺钉',
            quantity: 8,
            unit: '个',
            description: '不锈钢十字螺钉'
          }
        ];
      } else if (product.productCode === 'PROD-002') {
        // 传感器模块的BOM
        bomItems = [
          {
            itemCode: 'SENSOR-001',
            itemName: 'SHT30温湿度传感器',
            quantity: 1,
            unit: '个',
            description: '数字温湿度传感器，I2C接口'
          },
          {
            itemCode: 'MCU-002',
            itemName: 'ESP32-WROOM模块',
            quantity: 1,
            unit: '个',
            description: 'WiFi+蓝牙双模无线模块'
          },
          {
            itemCode: 'PCB-002',
            itemName: '传感器板PCB',
            quantity: 1,
            unit: '片',
            description: '2层PCB板，尺寸60x40mm'
          },
          {
            itemCode: 'CAP-002',
            itemName: '陶瓷电容 0.1uF',
            quantity: 6,
            unit: '个',
            description: '0603封装陶瓷电容'
          },
          {
            itemCode: 'RES-002',
            itemName: '贴片电阻 4.7KΩ',
            quantity: 4,
            unit: '个',
            description: '0603封装上拉电阻'
          },
          {
            itemCode: 'CONN-002',
            itemName: '2.54mm排针',
            quantity: 1,
            unit: '排',
            description: '8P直插排针'
          },
          {
            itemCode: 'CASE-002',
            itemName: '塑料外壳',
            quantity: 1,
            unit: '套',
            description: 'ABS塑料外壳，防护等级IP65'
          }
        ];
      } else if (product.productCode === 'PROD-003') {
        // 显示屏的BOM
        bomItems = [
          {
            itemCode: 'LCD-001',
            itemName: '7寸TFT液晶屏',
            quantity: 1,
            unit: '个',
            description: '分辨率1024x600，IPS面板'
          },
          {
            itemCode: 'TOUCH-001',
            itemName: '电容触摸面板',
            quantity: 1,
            unit: '片',
            description: '7寸电容式多点触摸面板'
          },
          {
            itemCode: 'DRIVER-001',
            itemName: '显示驱动板',
            quantity: 1,
            unit: '块',
            description: 'HDMI+USB驱动板'
          },
          {
            itemCode: 'CABLE-001',
            itemName: 'LVDS排线',
            quantity: 1,
            unit: '根',
            description: '40PIN LVDS液晶屏排线'
          },
          {
            itemCode: 'CABLE-002',
            itemName: 'USB触摸线',
            quantity: 1,
            unit: '根',
            description: '触摸面板USB连接线'
          },
          {
            itemCode: 'FRAME-001',
            itemName: '铝合金边框',
            quantity: 1,
            unit: '套',
            description: '阳极氧化铝合金边框'
          },
          {
            itemCode: 'GLASS-001',
            itemName: '钢化玻璃面板',
            quantity: 1,
            unit: '片',
            description: '2.5D钢化玻璃，厚度2mm'
          },
          {
            itemCode: 'FOAM-001',
            itemName: '泡沫胶条',
            quantity: 1,
            unit: '米',
            description: '双面胶泡沫胶条，厚度1mm'
          }
        ];
      }

      // 创建BOM项目
      for (const itemData of bomItems) {
        await prisma.bOMItem.create({
          data: {
            bomId: bom.id,
            ...itemData
          }
        });
      }

      console.log(`已为产品 ${product.name} 创建 ${bomItems.length} 个BOM项目`);
    }

    console.log('BOM模拟数据创建完成！');

    // 显示统计信息
    const bomCount = await prisma.bOM.count();
    const bomItemCount = await prisma.bOMItem.count();
    
    console.log(`\n统计信息:`);
    console.log(`- 总共创建了 ${bomCount} 个BOM`);
    console.log(`- 总共创建了 ${bomItemCount} 个BOM项目`);

  } catch (error) {
    console.error('创建BOM数据时出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  seedBOMData();
}

module.exports = { seedBOMData };