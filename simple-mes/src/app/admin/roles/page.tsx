"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useLanguage } from "@/contexts/LanguageContext";

interface Role {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    userRoles: number;
    rolePermissions: number;
  };
}

interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
}

interface RoleFormData {
  name: string;
  description: string;
  permissions: string[];
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState<RoleFormData>({
    name: '',
    description: '',
    permissions: []
  });
  const [error, setError] = useState('');
  const { t } = useLanguage();

  useEffect(() => {
    loadRoles();
    loadPermissions();
  }, []);

  const loadRoles = async () => {
    try {
      const response = await fetch('/api/roles');
      if (response.ok) {
        const data = await response.json();
        setRoles(data.roles);
      }
    } catch (error) {
      console.error('Load roles error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPermissions = async () => {
    try {
      const response = await fetch('/api/permissions');
      if (response.ok) {
        const data = await response.json();
        setPermissions(data.permissions);
      }
    } catch (error) {
      console.error('Load permissions error:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const url = editingRole ? `/api/roles/${editingRole.id}` : '/api/roles';
      const method = editingRole ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        await loadRoles();
        setShowModal(false);
        resetForm();
      } else {
        setError(data.error || '操作失败');
      }
    } catch (error) {
      setError('网络错误，请重试');
    }
  };

  const handleDelete = async (role: Role) => {
    if (!confirm(`确定要删除角色 "${role.name}" 吗？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/roles/${role.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadRoles();
      } else {
        const data = await response.json();
        alert(data.error || '删除失败');
      }
    } catch (error) {
      alert('网络错误，请重试');
    }
  };

  const handleEdit = async (role: Role) => {
    setEditingRole(role);
    
    // 获取角色的权限
    try {
      const response = await fetch(`/api/roles/${role.id}/permissions`);
      if (response.ok) {
        const data = await response.json();
        setFormData({
          name: role.name,
          description: role.description,
          permissions: data.permissions.map((p: Permission) => p.id)
        });
      }
    } catch (error) {
      console.error('Load role permissions error:', error);
      setFormData({
        name: role.name,
        description: role.description,
        permissions: []
      });
    }
    
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingRole(null);
    setFormData({
      name: '',
      description: '',
      permissions: []
    });
    setError('');
  };

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    if (checked) {
      setFormData({
        ...formData,
        permissions: [...formData.permissions, permissionId]
      });
    } else {
      setFormData({
        ...formData,
        permissions: formData.permissions.filter(id => id !== permissionId)
      });
    }
  };

  const getResourcePermissions = (resource: string) => {
    return permissions.filter(p => p.resource === resource);
  };

  const resources = [...new Set(permissions.map(p => p.resource))];

  if (isLoading) {
    return (
      <AdminLayout title={t('admin.roles.title')}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={t('admin.roles.title')}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            系统角色管理
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            管理系统角色和权限分配，支持RBAC权限控制
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          添加角色
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                角色名称
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                描述
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                用户数量
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                权限数量
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                创建时间
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {roles.map((role) => (
              <tr key={role.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                  <div className="flex items-center">
                    <span className="text-lg mr-2">
                      {role.name === 'admin' ? '👑' :
                       role.name === 'supervisor' ? '🎯' :
                       role.name === 'engineer' ? '🔧' :
                       role.name === 'operator' ? '👷' :
                       role.name === 'client' ? '💻' : '👤'}
                    </span>
                    {role.name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {role.description}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {role._count?.userRoles || 0} 个用户
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {role._count?.rolePermissions || 0} 个权限
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {new Date(role.createdAt).toLocaleString('zh-CN')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleEdit(role)}
                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                  >
                    编辑
                  </button>
                  {role.name !== 'admin' && (
                    <button
                      onClick={() => handleDelete(role)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      删除
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 模态框 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingRole ? '编辑角色' : '添加角色'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  角色名称
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                  disabled={editingRole?.name === 'admin'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  角色描述
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  权限分配
                </label>
                <div className="space-y-4">
                  {resources.map(resource => (
                    <div key={resource} className="border border-gray-200 dark:border-gray-600 rounded-md p-4">
                      <h3 className="font-medium text-gray-900 dark:text-white mb-2 capitalize">
                        {resource === 'users' ? '用户管理' :
                         resource === 'clients' ? '客户端管理' :
                         resource === 'roles' ? '角色管理' :
                         resource === 'menus' ? '菜单管理' :
                         resource === 'dashboard' ? '仪表盘' : resource}
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {getResourcePermissions(resource).map(permission => (
                          <label key={permission.id} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.permissions.includes(permission.id)}
                              onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                              {permission.action === 'create' ? '创建' :
                               permission.action === 'read' ? '查看' :
                               permission.action === 'update' ? '编辑' :
                               permission.action === 'delete' ? '删除' : permission.action}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="text-red-600 text-sm">{error}</div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {editingRole ? '更新' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}