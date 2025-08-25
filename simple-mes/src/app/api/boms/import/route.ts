import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: '请选择要导入的文件' },
        { status: 400 }
      )
    }

    // 检查文件类型
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: '仅支持CSV文件格式' },
        { status: 400 }
      )
    }

    // 读取文件内容
    const text = await file.text()
    const lines = text.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV文件内容为空或格式不正确' },
        { status: 400 }
      )
    }

    // 解析CSV头部
    const headers = lines[0].split(',').map(h => h.trim())
    const expectedHeaders = ['BOM编码', 'BOM名称', 'BOM版本', 'BOM描述', 'BOM状态', '物料号', '物料名称', '物料描述', '数量', '单位']
    
    // 验证CSV格式
    if (!expectedHeaders.every(header => headers.includes(header))) {
      return NextResponse.json(
        { error: 'CSV文件格式不正确，请使用提供的模板' },
        { status: 400 }
      )
    }

    // 解析数据行
    const bomData = new Map()
    const importErrors = []
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      
      if (values.length !== headers.length) {
        importErrors.push(`第${i + 1}行：列数不匹配`)
        continue
      }
      
      const rowData: any = {}
      headers.forEach((header, index) => {
        rowData[header] = values[index]
      })
      
      const bomCode = rowData['BOM编码']
      const bomName = rowData['BOM名称']
      const bomVersion = rowData['BOM版本']
      const bomDescription = rowData['BOM描述']
      const bomStatus = rowData['BOM状态']
      
      const itemCode = rowData['物料号']
      const itemName = rowData['物料名称']
      const itemDescription = rowData['物料描述']
      const quantity = parseFloat(rowData['数量'])
      const unit = rowData['单位']
      
      // 验证必需字段
      if (!bomCode || !bomName || !bomVersion || !itemCode || !itemName || isNaN(quantity) || !unit) {
        importErrors.push(`第${i + 1}行：缺少必需字段`)
        continue
      }
      
      // 按BOM分组
      if (!bomData.has(bomCode)) {
        bomData.set(bomCode, {
          bomCode,
          name: bomName,
          version: bomVersion,
          description: bomDescription || null,
          status: bomStatus || 'active',
          items: []
        })
      }
      
      bomData.get(bomCode).items.push({
        itemCode,
        itemName,
        description: itemDescription || null,
        quantity,
        unit
      })
    }

    if (importErrors.length > 0) {
      return NextResponse.json(
        { error: `导入失败：\n${importErrors.join('\n')}` },
        { status: 400 }
      )
    }

    // 开始事务导入
    const result = await prisma.$transaction(async (tx) => {
      const createdBOMs = []
      
      for (const [bomCode, bomInfo] of bomData) {
        // 检查BOM是否已存在
        const existingBOM = await tx.bOM.findUnique({
          where: { bomCode: bomInfo.bomCode }
        })
        
        let bom
        if (existingBOM) {
          // 更新现有BOM
          bom = await tx.bOM.update({
            where: { id: existingBOM.id },
            data: {
              name: bomInfo.name,
              version: bomInfo.version,
              description: bomInfo.description,
              status: bomInfo.status
            }
          })
          
          // 删除现有BOM项目
          await tx.bOMItem.deleteMany({
            where: { bomId: bom.id }
          })
        } else {
          // 创建新BOM
          bom = await tx.bOM.create({
            data: {
              bomCode: bomInfo.bomCode,
              name: bomInfo.name,
              version: bomInfo.version,
              description: bomInfo.description,
              status: bomInfo.status
            }
          })
        }
        
        // 创建BOM项目
        for (const item of bomInfo.items) {
          await tx.bOMItem.create({
            data: {
              bomId: bom.id,
              itemCode: item.itemCode,
              itemName: item.itemName,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit
            }
          })
        }
        
        createdBOMs.push(bom)
      }
      
      return createdBOMs
    })

    return NextResponse.json({
      success: true,
      message: `成功导入 ${result.length} 个BOM，共 ${Array.from(bomData.values()).reduce((acc, bom) => acc + bom.items.length, 0)} 个物料项目`,
      boms: result
    })

  } catch (error) {
    console.error('BOM import error:', error)
    return NextResponse.json(
      { error: '导入BOM失败' },
      { status: 500 }
    )
  }
}