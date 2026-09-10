# Submission notes

## Key technical decisions and design choices

- **Playwright + TypeScript**, with a lean Page Object Model — one
  `CheckoutPage` class covering the whole cart → sign-in → address →
  payment wizard, rather than one class per step, since all four steps
  share a single URL/component tree and are only ever driven together.
- **API for setup, UI for the behavior under test**: user registration and
  login (and cart creation, in the negative test) go through the API;
  browsing, adding to cart, and the checkout wizard itself are driven
  through the UI, since checkout is what's actually being tested.
- **One negative scenario** — checking out with an empty cart — chosen over
  a payment-form validation error because it exercises a real, stable
  business rule end-to-end rather than a client-side form message.
- **One API-level assertion after UI checkout**: fetches the created
  invoice back via `GET /invoices` and asserts on the address and total,
  proving the order was actually recorded, not just that the UI said so.
- **Isolation**: every test generates a unique user and address; the app
  itself deletes the cart server-side on a successful checkout, so there's
  no manual cleanup needed; `fullyParallel: true` in the Playwright config.
- **Failure diagnostics**: screenshot + video on every failure, trace on
  retry, all wired through `playwright.config.ts`; base URLs come from env
  vars (`utils/env.ts`), not hardcoded.

## Assumptions, trade-offs, and planning

- Time-boxed to ~4 hours, so I optimized for one deep, reliable path over
  broad coverage — see "What I'd do next" in the README for what I
  deliberately left out (more negative cases, cross-browser, schema
  validation, a separate API test layer).
- Bank transfer was chosen as the payment method for the happy path over
  credit card, since its server-side validation is simpler and has no
  date-based logic to keep in sync with "today."
- The assignment brief documents the login API's `expires_in` as 120
  seconds; a real login call returned 300. I used the empirically observed
  value rather than the documented one (see README).

## Challenges encountered and how I addressed them

Rather than guess at selectors or endpoints, I cloned the app's public
open-source repo to read the actual Angular/Laravel source before writing
any locators, and — once real test runs started failing — drove a live
browser session against the actual deployed app to inspect real network
timing and DOM state. That surfaced several genuine, undocumented app
behaviors and a couple of real bugs:

- A last-name length limit (`max:20`) that a naive unique-suffix strategy
  could exceed.
- A real crash bug: a browser session that never created a cart at all
  throws before the "cart is empty" message can render. The negative test
  works around this by creating a genuinely empty cart via the API instead.
- The billing address form's postcode-autofill can silently clear fields
  it had just filled, due to the app re-issuing the postcode lookup once
  per field change instead of debouncing it into one call. I couldn't
  pin the exact interleaving down reliably across live runs, so instead
  of a guessed timing fix, `fillAddress()` verifies the filled values
  actually stuck and retries the whole fill if the app clears them.
- A hand-typed city/state can never pass checkout — the server
  deterministically re-derives them from country + postcode and rejects
  the order silently if they don't match. Fixed by only ever submitting
  the address the app's own autofill produced.
- A real double-click race in the "Finish" button (the first click only
  validates payment; the invoice is created on the second click, once
  the first response has arrived) — solved by synchronizing on the two
  actual network responses instead of guessing a delay.
- The confirmation banner's nested `#invoice-number` element, implied by
  the app's own translation source, never reliably appeared in two live
  runs even though the banner itself did (both times, with the invoice
  number plainly visible). Rather than keep guessing why, the test now
  reads the invoice number from the banner's own visible text.

## How AI was used

- I used Claude (via Claude Code / Cowork) throughout this assignment —
  for scaffolding the suite (page objects, fixtures, API helpers, config),
  and as an interactive debugging partner against my own real test runs.
- I had it ground every locator and API assumption in the app's actual
  source and in live behavior (cloning the app's repo, and later driving
  a real browser session against the deployed app) rather than letting it
  guess, since this is a live app I didn't want to make assumptions about.
- The process was iterative: I ran `npm test` myself, repeatedly, and fed
  the actual failures (error output, screenshots, trace context) back;
  Claude diagnosed root causes from that evidence and proposed fixes,
  which I then re-tested.
- Not every first theory was right — an early hypothesis about a duplicate
  `/users/me` API call racing the address form turned out to be wrong once
  tested live, and was replaced with a more defensible fix (verifying the
  filled values stuck, rather than waiting on a specific guessed network
  call). I mention this because it's a fair example of AI-assisted output
  needing to be checked against real behavior, not accepted on the first
  explanation.
- *[Add your own note here on what you personally reviewed, ran, or
  changed before submitting — e.g. which parts you re-read line by line,
  anything you'd have written differently, or any edits you made
  yourself.]*
