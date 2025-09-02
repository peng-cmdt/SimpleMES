import React from 'react';

interface TakeoverModalProps {
  isOpen: boolean;
  currentUser?: {
    username: string;
    loginTime: string;
    lastActivity: string;
  };
  workstationName?: string;
  workState?: {
    currentOrder?: {
      id: string;
      productionNumber: string;
      productName?: string;
    };
    isExecutionMode?: boolean;
    currentStepIndex?: number;
    savedAt?: string;
    orderProgress?: {
      orderId: string;
      status: string;
      currentStep: number;
      totalSteps: number;
    };
  };
  onTakeOver: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const TakeoverModal: React.FC<TakeoverModalProps> = ({
  isOpen,
  currentUser,
  workstationName,
  workState,
  onTakeOver,
  onCancel,
  isLoading = false
}) => {
  if (!isOpen) return null;

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const calculateDuration = (loginTime: string) => {
    const start = new Date(loginTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}小时${diffMinutes}分钟`;
    } else {
      return `${diffMinutes}分钟`;
    }
  };

  return (
    <>
      {/* 背景遮罩 */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        {/* 弹框容器 */}
        <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-screen overflow-hidden">
          {/* 头部 - 蓝色背景 */}
          <div className="bg-blue-600 text-white p-12 text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mr-4">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold leading-tight">
              Take over control
            </h1>
          </div>

          {/* 内容区域 */}
          <div className="p-12">
            {/* 工位信息 */}
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">
                工位 "{workstationName}" 已被占用
              </h2>
              
              {currentUser && (
                <div className="bg-gray-50 rounded-2xl p-6 text-left">
                  <div className="grid grid-cols-2 gap-4 text-lg">
                    <div>
                      <span className="text-gray-600">当前用户:</span>
                      <span className="ml-2 font-medium text-gray-900">{currentUser.username}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">登录时间:</span>
                      <span className="ml-2 font-medium text-gray-900">{formatTime(currentUser.loginTime)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">使用时长:</span>
                      <span className="ml-2 font-medium text-gray-900">{calculateDuration(currentUser.loginTime)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">最后活动:</span>
                      <span className="ml-2 font-medium text-gray-900">{formatTime(currentUser.lastActivity)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 工作进度信息 */}
            {workState && workState.currentOrder && (
              <div className="bg-blue-50 border-4 border-blue-200 rounded-2xl p-6 mb-8">
                <div className="flex items-start">
                  <svg className="w-8 h-8 text-blue-600 mr-4 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-blue-800 mb-3">当前工作进度：</h3>
                    <div className="text-blue-700 space-y-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="font-medium">订单号:</span>
                          <span className="ml-2">{workState.currentOrder.productionNumber}</span>
                        </div>
                        <div>
                          <span className="font-medium">产品:</span>
                          <span className="ml-2">{workState.currentOrder.productName || '未知产品'}</span>
                        </div>
                      </div>
                      
                      {workState.isExecutionMode && (
                        <>
                          <div>
                            <span className="font-medium">执行状态:</span>
                            <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-md text-sm">正在执行</span>
                          </div>
                          {workState.orderProgress && (
                            <div>
                              <span className="font-medium">步骤进度:</span>
                              <span className="ml-2">第 {workState.orderProgress.currentStep + 1} 步 / 共 {workState.orderProgress.totalSteps} 步</span>
                              
                              {/* 进度条 */}
                              <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                                <div 
                                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                                  style={{ width: `${((workState.orderProgress.currentStep + 1) / workState.orderProgress.totalSteps) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      
                      {workState.savedAt && (
                        <div className="text-sm text-blue-600 border-t border-blue-200 pt-2 mt-3">
                          状态保存时间: {formatTime(workState.savedAt)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 警告信息 */}
            <div className="bg-yellow-50 border-4 border-yellow-200 rounded-2xl p-6 mb-8">
              <div className="flex items-start">
                <svg className="w-8 h-8 text-yellow-600 mr-4 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="text-xl font-semibold text-yellow-800 mb-2">接管控制权将：</h3>
                  <ul className="text-yellow-700 space-y-1 text-lg">
                    <li>• 强制退出当前用户的会话</li>
                    <li>• 中断当前用户正在进行的操作</li>
                    <li>• 您将获得该工位的完全控制权</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="grid grid-cols-2 gap-8">
              {/* Take over control 按钮 */}
              <button
                onClick={onTakeOver}
                disabled={isLoading}
                className="h-24 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-300 disabled:cursor-not-allowed text-white text-3xl sm:text-4xl font-bold rounded-2xl transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:transform-none"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-white mr-4"></div>
                    <span className="text-2xl">接管中...</span>
                  </div>
                ) : (
                  'Take over control'
                )}
              </button>

              {/* Cancel 按钮 */}
              <button
                onClick={onCancel}
                disabled={isLoading}
                className="h-24 bg-gray-300 hover:bg-gray-400 active:bg-gray-500 disabled:bg-gray-200 disabled:cursor-not-allowed text-gray-800 text-3xl sm:text-4xl font-bold rounded-2xl transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:transform-none"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TakeoverModal;