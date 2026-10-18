import { SQLiteProvider, runMigrations } from '../src/repos/client';
import { SQLiteCreatorRepo, SQLiteResourceRepo } from '../src/repos/sqliteMediaRepos';
import { CreatorService, ResourceService } from '../src/services/MediaService';

// A real SQLite database in memory with every migration applied, so these tests
// also prove 0007 creates the tables the repos expect.
function freshDb() {
  const provider = new SQLiteProvider(':memory:');
  runMigrations(provider);
  return provider;
}

const status = async (fn: () => unknown) => {
  try { await fn(); } catch (e) { return (e as { status?: number }).status; }
  return 'no error';
};

describe('CreatorService on SQLite', () => {
  let provider: SQLiteProvider;
  let svc: CreatorService;

  beforeEach(() => {
    provider = freshDb();
    svc = new CreatorService(new SQLiteCreatorRepo(provider));
  });
  afterEach(() => provider.close());

  it('creates and lists creators ordered by sortOrder, then name', async () => {
    svc.create({ name: 'Zed', youtubeUrl: 'https://youtube.com/@zed' });
    svc.create({ name: 'Amy', youtubeUrl: 'https://youtube.com/@amy' });
    svc.create({ name: 'Pinned', youtubeUrl: 'https://youtube.com/@p', sortOrder: -1 });

    expect((await svc.getAll()).map(c => c.name)).toEqual(['Pinned', 'Amy', 'Zed']);
  });

  it('requires at least one link', async () => {
    expect(await status(() => svc.create({ name: 'Nobody' }))).toBe(400);
  });

  it('refuses an update that clears the only link', async () => {
    const c = svc.create({ name: 'Solo', twitterUrl: 'https://x.com/solo' });
    expect(await status(() => svc.update(c.id, { twitterUrl: null }))).toBe(400);
  });

  it('allows swapping one link for another', () => {
    const c = svc.create({ name: 'Swap', twitterUrl: 'https://x.com/swap' });
    const u = svc.update(c.id, { twitterUrl: null, blueskyUrl: 'https://bsky.app/profile/swap.bsky.social' });
    expect(u.twitterUrl).toBeNull();
    expect(u.blueskyUrl).toBe('https://bsky.app/profile/swap.bsky.social');
  });

  it('deletes, and 404s on unknown ids', async () => {
    const c = svc.create({ name: 'Gone', websiteUrl: 'https://gone.example.com' });
    svc.delete(c.id);
    expect(await svc.getAll()).toEqual([]);
    expect(await status(() => svc.delete(c.id))).toBe(404);
    expect(await status(() => svc.update(999, { name: 'x' }))).toBe(404);
  });
});

describe('ResourceService on SQLite', () => {
  let provider: SQLiteProvider;
  let svc: ResourceService;

  beforeEach(() => {
    provider = freshDb();
    svc = new ResourceService(new SQLiteResourceRepo(provider));
  });
  afterEach(() => provider.close());

  it('filters by category', async () => {
    svc.create({ category: 'website', title: 'Game', url: 'https://game.example.com' });
    svc.create({ category: 'article', title: 'News', url: 'https://news.example.com' });

    expect((await svc.getAll('website')).map(r => r.title)).toEqual(['Game']);
    expect((await svc.getAll()).length).toBe(2);
  });

  it('orders pinned first, then newest, with undated last', async () => {
    svc.create({ category: 'article', title: 'Old',     url: 'https://a.example.com', publishedOn: '2019' });
    svc.create({ category: 'article', title: 'Undated', url: 'https://b.example.com' });
    svc.create({ category: 'article', title: 'New',     url: 'https://c.example.com', publishedOn: '2025-06-01' });
    svc.create({ category: 'article', title: 'Pinned',  url: 'https://d.example.com', publishedOn: '2010', sortOrder: -5 });

    expect((await svc.getAll('article')).map(r => r.title)).toEqual(['Pinned', 'New', 'Old', 'Undated']);
  });

  it('updates and clears optional fields', () => {
    const r = svc.create({ category: 'study', title: 'S', url: 'https://s.example.com', source: 'Journal' });
    const u = svc.update(r.id, { source: null, title: 'S2' });
    expect(u).toMatchObject({ title: 'S2', source: null });
  });
});

describe('migration 0008: vacancy rate', () => {
  it('stores and returns a city vacancy rate', () => {
    const { SQLiteCityRepo } = require('../src/repos/sqlLiteCityRepo');
    const provider = freshDb();
    const repo = new SQLiteCityRepo(provider);

    const city = repo.create({ name: 'Raleigh', countryCode: 'US' });
    const saved = repo.upsertMetrics(city.id, { year: 2025, rating: 7, vacancyRate: 6.4 });

    expect(saved.ratings[0]).toMatchObject({ year: 2025, vacancyRate: 6.4 });
    provider.close();
  });
});
