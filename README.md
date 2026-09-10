# Toolshop Checkout E2E — Playwright + TypeScript

An automated end-to-end test suite for the checkout flow of [Practice Software
Testing (Toolshop)](https://practicesoftwaretesting.com), built as a
time-boxed take-home assignment.

## Scope and approach

This was explicitly scoped as a 3–4 hour exercise, so the goal was **one
reliable, isolated, well-designed checkout journey** rather than broad
coverage. I prioritized:

1. A working happy-path checkout, automated end-to-end
2. Test isolation (safe to run twice, in parallel, and in CI)
3. One meaningful negative scenario
4. Reliable, web-first assertions with no arbitrary waits
5. Failure diagnostics (trace, screenshot, video on failure)
6. An API-level assertion that the order was actually recorded
7. This README

Things like broad negative-path coverage, cross-browser execution, schema
validation, and richer reporting were deliberately left out — see
[What I'd do next](#what-id-do-next).

## Why the UI *and* the API

The behavior under test is **checkout**, not registration or login. So:

- **API** creates a unique user, authenticates it, and (after checkout) reads
  back the resulting invoice. This is setup and verification — fast and
  deterministic, and it means the UI test doesn't spend time or risk flake on
  typing into a registration form that isn't what's being tested.
- **UI** drives the actual thing under test: browsing, adding to cart, and
  completing checkout, exactly as a customer would.

```
generate unique test data
        │
        ▼
API: register user  ──────►  API: log in user
        │
        ▼
seed browser session with the access token
        │
        ▼
UI: browse → add to cart → checkout → address → payment → confirmation
        │
        ▼
API: fetch the created invoice and assert on it
```

## Project structure

```
tests/       business-level test scenarios (what a QA engineer reads first)
pages/       UI interaction + locators (Page Object Model, kept lean)
api/         API setup and API assertions (APIRequestContext)
fixtures/    the auth fixture: unique user → register → login → seeded session
utils/       test data generation, environment config
playwright.config.ts   browser/retry/trace/screenshot configuration
```

Each test reads top to bottom as a business scenario; the "how" lives in
`pages/` and `api/`.

## Test isolation

- Every test generates its own user (`test_<timestamp>_<random>@example.com`)
  and its own billing address — no shared or hardcoded identities.
- Every test gets its own Playwright browser context (Playwright's default),
  so the cart (which this app scopes to `sessionStorage`) is naturally
  isolated per test with no cross-test interference and nothing to clean up.
- **No leftover cart**: on a successful checkout the app itself calls
  `DELETE /carts/{cartId}` (`CartService.emptyCart()`, invoked right after
  the invoice is created) and clears the `cart_id` from `sessionStorage`.
  The happy-path test never has to clean this up itself — by the time the
  order confirmation is on screen, the cart is already gone server-side.
- No test depends on another test having run first, and no test hardcodes an
  order/invoice id.
- Safe to run twice in a row or in parallel: unique per-test data means two
  concurrent runs never collide on an email, and `playwright.config.ts` sets
  `fullyParallel: true` so tests are expected to run concurrently, not just
  tolerate it.
- Because setup creates a fresh user per test, there is no shared mutable
  state to tear down. I didn't add cleanup (e.g. deleting the created
  invoice/user) purely for appearance — the app itself guarantees isolation
  here since `GET /invoices` is scoped server-side to the authenticated user
  by user id, so leftover data from one test run can never leak into or
  affect another test.

## Investigation notes (why the code does what it does)

The API and UI behavior here weren't guessed — I cloned the project's
open-source repository
([testsmith-io/practice-software-testing](https://github.com/testsmith-io/practice-software-testing))
to read the actual Angular components and Laravel controllers behind
`practicesoftwaretesting.com` before writing any locators or assertions.
A few things that shaped the implementation:

- **"Orders" are called invoices.** There is no `/orders` endpoint. Checkout
  creates a resource under `POST /invoices`, and the confirmation screen
  shows an `invoice_number` (e.g. `INV-2026000123`). `GET /invoices` is
  scoped to the authenticated user server-side, which is what makes the
  API-level verification step safe under parallel execution.
- **The product catalog can take longer than 5s to load against the shared
  public demo.** A live run failed opening the first in-stock product with
  the page fully rendered (nav, sort, price filter) but the product cards
  still showing as loading skeletons - the default 5s wait just wasn't
  enough that time. `ProductsPage.open()` now waits on the real
  `GET /products` response before returning, and the card-visibility check
  has a longer, explicit timeout to absorb the render step after that.
- **Filling the billing address can get raced and silently, partially
  cleared by the app itself.** Two consecutive live runs against the real
  app caught the same class of failure with different fields affected each
  time — `country`/`postal_code`/`house_number` wiped back to empty after
  being filled correctly, or the reverse, with `street`/`city` already
  autofilled and everything else cleared — with no error shown anywhere in
  the UI either time. I traced this as far as the postcode-lookup call
  itself: `AddressComponent` re-issues `GET /postcode-lookup` on *every*
  change to postal code, house number, or country rather than debouncing
  them into one call, so a single fill can fire three concurrent lookups
  that resolve out of order. What I couldn't do is pin the fix to one exact
  interleaving: driving the live app's network directly (Resource Timing
  captures plus isolated, one-click-at-a-time reproductions in the actual
  browser) gave inconsistent answers between attempts about which call
  fires when and in what order the responses land, most likely because the
  race depends on real network timing against a shared public demo instance
  rather than on anything deterministic in this suite. Rather than guess at
  one specific sequence I couldn't reliably reproduce on demand,
  `CheckoutPage.fillAddress()` verifies the filled values actually stuck
  once the fill settles and retries the entire fill if the app cleared any
  of them out from under it — a bounded, assertion-backed retry against a
  real, observed app defect (worth a filed bug in a real project), not a
  blind wait or a fragile wait on one specific background call.
- **A hand-typed city/state cannot pass checkout — the server re-derives and
  cross-checks them.** This one didn't show up until the invoice-creation
  step, and it was the most interesting find. `AddressMatchesCountry` (a
  validation rule attached to `billing_country` in `POST /invoices`)
  re-checks the submitted postal code's *format* against the country -
  reusing the same check the postcode-lookup uses - and, if that passes,
  calls the same postcode-lookup service again server-side and rejects the
  order if the submitted `city`/`state` don't match what it derives.
  `FakerPostcodeDriver` seeds its output purely from `country + postcode`
  (deliberately, by its own doc comment: so "a server-side re-lookup
  reproduces the exact same locality the customer saw at checkout"), which
  means it's fully deterministic - but a city/state we invent ourselves has
  effectively no chance of matching it. An earlier version of this suite
  used an intentionally-invalid postal code so the *lookup* would fail
  safely and typed its own street/city/state; that address turned out to
  fail checkout too, for the same underlying reason, just one step later -
  and silently, because `PaymentComponent.finishFunction()`'s
  invoice-creation error handler does nothing on failure, so the UI just
  sits on the payment form with no visible error. The fix: use a genuinely
  valid postal code and let the app's own postcode-autofill populate
  street/city/state, so the address submitted is always exactly the one the
  server will independently re-derive. See `CheckoutPage.fillAddress()` and
  `generateTestAddress()`.
- **The "Finish" button has a real race condition.** In
  `PaymentComponent.finishFunction()`, the payment check
  (`POST /payment/check`) is fired asynchronously but its *not-yet-resolved*
  result is read synchronously, so the first click only ever validates the
  payment — the invoice is created on a second click, once that result has
  arrived. The suite doesn't paper over this with a sleep or a blind retry;
  `CheckoutPage.confirmOrder()` clicks once and waits for the payment-check
  response, then clicks again and waits for the invoice-creation response.
- **The confirmation banner is a reliable, fast element; the nested
  `#invoice-number` span the app's translation source implies is not.**
  Two separate live runs both showed `#order-confirmation` becoming visible
  within ~20ms of the invoice being created, and both runs' own failure
  screenshots plainly show the confirmation text with a real invoice
  number on screen - but `locator('#invoice-number')` reported
  "element(s) not found" for the full length of a 15-second wait in both
  runs. I couldn't pin down why that one nested element isn't reliably
  queryable from outside the app's own source (a sanitizer stripping the
  id from the `[innerHTML]`-bound translation string, a toast that already
  dismissed by the time we look, or something else). Rather than keep
  guessing, `getConfirmedInvoiceNumber()` now waits on and reads from
  `#order-confirmation` itself - the element actually proven visible and
  stable - and pulls the invoice number out of its text with a regex
  instead of depending on the inner span.
- **Access tokens are short-lived.** The assignment brief documents
  `expires_in: 120`, but a live login against the real API returned
  `expires_in: 300` — the suite uses the empirically observed value
  (`ACCESS_TOKEN_TTL_SECONDS` in `utils/env.ts`). The fixture logs in
  immediately before the browser session starts, and the UI flow
  (auto-waiting, no artificial delays) comfortably finishes well inside
  either window. This is worth knowing if the suite is ever extended with
  slower scenarios.
- **Payment method:** bank transfer was chosen for the happy path over
  credit card because its server-side validation is simple, stable pattern
  matching (letters-only bank/holder name, digits-only account number) with
  no date-based logic to keep in sync with "today" — one less moving part
  for the same amount of coverage of the checkout behavior itself.
- **The negative scenario** (empty-cart checkout) was chosen over a payment
  form validation error because it exercises a real, stable business rule
  ("you can't check out nothing") through the same journey the happy path
  uses, rather than a client-side form validation message that says more
  about Angular's reactive forms than about the application's behavior.
- **A real bug, found by the first live run: a session that never created a
  cart crashes the checkout page instead of showing "cart is empty".**
  `CartService.getCart()` resolves to `null` when there's no `cart_id` in
  `sessionStorage`, but `CartComponent.fetchCartItems()` unconditionally
  does `cart.cart_items` on whatever `getCart()` returns — so with a truly
  fresh session that `null` is dereferenced and the step never renders
  either the item table or the "empty" message. The friendly empty-cart
  message only works for a cart that *exists* but has zero items. The
  negative test creates exactly that (`POST /carts`, nothing added) via the
  API rather than relying on a state the app can't actually render — see
  the comment above `tests/checkout.spec.ts`'s empty-cart test for the full
  trace. I didn't file this anywhere outside this repo since it's a
  demo/practice site, but in a real project this would be a filed defect
  with this test as the repro.

## The stability risk I designed around

**A hand-typed billing address can never pass this app's checkout.** The
server re-derives the expected city/state from `country + postcode` and
rejects the order if what's submitted doesn't match (see "Investigation
notes" above) — and it does this silently, with no visible error. Any test
that types its own street/city/state would look reasonable and then fail
checkout unpredictably. The suite avoids this entirely by only ever
submitting an address the app's own postcode-autofill produced, and it
verifies that autofill actually stuck before proceeding (a separate, real
background race — also covered above) rather than trusting it blindly.

## Running the suite

```bash
npm install
npx playwright install --with-deps chromium
npm test                # headless run
npm run test:headed     # see the browser
npm run test:ui         # Playwright's interactive UI mode
npm run report          # open the last HTML report
```

The first `npm install` will generate `package-lock.json`; commit it and the
CI workflow can switch from `npm install` to `npm ci` for stricter,
reproducible installs.

By default the suite targets the public demo instance
(`https://practicesoftwaretesting.com` / `https://api.practicesoftwaretesting.com`).
To point it at a different environment (e.g. a local Docker stack), set:

```bash
UI_BASE_URL=http://localhost:4200 API_BASE_URL=http://localhost:8080 npm test
```

## CI

`.github/workflows/playwright.yml` runs the suite on push/PR against
`chromium`, uploads the HTML report as an artifact, and enables one retry
in CI only (retries are for absorbing incidental network flake against a
shared public demo site, not for hiding a broken test — locally retries are
off so a real failure is seen the first time).

## Failure diagnostics

On failure, Playwright captures a screenshot, a video, and (on retry) a
trace — configured in `playwright.config.ts`. `npx playwright show-trace
<trace.zip>` gives a full step-by-step, network-aware replay of the failure.

## What I'd do next

Given more time, in roughly this order:

- **More negative coverage**: an invalid bank account number/format rejected
  server-side, checking out with a product that goes out of stock mid-flow,
  an expired/invalid access token hitting the API mid-checkout.
- **API-level test suite**: the API alone (registration validation, cart
  quantity limits, payment method-specific validation) is worth its own,
  faster test layer rather than exercising every rule through the UI.
- **Schema validation** for the API responses this suite already touches
  (register/login/invoice), e.g. with a JSON schema or Zod check, so a
  backend contract change fails fast with a precise diff.
- **Cross-browser CI** (WebKit/Firefox projects) and **sharding** once the
  suite has enough tests to make either worthwhile — with three tests,
  either would add CI time without adding much confidence.
- **Additional authentication scenarios** (invalid credentials, locked
  account after repeated failures — the API documents this) as their own
  small, fast suite.
- **Broader regression coverage** of adjacent checkout scenarios (multiple
  items, quantity changes in cart, applied discounts) once the core flow is
  proven stable in CI.

## Requirements traceability

| Requirement | API endpoint |
|---|---|
| Register a unique user | `POST /users/register` |
| Authenticate | `POST /users/login` |
| Add to cart (via UI) | `POST /carts`, `POST /carts/{id}` (triggered by the app, not called directly) |
| Checkout (via UI) | `POST /invoices` |
| Verify order after checkout | `GET /invoices` |
