# AGENTS.md - sig-booking

## Migration Workflow

- When `src/db/schema.ts` changes, run `bun run db:generate` to create the migration. Do not hand-write migrations.
