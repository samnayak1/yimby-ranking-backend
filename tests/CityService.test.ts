import { CityService } from '../src/services/CityService';
import { ICityRepo } from '../src/repos/interfaces/ICityRepo';
import { aCity, emptyPage } from './factories';

function makeRepo(over: Partial<ICityRepo> = {}): jest.Mocked<ICityRepo> {
  return {
    findAll:       jest.fn().mockResolvedValue(emptyPage([aCity()])),
    findById:      jest.fn().mockReturnValue(aCity()),
    findMapData:   jest.fn().mockReturnValue([]),
    create:        jest.fn().mockImplementation(d => aCity(d as object)),
    update:        jest.fn().mockImplementation((id, d) => aCity({ id, ...(d as object) })),
    delete:        jest.fn().mockReturnValue(true),
    getCountries:  jest.fn().mockResolvedValue(['United States']),
    getRegions:    jest.fn().mockResolvedValue(['Texas']),
    upsertMetrics: jest.fn().mockReturnValue(aCity()),
    ...over,
  } as jest.Mocked<ICityRepo>;
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

describe('CityService', () => {
  describe('getById', () => {
    it('returns the city', () => {
      const repo = makeRepo();
      expect(new CityService(repo).getById(1).name).toBe('Austin');
      expect(repo.findById).toHaveBeenCalledWith(1);
    });

    it('throws 404 when the city does not exist', async () => {
      const repo = makeRepo({ findById: jest.fn().mockReturnValue(null) });
      await expectStatus(() => new CityService(repo).getById(99), 404, /not found/i);
    });
  });

  describe('create', () => {
    it('trims the name before handing it to the repo', () => {
      const repo = makeRepo();
      new CityService(repo).create({ name: '  Austin  ', countryCode: 'US' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Austin' }),
      );
    });

    it.each([
      ['latitude below range',  { lat: -91 },  /latitude/i],
      ['latitude above range',  { lat: 91 },   /latitude/i],
      ['longitude below range', { lng: -181 }, /longit/i],
      ['longitude above range', { lng: 181 },  /longit/i],
    ])('rejects %s with a 400', async (_label, coords, message) => {
      const repo = makeRepo();
      await expectStatus(
        () => new CityService(repo).create({ name: 'X', countryCode: 'US', ...coords }),
        400,
        message,
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('accepts the boundary values', () => {
      const repo = makeRepo();
      const svc = new CityService(repo);
      expect(() =>
        svc.create({ name: 'X', countryCode: 'US', lat: 90, lng: 180 }),
      ).not.toThrow();
      expect(() =>
        svc.create({ name: 'X', countryCode: 'US', lat: -90, lng: -180 }),
      ).not.toThrow();
    });
  });

  describe('update', () => {
    it('checks the city exists before writing', async () => {
      const repo = makeRepo({ findById: jest.fn().mockReturnValue(null) });
      await expectStatus(() => new CityService(repo).update(99, { name: 'X' }), 404);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('rejects a negative median price with a 400', async () => {
      const repo = makeRepo();
      await expectStatus(
        () => new CityService(repo).update(1, { medianHousePrice: -1 }),
        400,
        /price/i,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('allows a zero median price', () => {
      const repo = makeRepo();
      expect(() => new CityService(repo).update(1, { medianHousePrice: 0 })).not.toThrow();
      expect(repo.update).toHaveBeenCalled();
    });
  });



  describe('upsertMetrics', () => {
    const valid = { year: 2026, rating: 8 };

    it('rejects a year before 2000', async () => {
      await expectStatus(
        () => new CityService(makeRepo()).upsertMetrics(1, { ...valid, year: 1999 }),
        400,
        /year/i,
      );
    });

    it('rejects a year beyond next year', async () => {
      const tooFar = new Date().getFullYear() + 2;
      await expectStatus(
        () => new CityService(makeRepo()).upsertMetrics(1, { ...valid, year: tooFar }),
        400,
        /year/i,
      );
    });

    it.each([
      ['averagePermitDays'],
      ['permitsIssued'],
      ['housingStarts'],
      ['homesCompleted'],
      ['population'],
      ['permitsPer1000Residents'],
    ])('rejects a negative %s with a 400', async field => {
      await expectStatus(
        () => new CityService(makeRepo()).upsertMetrics(1, { ...valid, [field]: -1 }),
        400,
      );
    });

    it('rejects a rating above 10', async () => {
      await expectStatus(
        () => new CityService(makeRepo()).upsertMetrics(1, { ...valid, rating: 11 }),
        400,
        /rating/i,
      );
    });

    it('passes a valid payload through to the repo', () => {
      const repo = makeRepo();
      new CityService(repo).upsertMetrics(1, { ...valid, permitsIssued: 0, population: 1 });
      expect(repo.upsertMetrics).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ year: 2026, permitsIssued: 0 }),
      );
    });
  });
});
