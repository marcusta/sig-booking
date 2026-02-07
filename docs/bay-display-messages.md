# Bay Display Message Logic

The bay displays show personalized messages to customers as they arrive and leave. This document describes when each message type is shown, how back-to-back bookings are handled, and how the query functions work.

## Message Types

| Type | API value | Purpose |
|------|-----------|---------|
| Welcome | `welcome` | Greet the customer at the start of their session |
| Ending (free) | `ending-free` | Inform the customer their session is ending, bay is available after |
| Ending (booked) | `ending-booked` | Inform the customer their session is ending, next customer is coming |

## Architecture: Rule-Based State Machine

The logic is split into two phases:

### Phase 1: Build Context

Query the database and compute all decision inputs into a single `MessageContext` object:

```typescript
interface MessageContext {
  current: Booking | null;        // startTime <= now < endTime
  next: Booking | null;           // earliest booking where startTime > now (2h lookahead)
  previous: Booking | null;       // most recent booking where endTime <= now (1h lookback)
  isNearEnd: boolean;             // within 5 min of current.endTime
  isAboutToStart: boolean;        // within 5 min of next.startTime (and no current)
  nextIsConsecutive: boolean;     // next.startTime === current.endTime
  sameCustomerAsPrevious: boolean;
  sameCustomerAsNext: boolean;
}
```

### Phase 2: Evaluate Rules

An ordered list of named rules is evaluated top to bottom. The first rule whose `when` condition matches produces the result.

| # | Rule name | Conditions | Result |
|---|-----------|------------|--------|
| 1 | `welcome` | current exists, !hasShownStartMessage, not same customer as previous | `start` |
| 2 | `welcome-continuation` | current exists, !hasShownStartMessage, same customer as previous | null (mark start shown) |
| 3 | `early-welcome` | no current, next exists, !hasShownStartMessage, isAboutToStart | `start` (for next) |
| 4 | `ending-free` | current exists, hasShownStartMessage, !hasShownEndMessage, isNearEnd, next is not consecutive | `end-free` |
| 5 | `ending-occupied` | current exists, hasShownStartMessage, !hasShownEndMessage, isNearEnd, nextIsConsecutive, different customer | `end-occupied` |
| 6 | `ending-continuation` | current exists, hasShownStartMessage, !hasShownEndMessage, isNearEnd, nextIsConsecutive, same customer | null (mark end shown) |

If no rule matches, return null.

Each rule has a name for logging and debugging — when a rule fires, the name is logged along with the context that triggered it.

## Query Functions

Three database queries drive the logic. All use the booking's actual `startTime` and `endTime` — no hour-boundary assumptions.

### getCurrentBooking(courtId)

Finds a booking where `startTime <= now < endTime`. This is the booking actively in progress right now.

### getNextBooking(courtId)

Finds the earliest booking where `startTime > now`, limited to a 2-hour lookahead.

### getPreviousBooking(courtId)

Finds the most recent booking where `endTime <= now`, limited to a 1-hour lookback. Ordered by `endTime` descending to get the most recent.

## Near-End-of-Booking Detection

Instead of checking clock positions (e.g. `:55` past the hour), we calculate proximity to the **current booking's actual `endTime`**:

```
minutesUntilEnd = currentBooking.endTime - now
isNearEnd = minutesUntilEnd <= 5 minutes AND minutesUntilEnd >= 0
```

Similarly, for early welcome of an upcoming booking:

```
minutesUntilStart = nextBooking.startTime - now
isAboutToStart = minutesUntilStart <= 5 minutes AND minutesUntilStart >= 0
```

## Back-to-Back Booking Handling

When the same customer has consecutive bookings on a court, the intermediate boundaries are invisible:

- **No repeated welcome:** Rule `welcome-continuation` detects that the previous booking was the same customer and suppresses the welcome message.
- **No intermediate ending:** Rule `ending-continuation` detects that the next booking is the same customer and suppresses the ending message.

The customer sees exactly one welcome at the start of their first slot and one ending near the end of their last slot.

### "Consecutive" definition

The next booking is considered consecutive if its `startTime` equals the current booking's `endTime`. If there is a gap (e.g. current ends 10:30, next starts 11:00), the bay is free in between and the ending message is `end-free`.

## Examples

### Example 1: Single 60-minute booking

Customer A books bay 3 from 14:00 to 15:00.

| Time  | currentBooking | nextBooking | Rule matched | Result |
|-------|---------------|-------------|--------------|--------|
| 13:57 | none | A 14:00-15:00 | `early-welcome` | `start` for A |
| 14:00 | A 14:00-15:00 | none | (none, start already shown) | null |
| 14:30 | A 14:00-15:00 | none | (none, mid-session) | null |
| 14:55 | A 14:00-15:00 | none | `ending-free` | `end-free` for A |
| 15:00 | none | none | (none) | null |

### Example 2: Single 30-minute booking

Customer A books bay 3 from 10:00 to 10:30.

| Time  | currentBooking | nextBooking | Rule matched | Result |
|-------|---------------|-------------|--------------|--------|
| 09:57 | none | A 10:00-10:30 | `early-welcome` | `start` for A |
| 10:00 | A 10:00-10:30 | none | (none, start already shown) | null |
| 10:15 | A 10:00-10:30 | none | (none, mid-session) | null |
| 10:25 | A 10:00-10:30 | none | `ending-free` | `end-free` for A |
| 10:30 | none | none | (none) | null |

### Example 3: Back-to-back same customer (3 x 30 min)

Customer A books bay 5 from 10:00-10:30, 10:30-11:00, and 11:00-11:30.

| Time  | currentBooking | previousBooking | nextBooking | Rule matched | Result |
|-------|---------------|-----------------|-------------|--------------|--------|
| 09:57 | none | none | A 10:00-10:30 | `early-welcome` | `start` for A |
| 10:00 | A 10:00-10:30 | none | A 10:30-11:00 | (none, start already shown) | null |
| 10:25 | A 10:00-10:30 | — | A 10:30-11:00 | `ending-continuation` | null |
| 10:30 | A 10:30-11:00 | A 10:00-10:30 | A 11:00-11:30 | `welcome-continuation` | null |
| 10:55 | A 10:30-11:00 | — | A 11:00-11:30 | `ending-continuation` | null |
| 11:00 | A 11:00-11:30 | A 10:30-11:00 | none | `welcome-continuation` | null |
| 11:25 | A 11:00-11:30 | — | none | `ending-free` | `end-free` for A |

Customer A sees: one welcome at ~09:57, one ending at ~11:25.

### Example 4: Handoff between two customers

Customer A books 10:00-10:30, Customer B books 10:30-11:00.

| Time  | currentBooking | previousBooking | nextBooking | Rule matched | Result |
|-------|---------------|-----------------|-------------|--------------|--------|
| 09:57 | none | none | A 10:00-10:30 | `early-welcome` | `start` for A |
| 10:15 | A 10:00-10:30 | — | B 10:30-11:00 | (none, mid-session) | null |
| 10:25 | A 10:00-10:30 | — | B 10:30-11:00 | `ending-occupied` | `end-occupied` for A |
| 10:30 | B 10:30-11:00 | A 10:00-10:30 | none | `welcome` | `start` for B |
| 10:55 | B 10:30-11:00 | — | none | `ending-free` | `end-free` for B |

### Example 5: Gap between bookings

Customer A books 10:00-10:30, Customer B books 11:00-11:30 (30-minute gap).

| Time  | currentBooking | nextBooking | Rule matched | Result |
|-------|---------------|-------------|--------------|--------|
| 10:25 | A 10:00-10:30 | B 11:00-11:30 | `ending-free` | `end-free` for A (next doesn't start at endTime) |
| 10:30 | none | B 11:00-11:30 | (none, 30 min away) | null |
| 10:57 | none | B 11:00-11:30 | `early-welcome` | `start` for B |

### Example 6: Mixed durations back-to-back

Customer A books 10:00-11:00 (60 min), Customer A books 11:00-11:30 (30 min).

| Time  | currentBooking | previousBooking | nextBooking | Rule matched | Result |
|-------|---------------|-----------------|-------------|--------------|--------|
| 09:57 | none | none | A 10:00-11:00 | `early-welcome` | `start` for A |
| 10:30 | A 10:00-11:00 | — | A 11:00-11:30 | (none, mid-session) | null |
| 10:55 | A 10:00-11:00 | — | A 11:00-11:30 | `ending-continuation` | null |
| 11:00 | A 11:00-11:30 | A 10:00-11:00 | none | `welcome-continuation` | null |
| 11:25 | A 11:00-11:30 | — | none | `ending-free` | `end-free` for A |

### Example 7: No bookings at all

| Time  | currentBooking | nextBooking | Rule matched | Result |
|-------|---------------|-------------|--------------|--------|
| any   | none | none | (none) | null |
