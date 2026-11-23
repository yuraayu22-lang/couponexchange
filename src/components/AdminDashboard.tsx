import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Lock,
  LogOut,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { DEFAULT_MENU_ITEMS, PRESET_IMAGE_OPTIONS } from '../data/defaultMenu';
import { PRIMARY_ADMIN_EMAIL } from '../firebase';
import {
  createMenuItem,
  deleteMenuItem,
  deleteSelectionRecord,
  ensureDefaultMenuSeeded,
  exportSelectionsToCSV,
  exportSelectionsToExcel,
  formatDateTime,
  MenuItemInput,
  subscribeAllSelections,
  updateMenuItem,
  updateSelectionRecord,
} from '../services/couponService';
import {
  ICON_KEY_OPTIONS,
  IconKey,
  MENU_CATEGORIES,
  MenuCategory,
  MenuItem,
  SelectionRecord,
  SelectionStatus,
  VALIDATION_LIMITS,
} from '../types';
import { MenuIcon } from './MenuIcon';
import { MenuItemMedia } from './MenuItemMedia';

interface AdminDashboardProps {
  user: User | null;
  isAdmin: boolean;
  authLoading: boolean;
  menuItems: MenuItem[];
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

type AdminTab = 'selections' | 'menu';

export function AdminDashboard({
  user,
  isAdmin,
  authLoading,
  menuItems,
  onSignIn,
  onSignOut,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('selections');
  const [selections, setSelections] = useState<SelectionRecord[]>([]);
  const [selectionsLoading, setSelectionsLoading] = useState(true);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminNotice, setAdminNotice] = useState<string | null>(null);

  // Filters for Selections
  const [searchUser, setSearchUser] = useState('');
  const [filterMenu, setFilterMenu] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Edit / Delete Selection state
  const [editingSelection, setEditingSelection] = useState<SelectionRecord | null>(null);
  const [editSelName, setEditSelName] = useState('');
  const [editSelMenuId, setEditSelMenuId] = useState('');
  const [editSelCoupons, setEditSelCoupons] = useState(1);
  const [editSelStatus, setEditSelStatus] = useState<SelectionStatus>('saved');
  const [savingSelection, setSavingSelection] = useState(false);
  const [confirmDeleteSelectionId, setConfirmDeleteSelectionId] = useState<string | null>(null);

  // Add / Edit Menu Item state
  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [menuForm, setMenuForm] = useState<MenuItemInput>({
    name: '',
    category: 'Food',
    description: '',
    couponCost: 2,
    iconKey: 'utensils',
    imageUrl: '',
    available: true,
  });
  const [savingMenu, setSavingMenu] = useState(false);
  const [confirmDeleteMenuId, setConfirmDeleteMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      setSelections([]);
      setSelectionsLoading(false);
      return;
    }

    setSelectionsLoading(true);
    setAdminError(null);
    const unsub = subscribeAllSelections(
      (records) => {
        setSelections(records);
        setSelectionsLoading(false);
      },
      (err) => {
        setAdminError(err.message);
        setSelectionsLoading(false);
      }
    );
    return () => unsub();
  }, [isAdmin]);

  const menuNamesForFilter = useMemo(() => {
    const names = new Set<string>();
    menuItems.forEach((m) => names.add(m.name));
    selections.forEach((s) => names.add(s.menuItemName));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [menuItems, selections]);

  const filteredSelections = useMemo(() => {
    const queryText = searchUser.trim().toLowerCase();
    return selections.filter((rec) => {
      if (queryText && !rec.userName.toLowerCase().includes(queryText)) {
        return false;
      }
      if (filterMenu !== 'all' && rec.menuItemName !== filterMenu) {
        return false;
      }
      if (filterStatus !== 'all' && rec.status !== filterStatus) {
        return false;
      }
      return true;
    });
  }, [selections, searchUser, filterMenu, filterStatus]);

  const metrics = useMemo(() => {
    const totalRecords = filteredSelections.length;
    const totalCoupons = filteredSelections.reduce(
      (sum, rec) => (rec.status === 'cancelled' ? sum : sum + rec.couponsRequired),
      0
    );
    const savedCount = filteredSelections.filter((r) => r.status === 'saved').length;
    const fulfilledCount = filteredSelections.filter((r) => r.status === 'fulfilled').length;
    return { totalRecords, totalCoupons, savedCount, fulfilledCount };
  }, [filteredSelections]);

  const showNotice = (msg: string) => {
    setAdminNotice(msg);
    setTimeout(() => {
      setAdminNotice((curr) => (curr === msg ? null : curr));
    }, 4500);
  };

  const openEditSelection = (record: SelectionRecord) => {
    setEditingSelection(record);
    setEditSelName(record.userName);
    setEditSelMenuId(record.menuItemId);
    setEditSelCoupons(record.couponsRequired);
    setEditSelStatus(record.status);
    setAdminError(null);
  };

  const handleSaveEditedSelection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSelection || savingSelection) return;
    setSavingSelection(true);
    setAdminError(null);

    try {
      const matchedItem = menuItems.find((m) => m.id === editSelMenuId);
      const menuItemName = matchedItem ? matchedItem.name : editingSelection.menuItemName;
      await updateSelectionRecord(editingSelection.id, {
        userName: editSelName,
        menuItemId: editSelMenuId,
        menuItemName,
        couponsRequired: editSelCoupons,
        status: editSelStatus,
      });
      setEditingSelection(null);
      showNotice(`Updated selection for ${editSelName.trim()}.`);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Failed to update selection.');
    } finally {
      setSavingSelection(false);
    }
  };

  const handleDeleteSelection = async (id: string) => {
    try {
      await deleteSelectionRecord(id);
      setConfirmDeleteSelectionId(null);
      showNotice('Selection record deleted.');
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Failed to delete selection.');
    }
  };

  const openAddMenuModal = () => {
    setEditingMenuItem(null);
    setMenuForm({
      name: '',
      category: 'Food',
      description: '',
      couponCost: 2,
      iconKey: 'utensils',
      imageUrl: '',
      available: true,
    });
    setMenuModalOpen(true);
    setAdminError(null);
  };

  const openEditMenuModal = (item: MenuItem) => {
    setEditingMenuItem(item);
    setMenuForm({
      name: item.name,
      category: item.category,
      description: item.description,
      couponCost: item.couponCost,
      iconKey: item.iconKey,
      imageUrl: item.imageUrl,
      available: item.available,
    });
    setMenuModalOpen(true);
    setAdminError(null);
  };

  const handleSaveMenuModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingMenu) return;
    setSavingMenu(true);
    setAdminError(null);

    try {
      if (editingMenuItem) {
        await updateMenuItem(editingMenuItem.id, menuForm);
        showNotice(`Updated menu item "${menuForm.name.trim()}".`);
      } else {
        await createMenuItem(menuForm);
        showNotice(`Added new menu item "${menuForm.name.trim()}".`);
      }
      setMenuModalOpen(false);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Failed to save menu item.');
    } finally {
      setSavingMenu(false);
    }
  };

  const handleDeleteMenu = async (id: string) => {
    try {
      await deleteMenuItem(id);
      setConfirmDeleteMenuId(null);
      showNotice('Menu item removed.');
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Failed to delete menu item.');
    }
  };

  const handleRestoreDefaults = async () => {
    try {
      const existingIds = new Set(menuItems.map((m) => m.id));
      const missingCount = DEFAULT_MENU_ITEMS.filter((d) => !existingIds.has(d.id)).length;
      if (missingCount === 0) {
        showNotice('All default menu items are already present.');
        return;
      }
      await ensureDefaultMenuSeeded(new Set());
      showNotice(`Restored ${missingCount} default menu item(s).`);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Failed to restore defaults.');
    }
  };

  // Auth Gate
  if (authLoading) {
    return (
      <section className="max-w-3xl mx-auto py-16 px-4 text-center">
        <div className="bg-white border border-stone-200 rounded-2xl p-10 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-stone-100 mx-auto animate-pulse" />
          <p className="text-sm font-medium text-stone-600">Checking administrator access...</p>
        </div>
      </section>
    );
  }

  if (!user || !isAdmin) {
    return (
      <section className="max-w-xl mx-auto py-12 px-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-stone-900 font-display">
              Administrator Dashboard
            </h2>
            {!user ? (
              <p className="text-sm text-stone-600 leading-relaxed">
                Sign in with your administrator Google account ({PRIMARY_ADMIN_EMAIL}) to view all
                user selections, export records to CSV or Excel, and edit menu items.
              </p>
            ) : (
              <p className="text-sm text-stone-600 leading-relaxed">
                You are signed in as <span className="font-semibold text-stone-900">{user.email}</span>
                , which does not have administrator permissions. Please sign in with{' '}
                <span className="font-semibold text-stone-900">{PRIMARY_ADMIN_EMAIL}</span>.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {!user ? (
              <button
                type="button"
                onClick={() => void onSignIn()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-xl bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                Sign in with Google
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void onSignIn()}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Switch Google Account
                </button>
                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl border border-stone-300 text-stone-700 text-sm font-semibold hover:bg-stone-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  Sign Out
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Admin Header & Segmented View Switch */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-stone-500 mb-1">
            <span>Administrator Console</span>
            <span aria-hidden="true">·</span>
            <span>{user.email}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 font-display">
            Coupon Exchange Management
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center p-1 bg-stone-200/70 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('selections')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'selections'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Selections &amp; Records
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('menu')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'menu'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Manage Menu Items
            </button>
          </div>
        </div>
      </div>

      {adminNotice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-medium text-emerald-900"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>{adminNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setAdminNotice(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
            aria-label="Dismiss notice"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {adminError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm font-medium text-red-900"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
            <span>{adminError}</span>
          </div>
          <button
            type="button"
            onClick={() => setAdminError(null)}
            className="text-red-700 hover:text-red-950 p-1 cursor-pointer"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {activeTab === 'selections' ? (
        <div className="space-y-6">
          {/* 4-column Summary Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-stone-200 rounded-xl p-5">
              <p className="text-xs font-medium text-stone-500">Matching Selections</p>
              <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-stone-900">
                {metrics.totalRecords}
              </p>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl p-5">
              <p className="text-xs font-medium text-stone-500">Total Coupons Required</p>
              <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-orange-600">
                {metrics.totalCoupons}
              </p>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl p-5">
              <p className="text-xs font-medium text-stone-500">Saved / Pending</p>
              <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-stone-900">
                {metrics.savedCount}
              </p>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl p-5">
              <p className="text-xs font-medium text-stone-500">Fulfilled</p>
              <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-emerald-700">
                {metrics.fulfilledCount}
              </p>
            </div>
          </div>

          {/* Search, Filter & Export Toolbar */}
          <div className="bg-white border border-stone-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
              <div className="relative">
                <Search
                  className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  placeholder="Search by user name..."
                  aria-label="Search selections by user name"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/25 focus:border-orange-600"
                />
              </div>

              <select
                value={filterMenu}
                onChange={(e) => setFilterMenu(e.target.value)}
                aria-label="Filter by menu item"
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/25 focus:border-orange-600"
              >
                <option value="all">All Menu Items</option>
                {menuNamesForFilter.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                aria-label="Filter by status"
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/25 focus:border-orange-600"
              >
                <option value="all">All Statuses</option>
                <option value="saved">Saved</option>
                <option value="fulfilled">Fulfilled</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => exportSelectionsToCSV(filteredSelections)}
                disabled={filteredSelections.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-lg border border-stone-300 bg-white text-sm font-semibold text-stone-800 hover:bg-stone-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => exportSelectionsToExcel(filteredSelections)}
                disabled={filteredSelections.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-lg bg-stone-900 text-sm font-semibold text-white hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
                Export Excel
              </button>
            </div>
          </div>

          {/* Selections Data Table */}
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            {selectionsLoading ? (
              <div className="p-8 space-y-3">
                {[1, 2, 3, 4].map((row) => (
                  <div key={row} className="h-11 bg-stone-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filteredSelections.length === 0 ? (
              <div className="py-14 px-6 text-center space-y-2">
                <p className="text-base font-semibold text-stone-900">
                  {selections.length === 0
                    ? 'No coupon selections recorded yet'
                    : 'No selections match your current filters'}
                </p>
                <p className="text-sm text-stone-500">
                  {selections.length === 0
                    ? 'When students choose menu items and confirm their name, their records will appear here.'
                    : 'Try clearing the search query or selecting All Menu Items.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-stone-200 text-left">
                  <thead className="bg-stone-50">
                    <tr>
                      <th className="px-5 py-3.5 text-xs font-semibold text-stone-600">
                        User Name
                      </th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-stone-600">
                        Chosen Menu
                      </th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-stone-600 text-right">
                        Coupons
                      </th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-stone-600">Status</th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-stone-600">
                        Date &amp; Time
                      </th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-stone-600 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 text-sm">
                    {filteredSelections.map((rec) => (
                      <tr key={rec.id} className="hover:bg-stone-50/80 transition-colors">
                        <td className="px-5 py-3.5 font-semibold text-stone-900 whitespace-nowrap">
                          {rec.userName}
                        </td>
                        <td className="px-5 py-3.5 text-stone-700 whitespace-nowrap">
                          {rec.menuItemName}
                        </td>
                        <td className="px-5 py-3.5 font-mono tabular-nums font-semibold text-stone-900 text-right whitespace-nowrap">
                          {rec.couponsRequired}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {rec.status === 'fulfilled' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                              Fulfilled
                            </span>
                          ) : rec.status === 'cancelled' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                              <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                              Cancelled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                              Saved
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-stone-500 whitespace-nowrap">
                          {formatDateTime(rec.createdAt)}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          {confirmDeleteSelectionId === rec.id ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void handleDeleteSelection(rec.id)}
                                className="px-2.5 py-1 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700 cursor-pointer"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteSelectionId(null)}
                                className="px-2.5 py-1 rounded-md border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-100 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditSelection(rec)}
                                aria-label={`Edit selection for ${rec.userName}`}
                                className="p-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
                              >
                                <Pencil className="w-4 h-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteSelectionId(rec.id)}
                                aria-label={`Delete selection for ${rec.userName}`}
                                className="p-2 rounded-lg text-stone-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Manage Menu Items Tab */
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-stone-200 rounded-xl p-4">
            <div>
              <h2 className="text-base font-bold text-stone-900">Menu Catalog</h2>
              <p className="text-xs text-stone-500">
                Add new items, update coupon requirements, or pause availability in real time.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => void handleRestoreDefaults()}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-lg border border-stone-300 bg-white text-sm font-semibold text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                Restore Defaults
              </button>
              <button
                type="button"
                onClick={openAddMenuModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-lg bg-orange-600 text-sm font-semibold text-white hover:bg-orange-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Add Menu Item
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {menuItems.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-stone-200 rounded-xl overflow-hidden flex flex-col"
              >
                <MenuItemMedia
                  name={item.name}
                  category={item.category}
                  iconKey={item.iconKey}
                  imageUrl={item.imageUrl}
                  className="aspect-[4/3]"
                />
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-stone-500 mb-1">
                      <span>{item.category}</span>
                      <span
                        className={`font-semibold ${
                          item.available ? 'text-emerald-700' : 'text-stone-500'
                        }`}
                      >
                        {item.available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-stone-900">{item.name}</h3>
                    <p className="text-xs text-stone-600 mt-1 line-clamp-2">{item.description}</p>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-orange-700 tabular-nums">
                      {item.couponCost} {item.couponCost === 1 ? 'Coupon' : 'Coupons'}
                    </span>

                    {confirmDeleteMenuId === item.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleDeleteMenu(item.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 cursor-pointer"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteMenuId(null)}
                          className="px-2.5 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-100 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditMenuModal(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteMenuId(item.id)}
                          aria-label={`Delete ${item.name}`}
                          className="p-2 rounded-lg text-stone-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Selection Modal */}
      {editingSelection && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-selection-title"
        >
          <div className="w-full max-w-md bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
              <h3 id="edit-selection-title" className="text-lg font-bold text-stone-900 font-display">
                Edit Saved Selection
              </h3>
              <button
                type="button"
                onClick={() => setEditingSelection(null)}
                className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleSaveEditedSelection} className="p-6 space-y-4">
              <div>
                <label
                  htmlFor="edit-sel-user"
                  className="block text-sm font-semibold text-stone-800 mb-1"
                >
                  Full Name
                </label>
                <input
                  id="edit-sel-user"
                  type="text"
                  required
                  minLength={VALIDATION_LIMITS.USER_NAME_MIN}
                  maxLength={VALIDATION_LIMITS.USER_NAME_MAX}
                  value={editSelName}
                  onChange={(e) => setEditSelName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-600"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-sel-menu"
                  className="block text-sm font-semibold text-stone-800 mb-1"
                >
                  Menu Item
                </label>
                <select
                  id="edit-sel-menu"
                  value={editSelMenuId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setEditSelMenuId(nextId);
                    const found = menuItems.find((m) => m.id === nextId);
                    if (found) setEditSelCoupons(found.couponCost);
                  }}
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-600"
                >
                  {menuItems.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.couponCost} {m.couponCost === 1 ? 'Coupon' : 'Coupons'})
                    </option>
                  ))}
                  {!menuItems.some((m) => m.id === editSelMenuId) && (
                    <option value={editSelMenuId}>{editingSelection.menuItemName}</option>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="edit-sel-coupons"
                    className="block text-sm font-semibold text-stone-800 mb-1"
                  >
                    Coupons Required
                  </label>
                  <input
                    id="edit-sel-coupons"
                    type="number"
                    min={VALIDATION_LIMITS.COUPON_COST_MIN}
                    max={VALIDATION_LIMITS.COUPON_COST_MAX}
                    required
                    value={editSelCoupons}
                    onChange={(e) => setEditSelCoupons(Number(e.target.value) || 1)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-600"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-sel-status"
                    className="block text-sm font-semibold text-stone-800 mb-1"
                  >
                    Status
                  </label>
                  <select
                    id="edit-sel-status"
                    value={editSelStatus}
                    onChange={(e) => setEditSelStatus(e.target.value as SelectionStatus)}
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-600"
                  >
                    <option value="saved">Saved</option>
                    <option value="fulfilled">Fulfilled</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setEditingSelection(null)}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 text-sm font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSelection}
                  className="px-5 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 cursor-pointer disabled:opacity-50"
                >
                  {savingSelection ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Menu Item Modal */}
      {menuModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="menu-item-modal-title"
        >
          <div className="w-full max-w-lg bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 shrink-0">
              <h3
                id="menu-item-modal-title"
                className="text-lg font-bold text-stone-900 font-display"
              >
                {editingMenuItem ? 'Edit Menu Item' : 'Add New Menu Item'}
              </h3>
              <button
                type="button"
                onClick={() => setMenuModalOpen(false)}
                className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveMenuModal} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label
                  htmlFor="menu-name-input"
                  className="block text-sm font-semibold text-stone-800 mb-1"
                >
                  Menu Item Name
                </label>
                <input
                  id="menu-name-input"
                  type="text"
                  required
                  maxLength={VALIDATION_LIMITS.ITEM_NAME_MAX}
                  value={menuForm.name}
                  onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                  placeholder="e.g., Food Item C"
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="menu-category-select"
                    className="block text-sm font-semibold text-stone-800 mb-1"
                  >
                    Category
                  </label>
                  <select
                    id="menu-category-select"
                    value={menuForm.category}
                    onChange={(e) =>
                      setMenuForm({ ...menuForm, category: e.target.value as MenuCategory })
                    }
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-600"
                  >
                    {MENU_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="menu-coupons-input"
                    className="block text-sm font-semibold text-stone-800 mb-1"
                  >
                    Coupon Requirement
                  </label>
                  <input
                    id="menu-coupons-input"
                    type="number"
                    required
                    min={VALIDATION_LIMITS.COUPON_COST_MIN}
                    max={VALIDATION_LIMITS.COUPON_COST_MAX}
                    value={menuForm.couponCost}
                    onChange={(e) =>
                      setMenuForm({ ...menuForm, couponCost: Number(e.target.value) || 1 })
                    }
                    className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-600"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="menu-desc-input"
                  className="block text-sm font-semibold text-stone-800 mb-1"
                >
                  Short Description
                </label>
                <textarea
                  id="menu-desc-input"
                  required
                  rows={3}
                  maxLength={VALIDATION_LIMITS.DESCRIPTION_MAX}
                  value={menuForm.description}
                  onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                  placeholder="Describe the meal, drink, or combo..."
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="menu-icon-select"
                    className="block text-sm font-semibold text-stone-800 mb-1"
                  >
                    Icon Style
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-center shrink-0 text-stone-700">
                      <MenuIcon iconKey={menuForm.iconKey} className="w-5 h-5" />
                    </div>
                    <select
                      id="menu-icon-select"
                      value={menuForm.iconKey}
                      onChange={(e) =>
                        setMenuForm({ ...menuForm, iconKey: e.target.value as IconKey })
                      }
                      className="w-full px-3 py-2.5 text-sm border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-600"
                    >
                      {ICON_KEY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="menu-image-preset"
                    className="block text-sm font-semibold text-stone-800 mb-1"
                  >
                    Preset Photo
                  </label>
                  <select
                    id="menu-image-preset"
                    value={
                      PRESET_IMAGE_OPTIONS.some((p) => p.value === menuForm.imageUrl)
                        ? menuForm.imageUrl
                        : 'custom'
                    }
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        setMenuForm({ ...menuForm, imageUrl: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2.5 text-sm border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-600"
                  >
                    {PRESET_IMAGE_OPTIONS.map((opt) => (
                      <option key={opt.label} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                    {!PRESET_IMAGE_OPTIONS.some((p) => p.value === menuForm.imageUrl) && (
                      <option value="custom">Custom URL</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="menu-image-url"
                  className="block text-sm font-semibold text-stone-800 mb-1"
                >
                  Image URL (optional)
                </label>
                <input
                  id="menu-image-url"
                  type="text"
                  maxLength={VALIDATION_LIMITS.IMAGE_URL_MAX}
                  value={menuForm.imageUrl}
                  onChange={(e) => setMenuForm({ ...menuForm, imageUrl: e.target.value })}
                  placeholder="Leave empty for clean icon card, or paste URL"
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-600"
                />
              </div>

              <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={menuForm.available}
                  onChange={(e) => setMenuForm({ ...menuForm, available: e.target.checked })}
                  className="w-4 h-4 rounded accent-orange-600"
                />
                <span className="text-sm font-medium text-stone-800">
                  Available for students to choose
                </span>
              </label>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setMenuModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 text-sm font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMenu}
                  className="px-5 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 cursor-pointer disabled:opacity-50"
                >
                  {savingMenu
                    ? 'Saving...'
                    : editingMenuItem
                    ? 'Save Changes'
                    : 'Create Menu Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
