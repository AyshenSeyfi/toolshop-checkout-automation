import { test, expect } from '../fixtures/auth.fixture';
import { ProductsPage } from '../pages/ProductsPage';
import { ProductDetailPage } from '../pages/ProductDetailPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { generateTestAddress } from '../utils/test-data';
import { findInvoiceByNumber } from '../api/invoice-api';
import { createEmptyCart } from '../api/cart-api';

test.describe('Checkout - happy path', () => {
  test('a newly created user completes checkout for at least one product and sees an order confirmation', async ({
    page,
    auth,
    apiContext,
  }) => {
    const address = generateTestAddress();
    const products = new ProductsPage(page);
    const productDetail = new ProductDetailPage(page);
    const checkout = new CheckoutPage(page);

    await test.step('Browse the catalog and add a product to the cart (behavior under test)', async () => {
      await products.open();
      await products.openFirstInStockProduct();
      await productDetail.addToCart();
    });

    await test.step('Complete checkout through the UI (behavior under test)', async () => {
      await checkout.open();
      await checkout.proceedFromCart();
      await checkout.proceedFromSignIn();
      await checkout.fillAddress(address);
      await checkout.proceedFromAddress();
      await checkout.payByBankTransfer({
        bankName: 'Test Bank',
        accountName: `${auth.user.firstName} ${auth.user.lastName}`,
        accountNumber: '1234567890',
      });
      await checkout.confirmOrder();
    });

    const invoiceNumber = await test.step('Verify order confirmation in the UI', async () => {
      await expect(checkout.orderConfirmation).toBeVisible();
      const number = await checkout.getConfirmedInvoiceNumber();
      expect(number).toMatch(/^INV-/);
      return number;
    });

    await test.step('Verify the order was recorded via the API', async () => {
      const invoice = await findInvoiceByNumber(apiContext, auth.accessToken, invoiceNumber);

      // We assert on data we control (the address we typed) and on the
      // order being real/priced, rather than on `status`: status advances
      // from AWAITING_FULFILLMENT via a backend cron (order:update) that
      // runs on its own schedule, so pinning an exact value here would
      // couple the test to timing we don't control.
      expect(invoice.billing_country).toBe(address.country);
      expect(invoice.billing_postal_code).toBe(address.postalCode);
      expect(invoice.total).toBeGreaterThan(0);
    });
  });
});

test.describe('Checkout - empty cart', () => {
  /**
   * API setup here creates a cart with zero items via `POST /carts` (no
   * auth needed - CartController has no auth middleware) and seeds its id
   * into sessionStorage the same way the app itself would.
   *
   * This is deliberate, not incidental. A brand-new browser context also
   * has no cart at all, which looks like an equally valid (and cheaper) way
   * to reach this scenario - but it isn't, because of a real bug this
   * suite's first run against the live app surfaced:
   *
   *   CartComponent.fetchCartItems() does
   *     this.cartService.getCart().subscribe(cart => {
   *       this.cart = cart;
   *       this.total = this.calculateTotal(cart.cart_items);   // <- throws
   *     ...
   *   and CartService.getCart() resolves to `null` (not an empty cart
   *   object) when there is no `cart_id` in sessionStorage at all.
   *   Dereferencing `cart.cart_items` on that `null` throws before the
   *   "cart is empty" branch of the template ever gets a chance to render -
   *   so a session that has *never* created a cart doesn't show the
   *   friendly empty-cart message; it silently fails to render the step.
   *
   * That's a genuine defect in the app, not a timing issue, so working
   * around it with a longer timeout or a retry would hide a bug rather than
   * produce a reliable test. The empty-cart message *does* work correctly
   * for the case the app actually handles: a cart that exists but has zero
   * items (e.g. everything in it was removed, or - as here - a cart was
   * created and nothing was ever added to it). That's the meaningful,
   * stable negative scenario this test exercises.
   */
  test('checkout blocks proceeding when the cart has no items', async ({ page, apiContext }) => {
    const cartId = await createEmptyCart(apiContext);

    // sessionStorage must be set before the Angular app's first script runs -
    // same reasoning as the auth fixture's use of addInitScript for
    // localStorage.
    await page.addInitScript((id) => window.sessionStorage.setItem('cart_id', id), cartId);

    const checkout = new CheckoutPage(page);
    await checkout.open();

    await expect(checkout.emptyCartMessage).toBeVisible();
    await expect(checkout.proceedFromCartButton).toHaveCount(0);
  });
});
