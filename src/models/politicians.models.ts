import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const COLOR_CODES = ["DARK_GREEN", "GREEN", "LIGHT_RED", "DARK_RED"] as const;
export const ITEM_KINDS = ["QUOTE", "GOOD", "BAD"] as const;

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
    // Set by hand in the admin UI, dark green (most pro-housing) to dark red.
    colorCode: text("color_code", { enum: COLOR_CODES }),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (t) => [
    unique("uq_politician_name").on(t.name),

    index("idx_politicians_name").on(t.name),
    index("idx_politicians_color_code").on(t.colorCode),
    index("idx_politicians_nationality").on(t.nationalityCode),
    index("idx_politicians_designation").on(t.designation),
    index("idx_politicians_leaning").on(t.politicalLeaning),
  ]
);


// Quotes, and the good and the bad on housing: short text with an optional
// source link, kept in the order the admin entered them.
export const politicianItems = sqliteTable('politician_items', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  politicianId: integer('politician_id')
                  .notNull()
                  .references(() => politicians.id, { onDelete: 'cascade' }),
  kind:         text('kind', { enum: ITEM_KINDS }).notNull(),
  text:         text('text').notNull(),
  url:          text('url'),
  position:     integer('position').notNull().default(0),
  createdAt:    text('created_at').default(sql`(datetime('now'))`),
}, (t) => [ index('idx_politician_items_politician').on(t.politicianId, t.kind, t.position) ])

export const politicianRelations = relations(politicians, ({ many }) => ({
  items: many(politicianItems),
}));

export const politicianItemRelations = relations(politicianItems, ({ one }) => ({
  politician: one(politicians, {
    fields: [politicianItems.politicianId],
    references: [politicians.id],
  }),
}));
