/**
 * Deterministic-enough, collision-resistant test data generation.
 *
 * No shared fixtures like "testuser@test.com" — every caller gets a unique
 * identity, so tests stay independent under repeated runs, parallel workers,
 * and future CI shards.
 */

function uniqueSuffix(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1_000_000);
  return `${timestamp}_${random}`;
}

export interface TestUser {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

/**
 * Builds a unique registrant for API-based user setup.
 *
 * Only `email` needs to be unique - the API enforces `unique:users,email`
 * but has no such constraint on the name fields, so the suffix lives there
 * only. `last_name` is capped at 20 chars server-side (`max:20`); keeping it
 * a short fixed string avoids tripping that limit as the unique suffix
 * grows (a `Date.now()` + random suffix alone can exceed 20 chars).
 *
 * Password satisfies the API's documented policy: min 8 chars, upper, lower,
 * number, symbol.
 */
export function generateTestUser(): TestUser {
  const suffix = uniqueSuffix();
  return {
    firstName: 'QA',
    lastName: 'Automation',
    email: `test_${suffix}@example.com`,
    password: 'Qa!Automation1',
  };
}

export interface TestAddress {
  country: string;
  postalCode: string;
  houseNumber: string;
}

/**
 * A billing address for checkout - deliberately holding only what a
 * customer picks (country, postal code, house number), not street/city/
 * state.
 *
 * Those three are populated by the app's own postcode-autofill once all
 * three of these are entered (see CheckoutPage.fillAddress()), and it turns
 * out that's not just a UI nicety: `FakerPostcodeDriver` derives
 * street/city/state deterministically from `country + postcode` alone, and
 * `AddressMatchesCountry` re-runs that exact derivation server-side when
 * the order is submitted, rejecting it if the submitted city/state don't
 * match. A hand-typed city/state would have to coincidentally match a
 * seeded Faker output to ever pass - so the only address guaranteed to
 * clear checkout is the one the app fills in itself. `postalCode` is a
 * genuinely valid US ZIP so that autofill actually succeeds (see README
 * "Investigation notes" for the full trace of the bug this replaced).
 */
export function generateTestAddress(): TestAddress {
  return {
    country: 'US',
    postalCode: '90210',
    houseNumber: '42',
  };
}
