import { relations, sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const cities = sqliteTable(
  "cities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    countryCode: text("country_code").notNull(),
    region: text("region"),
    rating: integer("rating"),
    medianHousePrice: real("median_house_price"),
    currency: text("currency").default("USD"),
    notes: text("notes"),
    lat: real("lat"),
    lng: real("lng"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (t) => [
    unique("uq_city_name_country").on(t.name, t.countryCode),
  ]
);


export const cityRatings = sqliteTable("city_ratings", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  cityId: integer("city_id")
    .notNull()
    .references(() => cities.id, { onDelete: "cascade" }),

  year: integer("year").notNull(),

  rating: integer("rating").notNull(),

  permitsIssued: integer("permits_issued"),

  permitsPer1000Residents: real("permits_per_1000_residents"),

  housingStarts: integer("housing_starts"),

  averagePermitDays: integer("average_permit_days"),

  homesCompleted: integer("homes_completed"),

  population: integer("population"),

  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (t) => [
  unique("uq_city_year").on(t.cityId, t.year),
  ]);

  export const cityRelations = relations(cities, ({ many }) => ({
  ratings: many(cityRatings),
}));

export const cityRatingRelations = relations(cityRatings, ({ one }) => ({
  city: one(cities, {
    fields: [cityRatings.cityId],
    references: [cities.id],
  }),
}));