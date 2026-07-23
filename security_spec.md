# Security Spec - Quality Logistics Firestore Rules (TDD)

## 1. Data Invariants
- **Identity Invariant**: Users can only read and write data that belongs to their assigned tenant (`tenantId`).
- **Administrative Isolation**: Only global admins or authenticated administrative users can alter tenant properties or elevate a user's role. Users cannot elevate their own roles (`role` or `isGlobalAdmin`).
- **Temporal Invariant**: The `createdAt` property of any resource must be immutable once written, and `updatedAt` must always be verified during changes.
- **Reference Integrity**: A Warehouse Receipt or Bill of Lading must reference valid shippers and consignees.
- **Size and Type Bounds**: Strict size restrictions apply on IDs, strings, and lists to prevent resource-exhaustion attacks.

---

## 2. The "Dirty Dozen" Payloads
The following payloads are designed to attack the system rules. All must result in `PERMISSION_DENIED`.

### Payload 1: Privilege Escalation (Self-Admin Role Setting)
*Target Collection*: `/users/{userId}` (Create / Update)
*Attack*: Attacker tries to make themselves an admin or global admin.
```json
{
  "uid": "attacker_id",
  "email": "attacker@gmail.com",
  "role": "admin",
  "name": "Attacker",
  "tenantId": "t-1",
  "isGlobalAdmin": true
}
```

### Payload 2: Cross-Tenant Data Leakage (Reading other tenant's receipt)
*Target Collection*: `/receipts/{receiptId}` (Get)
*Attack*: Attacker authenticated with `tenantId: "t-1"` tries to access a receipt with `tenantId: "t-2"`.
```json
{
  "id": "wr-foreign",
  "number": "WR-200",
  "shipperId": "s-1",
  "consigneeId": "c-1",
  "tenantId": "t-2"
}
```

### Payload 3: Poisoning Shipper ID with Giant Strings (DoS / Wallet Exhaustion)
*Target Collection*: `/shippers/{shipperId}` (Create)
*Attack*: Attacker tries to insert a giant string or malformed characters into shipperId.
```json
{
  "id": "s_very_long_garbage_id_repeating_1000_times_...",
  "tenantId": "t-1",
  "name": "Giant ID Corp",
  "createdAt": "2026-07-13T12:00:00.000Z"
}
```

### Payload 4: Arbitrary ID Injection / Path Poisoning
*Target Collection*: `/receipts/{receiptId}` (Create)
*Attack*: Injecting unsafe characters (e.g., slash, backslash, semicolon) in path variables.
```json
{
  "id": "receipts/unsafe/path",
  "tenantId": "t-1",
  "number": "WR-9999",
  "shipperId": "s-1",
  "consigneeId": "c-1"
}
```

### Payload 5: Immutability Violation (Modifying createdAt)
*Target Collection*: `/receipts/{receiptId}` (Update)
*Attack*: User attempts to change `createdAt` of an existing cargo receipt.
```json
{
  "id": "wr-1",
  "number": "WR-11986",
  "createdAt": "1999-01-01T00:00:00.000Z"
}
```

### Payload 6: Shadow Fields Attack
*Target Collection*: `/shippers/{shipperId}` (Create)
*Attack*: Injecting an unmapped field to bypass strict schema checks.
```json
{
  "id": "s-100",
  "tenantId": "t-1",
  "name": "Malicious Shipper",
  "createdAt": "2026-07-13T12:00:00.000Z",
  "shadow_payment_verified": true
}
```

### Payload 7: Self-Tenant Modification (Lockout Escape)
*Target Collection*: `/users/{userId}` (Update)
*Attack*: Changing own `tenantId` to another active tenant.
```json
{
  "uid": "u-user",
  "tenantId": "t-2"
}
```

### Payload 8: Malformed Array Attack (Unbounded List Injection)
*Target Collection*: `/receipts/{receiptId}` (Create)
*Attack*: Injecting a massive array with 10,000 blank handling items.
```json
{
  "id": "wr-massive",
  "number": "WR-123",
  "tenantId": "t-1",
  "handling": ["item1", "item2", "...", "10k times"]
}
```

### Payload 9: Invalid String Value Type Injection (Type Spoofing)
*Target Collection*: `/receipts/{receiptId}` (Create)
*Attack*: Passing integer or boolean to a field expected to be string (e.g. shipperName).
```json
{
  "id": "wr-spoof",
  "number": "WR-124",
  "shipperName": true,
  "tenantId": "t-1"
}
```

### Payload 10: Blank Token / Unverified Email Bypass
*Target Collection*: `/receipts/{receiptId}` (Create)
*Attack*: Attempt to write using an email that is not verified or unauthenticated.
```json
{
  "id": "wr-unverified",
  "tenantId": "t-1",
  "number": "WR-125",
  "shipperId": "s-1",
  "consigneeId": "c-1"
}
```

### Payload 11: Cross-Tenant Bill of Lading Creation
*Target Collection*: `/billsOfLading/{billId}` (Create)
*Attack*: User belongs to `t-1` but attempts to create a Bill of Lading with `tenantId: "t-2"`.
```json
{
  "id": "bl-cross",
  "tenantId": "t-2",
  "blNumber": "BL-9999",
  "documentNumber": "DOC-9999"
}
```

### Payload 12: Invalid UUID / Identifier Formatting
*Target Collection*: `/receipts/{receiptId}` (Create)
*Attack*: Using whitespace, symbols, or excessive characters in identifier fields.
```json
{
  "id": "wr-!!!!$$$$",
  "tenantId": "t-1"
}
```

---

## 3. The Test Suite Configuration
A programmatic test suite verifying the above targets:

```typescript
// firestore.rules.test.ts (Draft Spec)
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";

describe("Quality Logistics Security Rules Testing", () => {
  it("denies role-escalation payloads", async () => {
    // Assert all 12 dirty dozen payloads fail
  });
});
```
