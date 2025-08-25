import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 获取菜单列表（根据用户权限）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userRole = searchParams.get('role')

    // 先尝试从数据库获取菜单
    try {
      const menus = await prisma.menu.findMany({
        where: {
          status: 'active'
        },
        orderBy: [
          { order: 'asc' },
          { name: 'asc' }
        ]
      })

      if (menus && menus.length > 0) {
        // 根据用户角色过滤菜单
        let filteredMenus = menus
        
        if (userRole === 'CLIENT') {
          filteredMenus = menus.filter(menu => 
            menu.name === '仪表盘' || menu.name === '客户端配置'
          )
        }

        // 构建菜单树结构
        const buildMenuTree = (menus: any[], parentId: string | null = null): any[] => {
          return menus
            .filter(menu => menu.parentId === parentId)
            .map(menu => ({
              ...menu,
              children: buildMenuTree(menus, menu.id)
            }))
        }

        const menuTree = buildMenuTree(filteredMenus)

        return NextResponse.json({
          menus: menuTree
        })
      }
    } catch (dbError) {
      console.log('Database menu query failed, using default menus:', dbError)
    }

    // 如果数据库查询失败或没有数据，返回默认菜单
    const defaultMenus = [
      {
        id: "1",
        name: "仪表盘",
        icon: "📊",
        path: "/admin/dashboard",
        order: 1,
        status: "active",
        parentId: null
      },
      {
        id: "2", 
        name: "生产订单",
        icon: "📋",
        path: "/admin/orders",
        order: 2,
        status: "active",
        parentId: null
      },
      {
        id: "3",
        name: "产品管理", 
        icon: "📦",
        path: "/admin/products",
        order: 3,
        status: "active",
        parentId: null
      },
      {
        id: "4",
        name: "BOM管理",
        icon: "📝", 
        path: "/admin/boms",
        order: 4,
        status: "active",
        parentId: null
      },
      {
        id: "5",
        name: "工艺管理",
        icon: "⚙️",
        path: "/admin/processes", 
        order: 5,
        status: "active",
        parentId: null
      },
      {
        id: "6",
        name: "工位管理",
        icon: "🏭",
        path: "/admin/workstations",
        order: 6,
        status: "active", 
        parentId: null
      },
      {
        id: "7",
        name: "设备管理",
        icon: "🔧",
        path: "/admin/devices",
        order: 7,
        status: "active",
        parentId: null
      },
      {
        id: "8", 
        name: "设备通信管理",
        icon: "📡",
        path: "/admin/device-communication",
        order: 8,
        status: "active",
        parentId: null
      },
      {
        id: "9",
        name: "数据导出",
        icon: "📤", 
        path: "/admin/export",
        order: 9,
        status: "active",
        parentId: null
      },
      {
        id: "10",
        name: "菜单管理",
        icon: "📋",
        path: "/admin/menus",
        order: 10,
        status: "active",
        parentId: null
      },
      {
        id: "11",
        name: "用户管理",
        icon: "👥",
        path: "/admin/users", 
        order: 11,
        status: "active",
        parentId: null
      },
      {
        id: "12",
        name: "客户端配置",
        icon: "💻",
        path: "/admin/clients",
        order: 12,
        status: "active",
        parentId: null
      },
      {
        id: "13", 
        name: "角色权限",
        icon: "🔐",
        path: "/admin/roles",
        order: 13,
        status: "active",
        parentId: null
      }
    ]

    // 根据用户角色过滤默认菜单
    let filteredDefaultMenus = defaultMenus
    if (userRole === 'CLIENT') {
      filteredDefaultMenus = defaultMenus.filter(menu => 
        menu.name === '仪表盘' || menu.name === '客户端配置'
      )
    }

    return NextResponse.json({
      menus: filteredDefaultMenus
    })

  } catch (error) {
    console.error('Get menus error:', error)
    return NextResponse.json(
      { error: '获取菜单失败' },
      { status: 500 }
    )
  }
}