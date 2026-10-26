/**
 * recommend-weights.js — the numbers that order the suggestions.
 *
 * Kept apart from `recommend.js` so tuning the order is an edit to this file
 * and never to the rules. They are **relative ranking scores**, not
 * probabilities: 90 against 80 says a rule was written to outrank another, not
 * that one is 12% more likely to be right. Nothing here has been fitted to
 * data; `test/benchmark.mjs` measures what they do and records it.
 */

/** How strongly each rule's lead chart is recommended when it fires. */
export const RULE_WEIGHTS = {
  'time-series': 100,
  geographic: 95,
  'few-categories': 90,
  correlation: 85,
  'many-categories': 80,
  separation: 75,
  outliers: 72,
  distribution: 70,
  flow: 65,
  'part-to-whole': 60,
  'two-way-table': 55,
  'many-measures': 50,
};

export const SCORING = {
  /** Points lost for each place an alternative sits below its rule's lead chart. */
  alternativeStep: 4,
  /** Added to a rule that answers the question the reader asked. Large on purpose: asking should win. */
  intentBoost: 45,
  /** Taken off a candidate per unit of similarity to one already chosen. */
  redundancyPenalty: 30,
  /** Similarity of two charts in the same family (Bar and Bar). */
  sameCategory: 1,
  /** Similarity of two charts offered by the same rule but from different families. */
  sameRule: 0.5,
};
