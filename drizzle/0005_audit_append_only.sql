-- audit_log is append-only, like booking_events (forbid_mutation from 0001).
CREATE TRIGGER audit_log_append_only_trg
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint

-- Outbox: e-mails can also go to an admin user (password reset).
ALTER TABLE "email_outbox" DROP CONSTRAINT "email_outbox_recipient_ck";
--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_recipient_ck" CHECK ("email_outbox"."recipient" in ('cliente', 'luisa', 'admin'));
--> statement-breakpoint
ALTER TABLE "email_outbox" DROP CONSTRAINT "email_outbox_target_ck";
--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_target_ck" CHECK ("email_outbox"."booking_id" is not null or "email_outbox"."customer_id" is not null or "email_outbox"."admin_user_id" is not null);
