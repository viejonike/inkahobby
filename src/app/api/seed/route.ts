import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST() {
  try {
    const existing = await db.user.findUnique({ where: { username: 'superadmin' } });
    if (existing) {
      return NextResponse.json({ message: 'Super admin already exists', user: existing });
    }

    const superAdmin = await db.user.create({
      data: {
        username: 'superadmin',
        pin: '9999',
        role: 'superadmin',
      },
    });

    return NextResponse.json({ message: 'Super admin created', user: superAdmin });
  } catch (error) {
    console.error('Error seeding super admin:', error);
    return NextResponse.json({ error: 'Failed to seed super admin' }, { status: 500 });
  }
}
