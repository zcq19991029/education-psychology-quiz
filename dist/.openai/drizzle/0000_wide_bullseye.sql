CREATE TABLE `question_banks` (
	`user_id` text NOT NULL,
	`subject` text NOT NULL,
	`questions_json` text DEFAULT '[]' NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `subject`)
);
