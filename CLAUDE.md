# CLAUDE.md - sig-booking

## Business Context

Sweden Indoor Golf (SIG) is an unmanned simulator golf facility. With no on-site staff, automation is critical to deliver a smooth experience — especially for first-time guests. This system is a key part of that automation effort.

## Project Overview

Webhook-based booking management system for SIG. Integrates with the Matchi booking platform to capture booking events (create, move, cancel), store them in SQLite, generate personalized bay display images, and provide an authenticated analytics dashboard.

## Tech Stack

- **Runtime:** Bun (TypeScript)
- **Web Framework:** Elysia (port 3001)
- **Database:** SQLite via better-sqlite3 + Drizzle ORM
- **Image Processing:** Sharp
- **Auth:** JWT tokens + SHA256 password hashing with salt
- **Logging:** Winston with daily rotation

## Commands

- `bun run --watch src/server.ts` - Dev server with hot reload
- `bun run src/server.ts` - Production server
- `bun run src/db/migrate.ts` - Run database migrations
- `bun run db:generate` - Generate new migration files (required when schema changes)
- `bunx drizzle-kit studio` - Visual database browser
- `bun run src/scripts/generate-password-hash.ts` - Generate password hash for new users

## Project Structure

```
src/
├── server.ts              # Elysia app entry point
├── routes.ts              # All HTTP route handlers
├── webhook_handlers.ts    # Matchi webhook event processors
├── user_message.ts        # Bay display message logic (booking state machine)
├── date.ts                # Date utilities (Stockholm timezone, UTC)
├── matchi_types.ts        # TypeScript interfaces for Matchi webhooks
├── logger.ts              # Winston logger config
├── db/
│   ├── db.ts              # Drizzle ORM init (SQLite)
│   ├── schema.ts          # Table definitions (bookings, booking_events)
│   ├── migrate.ts         # Migration runner
│   └── migrations/        # SQL migration files
├── middleware/
│   └── auth.ts            # JWT creation/verification, credential validation
├── services/
│   ├── booking_analysis.ts  # Monthly analytics (utilization, customer summaries)
│   └── html_generator.ts    # HTML table generation for reports
├── utils/
│   └── hash.ts            # SHA256 password hashing
├── image/
│   └── image-generator.ts # Text overlay on bay display images via Sharp
├── scripts/
│   └── generate-password-hash.ts
└── pages/
    └── login.html         # Login form
```

## Key Endpoints

- `POST /hook` - Matchi webhook receiver
- `GET /courts/:court/show-image` - Bay display image with personalized message
- `GET/POST /login` - Authentication
- `GET /booking_summary/:year/:month` - Monthly analytics (auth required)

## Database

- SQLite at `./data/matchi.db`
- Two tables: `bookings` (state tracking) and `booking_events` (audit log)
- Auth credentials in `./data/users.json` (salt + hashed passwords)

## Code Conventions

- TypeScript strict mode, ESNext target
- camelCase for variables/functions, PascalCase for types
- ES6 module imports
- Async/await throughout
- Minimal comments; self-documenting code
- Swedish-language user-facing messages
- Court IDs 2068-2077 map to bays 1-8
- Prime time: weekdays 16-21, weekends 8-18

## Environment

- `JWT_SECRET` - Set in production (has weak default)
- No `.env` file; config is hardcoded or in data files

## Git Commits

- Do NOT add "Co-Authored-By" lines to commit messages

## Production

- **Host:** `marcus@app.swedenindoorgolf.se`
- **Deploy path:** `/srv/sig-booking/`
- **Download prod DB:** `scp marcus@app.swedenindoorgolf.se:/srv/sig-booking/data/matchi.db ./data/matchi-prod.db`

## Testing

- `bun test` - Run all tests
- `bun test src/tests/user-message/` - Run a specific test directory
- Avoid mocking. Prefer real instances (in-memory SQLite, pure function inputs) over mocks/stubs. Structure code so the interesting logic is in pure functions that are trivially testable without mocking.
- Test files live in `src/tests/` mirroring the source structure.
