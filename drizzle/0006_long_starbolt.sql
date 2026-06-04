CREATE TABLE `qualified_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionToken` varchar(128) NOT NULL,
	`email` varchar(320) NOT NULL,
	`qualificationData` text,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `qualified_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `qualified_sessions_sessionToken_unique` UNIQUE(`sessionToken`)
);
