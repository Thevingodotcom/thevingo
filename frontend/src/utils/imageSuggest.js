/**
 * Dish image suggestions from TheMealDB's free, keyless public API.
 * https://www.themealdb.com/api.php
 *
 * TheMealDB's search.php matches on a substring of the full meal name, and it
 * is a small, Western/international recipe database, so a full Indian dish
 * name (very common for this app) rarely matches as a whole phrase. We fall
 * back to searching individual significant words from the name, longest
 * first: longer words tend to be the specific dish noun (e.g. "Biryani",
 * "Manchurian"), while short ones are usually generic regional or qualifier
 * adjectives (e.g. "veg", "spicy", "chettinad") that match poorly or not at
 * all. We also try a naive singular form of each word (TheMealDB entries are
 * almost always singular, e.g. "Tikkas" -> "Tikka").
 *
 * This still won't find a match for dishes TheMealDB simply has no coverage
 * for (e.g. many Indo-Chinese or regional dishes) - that's a genuine gap in
 * the underlying free API/data set, not a bug here; callers should treat an
 * empty result as "no suggestions found", not as a failure.
 */

const MEALDB_SEARCH_URL = 'https://www.themealdb.com/api/json/v1/1/search.php?s=';
const MAX_QUERIES = 8;

const buildQueries = (dishName) => {
  const cleaned = String(dishName ?? '').replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const words = cleaned.split(' ').filter((w) => w.length >= 3);
  const queries = [cleaned];
  if (words.length > 1) {
    const byLength = [...new Set(words)].sort((a, b) => b.length - a.length);
    queries.push(...byLength);
  }
  for (const w of words) {
    if (w.length > 4 && /s$/i.test(w)) queries.push(w.slice(0, -1));
  }
  return [...new Set(queries.map((q) => q.toLowerCase()))].slice(0, MAX_QUERIES);
};

/**
 * @param {string} dishName
 * @param {{ limit?: number, signal?: AbortSignal, fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<Array<{ url: string, title: string }>>} Up to `limit` unique suggestions.
 * @throws when every request fails (network error / non-2xx); resolves [] when nothing matched.
 */
export async function fetchDishImageSuggestions(dishName, { limit = 4, signal, fetchImpl } = {}) {
  const doFetch = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  const queries = buildQueries(dishName);
  if (!doFetch || queries.length === 0) return [];

  const results = [];
  const seen = new Set();
  let failures = 0;

  for (const query of queries) {
    if (results.length >= limit) break;
    try {
      const response = await doFetch(`${MEALDB_SEARCH_URL}${encodeURIComponent(query)}`, { signal });
      if (!response || !response.ok) {
        failures++;
        continue;
      }
      const data = await response.json();
      const meals = Array.isArray(data?.meals) ? data.meals : [];
      for (const meal of meals) {
        const url = meal?.strMealThumb;
        if (typeof url !== 'string' || !/^https:\/\//i.test(url) || seen.has(url)) continue;
        seen.add(url);
        results.push({ url, title: meal.strMeal || query });
        if (results.length >= limit) break;
      }
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      failures++;
    }
  }

  if (results.length === 0 && failures === queries.length) {
    throw new Error('Image suggestions are unavailable right now.');
  }
  return results;
}

export default fetchDishImageSuggestions;
