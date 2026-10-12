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

  it('falls back to the last and then first word, de-duplicating and capping at the limit', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(ok(null))
      .mockResolvedValueOnce(ok([{ strMeal: 'Biryani', strMealThumb: 'https://x/1.jpg' }]))
      .mockResolvedValueOnce(ok([
        { strMeal: 'Biryani', strMealThumb: 'https://x/1.jpg' },
        { strMeal: 'Other', strMealThumb: 'https://x/2.jpg' },
      ]));
    const result = await fetchDishImageSuggestions('Hyderabadi Chicken Biriyani', { fetchImpl, limit: 4 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[1][0]).toContain('s=biriyani');
    expect(fetchImpl.mock.calls[2][0]).toContain('s=hyderabadi');
    expect(result.map((r) => r.url)).toEqual(['https://x/1.jpg', 'https://x/2.jpg']);
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
