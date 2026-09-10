import { APIRequestContext, expect } from '@playwright/test';
import { TestUser } from '../utils/test-data';

export interface LoginResult {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

/**
 * Registers a brand-new user via the API. This is test *setup*, not the
 * behavior under test - we never register through the UI when the goal is
 * to exercise checkout, so registration is a fast, deterministic API call.
 */
export async function registerUser(request: APIRequestContext, user: TestUser): Promise<void> {
  const response = await request.post('/users/register', {
    data: {
      first_name: user.firstName,
      last_name: user.lastName,
      email: user.email,
      password: user.password,
    },
  });

  expect(response.status(), `User registration failed: ${await response.text()}`).toBe(201);
}

/** Logs in via the API and returns the bearer token the UI session will use. */
export async function loginUser(request: APIRequestContext, user: TestUser): Promise<LoginResult> {
  const response = await request.post('/users/login', {
    data: {
      email: user.email,
      password: user.password,
    },
  });

  expect(response.ok(), `Login failed: ${await response.text()}`).toBeTruthy();
  const body = await response.json();

  return {
    accessToken: body.access_token,
    tokenType: body.token_type,
    expiresIn: body.expires_in,
  };
}
