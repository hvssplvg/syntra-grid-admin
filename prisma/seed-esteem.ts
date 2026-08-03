// prisma/seed-esteem.ts
//
// Moves the hardcoded Esteem account out of lib/clients/registry.ts and into
// the database, so the client list is data rather than code.
//
// Run once: npx tsx prisma/seed-esteem.ts
// Safe to re-run — upserts on slug.

import { prisma } from '../lib/prisma';

async function main() {
  const client = await prisma.client.upsert({
    where: {
      slug: 'esteem-learning-centre',
    },

    update: {},

    create: {
      clientRef: 'SYN-ELC-001',
      name: 'Esteem Learning Centre',
      slug: 'esteem-learning-centre',
      logoUrl: '/images/esteem.png',
      productName: 'School Management Platform',
      industry: 'Education',
      country: 'Nigeria',
      status: 'ACTIVE',

      domain: 'esteemlearningcentre.com.ng',
      adminUrl:
        'https://esteemlearningcentre.com.ng/portal/staff-login',

      plan: 'Founding Partner',
      billingCycle: 'ANNUAL',
      renewalAt: new Date('2027-09-01'),
      liveSince: new Date('2025-09-01'),
      contractValue: '0',
      currency: 'NGN',

      // Env-var prefix. Credentials resolve as:
      // ESTEEM_LEARNING_CENTRE_FIREBASE_PROJECT_ID, etc.
      integrationKey: 'ESTEEM_LEARNING_CENTRE',
      integrationLive: true,

      contactName: 'School Administrator',
      contactRole: 'Head of Administration',
      contactEmail: 'admin@esteemlearningcentre.com.ng',

      billing: {
        create: {},
      },
    },
  });

  const project = await prisma.project.upsert({
    where: {
      clientId_slug: {
        clientId: client.id,
        slug: 'school-management-system',
      },
    },

    update: {},

    create: {
      clientId: client.id,
      name: 'School Management System',
      slug: 'school-management-system',
      description:
        'Students, staff, admissions, academics, library, finance and health, in one dashboard.',
      category: 'SCHOOL_MANAGEMENT',
      status: 'ACTIVE',
      productionUrl: 'https://esteemlearningcentre.com.ng',
      adminUrl:
        'https://esteemlearningcentre.com.ng/portal/staff-login',
      hostingProvider: 'Vercel',
      databaseType: 'FIREBASE',
      framework: 'Vanilla JS + Firebase',
    },
  });

  const existingIntegration =
    await prisma.integration.findFirst({
      where: {
        projectId: project.id,
        provider: 'FIREBASE',
      },
      select: {
        id: true,
      },
    });

  if (!existingIntegration) {
    await prisma.integration.create({
      data: {
        projectId: project.id,
        name: 'Firebase (ryvex-school-system)',
        provider: 'FIREBASE',
        status: 'CONNECTED',
        credentialKey: 'ESTEEM_LEARNING_CENTRE',
        syncEnabled: true,
      },
    });
  }

  console.log(`Seeded ${client.name} (${client.slug})`);
}

main()
  .catch((error: unknown) => {
    console.error('Esteem seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });