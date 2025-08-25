// 设备配置常量定义 - 标准化设备类型、品牌、型号和驱动配置

export interface DeviceConfiguration {
  type: string;
  name: string;
  brands: DeviceBrand[];
  defaultDriver?: string;
  description?: string;
}

export interface DeviceBrand {
  name: string;
  code: string;
  models: DeviceModel[];
  description?: string;
}

export interface DeviceModel {
  name: string;
  code: string;
  driver: string;
  plcType?: string;
  defaultPort?: number;
  description?: string;
  specifications?: DeviceSpec[];
}

export interface DeviceSpec {
  name: string;
  value: string;
  unit?: string;
}

// 标准设备配置库
export const DEVICE_CONFIGURATIONS: DeviceConfiguration[] = [
  // PLC控制器配置
  {
    type: 'PLC_CONTROLLER',
    name: 'PLC控制器',
    defaultDriver: 'PLC Driver',
    description: '可编程逻辑控制器，用于工业自动化控制',
    brands: [
      {
        name: '西门子',
        code: 'SIEMENS',
        description: '德国西门子工业自动化产品',
        models: [
          {
            name: 'S7-200 SMART',
            code: 'S7_200_SMART',
            driver: 'PLC Driver',
            plcType: 'Siemens_S7',
            defaultPort: 102,
            description: '紧凑型PLC，适用于小型自动化应用',
            specifications: [
              { name: 'CPU类型', value: 'S7-200' },
              { name: '通信协议', value: 'S7协议' },
              { name: '默认端口', value: '102', unit: '' }
            ]
          },
          {
            name: 'S7-300',
            code: 'S7_300',
            driver: 'PLC Driver',
            plcType: 'Siemens_S7',
            defaultPort: 102,
            description: '模块化中型PLC系统',
            specifications: [
              { name: 'CPU类型', value: 'S7-300' },
              { name: '通信协议', value: 'S7协议' },
              { name: '默认端口', value: '102', unit: '' }
            ]
          },
          {
            name: 'S7-400',
            code: 'S7_400',
            driver: 'PLC Driver',
            plcType: 'Siemens_S7',
            defaultPort: 102,
            description: '高性能PLC系统，适用于复杂控制',
            specifications: [
              { name: 'CPU类型', value: 'S7-400' },
              { name: '通信协议', value: 'S7协议' },
              { name: '默认端口', value: '102', unit: '' }
            ]
          },
          {
            name: 'S7-1200',
            code: 'S7_1200',
            driver: 'PLC Driver',
            plcType: 'Siemens_S7',
            defaultPort: 102,
            description: '紧凑型控制器，集成以太网接口',
            specifications: [
              { name: 'CPU类型', value: 'S7-1200' },
              { name: '通信协议', value: 'S7协议' },
              { name: '默认端口', value: '102', unit: '' }
            ]
          },
          {
            name: 'S7-1500',
            code: 'S7_1500',
            driver: 'PLC Driver',
            plcType: 'Siemens_S7',
            defaultPort: 102,
            description: '高性能控制器，支持先进自动化功能',
            specifications: [
              { name: 'CPU类型', value: 'S7-1500' },
              { name: '通信协议', value: 'S7协议' },
              { name: '默认端口', value: '102', unit: '' }
            ]
          }
        ]
      },
      {
        name: '三菱电机',
        code: 'MITSUBISHI',
        description: '日本三菱电机自动化产品',
        models: [
          {
            name: 'FX5U系列',
            code: 'FX5U',
            driver: 'PLC Driver',
            plcType: 'Mitsubishi_MC',
            defaultPort: 6000,
            description: '紧凑型PLC，支持MC协议通信',
            specifications: [
              { name: 'CPU类型', value: 'FX5U' },
              { name: '通信协议', value: 'MC协议' },
              { name: '默认端口', value: '6000', unit: '' }
            ]
          },
          {
            name: 'FX3U系列',
            code: 'FX3U',
            driver: 'PLC Driver',
            plcType: 'Mitsubishi_MC',
            defaultPort: 6000,
            description: '经济型PLC，广泛应用于小型控制系统',
            specifications: [
              { name: 'CPU类型', value: 'FX3U' },
              { name: '通信协议', value: 'MC协议' },
              { name: '默认端口', value: '6000', unit: '' }
            ]
          },
          {
            name: 'Q系列',
            code: 'Q_SERIES',
            driver: 'PLC Driver',
            plcType: 'Mitsubishi_MC',
            defaultPort: 6000,
            description: '模块化PLC系统，高性能控制',
            specifications: [
              { name: 'CPU类型', value: 'Q系列' },
              { name: '通信协议', value: 'MC协议' },
              { name: '默认端口', value: '6000', unit: '' }
            ]
          },
          {
            name: 'iQ-R系列',
            code: 'IQ_R',
            driver: 'PLC Driver',
            plcType: 'Mitsubishi_MC',
            defaultPort: 6000,
            description: '高性能控制器，支持IoT功能',
            specifications: [
              { name: 'CPU类型', value: 'iQ-R' },
              { name: '通信协议', value: 'MC协议' },
              { name: '默认端口', value: '6000', unit: '' }
            ]
          }
        ]
      },
      {
        name: '欧姆龙',
        code: 'OMRON',
        description: '日本欧姆龙工业自动化产品',
        models: [
          {
            name: 'CP1H系列',
            code: 'CP1H',
            driver: 'PLC Driver',
            plcType: 'Omron_FINS',
            defaultPort: 9600,
            description: '紧凑型PLC，支持FINS协议',
            specifications: [
              { name: 'CPU类型', value: 'CP1H' },
              { name: '通信协议', value: 'FINS协议' },
              { name: '默认端口', value: '9600', unit: '' }
            ]
          },
          {
            name: 'CJ2M系列',
            code: 'CJ2M',
            driver: 'PLC Driver',
            plcType: 'Omron_FINS',
            defaultPort: 9600,
            description: '模块化PLC系统',
            specifications: [
              { name: 'CPU类型', value: 'CJ2M' },
              { name: '通信协议', value: 'FINS协议' },
              { name: '默认端口', value: '9600', unit: '' }
            ]
          },
          {
            name: 'NJ系列',
            code: 'NJ_SERIES',
            driver: 'PLC Driver',
            plcType: 'Omron_FINS',
            defaultPort: 9600,
            description: '机器自动化控制器',
            specifications: [
              { name: 'CPU类型', value: 'NJ系列' },
              { name: '通信协议', value: 'FINS协议' },
              { name: '默认端口', value: '9600', unit: '' }
            ]
          }
        ]
      }
    ]
  },
  
  // 扫码设备配置
  {
    type: 'BARCODE_SCANNER',
    name: '扫码设备',
    defaultDriver: 'Scanner Driver',
    description: '条码/二维码扫描设备',
    brands: [
      {
        name: '基恩士',
        code: 'KEYENCE',
        description: '日本基恩士传感器及扫码产品',
        models: [
          {
            name: 'SR-1000系列',
            code: 'SR_1000',
            driver: 'Scanner Driver',
            defaultPort: 8000,
            description: '高速条码读取器',
            specifications: [
              { name: '扫描类型', value: '激光扫描' },
              { name: '通信方式', value: 'TCP/IP' },
              { name: '默认端口', value: '8000', unit: '' }
            ]
          },
          {
            name: 'SR-2000系列',
            code: 'SR_2000',
            driver: 'Scanner Driver',
            defaultPort: 8000,
            description: '图像式条码读取器',
            specifications: [
              { name: '扫描类型', value: '图像识别' },
              { name: '通信方式', value: 'TCP/IP' },
              { name: '默认端口', value: '8000', unit: '' }
            ]
          }
        ]
      },
      {
        name: '康耐视',
        code: 'COGNEX',
        description: '美国康耐视机器视觉产品',
        models: [
          {
            name: 'DataMan 370系列',
            code: 'DATAMAN_370',
            driver: 'Scanner Driver',
            defaultPort: 23,
            description: '固定式条码读取器',
            specifications: [
              { name: '扫描类型', value: '图像识别' },
              { name: '通信方式', value: 'TCP/IP' },
              { name: '默认端口', value: '23', unit: '' }
            ]
          },
          {
            name: 'DataMan 470系列',
            code: 'DATAMAN_470',
            driver: 'Scanner Driver',
            defaultPort: 23,
            description: '高性能条码读取器',
            specifications: [
              { name: '扫描类型', value: '图像识别' },
              { name: '通信方式', value: 'TCP/IP' },
              { name: '默认端口', value: '23', unit: '' }
            ]
          }
        ]
      },
      {
        name: '海康威视',
        code: 'HIKVISION',
        description: '中国海康威视工业相机产品',
        models: [
          {
            name: 'ID系列读码器',
            code: 'ID_READER',
            driver: 'Scanner Driver',
            defaultPort: 8000,
            description: '工业级条码读取设备',
            specifications: [
              { name: '扫描类型', value: '图像识别' },
              { name: '通信方式', value: 'TCP/IP' },
              { name: '默认端口', value: '8000', unit: '' }
            ]
          }
        ]
      }
    ]
  },

  // 传感器配置
  {
    type: 'SENSOR',
    name: '传感器',
    defaultDriver: 'Sensor Driver',
    description: '各类工业传感器设备',
    brands: [
      {
        name: '施耐德',
        code: 'SCHNEIDER',
        description: '法国施耐德电气传感器产品',
        models: [
          {
            name: 'OsiSense系列',
            code: 'OSISENSE',
            driver: 'Sensor Driver',
            plcType: 'Modbus_TCP',
            defaultPort: 502,
            description: '接近传感器系列',
            specifications: [
              { name: '传感器类型', value: '接近传感器' },
              { name: '通信协议', value: 'Modbus TCP' },
              { name: '默认端口', value: '502', unit: '' }
            ]
          }
        ]
      },
      {
        name: '倍加福',
        code: 'PEPPERL_FUCHS',
        description: '德国倍加福传感器产品',
        models: [
          {
            name: 'NBN系列',
            code: 'NBN_SERIES',
            driver: 'Sensor Driver',
            plcType: 'Modbus_TCP',
            defaultPort: 502,
            description: '电感式接近开关',
            specifications: [
              { name: '传感器类型', value: '电感式传感器' },
              { name: '通信协议', value: 'Modbus TCP' },
              { name: '默认端口', value: '502', unit: '' }
            ]
          }
        ]
      }
    ]
  },

  // 摄像头配置
  {
    type: 'CAMERA',
    name: '工业相机',
    defaultDriver: 'Camera Driver',
    description: '机器视觉工业相机设备',
    brands: [
      {
        name: '海康威视',
        code: 'HIKVISION',
        description: '中国海康威视工业相机产品',
        models: [
          {
            name: 'MV-CA系列',
            code: 'MV_CA',
            driver: 'Camera Driver',
            defaultPort: 8000,
            description: 'USB3.0工业相机',
            specifications: [
              { name: '接口类型', value: 'USB3.0' },
              { name: '分辨率', value: '1920x1080' },
              { name: '帧率', value: '30fps', unit: 'fps' }
            ]
          },
          {
            name: 'MV-CE系列',
            code: 'MV_CE',
            driver: 'Camera Driver',
            defaultPort: 8000,
            description: 'GigE工业相机',
            specifications: [
              { name: '接口类型', value: 'GigE' },
              { name: '分辨率', value: '2048x1536' },
              { name: '帧率', value: '25fps', unit: 'fps' }
            ]
          }
        ]
      },
      {
        name: '大恒图像',
        code: 'DAHENG',
        description: '中国大恒图像工业相机产品',
        models: [
          {
            name: 'Mercury系列',
            code: 'MERCURY',
            driver: 'Camera Driver',
            defaultPort: 8000,
            description: '高性能工业相机',
            specifications: [
              { name: '接口类型', value: 'USB3.0' },
              { name: '分辨率', value: '2592x1944' },
              { name: '帧率', value: '20fps', unit: 'fps' }
            ]
          }
        ]
      }
    ]
  },

  // 机器人配置
  {
    type: 'ROBOT',
    name: '工业机器人',
    defaultDriver: 'Robot Driver',
    description: '工业机器人控制设备',
    brands: [
      {
        name: '库卡',
        code: 'KUKA',
        description: '德国库卡机器人产品',
        models: [
          {
            name: 'KR系列',
            code: 'KR_SERIES',
            driver: 'Robot Driver',
            defaultPort: 7000,
            description: '六轴工业机器人',
            specifications: [
              { name: '轴数', value: '6轴' },
              { name: '负载', value: '10kg', unit: 'kg' },
              { name: '通信协议', value: 'TCP/IP' }
            ]
          }
        ]
      },
      {
        name: 'ABB',
        code: 'ABB',
        description: '瑞典ABB机器人产品',
        models: [
          {
            name: 'IRB系列',
            code: 'IRB_SERIES',
            driver: 'Robot Driver',
            defaultPort: 7000,
            description: '工业机器人系列',
            specifications: [
              { name: '轴数', value: '6轴' },
              { name: '负载', value: '25kg', unit: 'kg' },
              { name: '通信协议', value: 'TCP/IP' }
            ]
          }
        ]
      }
    ]
  },

  // 其他设备
  {
    type: 'OTHER',
    name: '其他设备',
    defaultDriver: 'Generic Driver',
    description: '其他类型的工业设备',
    brands: [
      {
        name: '通用设备',
        code: 'GENERIC',
        description: '通用TCP/IP设备',
        models: [
          {
            name: 'TCP设备',
            code: 'TCP_DEVICE',
            driver: 'Generic Driver',
            plcType: 'Modbus_TCP',
            defaultPort: 502,
            description: '通用TCP/IP通信设备',
            specifications: [
              { name: '通信协议', value: 'TCP/IP' },
              { name: '默认端口', value: '502', unit: '' }
            ]
          },
          {
            name: 'Modbus设备',
            code: 'MODBUS_DEVICE',
            driver: 'Generic Driver',
            plcType: 'Modbus_TCP',
            defaultPort: 502,
            description: '标准Modbus TCP设备',
            specifications: [
              { name: '通信协议', value: 'Modbus TCP' },
              { name: '默认端口', value: '502', unit: '' }
            ]
          }
        ]
      }
    ]
  }
];

// 获取设备类型列表
export const getDeviceTypes = (): { value: string; label: string; description: string }[] => {
  return DEVICE_CONFIGURATIONS.map(config => ({
    value: config.type,
    label: config.name,
    description: config.description || ''
  }));
};

// 根据设备类型获取品牌列表
export const getBrandsByDeviceType = (deviceType: string): { value: string; label: string; description: string }[] => {
  const config = DEVICE_CONFIGURATIONS.find(c => c.type === deviceType);
  if (!config) return [];
  
  return config.brands.map(brand => ({
    value: brand.code,
    label: brand.name,
    description: brand.description || ''
  }));
};

// 根据设备类型和品牌获取型号列表
export const getModelsByBrand = (deviceType: string, brandCode: string): { 
  value: string; 
  label: string; 
  description: string;
  driver: string;
  plcType?: string;
  defaultPort?: number;
  specifications?: DeviceSpec[];
}[] => {
  const config = DEVICE_CONFIGURATIONS.find(c => c.type === deviceType);
  if (!config) return [];
  
  const brand = config.brands.find(b => b.code === brandCode);
  if (!brand) return [];
  
  return brand.models.map(model => ({
    value: model.code,
    label: model.name,
    description: model.description || '',
    driver: model.driver,
    plcType: model.plcType,
    defaultPort: model.defaultPort,
    specifications: model.specifications
  }));
};

// 根据设备类型获取驱动列表
export const getDriversByDeviceType = (deviceType: string): { value: string; label: string }[] => {
  const config = DEVICE_CONFIGURATIONS.find(c => c.type === deviceType);
  if (!config) return [];
  
  const drivers = new Set<string>();
  config.brands.forEach(brand => {
    brand.models.forEach(model => {
      drivers.add(model.driver);
    });
  });
  
  return Array.from(drivers).map(driver => ({
    value: driver,
    label: driver
  }));
};

// 根据设备类型、品牌、型号获取完整配置
export const getDeviceConfig = (deviceType: string, brandCode: string, modelCode: string): DeviceModel | null => {
  const config = DEVICE_CONFIGURATIONS.find(c => c.type === deviceType);
  if (!config) return null;
  
  const brand = config.brands.find(b => b.code === brandCode);
  if (!brand) return null;
  
  const model = brand.models.find(m => m.code === modelCode);
  return model || null;
};

// 根据品牌名称获取品牌code
export const getBrandCodeByName = (deviceType: string, brandName: string): string | null => {
  const config = DEVICE_CONFIGURATIONS.find(c => c.type === deviceType);
  if (!config) return null;
  
  const brand = config.brands.find(b => b.name === brandName || b.code === brandName);
  return brand ? brand.code : null;
};

// 根据型号名称获取型号code
export const getModelCodeByName = (deviceType: string, brandCode: string, modelName: string): string | null => {
  const config = DEVICE_CONFIGURATIONS.find(c => c.type === deviceType);
  if (!config) return null;
  
  const brand = config.brands.find(b => b.code === brandCode);
  if (!brand) return null;
  
  const model = brand.models.find(m => m.name === modelName || m.code === modelName);
  return model ? model.code : null;
};