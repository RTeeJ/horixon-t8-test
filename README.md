# Customizable Coffee Shop (Staff POS)

A point-of-sale for a coffee shop, built as a take-home technical assessment. Staff compose a drink (base, size, any add-ons), see the price and a readable description update live, place the order, take cash or a mock QR payment, and print a receipt in English or Thai. Pricing rules live in one pure TypeScript package shared by the API and the web app.

- Requirements: [docs/requirements.md](docs/requirements.md)
- Design: [docs/design.md](docs/design.md)
- Decisions: [docs/decisions.md](docs/decisions.md)

## Quick start

### Docker (everything)

Requires Docker with Compose.

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Web | http://localhost:5173 |
| API | http://localhost:3000 |
| PostgreSQL | `localhost:5434` (user/password/db: `coffee`) |

The API runs the database migrations (schema and seed data) on start, then adds demo orders for today and the previous 7 days if the database has no orders yet (`SEED_DEMO=true` in `docker-compose.yml`). PostgreSQL is published on host port 5434 (override with `POSTGRES_HOST_PORT`) so it does not clash with a local Postgres on 5432. Stop with `docker compose down` (add `-v` to also delete the database volume; the next `up` seeds fresh demo orders).

### Local development

Requires Node.js 24 and npm 11.

```bash
cp .env.example .env            # DATABASE_URL points at localhost:5434
docker compose up -d postgres   # PostgreSQL only
npm install
npm run build                   # builds @coffee/domain (the API imports its output)
set -a; . ./.env; set +a
npm run migrate                 # schema + seed data
npm run seed:demo               # optional: demo orders for the last 8 days (dev only; skips if any order exists)
npm run dev                     # API on :3000 (watch mode) and web on :5173
```

### Demo logins

| Username | Password |
|---|---|
| `cashier1` | `password123` |
| `cashier2` | `password123` |

The login page has **Demo accounts** buttons that fill these in. They are for local development only; a production build has no demo buttons, and with `APP_ENV=prod` the API refuses a weak `JWT_SECRET`.

Try it: log in, build `Large Coffee` with 2x Vanilla and Whipped Cream (฿115.00), add it to the cart, place the order, pay with cash, and switch the language between EN and TH on the receipt.

## Testing

```bash
npm test                      # every workspace
npm test -w @coffee/domain    # pricing rules (Jest), no database
npm test -w @coffee/api       # Supertest against a real PostgreSQL via Testcontainers (needs Docker)
npm test -w @coffee/web       # Vitest + React Testing Library
```

## Brief deliverables

| Brief asks for | Where |
|---|---|
| High-level class diagram / architecture | [Architecture (design §3)](docs/design.md#3-architecture), [Class diagram (design §4.6)](docs/design.md#46-class-diagram) |
| Choice of language and why | [Language and stack (design §2)](docs/design.md#2-language-and-stack) |
| A design that adds ingredients and computes prices dynamically **without excessive subclasses** | [Domain: Decorator + Strategy, data-driven menu (design §4)](docs/design.md#4-domain-packagesdomain) |
| Code snippets: create a base drink and customize it | Below, with more in [Snippets (design §4.7)](docs/design.md#47-snippets-create-a-base-drink-and-customize-it) |
| Benefits for maintainability and extensibility | [Why this design (design §9)](docs/design.md#9-why-this-design) |

```ts
import { Menu, DrinkBuilder, describe } from '@coffee/domain';

const menu = Menu.fromItems(rowsFromDatabase);

const drink = DrinkBuilder.on(menu)
  .base('COFFEE')
  .size('SIZE_LARGE')
  .add('VANILLA', 2)          // double vanilla
  .add('WHIPPED_CREAM')
  .build()
  .unwrap();

drink.cost().toString();      // "115.00"   = 50 + 30 + 10 + 10 + 15
describe(drink, 'en');        // "Large Coffee, 2x Vanilla, Whipped Cream"
describe(drink, 'th');        // "กาแฟ แก้วใหญ่, 2x วานิลลา, วิปครีม"
```

A new syrup or topping is a row in `menu_items`, not a new class. Design §4.7 also shows the decorator layers built by hand and an order priced with a discount.

## Deliberate deviations from the brief

| Brief says | We do | Why |
|---|---|---|
| Description example `Large Coffee, Vanilla, Vanilla, Whipped Cream` | `Large Coffee, 2x Vanilla, Whipped Cream` (§5) | Faster for staff and customers to read |
| "Any number" / "any combination" of syrups and toppings | Up to 10 add-ons, each up to 5 times (V4, V5) | Guards against abnormal input; limits are configuration |
| "A customer composes a beverage" | Staff compose it for the customer at a POS (§1) | Matches how a counter works; the drink builder is reusable for a future self-order screen |
| Bases: Coffee, Tea, Milk; no extras | Adds Latte, Extra Coffee Shot, Extra Milk (§4.1) | Demonstrates that new ingredients need no code |

Section marks (§) refer to [requirements.md](docs/requirements.md).

## Security

**In place**

| Area | What |
|---|---|
| Passwords | bcrypt hashes only, never plain text, seeds included |
| Login | One answer for any failure (`INVALID_CREDENTIALS`); an unknown user is still compared against a dummy hash so timing does not reveal which usernames exist; inactive staff cannot log in |
| Access | A global guard requires a JWT on every route except login and the menu; a token whose staff no longer exists is rejected. The acting staff member always comes from the token, never the request body |
| Secrets | With `APP_ENV=prod` the API refuses to start with a `JWT_SECRET` shorter than 32 characters or equal to a known dev value |
| Input | Unknown fields are rejected; prices are computed on the server from menu codes; a discount is chosen by preset code only, never by value; SQL is always parameterised |
| Errors | Responses carry an error code only, never a stack trace or internal message |
| Money and state | Idempotency keys, row locks and database constraints stop double payments and conflicting updates |
| Dev-only features | The mock QR confirmation answers 404 outside `APP_ENV=dev`; demo login buttons are left out of production builds; demo orders refuse to run outside dev |
| HTTP headers | API: `helmet` (JSON-only CSP, `nosniff`, `X-Frame-Options: DENY`, HSTS, …) and no `X-Powered-By`; CORS allows only `WEB_ORIGIN`. Web: strict CSP (own origin plus the API), `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, nginx version hidden |
| Containers | Neither the API nor the web container runs as root |
| Dependencies | `npm audit --omit=dev` reports no known vulnerabilities |

**Deliberately out of scope** ([requirements §1](docs/requirements.md#1-scope-at-a-glance), [§12](docs/requirements.md#12-authentication)): login rate limiting, roles and permissions (any staff member can void), refresh tokens and token revocation (a token stays valid for its 8 hours even if the account is deactivated, because `isActive` is checked at login).

**Before a production deployment**

- Serve both apps over HTTPS (a TLS-terminating proxy or load balancer).
- Set a strong `JWT_SECRET`, real database credentials, `APP_ENV=prod`, and do not set `SEED_DEMO` or `VITE_DEMO_LOGIN`.
- Do not publish PostgreSQL's port; `docker-compose.yml` exposes it on 5434 with `coffee`/`coffee` for local use only.
- Add login rate limiting.
- Consider an httpOnly cookie instead of `localStorage` for the token, so a future XSS bug could not read it.
- Add a job that purges old idempotency keys ([decisions #54](docs/decisions.md)).
- Dev-only tools have 20 moderate `npm audit` findings (for example `sprintf-js`); none ship in the images, and the available fixes are breaking upgrades.

## Not yet implemented

Out of scope for this assessment, from roles/permissions and refunds to a real payment provider: see the full list in [requirements §19](docs/requirements.md#19-readme-remarks-checklist).

Image credits: [docs/image-credits.md](docs/image-credits.md).
