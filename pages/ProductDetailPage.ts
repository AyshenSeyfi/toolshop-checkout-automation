import { Page, expect } from '@playwright/test';

/** The single-product page - responsible for the "add to cart" behavior. */
export class ProductDetailPage {
  constructor(private readonly page: Page) {}

  get productName() {
    return this.page.getByTestId('product-name');
  }

  private get addToCartButton() {
    return this.page.getByTestId('add-to-cart');
  }

  private get addedToCartToast() {
    // ngx-toastr renders outside the Angular component tree; the CSS class
    // is the stable contract here, the exact copy is not.
    return this.page.locator('.toast-success');
  }

  async addToCart(): Promise<void> {
    await expect(this.productName).toBeVisible();
    await this.addToCartButton.click();
    await expect(this.addedToCartToast).toBeVisible();
  }
}
