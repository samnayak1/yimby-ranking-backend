export type CityMapPoint = {
  id:               number;
  name:             string;
  country:          string;
  region:           string | null;
  lat:              number |null;
  lng:              number |null;
  // Latest year's figure, the city's headline number.
  permitsPer1000Residents: number | null;
  medianHousePrice: number | null;
  currency:         string | null;
  notes:            string | null;
};