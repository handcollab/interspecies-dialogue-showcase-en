// Outcome classes, plants and styles in English. The outcome names follow outcome_en in data/experiments.json
// (Striking / Visible / Subtle / None); 'Other' groups Uncertain, Hard to observe and Unrecorded.
export const GROUPS = {
  s: { en: 'Striking', color: '#c8ff40', ap: 1.0 },
  b: { en: 'Visible', color: '#7eb8ff', ap: 0.62 },
  f: { en: 'Subtle', color: '#ff8c00', ap: 0.32 },
  n: { en: 'None', color: '#6a6862', ap: 0.04 },
  o: { en: 'Other', color: '#ff4fd8', ap: 0.18 },
};
export const GROUP_ORDER = ['s', 'b', 'f', 'n', 'o'];
// record.p -> plant (common names as in plant_en; the identifications are presumed, not verified)
export const PLANTS_DISPLAY = ['Purple heart', 'Inchplant', 'Chinese hibiscus', 'Philodendron ‘Florida’'];
export const PLANTS_SHORT = ['PURPLE HEART', 'INCHPLANT', 'HIBISCUS', 'PHILODENDRON'];
// record.me (the sheet's method, kept in Chinese in the data) -> method_en as in data/experiments.json
export const METHOD_EN = {
  '藍光': 'blue light', '刷毛': 'brush', '噴水': 'spray', '手機手電筒': 'phone flashlight', '白光': 'white light',
  '浸泡': 'soak', '浸泡 5 秒 + 刷毛': 'soak 5 s + brush', '浸泡 5 秒': 'soak 5 s',
};
export const methodEn = (m) => METHOD_EN[m] || m;
export const AIGC_CATS = {
  glass: { en: 'GLASS' },
  glitch: { en: 'GLITCH' },
  biofluor: { en: 'BIOLUMINESCENT FLUID' },
  mercury: { en: 'LIQUID MERCURY & METAL' },
  blueprint: { en: 'MINIMAL BLUEPRINT' },
  uncanny: { en: 'UNCANNY' },
};
