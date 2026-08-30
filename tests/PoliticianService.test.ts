import { PoliticianService } from '../src/services/PoliticianService';
import { IPoliticianRepo } from '../src/repos/interfaces/IPoliticianRepo';
import { options } from '../src/config/config';
import { aPolitician, emptyPage } from './factories';

function makeRepo(over: Partial<IPoliticianRepo> = {}): jest.Mocked<IPoliticianRepo> {
  return {
    findAll:             jest.fn().mockResolvedValue(emptyPage([aPolitician()])),
    findById:            jest.fn().mockReturnValue(aPolitician()),
    create:              jest.fn().mockImplementation(d => aPolitician(d as object)),
    update:              jest.fn().mockImplementation((id, d) => aPolitician({ id, ...(d as object) })),
    delete:              jest.fn().mockReturnValue(true),
    getDesignations:     jest.fn().mockResolvedValue(['Mayor']),
    getPoliticalLeanings: jest.fn().mockResolvedValue(['Liberal']),
    upsertRating:        jest.fn().mockReturnValue(aPolitician()),
    ...over,
  } as jest.Mocked<IPoliticianRepo>;
}

const expectStatus = async (fn: () => unknown, status: number, message?: RegExp) => {
  try {
    await fn();
  } catch (err) {
    expect((err as { status: number }).status).toBe(status);
    if (message) expect((err as Error).message).toMatch(message);
    return;
  }
  throw new Error(`expected a ${status} to be thrown`);
};

const base = { name: 'Jane Doe', nationalityCode: 'US' as const };

describe('PoliticianService', () => {
  describe('getById', () => {
    it('throws 404 when absent', async () => {
      const repo = makeRepo({ findById: jest.fn().mockReturnValue(null) });
      await expectStatus(() => new PoliticianService(repo).getById(99), 404, /not found/i);
    });
  });

  describe('create', () => {
    it.each([['empty', ''], ['whitespace only', '   ']])(
      'rejects a %s name with a 400',
      async (_label, name) => {
        const repo = makeRepo();
        await expectStatus(() => new PoliticianService(repo).create({ ...base, name }), 400, /name/i);
        expect(repo.create).not.toHaveBeenCalled();
      },
    );

    it('trims the name', () => {
      const repo = makeRepo();
      new PoliticianService(repo).create({ ...base, name: '  Jane Doe  ' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Jane Doe' }),
      );
    });

    it('rejects a designation outside options.json', async () => {
      const repo = makeRepo();
      await expectStatus(
        () => new PoliticianService(repo).create({ ...base, designation: 'Supreme Overlord' }),
        400,
        /designation/i,
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    // The five added this session — a regression guard for the config the
    // frontend dropdown is expected to mirror.
    it.each([
      'Representative',
      'Assemblyman',
      'Alderman',
      'Councilmember',
      'Board Of Supervisors',
    ])('accepts the configured designation %s', designation => {
      const repo = makeRepo();
      expect(() =>
        new PoliticianService(repo).create({ ...base, designation }),
      ).not.toThrow();
    });

    it('accepts every designation in options.json', () => {
      const repo = makeRepo();
      const svc = new PoliticianService(repo);
      for (const designation of options.designations) {
        expect(() => svc.create({ ...base, designation })).not.toThrow();
      }
    });

    it('rejects a political leaning outside options.json', async () => {
      await expectStatus(
        () => new PoliticianService(makeRepo()).create({ ...base, politicalLeaning: 'Absurdist' }),
        400,
        /leaning/i,
      );
    });
  });

  describe('update', () => {
    it('checks existence before writing', async () => {
      const repo = makeRepo({ findById: jest.fn().mockReturnValue(null) });
      await expectStatus(() => new PoliticianService(repo).update(99, { name: 'X' }), 404);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('validates the designation on update too', async () => {
      const repo = makeRepo();
      await expectStatus(
        () => new PoliticianService(repo).update(1, { designation: 'Nonsense' }),
        400,
        /designation/i,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('refuses when the politician does not exist', async () => {
      const repo = makeRepo({ findById: jest.fn().mockReturnValue(null) });
      await expectStatus(() => new PoliticianService(repo).delete(99), 404);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('upsertRating', () => {
    it.each([
      ['a year before 2000', 1999, 5, /year/i],
      ['a year beyond next year', new Date().getFullYear() + 2, 5, /year/i],
      ['a rating below 1', 2026, 0, /rating/i],
      ['a rating above 10', 2026, 11, /rating/i],
    ])('rejects %s with a 400', async (_label, year, rating, message) => {
      const repo = makeRepo();
      await expectStatus(
        () => new PoliticianService(repo).upsertRating(1, year as number, rating as number),
        400,
        message as RegExp,
      );
      expect(repo.upsertRating).not.toHaveBeenCalled();
    });

    it.each([[1], [10]])('accepts the boundary rating %i', rating => {
      const repo = makeRepo();
      expect(() => new PoliticianService(repo).upsertRating(1, 2026, rating)).not.toThrow();
      expect(repo.upsertRating).toHaveBeenCalledWith(1, 2026, rating);
    });
  });
});
