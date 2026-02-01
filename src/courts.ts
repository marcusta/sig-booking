export const MATCHI_COURT_IDS = {
  BAY_1: "2068",
  BAY_2: "2069",
  BAY_3: "2074",
  BAY_4: "2071",
  BAY_5: "2072",
  BAY_6: "2070",
  BAY_7: "2076",
  BAY_8: "2077",
} as const;

export const BAY_TO_COURT: Record<string, string> = {
  "1": MATCHI_COURT_IDS.BAY_1,
  "2": MATCHI_COURT_IDS.BAY_2,
  "3": MATCHI_COURT_IDS.BAY_3,
  "4": MATCHI_COURT_IDS.BAY_4,
  "5": MATCHI_COURT_IDS.BAY_5,
  "6": MATCHI_COURT_IDS.BAY_6,
  "7": MATCHI_COURT_IDS.BAY_7,
  "8": MATCHI_COURT_IDS.BAY_8,
};

export const COURT_TO_BAY: Record<string, number> = {
  [MATCHI_COURT_IDS.BAY_1]: 1,
  [MATCHI_COURT_IDS.BAY_2]: 2,
  [MATCHI_COURT_IDS.BAY_3]: 3,
  [MATCHI_COURT_IDS.BAY_4]: 4,
  [MATCHI_COURT_IDS.BAY_5]: 5,
  [MATCHI_COURT_IDS.BAY_6]: 6,
  [MATCHI_COURT_IDS.BAY_7]: 7,
  [MATCHI_COURT_IDS.BAY_8]: 8,
};

export const VALID_MATCHI_COURT_IDS = new Set(Object.values(BAY_TO_COURT));
