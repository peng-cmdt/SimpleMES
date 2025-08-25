// 调试设备删除API的响应
async function debugDeviceDeletion() {
  console.log('🔍 调试设备删除API响应')
  console.log('=======================')
  
  // 动态导入 node-fetch
  const { default: fetch } = await import('node-fetch')
  
  try {
    // 1. 先获取一个存在的设备ID
    const devicesResponse = await fetch('http://localhost:3011/api/devices')
    const devicesData = await devicesResponse.json()
    
    if (!devicesData.devices || devicesData.devices.length === 0) {
      console.log('❌ 没有可用的设备进行测试')
      return
    }
    
    const testDevice = devicesData.devices[0]
    console.log(`📱 测试设备: ${testDevice.name} (ID: ${testDevice.id.substring(0,8)}...)`)
    
    // 2. 尝试删除设备，捕获详细响应信息
    const deleteResponse = await fetch(`http://localhost:3011/api/devices/${testDevice.id}`, {
      method: 'DELETE'
    })
    
    console.log(`\n📊 删除响应详情:`)
    console.log(`   状态码: ${deleteResponse.status} ${deleteResponse.statusText}`)
    console.log(`   Content-Type: ${deleteResponse.headers.get('content-type')}`)
    console.log(`   Response URL: ${deleteResponse.url}`)
    
    // 3. 尝试获取响应文本（不解析JSON）
    const responseText = await deleteResponse.text()
    console.log(`\n📄 原始响应文本 (前200字符):`)
    console.log(`"${responseText.substring(0, 200)}"`)
    
    // 4. 检查是否是JSON
    if (responseText.startsWith('<!DOCTYPE') || responseText.startsWith('<html')) {
      console.log('\n❌ 问题确认: 服务器返回了HTML页面而不是JSON!')
      
      // 尝试找出可能的原因
      if (responseText.includes('404') || responseText.includes('Not Found')) {
        console.log('   可能原因: API路由未找到 (404)')
      } else if (responseText.includes('500') || responseText.includes('Error')) {
        console.log('   可能原因: 服务器内部错误 (500)')
      } else {
        console.log('   可能原因: 其他路由重定向问题')
      }
    } else {
      console.log('\n✅ 响应格式正确: JSON数据')
      try {
        const jsonData = JSON.parse(responseText)
        console.log('   解析结果:', jsonData)
      } catch (parseError) {
        console.log('   ❌ JSON解析失败:', parseError.message)
      }
    }
    
  } catch (error) {
    console.error('❌ 调试过程出错:', error.message)
  }
}

debugDeviceDeletion()