import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SystemSettings {
  clientOrderDisplayCount: number;
  autoRefreshInterval: number;
  defaultLanguage: string;
}

// 默认设置
const DEFAULT_SETTINGS: SystemSettings = {
  clientOrderDisplayCount: 20,
  autoRefreshInterval: 3000,
  defaultLanguage: 'zh'
};

// GET - 获取系统设置
export async function GET(request: NextRequest) {
  try {
    let settings = { ...DEFAULT_SETTINGS };
    
    try {
      // 使用原始SQL查询来避免Prisma客户端问题
      const configs = await prisma.$queryRaw`
        SELECT key, value FROM system_configs 
        WHERE key IN ('clientOrderDisplayCount', 'autoRefreshInterval', 'defaultLanguage')
      ` as any[];
      
      // 将数据库配置合并到默认设置中
      configs.forEach((config: any) => {
        switch (config.key) {
          case 'clientOrderDisplayCount':
            settings.clientOrderDisplayCount = parseInt(config.value) || DEFAULT_SETTINGS.clientOrderDisplayCount;
            break;
          case 'autoRefreshInterval':
            settings.autoRefreshInterval = parseInt(config.value) || DEFAULT_SETTINGS.autoRefreshInterval;
            break;
          case 'defaultLanguage':
            settings.defaultLanguage = config.value || DEFAULT_SETTINGS.defaultLanguage;
            break;
        }
      });
      
      console.log('Loaded settings from database:', settings);
    } catch (error) {
      // 如果数据库查询失败，使用默认设置
      console.log('Using default settings - database query failed:', error);
    }

    return NextResponse.json({
      success: true,
      settings: settings,
      message: 'Settings loaded successfully'
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json({
      success: true, // 仍然返回成功，但使用默认设置
      settings: DEFAULT_SETTINGS,
      message: 'Using default settings due to error'
    });
  }
}

// PUT - 更新系统设置
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientOrderDisplayCount, autoRefreshInterval, defaultLanguage } = body;

    // 验证输入数据
    const settings: SystemSettings = {
      clientOrderDisplayCount: Math.max(5, Math.min(100, parseInt(clientOrderDisplayCount) || 20)),
      autoRefreshInterval: Math.max(1000, parseInt(autoRefreshInterval) || 3000),
      defaultLanguage: ['zh', 'en'].includes(defaultLanguage) ? defaultLanguage : 'zh'
    };

    console.log('Attempting to save settings:', settings);

    try {
      // 使用原始SQL来保存配置，避免Prisma模型问题
      await prisma.$transaction(async (tx) => {
        // 删除现有配置
        await tx.$executeRaw`
          DELETE FROM system_configs 
          WHERE key IN ('clientOrderDisplayCount', 'autoRefreshInterval', 'defaultLanguage')
        `;
        
        // 插入新配置
        await tx.$executeRaw`
          INSERT INTO system_configs (id, key, value, description, category, "createdAt", "updatedAt") VALUES
          (gen_random_uuid(), 'clientOrderDisplayCount', ${settings.clientOrderDisplayCount.toString()}, '客户端工位页面显示订单条数', 'display', NOW(), NOW()),
          (gen_random_uuid(), 'autoRefreshInterval', ${settings.autoRefreshInterval.toString()}, '自动刷新间隔（毫秒）', 'performance', NOW(), NOW()),
          (gen_random_uuid(), 'defaultLanguage', ${settings.defaultLanguage}, '系统默认语言', 'localization', NOW(), NOW())
        `;
      });

      console.log('Settings saved successfully to database:', settings);

      return NextResponse.json({
        success: true,
        settings: settings,
        message: 'Settings saved successfully'
      });
    } catch (dbError) {
      console.error('Database save failed:', dbError);
      return NextResponse.json({
        success: false,
        error: 'Failed to save settings to database: ' + (dbError instanceof Error ? dbError.message : 'Unknown error')
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Save settings error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process settings: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}

// OPTIONS - 处理预检请求
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}