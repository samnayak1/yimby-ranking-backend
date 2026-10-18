import { Creator, CreatorPlatform, Resource, ResourceCategory } from '../models';
import { ICreatorRepo, IResourceRepo } from '../repos/interfaces/IMediaRepos';
import {
  CreateCreatorDto, CreateResourceDto, UpdateCreatorDto, UpdateResourceDto,
} from '../schemas/media.schemas';
import { createError } from '../utils/errorHelper';
import { cached, invalidate } from '../cache/cache';

// The hosts each platform's links live on. "website" accepts any domain.
const PLATFORM_HOSTS: Record<Exclude<CreatorPlatform, 'website'>, string[]> = {
  youtube:   ['youtube.com', 'youtu.be'],
  x:         ['x.com', 'twitter.com'],
  instagram: ['instagram.com'],
  bluesky:   ['bsky.app'],
};

const PLATFORM_NAMES: Record<Exclude<CreatorPlatform, 'website'>, string> = {
  youtube: 'YouTube', x: 'X', instagram: 'Instagram', bluesky: 'Bluesky',
};

/** True when the link belongs to the platform (subdomains such as m.youtube.com count). */
export function urlMatchesPlatform(platform: CreatorPlatform, url: string): boolean {
  if (platform === 'website') return true;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return PLATFORM_HOSTS[platform].some(h => host === h || host.endsWith(`.${h}`));
}

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
    this.requireMatchingUrl(data.platform, data.url);
    const created = this.repo.create(data);
    this.refresh();
    return created;
  }

  update(id: number, data: UpdateCreatorDto): Creator {
    const existing = this.getById(id);
    // Checked against the merged record: changing only the platform, or only the
    // link, must still leave the two agreeing.
    const merged = { ...existing, ...data };
    this.requireMatchingUrl(merged.platform, merged.url);
    const updated = this.repo.update(id, data)!;
    this.refresh();
    return updated;
  }

  delete(id: number): void {
    this.getById(id);
    this.repo.delete(id);
    this.refresh();
  }

  private requireMatchingUrl(platform: CreatorPlatform, url: string): void {
    if (!urlMatchesPlatform(platform, url)) {
      const name = PLATFORM_NAMES[platform as Exclude<CreatorPlatform, 'website'>];
      throw createError(400, `That link isn't a ${name} link. Check the platform or the URL.`);
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
