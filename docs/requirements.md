# Requirements — Customizable Coffee Shop (Staff POS)

This document records **what** the system must do, as agreed in the requirements interview. **How** it is built (class diagram, DB schema, API contract, repo layout) and the mapping of the brief's deliverables belong in `docs/design.md`.

Where this document goes beyond the brief (auth, payment, VAT, discounts, i18n), the reason is to make the system resemble a real point-of-sale (POS), while keeping the brief's scope as the core.

---

## 1. Scope at a glance

| In scope | Out of scope (the README links to the full list, §19) |
|---|---|
| Staff-operated POS: staff build drinks for the customer at the counter | Customer self-ordering (kiosk / table QR), customer accounts, CRM, ERP |
| Menu with prices stored in the database | Admin UI for menu and discount presets |
| Drink builder: base + size + add-ons, itemized description, price | Offline mode |
| Orders with order number, timestamp, items, staff who took them; order list with filters over the last 7 days | Text search, history beyond 7 days, sales reports, barista screen |
| Username/password login (JWT) | Roles, refresh tokens, password change, user management UI, login rate limiting, OTP login |
| Payment by mock QR and by cash | Real payment provider, card, refunds, split/partial payment |
| Void unpaid orders | Voiding paid orders (requires refunds) |
| Order-level discount presets with fixed values and a minimum spend | Staff-entered discount values, free (฿0.00) orders, coupons, automatic discounts, per-drink discounts, stacked discounts, Buy X Get Y (see §13.3) |
| VAT-inclusive pricing with VAT breakdown on receipt | Tax invoices, shop tax ID, service charge |
| English and Thai UI | A third language |
| Receipt print via browser | Thermal printer integration |

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Base** | The drink itself. Exactly one per drink (e.g. Coffee, Tea, Latte; full list in §4.1). |
| **Size** | Exactly one per drink (Small, Medium, Large). Adds a fixed surcharge. |
| **Add-on** | Anything added to a base. Three categories: **Extra**, **Syrup**, **Topping**. May repeat. |
| **Drink** | One base + one size + zero or more add-ons. |
| **Cart line** | One drink recipe + a quantity of cups. |
| **Order** | One or more cart lines placed together, identified by an order number. |
| **Subtotal** | Sum of all cart line totals, before discount. |
| **Discount preset** | A predefined discount (reason + value) chosen from a dropdown. |
| **Grand total** | Subtotal − discount. What the customer pays. VAT-inclusive. |
| **Before VAT / VAT** | The grand total split into its net and VAT parts for display. |
| **Payment transaction** | One attempt to settle an order (QR, cash, or none). |
| **Void** | Cancelling an unpaid order. The order is kept, never deleted. |
| **Menu code** | Human-readable, immutable identifier of a menu item, e.g. `VANILLA`. |

---

## 3. Money

- **Currency:** THB only. Currency is configuration, not stored per row.
- **Storage:** exactly **2 decimal places** (`50.00`). Stored values are the rounded values printed on the receipt, so database totals always reconcile with receipts.
- **Calculation:** all arithmetic happens in a single `Money` type that works in whole satang internally. No code adds decimal numbers directly. Intermediate results keep full precision and are rounded once.
- **Rounding rule (system-wide, one function):** round half-up to 2 decimals, matching the Revenue Department rule for VAT: look at the 3rd decimal; 0–4 rounds down, 5–9 rounds up one satang.
- **API:** amounts are exchanged as decimal strings, e.g. `"50.00"`.
- **Field names** carry no unit suffix: `price`, `amount`, `subtotal`, `discountAmount`, `total`, `vat`, `beforeVat`, `cashReceived`, `change`.
- **Display:** `฿50.00`.

---

## 4. Menu

Menu items live in the database (`menu_items`). Adding an item to an existing category is **one row insert, no code change**. Adding a new *category* requires one code change (its display position).

Each menu item has an immutable `id` (UUID), an immutable semantic `code`, `nameEn`, `nameTh` (editable), `category`, `price`, `isActive`, `sortOrder`. Inactive items are hidden from the menu and rejected in orders.

Menu prices change only **after the shop closes** (operating practice). Even if a price changes mid-day, the backend price is the source of truth: the order is created as `PENDING_PAYMENT` and the payment screen shows the server-computed total before any money is taken.

### 4.1 Seed menu (prices VAT-inclusive)

Row order within each category is the seed `sortOrder`.

| Category | Code | Name (EN) | Name (TH) | Price |
|---|---|---|---|---|
| BASE | `COFFEE` | Coffee | กาแฟ | ฿50.00 |
| BASE | `TEA` | Tea | ชา | ฿40.00 |
| BASE | `MILK` | Milk | นม | ฿35.00 |
| BASE | `LATTE` | Latte ¹ | ลาเต้ | ฿60.00 |
| BASE | `AMERICANO` | Americano ¹ | อเมริกาโน่ | ฿55.00 |
| BASE | `ESPRESSO` | Espresso ¹ | เอสเปรสโซ่ | ฿45.00 |
| BASE | `CAPPUCCINO` | Cappuccino ¹ | คาปูชิโน่ | ฿60.00 |
| BASE | `MOCHA` | Mocha ¹ | มอคค่า | ฿65.00 |
| BASE | `THAI_TEA` | Thai Tea ¹ | ชาไทย | ฿45.00 |
| BASE | `LEMON_TEA` | Lemon Tea ¹ | ชามะนาว | ฿40.00 |
| BASE | `MATCHA_LATTE` | Matcha Latte ¹ | มัทฉะลาเต้ | ฿65.00 |
| BASE | `COCOA` | Cocoa ¹ | โกโก้ | ฿45.00 |
| SIZE | `SIZE_SMALL` | Small | แก้วเล็ก | +฿0.00 |
| SIZE | `SIZE_MEDIUM` | Medium | แก้วกลาง | +฿15.00 |
| SIZE | `SIZE_LARGE` | Large | แก้วใหญ่ | +฿30.00 |
| EXTRA | `EXTRA_COFFEE_SHOT` | Extra Coffee Shot ¹ | เพิ่มช็อตกาแฟ | ฿20.00 |
| EXTRA | `EXTRA_MILK` | Extra Milk ¹ | เพิ่มนม | ฿10.00 |
| SYRUP | `VANILLA` | Vanilla | วานิลลา | ฿10.00 |
| SYRUP | `CARAMEL` | Caramel | คาราเมล | ฿10.00 |
| SYRUP | `CHOCOLATE` | Chocolate | ช็อกโกแลต | ฿10.00 |
| TOPPING | `WHIPPED_CREAM` | Whipped Cream | วิปครีม | ฿15.00 |
| TOPPING | `CINNAMON` | Cinnamon | อบเชย | ฿5.00 |
| TOPPING | `MARSHMALLOWS` | Marshmallows | มาร์ชเมลโลว์ | ฿10.00 |

¹ Not in the brief. Seeded to demonstrate extensibility: Latte is a base, not Coffee + Milk (a drink has exactly one base); extras reuse the same add-on mechanism with no new classes. Americano … Cocoa added in migration 0006 to fill the menu grid; each is one row, no code change.

### 4.2 Pricing rule

```
drink price  = base price + size surcharge + Σ (add-on price × times added)
line total   = drink price × quantity
```

Every repetition of an add-on is charged in full (no multi-add discount). How size affects price is one replaceable pricing rule (see §13.1).

---

## 5. Drink description

Format: `<Size> <Base>`, then add-ons grouped **Extra → Syrup → Topping**. Within a group, items follow the menu **`sortOrder`**, not the order staff clicked them. Repeats are collapsed as `Nx Name`; a single item has no count.

The same recipe therefore always produces the same description, whatever the click order. The order snapshot stores each add-on's resulting `position`, so a later `sortOrder` change never reorders old receipts.

| Built as (in click order) | Description (EN) | Price |
|---|---|---|
| Large Coffee + Vanilla + Vanilla + Whipped Cream | `Large Coffee, 2x Vanilla, Whipped Cream` | ฿115.00 |
| Large Coffee + Cinnamon + Vanilla + Whipped Cream + Vanilla | `Large Coffee, 2x Vanilla, Whipped Cream, Cinnamon` | ฿120.00 |
| Large Coffee + Caramel + Vanilla | `Large Coffee, Vanilla, Caramel` | ฿100.00 |
| Large Latte + Vanilla + Whipped Cream + Extra Coffee Shot + Vanilla | `Large Latte, Extra Coffee Shot, 2x Vanilla, Whipped Cream` | ฿145.00 |
| Small Tea | `Small Tea` | ฿40.00 |

> **Deliberate deviation from the brief:** the brief's example reads `"Large Coffee, Vanilla, Vanilla, Whipped Cream"`. We collapse repeats (`2x Vanilla`) because it is faster for staff and customers to read. The README must call this out.

**Thai description:** `<Base> <Size>` (Thai word order), same grouping, and the **same `Nx` prefix** as English — `กาแฟ แก้วใหญ่, 2x วานิลลา, วิปครีม`. Only the base/size word order differs by language; the count format is shared, matching the `2 × Medium Tea` quantity prefix on receipts.

---

## 6. Validation

The backend is authoritative. The frontend applies the same rules for UX: a drink that breaks a rule **cannot be added to the cart**.

| # | Rule | Error code |
|---|---|---|
| V1 | Exactly one base per drink | `BASE_REQUIRED` |
| V2 | Exactly one size per drink | `SIZE_REQUIRED` |
| V3 | Every item must exist in the menu and be active | `MENU_ITEM_UNAVAILABLE` |
| V4 | 0–10 add-ons per drink (all categories counted). UI shows a remark under the add-on section, e.g. "Up to 10 add-ons per drink". | `ADDON_LIMIT_EXCEEDED` |
| V5 | The same add-on at most 5 times per drink. UI shows a remark, e.g. "Each add-on up to 5 times". | `ADDON_REPEAT_LIMIT_EXCEEDED` |
| V6 | 1–20 cups per order (sum of quantities, not lines). Over 20, the message suggests splitting into several orders. | `ORDER_EMPTY`, `ORDER_CUP_LIMIT_EXCEEDED` |
| V7 | If any drink in an order is invalid, the whole order is rejected (HTTP 400) with which drink broke which rule. | — |

Limits (10, 5, 20) are configuration values defined in one place. The brief says "any number" of add-ons; limits exist to guard against abnormal input.

The client sends only selections (codes and quantities), **never prices**.

---

## 7. Cart

- Each cart line = one recipe + quantity. Adding a recipe identical to an existing line (same base, same size, same add-ons with the same counts — click order is irrelevant, see §5) increments that line's quantity instead of creating a new line.
- Lines can be edited, removed, and their quantity changed.
- The frontend shows a live price computed from `GET /menu` for display only. The backend recomputes everything when the order is placed; its total is the one shown on the payment screen (see §4).
- One discount may be applied in the cart (see §9). If cart changes push the subtotal below the discount's minimum spend, the discount is removed automatically with a notice.
- The cart is kept in localStorage, so it survives a page reload or a re-login after the JWT expires.

---

## 8. VAT

- Menu prices are **VAT-inclusive** (set by another department). The customer pays the menu price; nothing is added.
- VAT is extracted **once per order**, after discount:
  ```
  vat       = roundHalfUp(grandTotal × 7 / 107)
  beforeVat = grandTotal − vat
  ```
- The VAT rate is configuration (`VAT_RATE_BPS=700`, i.e. 7.00%). The rate used is stored on each order, so old receipts stay correct if the rate changes.

---

## 9. Discounts

- Order-level, **at most one discount per order**, applied in the cart before placing the order. Cannot be changed after the order is created (void and re-order instead).
- Chosen from a dropdown of **discount presets** stored in the database (`discount_presets`). Presets are added or retired by DB insert/update; there is no admin UI.
- Every preset has a **fixed value** (a percentage or a baht amount); staff only pick it. Staff-entered values and free orders are future work (§13.3).
- A preset's `type` and `value` are **immutable** once created. To change 15% → 20%, create a new preset and deactivate the old one. Name and `isActive` may change.
- Discount amount is rounded half-up and can never exceed the subtotal.
- Any logged-in staff member may apply any preset (no roles yet; README remark: limit by role in future).

### 9.1 Seed presets

| Code | Name (EN) | Name (TH) | Discount | Min. subtotal |
|---|---|---|---|---|
| `STAFF_15` | Staff discount 15% | ส่วนลดพนักงาน 15% | −15% | — |
| `PROMO_10_PERCENT` | Promotion 10% | โปรโมชัน ลด 10% | −10% | ฿100.00 |
| `PROMO_30_BAHT` | Promotion ฿30 | โปรโมชัน ลด ฿30 | −฿30.00 | ฿200.00 |

- Presets whose minimum spend is not met are shown greyed out with a remark, e.g. "Min. spend ฿200.00".
- With these presets the grand total is always above ฿0.00 (the lowest is ฿29.75: `STAFF_15` on a Small Milk at ฿35.00), so every order still goes through payment.
- Error codes: `DISCOUNT_MIN_SPEND_NOT_MET` (params: `minSubtotal`), `DISCOUNT_PRESET_UNAVAILABLE` (unknown or inactive code).

### 9.2 Stored on the order

`discountPresetId` (null when no discount) and `discountAmount` (`0.00` when no discount). Because a preset's type and value never change, these two fields reproduce the discount exactly.

---

## 10. Orders

### 10.1 Identity and data recorded

- `id`: UUID (primary key).
- `orderNumber`: `YYYYMMDD-NNNN`, resets daily by **Asia/Bangkok** date, allocated atomically in the same DB transaction that creates the order (no collisions across terminals). Past 9999 in a day, the sequence widens to 5 digits automatically (`-10000`). Voided numbers are never reused. Staff may call out just `#0001`.
- `createdAt`: stored as `timestamptz` (UTC), displayed in Bangkok time.
- Staff who placed the order: taken from the JWT, never from the request body.
- Lines: quantity, `unitPrice`, `lineTotal`, plus a **snapshot** of each item's `menuItemId`, `code`, `nameEn`, `nameTh`, price at order time and, for add-ons, count and `position` (§5). Later menu changes never alter old orders.
- Money: `subtotal`, discount fields (§9.2), `total`, `vatRateBps`, `vat`, `beforeVat`.

### 10.1a Duplicate submissions and concurrency

- **Idempotency:** `POST /orders` and every payment/void request carry an idempotency key generated by the client per user action. Repeating a request with the same key (double-click, network retry) returns the original result and creates nothing new. Reusing a key with a different body is rejected (`IDEMPOTENCY_KEY_REUSED`).
- **Concurrent state changes:** paying, confirming a QR, and voiding lock the order row. When two terminals act on the same order at once, exactly one succeeds; the other receives `ORDER_NOT_PAYABLE` or `VOID_NOT_ALLOWED`.

### 10.2 Status lifecycle

```
PENDING_PAYMENT ──(payment succeeded)──▶ PAID
       │
       └──(staff voids)──▶ VOIDED
```

- `POST /orders` creates the order as `PENDING_PAYMENT` and returns the itemized summary with grand total, as the brief requires.
- **Only `PENDING_PAYMENT` orders can be voided** (`VOID_NOT_ALLOWED` otherwise). Voiding a paid order needs refunds — out of scope.
- Void records `voidedAt`, `voidedByStaffId`, `voidReasonCode`, `voidReasonNote`. Any pending payment transaction is marked `EXPIRED`.

| Void reason code | Label (EN) |
|---|---|
| `CUSTOMER_CHANGED_MIND` | Customer changed mind |
| `WRONG_ORDER_ENTRY` | Wrong order entry |
| `OUT_OF_STOCK` | Out of stock |
| `CUSTOMER_LEFT_UNPAID` | Customer left unpaid |
| `OTHER` | Other — **note required** (≤ 200 chars) |

Void reasons are an enum in code.

### 10.3 Demo orders (development only)

So the Orders page and receipts have something to show on a fresh database, a dev-only command adds sample orders:

- Today and each of the previous 7 days (the full range of the Orders page, §14). On a past date, orders are placed between 08:00 and 17:00 Bangkok time. Today's orders are spread over the time before the command runs, never after it.
- Every state the screens can show: paid by cash, paid by QR, pending payment, and voided (one of them with reason `OTHER` and a note), with each of the three presets (§9.1) and both demo staff.
- Orders are created by the same services as the POS, so order numbers, snapshots, discounts, VAT and change follow §8–§11.
- The command refuses to run unless `APP_ENV=dev`. If the database already has any order, it adds nothing.
- `docker compose up` runs it after the migrations. Locally it is `npm run seed:demo`.

---

## 11. Payment

`payment_transactions`: an order may have several transactions (e.g. a QR expired and a new one was created). Fields: `id`, `orderId`, `method` (`QR` / `CASH` / `NONE`), `amount`, `status` (`PENDING` / `SUCCEEDED` / `FAILED` / `EXPIRED`), `qrPayload`, `providerRef`, `cashReceived`, `change`, `processedByStaffId`, `createdAt`, `completedAt`, `expiresAt`.

`processedByStaffId` is the staff member who took the payment, from the JWT. Usually it is the staff who placed the order, but any logged-in staff may take payment (shift handover, or a second terminal).

Invariants:
- A `PAID` order has exactly one `SUCCEEDED` transaction, and its amount equals the order total.
- An order has at most one `PENDING` transaction; starting a new payment expires the previous one.
- Only `PENDING_PAYMENT` orders accept payment (`ORDER_NOT_PAYABLE` otherwise).

All methods sit behind one `PaymentGateway` interface, so a real provider (e.g. PromptPay) is a new class plus a webhook.

### 11.1 Mock QR

1. Staff choose QR → a transaction is created and a scannable QR image with a fake payload is shown, with a 5-minute countdown.
2. Since no bank exists, a **"Simulate customer paid"** button confirms it → transaction `SUCCEEDED` and order `PAID` in one DB transaction.
3. Confirming an expired transaction fails with `PAYMENT_EXPIRED`.

- **Expiry is evaluated on access:** whenever a transaction is read or confirmed, `now > expiresAt` means expired and the status is updated then. No background scheduler.
- **Mock confirmation exists only when `APP_ENV=dev`.** With `APP_ENV=prod` the button is hidden and the endpoint answers 404, so a real deployment can never mark an order paid without money.

> **Note for a future real provider (not implemented):**
> - The provider enforces QR expiry (sent when the QR is created); the shop's `expiresAt` check stays as a second guard.
> - Payment success arrives by **webhook**; while a QR is displayed, the payment screen polls the order status every 2–3 seconds.
> - **The provider's webhook wins.** A success that arrives after the local `expiresAt` (customer paid at 4:59, webhook at 5:01) is accepted if the order is still `PENDING_PAYMENT`. If the order was already voided or paid another way, the transaction is recorded and flagged **refund required** for staff review.
> - A periodic sweeper job is optional and only tidies stale `PENDING` rows for reporting; it never decides whether a payment is accepted.

### 11.2 Cash

Staff enter the cash received; the system computes change. Cash received must be ≥ total (`CASH_INSUFFICIENT`), have at most 2 decimals, and be ≤ ฿10,000.00 to catch typos (`CASH_AMOUNT_INVALID`; the largest possible order is 20 × ฿270.00 = ฿5,400.00). The transaction succeeds immediately and the order becomes `PAID`. Receipt shows "Cash received" and "Change". Cash drawer management and shift closing are out of scope.

---

## 12. Authentication

- Table `staff`: `id`, `username`, `passwordHash` (bcrypt), `displayName`, `isActive`.
- Seed: `cashier1` / `password123`, `cashier2` / `password123` (documented in README).
- `POST /auth/login` returns a JWT valid for **8 hours** (≈ one shift). No refresh token.
- Failed login always answers "Invalid username or password" (`INVALID_CREDENTIALS`), never which field was wrong. Inactive staff cannot log in; `isActive` is checked at login only (an inactive staff member is not on shift).
- `GET /menu` is public. Every other endpoint requires a valid JWT (`UNAUTHORIZED`). A valid token whose staff row no longer exists (for example after a database reset) is also `UNAUTHORIZED`, and the web returns to the login page.

---

## 13. Extensibility and future design

### 13.1 Extensibility requirements

The brief asks for flexible ingredients and dynamic pricing without an explosion of subclasses. The design must satisfy:

| Change | Required effort |
|---|---|
| New item in an existing category (base, size, extra, syrup, topping) | Insert one row. **Zero new classes**, zero code changes. |
| New add-on category (e.g. `SAUCE`) | One enum value + its description position. |
| New discount type (e.g. Buy X Get Y) | One new strategy class. Drink pricing and VAT untouched. |
| New payment method / real provider | One new gateway class. Order logic untouched. |
| Change limits (V4–V6), VAT rate, cash cap | Configuration only. |
| Change how size affects price | Replace one pricing rule. Base, add-on and order code untouched. |

### 13.2 Known limitations and how to lift them

| Not supported today | How to add it later |
|---|---|
| **Size as a multiplier** instead of a fixed surcharge (unlikely) | Add `priceMultiplier` (default 1.00) to size rows; add one size pricing rule computing `(base + add-ons) × multiplier`. No new bases. |
| **Add-on price varies by size** (e.g. Large gets more syrup) | Table `menu_item_size_prices` (`menuItemId`, `sizeId`, `price`) holding only overrides; price lookup falls back to the item's default price. `GET /menu` returns per-size prices. Old orders unaffected (snapshotted). |
| **Which add-ons each base accepts** (e.g. no Extra Coffee Shot in Tea) — today every add-on fits every base | **Allowlist** table `menu_item_allowed_addons` (`baseId`, `addOnId`); categories come from the add-on itself, so the builder shows each base's allowed extras/syrups/toppings grouped by category. New rule V8 `ADDON_NOT_ALLOWED_FOR_BASE`. Pricing untouched. A new add-on appears nowhere until assigned to bases — the safe default for a POS. |
| Which terminal an action came from | Add `terminalId` to orders and transactions. Multi-terminal use already works: order numbers are atomic, state changes are locked (§10.1a), and every action records its staff. |
| **Several repositories** (e.g. a separate team or outside vendor owns an ERP/CRM integration, or it needs another language) — today one npm-workspaces monorepo | Split when **ownership** splits, not when features grow. Roles/permissions and ERP/CRM adapters fit the monorepo: permission names live in `packages/domain` so API guards and web menus share one list; an integration is an adapter in `apps/api` or its own deployable `apps/<name>` service. Before splitting, use CODEOWNERS and path-filtered CI. To split: move the app out with its history (`git subtree split`), publish `@coffee/domain` to a private registry, and pin the same domain version in web and API so cart and server prices still agree. |

### 13.3 Future features

**Buy X Get Y** (1+1, 2+1, 3+1): implemented later as another discount strategy.
- The free cup is the **cheapest cup** in the order, at its full price including size and add-ons, so the shop never gives away its most expensive drink.
- Repeated sets: free cups = `floor(cups / (X + Y)) × Y`, taking the cheapest ones. E.g. 2+1 with 7 cups → 2 free cups.
- All cups qualify (restricting by menu item can be added later).
- Until then, staff can use the `PROMO_*` presets.

**Staff-entered discounts and free orders** (deferred from phase 3; decisions #57):
- Two more presets, `SERVICE_RECOVERY` (ชดเชยลูกค้า; note optional) and `OTHER` (อื่นๆ; **note required**, ≤ 200 chars), whose percent (1–100, up to 2 decimals) or amount (> 0, ≤ subtotal) staff type in. New error codes `DISCOUNT_VALUE_INVALID`, `DISCOUNT_EXCEEDS_SUBTOTAL`, `DISCOUNT_NOTE_REQUIRED`. The order then also stores `discountType` (`PERCENT` / `AMOUNT`), `discountValue` and `discountNote`. Example: subtotal ฿115.00, `OTHER` 12.5% → discount ฿14.38 (14.375 rounded half-up), total ฿100.62.
- A 100% discount makes the grand total ฿0.00. Placing such an order immediately creates a payment transaction with method `NONE` (the enum value already exists), amount ฿0.00, status `SUCCEEDED`, and the order becomes `PAID`, skipping the payment screen. The button reads "Place complimentary order" and asks for confirmation; the receipt shows "Payment: No payment required".
- Giving goods away free may be treated as a sale for VAT purposes depending on intent. **Accounting must confirm** before production use.

**SKU:** an optional, unique, nullable `sku` column on `menu_items`, assigned by an external stock/accounting system and used only at that integration boundary. Pricing and order logic stay unchanged. `id` is for the DB, `code` for code and people, `sku` for external systems.

---

## 14. Screens (staff)

```
[Login] → [POS] → Place order → [Payment] → [Receipt] → back to POS
[Orders] ← from the header
```

| Screen | Capabilities |
|---|---|
| **Login** | Username/password, language switch |
| **POS** | Left: drink builder (base → size → add-ons by category, live price for the drink, V4/V5 remarks). Right: cart (edit/remove/quantity, discount dropdown, subtotal/discount/total) |
| **Payment** | QR (code, 5-min countdown, "Simulate customer paid") or Cash (amount received, change) |
| **Receipt** | Order number, date/time, staff, itemized lines (unit price shown when quantity > 1), subtotal, discount, grand total, before VAT, VAT, payment method, cash/change; print via `window.print()` |
| **Orders** | Filters: status (all / pending / paid / voided), payment method (all / QR / cash; "none" is added with free orders, §13.3), date (today, back to 7 days; Bangkok date). Sort by `createdAt` newest or oldest first (default newest). Pending → pay or void (reason dropdown); paid → view/reprint receipt |

Operating practice: all `PENDING_PAYMENT` orders are paid or voided before closing the day.

### 14.1 Receipt example

Cart: 2 × Medium Tea (฿55.00 each) + 1 × `Large Coffee, Vanilla` (฿90.00); preset `PROMO_10_PERCENT`; paid cash ฿200.00.

```
Order 20261021-0001          21 Oct 2026 14:05   Staff: Cashier 1
2 × Medium Tea @ ฿55.00                          ฿110.00
1 × Large Coffee, Vanilla                         ฿90.00
-------------------------------------------------------
Subtotal                                         ฿200.00
Discount: Promotion 10%                          −฿20.00
Grand Total (incl. VAT)                          ฿180.00
  Before VAT                                     ฿168.22
  VAT 7%                                          ฿11.78
Payment: Cash   Received ฿200.00   Change ฿20.00
```

---

## 15. Internationalization

- Languages: **English** (default) and **Thai**, switchable from the header; the choice is remembered per device (localStorage).
- **UI text** (labels, buttons, remarks, error messages, void reasons, receipt labels) lives in **JSON files in the web app**, so it renders even when the server is down. One folder per language, one file per namespace:
  ```
  apps/web/src/locales/{en,th}/
    common.json  button.json  auth.json  drink-builder.json  cart.json
    payment.json  receipt.json  orders.json  void-reason.json  error-message-code.json
  ```
- The backend returns **codes** (error codes, reason codes); the frontend translates them. Unknown codes fall back to a generic error message.
- **Menu and discount preset names** live in the database (`nameEn`, `nameTh`), because they change without a deploy.
- Drink descriptions are generated in the selected language (§5). Orders snapshot names in **both** languages so any receipt can be reprinted in either.
- Documentation (`docs/`, README) is written in English.

---

## 16. Acceptance examples

| # | Given | Expect |
|---|---|---|
| A1 | Large Coffee + Vanilla ×2 + Whipped Cream | `Large Coffee, 2x Vanilla, Whipped Cream`, ฿115.00 |
| A2 | Order total ฿115.00 | VAT ฿7.52, before VAT ฿107.48 |
| A3 | Subtotal ฿200.00, `PROMO_10_PERCENT` | Discount ฿20.00, total ฿180.00, VAT ฿11.78, before VAT ฿168.22 |
| A4 | Subtotal ฿200.00, `PROMO_30_BAHT` | Total ฿170.00, VAT ฿11.12, before VAT ฿158.88 |
| A5 | Subtotal ฿199.00, `PROMO_30_BAHT` | Rejected `DISCOUNT_MIN_SPEND_NOT_MET` |
| A6 | Subtotal ฿99.00, `PROMO_10_PERCENT` | Rejected `DISCOUNT_MIN_SPEND_NOT_MET` |
| A7 | Subtotal ฿115.00, `STAFF_15` | Discount ฿17.25, total ฿97.75, VAT ฿6.39, before VAT ฿91.36 |
| A8 | Drink with 11 add-ons | Rejected `ADDON_LIMIT_EXCEEDED` |
| A9 | Drink with Vanilla ×6 | Rejected `ADDON_REPEAT_LIMIT_EXCEEDED` |
| A10 | Order with 21 cups across lines | Rejected `ORDER_CUP_LIMIT_EXCEEDED` |
| A11 | Cash ฿150.00 for total ฿180.00 | Rejected `CASH_INSUFFICIENT` |
| A12 | Void a `PAID` order | Rejected `VOID_NOT_ALLOWED` |
| A13 | Two terminals place orders at the same instant | Distinct consecutive order numbers |
| A14 | Menu price changed after an order was placed | Old order and its receipt unchanged |
| A15 | Large Coffee built as Caramel → Vanilla, then again as Vanilla → Caramel | One cart line, quantity 2, `Large Coffee, Vanilla, Caramel` |
| A16 | `POST /orders` sent twice with the same idempotency key | One order; both responses identical |
| A17 | Terminal 1 voids while terminal 2 pays the same pending order | Exactly one succeeds; the other gets `VOID_NOT_ALLOWED` or `ORDER_NOT_PAYABLE` |
| A18 | Confirm a QR 6 minutes after creation | Rejected `PAYMENT_EXPIRED`; transaction becomes `EXPIRED` |
| A19 | Mock confirm with `APP_ENV=prod` | 404 |
| A20 | Cash received ฿10,000.01 | Rejected `CASH_AMOUNT_INVALID` |

---

## 17. Testing

| Layer | Tools | Covers |
|---|---|---|
| Domain (pricing) | Jest, **TDD** | Drink composition, EN/TH descriptions, `Money` and rounding, VAT, all discount presets incl. min spend and rounding, V1–V6 |
| Backend API | Jest + Supertest + **real PostgreSQL** (Testcontainers) | Login, place order, concurrent order numbers, idempotency, concurrent pay/void, QR expiry and cash payment, void rules, V7 error details, snapshot immutability, mock endpoint disabled in prod |
| Frontend | Vitest + React Testing Library | Drink builder limits/remarks, cart merging and V6, discount dropdown (greyed presets), payment screen, language switch |
| i18n | Vitest | Every key in `en/` exists in `th/` and vice versa |

- Coverage target: domain ≥ 95%. Other layers: no number, critical flows covered.
- The database is not mocked in API tests, because the riskiest behavior (order number allocation, payment transactions, `numeric`) is database behavior.
- Out of scope: browser E2E (Playwright), load tests.

---

## 18. Technology decisions

| Concern | Decision | Why |
|---|---|---|
| Language | TypeScript across the stack | Recommended by the brief; shared types and strong typing |
| Backend | NestJS | Recommended by the brief; modules map to domains (Menu, Order, Payment, Auth) |
| Frontend | React + react-i18next | Recommended by the brief; namespaced translation files |
| Database | PostgreSQL via Docker Compose | Concurrency-safe order numbers and transactions, as a real POS needs |
| ORM | TypeORM with migrations (no `synchronize`) | Decorator style matches NestJS; chosen so the owner can read and maintain the code |

---

## 19. README remarks checklist

The README must link to this list, as "not yet implemented":
roles/permissions · refresh tokens · password change · user management UI · login rate limiting · OTP login · customer self-ordering · customer accounts/CRM · ERP/cost accounting · SKU · admin UI for menu and discount presets · staff-entered discount values and free (฿0.00) orders (§13.3) · coupons, automatic, per-drink and stacked discounts · Buy X Get Y · tax invoices / shop tax ID · service charge · VAT treatment of free goods (accounting to confirm) · refunds and voiding paid orders · card, split and partial payments · real payment provider · cash drawer and shift closing · text search and order history beyond 7 days, sales reports · barista screen · thermal printing · offline mode · a third language · multi-currency · size multiplier pricing, per-size add-on prices, per-base add-on allowlist, terminal tracking (§13.2).

And must explain each deliberate deviation from the brief's wording:

| Brief says | We do | Why |
|---|---|---|
| Description example `Large Coffee, Vanilla, Vanilla, Whipped Cream` | `Large Coffee, 2x Vanilla, Whipped Cream` (§5) | Faster for staff and customers to read |
| "Any number" / "any combination" of syrups and toppings | Up to 10 add-ons, each up to 5 times (V4, V5) | Guards against abnormal input; limits are configuration |
| "A customer composes a beverage" | Staff compose it for the customer at a POS (§1) | Matches how a counter works; the drink builder is reusable for a future self-order screen |
| Bases: Coffee, Tea, Milk; no extras | Adds Latte, Extra Coffee Shot, Extra Milk (§4.1) | Demonstrates that new ingredients need no code |
