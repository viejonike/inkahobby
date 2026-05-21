import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';

function hashPin(pin: string): string {
  return createHash('sha256').update(pin + '_inkahobby_salt_2024').digest('hex');
}

export async function POST() {
  try {
    const results: string[] = [];

    // Create superadmin if not exists
    const existingSuper = await db.user.findUnique({ where: { username: 'superadmin' } });
    if (!existingSuper) {
      await db.user.create({
        data: {
          username: 'superadmin',
          pin: hashPin('9999'),
          role: 'superadmin',
          blocked: false,
        },
      });
      results.push('Super admin created (superadmin / 9999)');
    } else {
      results.push('Super admin already exists');
    }

    // Create admin if not exists
    const existingAdmin = await db.user.findUnique({ where: { username: 'admin' } });
    if (!existingAdmin) {
      await db.user.create({
        data: {
          username: 'admin',
          pin: hashPin('1234'),
          role: 'admin',
          blocked: false,
        },
      });
      results.push('Admin created (admin / 1234)');
    } else {
      results.push('Admin already exists');
    }

    return NextResponse.json({ message: 'Seed completed', results });
  } catch (error) {
    console.error('Error seeding:', error);
    return NextResponse.json({ error: 'Failed to seed' }, { status: 500 });
  }
}
