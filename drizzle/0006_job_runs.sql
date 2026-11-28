CREATE TABLE "job_runs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "job_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"job" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean,
	"report" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "job_runs_job_idx" ON "job_runs" USING btree ("job","started_at");--> statement-breakpoint
-- The daily summary goes to the Luísa (EMAIL_ADMIN_NOTIFY) and is about no single booking.
ALTER TABLE "email_outbox" DROP CONSTRAINT "email_outbox_target_ck";
--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_target_ck" CHECK ("email_outbox"."booking_id" is not null or "email_outbox"."customer_id" is not null or "email_outbox"."admin_user_id" is not null or "email_outbox"."recipient" = 'luisa');
