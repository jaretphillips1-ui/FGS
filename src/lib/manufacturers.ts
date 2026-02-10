export type Manufacturer = {
  key: string;
  name: string;
  website: string;

  // Optional: later we can drop real logo files in /public/brands/... and set logoSrc.
  logoSrc?: string;

  // Optional: quick link to shopping/brand page (can be same as website for now)
  shopUrl?: string;
};

export const MANUFACTURERS: Manufacturer[] = [
  { key: "shimano", name: "Shimano", website: "https://fish.shimano.com/" },
  { key: "daiwa", name: "Daiwa", website: "https://daiwa.us/" },
  { key: "st-croix", name: "St. Croix", website: "https://stcroixrods.com/" },
  { key: "abu-garcia", name: "Abu Garcia", website: "https://www.abugarcia.com/" },
  { key: "lews", name: "Lew's", website: "https://www.lews.com/" },
  { key: "13-fishing", name: "13 Fishing", website: "https://www.13fishing.com/" },
  { key: "garmin", name: "Garmin", website: "https://www.garmin.com/" },
  { key: "humminbird", name: "Humminbird", website: "https://humminbird.johnsonoutdoors.com/" },
];
