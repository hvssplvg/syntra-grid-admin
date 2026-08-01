import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import {
  DatabaseType,
  ProjectCategory,
  ProjectStatus,
  PrismaClient,
} from '../app/generated/prisma/client';

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not defined.`);
  }

  return value;
}

const connectionString = getRequiredEnv('DATABASE_URL');

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const esteem = await prisma.client.upsert({
    where: {
      slug: 'esteem-learning-centre',
    },

    update: {},

    create: {
      name: 'Esteem Learning Centre',
      slug: 'esteem-learning-centre',
      industry: 'Education',
      country: 'Nigeria',
      status: 'ACTIVE',

      projects: {
        create: [
          {
            name: 'School Management System',
            slug: 'school-management-system',
            description:
              'Web-based school management platform covering students, teachers, lesson plans, assignments and exam printing.',
            category: ProjectCategory.SCHOOL_MANAGEMENT,
            status: ProjectStatus.ACTIVE,
            databaseType: DatabaseType.FIREBASE,
            hostingProvider: 'Vercel',
            framework: 'Next.js',
          },
        ],
      },
    },

    include: {
      projects: {
        select: {
          name: true,
        },
      },
    },
  });

  const rentwise = await prisma.client.upsert({
    where: {
      slug: 'rentwise',
    },

    update: {},

    create: {
      name: 'RentWise',
      slug: 'rentwise',
      industry: 'Property Technology',
      country: 'United Kingdom',
      status: 'ACTIVE',

      projects: {
        create: [
          {
            name: 'RentWise Platform',
            slug: 'rentwise-platform',
            description:
              'Property technology platform for listings, verifications and tenant management.',
            category: ProjectCategory.PROPERTY_TECH,
            status: ProjectStatus.DEVELOPMENT,
            databaseType: DatabaseType.POSTGRESQL,
          },
        ],
      },
    },

    include: {
      projects: {
        select: {
          name: true,
        },
      },
    },
  });

  for (const client of [esteem, rentwise]) {
    console.log('✅ Client ready');
    console.log(`Name: ${client.name}`);
    console.log(`Slug: ${client.slug}`);
    console.log(`ID: ${client.id}`);
    console.log(
      `Projects: ${
        client.projects.map((project) => project.name).join(', ') ||
        '(existing — projects unchanged)'
      }`
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error('❌ Client seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });