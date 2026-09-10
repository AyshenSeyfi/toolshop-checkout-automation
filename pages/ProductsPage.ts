import { Page, expect } from '@playwright/test';

/**
 * The product catalog / home page.
 *
 * Only responsible for browsing and picking a product - it doesn't know or
 * care about cart/checkout, keeping it focused and reusable.
 */
export class ProductsPage {
  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto('/');
  }

  /**
   * Picks the first in-stock product card and opens its detail page.
   *
   * We don't care *which* product - only that the checkout journey works
   * for a purchasable one - so we deliberately avoid hardcoding a product
   * name or id, which would make the test brittle against catalog changes.
   *
   * This used to also wait on a `GET /products` network response before
   * checking visibility, on the theory that a slow catalog fetch (confirmed
   * against the shared demo - see README) was the whole problem. A later
   * run proved that theory only half right: its failure video showed the
   * catalog fully loaded with real product images by the time Playwright
   * gave up waiting on that network promise, which never resolved anyway -
   * so the network wait was itself unreliable here, for a reason I
   * couldn't pin down further (most likely something about how this SPA's
   * request doesn't match the way `page.goto` and `waitForResponse` line
   * up). Waiting directly on the thing we actually need - the card being
   * visible - with a generous timeout is both simpler and, as it turns
   * out, more trustworthy than trying to synchronize on the network call
   * behind it.
   */
  async openFirstInStockProduct(): Promise<void> {
    const inStockProducts = this.page
      .locator('a[data-test^="product-"]')
      .filter({ hasNot: this.page.getByTestId('out-of-stock') });

    await expect(inStockProducts.first()).toBeVisible({ timeout: 45_000 });
    await inStockProducts.first().click();
  }
}
