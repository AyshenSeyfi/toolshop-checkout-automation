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
   */
  async openFirstInStockProduct(): Promise<void> {
    const inStockProducts = this.page
      .locator('a[data-test^="product-"]')
      .filter({ hasNot: this.page.getByTestId('out-of-stock') });

    await expect(inStockProducts.first()).toBeVisible();
    await inStockProducts.first().click();
  }
}
