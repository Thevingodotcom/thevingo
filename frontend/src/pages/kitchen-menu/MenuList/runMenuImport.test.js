import { describe, it, expect, vi } from 'vitest';
import { runMenuImport, updateDishPrices } from './runMenuImport';

const API = 'https://api.test';
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

const priceChanges = [
  { row: 2, dishId: 101, name: 'Paneer Butter Masala', categoryName: 'Main Course', categoryId: '7', oldPrice: 160, newPrice: 180 },
  { row: 3, dishId: '201', name: 'Chicken 65', categoryName: 'Starters', categoryId: '8', oldPrice: 220, newPrice: 199.5 }
];
const newDish = {
  row: 4, categoryName: 'Drinks', categoryId: null, name: 'Lime Soda', price: 50, isVeg: true,
  availableBreakfast: true, availableLunch: true, availableDinner: true, description: ''
};

describe('updateDishPrices', () => {
  it('sends one PATCH with string ids and new prices', async () => {
    const fetchImpl = vi.fn(async () => json(200, { success: true, updated: 2, dishes: [{ id: '101', price: 180 }, { id: '201', price: '199.50' }] }));
    const result = await updateDishPrices({ priceChanges, apiUrl: API, token: 'tok', fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${API}/api/menu/dishes/prices`);
    expect(init.method).toBe('PATCH');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', Authorization: 'Bearer tok' });
    expect(JSON.parse(init.body)).toEqual({ updates: [{ id: '101', price: 180 }, { id: '201', price: 199.5 }] });
    expect(result).toEqual({ ok: true, updatedCount: 2, updatedPrices: [{ id: '101', price: 180 }, { id: '201', price: 199.5 }] });
  });

  it('falls back to the sent prices when the response has no dishes', async () => {
    const fetchImpl = vi.fn(async () => json(200, { success: true }));
    const result = await updateDishPrices({ priceChanges, apiUrl: API, token: 't', fetchImpl });
    expect(result).toEqual({ ok: true, updatedCount: 2, updatedPrices: [{ id: '101', price: 180 }, { id: '201', price: 199.5 }] });
  });

  it('returns the server message on 404, and flags network and auth failures', async () => {
    const message = 'Some dishes were not found on your menu. Nothing was changed.';
    expect(await updateDishPrices({ priceChanges, apiUrl: API, token: 't', fetchImpl: async () => json(404, { success: false, message, missingIds: ['101'] }) }))
      .toEqual({ ok: false, code: 'server', status: 404, message });
    expect(await updateDishPrices({ priceChanges, apiUrl: API, token: 't', fetchImpl: async () => { throw new TypeError('Failed to fetch'); } }))
      .toMatchObject({ ok: false, code: 'network' });
    expect(await updateDishPrices({ priceChanges, apiUrl: API, token: 't', fetchImpl: async () => json(401, { message: 'Token expired' }) }))
      .toMatchObject({ ok: false, code: 'auth', message: 'Token expired' });
  });
});

describe('runMenuImport', () => {
  it('updates prices first, then creates categories and dishes', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json(200, { success: true, updated: 2, dishes: [{ id: '101', price: 180 }, { id: '201', price: 199.5 }] }))
      .mockResolvedValueOnce(json(201, { success: true, category: { id: '9', name: 'Drinks' } }))
      .mockResolvedValueOnce(json(201, { success: true, dish: { id: '401', name: 'Lime Soda', price: 50 } }));
    const onProgress = vi.fn();

    const result = await runMenuImport({ priceChanges, dishes: [newDish], newCategories: ['Drinks'], apiUrl: API, token: 't', fetchImpl, onProgress });

    expect(fetchImpl.mock.calls.map(([url, init]) => `${init.method} ${url.replace(API, '')}`)).toEqual([
      'PATCH /api/menu/dishes/prices',
      'POST /api/menu/categories',
      'POST /api/menu/dishes'
    ]);
    expect(result).toMatchObject({ priceFailure: null, updatedPriceCount: 2, importedCount: 1 });
    expect(result.updatedPrices).toEqual([{ id: '101', price: 180 }, { id: '201', price: 199.5 }]);
    expect(onProgress).toHaveBeenCalledWith({ step: 'prices', done: 0, total: 2 });
    expect(onProgress).toHaveBeenCalledWith({ step: 'prices', done: 2, total: 2 });
  });

  it('stops before creating anything when the price update fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(json(500, { success: false, message: 'Could not update prices due to a server error. Nothing was changed.' }));
    const result = await runMenuImport({ priceChanges, dishes: [newDish], newCategories: ['Drinks'], apiUrl: API, token: 't', fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.priceFailure).toEqual({ code: 'server', status: 500, message: 'Could not update prices due to a server error. Nothing was changed.' });
    expect(result).toMatchObject({ importedCount: 0, createdCategories: [], addedDishes: [], updatedPrices: [], updatedPriceCount: 0 });
  });

  it('does not call the price endpoint when there are no price changes', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(json(201, { success: true, dish: { id: '401', name: 'Lime Soda' } }));
    const result = await runMenuImport({ dishes: [{ ...newDish, categoryId: '9' }], newCategories: [], apiUrl: API, token: 't', fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(`${API}/api/menu/dishes`);
    expect(result).toMatchObject({ priceFailure: null, updatedPrices: [], updatedPriceCount: 0, importedCount: 1 });
  });
});
