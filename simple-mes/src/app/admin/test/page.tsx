export default function TestPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">测试页面</h1>
      <p className="text-gray-600">如果你能看到这个页面，说明路由工作正常</p>
      <div className="mt-4">
        <p>当前路径: /admin/test</p>
        <p>这是一个简单的测试页面，用于验证路由功能</p>
      </div>
    </div>
  );
}