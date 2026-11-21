import { and, asc, count, desc, eq, isNotNull, sql, SQL } from 'drizzle-orm';
import { newsArticles } from '../models/news.models';
import { NewsArticle, NewsFilters, PaginatedResponse } from '../models';
import { DbProvider, DrizzleDb } from './client';
import { INewsRepo } from './interfaces/INewsRepo';

export class SQLiteNewsRepo implements INewsRepo {
  private readonly db: DrizzleDb;

  constructor(provider: DbProvider) {
    this.db = provider.getDb();
  }

  findAll(filters: NewsFilters = {}): PaginatedResponse<NewsArticle> {
    const { page = 1, limit = 20, outcome, countryCode, includeHidden = false } = filters;
    const where = and(...this.conditions({ outcome, countryCode, includeHidden }));

    const total = this.db.select({ n: count() }).from(newsArticles).where(where).get()?.n ?? 0;

    // Newest first. Undated articles fall back to when the crawler found them.
    const data = this.db
      .select()
      .from(newsArticles)
      .where(where)
      .orderBy(desc(sql`COALESCE(${newsArticles.publishedOn}, date(${newsArticles.createdAt}))`), desc(newsArticles.id))
      .limit(limit)
      .offset((page - 1) * limit)
      .all();

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  findById(id: number): NewsArticle | null {
    return this.db.select().from(newsArticles).where(eq(newsArticles.id, id)).get() ?? null;
  }

  setHidden(id: number, hidden: boolean): NewsArticle | null {
    return (
      this.db
        .update(newsArticles)
        .set({ hidden, updatedAt: sql`(datetime('now'))` })
        .where(eq(newsArticles.id, id))
        .returning()
        .get() ?? null
    );
  }

  getCountries(): string[] {
    return this.db
      .selectDistinct({ code: newsArticles.countryCode })
      .from(newsArticles)
      .where(and(...this.conditions({ includeHidden: false }), isNotNull(newsArticles.countryCode)))
      .orderBy(asc(newsArticles.countryCode))
      .all()
      .map(r => r.code!);
  }

  // Articles the crawler judged irrelevant are only kept so it can skip them,
  // and are never listed, not even to admins.
  private conditions({ outcome, countryCode, includeHidden }: Pick<NewsFilters, 'outcome' | 'countryCode' | 'includeHidden'>): SQL[] {
    const conditions: SQL[] = [eq(newsArticles.relevant, true)];
    if (!includeHidden) conditions.push(eq(newsArticles.hidden, false));
    if (outcome) conditions.push(eq(newsArticles.outcome, outcome));
    if (countryCode) conditions.push(eq(newsArticles.countryCode, countryCode));
    return conditions;
  }
}
