import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, username, email, pin, role, blocked, createdAt } = body;

    if (!username || !pin) {
      return NextResponse.json({ error: 'Username and PIN are required' }, { status: 400 });
    }

    const user = await db.user.upsert({
      where: { username },
      update: {
        pin,
        role: role || 'user',
        ...(email !== undefined && { email }),
        ...(blocked !== undefined && { blocked }),
      },
      create: {
        id: id || undefined,
        username,
        email: email || null,
        pin,
        role: role || 'user',
        blocked: blocked || false,
        createdAt: createdAt ? new Date(createdAt) : undefined,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error syncing user:', error);
    return NextResponse.json({ error: 'Failed to sync user' }, { status: 500 });
  }
}
