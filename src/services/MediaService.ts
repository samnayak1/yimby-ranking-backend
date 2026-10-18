import { Creator, Resource, ResourceCategory } from '../models';
import { ICreatorRepo, IResourceRepo } from '../repos/interfaces/IMediaRepos';
import {
  CreateCreatorDto, CreateResourceDto, UpdateCreatorDto, UpdateResourceDto,
} from '../schemas/media.schemas';
import { createError } from '../utils/errorHelper';
import { cached, invalidate } from '../cache/cache';

const LINK_FIELDS = ['instagramUrl', 'youtubeUrl', 'twitterUrl', 'blueskyUrl', 'websiteUrl'] as const;

export class CreatorService {
  constructor(private readonly repo: ICreatorRepo) {}

  async getAll(): Promise<Creator[]> {
    return cached('creators', 'list', null, async () => this.repo.findAll());
  }

  getById(id: number): Creator {
    const creator = this.repo.findById(id);
    if (!creator) throw createError(404, 'Creator not found');
    return creator;
  }

  create(data: CreateCreatorDto): Creator {
    this.requireALink(data);
    const created = this.repo.create(data);
    this.refresh();
    return created;
  }

  update(id: number, data: UpdateCreatorDto): Creator {
    const existing = this.getById(id);
    // Checked against the merged record: a PATCH that clears the only link must
    // fail even though the payload on its own looks fine.
    this.requireALink({ ...existing, ...data });
    const updated = this.repo.update(id, data)!;
    this.refresh();
    return updated;
  }

  delete(id: number): void {
    this.getById(id);
    this.repo.delete(id);
    this.refresh();
  }

  private requireALink(c: Partial<Record<(typeof LINK_FIELDS)[number], string | null | undefined>>): void {
    if (!LINK_FIELDS.some(f => c[f])) {
      throw createError(400, 'Add at least one link (Instagram, YouTube, X, Bluesky or website)');
    }
  }

  private refresh(): void {
    void invalidate('creators', [() => this.getAll()]);
  }
}

export class ResourceService {
  constructor(private readonly repo: IResourceRepo) {}

  async getAll(category?: ResourceCategory): Promise<Resource[]> {
    return cached('resources', 'list', { category }, async () => this.repo.findAll(category));
  }

  getById(id: number): Resource {
    const resource = this.repo.findById(id);
    if (!resource) throw createError(404, 'Link not found');
    return resource;
  }

  create(data: CreateResourceDto): Resource {
    const created = this.repo.create(data);
    this.refresh();
    return created;
  }

  update(id: number, data: UpdateResourceDto): Resource {
    this.getById(id);
    const updated = this.repo.update(id, data)!;
    this.refresh();
    return updated;
  }

  delete(id: number): void {
    this.getById(id);
    this.repo.delete(id);
    this.refresh();
  }

  private refresh(): void {
    void invalidate('resources', [() => this.getAll()]);
  }
}
