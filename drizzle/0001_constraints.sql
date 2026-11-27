-- Hand-written: what Drizzle cannot express. See docs/adr/0004-concorrencia.md.

CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint

-- `occupied` = [start − travel to, end + travel back + buffer).
-- Computed in the database so the application can never store an inconsistent range.
CREATE OR REPLACE FUNCTION bookings_set_occupied() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.occupied := tstzrange(
    NEW.starts_at - make_interval(mins => NEW.travel_to_min),
    NEW.ends_at + make_interval(mins => NEW.travel_back_min + NEW.buffer_min),
    '[)'
  );
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER bookings_set_occupied_trg
BEFORE INSERT OR UPDATE OF starts_at, ends_at, travel_to_min, travel_back_min, buffer_min, status
ON bookings
FOR EACH ROW EXECUTE FUNCTION bookings_set_occupied();
--> statement-breakpoint

-- Two active bookings (pending or confirmed) can never overlap, including travel and buffer.
-- This is the last line of defence against double booking under concurrency.
ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (occupied WITH &&)
  WHERE (status IN ('pendente', 'confirmado'));
--> statement-breakpoint

-- Fast lookups of active bookings by time range (availability queries).
CREATE INDEX bookings_occupied_active_idx ON bookings USING gist (occupied)
  WHERE status IN ('pendente', 'confirmado');
--> statement-breakpoint

-- booking_events is append-only.
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint

CREATE TRIGGER booking_events_append_only_trg
BEFORE UPDATE OR DELETE ON booking_events
FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint

-- Single settings row and the weekly schedule always exist.
INSERT INTO schedule_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO business_hours (weekday, is_open, opens_at, closes_at) VALUES
  (0, false, '08:00', '19:00'),
  (1, false, '08:00', '19:00'),
  (2, true,  '08:00', '19:00'),
  (3, true,  '08:00', '19:00'),
  (4, true,  '08:00', '19:00'),
  (5, true,  '08:00', '19:00'),
  (6, true,  '08:00', '19:00')
ON CONFLICT DO NOTHING;
