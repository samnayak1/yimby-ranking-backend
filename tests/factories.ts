import { CityWithRatings, PoliticianWithRatings } from '../src/models';

export const aCity = (over: Partial<CityWithRatings> = {}): CityWithRatings => ({
  id: 1,
  name: 'Austin',
  countryCode: 'US',
  region: 'Texas',
  rating: 7.5,
  medianHousePrice: 450000,
  currency: 'USD',
  notes: null,
  lat: 30.26,
  lng: -97.74,
  createdAt: '2026-01-01 00:00:00',
  updatedAt: '2026-01-01 00:00:00',
  ratings: [],
  ...over,
});

export const aPolitician = (
  over: Partial<PoliticianWithRatings> = {},
): PoliticianWithRatings => ({
  id: 1,
  name: 'Jane Doe',
  designation: 'Mayor',
  status: 'INOFFICE',
  nationalityCode: 'US',
  politicalLeaning: 'Liberal',
  notes: null,
  rating: 8,
  createdAt: '2026-01-01 00:00:00',
  updatedAt: '2026-01-01 00:00:00',
  ratings: [],
  ...over,
});

export const emptyPage = <T>(data: T[] = []) => ({
  data,
  pagination: { page: 1, limit: 20, total: data.length, totalPages: 1 },
});
