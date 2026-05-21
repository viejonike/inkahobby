import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';

function hashPin(pin: string): string {
  return createHash('sha256').update(pin + '_inkahobby_salt_2024').digest('hex');
}

export async function POST() {
  try {
    const results: string[] = [];

    // Create superadmin if not exists (email-based login)
    const existingSuper = await db.user.findUnique({ where: { username: 'superadmin' } });
    if (!existingSuper) {
      await db.user.create({
        data: {
          username: 'superadmin',
          email: 'superadmin@inkahobby.com',
          pin: hashPin('InkaSuper2024!'),
          role: 'superadmin',
          blocked: false,
        },
      });
      results.push('Super admin created (superadmin@inkahobby.com / InkaSuper2024!)');
    } else {
      // Update existing superadmin with email and new password
      await db.user.update({
        where: { username: 'superadmin' },
        data: {
          email: 'superadmin@inkahobby.com',
          pin: hashPin('InkaSuper2024!'),
        },
      });
      results.push('Super admin updated with email credentials');
    }

    // Create admin if not exists (email-based login)
    const existingAdmin = await db.user.findUnique({ where: { username: 'admin' } });
    if (!existingAdmin) {
      await db.user.create({
        data: {
          username: 'admin',
          email: 'admin@inkahobby.com',
          pin: hashPin('InkaAdmin2024!'),
          role: 'admin',
          blocked: false,
        },
      });
      results.push('Admin created (admin@inkahobby.com / InkaAdmin2024!)');
    } else {
      // Update existing admin with email and new password
      await db.user.update({
        where: { username: 'admin' },
        data: {
          email: 'admin@inkahobby.com',
          pin: hashPin('InkaAdmin2024!'),
        },
      });
      results.push('Admin updated with email credentials');
    }

    return NextResponse.json({ message: 'Seed completed', results });
  } catch (error) {
    console.error('Error seeding:', error);
    return NextResponse.json({ error: 'Failed to seed' }, { status: 500 });
  }
}
