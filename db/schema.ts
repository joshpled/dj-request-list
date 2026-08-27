import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const eventSettings = sqliteTable('event_settings', {
  id: integer('id').primaryKey(),
  eventName: text('event_name').notNull(),
  welcomeMessage: text('welcome_message').notNull(),
  requestLimit: integer('request_limit').notNull().default(5),
  closingTime: text('closing_time'),
  guestToken: text('guest_token').notNull(),
  adminPinHash: text('admin_pin_hash').notNull(),
  adminPinSalt: text('admin_pin_salt').notNull(),
  pinVersion: integer('pin_version').notNull().default(1),
  sessionSecret: text('session_secret').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [uniqueIndex('event_settings_guest_token_unique').on(table.guestToken)]);

export const songRequests = sqliteTable('song_requests', {
  id: text('id').primaryKey(),
  songTitle: text('song_title').notNull(),
  artist: text('artist').notNull(),
  guestName: text('guest_name'),
  note: text('note'),
  status: text('status').notNull().default('New'),
  deviceId: text('device_id').notNull(),
  normalizedSong: text('normalized_song').notNull(),
  normalizedArtist: text('normalized_artist').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('idx_song_requests_created_at').on(table.createdAt),
  index('idx_song_requests_status_created').on(table.status, table.createdAt),
  index('idx_song_requests_device_created').on(table.deviceId, table.createdAt),
  index('idx_song_requests_duplicate').on(table.normalizedSong, table.normalizedArtist, table.createdAt),
]);

export const adminLoginAttempts = sqliteTable('admin_login_attempts', {
  clientKey: text('client_key').primaryKey(),
  attempts: integer('attempts').notNull().default(0),
  blockedUntil: text('blocked_until'),
  updatedAt: text('updated_at').notNull(),
});
