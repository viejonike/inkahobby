import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';

function hashPin(pin: string): string {
  return createHash('sha256').update(pin + '_inkahobby_salt_2024').digest('hex');
}

export async function POST() {
  try {
    const existing = await db.user.findUnique({ where: { username: 'superadmin' } });
    if (existing) {
      return NextResponse.json({ message: 'Super admin already exists', user: existing });
    }

    const superAdmin = await db.user.create({
      data: {
        username: 'superadmin',
        pin: hashPin('9999'),
        role: 'superadmin',
        blocked: false,
      },
    });

    return NextResponse.json({ message: 'Super admin created', user: superAdmin });
  } catch (error) {
    console.error('Error seeding super admin:', error);
    return NextResponse.json({ error: 'Failed to seed super admin' }, { status: 500 });
  }
}
