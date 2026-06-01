ALTER TABLE `inquiries` ADD `nurtureStage` enum('pending','sent','skipped','failed') DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `inquiries` ADD `nurtureSentAt` timestamp;--> statement-breakpoint
ALTER TABLE `inquiries` ADD `nurtureScheduledFor` timestamp;--> statement-breakpoint
ALTER TABLE `inquiries` ADD `nurtureError` text;