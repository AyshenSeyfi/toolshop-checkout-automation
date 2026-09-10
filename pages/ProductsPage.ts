import { Page, expect } from '@playwright/test';

/**
 * The product catalog / home page.
 *
 * Only responsible for browsing and picking a product - it doesn't know or
 * care about cart/checkout, keeping it focused and reusable.
 */
export class ProductsPage {
  constructor(private readonly page: Page) {}

  /**
   * Waits for the actual product list response, not just navigation, before
   * returning.
   *
   * A live run failed here with "element(s) not found" after the default
   * 5s wait - the failure screenshot showed the page fully loaded (nav,
   * sort, price filter all rendered) but the product cards themselves were
   * still skeleton placeholders. The catalog fetch to the public demo can
   * simply take longer than 5s sometimes; waiting on the real `GET
   * /products` response (rather than a longer guessed timeout) ties this
   * to the actual thing we're waiting for.
   */
  async open(): Promise<void> {
    const productsLoaded = this.page.waitForResponse(
      (response) => /\/products(\?|$)/.test(response.url()) && response.request().method() === 'GET'
    );
    await this.page.goto('/');
    await productsLoaded;
  }

  /**
   * Picks the first in-stock product card and opens its detail page.
   *
   * We don't care *which* product - only that the checkout journey works
   * for a purchasable one - so we deliberately avoid hardcoding a product
   * name or id, which would make the test brittle against catalog changes.
   */
  async openFirstInStockProduct(): Promise<void> {
    const inStockProducts = this.page
      .locator('a[data-test^="product-"]')
      .filter({ hasNot: this.page.getByTestId('out-of-stock') });

    // The response resolving doesn't guarantee Angular has rendered the
    // cards yet - a generous but bounded timeout absorbs that render step
    // without masking a genuine failure.
    await expect(inStockProducts.first()).toBeVisible({ timeout: 10_000 });
    await inStockProducts.first().click();
  }
}
