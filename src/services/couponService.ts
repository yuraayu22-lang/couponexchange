import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  getDocs,
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { DEFAULT_MENU_ITEMS } from '../data/defaultMenu';
import { db, handleFirestoreError, OperationType, PRIMARY_ADMIN_EMAIL } from '../firebase';
import {
  IconKey,
  MenuCategory,
  MenuItem,
  SelectionRecord,
  SelectionStatus,
  VALIDATION_LIMITS,
} from '../types';

const SAVED_SELECTION_IDS_KEY = 'coupon_exchange_saved_selection_ids_v1';
const LAST_SUBMISSION_KEY = 'coupon_exchange_last_submission_v1';
const DUPLICATE_COOLDOWN_MS = 12_000;

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value instanceof Date) {
    return value;
  }
  return null;
}

function mapMenuItem(id: string, data: Record<string, unknown>): MenuItem {
  return {
    id,
    name: String(data.name ?? ''),
    category: (data.category as MenuCategory) || 'Food',
    description: String(data.description ?? ''),
    couponCost: Number(data.couponCost ?? 1),
    iconKey: (data.iconKey as IconKey) || 'utensils',
    imageUrl: String(data.imageUrl ?? ''),
    available: Boolean(data.available ?? true),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function mapSelection(id: string, data: Record<string, unknown>): SelectionRecord {
  return {
    id,
    userName: String(data.userName ?? ''),
    menuItemId: String(data.menuItemId ?? ''),
    menuItemName: String(data.menuItemName ?? ''),
    couponsRequired: Number(data.couponsRequired ?? 1),
    status: (data.status as SelectionStatus) || 'saved',
    submittedByUid: String(data.submittedByUid ?? ''),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function generateSafeSelectionId(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `sel_${hex}`;
}

export function generateSlugId(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || 'item'}-${suffix}`;
}

export function getSavedSelectionIds(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_SELECTION_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (id): id is string => typeof id === 'string' && VALIDATION_LIMITS.ID_PATTERN.test(id)
    );
  } catch {
    return [];
  }
}

function saveSelectionIdLocally(id: string) {
  try {
    const current = getSavedSelectionIds();
    const next = [id, ...current.filter((item) => item !== id)].slice(0, 50);
    localStorage.setItem(SAVED_SELECTION_IDS_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function replaceSavedSelectionIdsLocally(ids: string[]) {
  try {
    localStorage.setItem(SAVED_SELECTION_IDS_KEY, JSON.stringify(ids.slice(0, 50)));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function isDuplicateSubmissionRecent(userName: string, menuItemId: string): boolean {
  try {
    const raw = sessionStorage.getItem(LAST_SUBMISSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { fingerprint: string; timestamp: number };
    const fingerprint = `${userName.trim().toLowerCase()}::${menuItemId}`;
    return (
      parsed.fingerprint === fingerprint &&
      Date.now() - Number(parsed.timestamp) < DUPLICATE_COOLDOWN_MS
    );
  } catch {
    return false;
  }
}

function recordLastSubmission(userName: string, menuItemId: string) {
  try {
    const fingerprint = `${userName.trim().toLowerCase()}::${menuItemId}`;
    sessionStorage.setItem(
      LAST_SUBMISSION_KEY,
      JSON.stringify({ fingerprint, timestamp: Date.now() })
    );
  } catch {
    // Ignore storage errors
  }
}

export async function checkIsAdminUser(user: User | null): Promise<boolean> {
  if (!user || !user.emailVerified) return false;
  if (user.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
    return true;
  }
  try {
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    return adminSnap.exists();
  } catch {
    return false;
  }
}

let seedingPromise: Promise<void> | null = null;

export async function ensureDefaultMenuSeeded(existingIds: Set<string>): Promise<void> {
  if (existingIds.size > 0) return;
  if (seedingPromise) return seedingPromise;

  seedingPromise = (async () => {
    try {
      await Promise.all(
        DEFAULT_MENU_ITEMS.map(async (item) => {
          const ref = doc(db, 'menu_items', item.id);
          const snap = await getDoc(ref);
          if (!snap.exists()) {
            await setDoc(ref, {
              name: item.name,
              category: item.category,
              description: item.description,
              couponCost: item.couponCost,
              iconKey: item.iconKey,
              imageUrl: item.imageUrl,
              available: item.available,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        })
      );
    } catch (error) {
      console.error('Menu seed error:', error);
    } finally {
      seedingPromise = null;
    }
  })();

  return seedingPromise;
}

export function subscribeMenuItems(
  onData: (items: MenuItem[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'menu_items';
  const q = query(collection(db, path), orderBy('couponCost', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => mapMenuItem(d.id, d.data() as Record<string, unknown>));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}

export async function submitSelection(params: {
  userName: string;
  menuItem: MenuItem;
  user: User | null;
  allowDuplicateOverride?: boolean;
}): Promise<SelectionRecord> {
  const cleanName = params.userName.trim().slice(0, VALIDATION_LIMITS.USER_NAME_MAX);

  if (cleanName.length < VALIDATION_LIMITS.USER_NAME_MIN) {
    throw new Error('Please enter your full name (at least 2 characters).');
  }
  if (!params.menuItem.available) {
    throw new Error('This menu item is currently unavailable.');
  }
  if (
    !params.allowDuplicateOverride &&
    isDuplicateSubmissionRecent(cleanName, params.menuItem.id)
  ) {
    throw new Error(
      `DUPLICATE_GUARD: A selection for "${cleanName}" (${params.menuItem.name}) was just saved a moment ago.`
    );
  }

  const selectionId = generateSafeSelectionId();
  const path = `selections/${selectionId}`;

  const payload = {
    userName: cleanName,
    menuItemId: params.menuItem.id,
    menuItemName: params.menuItem.name.slice(0, VALIDATION_LIMITS.ITEM_NAME_MAX),
    couponsRequired: Math.max(
      VALIDATION_LIMITS.COUPON_COST_MIN,
      Math.min(VALIDATION_LIMITS.COUPON_COST_MAX, Math.round(params.menuItem.couponCost))
    ),
    status: 'saved' as SelectionStatus,
    submittedByUid: params.user?.uid ?? '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'selections', selectionId), payload);
    saveSelectionIdLocally(selectionId);
    recordLastSubmission(cleanName, params.menuItem.id);

    const savedSnap = await getDoc(doc(db, 'selections', selectionId));
    if (savedSnap.exists()) {
      return mapSelection(savedSnap.id, savedSnap.data() as Record<string, unknown>);
    }

    return {
      id: selectionId,
      userName: payload.userName,
      menuItemId: payload.menuItemId,
      menuItemName: payload.menuItemName,
      couponsRequired: payload.couponsRequired,
      status: 'saved',
      submittedByUid: payload.submittedByUid,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchMySavedSelections(user: User | null): Promise<SelectionRecord[]> {
  const localIds = getSavedSelectionIds();
  const recordMap = new Map<string, SelectionRecord>();
  const validLocalIds: string[] = [];

  if (localIds.length > 0) {
    await Promise.all(
      localIds.map(async (id) => {
        try {
          const snap = await getDoc(doc(db, 'selections', id));
          if (snap.exists()) {
            validLocalIds.push(id);
            recordMap.set(snap.id, mapSelection(snap.id, snap.data() as Record<string, unknown>));
          }
        } catch {
          // Skip unreadable/removed entries
        }
      })
    );
    if (validLocalIds.length !== localIds.length) {
      replaceSavedSelectionIdsLocally(validLocalIds);
    }
  }

  if (user) {
    try {
      const q = query(
        collection(db, 'selections'),
        where('submittedByUid', '==', user.uid)
      );
      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        recordMap.set(d.id, mapSelection(d.id, d.data() as Record<string, unknown>));
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'selections');
    }
  }

  return Array.from(recordMap.values()).sort((a, b) => {
    const timeA = a.createdAt ? a.createdAt.getTime() : 0;
    const timeB = b.createdAt ? b.createdAt.getTime() : 0;
    return timeB - timeA;
  });
}

export function subscribeAllSelections(
  onData: (records: SelectionRecord[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'selections';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const records = snapshot.docs.map((d) =>
        mapSelection(d.id, d.data() as Record<string, unknown>)
      );
      onData(records);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}

export async function updateSelectionRecord(
  id: string,
  updates: {
    userName: string;
    menuItemId: string;
    menuItemName: string;
    couponsRequired: number;
    status: SelectionStatus;
  }
): Promise<void> {
  const path = `selections/${id}`;
  const cleanName = updates.userName.trim().slice(0, VALIDATION_LIMITS.USER_NAME_MAX);
  if (cleanName.length < VALIDATION_LIMITS.USER_NAME_MIN) {
    throw new Error('User name must be at least 2 characters.');
  }

  try {
    await updateDoc(doc(db, 'selections', id), {
      userName: cleanName,
      menuItemId: updates.menuItemId,
      menuItemName: updates.menuItemName.trim().slice(0, VALIDATION_LIMITS.ITEM_NAME_MAX),
      couponsRequired: Math.max(
        VALIDATION_LIMITS.COUPON_COST_MIN,
        Math.min(VALIDATION_LIMITS.COUPON_COST_MAX, Math.round(updates.couponsRequired))
      ),
      status: updates.status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSelectionRecord(id: string): Promise<void> {
  const path = `selections/${id}`;
  try {
    await deleteDoc(doc(db, 'selections', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface MenuItemInput {
  name: string;
  category: MenuCategory;
  description: string;
  couponCost: number;
  iconKey: IconKey;
  imageUrl: string;
  available: boolean;
}

export async function createMenuItem(input: MenuItemInput): Promise<string> {
  const cleanName = input.name.trim().slice(0, VALIDATION_LIMITS.ITEM_NAME_MAX);
  const cleanDesc = input.description.trim().slice(0, VALIDATION_LIMITS.DESCRIPTION_MAX);
  if (!cleanName || !cleanDesc) {
    throw new Error('Menu item name and description are required.');
  }

  const itemId = generateSlugId(cleanName);
  const path = `menu_items/${itemId}`;

  try {
    await setDoc(doc(db, 'menu_items', itemId), {
      name: cleanName,
      category: input.category,
      description: cleanDesc,
      couponCost: Math.max(
        VALIDATION_LIMITS.COUPON_COST_MIN,
        Math.min(VALIDATION_LIMITS.COUPON_COST_MAX, Math.round(input.couponCost))
      ),
      iconKey: input.iconKey,
      imageUrl: input.imageUrl.trim().slice(0, VALIDATION_LIMITS.IMAGE_URL_MAX),
      available: Boolean(input.available),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return itemId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateMenuItem(id: string, input: MenuItemInput): Promise<void> {
  const path = `menu_items/${id}`;
  const cleanName = input.name.trim().slice(0, VALIDATION_LIMITS.ITEM_NAME_MAX);
  const cleanDesc = input.description.trim().slice(0, VALIDATION_LIMITS.DESCRIPTION_MAX);
  if (!cleanName || !cleanDesc) {
    throw new Error('Menu item name and description are required.');
  }

  try {
    await updateDoc(doc(db, 'menu_items', id), {
      name: cleanName,
      category: input.category,
      description: cleanDesc,
      couponCost: Math.max(
        VALIDATION_LIMITS.COUPON_COST_MIN,
        Math.min(VALIDATION_LIMITS.COUPON_COST_MAX, Math.round(input.couponCost))
      ),
      iconKey: input.iconKey,
      imageUrl: input.imageUrl.trim().slice(0, VALIDATION_LIMITS.IMAGE_URL_MAX),
      available: Boolean(input.available),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteMenuItem(id: string): Promise<void> {
  const path = `menu_items/${id}`;
  try {
    await deleteDoc(doc(db, 'menu_items', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function formatDateTime(date: Date | null): string {
  if (!date) return 'Just now';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function exportSelectionsToCSV(records: SelectionRecord[]) {
  const headers = ['Record ID', 'Full Name', 'Chosen Menu Item', 'Coupons Required', 'Status', 'Date & Time'];
  const escapeCsv = (val: string | number) => {
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = records.map((r) => [
    r.id,
    r.userName,
    r.menuItemName,
    r.couponsRequired,
    r.status,
    r.createdAt ? r.createdAt.toISOString() : '',
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `coupon-exchange-selections-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportSelectionsToExcel(records: SelectionRecord[]) {
  const rows = records.map((r) => ({
    'Record ID': r.id,
    'Full Name': r.userName,
    'Chosen Menu Item': r.menuItemName,
    'Coupons Required': r.couponsRequired,
    Status: r.status.charAt(0).toUpperCase() + r.status.slice(1),
    'Date & Time': formatDateTime(r.createdAt),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 28 },
    { wch: 24 },
    { wch: 24 },
    { wch: 18 },
    { wch: 12 },
    { wch: 24 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Selections');
  XLSX.writeFile(
    workbook,
    `coupon-exchange-selections-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}
