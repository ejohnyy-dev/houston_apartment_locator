CREATE TABLE `saved_searches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`filters` text NOT NULL,
	`seenListingIds` text,
	`isActive` int NOT NULL DEFAULT 1,
	`lastCheckedAt` timestamp,
	`lastAlertAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saved_searches_id` PRIMARY KEY(`id`)
);
