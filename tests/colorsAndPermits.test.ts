import { SQLiteProvider, runMigrations } from '../src/repos/client';
import { SQLLitePoliticianRepo } from '../src/repos/sqlLitePoliticianRepo';
import { SQLiteCityRepo } from '../src/repos/sqlLiteCityRepo';
import { createPoliticianSchema } from '../src/schemas/politician.schemas';

function freshDb() {
  const provider = new SQLiteProvider(':memory:');
  runMigrations(provider);
  return provider;
}

describe('politician quotes, good and bad', () => {
  let provider: SQLiteProvider;
  let repo: SQLLitePoliticianRepo;

  beforeEach(() => {
    provider = freshDb();
    repo = new SQLLitePoliticianRepo(provider);
  });
  afterEach(() => provider.close());

  it('stores each list in order and returns it with the politician', async () => {
    const p = repo.create({
      name: 'Jane Doe',
      nationalityCode: 'US',
      colorCode: 'GREEN',
      quotes: [{ text: 'Build more homes.' }, { text: 'Legalize apartments.', url: 'https://example.com/q' }],
      good:   [{ text: 'Passed upzoning' }],
      bad:    [],
    });

    expect(p).toMatchObject({
      colorCode: 'GREEN',
      quotes: [{ text: 'Build more homes.', url: null }, { text: 'Legalize apartments.', url: 'https://example.com/q' }],
      good:   [{ text: 'Passed upzoning', url: null }],
      bad:    [],
    });
    expect((await repo.findAll()).data[0].quotes).toHaveLength(2);
  });

  it('replaces only the lists an update sends', () => {
    const p = repo.create({
      name: 'Jane Doe', nationalityCode: 'US',
      quotes: [{ text: 'Old quote' }], good: [{ text: 'Kept' }],
    });

    const u = repo.update(p.id, { quotes: [{ text: 'New quote' }], bad: [{ text: 'Blocked a project' }] })!;

    expect(u.quotes.map(i => i.text)).toEqual(['New quote']);
    expect(u.good.map(i => i.text)).toEqual(['Kept']);
    expect(u.bad.map(i => i.text)).toEqual(['Blocked a project']);
  });

  it('deletes the lists with the politician', () => {
    const p = repo.create({ name: 'Jane Doe', nationalityCode: 'US', quotes: [{ text: 'Q' }] });
    repo.delete(p.id);
    const left = provider.getDatabaseProvider().prepare('SELECT count(*) AS n FROM politician_items').get() as { n: number };
    expect(left.n).toBe(0);
  });

  it('sorts by colour from dark green to dark red, uncoloured last either way', async () => {
    for (const [name, colorCode] of [['A', 'DARK_RED'], ['B', null], ['C', 'DARK_GREEN'], ['D', 'LIGHT_RED'], ['E', 'GREEN']] as const) {
      repo.create({ name, nationalityCode: 'US', colorCode });
    }
    const names = async (sortOrder: 'asc' | 'desc') =>
      (await repo.findAll({ sortBy: 'colorCode', sortOrder })).data.map(p => p.name);

    expect(await names('asc')).toEqual(['C', 'E', 'D', 'A', 'B']);
    expect(await names('desc')).toEqual(['A', 'D', 'E', 'C', 'B']);
  });

  it.each([
    ['javascript:alert(1)'],
    ['not a url'],
  ])('rejects a source link of %p', url => {
    const r = createPoliticianSchema.safeParse({ name: 'J', nationalityCode: 'US', quotes: [{ text: 'Q', url }] });
    expect(r.success).toBe(false);
  });

  it('treats a blank source link as none', () => {
    const r = createPoliticianSchema.parse({ name: 'J', nationalityCode: 'US', good: [{ text: 'G', url: '  ' }] });
    expect(r.good![0].url).toBeNull();
  });
});

describe('cities by permits per 1,000', () => {
  let provider: SQLiteProvider;
  let repo: SQLiteCityRepo;

  beforeEach(() => {
    provider = freshDb();
    repo = new SQLiteCityRepo(provider);
  });
  afterEach(() => provider.close());

  it('sorts by the latest year that has a figure, cities without one last', async () => {
    const austin  = repo.create({ name: 'Austin',  countryCode: 'US' });
    const boston  = repo.create({ name: 'Boston',  countryCode: 'US' });
    const chicago = repo.create({ name: 'Chicago', countryCode: 'US' });
    repo.create({ name: 'Denver', countryCode: 'US' });

    repo.upsertMetrics(austin.id,  { year: 2023, permitsPer1000Residents: 1 });
    repo.upsertMetrics(austin.id,  { year: 2024, permitsPer1000Residents: 12 });
    repo.upsertMetrics(boston.id,  { year: 2024, permitsPer1000Residents: 3 });
    // A newer year without the figure doesn't hide the older one.
    repo.upsertMetrics(chicago.id, { year: 2023, permitsPer1000Residents: 6 });
    repo.upsertMetrics(chicago.id, { year: 2024, population: 2_700_000 });

    const names = async (sortOrder: 'asc' | 'desc') =>
      (await repo.findAll({ sortBy: 'permitsPer1000Residents', sortOrder })).data.map(c => c.name);

    expect(await names('desc')).toEqual(['Austin', 'Chicago', 'Boston', 'Denver']);
    expect(await names('asc')).toEqual(['Boston', 'Chicago', 'Austin', 'Denver']);
  });

  it('puts the latest permits figure on the map data', () => {
    const c = repo.create({ name: 'Austin', countryCode: 'US', lat: 30.26, lng: -97.74 });
    repo.upsertMetrics(c.id, { year: 2023, permitsPer1000Residents: 4.5 });
    repo.upsertMetrics(c.id, { year: 2024, permitsPer1000Residents: 9.25 });

    expect(repo.findMapData()[0]).toMatchObject({ name: 'Austin', permitsPer1000Residents: 9.25 });
  });
});
