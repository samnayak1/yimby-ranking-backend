import { contactSchema } from '../src/schemas/contact.schema';

const valid = { name: 'Sam', email: 'sam@example.com', message: 'Hello there' };

describe('contactSchema', () => {
  it('accepts a complete message and trims fields', () => {
    const r = contactSchema.parse({ name: '  Sam ', email: ' sam@example.com ', message: ' Hello there ' });
    expect(r).toMatchObject(valid);
  });

  it.each([
    ['missing name', { ...valid, name: '' }, 'name'],
    ['whitespace name', { ...valid, name: '   ' }, 'name'],
    ['missing email', { name: 'Sam', message: 'Hello there' }, 'email'],
    ['invalid email', { ...valid, email: 'not-an-email' }, 'email'],
    ['short message', { ...valid, message: 'hi' }, 'message'],
  ])('rejects %s', (_label, input, field) => {
    const r = contactSchema.safeParse(input);
    expect(r.success).toBe(false);
    expect(r.error!.issues.map(i => i.path[0])).toContain(field);
  });
});
