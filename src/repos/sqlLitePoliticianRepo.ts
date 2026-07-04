import { eq, sql } from 'drizzle-orm';

import { DbProvider, DrizzleDb } from './client';
import { NewPolitician, PoliticianFilters, PoliticianWithRatings, Rating} from '../models';
import { politicianRatings, politicians } from '../models/politicians.models';
import { IPoliticianRepo } from './interfaces/IPoliticianRepo';

export class SQLLitePoliticianRepo implements IPoliticianRepo{
  private readonly db: DrizzleDb;

  constructor(provider: DbProvider) {
    this.db = provider.getDb();
  }



  async findAll(filters?: PoliticianFilters) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'asc',
      search,
      designation,
      politicalLeaning,
      nationalityCode,
      isInOffice,
    } = filters || {};

    const conditions = [];

    if (search) {
      conditions.push(
        sql`(${politicians.name} LIKE ${`%${search}%`})`
      );
    }

    if (designation) {
      conditions.push(eq(politicians.designation, designation));
    }

    if (politicalLeaning) {
      conditions.push(eq(politicians.politicalLeaning, politicalLeaning));
    }

    if (nationalityCode) {
      conditions.push(eq(politicians.nationalityCode, nationalityCode));
    }

    if (isInOffice !== undefined) {
      conditions.push(eq(politicians.isInOffice, isInOffice ? 1 : 0));
    }

   
    const whereClause = conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : sql`1=1`;

    // Get total count
    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(politicians)
      .where(whereClause);

    const total = totalResult[0]?.count || 0;

    // Get paginated data
    const offset = (page - 1) * limit;
    
    const orderByColumn = sortBy === 'name' ? politicians.name :
                          sortBy === 'designation' ? politicians.designation :
                          sortBy === 'nationalityCode' ? politicians.nationalityCode :
                          sortBy === 'politicalLeaning' ? politicians.politicalLeaning :
                          politicians.name;

    const orderByClause = sortOrder === 'desc' 
      ? sql`${orderByColumn} DESC`
      : sql`${orderByColumn} ASC`;

    const rows = this.db
      .select()
      .from(politicians)
      .leftJoin(politicianRatings, eq(politicianRatings.politicianId, politicians.id))
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset)
      .all();

    const data = this.groupRatings(rows);

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

  findById(id: number): PoliticianWithRatings | null {
    const rows = this.db
      .select()
      .from(politicians)
      .leftJoin(politicianRatings, eq(politicianRatings.politicianId, politicians.id))
      .where(eq(politicians.id, id))
      .all();

    if (rows.length === 0) return null;
    return this.groupRatings(rows)[0];
  }

  create(data: NewPolitician): PoliticianWithRatings {
    const [row] = this.db
      .insert(politicians)
      .values(data)
      .returning()
      .all();

    return { ...row, ratings: [] };
  }

  update(id: number, data: Partial<NewPolitician>): PoliticianWithRatings | null {
    this.db
      .update(politicians)
      .set({ ...data, updatedAt: sql`(datetime('now'))` })
      .where(eq(politicians.id, id))
      .run();

    return this.findById(id);
  }

  delete(id: number): boolean {
    const result = this.db
      .delete(politicians)
      .where(eq(politicians.id, id))
      .run();

    return result.changes > 0;
  }

  upsertRating(politicianId: number, year: number, rating: number): PoliticianWithRatings | null {
    this.db
      .insert(politicianRatings)
      .values({ politicianId, year, rating: rating })
      .onConflictDoUpdate({
        target: [politicianRatings.politicianId, politicianRatings.year],
        set: { rating: sql`${rating}`},
      })
      .run();

    return this.findById(politicianId);
  }

   // Optional: Get distinct designations for filter dropdowns
   async getDesignations(): Promise<string[]> {
    const result = this.db
      .select({ designation: politicians.designation })
      .from(politicians)
      .where(sql`${politicians.designation} IS NOT NULL`)
      .groupBy(politicians.designation)
      .all();

    const designations = result.map(r => r.designation);
    return designations.filter((designation): designation is string => designation !== null);
  }

  // Get distinct political leanings for filter dropdowns
  async getPoliticalLeanings(): Promise<string[]> {
    const result =  this.db
      .select({ politicalLeaning: politicians.politicalLeaning })
      .from(politicians)
      .where(sql`${politicians.politicalLeaning} IS NOT NULL`)
      .groupBy(politicians.politicalLeaning)
      .all();

    const politicalLeanings = result.map(r => r.politicalLeaning);
    return politicalLeanings.filter((leaning): leaning is string => leaning !== null);
  }

  private groupRatings(
    rows: Array<{ politicians: typeof politicians.$inferSelect; politician_ratings: typeof politicianRatings.$inferSelect | null }>
  ): PoliticianWithRatings[] {
    const map = new Map<number, PoliticianWithRatings>();

    for (const row of rows) {
      const p = row.politicians;
      if (!map.has(p.id)) {
        map.set(p.id, { ...p, ratings: [] });
      }
      if (row.politician_ratings) {
        map.get(p.id)!.ratings.push({
          year: row.politician_ratings.year,
          rating: row.politician_ratings.rating,
        } satisfies Rating);
      }
    }


    for (const p of map.values()) {
      p.ratings.sort((a, b) => b.year - a.year);
    }

    return [...map.values()];
  }
}