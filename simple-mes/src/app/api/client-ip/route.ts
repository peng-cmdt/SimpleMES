import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // 获取客户端IP地址的多种方式
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const remoteAddress = request.headers.get('remote-addr');
    
    let allIps: string[] = [];
    
    // 解析 x-forwarded-for 头（可能包含多个IP）
    if (forwarded) {
      const ips = forwarded.split(',').map(ip => ip.trim());
      allIps.push(...ips);
    }
    
    if (realIp) {
      allIps.push(realIp);
    }
    
    if (remoteAddress) {
      allIps.push(remoteAddress);
    }
    
    // 尝试从其他头部获取
    const cfIp = request.headers.get('cf-connecting-ip');
    const clientIp = request.headers.get('x-client-ip');
    const requestIp = request.ip;
    
    if (cfIp) allIps.push(cfIp);
    if (clientIp) allIps.push(clientIp);
    if (requestIp) allIps.push(requestIp);
    
    // 去重并过滤无效IP，处理IPv6映射的IPv4地址
    allIps = [...new Set(allIps)]
      .map(ip => {
        // 处理IPv6映射的IPv4地址 (::ffff:192.168.1.1 -> 192.168.1.1)
        if (ip && ip.startsWith('::ffff:')) {
          return ip.substring(7);
        }
        return ip;
      })
      .filter(ip => 
        ip && 
        ip !== '::1' && 
        ip !== '127.0.0.1' && 
        ip.match(/^(\d{1,3}\.){3}\d{1,3}$/)
      );
    
    console.log('发现的所有IP地址:', allIps);
    
    // 优先选择局域网IP
    const lanIp = allIps.find(ip => 
      ip.startsWith('192.168.') || 
      ip.startsWith('10.') || 
      (ip.startsWith('172.') && parseInt(ip.split('.')[1]) >= 16 && parseInt(ip.split('.')[1]) <= 31)
    );
    
    let selectedIp = '127.0.0.1';
    let ipSource = 'default';
    
    if (lanIp) {
      selectedIp = lanIp;
      ipSource = 'lan';
      console.log(`✅ 选择局域网IP: ${selectedIp}`);
    } else if (allIps.length > 0) {
      selectedIp = allIps[0];
      ipSource = 'first';
      console.log(`⚠️ 未找到局域网IP，使用第一个IP: ${selectedIp}`);
    }
    
    console.log('获取客户端IP结果:', {
      selectedIp,
      ipSource,
      forwarded,
      realIp,
      remoteAddress,
      allIps,
      allHeaders: Object.fromEntries(request.headers.entries())
    });
    
    return NextResponse.json({
      success: true,
      ip: selectedIp,
      ipSource,
      debug: {
        allIps,
        lanIp,
        forwarded,
        realIp,
        remoteAddress,
        userAgent: request.headers.get('user-agent')
      }
    });
  } catch (error) {
    console.error('获取客户端IP失败:', error);
    return NextResponse.json({
      success: false,
      ip: '127.0.0.1',
      error: 'Failed to get client IP'
    }, { status: 500 });
  }
}