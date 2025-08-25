import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dimensions: string[] }> }
) {
  try {
    const { dimensions } = await params;
    const [width = '400', height = '300'] = dimensions;
    
    // Create a simple SVG placeholder
    const svg = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="#f3f4f6"/>
        <rect x="${parseInt(width)/2-50}" y="${parseInt(height)/2-25}" width="100" height="50" fill="#9ca3af" rx="4"/>
        <text x="${parseInt(width)/2}" y="${parseInt(height)/2+5}" font-family="Arial, sans-serif" font-size="14" fill="#6b7280" text-anchor="middle">工艺指导</text>
        <text x="${parseInt(width)/2}" y="${parseInt(height)-20}" font-family="Arial, sans-serif" font-size="12" fill="#9ca3af" text-anchor="middle">${width}x${height}</text>
      </svg>
    `;

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600'
      }
    });

  } catch (error) {
    console.error('Placeholder image error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate placeholder' },
      { status: 500 }
    );
  }
}