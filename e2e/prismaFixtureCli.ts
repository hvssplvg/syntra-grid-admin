// e2e/prismaFixtureCli.ts
//
// Standalone script, run via `npx tsx` as a separate OS process — NOT
// imported directly into any Playwright spec or fixtures.ts.
//
// Why this exists: lib/prisma.ts imports the generated Prisma client,
// which uses `import.meta` (ESM-only syntax). Playwright's own TS
// transform compiles spec/fixture files to CommonJS, which cannot load
// that syntax — importing lib/prisma.ts directly from e2e/fixtures.ts
// fails with "Cannot use 'import.meta' outside a module" the moment
// Playwright tries to run a test. `tsx` (already a devDependency, already
// used this way for prisma/seed.ts) runs this file in a real ESM-aware
// context instead, so it loads fine as its own process; fixtures.ts shells
// out to it and reads back JSON over stdout.
//
// Also: DELETE /api/admin/clients/[id] only archives a client (soft
// delete — status becomes ARCHIVED, the row stays forever). That's wrong
// for e2e cleanup, which needs an actual hard delete so repeated runs
// don't leave permanent fixture-prefixed clutter in the real database.
// This script does the one genuinely hard delete fixtures need.

// NOTE: esbuild (tsx's transform) hoists all static imports above any
// other top-level code regardless of source order, so a dotenv.config()
// call placed "before" the next import here would NOT actually run first
// — tried that, confirmed it doesn't help. Instead, this process relies on
// inheriting an already-populated `process.env` from whatever spawned it:
// fixtures.ts's execFileSync (which runs inside the Playwright test
// process, itself env-loaded by playwright.config.ts's own dotenv.config()
// call) passes `process.env` through to this child by default. For a
// standalone run (not via Playwright), export DATABASE_URL yourself first.
import { prisma } from "@/lib/prisma";

async function main() {
  const [, , command, argsJson] = process.argv;
  const args = argsJson ? JSON.parse(argsJson) : {};

  switch (command) {
    case "seedClient": {
      const client = await prisma.client.create({
        data: {
          name: args.name,
          slug: args.slug,
          displayName: args.displayName,
          logoUrl: args.logoUrl ?? null,
          status: "ACTIVE",
        },
        select: { id: true, name: true, slug: true },
      });
      process.stdout.write(JSON.stringify(client));
      break;
    }
    case "seedEndpoint": {
      const endpoint = await prisma.monitoredEndpoint.create({
        data: { clientId: args.clientId, label: args.label, url: args.url, method: "GET" },
        select: { id: true, label: true },
      });
      process.stdout.write(JSON.stringify(endpoint));
      break;
    }
    case "seedProject": {
      const project = await prisma.project.create({
        data: { clientId: args.clientId, name: args.name, slug: args.slug, category: "CUSTOM_SYSTEM" },
        select: { id: true, name: true },
      });
      process.stdout.write(JSON.stringify(project));
      break;
    }
    case "seedSystem": {
      const system = await prisma.managedSystem.create({
        data: {
          clientId: args.clientId ?? null,
          projectId: args.projectId ?? null,
          name: args.name,
          systemType: args.systemType ?? "WEBSITE",
        },
        select: { id: true, name: true, clientId: true },
      });
      process.stdout.write(JSON.stringify(system));
      break;
    }
    case "seedDeployment": {
      const deployment = await prisma.deployment.create({
        data: {
          projectId: args.projectId,
          status: args.status ?? "SUCCESS",
          environment: args.environment ?? "production",
          branch: args.branch ?? "main",
          finishedAt: new Date(),
        },
        select: { id: true, status: true },
      });
      process.stdout.write(JSON.stringify(deployment));
      break;
    }
    case "teardown": {
      // ManagedSystem.client uses onDelete: SetNull, not Cascade — deleting
      // the fixture Client alone would silently orphan fixture systems
      // (clientId set to null) rather than removing them, since a null
      // clientId is exactly what a real Syntra-Grid-internal system looks
      // like. Delete fixture-prefixed ManagedSystem rows explicitly, by
      // name, before (or regardless of) deleting the Client.
      //
      // Wrapped in its own try/catch: the ManagedSystem migration may not
      // be applied to this database yet (it's reviewed-but-pending, per
      // this phase's own plan), in which case the table genuinely doesn't
      // exist — that must never break teardown for every OTHER fixture
      // (Client/MonitoredEndpoint/etc.) that predates this table.
      try {
        await prisma.managedSystem.deleteMany({ where: { name: { startsWith: args.prefix } } });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("does not exist")) throw error;
      }
      const result = await prisma.client.deleteMany({ where: { name: { startsWith: args.prefix } } });
      process.stdout.write(JSON.stringify({ ok: true, deletedCount: result.count }));
      break;
    }
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
