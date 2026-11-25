/* ============================================================
   CraveCart - pantry.js
   Smart Pantry storage (per account, Local Storage) with optional
   expiry dates and safety states.

   Expired items are never counted towards recipe matches and are
   surfaced separately so the UI can tell the user to discard them.
   ============================================================ */

const KEY_PREFIX = 'cravecart_pantry_';

function key(userId) {
  return KEY_PREFIX + (userId || 'guest');
}

function makeId() {
  return 'pantry_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

export function expiryStatus(dateStr) {
  const days = daysUntil(dateStr);
  if (days === null) return { status: 'none', days: null, label: 'No expiry tracked' };
  if (days < 0) return { status: 'expired', days, label: days === -1 ? 'Expired yesterday' : 'Expired ' + Math.abs(days) + ' days ago' };
  if (days === 0) return { status: 'soon', days, label: 'Expires today' };
  if (days <= 5) return { status: 'soon', days, label: 'Expires in ' + days + ' day' + (days === 1 ? '' : 's') };
  return { status: 'fresh', days, label: 'Fresh · ' + days + ' days left' };
}

/* Adds derived fields without writing them back to storage. */
export function decoratePantry(items) {
  return (items || []).map((item) => {
    const info = expiryStatus(item.expiry);
    return { ...item, ...info, expired: info.status === 'expired' };
  });
}

export function getPantry(userId) {
  try {
    const raw = localStorage.getItem(key(userId));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

export function savePantry(userId, items) {
  const clean = (items || []).map((item) => ({
    id: item.id || makeId(),
    name: String(item.name || '').trim(),
    expiry: item.expiry || ''
  })).filter((item) => item.name);
  try {
    localStorage.setItem(key(userId), JSON.stringify(clean));
  } catch (e) {
    /* storage full / disabled */
  }
  return clean;
}

export function addPantryItem(userId, name, expiry = '') {
  const trimmed = String(name || '').trim();
  if (!trimmed) return getPantry(userId);
  const items = getPantry(userId);
  const exists = items.some((i) => i.name.toLowerCase() === trimmed.toLowerCase());
  if (exists) return items;
  return savePantry(userId, [...items, { id: makeId(), name: trimmed, expiry }]);
}

export function removePantryItem(userId, id) {
  return savePantry(userId, getPantry(userId).filter((i) => i.id !== id));
}

export function clearPantry(userId) {
  return savePantry(userId, []);
}

/* Items to prioritise: expiring within `days`, excluding anything
   already expired (those are not safe to build a meal around). */
export function expiringSoon(items, days = 5) {
  return decoratePantry(items)
    .filter((i) => i.status === 'soon' && i.days !== null && i.days >= 0 && i.days <= days)
    .sort((a, b) => a.days - b.days);
}

export function expiredItems(items) {
  return decoratePantry(items).filter((i) => i.status === 'expired').sort((a, b) => a.days - b.days);
}

/* Common pantry suggestions built from the real ingredient lists of
   the local recipe catalogue — no network call, no invented data. */
export function buildIngredientSuggestions(recipes, limit = 60) {
  const counts = new Map();
  (recipes || []).forEach((recipe) => {
    (recipe.ingredients || []).forEach((ing) => {
      const name = String(ing.name || '').split('(')[0].split(',')[0].trim();
      if (!name || name.length > 34) return;
      const key = name.toLowerCase();
      const entry = counts.get(key) || { name, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    });
  });
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}
