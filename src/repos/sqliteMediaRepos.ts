import { asc, desc, eq, sql } from 'drizzle-orm';
import { creators, resources } from '../models/media.models';
import { Creator, NewCreator, NewResource, Resource, ResourceCategory } from '../models';
import { DbProvider, DrizzleDb } from './client';
import { ICreatorRepo, IResourceRepo } from './interfaces/IMediaRepos';

export class SQLiteCreatorRepo implements ICreatorRepo {
  private readonly db: DrizzleDb;

  constructor(provider: DbProvider) {
    this.db = provider.getDb();
  }

  findAll(): Creator[] {
    return this.db
      .select()
      .from(creators)
      .orderBy(asc(creators.sortOrder), asc(creators.name))
      .all();
  }

  findById(id: number): Creator | null {
    return this.db.select().from(creators).where(eq(creators.id, id)).get() ?? null;
  }

  create(data: NewCreator): Creator {
    return this.db.insert(creators).values(data).returning().get();
  }

  update(id: number, data: Partial<NewCreator>): Creator | null {
    return (
      this.db
        .update(creators)
        .set({ ...data, updatedAt: sql`(datetime('now'))` })
        .where(eq(creators.id, id))
        .returning()
        .get() ?? null
    );
  }

  delete(id: number): boolean {
    return this.db.delete(creators).where(eq(creators.id, id)).run().changes > 0;
  }
}

export class SQLiteResourceRepo implements IResourceRepo {
  private readonly db: DrizzleDb;

  constructor(provider: DbProvider) {
    this.db = provider.getDb();
  }

  findAll(category?: ResourceCategory): Resource[] {
    const query = this.db.select().from(resources);
    const filtered = category ? query.where(eq(resources.category, category)) : query;

    // Pinned items first (lower sortOrder), then newest. Undated links sort after
    // dated ones within the same sortOrder.
    return filtered
      .orderBy(
        asc(resources.sortOrder),
        sql`${resources.publishedOn} IS NULL`,
        desc(resources.publishedOn),
        asc(resources.title),
      )
      .all();
  }

  findById(id: number): Resource | null {
    return this.db.select().from(resources).where(eq(resources.id, id)).get() ?? null;
  }

  create(data: NewResource): Resource {
    return this.db.insert(resources).values(data).returning().get();
  }

  update(id: number, data: Partial<NewResource>): Resource | null {
    return (
      this.db
        .update(resources)
        .set({ ...data, updatedAt: sql`(datetime('now'))` })
        .where(eq(resources.id, id))
        .returning()
        .get() ?? null
    );
  }

  delete(id: number): boolean {
    return this.db.delete(resources).where(eq(resources.id, id)).run().changes > 0;
  }
}
