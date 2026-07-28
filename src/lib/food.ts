import type { FoodItem } from './types';

/**
 * Open Food Facts food data (free, no API key). Barcode lookup + text search,
 * normalized to per-serving macros. https://world.openfoodfacts.org
 */

const OFF = 'https://world.openfoodfacts.org';
// Open Food Facts' legacy cgi/search.pl is being retired and now fails with
// 503s more often than not; search-a-licious is the maintained replacement
// and also ranks generic foods (e.g. a plain "banana") above random branded
// products the way the old endpoint didn't.
const OFF_SEARCH = 'https://search.openfoodfacts.org';
const UA = 'Stride/1.0 (running app)';

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

/** `brands` is a comma-separated string from the product endpoint, but an
 *  array from search-a-licious. */
function firstBrand(brands: unknown): string | undefined {
  const s = Array.isArray(brands) ? brands[0] : typeof brands === 'string' ? brands.split(',')[0] : '';
  const trimmed = s?.trim();
  return trimmed || undefined;
}

// Prefer per-serving values; fall back to per-100g.
function normalize(product: Record<string, any>): FoodItem | null {
  const n = product?.nutriments ?? {};
  const name: string = product?.product_name?.trim() || product?.generic_name?.trim() || '';
  if (!name) return null;

  const perServing =
    n['energy-kcal_serving'] != null || n['proteins_serving'] != null;
  const suffix = perServing ? '_serving' : '_100g';
  const kcal = num(n[`energy-kcal${suffix}`]) || num(n[`energy-kcal_100g`]);

  return {
    name,
    brand: firstBrand(product?.brands),
    servingDesc: perServing ? product?.serving_size || '1 serving' : '100 g',
    barcode: product?.code,
    calories: Math.round(kcal),
    proteinG: Math.round(num(n[`proteins${suffix}`])),
    carbsG: Math.round(num(n[`carbohydrates${suffix}`])),
    fatG: Math.round(num(n[`fat${suffix}`])),
  };
}

export async function lookupBarcode(code: string): Promise<FoodItem | null> {
  try {
    const res = await fetch(
      `${OFF}/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,generic_name,brands,serving_size,code,nutriments`,
      { headers: { 'User-Agent': UA } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.status !== 1 || !data?.product) return null;
    return normalize(data.product);
  } catch {
    return null;
  }
}

export async function searchFoods(query: string): Promise<FoodItem[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const res = await fetch(
      `${OFF_SEARCH}/search?q=${encodeURIComponent(q)}&page_size=20&fields=product_name,generic_name,brands,serving_size,code,nutriments`,
      { headers: { 'User-Agent': UA } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items: FoodItem[] = [];
    for (const p of data?.hits ?? []) {
      const item = normalize(p);
      if (item && item.calories > 0) items.push(item);
    }
    return items;
  } catch {
    return [];
  }
}
