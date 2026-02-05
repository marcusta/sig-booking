CREATE TABLE `course_suggestions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customerId` text NOT NULL,
	`level` text NOT NULL,
	`course` text NOT NULL,
	`suggestedAt` text NOT NULL
);

CREATE INDEX `course_suggestion_idx` ON `course_suggestions` (`customerId`,`level`,`course`);
