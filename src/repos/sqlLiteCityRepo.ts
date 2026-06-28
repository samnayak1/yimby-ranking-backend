import { eq, sql } from 'drizzle-orm';
import { CityWithRankings, NewCity, Ranking } from '../models';
import { cities, cityRankings } from '../models/cities.models';
import { DbProvider, DrizzleDb } from './client';
import { ICityRepo } from './interfaces/ICityRepo';



export class SQLiteCityRepo implements ICityRepo{
  private readonly db: DrizzleDb;

  constructor(provider: DbProvider) {
    this.db = provider.getDb();
  }

  findAll(): CityWithRankings[] {
    const rows = this.db
      .select()
      .from(cities)
      .leftJoin(cityRankings, eq(cityRankings.cityId, cities.id))
      .orderBy(cities.name)
      .all();

    return this.groupRankings(rows);
  }

  findById(id: number): CityWithRankings | null {
    const rows = this.db
      .select()
      .from(cities)
      .leftJoin(cityRankings, eq(cityRankings.cityId, cities.id))
      .where(eq(cities.id, id))
      .all();

    if (rows.length === 0) return null;
    return this.groupRankings(rows)[0];
  }

  create(data: NewCity): CityWithRankings {
    const [row] = this.db
      .insert(cities)
      .values(data)
      .returning()
      .all();

    return { ...row, rankings: [] };
  }

  update(id: number, data: Partial<NewCity>): CityWithRankings | null {
    this.db
      .update(cities)
      .set({ ...data, updatedAt: sql`(datetime('now'))` })
      .where(eq(cities.id, id))
      .run();

    return this.findById(id);
  }

  delete(id: number): boolean {
    const result = this.db
      .delete(cities)
      .where(eq(cities.id, id))
      .run();

    return result.changes > 0;
  }

  upsertRanking(cityId: number, year: number, ranking: number): CityWithRankings | null {
    this.db
      .insert(cityRankings)
      .values({ cityId, year, ranking })
      .onConflictDoUpdate({
        target: [cityRankings.cityId, cityRankings.year],
        set: { ranking },
      })
      .run();

    return this.findById(cityId);
  }

  

  private groupRankings(
    rows: Array<{ cities: typeof cities.$inferSelect; city_rankings: typeof cityRankings.$inferSelect | null }>
  ): CityWithRankings[] {

    // city id to rank map
    const map = new Map<number, CityWithRankings>();

    for (const row of rows) {
      const c = row.cities;
      if (!map.has(c.id)) {
        map.set(c.id, { ...c, rankings: [] });
      }
      if (row.city_rankings) {
        map.get(c.id)!.rankings.push({
          year: row.city_rankings.year,
          ranking: row.city_rankings.ranking,
        } satisfies Ranking);
      }
    }

    for (const c of map.values()) {
      c.rankings.sort((a, b) => b.year - a.year);
    }

    return [...map.values()];
  }
}