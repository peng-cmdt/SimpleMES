export const metadata = {
  title: '设备通信服务演示 - SimpleMES',
  description: 'Next.js 与 C# 设备通信服务集成演示',
};

export default function DeviceCommunicationDemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-6 py-4">
          <nav className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">SimpleMES</h1>
              <p className="text-sm text-gray-600">设备通信服务演示</p>
            </div>
            <div className="text-sm text-gray-500">
              Demo Page
            </div>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}