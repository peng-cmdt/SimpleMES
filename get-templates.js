// 获取设备模板列表

async function getDeviceTemplates() {
  try {
    const response = await fetch('http://localhost:3009/api/device-templates?limit=100');
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('设备模板列表：');
      result.data.templates.forEach(template => {
        console.log(`- ${template.name} (${template.type})`);
        console.log(`  ID: ${template.id}`);
        console.log(`  品牌: ${template.brand || '通用'}`);
        console.log('');
      });
      
      // 找到第一个PLC模板
      const plcTemplate = result.data.templates.find(t => t.type === 'PLC_CONTROLLER');
      if (plcTemplate) {
        console.log(`\n找到PLC模板: ${plcTemplate.name}, ID: ${plcTemplate.id}`);
      }
    } else {
      console.error('获取模板失败：', result.error);
    }
  } catch (error) {
    console.error('请求失败：', error.message);
  }
}

getDeviceTemplates();