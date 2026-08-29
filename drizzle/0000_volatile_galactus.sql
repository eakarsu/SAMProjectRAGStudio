CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`project_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`details_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_events_owner_idx` ON `audit_events` (`owner_id`,`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`project_id` text NOT NULL,
	`namespace` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`filename` text,
	`mime_type` text,
	`source_url` text,
	`storage_key` text,
	`content_hash` text NOT NULL,
	`content_text` text,
	`amendment_number` integer DEFAULT 0 NOT NULL,
	`supersedes_document_id` text,
	`is_authoritative` integer DEFAULT true NOT NULL,
	`extraction_status` text DEFAULT 'ready' NOT NULL,
	`page_count` integer,
	`byte_size` integer DEFAULT 0 NOT NULL,
	`ingested_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_project_hash_unique` ON `documents` (`owner_id`,`project_id`,`content_hash`);--> statement-breakpoint
CREATE INDEX `documents_project_idx` ON `documents` (`owner_id`,`project_id`,`amendment_number`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`project_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`stage` text DEFAULT 'queued' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`total_steps` integer NOT NULL,
	`current_step` integer DEFAULT 0 NOT NULL,
	`request_json` text NOT NULL,
	`result_json` text DEFAULT '[]' NOT NULL,
	`error` text,
	`model` text,
	`provider_response_ids_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `jobs_project_updated_idx` ON `jobs` (`owner_id`,`project_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`namespace` text NOT NULL,
	`notice_id` text NOT NULL,
	`solicitation_number` text,
	`title` text NOT NULL,
	`agency` text NOT NULL,
	`department` text,
	`naics` text,
	`set_aside` text,
	`place_of_performance` text,
	`posted_at` text,
	`response_deadline` text,
	`source_url` text,
	`raw_sam_json` text,
	`status` text DEFAULT 'active' NOT NULL,
	`rag_status` text DEFAULT 'indexing' NOT NULL,
	`rag_version` integer DEFAULT 1 NOT NULL,
	`readiness` integer DEFAULT 0 NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_owner_notice_unique` ON `projects` (`owner_id`,`notice_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `projects_owner_namespace_unique` ON `projects` (`owner_id`,`namespace`);--> statement-breakpoint
CREATE INDEX `projects_owner_updated_idx` ON `projects` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`project_id` text NOT NULL,
	`job_id` text,
	`title` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`generation_mode` text NOT NULL,
	`sections_json` text NOT NULL,
	`citations_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `proposals_project_updated_idx` ON `proposals` (`owner_id`,`project_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `rag_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`project_id` text NOT NULL,
	`namespace` text NOT NULL,
	`document_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`section` text,
	`page_number` integer,
	`char_start` integer NOT NULL,
	`char_end` integer NOT NULL,
	`content` text NOT NULL,
	`content_hash` text NOT NULL,
	`vector_json` text NOT NULL,
	`amendment_number` integer DEFAULT 0 NOT NULL,
	`is_superseded` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rag_chunks_doc_index_unique` ON `rag_chunks` (`document_id`,`chunk_index`);--> statement-breakpoint
CREATE INDEX `rag_chunks_scope_idx` ON `rag_chunks` (`owner_id`,`project_id`,`namespace`,`is_superseded`);--> statement-breakpoint
CREATE TABLE `rag_queries` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`project_id` text NOT NULL,
	`namespace` text NOT NULL,
	`query` text NOT NULL,
	`retrieved_chunk_ids_json` text NOT NULL,
	`answer_json` text NOT NULL,
	`mode` text NOT NULL,
	`model` text,
	`provider_response_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rag_queries_project_idx` ON `rag_queries` (`owner_id`,`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `requirements` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`project_id` text NOT NULL,
	`document_id` text NOT NULL,
	`chunk_id` text NOT NULL,
	`requirement_key` text NOT NULL,
	`text` text NOT NULL,
	`category` text DEFAULT 'General' NOT NULL,
	`status` text DEFAULT 'unreviewed' NOT NULL,
	`verification` text DEFAULT 'machine-extracted' NOT NULL,
	`citation_label` text NOT NULL,
	`assignee` text,
	`proposal_section` text,
	`amendment_number` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `requirements_project_key_unique` ON `requirements` (`project_id`,`requirement_key`);--> statement-breakpoint
CREATE INDEX `requirements_project_status_idx` ON `requirements` (`owner_id`,`project_id`,`status`);