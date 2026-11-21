import { NewsArticle, PaginatedResponse } from '../models';
import { INewsRepo } from '../repos/interfaces/INewsRepo';
import { ListNewsQuery } from '../schemas/news.schemas';
import { createError } from '../utils/errorHelper';
import { cached, invalidate } from '../cache/cache';

// The crawler writes straight to SQLite from another container, so nothing
// here learns about new rows. The cache's 5-minute TTL is what lets them show
// up; admin edits invalidate immediately.
export class NewsService {
  constructor(private readonly repo: INewsRepo) {}

  async getAll(query: ListNewsQuery): Promise<PaginatedResponse<NewsArticle>> {
    return cached('news', 'list', query, async () => this.repo.findAll(query));
  }

  /** Admin view: the same list, with hidden articles included so they can be restored. */
  getAllForAdmin(query: ListNewsQuery): PaginatedResponse<NewsArticle> {
    return this.repo.findAll({ ...query, includeHidden: true });
  }

  async getCountries(): Promise<string[]> {
    return cached('news', 'countries', null, async () => this.repo.getCountries());
  }

  setHidden(id: number, hidden: boolean): NewsArticle {
    const article = this.repo.findById(id);
    // Irrelevant rows are bookkeeping for the crawler, not articles.
    if (!article || !article.relevant) throw createError(404, 'Article not found');

    const updated = this.repo.setHidden(id, hidden)!;
    void invalidate('news');
    return updated;
  }
}
