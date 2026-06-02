CREATE TYPE "public"."doc_format" AS ENUM('markdown', 'html', 'txt', 'pdf');--> statement-breakpoint
CREATE TABLE "doc_blobs" (
	"doc_id" uuid PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "docs" ADD COLUMN "format" "doc_format" DEFAULT 'markdown' NOT NULL;--> statement-breakpoint
ALTER TABLE "doc_blobs" ADD CONSTRAINT "doc_blobs_doc_id_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."docs"("id") ON DELETE cascade ON UPDATE no action;