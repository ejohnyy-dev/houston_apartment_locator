CREATE TABLE `rentcast_cron_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`cronExpression` varchar(64),
	`isEnabled` int NOT NULL DEFAULT 1,
	`lastRefreshAt` timestamp,
	`lastRefreshStatus` varchar(32),
	`lastRefreshStats` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rentcast_cron_config_id` PRIMARY KEY(`id`)
);
