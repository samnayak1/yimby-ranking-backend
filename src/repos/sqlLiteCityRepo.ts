import { and, count, eq, gte, isNotNull, like, lte, or, sql } from 'drizzle-orm';
import { CityFilters ,CityRating,CityWithRatings,NewCity, UpsertCityMetrics } from '../models';
import { cities, cityRatings, } from '../models/cities.models';
import { DbProvider, DrizzleDb } from './client';
import { ICityRepo } from './interfaces/ICityRepo';
import { CityMapPoint } from '../types';



export class SQLiteCityRepo implements ICityRepo{
  private readonly db: DrizzleDb;

  constructor(provider: DbProvider) {
    this.db = provider.getDb();
  }


 async findAll(filters?: CityFilters) {
  const {
    page = 1,
    limit = 20,
    sortBy = "name",
    sortOrder = "asc",
    search,
    countryCode,
    region,
    minPrice,
    maxPrice,
    minScore,
    maxScore
  } = filters || {};

  const conditions = [];

  if (search) {
    conditions.push(
      or(
        like(cities.name, `${search}%`),
        like(cities.region, `${search}%`)
      )
    );
  }

  if (countryCode) {
    conditions.push(eq(cities.countryCode, countryCode));
  }

  if (region) {
    conditions.push(eq(cities.region, region));
  }

  if (minPrice !== undefined) {
    conditions.push(gte(cities.medianHousePrice, minPrice));
  }

  if (maxPrice !== undefined) {
    conditions.push(lte(cities.medianHousePrice, maxPrice));
  }
  if (minScore !== undefined) {
  conditions.push(gte(cities.rating, minScore));
}

if (maxScore !== undefined) {
  conditions.push(lte(cities.rating, maxScore));
}

  const whereClause =
    conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await this.db
    .select({
      total: count(),
    })
    .from(cities)
    .where(whereClause);

  const offset = (page - 1) * limit;

  const orderColumn =
  sortBy === "countryCode"
    ? cities.countryCode
    : sortBy === "region"
    ? cities.region
    : sortBy === "medianHousePrice"
    ? cities.medianHousePrice
    : sortBy === "rating"
    ? cities.rating
    : cities.name;

  const citiesResult = await this.db.query.cities.findMany({
    where: whereClause,
    with: {
      ratings: {
        orderBy: (ratings, { desc }) => [desc(ratings.year)],
      },
    },
    orderBy:
      sortOrder === "desc"
        ? (_, { desc }) => [desc(orderColumn)]
        : (_, { asc }) => [asc(orderColumn)],
    limit,
    offset,
  });

  const data = citiesResult.map(city => ({
  ...city,
  ratings: city.ratings.map(r => ({
    ...r,
    permitsIssued: r.permitsIssued ?? undefined,
    permitsPer1000Residents: r.permitsPer1000Residents ?? undefined,
    housingStarts: r.housingStarts ?? undefined,
    averagePermitDays: r.averagePermitDays ?? undefined,
    homesCompleted: r.homesCompleted ?? undefined,
    population: r.population ?? undefined,
  })),
}));

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


findMapData(): CityMapPoint[] {
  return this.db
    .select({
      id:      cities.id,
      name:    cities.name,
      country: cities.countryCode,
      region:  cities.region,
      lat:     cities.lat,
      lng:     cities.lng,
      rating:  cities.rating,
      medianHousePrice: cities.medianHousePrice,
      currency: cities.currency,
      notes:   cities.notes,
    })
    .from(cities)
    .where(and(isNotNull(cities.lat), isNotNull(cities.lng)))
    .all();
}



  findById(id: number): CityWithRatings | null {
    const rows = this.db
      .select()
      .from(cities)
      .leftJoin(cityRatings, eq(cityRatings.cityId, cities.id))
      .where(eq(cities.id, id))
      .all();

    if (rows.length === 0) return null;
    return this.groupRating(rows)[0];
  }

  create(data: NewCity): CityWithRatings {
    const [row] = this.db
      .insert(cities)
      .values(data)
      .returning()
      .all();

    return { ...row, ratings: [] };
  }

  update(id: number, data: Partial<NewCity>): CityWithRatings | null {
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

 upsertMetrics(
  cityId: number,
  metrics: UpsertCityMetrics
): CityWithRatings | null {
  const { year, ...values } = metrics;

  this.db
    .insert(cityRatings)
    .values({
      cityId,
      year,
      ...values,
    })
    .onConflictDoUpdate({
      target: [cityRatings.cityId, cityRatings.year],
      set: values,
    })
    .run();

  return this.findById(cityId);
}


    // Get distinct countries for filter dropdowns
    async getCountries(): Promise<string[]> {
    const result = this.db
      .select({ countryCode: cities.countryCode })
      .from(cities)
      .groupBy(cities.countryCode)
      .all();

    
      
      return result.map(r => r.countryCode).filter((c): c is string => c !== null);
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

  
private groupRating(
  rows: Array<{
    cities: typeof cities.$inferSelect;
    city_ratings: typeof cityRatings.$inferSelect | null;
  }>
): CityWithRatings[] {
  const map = new Map<number, CityWithRatings>();

  for (const row of rows) {
    const city = row.cities;

    if (!map.has(city.id)) {
      map.set(city.id, {
        ...city,
        ratings: [],
      });
    }

    if (row.city_ratings) {
      map.get(city.id)!.ratings.push({
  year: row.city_ratings.year,
  permitsIssued: row.city_ratings.permitsIssued ?? undefined,
  rating: row.city_ratings.rating ?? undefined,
  permitsPer1000Residents:
    row.city_ratings.permitsPer1000Residents ?? undefined,
  housingStarts: row.city_ratings.housingStarts ?? undefined,
  homesCompleted: row.city_ratings.homesCompleted ?? undefined,
  averagePermitDays:
    row.city_ratings.averagePermitDays ?? undefined,
  population: row.city_ratings.population ?? undefined,
});
    }
  }

  for (const city of map.values()) {
    city.ratings.sort((a, b) => b.year - a.year);
  }

  return Array.from(map.values());
}
}