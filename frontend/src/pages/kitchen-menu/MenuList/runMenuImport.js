/**
 * Sends a validated menu import to the server: first creates the categories
 * that don't exist yet, then adds the dishes one by one. A failing row never
 * stops the import; a lost connection or an expired session does (every
 * remaining row would fail the same way), and the rows that were not tried
 * are reported as such.
 */

const NETWORK_MESSAGE = 'Could not reach the server. Check your internet connection.';

async function postJson(fetchImpl, url, token, body) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
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

/**
 * @param {object} options
 * @param {Array} options.dishes          validated dishes (see validateMenuImport)
 * @param {string[]} options.newCategories category names to create first
 * @param {string} options.apiUrl
 * @param {string} options.token
 * @param {Function} [options.fetchImpl]
 * @param {Function} [options.onProgress] ({ step, done, total, currentName })
 * @returns {Promise<{
 *   createdCategories: Array, addedDishes: Array<{ dish, categoryId }>, importedCount: number,
 *   failures: Array<{ dish, message }>, notAttempted: Array<{ dish, message }>,
 *   categoryFailures: Array<{ name, message }>, stopReason: null | { code, message }
 * }>}
 */
export async function runMenuImport({ dishes, newCategories, apiUrl, token, fetchImpl = fetch, onProgress = () => {} }) {
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

  // Step 3: categories
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

  // Step 4: dishes
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
    createdCategories,
    addedDishes,
    importedCount,
    failures,
    notAttempted,
    categoryFailures: [...categoryFailureByName.values()],
    stopReason
  };
}
