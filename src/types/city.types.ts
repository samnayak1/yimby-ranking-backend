export type CityMapPoint = {
  id:               number;
  name:             string;
  country:          string;
  region:           string | null;
  lat:              number |null;
  lng:              number |null;
  rating:           number | null;
  medianHousePrice: number | null;
  currency:         string | null;
  notes:            string | null;
};