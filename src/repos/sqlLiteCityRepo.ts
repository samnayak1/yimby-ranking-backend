import { and, asc, desc, eq, gte, like, lte, or, sql } from 'drizzle-orm';
import { CityFilters, CityWithRankings, NewCity, PaginatedResponse, Ranking } from '../models';
import { cities, cityRankings } from '../models/cities.models';
import { DbProvider, DrizzleDb } from './client';
import { ICityRepo } from './interfaces/ICityRepo';



export class SQLiteCityRepo implements ICityRepo{
  private readonly db: DrizzleDb;

  constructor(provider: DbProvider) {
    this.db = provider.getDb();
  }


  async findAll(filters?: CityFilters) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'asc',
      search,
      country,
      region,
      minPrice,
      maxPrice,
    } = filters || {};


    const conditions = [];

    if (search) {
     
      conditions.push(
        sql`(${cities.name} LIKE ${`%${search}%`} OR 
             ${cities.country} LIKE ${`%${search}%`} OR 
             ${cities.region} LIKE ${`%${search}%`})`
      );
    }

    if (country) {
      conditions.push(eq(cities.country, country));
    }

    if (region) {
      conditions.push(eq(cities.region, region));
    }

    if (minPrice !== undefined) {
      conditions.push(sql`${cities.medianHousePrice} >= ${minPrice}`);
    }

    if (maxPrice !== undefined) {
      conditions.push(sql`${cities.medianHousePrice} <= ${maxPrice}`);
    }

    // Get total count
    const whereClause = conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : sql`1=1`;
    
    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(cities)
      .where(whereClause);

    const total = totalResult[0]?.count || 0;

    const offset = (page - 1) * limit;
    

    const orderByColumn = sortBy === 'name' ? cities.name :
                          sortBy === 'country' ? cities.country :
                          sortBy === 'region' ? cities.region :
                          sortBy === 'medianHousePrice' ? cities.medianHousePrice :
                          cities.name;

    const orderByClause = sortOrder === 'desc' 
      ? sql`${orderByColumn} DESC`
      : sql`${orderByColumn} ASC`;

    const rows = await this.db
      .select()
      .from(cities)
      .leftJoin(cityRankings, eq(cityRankings.cityId, cities.id))
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset)
      .all();

    const data = this.groupRankings(rows);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: filters || {},
    };
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


    // Get distinct countries for filter dropdowns
    async getCountries(): Promise<string[]> {
    const result = this.db
      .select({ country: cities.country })
      .from(cities)
      .groupBy(cities.country)
      .all();

    
      
      return result.map(r => r.country).filter((c): c is string => c !== null);
  }

  // Get distinct regions for filter dropdowns
  async getRegions(): Promise<string[]> {
    const result = this.db
      .select({ region: cities.region })
      .from(cities)
      .where(sql`${cities.region} IS NOT NULL`)
      .groupBy(cities.region)
      .all();

    const regions = result.map(r => r.region);
  
    return regions.filter((region): region is string => region !== null);
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