/**
 * Database schema (Drizzle). The SQL migrations in /drizzle are the source of
 * truth for what Drizzle cannot express: the btree_gist extension, the
 * anti-overlap EXCLUDE constraint and the trigger that computes `occupied`.
 * See docs/adr/0003 and 0004.
 */
import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/** Postgres tstzrange, read as its text form. Only the trigger writes it. */
const tstzrange = customType<{ data: string; driverData: string }>({
  dataType: () => 'tstzrange',
})

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

export const bookingStatus = pgEnum('booking_status', [
  'pendente',
  'confirmado',
  'concluido',
  'cancelado',
])

export const cancelReason = pgEnum('cancel_reason', [
  'pedido_cliente',
  'imprevisto_maquiadora',
  'nao_compareceu',
  'recusado',
  'expirado',
  'outro',
])

export const bookingSource = pgEnum('booking_source', ['site', 'admin'])
export const slotMode = pgEnum('slot_mode', ['grid', 'auto'])

export const eventDuration = pgEnum('event_duration', [
  'ate_2h',
  '2_3h',
  '3_4h',
  '4_6h',
  'mais_6h',
  'dia_inteiro',
])

export const paymentMethod = pgEnum('payment_method', ['pix', 'cartao', 'dinheiro'])
export const paymentStatus = pgEnum('payment_status', ['pendente', 'sinal_pago', 'pago'])

/** Human-readable booking code: LSR-0001. A label, never a credential. */
export const bookingCodeSeq = pgSequence('booking_code_seq', { startWith: 1 })

export const services = pgTable(
  'services',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    durationMin: integer('duration_min').notNull(),
    priceCents: integer('price_cents').notNull(),
    description: text('description').notNull().default(''),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    check('services_duration_ck', sql`${t.durationMin} between 15 and 600`),
    check('services_price_ck', sql`${t.priceCents} >= 0`),
  ],
)

/** Weekly opening hours, local time (America/Sao_Paulo). Includes travel time. */
export const businessHours = pgTable(
  'business_hours',
  {
    weekday: smallint('weekday').primaryKey(), // 0 = domingo … 6 = sábado
    isOpen: boolean('is_open').notNull().default(false),
    opensAt: time('opens_at').notNull().default('08:00'),
    closesAt: time('closes_at').notNull().default('19:00'),
  },
  (t) => [
    check('business_hours_weekday_ck', sql`${t.weekday} between 0 and 6`),
    check('business_hours_range_ck', sql`${t.closesAt} > ${t.opensAt}`),
  ],
)

/** Single-row table with every scheduling rule editable in the admin panel. */
export const scheduleSettings = pgTable(
  'schedule_settings',
  {
    id: smallint('id').primaryKey().default(1),
    slotMode: slotMode('slot_mode').notNull().default('auto'),
    slotGrid: text('slot_grid')
      .array()
      .notNull()
      .default(sql`'{08:00,09:30,11:00,14:00,15:30,17:00}'::text[]`),
    slotStepMin: integer('slot_step_min').notNull().default(30),
    bufferMin: integer('buffer_min').notNull().default(15),
    minNoticeHours: integer('min_notice_hours').notNull().default(24),
    horizonDays: integer('horizon_days').notNull().default(180),
    lunchEnabled: boolean('lunch_enabled').notNull().default(true),
    lunchStart: time('lunch_start').notNull().default('12:30'),
    lunchEnd: time('lunch_end').notNull().default('13:30'),
    manualConfirmation: boolean('manual_confirmation').notNull().default(true),
    pendingExpiryHours: integer('pending_expiry_hours').notNull().default(24),
    cancelWindowHours: integer('cancel_window_hours').notNull().default(48),
    maxPendingPerContact: integer('max_pending_per_contact').notNull().default(2),
    /** Event rule (Phase 0, R3): ready this long before the event… */
    readyBeforeEventMin: integer('ready_before_event_min').notNull().default(30),
    /** …and we recommend finishing this much earlier still. */
    recommendedMarginMin: integer('recommended_margin_min').notNull().default(60),
    /** Travel fee (Phase 0, R4). TODO(Leo): values to be confirmed by the Luísa. */
    travelMinFeeCents: integer('travel_min_fee_cents').notNull().default(3000),
    travelPerKmCents: integer('travel_per_km_cents').notNull().default(250),
    travelMaxRadiusKm: integer('travel_max_radius_km').notNull().default(40),
    travelSafetyFactor: numeric('travel_safety_factor', { precision: 3, scale: 2 })
      .notNull()
      .default('1.30'),
    /** Luísa's departure address, encrypted (never shown publicly). */
    baseAddressEnc: text('base_address_enc'),
    /** Coordinates of the departure address, encrypted JSON {lat,lng} (reveals her home). */
    baseLocationEnc: text('base_location_enc'),
    bookingsPaused: boolean('bookings_paused').notNull().default(false),
    updatedAt: timestamps.updatedAt,
  },
  (t) => [
    check('schedule_settings_singleton_ck', sql`${t.id} = 1`),
    check('schedule_settings_step_ck', sql`${t.slotStepMin} between 5 and 240`),
    check('schedule_settings_buffer_ck', sql`${t.bufferMin} between 0 and 120`),
    check('schedule_settings_lunch_ck', sql`${t.lunchEnd} > ${t.lunchStart}`),
  ],
)

/** Times the Luísa is unavailable (vacation, appointments). */
export const blocks = pgTable(
  'blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    allDay: boolean('all_day').notNull().default(false),
    reason: text('reason').notNull().default(''),
    ...timestamps,
  },
  (t) => [
    check('blocks_range_ck', sql`${t.endsAt} > ${t.startsAt}`),
    index('blocks_range_idx').on(t.startsAt, t.endsAt),
  ],
)

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    phoneE164: text('phone_e164').notNull(),
    email: text('email').notNull(),
    cpfEnc: text('cpf_enc'),
    internalNotesEnc: text('internal_notes_enc'),
    anonymizedAt: timestamp('anonymized_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('customers_phone_uq')
      .on(t.phoneE164)
      .where(sql`${t.anonymizedAt} is null`),
    index('customers_email_idx').on(t.email),
    check('customers_email_lower_ck', sql`${t.email} = lower(${t.email})`),
  ],
)

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    codeSeq: bigint('code_seq', { mode: 'number' })
      .notNull()
      .unique()
      .default(sql`nextval('booking_code_seq')`),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    serviceId: integer('service_id')
      .notNull()
      .references(() => services.id),
    // Snapshot of the service at booking time (prices and durations may change later).
    serviceName: text('service_name').notNull(),
    durationMin: integer('duration_min').notNull(),
    priceCents: integer('price_cents').notNull(),
    travelFeeCents: integer('travel_fee_cents').notNull().default(0),
    travelToMin: integer('travel_to_min').notNull().default(0),
    travelBackMin: integer('travel_back_min').notNull().default(0),
    travelDistanceKm: numeric('travel_distance_km', { precision: 6, scale: 1 }),
    bufferMin: integer('buffer_min').notNull().default(0),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    /** [start − travel to, end + travel back + buffer). Set by trigger, never by the app. */
    occupied: tstzrange('occupied')
      .notNull()
      .default(sql`'empty'::tstzrange`),
    eventStartsAt: timestamp('event_starts_at', { withTimezone: true }),
    eventDuration: eventDuration('event_duration'),
    addressEnc: text('address_enc').notNull(),
    complementEnc: text('complement_enc'),
    lookNotesEnc: text('look_notes_enc'),
    allergyNotesEnc: text('allergy_notes_enc'),
    internalNotesEnc: text('internal_notes_enc'),
    paymentMethod: paymentMethod('payment_method'),
    paymentStatus: paymentStatus('payment_status').notNull().default('pendente'),
    status: bookingStatus('status').notNull().default('pendente'),
    cancelReason: cancelReason('cancel_reason'),
    cancelNote: text('cancel_note'),
    source: bookingSource('source').notNull().default('site'),
    idempotencyKey: text('idempotency_key').unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check('bookings_range_ck', sql`${t.endsAt} > ${t.startsAt}`),
    check(
      'bookings_minutes_ck',
      sql`${t.durationMin} > 0 and ${t.travelToMin} >= 0 and ${t.travelBackMin} >= 0 and ${t.bufferMin} >= 0`,
    ),
    check('bookings_cancel_ck', sql`(${t.status} = 'cancelado') = (${t.cancelReason} is not null)`),
    index('bookings_starts_idx').on(t.startsAt),
    index('bookings_customer_idx').on(t.customerId),
    index('bookings_status_idx').on(t.status),
  ],
)

/**
 * Secret links that let a client see and manage her own booking ("Minha agenda").
 * Only the SHA-256 of the token is stored (docs/adr/0008-tokens-cliente.md).
 */
export const bookingTokens = pgTable(
  'booking_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('booking_tokens_booking_idx').on(t.bookingId)],
)

/** Timeline shown in the admin drawer ("Histórico"). Append-only. */
export const bookingEvents = pgTable(
  'booking_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id),
    type: text('type').notNull(),
    actor: text('actor').notNull(), // 'cliente' | 'sistema' | admin user id (Phase 5)
    data: jsonb('data').notNull().default({}),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('booking_events_booking_idx').on(t.bookingId, t.createdAt)],
)

// ── Admin panel (Phase 5, docs/adr/0005-auth-admin.md) ──────────────────────

export const adminUsers = pgTable(
  'admin_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    /** scrypt, self-describing format (src/server/auth/password.ts). */
    passwordHash: text('password_hash').notNull(),
    /** TOTP secret, encrypted. Null until the 2FA setup is finished. */
    totpSecretEnc: text('totp_secret_enc'),
    totpEnabledAt: timestamp('totp_enabled_at', { withTimezone: true }),
    /** Last accepted TOTP time step: a code is never accepted twice. */
    totpLastStep: bigint('totp_last_step', { mode: 'number' }),
    /** SHA-256 of the unused recovery codes. */
    recoveryCodeHashes: text('recovery_code_hashes')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [check('admin_users_email_lower_ck', sql`${t.email} = lower(${t.email})`)],
)

/** Server-side sessions: revocable, the id is the SHA-256 of the cookie token. */
export const adminSessions = pgTable(
  'admin_sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => adminUsers.id),
    /** Null while the second factor is pending. */
    mfaVerifiedAt: timestamp('mfa_verified_at', { withTimezone: true }),
    remember: boolean('remember').notNull().default(false),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    userAgent: text('user_agent'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('admin_sessions_user_idx').on(t.userId)],
)

/** Failed (and successful) authentication attempts, for lockouts. Keys are hashed. */
export const authAttempts = pgTable(
  'auth_attempts',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    key: text('key').notNull(),
    success: boolean('success').notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('auth_attempts_key_idx').on(t.key, t.createdAt)],
)

export const adminPasswordResets = pgTable('admin_password_resets', {
  tokenHash: text('token_hash').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => adminUsers.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamps.createdAt,
})

/** Who did what in the panel (ASVS V7). Append-only, no personal data in `data`. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    actorId: uuid('actor_id').references(() => adminUsers.id),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    /** HMAC of the client IP (AUTH_SECRET): correlates without storing the address. */
    ipHash: text('ip_hash'),
    data: jsonb('data').notNull().default({}),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('audit_log_created_idx').on(t.createdAt)],
)

export const emailStatus = pgEnum('email_status', ['pendente', 'enviado', 'falhou', 'descartado'])

/**
 * Transactional e-mail outbox (docs/adr/0006-email.md). Rows are written in the
 * same transaction as the change they announce, then delivered right after the
 * response and retried with backoff. No personal data is stored here: the
 * message is rendered at send time from the booking itself, and "Minha agenda"
 * links are minted at send time, so no usable token ever sits in the database.
 */
export const emailOutbox = pgTable(
  'email_outbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: text('kind').notNull(),
    /** 'cliente' (booking's customer), 'luisa' (EMAIL_ADMIN_NOTIFY) or 'admin' (an admin user). */
    recipient: text('recipient').notNull(),
    bookingId: uuid('booking_id').references(() => bookings.id),
    customerId: uuid('customer_id').references(() => customers.id),
    adminUserId: uuid('admin_user_id').references(() => adminUsers.id),
    /** Non-personal details needed to render (e.g. previous date of a reschedule). */
    data: jsonb('data').notNull().default({}),
    /** Prevents duplicates when the same change is replayed. */
    dedupeKey: text('dedupe_key').notNull().unique(),
    status: emailStatus('status').notNull().default('pendente'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastError: text('last_error'),
    providerMessageId: text('provider_message_id'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    check('email_outbox_recipient_ck', sql`${t.recipient} in ('cliente', 'luisa')`),
    check('email_outbox_target_ck', sql`${t.bookingId} is not null or ${t.customerId} is not null`),
    index('email_outbox_due_idx')
      .on(t.nextAttemptAt)
      .where(sql`${t.status} = 'pendente'`),
    index('email_outbox_customer_idx').on(t.customerId, t.createdAt),
  ],
)

/** One row per scheduled-job run (monitoring; the lock is an advisory lock). */
export const jobRuns = pgTable(
  'job_runs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    job: text('job').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    ok: boolean('ok'),
    report: jsonb('report').notNull().default({}),
  },
  (t) => [index('job_runs_job_idx').on(t.job, t.startedAt)],
)

/** Fixed-window request counters for the public API (Phase 4c). Keys are HMACs, never raw IPs. */
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
)

export type Service = typeof services.$inferSelect
export type Booking = typeof bookings.$inferSelect
export type ScheduleSettingsRow = typeof scheduleSettings.$inferSelect
export type BusinessHoursRow = typeof businessHours.$inferSelect
export type Block = typeof blocks.$inferSelect
export type EmailOutboxRow = typeof emailOutbox.$inferSelect
export type AdminUser = typeof adminUsers.$inferSelect
