import { APIRequestContext, expect } from '@playwright/test';

/**
 * Creates a fresh, empty cart via the API (no auth required - `CartController`
 * has no auth middleware). Used only to put the browser into a specific,
 * deterministic state for the empty-cart negative scenario: see
 * `tests/checkout.spec.ts` for why this is needed rather than simply never
 * visiting a product page.
 */
export async function createEmptyCart(request: APIRequestContext): Promise<string> {
  const response = await request.post('/carts');
  expect(response.status(), `Cart creation failed: ${await response.text()}`).toBe(201);
  const body = await response.json();
  return body.id;
}
