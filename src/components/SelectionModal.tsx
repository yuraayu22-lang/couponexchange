import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { AlertCircle, CheckCircle2, Loader2, Ticket, X } from 'lucide-react';
import { submitSelection } from '../services/couponService';
import { MenuItem, SelectionRecord, VALIDATION_LIMITS } from '../types';
import { MenuItemMedia } from './MenuItemMedia';

interface SelectionModalProps {
  item: MenuItem | null;
  user: User | null;
  onClose: () => void;
  onSuccess: (record: SelectionRecord) => void;
}

export function SelectionModal({ item, user, onClose, onSuccess }: SelectionModalProps) {
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (item) {
      setFullName(user?.displayName ?? '');
      setErrorMessage(null);
      setDuplicateWarning(null);
      setSubmitting(false);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [item, user]);

  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, submitting, onClose]);

  if (!item) return null;

  const trimmedName = fullName.trim();
  const isNameValid =
    trimmedName.length >= VALIDATION_LIMITS.USER_NAME_MIN &&
    trimmedName.length <= VALIDATION_LIMITS.USER_NAME_MAX;

  const handleSave = async (allowDuplicateOverride = false) => {
    if (submitting) return;
    setErrorMessage(null);

    if (!isNameValid) {
      setErrorMessage(
        `Please enter your full name (${VALIDATION_LIMITS.USER_NAME_MIN}–${VALIDATION_LIMITS.USER_NAME_MAX} characters).`
      );
      inputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const savedRecord = await submitSelection({
        userName: trimmedName,
        menuItem: item,
        user,
        allowDuplicateOverride,
      });
      setDuplicateWarning(null);
      onSuccess(savedRecord);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Unable to save selection.';
      if (rawMessage.startsWith('DUPLICATE_GUARD:')) {
        setDuplicateWarning(rawMessage.replace('DUPLICATE_GUARD:', '').trim());
      } else {
        let friendly = rawMessage;
        try {
          const parsed = JSON.parse(rawMessage) as { error?: string };
          if (parsed.error) {
            friendly = `Could not save selection: ${parsed.error}`;
          }
        } catch {
          // Use raw message
        }
        setErrorMessage(friendly);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSave(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="selection-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <div>
            <p className="text-xs font-medium text-stone-500">Confirm Coupon Selection</p>
            <h2
              id="selection-modal-title"
              className="text-lg font-bold text-stone-900 font-display"
            >
              Complete Your Order
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close selection form"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="p-6 space-y-5">
          {/* Selected Item Summary */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-stone-50 border border-stone-200/80">
            <div className="w-24 shrink-0 rounded-lg overflow-hidden border border-stone-200">
              <MenuItemMedia
                name={item.name}
                category={item.category}
                iconKey={item.iconKey}
                imageUrl={item.imageUrl}
                className="aspect-[4/3]"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-stone-500 mb-0.5">
                <span>{item.category}</span>
                <span aria-hidden="true">·</span>
                <span>Selected Item</span>
              </div>
              <h3 className="text-base font-bold text-stone-900 truncate">{item.name}</h3>
              <p className="text-xs text-stone-600 line-clamp-2 mt-0.5">{item.description}</p>
            </div>
          </div>

          {/* Coupon Requirement Summary */}
          <div className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-orange-50/70 border border-orange-200/80">
            <div className="flex items-center gap-2.5 text-sm font-medium text-stone-800">
              <Ticket className="w-5 h-5 text-orange-600 shrink-0" aria-hidden="true" />
              <span>Coupons Required</span>
            </div>
            <span className="font-mono text-base font-semibold text-orange-700 tabular-nums">
              {item.couponCost} {item.couponCost === 1 ? 'Coupon' : 'Coupons'}
            </span>
          </div>

          {/* Full Name Field */}
          <div className="space-y-1.5">
            <label
              htmlFor="selection-full-name"
              className="block text-sm font-semibold text-stone-800"
            >
              Full Name
            </label>
            <input
              ref={inputRef}
              id="selection-full-name"
              type="text"
              required
              minLength={VALIDATION_LIMITS.USER_NAME_MIN}
              maxLength={VALIDATION_LIMITS.USER_NAME_MAX}
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errorMessage) setErrorMessage(null);
                if (duplicateWarning) setDuplicateWarning(null);
              }}
              placeholder="e.g., John Carter"
              className="w-full px-4 py-3 text-sm bg-white border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-600 transition-colors"
            />
            <p className="text-xs text-stone-500">
              Enter your name so we can record your coupon exchange accurately.
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          {duplicateWarning && (
            <div
              role="status"
              className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900 space-y-2.5"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle
                  className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>
                  {duplicateWarning} To prevent accidental duplicates, please confirm if you want
                  to submit another order.
                </span>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleSave(true)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  Confirm Another Order
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 min-h-[44px] rounded-xl border border-stone-300 text-sm font-semibold text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !isNameValid}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 min-h-[44px] rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  Confirm &amp; Save
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
