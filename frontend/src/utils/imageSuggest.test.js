import { describe, it, expect, vi } from 'vitest';
import { fetchDishImageSuggestions } from './imageSuggest';

const ok = (meals) => ({ ok: true, json: async () => ({ meals }) });

describe('fetchDishImageSuggestions', () => {
  it('returns thumbnails for the full dish name', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(ok([
      { strMeal: 'Chicken Biryani', strMealThumb: 'https://www.themealdb.com/a.jpg' },
      { strMeal: 'Lamb Biryani', strMealThumb: 'https://www.themealdb.com/b.jpg' },
    ]));
    const result = await fetchDishImageSuggestions('Biryani', { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toContain('search.php?s=biryani');
    expect(result).toEqual([
      { url: 'https://www.themealdb.com/a.jpg', title: 'Chicken Biryani' },
      { url: 'https://www.themealdb.com/b.jpg', title: 'Lamb Biryani' },
    ]);
  });

  it('falls back to individual words longest-first, de-duplicating and capping at the limit', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(ok(null)) // full phrase
      .mockResolvedValueOnce(ok([{ strMeal: 'Biryani', strMealThumb: 'https://x/1.jpg' }])) // "hyderabadi"
      .mockResolvedValueOnce(ok([
        { strMeal: 'Biryani', strMealThumb: 'https://x/1.jpg' },
        { strMeal: 'Other', strMealThumb: 'https://x/2.jpg' },
      ])) // "biriyani"
      .mockResolvedValueOnce(ok([{ strMeal: 'Chicken Dish', strMealThumb: 'https://x/3.jpg' }])); // "chicken"
    const result = await fetchDishImageSuggestions('Hyderabadi Chicken Biriyani', { fetchImpl, limit: 4 });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    // Full phrase first, then words longest-to-shortest: "hyderabadi" (10),
    // "biriyani" (8), "chicken" (7).
    expect(fetchImpl.mock.calls[0][0]).toContain('s=hyderabadi%20chicken%20biriyani');
    expect(fetchImpl.mock.calls[1][0]).toContain('s=hyderabadi');
    expect(fetchImpl.mock.calls[2][0]).toContain('s=biriyani');
    expect(fetchImpl.mock.calls[3][0]).toContain('s=chicken');
    expect(result.map((r) => r.url)).toEqual(['https://x/1.jpg', 'https://x/2.jpg', 'https://x/3.jpg']);
  });

  it('tries a significant middle word, not just the first and last words of the name', async () => {
    // Regression test: the old fallback only tried the first and last words of
    // the dish name, so a middle word like "Chicken" (which TheMealDB actually
    // has good coverage for) was never searched for a 3+ word dish name.
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(ok(null)) // full phrase
      .mockResolvedValueOnce(ok(null)) // "chettinad" (longest)
      .mockResolvedValueOnce(ok(null)) // "chicken"
      .mockResolvedValueOnce(ok([{ strMeal: 'Chicken Curry', strMealThumb: 'https://x/3.jpg' }])); // "curry"
    const result = await fetchDishImageSuggestions('Chettinad Chicken Curry', { fetchImpl });
    const queried = fetchImpl.mock.calls.map(([url]) => decodeURIComponent(url).split('s=')[1]);
    expect(queried).toEqual(['chettinad chicken curry', 'chettinad', 'chicken', 'curry']);
    expect(result).toEqual([{ url: 'https://x/3.jpg', title: 'Chicken Curry' }]);
  });

  it('also tries a naive singular form of a plural word', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(ok(null)) // full phrase
      .mockResolvedValueOnce(ok(null)) // "paneer"
      .mockResolvedValueOnce(ok(null)) // "tikkas"
      .mockResolvedValueOnce(ok([{ strMeal: 'Tikka', strMealThumb: 'https://x/4.jpg' }])); // "tikka" (singular)
    const result = await fetchDishImageSuggestions('Paneer Tikkas', { fetchImpl });
    const queried = fetchImpl.mock.calls.map(([url]) => decodeURIComponent(url).split('s=')[1]);
    expect(queried).toEqual(['paneer tikkas', 'paneer', 'tikkas', 'tikka']);
    expect(result).toEqual([{ url: 'https://x/4.jpg', title: 'Tikka' }]);
  });

  it('resolves to an empty list when nothing matches', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok(null));
    await expect(fetchDishImageSuggestions('Zzz', { fetchImpl })).resolves.toEqual([]);
  });

  it('returns [] without fetching for an empty name', async () => {
    const fetchImpl = vi.fn();
    await expect(fetchDishImageSuggestions('   ', { fetchImpl })).resolves.toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('throws when every request fails', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(fetchDishImageSuggestions('Masala Dosa', { fetchImpl })).rejects.toThrow(/unavailable/i);
  });
});
