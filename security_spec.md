# COUPON EXCHANGE — Security Specification

## 1. Data Invariants
1. **Menu Item Integrity**: A `MenuItem` document must have a non-empty `name` (1..80 chars), valid `category` (`Food`, `Drink`, `Snack`, `Special`), `description` (1..280 chars), integer `couponCost` between `1` and `100`, valid `iconKey`, `imageUrl` (`<= 500` chars), boolean `available`, and server-enforced `createdAt`/`updatedAt` timestamps.
2. **Selection Referential & Price Integrity**: A `Selection` cannot be created unless the referenced `menuItemId` exists in `/menu_items/{menuItemId}`, is currently `available == true`, and the submitted `menuItemName` and `couponsRequired` strictly match the authoritative `MenuItem` document in Firestore.
3. **Selection Initial State**: Newly created selections must start in `status == 'saved'`, cannot backdate `createdAt`/`updatedAt` (`== request.time`), and cannot spoof `submittedByUid` (`submittedByUid == request.auth.uid` if present).
4. **Immutable Core Fields**: On update of a `Selection`, `createdAt` and `submittedByUid` remain immutable; non-admin updates are disallowed, and admin updates must still pass `isValidSelection` and update `updatedAt == request.time`.
5. **Admin Privilege Boundary**: Admin privileges require `request.auth != null` and either verified primary admin email (`request.auth.token.email == 'yuraayu22@gmail.com' && request.auth.token.email_verified == true`) or membership in `/admins/$(request.auth.uid)`. Client-supplied role fields or unverified email claims are rejected.
6. **Query & List Isolation**: Unauthenticated users cannot `list` `/selections`; only admins can list all selections, and signed-in users can only list their own selections (`submittedByUid == request.auth.uid`). Unauthenticated users can only `get` an individual selection by its unguessable random ID (`>= 20` chars).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unverified Admin Email Spoof**: Request with `auth.token.email == 'yuraayu22@gmail.com'` and `email_verified == false` attempting to list `/selections` or edit `/menu_items`. -> `PERMISSION_DENIED`.
2. **Coupon Cost Tampering**: Unauthenticated user submitting a `Selection` for `special-item` (5 coupons) with `couponsRequired: 1`. -> `PERMISSION_DENIED`.
3. **Unavailable Item Selection**: Submitting a `Selection` referencing a `MenuItem` with `available: false`. -> `PERMISSION_DENIED`.
4. **Orphaned Menu Item Reference**: Submitting a `Selection` with a non-existent `menuItemId: "fake-item-999"`. -> `PERMISSION_DENIED`.
5. **Menu Name Spoofing**: Submitting a `Selection` referencing `drink-item-a` with `menuItemName: "Special Item"`. -> `PERMISSION_DENIED`.
6. **Shadow / Ghost Field Injection**: Creating a `Selection` with an extra field `{ isApproved: true }` or `adminOverride: true`. -> `PERMISSION_DENIED`.
7. **Status Shortcutting on Create**: Creating a `Selection` directly with `status: "fulfilled"`. -> `PERMISSION_DENIED`.
8. **UID Spoofing on Create**: Signed-in user A creating a `Selection` with `submittedByUid: "user_B"`. -> `PERMISSION_DENIED`.
9. **Backdated Timestamp Injection**: Creating a `Selection` with `createdAt` set to a client-chosen past timestamp instead of `request.time`. -> `PERMISSION_DENIED`.
10. **Blanket List Scraping**: Unauthenticated user or non-admin user executing a collection `list` query on `/selections` without `submittedByUid == auth.uid`. -> `PERMISSION_DENIED`.
11. **ID Poisoning / Resource Exhaustion**: Writing a `MenuItem` or `Selection` with a 1500-char document ID or invalid characters (`../etc/passwd`). -> `PERMISSION_DENIED`.
12. **Self-Promotion to Admin**: Authenticated non-admin user writing a document to `/admins/{theirUid}`. -> `PERMISSION_DENIED`.
