import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json()
    
    const part = await prisma.part.update({
      where: { id: params.id },
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
    console.error('Error updating part:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update part' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.part.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      success: true,
      data: null
    })
  } catch (error) {
    console.error('Error deleting part:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete part' },
      { status: 500 }
    )
  }
}