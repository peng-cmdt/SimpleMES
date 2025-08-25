import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file: File | null = data.get('image') as unknown as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '没有上传文件' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 创建文件名
    const fileName = `${Date.now()}-${file.name}`;
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'images');
    
    // 确保上传目录存在
    try {
      await writeFile(join(uploadDir, '.gitkeep'), '');
    } catch (error) {
      // 目录可能不存在，这是正常的
    }

    const filePath = join(uploadDir, fileName);
    
    // 保存文件
    await writeFile(filePath, buffer);
    
    // 返回可访问的URL
    const fileUrl = `/uploads/images/${fileName}`;

    return NextResponse.json({
      success: true,
      url: fileUrl,
      message: '文件上传成功'
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: '文件上传失败' },
      { status: 500 }
    );
  }
}