import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('audio') as File;
    
    if (!file) {
      return NextResponse.json({ error: '没有找到音频文件' }, { status: 400 });
    }

    // 检查文件类型
    const allowedTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: '不支持的音频文件格式。请上传 MP3、WAV 或 OGG 文件' }, { status: 400 });
    }

    // 检查文件大小 (10MB限制)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: '音频文件太大。最大支持10MB' }, { status: 400 });
    }

    // 确保上传目录存在
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'audio');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // 生成唯一文件名
    const timestamp = Date.now();
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}-${originalName}`;
    const filePath = path.join(uploadsDir, fileName);

    // 保存文件
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    fs.writeFileSync(filePath, buffer);

    // 返回文件URL
    const fileUrl = `/uploads/audio/${fileName}`;
    
    return NextResponse.json({
      success: true,
      url: fileUrl,
      filename: fileName,
      size: file.size
    });
  } catch (error) {
    console.error('音频上传失败:', error);
    return NextResponse.json({ error: '音频上传失败' }, { status: 500 });
  }
}