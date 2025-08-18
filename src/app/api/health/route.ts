import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, db: 'ok' })
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'db_unreachable' }, { status: 500 })
  }
}


