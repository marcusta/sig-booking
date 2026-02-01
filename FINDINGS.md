# Findings & Issues

## Session: 2025-02-01 — Deployment Setup

### What was done

1. **Added deployment migration support** — `deploy.json`, `scripts/migrate.ts`, `scripts/health.ts`, package.json scripts, .gitignore updates
2. **Made DB path configurable** — `src/db/db.ts` now reads `process.env.DB_PATH` with fallback to `./data/matchi.db`
3. **Baselined Drizzle migrations** — Production DB was created outside Drizzle, so `scripts/migrate.ts` detects this and inserts the initial migration (`0000_noisy_prowler`) into `__drizzle_migrations` before running `migrate()`
4. **Preflight passes**, migration and validation tests pass against downloaded production DB

### Deploy config notes

- `serviceName: "bookings"` — matches services.json key and systemd unit
- `serverFolder: "sig-booking"` — server directory is `/srv/sig-booking/`, not `/srv/bookings/`
- DB path on server: `data/matchi.db`

---

## Known Issue: Booking query logic misses ongoing bookings

**File:** `src/user_message.ts` → `getActiveBookingsForCourt()` (line 120)

**Problem:** The query uses `startTime >= currentHour AND endTime <= nextHour`, which only matches bookings that both **start and end** within the current hour window. Bookings that started in a previous hour but are still ongoing are missed.

**Example at 13:49 CET (12:49 UTC):**
- Current hour window: `12:00Z` to `13:00Z`
- Booking `12:30-14:00 CET` = `11:30-13:00 UTC`
- `startTime` (11:30Z) is NOT `>= 12:00Z` → **not matched**, even though the booking is active

**This affects all show-image endpoints** — `/courts/:court/show-image` and `/matchi-courts/:matchiCourtId/show-image` both return 404 for ongoing bookings that didn't start in the current hour.

**Suggested fix:** Change the query to find bookings where `startTime < nextHour AND endTime > currentHour` (overlap check) instead of requiring the booking to fit entirely within the window.

**Additional detail:** The `toDateString()` function in `src/date.ts` (line 26) hardcodes `+02:00` (CEST) but Sweden is `+01:00` (CET) in winter. This may cause issues during winter months (October–March). Should use dynamic offset or just use UTC consistently.

---

## Ready to deploy

The service is in a deployable state. Run:

```bash
deploy
```

Future sessions can focus on fixing the booking query logic and timezone handling.
