import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { getEsteemOverview } from '@/lib/integrations/firebase/getOverview';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data: session } = await auth.getSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorised' },
        { status: 401 }
      );
    }

    const admin = await prisma.adminUser.findUnique({
      where: {
        authUserId: session.user.id,
      },
      select: {
        active: true,
      },
    });

    if (!admin?.active) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const overview = await getEsteemOverview();

    return NextResponse.json({
      success: true,
      client: 'Esteem Learning Centre',
      overview,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Esteem integration failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Could not load Esteem Learning Centre data.',
      },
      { status: 500 }
    );
  }
}