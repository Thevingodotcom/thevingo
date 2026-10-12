/**
 * Dish image suggestions from TheMealDB's free, keyless public API.
 * https://www.themealdb.com/api.php
 *
 * Searches the full dish name first, then falls back to the last and first
 * words of the name (e.g. "Hyderabadi Chicken Biriyani" -> "Biriyani", "Hyderabadi").
 */

const MEALDB_SEARCH_URL = 'https://www.themealdb.com/api/json/v1/1/search.php?s=';

const buildQueries = (dishName) => {
  const cleaned = String(dishName ?? '').replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const words = cleaned.split(' ').filter((w) => w.length >= 3);
  const queries = [cleaned];
  if (words.length > 1) {
    queries.push(words[words.length - 1], words[0]);
  }
  return [...new Set(queries.map((q) => q.toLowerCase()))];
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
