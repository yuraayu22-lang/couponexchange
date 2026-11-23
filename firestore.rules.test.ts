/**
 * Security rules verification suite for COUPON EXCHANGE.
 * Verifies all "Dirty Dozen" adversarial payloads are rejected with PERMISSION_DENIED.
 * Intended to be run against the Firebase Emulator Suite (@firebase/rules-unit-testing).
 */

export const DIRTY_DOZEN_CASES = [
  {
    name: '1. Unverified admin email spoof cannot list selections',
    operation: 'LIST /selections',
    auth: { uid: 'spoof-1', email: 'yuraayu22@gmail.com', email_verified: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Coupon cost tampering on selection creation',
    operation: 'CREATE /selections/sel_12345678901234567890',
    payload: {
      userName: 'Alice Student',
      menuItemId: 'special-item',
      menuItemName: 'Special Item',
      couponsRequired: 1, // Actual cost is 5
      status: 'saved',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Selecting an unavailable menu item',
    operation: 'CREATE /selections/sel_12345678901234567891',
    payload: {
      userName: 'Bob Student',
      menuItemId: 'unavailable-item',
      menuItemName: 'Sold Out Item',
      couponsRequired: 2,
      status: 'saved',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Orphaned menuItemId reference',
    operation: 'CREATE /selections/sel_12345678901234567892',
    payload: {
      userName: 'Charlie Student',
      menuItemId: 'nonexistent-item',
      menuItemName: 'Ghost Item',
      couponsRequired: 1,
      status: 'saved',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Menu item name spoofing',
    operation: 'CREATE /selections/sel_12345678901234567893',
    payload: {
      userName: 'Dana Student',
      menuItemId: 'drink-item-a',
      menuItemName: 'Special Item', // Mismatch with Drink Item A
      couponsRequired: 1,
      status: 'saved',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Shadow field injection on selection create',
    operation: 'CREATE /selections/sel_12345678901234567894',
    payload: {
      userName: 'Eve Student',
      menuItemId: 'drink-item-a',
      menuItemName: 'Drink Item A',
      couponsRequired: 1,
      status: 'saved',
      isAdminVerified: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Status shortcutting to fulfilled on create',
    operation: 'CREATE /selections/sel_12345678901234567895',
    payload: {
      userName: 'Frank Student',
      menuItemId: 'drink-item-a',
      menuItemName: 'Drink Item A',
      couponsRequired: 1,
      status: 'fulfilled',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. UID spoofing on selection create',
    operation: 'CREATE /selections/sel_12345678901234567896',
    auth: { uid: 'attacker-uid', email: 'attacker@example.com', email_verified: true },
    payload: {
      userName: 'Grace Student',
      menuItemId: 'drink-item-a',
      menuItemName: 'Drink Item A',
      couponsRequired: 1,
      status: 'saved',
      submittedByUid: 'victim-uid',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Backdated timestamp injection',
    operation: 'CREATE /selections/sel_12345678901234567897',
    payload: {
      userName: 'Hank Student',
      menuItemId: 'drink-item-a',
      menuItemName: 'Drink Item A',
      couponsRequired: 1,
      status: 'saved',
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-01T00:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Unauthenticated list scraping of selections',
    operation: 'LIST /selections',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. ID poisoning with oversized document ID',
    operation: 'CREATE /selections/' + 'a'.repeat(200),
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Self-promotion to /admins collection',
    operation: 'CREATE /admins/attacker-uid',
    auth: { uid: 'attacker-uid', email: 'attacker@example.com', email_verified: true },
    payload: { email: 'attacker@example.com' },
    expected: 'PERMISSION_DENIED',
  },
] as const;
