"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

interface MenuItem {
  id: string;
  name: string;
  icon: string;
  path?: string;
  order: number;
  adminOnly?: boolean;
  children?: MenuItem[];
}

interface UserInfo {
  id: string;
  username: string;
  email: string;
  role: string;
  permissions: string[];
  avatar?: string;
}

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [profileFormData, setProfileFormData] = useState({
    username: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();

  // 如果没有传入title，使用默认的仪表盘翻译
  const displayTitle = title || t('menu.dashboard');

  useEffect(() => {
    const adminAuth = localStorage.getItem("adminAuth");
    const userInfoStr = localStorage.getItem("adminUserInfo");
    
    if (adminAuth === "true" && userInfoStr) {
      const user = JSON.parse(userInfoStr);
      setUserInfo(user);
      setIsAuthenticated(true);
    } else {
      router.push("/admin/login");
    }
  }, [router]);

  useEffect(() => {
    if (isAuthenticated) {
      // 每次语言变化时，重新生成菜单项以更新翻译
      const defaultMenus = [
        { id: "dashboard", name: t('menu.dashboard'), icon: "📊", path: "/admin/dashboard", order: 1 },
        { 
          id: "production-management", 
          name: "生产管理", 
          icon: "🏭", 
          order: 2,
          children: [
            { id: "orders", name: "生产订单", icon: "📋", path: "/admin/orders", order: 1 },
            { id: "products", name: "产品管理", icon: "📦", path: "/admin/products", order: 2 },
            { id: "parts", name: "零部件管理", icon: "📝", path: "/admin/parts", order: 3 },
          ]
        },
        { 
          id: "process-management", 
          name: "工艺过程", 
          icon: "🔧", 
          order: 3,
          children: [
            { id: "processes", name: "工艺管理", icon: "⚙️", path: "/admin/processes", order: 1 },
            { id: "step-templates", name: "工艺步骤管理", icon: "📋", path: "/admin/step-templates", order: 2 },
            { id: "order-monitoring", name: "订单监测", icon: "📊", path: "/admin/order-monitoring", order: 3 },
            { id: "segment", name: "订单分配监控", icon: "📋", path: "/admin/segment", order: 4 },
          ]
        },
        { id: "workstations", name: t('menu.workstations'), icon: "🏭", path: "/admin/workstations", order: 4 },
        { id: "devices", name: t('menu.devices'), icon: "⚡", path: "/admin/devices", order: 5 },
        { id: "device-communication", name: "设备通信管理", icon: "📡", path: "/admin/device-communication", order: 6 },
        { id: "export", name: "数据导出", icon: "📤", path: "/admin/export", order: 7 },
        { id: "users", name: t('menu.users'), icon: "👥", path: "/admin/users", order: 8 },
        { 
          id: "system-management", 
          name: "系统管理", 
          icon: "⚙️", 
          order: 9,
          children: [
            { id: "menus", name: "菜单管理", icon: "📋", path: "/admin/menus", order: 1 },
            { id: "clients", name: t('menu.clients'), icon: "💻", path: "/admin/clients", order: 2 },
            { id: "roles", name: t('menu.roles'), icon: "🔐", path: "/admin/roles", order: 3 },
          ]
        },
      ];
      setMenuItems(defaultMenus);
      
      // 根据当前路径确定需要展开的父菜单
      const parentMenu = defaultMenus.find(m => m.children?.some(c => c.path === pathname));
      if (parentMenu) {
        setOpenMenu(parentMenu.id);
      } else {
        // 如果当前路径没有匹配的子菜单，则不展开任何菜单
        setOpenMenu(null);
      }
    }
  }, [isAuthenticated, t, pathname]);

  const handleParentClick = (menuId: string) => {
    setOpenMenu(prevOpenMenu => (prevOpenMenu === menuId ? null : menuId));
  };

  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const isActive = item.path === pathname;
    const hasChildren = item.children && item.children.length > 0;

    if (hasChildren) {
      const isExpanded = openMenu === item.id;
      return (
        <div key={item.id}>
          <button
            onClick={() => handleParentClick(item.id)}
            className="flex items-center justify-between w-full px-6 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center">
              <span className="text-xl mr-3">{item.icon}</span>
              {item.name}
            </div>
            <svg 
              className={`w-4 h-4 transform transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {isExpanded && (
            <div className="bg-gray-50 dark:bg-gray-900">
              {item.children
                .filter(child => !child.adminOnly || userInfo?.role === 'ADMIN')
                .map((child) => renderMenuItem(child, level + 1))}
            </div>
          )}
        </div>
      );
    } else {
      // Find parent menu for active child styling
      const parentMenu = menuItems.find(m => m.children?.some(c => c.id === item.id));
      const isChildActive = parentMenu ? parentMenu.children?.some(c => c.path === pathname) && item.path === pathname : false;

      return (
        <Link
          key={item.id}
          href={item.path || '#'}
          className={`flex items-center ${
            level > 0 ? 'pl-12 pr-6' : 'px-6'
          } py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
            isActive || isChildActive
              ? "bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-r-2 border-blue-500"
              : ""
          }`}
        >
          <span className="text-xl mr-3">{item.icon}</span>
          {item.name}
        </Link>
      );
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex h-screen">
        <aside className="w-64 bg-white dark:bg-gray-800 shadow-sm">
          <div className="p-6 border-b dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('menu.adminPortal')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('menu.adminSubtitle')}
            </p>
          </div>

          <nav className="mt-6">
            {menuItems
              .filter(item => !item.adminOnly || userInfo?.role === 'ADMIN')
              .map((item) => renderMenuItem(item))}
          </nav>

          <div className="absolute bottom-0 w-64 p-6 border-t dark:border-gray-700">
            <div className="text-center text-xs text-gray-500 dark:text-gray-400">
              SimpleMES v1.0.0
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          <header className="bg-white dark:bg-gray-800 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {displayTitle}
              </h1>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('menu.welcome')}，{userInfo?.username || t('menu.admin')}
                </span>
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center space-x-2 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    {userInfo?.avatar ? (
                      <img
                        src={userInfo.avatar}
                        alt="Avatar"
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                        {userInfo?.username?.charAt(0).toUpperCase() || 'A'}
                      </div>
                    )}
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </button>
                  
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-2 z-50">
                      <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border-b dark:border-gray-700">
                        <div className="font-medium">{userInfo?.username}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{userInfo?.email}</div>
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          {getRoleName(userInfo?.role || '')}
                        </div>
                      </div>
                      <button
                        onClick={handleShowProfile}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        👤 {t('menu.profile')}
                      </button>
                      <button
                        onClick={handleShowAvatar}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        📷 {t('menu.avatar')}
                      </button>
                      <button
                        onClick={handleShowAccount}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        ⚙️ {t('menu.account')}
                      </button>
                      <hr className="my-1 dark:border-gray-700" />
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          handleLogout();
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        🚪 {t('menu.logout')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <div className="p-6">
            {children}
          </div>
        </main>
      </div>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {t('menu.profile') || '个人资料'}
            </h3>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('login.username') || '用户名'}
                </label>
                <input
                  type="text"
                  value={profileFormData.username}
                  onChange={(e) => setProfileFormData(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('admin.users.email') || '邮箱'}
                </label>
                <input
                  type="email"
                  value={profileFormData.email}
                  onChange={(e) => setProfileFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  {t('common.cancel') || '取消'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {t('common.save') || '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Avatar Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {t('menu.avatar') || '更换头像'}
            </h3>
            <div className="space-y-4">
              <div className="flex justify-center mb-4">
                {userInfo?.avatar ? (
                  <img
                    src={userInfo.avatar}
                    alt="Current Avatar"
                    className="w-24 h-24 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-2xl">
                    {userInfo?.username?.charAt(0).toUpperCase() || 'A'}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('profile.selectImage') || '选择头像图片'}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAvatarModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  {t('common.cancel') || '取消'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Account Settings Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {t('menu.account') || '账户设置'}
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('profile.currentPassword') || '当前密码'}
                </label>
                <input
                  type="password"
                  value={profileFormData.currentPassword}
                  onChange={(e) => setProfileFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('profile.newPassword') || '新密码'}
                </label>
                <input
                  type="password"
                  value={profileFormData.newPassword}
                  onChange={(e) => setProfileFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('profile.confirmPassword') || '确认密码'}
                </label>
                <input
                  type="password"
                  value={profileFormData.confirmPassword}
                  onChange={(e) => setProfileFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  {t('common.cancel') || '取消'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {t('profile.changePassword') || '修改密码'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}