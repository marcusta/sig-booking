CREATE TABLE `booking_events` (
	`matchi_id` text NOT NULL,
	`matchi_timestamp` text NOT NULL,
	`timestamp` text NOT NULL,
	`booking_id` text NOT NULL,
	`event_data` text
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`bookingId` text PRIMARY KEY NOT NULL,
	`courtId` text NOT NULL,
	`courtName` text NOT NULL,
	`endTime` text NOT NULL,
	`splitPayment` integer DEFAULT false NOT NULL,
	`startTime` text NOT NULL,
	`customerId` text NOT NULL,
	`email` text NOT NULL,
	`userId` text NOT NULL,
	`firstName` text NOT NULL,
	`lastName` text NOT NULL,
	`issuerId` text NOT NULL,
	`players` text,
	`cancelled` integer DEFAULT false NOT NULL,
	`hasShownStartMessage` integer DEFAULT false NOT NULL,
	`hasShownEndMessage` integer DEFAULT false NOT NULL
);
