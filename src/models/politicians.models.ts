import { relations, sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const politicians = sqliteTable(
  "politicians",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    designation: text("designation"),
    status: text("status", {
      enum: ["RUNNING", "INOFFICE", "RETIRED", "OUT"],
    })
      .notNull()
      .default("INOFFICE"),
    nationalityCode: text("nationality_code").notNull(),
    politicalLeaning: text("political_leaning"),
    notes: text("notes"),
    rating: real("rating"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (t) => [
    unique("uq_politician_name").on(t.name),

    index("idx_politicians_name").on(t.name),
    index("idx_politicians_rating").on(t.rating),
    index("idx_politicians_nationality").on(t.nationalityCode),
    index("idx_politicians_designation").on(t.designation),
    index("idx_politicians_leaning").on(t.politicalLeaning),
  ]
);


export const politicianRatings = sqliteTable('politician_ratings', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  politicianId: integer('politician_id')
                  .notNull()
                  .references(() => politicians.id, { onDelete: 'cascade' }),
  year:         integer('year').notNull(),
  rating:      real('rating').notNull(),
  createdAt:    text('created_at').default(sql`(datetime('now'))`),
}, (t) => [ unique('uq_politician_year').on(t.politicianId, t.year) ])

export const politicianRelations = relations(politicians, ({ many }) => ({
  ratings: many(politicianRatings),
}));

export const politicianRatingRelations = relations(politicianRatings, ({ one }) => ({
  politician: one(politicians, {
    fields: [politicianRatings.politicianId],
    references: [politicians.id],
  }),
}));