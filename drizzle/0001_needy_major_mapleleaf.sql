CREATE TABLE `qualifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` varchar(255) NOT NULL,
	`preferredAreas` text,
	`moveInTimeline` varchar(50),
	`minBedrooms` int,
	`maxBedrooms` int,
	`minBathrooms` int,
	`maxBathrooms` int,
	`minBudget` int,
	`maxBudget` int,
	`pets` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `qualifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `inquiries` ADD `qualificationData` text;