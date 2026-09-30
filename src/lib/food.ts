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

interface Macros {
  kcal: number;
  p: number;
  c: number;
  f: number;
}

// Deliberately loose. 100 g of food holds at most 100 g of anything and pure
// fat is ~884 kcal, but real labels overshoot both — banana chips list macros
// summing to 107 g, olive oil lists 914 kcal — because each figure is rounded
// and measured independently. These bounds are set to catch the contributor
// entering the wrong scale (values 100x out), not to police label arithmetic.
const MAX_MACRO_PER_100G = 110;
const MAX_MACRO_SUM_PER_100G = 115;
const MAX_KCAL_PER_100G = 1000;
// Nothing sold as a single serving carries this much. Deliberately loose —
// only here to catch garbage on records that publish no per-100g block.
const MAX_MACRO_PER_SERVING = 300;
const MAX_KCAL_PER_SERVING = 3000;

/**
 * Open Food Facts is crowd-sourced and a real share of it is wrong by orders
 * of magnitude. Searching "chipotle bowl" returns records claiming 3500 g of
 * protein per 100 g — which is how a user logged a 3500 g protein bowl.
 *
 * These are rejected rather than rescaled: the bad rows here are uniformly
 * 100x too large, but inferring that is guesswork, and quietly inventing a
 * plausible-looking number is worse than showing one fewer search result.
 */
function plausible(m: Macros, basis: '100g' | 'serving'): boolean {
  const all = [m.kcal, m.p, m.c, m.f];
  if (all.some((v) => !Number.isFinite(v) || v < 0)) return false;
  if (basis === '100g') {
    if (m.p > MAX_MACRO_PER_100G || m.c > MAX_MACRO_PER_100G || m.f > MAX_MACRO_PER_100G) {
      return false;
    }
    if (m.p + m.c + m.f > MAX_MACRO_SUM_PER_100G) return false;
    return m.kcal <= MAX_KCAL_PER_100G;
  }
  if (m.p > MAX_MACRO_PER_SERVING || m.c > MAX_MACRO_PER_SERVING || m.f > MAX_MACRO_PER_SERVING) {
    return false;
  }
  return m.kcal <= MAX_KCAL_PER_SERVING;
}

// Prefer per-serving values; fall back to per-100g.
function normalize(product: Record<string, any>): FoodItem | null {
  const n = product?.nutriments ?? {};
  const name: string = product?.product_name?.trim() || product?.generic_name?.trim() || '';
  if (!name) return null;

  const read = (suffix: '_serving' | '_100g'): Macros => ({
    kcal: num(n[`energy-kcal${suffix}`]),
    p: num(n[`proteins${suffix}`]),
    c: num(n[`carbohydrates${suffix}`]),
    f: num(n[`fat${suffix}`]),
  });

  // Both must be present, or we'd pair per-serving macros with per-100g
  // calories and silently misreport the entry.
  const perServing = n['energy-kcal_serving'] != null && n['proteins_serving'] != null;
  const per100 = read('_100g');

  // Almost every record carries a per-100g block, and it's the clearest tell
  // that a contributor used the wrong scale — check it even when displaying
  // per-serving values.
  const has100 = per100.kcal > 0 || per100.p > 0 || per100.c > 0 || per100.f > 0;
  if (has100 && !plausible(per100, '100g')) return null;

  const shown = perServing ? read('_serving') : per100;
  if (!plausible(shown, perServing ? 'serving' : '100g')) return null;

  return {
    name,
    brand: firstBrand(product?.brands),
    servingDesc: perServing ? product?.serving_size || '1 serving' : '100 g',
    barcode: product?.code,
    calories: Math.round(shown.kcal),
    proteinG: Math.round(shown.p),
    carbsG: Math.round(shown.c),
    fatG: Math.round(shown.f),
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
