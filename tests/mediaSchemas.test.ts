import { createCreatorSchema, createResourceSchema, updateCreatorSchema } from '../src/schemas/media.schemas';

describe('media schemas', () => {
  describe('URLs', () => {
    it.each([
      'javascript:alert(1)',
      'JavaScript:alert(document.cookie)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'ftp://example.com/file',
      '//evil.com',
      'example.com',
      'https://localhost',
    ])('rejects %s', url => {
      const r = createResourceSchema.safeParse({ category: 'website', title: 'X', url });
      expect(r.success).toBe(false);
    });

    it.each([
      'https://www.youtube.com/@CityNerd',
      'http://example.org/path?q=1#x',
      'https://bsky.app/profile/someone.bsky.social',
    ])('accepts %s', url => {
      expect(createResourceSchema.safeParse({ category: 'website', title: 'X', url }).success).toBe(true);
    });

    it('rejects a dangerous URL for a creator too', () => {
      const r = createCreatorSchema.safeParse({ name: 'X', platform: 'website', url: 'javascript:alert(1)' });
      expect(r.success).toBe(false);
    });
  });

  it('turns a cleared optional field into null, and leaves an absent one undefined', () => {
    const r = updateCreatorSchema.parse({ description: '' });
    expect(r.description).toBeNull();
    expect(r.url).toBeUndefined();
  });

  describe('creator tags', () => {
    const base = { name: 'X', platform: 'youtube' as const, url: 'https://youtube.com/@x' };

    it('accepts known tags and collapses duplicates', () => {
      expect(createCreatorSchema.parse({ ...base, tags: ['transit', 'econ', 'transit'] }).tags)
        .toEqual(['transit', 'econ']);
    });

    it('rejects an unknown tag', () => {
      expect(createCreatorSchema.safeParse({ ...base, tags: ['cooking'] }).success).toBe(false);
    });

    it.each([
      ['us', 'US'],
      [' gb ', 'GB'],
      ['', null],
    ])('normalises nationality %p to %p', (input, expected) => {
      expect(createCreatorSchema.parse({ ...base, nationalityCode: input }).nationalityCode).toBe(expected);
    });

    it('leaves nationality out when not given', () => {
      expect(createCreatorSchema.parse(base).nationalityCode).toBeUndefined();
    });

    it.each(['USA', 'U', '1A', 'U$'])('rejects nationality %p', nationalityCode => {
      expect(createCreatorSchema.safeParse({ ...base, nationalityCode }).success).toBe(false);
    });

    it('requires a platform from the list', () => {
      expect(createCreatorSchema.safeParse({ ...base, platform: 'myspace' }).success).toBe(false);
    });
  });

  it.each(['2024', '2024-03', '2024-03-15', ''])('accepts publishedOn %p', publishedOn => {
    const r = createResourceSchema.safeParse({ category: 'study', title: 'X', url: 'https://a.org', publishedOn });
    expect(r.success).toBe(true);
  });

  it.each(['24', '2024-13', '2024-02-32', 'March 2024'])('rejects publishedOn %p', publishedOn => {
    const r = createResourceSchema.safeParse({ category: 'study', title: 'X', url: 'https://a.org', publishedOn });
    expect(r.success).toBe(false);
  });

  it('rejects an unknown category', () => {
    expect(createResourceSchema.safeParse({ category: 'podcast', title: 'X', url: 'https://a.org' }).success).toBe(false);
  });
});
