import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Ticket,
  X,
  XCircle,
} from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard';
import { MenuIcon } from './components/MenuIcon';
import { MenuItemMedia } from './components/MenuItemMedia';
import { SelectionModal } from './components/SelectionModal';
import { auth, googleProvider } from './firebase';
import {
  checkIsAdminUser,
  ensureDefaultMenuSeeded,
  fetchMySavedSelections,
  formatDateTime,
  subscribeMenuItems,
} from './services/couponService';
import { MENU_CATEGORIES, MenuCategory, MenuItem, SelectionRecord } from './types';

type AppView = 'storefront' | 'admin';

export default function App() {
  const [view, setView] = useState<AppView>('storefront');
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<'All' | MenuCategory>('All');
  const [menuSearch, setMenuSearch] = useState('');

  const [choosingItem, setChoosingItem] = useState<MenuItem | null>(null);
  const [successBanner, setSuccessBanner] = useState<{
    message: string;
    record: SelectionRecord;
  } | null>(null);

  const [savedHistory, setSavedHistory] = useState<SelectionRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        const adminFlag = await checkIsAdminUser(nextUser);
        setIsAdmin(adminFlag);
      } else {
        setIsAdmin(false);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Real-time Menu Subscription + automatic initial seeding
  useEffect(() => {
    setMenuLoading(true);
    let didAttemptSeed = false;

    const unsub = subscribeMenuItems(
      (items) => {
        setMenuItems(items);
        setMenuLoading(false);
        setMenuError(null);

        if (items.length === 0 && !didAttemptSeed) {
          didAttemptSeed = true;
          void ensureDefaultMenuSeeded(new Set());
        }
      },
      (err) => {
        setMenuError(err.message);
        setMenuLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const loadHistory = useCallback(async (currentUser: User | null) => {
    setHistoryLoading(true);
    try {
      const records = await fetchMySavedSelections(currentUser);
      setSavedHistory(records);
    } catch {
      // Errors are surfaced via handleFirestoreError if critical
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      void loadHistory(user);
    }
  }, [authLoading, user, loadHistory]);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Sign in failed.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError(msg);
      }
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);
    await signOut(auth);
  };

  const filteredMenuItems = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return menuItems.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }
      if (
        q &&
        !item.name.toLowerCase().includes(q) &&
        !item.description.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [menuItems, selectedCategory, menuSearch]);

  const handleSelectionSuccess = (record: SelectionRecord) => {
    setChoosingItem(null);
    setSuccessBanner({
      message: `Thank you, ${record.userName}! Your selection has been successfully saved.`,
      record,
    });
    setSavedHistory((prev) => [record, ...prev.filter((r) => r.id !== record.id)]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToSection = (sectionId: string) => {
    setView('storefront');
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 40);
  };

  const availableCount = useMemo(
    () => menuItems.filter((m) => m.available).length,
    [menuItems]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-stone-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-[#FAF9F6]/95 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => {
              setView('storefront');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-lg sm:text-xl font-bold tracking-tight text-stone-900 font-display whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
          >
            <span aria-hidden="true">🎟️</span>
            <span>COUPON EXCHANGE</span>
          </button>

          {/* Zone 2: Concise single-line navigation links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-600"
          >
            <button
              type="button"
              onClick={() => navigateToSection('menu-section')}
              className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer py-1 border-b-2 ${
                view === 'storefront'
                  ? 'text-stone-900 border-orange-600'
                  : 'border-transparent hover:text-stone-900'
              }`}
            >
              Menu
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('history-section')}
              className="whitespace-nowrap shrink-0 transition-colors cursor-pointer py-1 border-b-2 border-transparent hover:text-stone-900"
            >
              Saved History
            </button>
            <button
              type="button"
              onClick={() => {
                setView('admin');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer py-1 border-b-2 ${
                view === 'admin'
                  ? 'text-stone-900 border-orange-600'
                  : 'border-transparent hover:text-stone-900'
              }`}
            >
              Admin Dashboard
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="px-4 py-2 min-h-[40px] rounded-xl border border-stone-300 bg-white text-xs sm:text-sm font-semibold text-stone-800 hover:bg-stone-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Sign Out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setView('admin');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-4 py-2 min-h-[40px] rounded-xl bg-stone-900 text-xs sm:text-sm font-semibold text-white hover:bg-stone-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Admin Login
              </button>
            )}
          </div>
        </div>

        {/* Mobile Secondary Quick Nav Row (keeps header under mobile height budget) */}
        <div className="md:hidden border-t border-stone-200/80 px-4 py-2 flex items-center justify-around text-xs font-semibold text-stone-600">
          <button
            type="button"
            onClick={() => navigateToSection('menu-section')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${
              view === 'storefront' ? 'text-orange-700 bg-orange-50' : ''
            }`}
          >
            Menu
          </button>
          <button
            type="button"
            onClick={() => navigateToSection('history-section')}
            className="px-3 py-1.5 rounded-lg whitespace-nowrap"
          >
            Saved History
          </button>
          <button
            type="button"
            onClick={() => setView('admin')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${
              view === 'admin' ? 'text-orange-700 bg-orange-50' : ''
            }`}
          >
            Admin Dashboard
          </button>
        </div>
      </header>

      <main className="flex-1">
        {authError && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
            <div
              role="alert"
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800"
            >
              <span>{authError}</span>
              <button
                type="button"
                onClick={() => setAuthError(null)}
                className="p-1 text-red-700 hover:text-red-950 cursor-pointer"
                aria-label="Dismiss alert"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {view === 'admin' ? (
          <AdminDashboard
            user={user}
            isAdmin={isAdmin}
            authLoading={authLoading}
            menuItems={menuItems}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
          />
        ) : (
          <>
            {/* Success Confirmation Banner */}
            {successBanner && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                <div
                  role="status"
                  className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-emerald-950">
                        {successBanner.message}
                      </p>
                      <p className="text-xs sm:text-sm text-emerald-800 mt-1 flex flex-wrap items-center gap-2">
                        <span>{successBanner.record.menuItemName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums font-semibold">
                          {successBanner.record.couponsRequired}{' '}
                          {successBanner.record.couponsRequired === 1 ? 'Coupon' : 'Coupons'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {formatDateTime(successBanner.record.createdAt)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSuccessBanner(null)}
                    className="self-end sm:self-center px-3.5 py-2 rounded-lg text-xs font-semibold text-emerald-900 hover:bg-emerald-100 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Editorial Hero Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8 border-b border-stone-200">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                <div className="max-w-2xl space-y-3">
                  <p className="text-xs font-semibold text-orange-700 tracking-wide">
                    Student &amp; Campus Menu Redemption
                  </p>
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-stone-900 tracking-tight leading-[1.1] text-balance font-display">
                    Exchange your coupons for fresh meals, drinks &amp; treats.
                  </h1>
                  <p className="text-base text-stone-600 leading-relaxed max-w-xl">
                    Browse the available menu below, click Choose on your favorite item, enter your
                    full name, and save your exchange selection in seconds.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4 sm:gap-6 shrink-0 bg-white border border-stone-200 rounded-2xl p-5">
                  <div>
                    <p className="text-xs font-medium text-stone-500">Available Items</p>
                    <p className="mt-1 text-xl font-bold font-mono tabular-nums text-stone-900">
                      {availableCount}
                    </p>
                  </div>
                  <div className="border-l border-stone-200 pl-4 sm:pl-6">
                    <p className="text-xs font-medium text-stone-500">Starts At</p>
                    <p className="mt-1 text-xl font-bold font-mono tabular-nums text-orange-600">
                      1 Coupon
                    </p>
                  </div>
                  <div className="border-l border-stone-200 pl-4 sm:pl-6">
                    <p className="text-xs font-medium text-stone-500">Saved Here</p>
                    <p className="mt-1 text-xl font-bold font-mono tabular-nums text-stone-900">
                      {savedHistory.length}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Menu Catalog Section */}
            <section
              id="menu-section"
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-stone-900 font-display">
                    Available Exchange Menu
                  </h2>
                  <p className="text-sm text-stone-500 mt-0.5">
                    Select any available item to enter your name and reserve it with coupons.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {/* Category Segmented Tabs */}
                  <div
                    role="tablist"
                    aria-label="Filter menu by category"
                    className="inline-flex items-center p-1 bg-stone-200/70 rounded-xl overflow-x-auto"
                  >
                    {(['All', ...MENU_CATEGORIES] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        role="tab"
                        aria-selected={selectedCategory === cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          selectedCategory === cat
                            ? 'bg-white text-stone-900 shadow-xs'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Menu Search */}
                  <div className="relative min-w-[210px]">
                    <Search
                      className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={menuSearch}
                      onChange={(e) => setMenuSearch(e.target.value)}
                      placeholder="Search menu..."
                      aria-label="Search menu items"
                      className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/25 focus:border-orange-600"
                    />
                  </div>
                </div>
              </div>

              {menuError && (
                <div
                  role="alert"
                  className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800"
                >
                  Unable to load menu items right now: {menuError}
                </div>
              )}

              {menuLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div
                      key={n}
                      className="bg-white border border-stone-200 rounded-2xl overflow-hidden animate-pulse"
                    >
                      <div className="aspect-[4/3] bg-stone-200" />
                      <div className="p-6 space-y-3">
                        <div className="h-3 w-24 bg-stone-200 rounded" />
                        <div className="h-5 w-40 bg-stone-200 rounded" />
                        <div className="h-10 w-full bg-stone-100 rounded" />
                        <div className="h-11 w-full bg-stone-200 rounded-xl" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredMenuItems.length === 0 ? (
                <div className="bg-white border border-stone-200 rounded-2xl py-14 px-6 text-center space-y-2">
                  <p className="text-base font-semibold text-stone-900">
                    No menu items match your search
                  </p>
                  <p className="text-sm text-stone-500">
                    Try selecting All categories or clearing the search box.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredMenuItems.map((item) => (
                    <article
                      key={item.id}
                      className="group bg-white border border-stone-200 rounded-2xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <MenuItemMedia
                        name={item.name}
                        category={item.category}
                        iconKey={item.iconKey}
                        imageUrl={item.imageUrl}
                        className="aspect-[4/3]"
                      />

                      <div className="p-6 flex-1 flex flex-col justify-between gap-5">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 text-xs text-stone-500">
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              <MenuIcon iconKey={item.iconKey} className="w-3.5 h-3.5" />
                              {item.category}
                            </span>
                            <span
                              className={
                                item.available
                                  ? 'text-emerald-700 font-semibold'
                                  : 'text-stone-400 font-medium'
                              }
                            >
                              {item.available ? 'Available' : 'Unavailable'}
                            </span>
                          </div>

                          <h3 className="text-xl font-bold text-stone-900 font-display">
                            {item.name}
                          </h3>
                          <p className="text-sm text-stone-600 leading-relaxed">
                            {item.description}
                          </p>
                        </div>

                        <div className="pt-4 border-t border-stone-100 flex items-center justify-between gap-4">
                          <div>
                            <p className="text-[11px] font-medium text-stone-500">Requirement</p>
                            <p className="inline-flex items-center gap-1.5 font-mono text-base font-semibold text-stone-900 tabular-nums">
                              <Ticket className="w-4 h-4 text-orange-600" aria-hidden="true" />
                              {item.couponCost} {item.couponCost === 1 ? 'Coupon' : 'Coupons'}
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={!item.available}
                            onClick={() => setChoosingItem(item)}
                            className="px-6 py-2.5 min-h-[44px] rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 transition-colors cursor-pointer disabled:bg-stone-200 disabled:text-stone-500 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                          >
                            {item.available ? 'Choose' : 'Unavailable'}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* Saved Selection History Section */}
            <section
              id="history-section"
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 pt-6"
            >
              <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
                <div className="px-6 py-5 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-stone-900 font-display">
                      Saved Selection History
                    </h2>
                    <p className="text-sm text-stone-500 mt-0.5">
                      Your saved selections remain stored in the database even after refreshing or
                      closing your browser.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadHistory(user)}
                    className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    Refresh History
                  </button>
                </div>

                {historyLoading ? (
                  <div className="p-6 space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-12 bg-stone-100 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : savedHistory.length === 0 ? (
                  <div className="py-12 px-6 text-center space-y-2">
                    <p className="text-sm font-semibold text-stone-800">
                      No saved selections on this browser yet
                    </p>
                    <p className="text-xs text-stone-500">
                      Click Choose on any menu item above to submit your name and save your first
                      coupon exchange.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-stone-200 text-left">
                      <thead className="bg-stone-50">
                        <tr>
                          <th className="px-6 py-3 text-xs font-semibold text-stone-600">Name</th>
                          <th className="px-6 py-3 text-xs font-semibold text-stone-600">
                            Chosen Menu
                          </th>
                          <th className="px-6 py-3 text-xs font-semibold text-stone-600 text-right">
                            Coupons
                          </th>
                          <th className="px-6 py-3 text-xs font-semibold text-stone-600">Status</th>
                          <th className="px-6 py-3 text-xs font-semibold text-stone-600">
                            Date &amp; Time
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200 text-sm">
                        {savedHistory.map((rec) => (
                          <tr key={rec.id} className="hover:bg-stone-50/70 transition-colors">
                            <td className="px-6 py-3.5 font-semibold text-stone-900 whitespace-nowrap">
                              {rec.userName}
                            </td>
                            <td className="px-6 py-3.5 text-stone-700 whitespace-nowrap">
                              {rec.menuItemName}
                            </td>
                            <td className="px-6 py-3.5 font-mono tabular-nums font-semibold text-stone-900 text-right whitespace-nowrap">
                              {rec.couponsRequired}
                            </td>
                            <td className="px-6 py-3.5 whitespace-nowrap">
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
                            <td className="px-6 py-3.5 font-mono text-xs tabular-nums text-stone-500 whitespace-nowrap">
                              {formatDateTime(rec.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <p className="font-medium text-stone-700">COUPON EXCHANGE · Campus Menu &amp; Redemption</p>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => navigateToSection('menu-section')}
              className="hover:text-stone-900 transition-colors cursor-pointer"
            >
              Browse Menu
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('history-section')}
              className="hover:text-stone-900 transition-colors cursor-pointer"
            >
              Saved History
            </button>
            <button
              type="button"
              onClick={() => {
                setView('admin');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-stone-900 transition-colors cursor-pointer"
            >
              Admin Dashboard
            </button>
          </div>
        </div>
      </footer>

      <SelectionModal
        item={choosingItem}
        user={user}
        onClose={() => setChoosingItem(null)}
        onSuccess={handleSelectionSuccess}
      />
    </div>
  );
}
