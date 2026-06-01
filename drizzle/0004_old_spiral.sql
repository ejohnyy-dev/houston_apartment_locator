ALTER TABLE `listings` MODIFY COLUMN `latitude` decimal(10,7);--> statement-breakpoint
ALTER TABLE `listings` MODIFY COLUMN `longitude` decimal(10,7);--> statement-breakpoint
ALTER TABLE `listings` ADD `streetAddress` varchar(500);--> statement-breakpoint
ALTER TABLE `listings` ADD `verifiedAddress` varchar(500);--> statement-breakpoint
ALTER TABLE `listings` ADD `addressMatchStatus` varchar(50);--> statement-breakpoint
ALTER TABLE `listings` ADD `price1brMin` int;--> statement-breakpoint
ALTER TABLE `listings` ADD `price1brMax` int;--> statement-breakpoint
ALTER TABLE `listings` ADD `price2brMin` int;--> statement-breakpoint
ALTER TABLE `listings` ADD `price2brMax` int;--> statement-breakpoint
ALTER TABLE `listings` ADD `phone` varchar(30);--> statement-breakpoint
ALTER TABLE `listings` ADD `email` varchar(320);--> statement-breakpoint
ALTER TABLE `listings` ADD `website` varchar(500);--> statement-breakpoint
ALTER TABLE `listings` ADD `actualWebsite` varchar(500);--> statement-breakpoint
ALTER TABLE `listings` ADD `lastScraped` timestamp;