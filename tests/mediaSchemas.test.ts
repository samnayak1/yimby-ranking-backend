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

    it('rejects a dangerous URL in an optional creator link too', () => {
      const r = createCreatorSchema.safeParse({ name: 'X', youtubeUrl: 'javascript:alert(1)' });
      expect(r.success).toBe(false);
    });
  });

  it('turns a cleared optional field into null, and leaves an absent one undefined', () => {
    const r = updateCreatorSchema.parse({ youtubeUrl: '  ', description: '' });
    expect(r.youtubeUrl).toBeNull();
    expect(r.description).toBeNull();
    expect('twitterUrl' in r ? r.twitterUrl : undefined).toBeUndefined();
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
