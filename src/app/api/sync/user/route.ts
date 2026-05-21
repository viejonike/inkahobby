import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, username, pin, role, createdAt } = body;

    if (!username || !pin) {
      return NextResponse.json({ error: 'Username and PIN are required' }, { status: 400 });
    }

    const user = await db.user.upsert({
      where: { username },
      update: { pin, role: role || 'user' },
      create: {
        id: id || undefined,
        username,
        pin,
        role: role || 'user',
        createdAt: createdAt ? new Date(createdAt) : undefined,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error syncing user:', error);
    return NextResponse.json({ error: 'Failed to sync user' }, { status: 500 });
  }
}
