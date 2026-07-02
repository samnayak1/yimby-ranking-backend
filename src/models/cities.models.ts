import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const cities = sqliteTable('cities', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  name:             text('name').notNull(),
  countryCode:      text('country_code').notNull(),
  region:           text('region'),
  medianHousePrice: real('median_house_price'),  //in USD
  currency:         text('currency').default('USD'),
  notes:            text('notes'),
  lat:              real('lat'),
  lng:              real('lng'),
  createdAt:        text('created_at').default(sql`(datetime('now'))`),
  updatedAt:        text('updated_at').default(sql`(datetime('now'))`),
});



export const cityRankings = sqliteTable('city_rankings', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  cityId:    integer('city_id')
               .notNull()
               .references(() => cities.id, { onDelete: 'cascade' }),
  year:      integer('year').notNull(),
  ranking:   integer('ranking').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, (t) => [
  unique('uq_city_year').on(t.cityId, t.year),
]);