import { test as base, request as playwrightRequest, APIRequestContext } from '@playwright/test';
import { API_BASE_URL, AUTH_TOKEN_STORAGE_KEY } from '../utils/env';
import { generateTestUser, TestUser } from '../utils/test-data';
import { registerUser, loginUser } from '../api/user-api';

export interface AuthSession {
  user: TestUser;
  accessToken: string;
}

interface Fixtures {
  /** API-only request context, pointed at the backend (separate host from the UI). */
  apiContext: APIRequestContext;
  /** A unique test user's credentials, generated but not yet registered. */
  testUser: TestUser;
  /**
   * Registers + logs in `testUser` via the API, then seeds the browser page
   * with the resulting token so the app renders as already signed in.
   *
   * This is the "API setup -> authenticated UI session" step from the
   * happy-path design: no test ever drives the registration or login forms
   * through the UI, because that would just be re-testing auth on every
   * checkout test instead of testing checkout.
   */
  auth: AuthSession;
}

export const test = base.extend<Fixtures>({
  apiContext: async ({}, use) => {
    const context = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    await use(context);
    await context.dispose();
  },

  testUser: async ({}, use) => {
    await use(generateTestUser());
  },

  auth: async ({ apiContext, testUser, page }, use) => {
    await registerUser(apiContext, testUser);
    const login = await loginUser(apiContext, testUser);

    // page.addInitScript runs before any script on the page's future
    // navigations - registering it now (page is still blank) guarantees the
    // token is in localStorage before the app's first navigation, so route
    // guards and the header's "logged in" state see it immediately.
    await page.addInitScript(
      ([key, token]) => window.localStorage.setItem(key, token),
      [AUTH_TOKEN_STORAGE_KEY, login.accessToken]
    );

    await use({ user: testUser, accessToken: login.accessToken });
  },
});

export { expect } from '@playwright/test';
