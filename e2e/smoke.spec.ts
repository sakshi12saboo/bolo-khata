import { expect, test } from '@playwright/test';

// Real end-to-end: the local server calls Gemini for the typed command.
test('type a sale, confirm the bill, see it in the ledger', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => indexedDB.deleteDatabase('keyval-store'));
  await page.reload();

  await expect(page.getByTestId('today-total')).toHaveText('₹0');

  await page.getByRole('button', { name: /Ledger/ }).click();
  const before = await page.getByTestId('balance-Sharma ji').innerText();
  expect(before).toBe('₹581');
  await page.getByRole('button', { name: /Speak/ }).click();

  await page.getByRole('textbox', { name: 'Type a command' }).fill('teen Maggi aur ek Parle-G, Sharma ji ke khate mein likh do');
  await page.getByRole('button', { name: 'Send' }).click();

  const bill = page.getByRole('dialog');
  await expect(bill).toBeVisible();
  await expect(bill.getByText('Maggi Noodles')).toBeVisible();
  await expect(bill.getByText('Parle-G Biscuit')).toBeVisible();
  await expect(bill.getByTestId('bill-total')).toHaveText('₹52');
  await expect(bill.getByRole('button', { name: /Udhaar/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(bill.getByRole('combobox')).toHaveValue('c-sharma');

  await bill.getByRole('button', { name: /Save bill/ }).click();
  await expect(page.getByRole('dialog', { name: /saved/ })).toBeVisible();
  await page.getByRole('button', { name: /Next customer/ }).click();

  await expect(page.getByTestId('today-total')).toHaveText('₹52');
  await page.getByRole('button', { name: /Ledger/ }).click();
  await expect(page.getByTestId('balance-Sharma ji')).toHaveText('₹633');

  await page.getByRole('button', { name: /Stock/ }).click();
  await page.getByPlaceholder(/Search/).fill('maggi');
  await expect(page.locator('.item', { hasText: 'Maggi Noodles' }).locator('.item__stock')).toHaveText('45 pkt');

  // survives a reload (IndexedDB)
  await page.reload();
  await expect(page.getByTestId('today-total')).toHaveText('₹52');
});
