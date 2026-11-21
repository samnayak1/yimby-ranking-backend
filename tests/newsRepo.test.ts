import { SQLiteProvider, runMigrations } from '../src/repos/client';
import { SQLiteNewsRepo } from '../src/repos/sqliteNewsRepo';
import { NewsService } from '../src/services/NewsService';
import { newsArticles } from '../src/models';
import { listNewsQuerySchema, updateNewsSchema } from '../src/schemas/news.schemas';

// Real SQLite in memory with every migration applied, so this also proves 0013
// creates the table the crawler writes to.
describe('NewsService on SQLite', () => {
  let provider: SQLiteProvider;
  let svc: NewsService;

  // The crawler is the only writer in production; tests insert the same way it does.
  let n = 0;
  const insert = (over: Partial<typeof newsArticles.$inferInsert> = {}) =>
    provider.getDb().insert(newsArticles).values({
      url: `https://example.com/${++n}`,
      source: 'Test',
      title: `Article ${n}`,
      summary: 'A summary.',
      relevant: true,
      outcome: 'WIN',
      countryCode: 'US',
      ...over,
    }).returning().get();

  const query = (q: Record<string, unknown> = {}) => listNewsQuerySchema.parse(q);

  beforeEach(() => {
    provider = new SQLiteProvider(':memory:');
    runMigrations(provider);
    svc = new NewsService(new SQLiteNewsRepo(provider));
  });
  afterEach(() => provider.close());

  it('lists only relevant, visible articles, newest first', async () => {
    insert({ title: 'Old', publishedOn: '2026-01-01' });
    insert({ title: 'New', publishedOn: '2026-11-01' });
    insert({ title: 'Irrelevant', relevant: false });
    insert({ title: 'Hidden', hidden: true });

    const res = await svc.getAll(query());
    expect(res.data.map(a => a.title)).toEqual(['New', 'Old']);
    expect(res.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it('filters by outcome and country', async () => {
    insert({ title: 'US win' });
    insert({ title: 'US loss', outcome: 'LOSS' });
    insert({ title: 'NZ win', countryCode: 'NZ' });

    expect((await svc.getAll(query({ outcome: 'LOSS' }))).data.map(a => a.title)).toEqual(['US loss']);
    expect((await svc.getAll(query({ countryCode: 'nz' }))).data.map(a => a.title)).toEqual(['NZ win']);
  });

  it('pages results', async () => {
    for (let i = 1; i <= 5; i++) insert({ publishedOn: `2026-0${i}-01` });

    const res = await svc.getAll(query({ page: '2', limit: '2' }));
    expect(res.data).toHaveLength(2);
    expect(res.pagination).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });
  });

  it('lists countries of visible articles only', async () => {
    insert({ countryCode: 'US' });
    insert({ countryCode: 'NZ' });
    insert({ countryCode: 'GB', hidden: true });
    insert({ countryCode: 'CA', relevant: false });
    insert({ countryCode: null });

    expect(await svc.getCountries()).toEqual(['NZ', 'US']);
  });

  it('hides and restores an article; admins still see hidden ones', async () => {
    const a = insert();

    expect(svc.setHidden(a.id, true).hidden).toBe(true);
    expect((await svc.getAll(query())).data).toHaveLength(0);
    expect(svc.getAllForAdmin(query()).data.map(x => x.id)).toEqual([a.id]);

    svc.setHidden(a.id, false);
    expect((await svc.getAll(query())).data).toHaveLength(1);
  });

  it('404s for a missing or irrelevant article', () => {
    const irrelevant = insert({ relevant: false });
    expect(() => svc.setHidden(9999, true)).toThrow(expect.objectContaining({ status: 404 }));
    expect(() => svc.setHidden(irrelevant.id, true)).toThrow(expect.objectContaining({ status: 404 }));
  });

  it('stores tags as an array', () => {
    const a = insert({ tags: ['zoning', 'permits'] });
    expect(a.tags).toEqual(['zoning', 'permits']);
  });
});

describe('news schemas', () => {
  it('applies defaults and rejects bad input', () => {
    expect(listNewsQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(listNewsQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
    expect(listNewsQuerySchema.safeParse({ outcome: 'MAYBE' }).success).toBe(false);
    expect(listNewsQuerySchema.safeParse({ countryCode: 'USA' }).success).toBe(false);
    expect(updateNewsSchema.safeParse({}).success).toBe(false);
  });
});
