# Decision Log — Customizable Coffee Shop (Staff POS)

Every decision made in the requirements interview, with the alternatives considered and the reason for the choice. Where a decision changed during the interview, the history is kept.

This log explains **why**. The current rules live in [requirements.md](requirements.md) (R§) and [design.md](design.md) (D§); if this log and those documents ever disagree, they win.

---

## Pricing and money

| # | Decision | Alternatives considered | Why | Spec |
|---|---|---|---|---|
| 1 | Currency THB. Bases Coffee 50, Tea 40, Milk 35; syrups 10; Whipped Cream 15, Cinnamon 5, Marshmallows 10 | USD | Thai shop; the brief gives no prices | R§4.1 |
| 2 | Size is a fixed surcharge: Small +0, Medium +15, Large +30 | Multiply the whole drink; multiply the base only | No fractional satang, easy to read on the receipt. First proposed as +10/+20; raised to steps of 15 | R§4.2 |
| 3 | Every repetition of an add-on is charged in full | Multi-add discount | Simple and predictable | R§4.2 |
| 4 | Money is stored as `numeric(12,2)` baht (`50.00`), exchanged as `"50.00"`, computed as integer satang inside `Money` | Integer satang columns (`5000`); 4-decimal storage | **History:** started as integer satang → user preferred readable `50.00` in DB/API → 4 decimals proposed for VAT precision → **2 chosen** because stored values must equal the printed receipt; storing 4 makes monthly totals disagree with receipts (3 × 0.0050 = 0.02 stored vs 0.03 printed) | R§3, D§4.2 |
| 5 | Money field names carry no unit suffix (`price`, `total`, `vat`) | `priceSatang`; `priceMinor` (ISO 4217 term) | Readability; values are baht, so no unit is ambiguous | R§3 |
| 6 | One rounding rule system-wide: half-up to 2 decimals | Banker's rounding | Matches the Revenue Department VAT rule (3rd decimal ≥ 5 rounds up one satang) | R§3 |
| 7 | Menu prices are VAT-inclusive; VAT 7% is extracted once per order after discount; the rate is snapshotted on each order | No VAT at all; VAT added on top; per-line VAT | **History:** first chose no VAT, then corrected — prices are set VAT-inclusive by another department, and the receipt should show the breakdown. Once per order avoids accumulated rounding | R§8 |
| 8 | Tax invoices, shop tax ID, service charge: out of scope | — | Legal requirements beyond the brief | R§19 |

## Description

| # | Decision | Alternatives considered | Why | Spec |
|---|---|---|---|---|
| 9 | Add-ons are grouped and repeats collapsed: `Large Coffee, 2x Vanilla, Whipped Cream` | Click order as-is (brief's example); grouped without collapsing | **History:** click order → grouped (B) → grouped + collapsed (C). Easier for staff and customers to read. Deviates from the brief's example; the README must say so | R§5 |
| 10 | Count format `2x Name`, prefix, in both languages | `Name x2`; `Double Vanilla`; different per language | Matches the `2 × Medium Tea` quantity prefix on receipts; one formatter | R§5 |
| 11 | Order inside a group follows menu `sortOrder`, not click order | First-insertion order | Same recipe → same description; cart merging becomes trivial; baristas read a consistent order | R§5 |
| 12 | Group order EXTRA → SYRUP → TOPPING; head is `<Size> <Base>` (EN) / `<Base> <Size>` (TH) | — | Extras belong to the drink itself, so they sit next to the base | R§5 |

## Menu

| # | Decision | Alternatives considered | Why | Spec |
|---|---|---|---|---|
| 13 | Menu in the database: one row per item; adding an item needs no code | Hard-coded config; DB + admin UI | Shows the brief's extensibility; admin UI needs roles | R§4 |
| 14 | Each item has a UUID `id`, an immutable semantic `code` (`VANILLA`), editable names | Sequential codes (`SYRUP001`) | Readable in logs and tests; category already a column, so codes would duplicate it (and drift — e.g. Chocolate is a syrup, not a topping) | R§4 |
| 15 | Latte (60) is a base; Extra Coffee Shot (20) and Extra Milk (10) are a new EXTRA category | Coffee + Milk as two bases | A drink has exactly one base; Coffee + Milk would cost 85. Demonstrates extensibility | R§4.1 |
| 16 | Prices change only after closing (operating practice); no client/server price-mismatch check | `expectedTotal` + 409 `PRICE_CHANGED` | The server total is shown on the payment screen before money is taken anyway | R§4, R§7 |
| 17 | Future: `sku` column for external systems | — | `id` for the DB, `code` for code and people, `sku` for integrations | R§13.3 |
| 18 | Future: per-base **allowlist** of add-ons | Denylist | A new add-on appears nowhere until assigned — safer for a POS. User's proposal | R§13.2 |
| 19 | Future: per-size add-on prices; size as a multiplier | — | Unlikely; documented so the design shows how | R§13.2 |

## Validation

| # | Decision | Alternatives considered | Why | Spec |
|---|---|---|---|---|
| 20 | ≤ 10 add-ons per drink; same add-on ≤ 5 times; both shown as remarks in the UI | No limits ("any number") | Guards against abnormal input; limits are config. 5 chosen over the proposed 3 | R§6 |
| 21 | 1–20 cups per order; above 20 the message suggests splitting the order | — | — | R§6 |
| 22 | Invalid drinks cannot enter the cart; the backend re-validates and rejects the whole order with per-drink details | Backend only | UX at the counter plus protection against direct API calls | R§6 |

## Persistence and stack

| # | Decision | Alternatives considered | Why | Spec |
|---|---|---|---|---|
| 23 | Persist everything: order number, time, items, staff | No persistence; in-memory repository | The goal is a POS-like system, scoped to the brief first | R§10 |
| 24 | PostgreSQL + TypeORM (migrations) + Docker Compose | Prisma; SQLite; in-memory | **TypeORM over Prisma** because the owner must read and maintain the code; Postgres for concurrency-safe order numbers | R§18 |
| 25 | Order number `YYYYMMDD-NNNN` by Bangkok date, atomic counter, widens past 9999, never reused | Global sequence; UUID only | Readable, resets daily, safe across terminals | R§10.1 |
| 26 | Orders snapshot item names (EN and TH), prices, counts and positions | Reference menu rows only | Menu edits never change old receipts | R§10.1 |
| 27 | Monorepo with a shared pure-TS `domain` package used by API and web | Rules duplicated in each app; polyrepo with `domain` as a versioned package | One source of pricing rules; live cart price equals server price, with no version skew between apps. Split repositories only when ownership splits | D§3, R§13.2 |
| 28 | Decorator with three classes (base, one data-driven add-on decorator, size) + strategies for size pricing and discounts | A subclass per ingredient | Class count independent of menu size — the brief's core ask | D§4 |
| 61 | Web is a single-page app built with Vite + React Router, served as static files by nginx | Next.js; Create React App; Webpack by hand | The POS sits behind a login, so server rendering and SEO add nothing, and NestJS is already the server. Vite builds to static files, shares its config with Vitest (one `@coffee/domain` alias for app and tests), and drops dev-only code such as demo logins from production builds. Create React App is deprecated | D§2 |

## Users and authentication

| # | Decision | Alternatives considered | Why | Spec |
|---|---|---|---|---|
| 29 | Staff-operated POS only; no customer self-ordering; no `channel` / `customerId` columns yet | Kiosk/table QR; customer accounts (CRM) | Keep to the brief; remarks in README | R§1 |
| 30 | Username/password + JWT (8 h), no roles | Staff dropdown without password; free-text name; OTP via phone | **History:** dropdown → real login → OTP by phone (mock) → **username/password**, since OTP adds expiry, attempts, cooldown and an SMS seam without serving the brief | R§12 |
| 31 | `isActive` checked at login only | Checked on every request | An inactive staff member is not on shift | R§12 |
| 32 | Payments record `processedByStaffId`; any logged-in staff may take payment | Only the order's creator may take payment | Usually the same person, but shift handover and a second terminal must work | R§11 |

## Orders and payment

| # | Decision | Alternatives considered | Why | Spec |
|---|---|---|---|---|
| 33 | Status `PENDING_PAYMENT` → `PAID` or `VOIDED` | No status; full kitchen lifecycle | Needed for payment and void; nothing more | R§10.2 |
| 34 | Only unpaid orders can be voided; reason from a dropdown, `Other` requires a note | Free-text reason; voiding paid orders | Paid orders need refunds (out of scope); coded reasons allow reporting | R§10.2 |
| 35 | Payment by cash (change computed, max ฿10,000) and mock QR (5 min) | QR only | Thai cafés still take cash; cheap once transactions exist | R§11 |
| 36 | QR expiry checked on access; no scheduler | Background job every minute | Same result, no extra infrastructure. Real providers: webhook wins, late success accepted while unpaid | R§11.1 |
| 37 | Mock "customer paid" only when `APP_ENV=dev` | Always available | A forgotten mock in production would mark orders paid without money | R§11.1 |
| 38 | Idempotency keys on order/payment/void; row locks for state changes | — | Double-clicks and two terminals must not duplicate or race | R§10.1a |
| 39 | Orders page: filter by status, payment method, date (≤ 7 days back), sort by time; clear pending orders before closing | Today only; full search | Pending orders from earlier days must stay reachable | R§14 |

## Discounts

| # | Decision | Alternatives considered | Why | Spec |
|---|---|---|---|---|
| 40 | Order-level discount, one per order, chosen from presets with locked values | Staff type any % or amount | **User's proposal.** Fewer mistakes and less abuse without roles | R§9 |
| 41 | Presets: Staff 15%, Promo 10% (min ฿100), Promo ฿30 (min ฿200), Service recovery (staff enters value), Other (value + note) | — | Min spend replaces the "฿30 off a ฿25 order" problem; service recovery is common enough to skip typing a reason. **History:** Service recovery and Other were later deferred (#57) | R§9.1 |
| 42 | Preset `type`/`value` immutable; the order stores preset id + discount amount (+ manual fields) | Store only the preset code | User wanted only the code; editing a preset or `Other` values would then rewrite history. Immutability keeps storage minimal. **History:** the manual fields left with the manual presets (#58) | R§9.2 |
| 43 | Free drinks = 100% discount + a ฿0.00 `NONE` transaction | Payment type `COMPLIMENTARY` with full price | Sales equal money received; the receipt shows no VAT the customer never paid. Accounting must confirm VAT on giveaways. **History:** deferred with the manual presets (#57); the decision stands for when they return | R§13.3 |
| 44 | Future: coupons, Buy X Get Y (cheapest cup free, `floor(cups/(X+Y))×Y`) | — | Out of scope; the discount strategy seam is ready | R§13.3 |
| 57 | Phase 3 ships only the three fixed-value presets with min spend; staff-entered values (Service recovery, Other) and free orders are deferred | The full phase 3 (manual values, notes, free orders); stop after phase 2 | **User's choice** after weighing time against value. The brief asks for none of it; the fixed presets alone prove the extensibility claim that a new discount type is one strategy class (R§13.1) at about half the work. Fixed presets can never reach ฿0.00, so the free-order path is not needed | R§9, R§13.3 |
| 58 | Orders store only `discount_preset_id` and `discount_amount` | Also create the nullable `discount_type`/`discount_value`/`discount_note` columns now | YAGNI: with immutable fixed presets the id and amount reproduce the discount exactly; the manual columns arrive with the manual presets | R§9.2, D§6 |
| 59 | Preset immutability is enforced by a `BEFORE UPDATE` trigger on `discount_presets` | A documented convention only | Presets are edited by hand-written SQL (no admin UI), so the database is the only place a rule can be enforced; about ten lines of SQL | R§9, D§6 |
| 60 | The chosen preset is kept in `useCart` under its own localStorage key | Add it to the stored cart lines' format | Carts already saved by staff keep loading unchanged; clearing the cart clears both keys | D§8 |

## Internationalization and documents

| # | Decision | Alternatives considered | Why | Spec |
|---|---|---|---|---|
| 45 | English (default) and Thai | One language | User's choice | R§15 |
| 46 | UI text in JSON files in the repo, one folder per language, one file per namespace; menu and preset names in the DB | All text in the DB | UI must render when the server is down; menu names change without a deploy. Layout follows the user's existing project | R§15 |
| 47 | Documentation in English | Thai | Reviewers can read it | R§15 |

## Testing and delivery

| # | Decision | Alternatives considered | Why | Spec |
|---|---|---|---|---|
| 48 | TDD for the domain (≥ 95% coverage); API tests on real PostgreSQL; web with Vitest + RTL; no browser E2E | Mocked database | The riskiest behaviour (order numbers, transactions, `numeric`) is database behaviour | R§17 |
| 49 | Phases: 1 core (with VAT, auth, i18n) → 2 payment → 3 discount | Everything at once; auth later | Cross-cutting concerns are cheaper early; features slot in later without rework | D§11 |
| 62 | Demo orders come from a dev-only command (`seed:demo`) that calls `OrderService`/`PaymentService`, not from a migration | A seed migration with hand-written rows | The API runs migrations on every start, so a migration would put fake orders into production too. The services compute order numbers, VAT, discounts and change, so no amounts are typed by hand. A migration also runs once, while the command dates orders relative to the day it runs, so "today" always has orders | R§10.3, D§5.7 |
| 63 | `docker compose up` seeds demo orders automatically (`SEED_DEMO=true`); the command skips when any order exists | Run it by hand only | A reviewer's first `docker compose up` shows a full Orders page with no extra step. Skipping on a non-empty table makes every restart safe and never mixes demo orders with real ones | R§10.3 |
| 64 | The global `JwtGuard` checks that the token's staff row still exists (one primary-key lookup per request); `isActive` stays a login-only check | Trust the token alone; check `isActive` on every request; do the lookup in `JwtStrategy.validate` | After a database reset a browser kept a validly signed token for a staff id that no longer existed: `/auth/me` answered 200 and every write failed the `staff` foreign key with a 500. Checking `isActive` too would change R§12, which the user kept. Passport registers one `jwt` strategy per process, so a lookup in the strategy would use whichever Nest app registered it last (seen in tests that start a second app); the guard is per app | R§12, D§5.1 |
| 65 | API headers come from `helmet` with a JSON-only CSP (`default-src 'none'`), and `X-Powered-By` is off | Set a few headers by hand; no headers (the brief does not ask) | One maintained dependency covers the set of headers a reviewer checks for; the API returns no HTML, so nothing it serves needs to load anything | D§5.8 |
| 66 | The web's CSP allows only its own origin plus the API, with `connect-src` filled in from `API_ORIGIN` by the nginx image's template step | Hard-code `http://localhost:3000`; skip CSP | Every asset is self-hosted (fonts, images, the QR is SVG), so a strict policy costs nothing. The API address differs per deployment, so it comes from the environment and defaults to the build's `VITE_API_URL` | D§5.8 |
| 67 | Containers run as non-root: `USER node` for the API, `nginxinc/nginx-unprivileged` for the web | Keep root; install and configure a user in `nginx:alpine` by hand | Limits what a compromised process can do; the unprivileged image is maintained by the nginx team and already listens on a high port, as the web's 5173 does | D§5.8 |

## User interface

| # | Decision | Alternatives considered | Why | Spec |
|---|---|---|---|---|
| 51 | Eight more base drinks seeded by a new migration | Edit migration 0002; keep 4 bases | 0002 already ran on existing databases; 12 cards fill the photo grid | R§4.1 |
| 52 | Tailwind CSS v4, photo menu cards + customise dialog, Coffee house palette | Plain CSS + tokens; component library; inline step builder | User's choice after comparing mockups of each option | — |
| 53 | `mock-confirm` is always registered and guarded by `DevOnlyGuard` (404 unless `APP_ENV=dev`) | Register the route only in dev (conditional module/provider) | One code path in every environment; the guard is unit-testable; behaviour is the same 404 as a missing route. Unauthenticated callers get 401 first because the global JWT guard runs before it | D§5.4 |
| 54 | A failed request deletes its idempotency key; if saving the completed response fails the key stays `IN_PROGRESS` | Keep failed keys and replay the error; mark failed keys `FAILED` | A client can retry a failed action with the same key; a stuck `IN_PROGRESS` key blocks (409) instead of risking a duplicate payment. Stuck keys need a purge job, which is out of scope | D§5.5 |
| 55 | `businessDate` (Asia/Bangkok) lives in `packages/domain` | Duplicate it in API and web | API (order numbers, list filter) and web (date picker, "today") must agree on the shop day, including around midnight UTC+7 | R§14 |
| 56 | `VOID_NOTE_REQUIRED` is its own error code, raised by `checkVoid` | Reuse `INVALID_BODY` | The web can show a specific message under the note field; the rule lives in the domain so API and web share it | R§10.2 |
