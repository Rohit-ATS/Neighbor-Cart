/**
 * Which directory category an OpenStreetMap record belongs in.
 *
 * OSM has a single tag (`social_facility=food_bank`) for what the UI splits
 * into food banks, pantries and mobile distributions. Classifying on the tag
 * alone left the "Food Pantries" and "Mobile Distributions" filters showing
 * nothing, while 45 records were literally named "...Food Pantry".
 *
 * The name decides when it is specific; the tag is the fallback. Order
 * matters — a "Mobile Food Pantry" is a mobile distribution first, since that
 * is the thing a visitor needs to plan around.
 */

const NAME_CATEGORY = [
  [/\b(fridge|refrigerator|free food box|blessing box)\b/i, 'community-fridge'],
  [/\b(mobile|truck|van|on wheels|drive[- ]?thru|pop[- ]?up)\b/i, 'mobile'],
  [/\b(soup kitchen|hot meals?|community kitchen|dining room|free meals?)\b/i, 'hot-meal'],
  [/\b(pantry|cupboard|larder|food closet|food shelf)\b/i, 'pantry'],
  [/\b(food ?bank)\b/i, 'food-bank'],
];

export function categoryFor(name, tagCategory) {
  for (const [pattern, category] of NAME_CATEGORY) {
    if (pattern.test(name)) return category;
  }
  return tagCategory;
}
