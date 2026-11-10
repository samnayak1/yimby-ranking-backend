import { and, asc, count, desc, eq, like, sql, type SQL } from 'drizzle-orm';

import { DbProvider, DrizzleDb } from './client';
import { PoliticianFilters, PoliticianInput, PoliticianItemRow, PoliticianLists, PoliticianWithItems, Politician } from '../models';
import { ITEM_KINDS, politicianItems, politicians } from '../models/politicians.models';
import { IPoliticianRepo } from './interfaces/IPoliticianRepo';

// Each list in the API, and the item kind it's stored as.
const LISTS = { quotes: 'QUOTE', good: 'GOOD', bad: 'BAD' } as const satisfies Record<keyof PoliticianLists, (typeof ITEM_KINDS)[number]>;

// Colours sort from dark green to dark red; politicians without one go last
// in either direction.
const COLOR_RANK = sql`CASE ${politicians.colorCode}
  WHEN 'DARK_GREEN' THEN 1 WHEN 'GREEN' THEN 2 WHEN 'LIGHT_RED' THEN 3 WHEN 'DARK_RED' THEN 4 END`;

export class SQLLitePoliticianRepo implements IPoliticianRepo{
  private readonly db: DrizzleDb;

  constructor(provider: DbProvider) {
    this.db = provider.getDb();
  }



  async findAll(filters?: PoliticianFilters) {
 const {
  page = 1,
  limit = 20,
  sortBy = "name",
  sortOrder = "asc",
  search,
  designation,
  politicalLeaning,
  nationalityCode,
  status,
} = filters || {};

  const conditions = [];

  if (search) {
    conditions.push(like(politicians.name, `${search}%`));
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

  if (status !== undefined) {
    conditions.push(eq(politicians.status, status));
  }

  const whereClause =
    conditions.length > 0 ? and(...conditions) : undefined;

  // Total count
  const [{ total }] = await this.db
    .select({
      total: count(),
    })
    .from(politicians)
    .where(whereClause);

  const offset = (page - 1) * limit;
  const dir = sortOrder === "desc" ? desc : asc;

  const orderBy: SQL[] =
    sortBy === "colorCode"
      ? [sql`${politicians.colorCode} IS NULL`, dir(COLOR_RANK), asc(politicians.name)]
      : [dir(
          sortBy === "designation"
            ? politicians.designation
            : sortBy === "nationalityCode"
            ? politicians.nationalityCode
            : sortBy === "politicalLeaning"
            ? politicians.politicalLeaning
            : politicians.name,
        )];

 const rows = await this.db.query.politicians.findMany({
  where: whereClause,
  with: {
    items: {
      orderBy: (items, { asc }) => [asc(items.position)],
    },
  },
  orderBy,
  limit,
  offset,
});

  return {
    data: rows.map(({ items, ...p }) => withLists(p, items)),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    filters: filters || {},
  };
}

  findById(id: number): PoliticianWithItems | null {
    const row = this.db.query.politicians.findFirst({
      where: eq(politicians.id, id),
      with: {
        items: {
          orderBy: (items, { asc }) => [asc(items.position)],
        },
      },
    }).sync();

    if (!row) return null;
    const { items, ...p } = row;
    return withLists(p, items);
  }

  create(data: PoliticianInput): PoliticianWithItems {
    const { fields, lists } = splitLists(data);

    const id = this.db.transaction(tx => {
      const [row] = tx
        .insert(politicians)
        .values(fields)
        .returning()
        .all();
      replaceLists(tx, row.id, lists);
      return row.id;
    });

    return this.findById(id)!;
  }

  update(id: number, data: Partial<PoliticianInput>): PoliticianWithItems | null {
    const { fields, lists } = splitLists(data);

    this.db.transaction(tx => {
      tx
        .update(politicians)
        .set({ ...fields, updatedAt: sql`(datetime('now'))` })
        .where(eq(politicians.id, id))
        .run();
      replaceLists(tx, id, lists);
    });

    return this.findById(id);
  }

  delete(id: number): boolean {
    const result = this.db
      .delete(politicians)
      .where(eq(politicians.id, id))
      .run();

    return result.changes > 0;
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
}

type Tx = Parameters<Parameters<DrizzleDb['transaction']>[0]>[0];
type ListInput = NonNullable<PoliticianInput[keyof PoliticianLists]>;

function splitLists<T extends Partial<PoliticianInput>>(data: T) {
  const { quotes, good, bad, ...fields } = data;
  return { fields, lists: { quotes, good, bad } };
}

// Lists that were sent replace what's stored; lists left out are untouched.
function replaceLists(tx: Tx, politicianId: number, lists: Partial<Record<keyof PoliticianLists, ListInput>>) {
  for (const [list, kind] of Object.entries(LISTS) as [keyof PoliticianLists, (typeof ITEM_KINDS)[number]][]) {
    const items = lists[list];
    if (!items) continue;
    tx.delete(politicianItems)
      .where(and(eq(politicianItems.politicianId, politicianId), eq(politicianItems.kind, kind)))
      .run();
    if (items.length > 0) {
      tx.insert(politicianItems)
        .values(items.map((item, position) => ({ politicianId, kind, text: item.text, url: item.url ?? null, position })))
        .run();
    }
  }
}

function withLists(p: Politician, items: PoliticianItemRow[]): PoliticianWithItems {
  const pick = (kind: (typeof ITEM_KINDS)[number]) =>
    items.filter(i => i.kind === kind).map(i => ({ text: i.text, url: i.url }));
  return { ...p, quotes: pick(LISTS.quotes), good: pick(LISTS.good), bad: pick(LISTS.bad) };
}
