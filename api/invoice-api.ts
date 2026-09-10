import { APIRequestContext, expect } from '@playwright/test';

export interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  total: number;
  billing_country: string;
  billing_postal_code: string;
  [key: string]: unknown;
}

/**
 * Looks up the invoice the UI just showed a confirmation number for.
 *
 * There is no `/orders` resource in this API - checkout creates an
 * "invoice" (see routes/api.php + InvoiceController), and `GET /invoices`
 * is scoped server-side to the authenticated user, which is exactly the
 * isolation we want: a freshly registered test user can only ever see the
 * invoice(s) it just created, so there's no risk of reading another test's
 * data even under parallel execution.
 */
export async function findInvoiceByNumber(
  request: APIRequestContext,
  accessToken: string,
  invoiceNumber: string
): Promise<Invoice> {
  const response = await request.get('/invoices', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  expect(response.ok(), `Fetching invoices failed: ${await response.text()}`).toBeTruthy();
  const body = await response.json();
  const invoice = (body.data as Invoice[]).find((inv) => inv.invoice_number === invoiceNumber);

  expect(invoice, `Invoice ${invoiceNumber} was not found via the API for this user`).toBeTruthy();
  return invoice as Invoice;
}
