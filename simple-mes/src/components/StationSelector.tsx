"use client";

import { useState, useEffect } from "react";

interface Workstation {
  id: string;
  workstationId: string;
  name: string;
  description?: string;
  location?: string;
  configuredIp: string;
  status: string;
}

interface StationSelectorProps {
  onSelect: (workstationId: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function StationSelector({ onSelect, onCancel, isLoading = false }: StationSelectorProps) {
  const [availableWorkstations, setAvailableWorkstations] = useState<Workstation[]>([]);
  const [selectedWorkstationId, setSelectedWorkstationId] = useState("");
  const [loadingStations, setLoadingStations] = useState(true);

  useEffect(() => {
    loadWorkstations();
  }, []);

  const loadWorkstations = async () => {
    try {
      const response = await fetch('/api/workstations');
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.workstations)) {
          setAvailableWorkstations(data.workstations);
        } else if (Array.isArray(data)) {
          setAvailableWorkstations(data);
        } else {
          console.error('Invalid workstation data format:', data);
          setAvailableWorkstations([]);
        }
      } else {
        console.error('Failed to load workstations');
        setAvailableWorkstations([]);
      }
    } catch (error) {
      console.error('Error loading workstations:', error);
      setAvailableWorkstations([]);
    } finally {
      setLoadingStations(false);
    }
  };

  const handleSelect = () => {
    if (!selectedWorkstationId) return;
    onSelect(selectedWorkstationId);
  };

  if (loadingStations) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white rounded-lg shadow-lg p-12 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading stations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white rounded-lg shadow-lg p-12 max-w-lg w-full">
        {/* 标题 */}
        <h1 className="text-4xl font-bold text-gray-800 text-center mb-12">
          Please select the station
        </h1>

        {/* 工位选择下拉框 */}
        <div className="mb-12">
          <div className="relative">
            <select
              value={selectedWorkstationId}
              onChange={(e) => setSelectedWorkstationId(e.target.value)}
              disabled={isLoading}
              className="w-full h-16 px-6 text-2xl font-semibold text-gray-800 bg-white border-2 border-gray-300 rounded-lg 
                         focus:outline-none focus:border-blue-500 appearance-none cursor-pointer
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select a station...</option>
              {availableWorkstations.map((workstation) => (
                <option key={workstation.id} value={workstation.id}>
                  {workstation.name}
                </option>
              ))}
            </select>
            
            {/* 自定义下拉箭头 */}
            <div className="absolute inset-y-0 right-0 flex items-center pr-6 pointer-events-none">
              <div className="flex flex-col items-center">
                {/* 向上箭头 */}
                <svg className="w-4 h-4 text-gray-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                </svg>
                {/* 向下箭头 */}
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* 按钮区域 */}
        <div className="grid grid-cols-2 gap-6">
          {/* SELECT 按钮 */}
          <button
            onClick={handleSelect}
            disabled={!selectedWorkstationId || isLoading}
            className="h-16 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed 
                     text-white text-xl font-bold rounded-lg transition-colors duration-200
                     focus:outline-none focus:ring-4 focus:ring-blue-300"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-2"></div>
                LOADING...
              </div>
            ) : (
              'SELECT'
            )}
          </button>

          {/* CANCEL 按钮 */}
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="h-16 bg-gray-400 hover:bg-gray-500 disabled:bg-gray-300 disabled:cursor-not-allowed
                     text-white text-xl font-bold rounded-lg transition-colors duration-200
                     focus:outline-none focus:ring-4 focus:ring-gray-300"
          >
            CANCEL
          </button>
        </div>

        {/* 显示选中工位的详细信息 */}
        {selectedWorkstationId && (
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            {(() => {
              const workstation = availableWorkstations.find(w => w.id === selectedWorkstationId);
              return workstation ? (
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-800">
                    {workstation.name}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    ID: {workstation.workstationId}
                  </p>
                  {workstation.location && (
                    <p className="text-sm text-gray-600">
                      Location: {workstation.location}
                    </p>
                  )}
                  <p className="text-sm text-gray-600">
                    IP: {workstation.configuredIp}
                  </p>
                  <div className="flex items-center justify-center mt-2">
                    <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
                      workstation.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                    }`}></span>
                    <span className={`text-sm font-medium ${
                      workstation.status === 'online' ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {workstation.status === 'online' ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>
    </div>
  );
}