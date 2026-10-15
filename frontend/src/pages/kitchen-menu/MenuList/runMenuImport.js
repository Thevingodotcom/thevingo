/**
 * Sends an approved menu import to the server:
 *  1. updates the prices of existing dishes in ONE request (all or nothing on
 *     the server); if that fails nothing else is sent,
 *  2. creates the categories that don't exist yet,
 *  3. adds the new dishes one by one.
 * A failing dish row never stops the import; a lost connection or an expired
 * session does (every remaining row would fail the same way), and the rows
 * that were not tried are reported as such.
 */

const NETWORK_MESSAGE = 'Could not reach the server. Check your internet connection.';

async function sendJson(fetchImpl, method, url, token, body) {
  let response;
  try {
    response = await fetchImpl(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });
  } catch {
    return { ok: false, network: true, message: NETWORK_MESSAGE };
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (response.ok) return { ok: true, data };

  const status = response.status;
  const serverMessage = data && (data.message || data.error);
  const message = serverMessage
    || (status ? `The server returned an error (HTTP ${status}${response.statusText ? ` ${response.statusText}` : ''}).` : 'The server returned an error.');
  return { ok: false, status, auth: status === 401 || status === 403, message };
}

const postJson = (fetchImpl, url, token, body) => sendJson(fetchImpl, 'POST', url, token, body);

/**
 * Step 1: updates the prices of existing dishes with a single
 * PATCH /api/menu/dishes/prices. Never called with an empty list.
 *
 * @param {object} options
 * @param {Array<{dishId, newPrice}>} options.priceChanges  see validateMenuImport
 * @returns {Promise<
 *   { ok: true, updatedCount: number, updatedPrices: Array<{ id: string, price: number }> }
 * | { ok: false, code: 'network' | 'auth' | 'server', status?: number, message: string }
 * >}
 */
export async function updateDishPrices({ priceChanges, apiUrl, token, fetchImpl = fetch }) {
  const updates = priceChanges.map(change => ({ id: String(change.dishId), price: change.newPrice }));
  const result = await sendJson(fetchImpl, 'PATCH', `${apiUrl}/api/menu/dishes/prices`, token, { updates });
  if (!result.ok) {
    return {
      ok: false,
      code: result.network ? 'network' : result.auth ? 'auth' : 'server',
      status: result.status,
      message: result.message
    };
  }
  if (result.data?.success === false) {
    return { ok: false, code: 'server', status: 200, message: result.data.message || 'The server did not update the prices.' };
  }

  // Prefer the prices the server saved; fall back to what was sent.
  const requested = new Map(updates.map(update => [update.id, update.price]));
  const saved = Array.isArray(result.data?.dishes) ? result.data.dishes : [];
  const savedById = new Map(saved
    .filter(dish => dish && dish.id != null && requested.has(String(dish.id)))
    .map(dish => {
      const price = Number(dish.price);
      return [String(dish.id), Number.isFinite(price) ? price : requested.get(String(dish.id))];
    }));
  const updatedPrices = updates.map(update => ({ id: update.id, price: savedById.has(update.id) ? savedById.get(update.id) : update.price }));
  const updatedCount = typeof result.data?.updated === 'number' ? result.data.updated : updatedPrices.length;
  return { ok: true, updatedCount, updatedPrices };
}

/**
 * @param {object} options
 * @param {Array} [options.priceChanges]  price changes of existing dishes (see validateMenuImport)
 * @param {Array} options.dishes          validated new dishes (see validateMenuImport)
 * @param {string[]} options.newCategories category names to create first
 * @param {string} options.apiUrl
 * @param {string} options.token
 * @param {Function} [options.fetchImpl]
 * @param {Function} [options.onProgress] ({ step: 'prices' | 'categories' | 'dishes', done, total, currentName })
 * @returns {Promise<{
 *   updatedPrices: Array<{ id, price }>, updatedPriceCount: number,
 *   priceFailure: null | { code, status?, message },   // set => nothing else was sent
 *   createdCategories: Array, addedDishes: Array<{ dish, categoryId }>, importedCount: number,
 *   failures: Array<{ dish, message }>, notAttempted: Array<{ dish, message }>,
 *   categoryFailures: Array<{ name, message }>, stopReason: null | { code, message }
 * }>}
 */
export async function runMenuImport({ priceChanges = [], dishes, newCategories, apiUrl, token, fetchImpl = fetch, onProgress = () => {} }) {
  let updatedPrices = [];
  let updatedPriceCount = 0;

  // Step 1: prices (one atomic request). If it fails, stop before creating anything.
  if (priceChanges.length) {
    onProgress({ step: 'prices', done: 0, total: priceChanges.length });
    const priceResult = await updateDishPrices({ priceChanges, apiUrl, token, fetchImpl });
    if (!priceResult.ok) {
      return {
        updatedPrices,
        updatedPriceCount,
        priceFailure: { code: priceResult.code, status: priceResult.status, message: priceResult.message },
        createdCategories: [],
        addedDishes: [],
        importedCount: 0,
        failures: [],
        notAttempted: [],
        categoryFailures: [],
        stopReason: null
      };
    }
    updatedPrices = priceResult.updatedPrices;
    updatedPriceCount = priceResult.updatedCount;
    onProgress({ step: 'prices', done: priceChanges.length, total: priceChanges.length });
  }

  const createdCategories = [];
  const categoryIdByName = new Map();
  const categoryFailureByName = new Map();
  const addedDishes = [];
  const failures = [];
  const notAttempted = [];
  let importedCount = 0;
  let stopReason = null;

  const stop = (result) => {
    stopReason = result.network
      ? { code: 'network', message: 'Connection lost — the import was stopped.' }
      : { code: 'auth', message: 'Your session has expired — please log in again and import the remaining rows.' };
  };

  // Step 2: categories
  for (let index = 0; index < newCategories.length; index++) {
    const name = newCategories[index];
    onProgress({ step: 'categories', done: index, total: newCategories.length, currentName: name });
    const result = await postJson(fetchImpl, `${apiUrl}/api/menu/categories`, token, { name });
    if (result.ok && result.data?.category) {
      const category = { ...result.data.category, items: [] };
      createdCategories.push(category);
      categoryIdByName.set(name.toLowerCase(), category.id);
    } else if (result.network || result.auth) {
      stop(result);
      break;
    } else {
      categoryFailureByName.set(name.toLowerCase(), { name, message: result.ok ? 'Unexpected response from the server.' : result.message });
    }
  }
  if (!stopReason) onProgress({ step: 'categories', done: newCategories.length, total: newCategories.length });

  // Step 3: dishes
  for (let index = 0; index < dishes.length; index++) {
    const dish = dishes[index];
    if (stopReason) {
      notAttempted.push({ dish, message: 'Not imported — the import stopped before this row.' });
      continue;
    }
    onProgress({ step: 'dishes', done: index, total: dishes.length, currentName: dish.name });

    const categoryKey = dish.categoryName.toLowerCase();
    const categoryId = dish.categoryId ?? categoryIdByName.get(categoryKey);
    if (categoryId == null) {
      const reason = categoryFailureByName.get(categoryKey)?.message || 'it was not created';
      failures.push({ dish, message: `Category '${dish.categoryName}' could not be created: ${reason}` });
      continue;
    }

    const body = {
      name: dish.name,
      price: dish.price,
      categoryId,
      isVeg: dish.isVeg,
      availableBreakfast: dish.availableBreakfast,
      availableLunch: dish.availableLunch,
      availableDinner: dish.availableDinner
    };
    if (dish.description) body.description = dish.description;

    const result = await postJson(fetchImpl, `${apiUrl}/api/menu/dishes`, token, body);
    if (result.ok) {
      importedCount++;
      if (result.data?.dish) addedDishes.push({ dish: result.data.dish, categoryId });
    } else if (result.network || result.auth) {
      stop(result);
      notAttempted.push({ dish, message: result.message });
    } else {
      failures.push({ dish, message: result.message });
    }
  }
  if (!stopReason) onProgress({ step: 'dishes', done: dishes.length, total: dishes.length });

  return {
    updatedPrices,
    updatedPriceCount,
    priceFailure: null,
    createdCategories,
    addedDishes,
    importedCount,
    failures,
    notAttempted,
    categoryFailures: [...categoryFailureByName.values()],
    stopReason
  };
}
