import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    const where = search ? {
      OR: [
        { partNumber: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
        { sapDescription: { contains: search, mode: 'insensitive' as const } }
      ]
    } : {}

    const [parts, total] = await Promise.all([
      prisma.part.findMany({
        where,
        skip,
        take: limit,
        orderBy: { partNumber: 'asc' }
      }),
      prisma.part.count({ where })
    ])

    return NextResponse.json({
      success: true,
      data: {
        parts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    console.error('Error fetching parts:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch parts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    
    const part = await prisma.part.create({
      data: {
        partNumber: data.partNumber,
        name: data.name,
        sapDescription: data.sapDescription || null,
        visible: data.visible ?? true,
        category: data.category || null
      }
    })

    return NextResponse.json({
      success: true,
      data: part
    })
  } catch (error) {
    console.error('Error creating part:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create part' },
      { status: 500 }
    )
  }
}