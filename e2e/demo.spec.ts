import { expect, test, type Page } from '@playwright/test';

// Scripted demo (text-input path, real Gemini). Records video and saves docs screenshots.
test.use({ video: { mode: 'on', size: { width: 412, height: 915 } }, viewport: { width: 412, height: 915 } });
test.setTimeout(240_000);

async function caption(page: Page, text: string) {
  await page.evaluate((t) => {
    let el = document.getElementById('demo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-caption';
      el.style.cssText =
        'position:fixed;left:12px;right:12px;top:78px;z-index:99;padding:10px 14px;border-radius:12px;background:rgba(31,26,23,.88);color:#fff;font:600 15px/1.35 Mukta,system-ui;box-shadow:0 6px 18px rgba(0,0,0,.25);transition:opacity .2s';
      document.body.appendChild(el);
    }
    el.textContent = t;
    el.style.opacity = t ? '1' : '0';
  }, text);
}

async function shot(page: Page, name: string) {
  await page.evaluate(() => document.getElementById('demo-caption')?.style.setProperty('opacity', '0'));
  await page.waitForTimeout(250);
  await page.screenshot({ path: `docs/screenshots/${name}.png` });
  await page.evaluate(() => document.getElementById('demo-caption')?.style.setProperty('opacity', '1'));
}

async function say(page: Page, text: string) {
  const box = page.getByRole('textbox', { name: 'Type a command' });
  await box.click();
  await box.pressSequentially(text, { delay: 38 });
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Send' }).click();
}

test('demo flow', async ({ page }) => {
  // wa.me cannot open in a headless browser: show the exact message text that would be shared.
  await page.addInitScript(() => {
    window.open = ((url: string) => {
      const text = decodeURIComponent(String(url).split('text=')[1] ?? '');
      const wrap = document.createElement('div');
      wrap.id = 'wa-preview';
      wrap.style.cssText = 'position:fixed;inset:0;z-index:98;background:#e5ddd5;display:flex;flex-direction:column;font:15px/1.4 system-ui';
      wrap.innerHTML = `<div style="background:#075e54;color:#fff;padding:14px 16px;font-weight:600">WhatsApp preview (wa.me link)</div><pre style="margin:16px;padding:12px 14px;background:#dcf8c6;border-radius:10px;white-space:pre-wrap;font:14px/1.45 system-ui;box-shadow:0 1px 1px rgba(0,0,0,.15)"></pre>`;
      wrap.querySelector('pre')!.textContent = text;
      document.body.appendChild(wrap);
      return null;
    }) as typeof window.open;
  });

  await page.goto('/');
  await page.evaluate(() => indexedDB.deleteDatabase('keyval-store'));
  await page.reload();
  await expect(page.getByTestId('today-total')).toBeVisible();
  await caption(page, 'Bolo Khata: a kirana owner speaks, the app writes the bill and the khata.');
  await page.waitForTimeout(3500);
  await shot(page, '01-home');

  await caption(page, 'Voice or typing, in Hinglish. (This recording uses the typed path.)');
  await say(page, 'do kilo atta aur ek Amul doodh, Sharma ji ke khate mein likh do');
  await expect(page.getByTestId('bill-total')).toBeVisible({ timeout: 20_000 });
  await caption(page, 'Gemini understands the items, customer and udhaar. Prices come from the shop catalogue.');
  await page.waitForTimeout(2500);
  await shot(page, '02-bill');
  await page.getByRole('button', { name: 'More Amul Taaza Milk 500 ml' }).click();
  await caption(page, 'Every line is editable before saving.');
  await page.waitForTimeout(1800);
  await page.getByRole('button', { name: /Save bill/ }).click();
  await caption(page, 'Saved. Stock goes down, Sharma ji’s khata goes up.');
  await page.waitForTimeout(1800);
  await shot(page, '03-saved');
  await page.getByRole('button', { name: /Send on WhatsApp/ }).click();
  await caption(page, '');
  await page.waitForTimeout(3500);
  await shot(page, '04-whatsapp');
  await page.evaluate(() => document.getElementById('wa-preview')?.remove());
  await page.getByRole('button', { name: /Next customer/ }).click();

  await caption(page, 'Marathi works too, and items not in the list are flagged, never dropped.');
  await say(page, 'don kilo sakhar ani 2 Kurkure dya, GPay');
  await expect(page.getByTestId('bill-total')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  await shot(page, '05-unknown-item');
  await page.getByRole('textbox', { name: /Price of/ }).pressSequentially('20', { delay: 120 });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Save bill/ }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Next customer/ }).click();

  await caption(page, 'Udhaar repayments by voice.');
  await say(page, 'Gupta aunty ne 300 jama kiye');
  await expect(page.getByRole('dialog', { name: 'Record payment' })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1800);
  await page.getByRole('button', { name: /Record payment/ }).click();
  await page.waitForTimeout(2200);

  await caption(page, 'Questions get a spoken Hindi answer (speechSynthesis, hi-IN).');
  await say(page, 'Sharma ji pe kitna udhaar hai?');
  await expect(page.getByTestId('feedback')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(3000);
  await shot(page, '06-answer');
  await say(page, 'kya khatam ho raha hai?');
  await expect(page.getByTestId('feedback')).toContainText('running low', { timeout: 20_000 });
  await page.waitForTimeout(3200);

  await caption(page, 'Deliveries update stock the same way.');
  await say(page, 'supplier se 10 packet Tata chai patti aayi');
  await expect(page.getByRole('dialog', { name: 'Add stock' })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1800);
  await page.getByRole('button', { name: /Add to stock/ }).click();
  await page.waitForTimeout(1500);

  await caption(page, 'The khata: who owes what, with history and a WhatsApp reminder.');
  await page.getByRole('button', { name: /Ledger/ }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Sharma ji/ }).click();
  await page.waitForTimeout(2500);
  await shot(page, '07-khata');

  await caption(page, 'Stock with low-stock flags. All data stays on this phone.');
  await page.getByRole('button', { name: /Stock/ }).click();
  await page.waitForTimeout(2500);
  await shot(page, '08-stock');

  await caption(page, 'Today at a glance.');
  await page.getByRole('button', { name: /Speak/ }).click();
  await page.waitForTimeout(3000);
  await shot(page, '09-today');
  await caption(page, 'Bolo Khata. Bolo, bill ban gaya.');
  await page.waitForTimeout(3000);
});
