// 在浏览器控制台中运行此脚本来调试
// 复制粘贴到浏览器控制台执行

async function browserDebugDeviceDeletion() {
  console.log('🔍 浏览器端调试设备删除API')
  console.log('==============================')
  
  try {
    // 1. 获取当前页面URL信息
    console.log('当前页面URL:', window.location.href)
    console.log('当前域名:', window.location.origin)
    
    // 2. 先测试设备列表API
    console.log('\n📱 测试设备列表API...')
    const devicesResponse = await fetch('/api/devices')
    console.log('设备列表响应状态:', devicesResponse.status)
    console.log('设备列表Content-Type:', devicesResponse.headers.get('content-type'))
    
    if (!devicesResponse.ok) {
      const errorText = await devicesResponse.text()
      console.log('设备列表错误响应:', errorText.substring(0, 200))
      return
    }
    
    const devicesData = await devicesResponse.json()
    if (!devicesData.devices || devicesData.devices.length === 0) {
      console.log('❌ 没有可用的设备')
      return
    }
    
    // 3. 选择一个设备进行删除测试
    const testDevice = devicesData.devices[0]
    console.log(`\n🎯 测试设备: ${testDevice.name}`)
    console.log(`设备ID: ${testDevice.id}`)
    
    // 4. 构建删除URL并测试
    const deleteUrl = `/api/devices/${testDevice.id}`
    console.log(`删除URL: ${deleteUrl}`)
    
    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    
    console.log('\n📊 删除响应详情:')
    console.log('状态码:', deleteResponse.status, deleteResponse.statusText)
    console.log('Content-Type:', deleteResponse.headers.get('content-type'))
    console.log('完整URL:', deleteResponse.url)
    
    // 5. 获取响应内容
    const responseText = await deleteResponse.text()
    console.log('\n📄 原始响应 (前300字符):')
    console.log(responseText.substring(0, 300))
    
    // 6. 尝试解析JSON
    if (responseText.startsWith('<!DOCTYPE') || responseText.startsWith('<html')) {
      console.log('\n❌ 错误: 返回了HTML页面!')
      if (responseText.includes('404')) {
        console.log('这是一个404错误页面')
      } else if (responseText.includes('500')) {
        console.log('这是一个500错误页面')
      }
    } else {
      console.log('\n✅ JSON响应正常')
      try {
        const result = JSON.parse(responseText)
        console.log('解析结果:', result)
      } catch (e) {
        console.log('JSON解析失败:', e.message)
      }
    }
    
  } catch (error) {
    console.error('❌ 调试失败:', error)
  }
}

// 立即执行
browserDebugDeviceDeletion()