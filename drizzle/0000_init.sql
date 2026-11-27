CREATE TYPE "public"."booking_source" AS ENUM('site', 'admin');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pendente', 'confirmado', 'concluido', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."cancel_reason" AS ENUM('pedido_cliente', 'imprevisto_maquiadora', 'nao_compareceu', 'recusado', 'expirado', 'outro');--> statement-breakpoint
CREATE TYPE "public"."event_duration" AS ENUM('ate_2h', '2_3h', '3_4h', '4_6h', 'mais_6h', 'dia_inteiro');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('pix', 'cartao', 'dinheiro');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pendente', 'sinal_pago', 'pago');--> statement-breakpoint
CREATE TYPE "public"."slot_mode" AS ENUM('grid', 'auto');--> statement-breakpoint
CREATE SEQUENCE "public"."booking_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_range_ck" CHECK ("blocks"."ends_at" > "blocks"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "booking_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "booking_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"booking_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_seq" bigint DEFAULT nextval('booking_code_seq') NOT NULL,
	"customer_id" uuid NOT NULL,
	"service_id" integer NOT NULL,
	"service_name" text NOT NULL,
	"duration_min" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"travel_fee_cents" integer DEFAULT 0 NOT NULL,
	"travel_to_min" integer DEFAULT 0 NOT NULL,
	"travel_back_min" integer DEFAULT 0 NOT NULL,
	"travel_distance_km" numeric(6, 1),
	"buffer_min" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"occupied" "tstzrange" DEFAULT 'empty'::tstzrange NOT NULL,
	"event_starts_at" timestamp with time zone,
	"event_duration" "event_duration",
	"address_enc" text NOT NULL,
	"complement_enc" text,
	"look_notes_enc" text,
	"allergy_notes_enc" text,
	"internal_notes_enc" text,
	"payment_method" "payment_method",
	"payment_status" "payment_status" DEFAULT 'pendente' NOT NULL,
	"status" "booking_status" DEFAULT 'pendente' NOT NULL,
	"cancel_reason" "cancel_reason",
	"cancel_note" text,
	"source" "booking_source" DEFAULT 'site' NOT NULL,
	"idempotency_key" text,
	"expires_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_code_seq_unique" UNIQUE("code_seq"),
	CONSTRAINT "bookings_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "bookings_range_ck" CHECK ("bookings"."ends_at" > "bookings"."starts_at"),
	CONSTRAINT "bookings_minutes_ck" CHECK ("bookings"."duration_min" > 0 and "bookings"."travel_to_min" >= 0 and "bookings"."travel_back_min" >= 0 and "bookings"."buffer_min" >= 0),
	CONSTRAINT "bookings_cancel_ck" CHECK (("bookings"."status" = 'cancelado') = ("bookings"."cancel_reason" is not null))
);
--> statement-breakpoint
CREATE TABLE "business_hours" (
	"weekday" smallint PRIMARY KEY NOT NULL,
	"is_open" boolean DEFAULT false NOT NULL,
	"opens_at" time DEFAULT '08:00' NOT NULL,
	"closes_at" time DEFAULT '19:00' NOT NULL,
	CONSTRAINT "business_hours_weekday_ck" CHECK ("business_hours"."weekday" between 0 and 6),
	CONSTRAINT "business_hours_range_ck" CHECK ("business_hours"."closes_at" > "business_hours"."opens_at")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone_e164" text NOT NULL,
	"email" text NOT NULL,
	"cpf_enc" text,
	"internal_notes_enc" text,
	"anonymized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_email_lower_ck" CHECK ("customers"."email" = lower("customers"."email"))
);
--> statement-breakpoint
CREATE TABLE "schedule_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"slot_mode" "slot_mode" DEFAULT 'auto' NOT NULL,
	"slot_grid" text[] DEFAULT '{08:00,09:30,11:00,14:00,15:30,17:00}'::text[] NOT NULL,
	"slot_step_min" integer DEFAULT 30 NOT NULL,
	"buffer_min" integer DEFAULT 15 NOT NULL,
	"min_notice_hours" integer DEFAULT 24 NOT NULL,
	"horizon_days" integer DEFAULT 180 NOT NULL,
	"lunch_enabled" boolean DEFAULT true NOT NULL,
	"lunch_start" time DEFAULT '12:30' NOT NULL,
	"lunch_end" time DEFAULT '13:30' NOT NULL,
	"manual_confirmation" boolean DEFAULT true NOT NULL,
	"pending_expiry_hours" integer DEFAULT 24 NOT NULL,
	"cancel_window_hours" integer DEFAULT 48 NOT NULL,
	"max_pending_per_contact" integer DEFAULT 2 NOT NULL,
	"ready_before_event_min" integer DEFAULT 30 NOT NULL,
	"recommended_margin_min" integer DEFAULT 60 NOT NULL,
	"travel_min_fee_cents" integer DEFAULT 3000 NOT NULL,
	"travel_per_km_cents" integer DEFAULT 250 NOT NULL,
	"travel_max_radius_km" integer DEFAULT 40 NOT NULL,
	"travel_safety_factor" numeric(3, 2) DEFAULT '1.30' NOT NULL,
	"base_address_enc" text,
	"bookings_paused" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_settings_singleton_ck" CHECK ("schedule_settings"."id" = 1),
	CONSTRAINT "schedule_settings_step_ck" CHECK ("schedule_settings"."slot_step_min" between 5 and 240),
	CONSTRAINT "schedule_settings_buffer_ck" CHECK ("schedule_settings"."buffer_min" between 0 and 120),
	CONSTRAINT "schedule_settings_lunch_ck" CHECK ("schedule_settings"."lunch_end" > "schedule_settings"."lunch_start")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "services_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"duration_min" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_slug_unique" UNIQUE("slug"),
	CONSTRAINT "services_duration_ck" CHECK ("services"."duration_min" between 15 and 600),
	CONSTRAINT "services_price_ck" CHECK ("services"."price_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blocks_range_idx" ON "blocks" USING btree ("starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "booking_events_booking_idx" ON "booking_events" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "bookings_starts_idx" ON "bookings" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "bookings_customer_idx" ON "bookings" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_phone_uq" ON "customers" USING btree ("phone_e164") WHERE "customers"."anonymized_at" is null;--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "customers" USING btree ("email");