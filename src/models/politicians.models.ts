import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const politicians = sqliteTable('politicians', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  name:             text('name').notNull(),
  designation:      text('designation'),
  isInOffice:       integer('is_in_office').notNull().default(1),
  nationalityCode:      text('nationality_code').notNull(),
  politicalLeaning: text('political_leaning'),
  notes:            text('notes'),
  createdAt:        text('created_at').default(sql`(datetime('now'))`),
  updatedAt:        text('updated_at').default(sql`(datetime('now'))`),
});


export const politicianRatings = sqliteTable('politician_ratings', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  politicianId: integer('politician_id')
                  .notNull()
                  .references(() => politicians.id, { onDelete: 'cascade' }),
  year:         integer('year').notNull(),
  rating:      integer('rating').notNull(),
  createdAt:    text('created_at').default(sql`(datetime('now'))`),
}, (t) => [ unique('uq_politician_year').on(t.politicianId, t.year) ])