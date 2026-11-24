import { expect, test, type Locator, type Page } from '@playwright/test';
import { SLOW_PREFIX, WALLET } from './fixture';

const PHONE = { width: 390, height: 844 };
const TABLET = { width: 744, height: 1133 };
const DESKTOP = { width: 1440, height: 900 };

// A transparent 1×1 PNG, so logos load without reaching the real static host.
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

test.beforeEach(async ({ page }) => {
  await page.route('https://static.chaintable.com/**', (route) => route.fulfill({ body: PIXEL, contentType: 'image/png' }));
});

const openWallet = async (page: Page, search = '') => {
  await page.goto(`/${WALLET}${search}`);
  await expect(page.locator('.layer').first()).toBeVisible();
};

const expectNoHorizontalScroll = async (page: Page) => {
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll).toBeLessThanOrEqual(client);
};

for (const viewport of [PHONE, TABLET, DESKTOP]) {
  test.describe(`at ${viewport.width}px`, () => {
    test.use({ viewport });

    test('every layer is tall enough to show its chain logo', async ({ page }) => {
      await openWallet(page);
      const layers = page.locator('.layer');
      await expect(layers).toHaveCount(3);
      for (const layer of await layers.all()) {
        expect(Math.round((await layer.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
        expect((await layer.locator('img').boundingBox())!.height).toBeCloseTo(20, 1);
      }
    });

    test('an absurd token balance does not stretch the page', async ({ page }) => {
      await openWallet(page);
      await expectNoHorizontalScroll(page);
    });

    test('pages show the site icon', async ({ page }) => {
      for (const path of ['/', '/coverage', `/${WALLET}`, '/definitely-not-a-name.eth']) {
        await page.goto(path);
        await expect(page.locator('.mark img').first()).toBeVisible();
        await expectNoHorizontalScroll(page);
      }
    });
  });
}

test('loads no analytics outside Vercel', async ({ page }) => {
  await openWallet(page);
  await expect(page.locator('script[src*="insights"]')).toHaveCount(0);
});

test('selecting a chain keeps its height and hides the others', async ({ page }) => {
  await openWallet(page);
  const base = page.locator('.layer', { hasText: 'Base' });
  const height = (await base.boundingBox())!.height;
  await base.click();
  await expect(page).toHaveURL(/chain=base/);
  await expect(page.locator('.layer')).toHaveCount(1);
  expect((await base.boundingBox())!.height).toBeCloseTo(height, 1);
  await base.click();
  await expect(page.locator('.layer')).toHaveCount(3);
});

test('copies a runnable curl command from a data source panel', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openWallet(page);
  await page.getByRole('button', { name: 'Data source' }).first().click();
  await page.getByRole('button', { name: 'Copy as curl' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(WALLET);
});

// Column widths use ch, which follows each row's font size, so rows of one table must share a font size or their columns drift apart.
test('position detail rows share the font size their column widths depend on', async ({ page }) => {
  await openWallet(page);
  await page.locator('.position:not(.token-group)').first().click();
  const sizes = await page.locator('.ledger-row').evaluateAll((rows) => rows.map((row) => getComputedStyle(row).fontSize));
  expect(new Set(sizes).size).toBe(1);
});

test.describe('wallet story on the page', () => {
  const tab = (page: Page, name: string) => page.locator('.lead').getByRole('button', { name });
  const history = (page: Page) => page.getByRole('region', { name: 'Wallet history by year' });

  test('switches the total and the layers, leaving the tables', async ({ page }) => {
    await openWallet(page);
    await tab(page, 'Story').click();
    await expect(page).toHaveURL(/\?card=story$/);
    await expect(page.locator('.lead h1')).toHaveText(/^\d+ (year|month)s?$/);
    await expect(page.locator('.lead .note').first()).toContainText('On-chain since Mar 5, 2019 across 3 chains.');
    await expect(history(page).locator('.layer')).toHaveCount(2);
    await expect(history(page).locator('.layer').first()).toContainText('2023');
    await expect(page.getByRole('heading', { name: 'Tokens' })).toBeVisible();
    await tab(page, 'Portfolio').click();
    await expect(history(page)).toHaveCount(0);
    await expect(page.locator('.lead h1')).toHaveText(/^\$/);
  });

  test('opens from a shared link and stays in step with the share dialog', async ({ page }) => {
    await openWallet(page, '?chain=base&card=story');
    await expect(history(page)).toBeVisible();
    await expect(tab(page, 'Story')).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Story' })).toHaveAttribute('aria-pressed', 'true');
  });

  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    test(`keeps everything below the layers in place at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openWallet(page);
      const tokensTop = async () => (await page.getByRole('heading', { name: 'Tokens' }).boundingBox())!.y;
      const portfolio = await tokensTop();
      await tab(page, 'Story').click();
      await expect(history(page)).toBeVisible();
      expect(Math.abs((await tokensTop()) - portfolio)).toBeLessThanOrEqual(1);
    });
  }

  test('draws the selection line close to the label while keeping the touch target', async ({ page }) => {
    await openWallet(page, '?card=story');
    const button = await tab(page, 'Story').boundingBox();
    const gap = await tab(page, 'Story').locator('span').evaluate((e) => { const range = document.createRange(); range.selectNodeContents(e); return e.getBoundingClientRect().bottom - 2 - range.getBoundingClientRect().bottom; });
    expect(button!.height).toBeGreaterThanOrEqual(44);
    expect(gap).toBeLessThanOrEqual(6);
  });

  for (const width of [320, 360, 375, 390, 430, 768, 1280]) {
    test(`keeps the switch on the address row, lined up with Share, at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openWallet(page, '?card=story');
      const share = (await page.getByRole('button', { name: 'Share', exact: true }).boundingBox())!;
      const last = (await tab(page, 'Story').boundingBox())!;
      const address = (await page.locator('.lead .addr').boundingBox())!;
      expect(last.x + last.width).toBeCloseTo(share.x + share.width, 0);
      expect(Math.abs((address.y + address.height / 2) - (last.y + last.height / 2))).toBeLessThanOrEqual(3);
      await expect(page.locator('.lead .addr')).toContainText('…');
      expect(address.x + address.width).toBeLessThanOrEqual(last.x);
      await expectNoHorizontalScroll(page);
    });
  }

  test('has no layer to filter by, so a year does not act as a button', async ({ page }) => {
    await openWallet(page, '?card=story');
    await expect(history(page).getByRole('button')).toHaveCount(0);
  });

  test('stays on the story when the chains section is hidden, with only the layers gone', async ({ page }) => {
    await page.goto(`/${WALLET}?hide=chains&card=story`);
    await expect(page.locator('.lead h1')).toHaveText(/^\d+ (year|month)s?$/);
    await expect(tab(page, 'Story')).toHaveAttribute('aria-pressed', 'true');
    await expect(history(page)).toHaveCount(0);
    await tab(page, 'Portfolio').click();
    await expect(page.locator('.lead h1')).toHaveText(/^\$/);
    await expect(page.locator('.layer')).toHaveCount(0);
  });

  for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 744, height: 1000 }]) {
    test(`fits at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openWallet(page, '?card=story');
      await expect(tab(page, 'Story')).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
});

test('serves the wallet page as Markdown', async ({ request }) => {
  const res = await request.get(`/${WALLET}/intro.md`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/plain');
  expect(res.headers()['x-robots-tag']).toBe('noindex');
  const text = await res.text();
  expect(text).toContain('## Portfolio');
  expect(text).toContain('## Risks');
  expect(text).toContain('## Story');
  expect(text).toContain(`/${WALLET}`);
});

test('declares the Markdown version on the wallet page', async ({ page }) => {
  await openWallet(page);
  await expect(page.locator('link[rel="alternate"][type="text/markdown"]')).toHaveAttribute('href', new RegExp(`/${WALLET}/intro\\.md$`));
});

test('has no Markdown for something that is not a wallet', async ({ request }) => {
  expect((await request.get('/not-a-wallet/intro.md')).status()).toBe(404);
});

test('draws the seven-day trend under the total, in both Portfolio and Story', async ({ page }) => {
  await openWallet(page);
  const curve = page.locator('.value-curve');
  await expect(curve.locator('path').first()).toBeAttached();
  // It sits in the box the total occupies: it takes no room of its own, so the chapter keeps the height its text gives it.
  const layout = await curve.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const lead = el.closest('.lead')!.getBoundingClientRect();
    return { position: getComputedStyle(el).position, inLead: box.top >= lead.top && box.bottom <= lead.bottom + 1 };
  });
  expect(layout).toEqual({ position: 'absolute', inLead: true });
  await page.locator('.lead').getByRole('button', { name: 'Story' }).click();
  await expect(curve.locator('path').first()).toBeAttached();
});

test('draws both sides of a comparison mirrored, so they meet at the newest point', async ({ page }) => {
  await openWallet(page);
  const href = page.url().replace(/\/portfolio.*$/, '');
  await page.goto(`${href}/vs/0xd8da6bf26964af9d7eed9e03e53415d37aa96045`, { waitUntil: 'networkidle' });
  const curves = page.locator('.vs-curve svg');
  await expect(curves).toHaveCount(2);
  const [left, right] = [await curves.first().getAttribute('viewBox'), await curves.last().getAttribute('viewBox')];
  expect(left).toBe(right);
  // The right side's shape is mirrored: its first point sits on the right edge of its box.
  const paths = await page.locator('.vs-curve path').evaluateAll((nodes) => nodes.map((n) => n.getAttribute('d')!));
  expect(Math.max(...paths.map((d) => Number(d.match(/M([\d.]+),/)![1])))).toBe(100);
  // Both sides read their own marks, not just the left one.
  for (const side of [0, 1]) {
    const box = (await page.locator('.vs-side').nth(side).boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.7);
    await expect(page.locator('.value-curve-label')).toBeVisible();
  }
});

test('draws the trend in once, and leaves it still when motion is reduced', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWallet(page);
  const plate = page.locator('.value-curve-plate').first();
  await expect(plate).toHaveCSS('animation-name', 'none');
  await expect(plate).toHaveCSS('clip-path', 'none');
});

test('reads one mark while pointing at the trend, and lets go when the pointer leaves', async ({ page }) => {
  await openWallet(page);
  await expect(page.locator('.value-curve path').first()).toBeAttached();
  const body = (await page.locator('.lead-body').boundingBox())!;
  await page.mouse.move(body.x + body.width * 0.6, body.y + body.height * 0.75);
  const label = page.locator('.value-curve-label');
  await expect(label).toBeVisible();
  await expect(label).toContainText('$');
  await expect(page.locator('.value-curve-dot')).toHaveCount(1);
  await page.mouse.move(0, 0);
  await expect(label).toHaveCount(0);
});

test('serves the value at each four-hour mark of the last seven days, cached until the next mark', async ({ request }) => {
  const res = await request.get(`/${WALLET}/history.json`);
  expect(res.status()).toBe(200);
  expect(Number(res.headers()['cache-control'].match(/s-maxage=(\d+)/)![1])).toBeGreaterThan(60);
  const { points } = await res.json() as { points: { time: string; value: number | null }[] };
  expect(points.length).toBeGreaterThan(36);
  expect(points.at(-1)!.time < new Date().toISOString()).toBe(true);
  expect(points.every((p) => /T(00|04|08|12|16|20):00:00Z$/.test(p.time))).toBe(true);
  // The mock values every chain the same on every day, so each point is that value summed over the wallet's chains.
  expect(new Set(points.map((p) => p.value)).size).toBe(1);
  expect(points[0].value).toBeGreaterThan(0);
  expect((await request.get('/not-a-wallet/history.json')).status()).toBe(404);
});

test.describe('top bar on a narrow phone', () => {
  test('keeps the icon and every action on one row, naming the site for screen readers', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await openWallet(page);
    expect((await page.locator('.top').boundingBox())!.height).toBeLessThanOrEqual(68);
    await expect(page.locator('.mark img').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open Portfolio' }).first()).toBeAttached();
    await expectNoHorizontalScroll(page);
  });

  test('shows the name again once it fits', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 932 });
    await openWallet(page);
    expect((await page.locator('.mark-text').first().boundingBox())!.width).toBeGreaterThan(100);
    expect((await page.locator('.top').boundingBox())!.height).toBeLessThanOrEqual(68);
  });
});

test.describe('coverage top bar', () => {
  for (const viewport of [{ width: 1440, height: 500 }, { width: 375, height: 500 }]) {
    test(`names the page once its title has scrolled away at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/coverage');
      const title = page.locator('.top').getByText('Coverage', { exact: true });
      await expect(title).toBeHidden();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect(title).toBeVisible();
      expect((await page.locator('.top').boundingBox())!.height).toBeLessThanOrEqual(68);
      await expectNoHorizontalScroll(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(title).toBeHidden();
    });
  }
});

test.describe('phone ergonomics', () => {
  const size = async (locator: Locator) => (await locator.boundingBox())!;

  test.beforeEach(async ({ page }) => page.setViewportSize({ width: 375, height: 667 }));

  test('the icon-only brand is a full touch target', async ({ page }) => {
    await openWallet(page);
    const brand = await size(page.getByRole('link', { name: 'Open Portfolio' }).first());
    expect(brand.width).toBeGreaterThanOrEqual(44);
    expect(brand.height).toBeGreaterThanOrEqual(44);
  });

  test('inline links meet the minimum target size', async ({ page }) => {
    await page.goto('/');
    expect((await size(page.locator('.sample'))).height).toBeGreaterThanOrEqual(24);
    for (const link of await page.locator('footer .icon-link').all()) expect((await size(link)).height).toBeGreaterThanOrEqual(24);
  });

  test('share actions are lighter than the main action on a phone but keep their touch size', async ({ page }) => {
    await openWallet(page);
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    const look = (name: string) => page.getByRole('dialog').getByRole('button', { name }).evaluate((e) => [getComputedStyle(e).fontSize, getComputedStyle(e).fontWeight, e.getBoundingClientRect().height]);
    expect(await look('Copy image')).toEqual(['14px', '400', 44]);
    expect((await look('Copy link')).slice(0, 2)).toEqual(['16px', '500']);
    await page.setViewportSize({ width: 1280, height: 800 });
    expect((await look('Copy image')).slice(0, 2)).toEqual(['16px', '500']);
  });

  const sectionGaps = (page: Page) => page.evaluate(() => [getComputedStyle(document.querySelector('.sheet')!).paddingTop, getComputedStyle(document.querySelector('.block + .block')!).marginTop, getComputedStyle(document.querySelector('footer')!).marginTop]);

  test('sections are closer together on a phone than on a desktop', async ({ page }) => {
    await openWallet(page);
    expect(await sectionGaps(page)).toEqual(['48px', '48px', '48px']);
    await page.setViewportSize({ width: 1280, height: 800 });
    expect(await sectionGaps(page)).toEqual(['72px', '72px', '72px']);
  });
});

test.describe('comparison', () => {
  const OTHER = '0x00000000000000000000000000000000000e2e02';
  const path = `/${WALLET}/vs/${OTHER}`;

  for (const search of ['card=vivid', 'card=soft', 'card=fade', 'card=blend']) {
    test(`renders a 1200×630 card for ${search}`, async ({ request }) => {
      const res = await request.get(`${path}/card?${search}`);
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toBe('image/png');
      const png = await res.body();
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
    });
  }

  test('has no page or card for something that is not a wallet', async ({ request }) => {
    expect((await request.get(`/${WALLET}/vs/not-a-wallet`)).status()).toBe(404);
    expect((await request.get(`/${WALLET}/vs/not-a-wallet/card`)).status()).toBe(404);
  });

  test('sends a wallet compared with itself to its own page', async ({ page }) => {
    await page.goto(`/${WALLET}/vs/${WALLET}`);
    await expect(page).toHaveURL(new RegExp(`/${WALLET}$`));
  });

  test('is a page of its own, shared through the same dialog as a wallet', async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(' vs ');
    await expect(page.locator('.vs-strata')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Copy link' })).toHaveCount(0);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/vs\/.+\/card\?card=/);
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const card = dialog.locator('.share-preview img');
    await expect(card).toHaveAttribute('src', /card\?card=vivid$/);
    await dialog.getByRole('button', { name: 'Side' }).click();
    await expect(card).toHaveAttribute('src', /card\?card=fade$/);
    await expect(page).toHaveURL(/\?card=fade$/);
  });

  test('lines the layers up with the figures above them', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(path);
    const figure = (await page.locator('.vs-figure').first().boundingBox())!;
    const chain = (await page.locator('.vs-chain').first().boundingBox())!;
    expect(chain.x).toBeCloseTo(figure.x, 0);
  });

  test('keeps names whole and each fact on one line on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(path);
    const heights = await page.locator('.vs-facts').evaluateAll((rows) => rows.map((r) => r.getBoundingClientRect().height));
    expect(Math.max(...heights)).toBeLessThanOrEqual(32);
    for (const address of await page.locator('.vs-address').all()) await expect(address).toBeVisible();
  });

  for (const width of [375, 1280]) {
    test(`fills both columns of layers to the same height at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      const heights = await page.locator('.vs-strata').evaluateAll((columns) => columns.map((c) => [c.getBoundingClientRect().height, [...c.children].reduce((sum, row) => sum + row.getBoundingClientRect().height, 0)]));
      expect(heights[0][0]).toBeCloseTo(heights[1][0], 0);
      for (const [column, rows] of heights) expect(rows).toBeCloseTo(column, 0);
    });
  }

  test('states the time at the top centre, like the card', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(path);
    const stamp = (await page.getByText(/^As of /).boundingBox())!;
    expect(stamp.x + stamp.width / 2).toBeCloseTo(640, 0);
    expect(stamp.y).toBeLessThan((await page.locator('.vs-figure').first().boundingBox())!.y);
  });

  for (const width of [744, 820, 1024]) {
    test(`gives the time its own row above the wallets at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      const stamp = (await page.getByText(/^As of /).boundingBox())!;
      const side = (await page.locator('.vs-side').first().boundingBox())!;
      expect(stamp.y + stamp.height).toBeLessThanOrEqual(side.y + 1);
    });
  }

  test('lists the reads behind both wallets and fits a narrow phone', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(path);
    await page.getByRole('button', { name: 'Data source' }).click();
    for (const read of ['Active chains and first activity', 'Listed tokens', 'Balances and prices', 'Positions']) {
      await expect(page.getByRole('cell', { name: read, exact: true })).toBeVisible();
    }
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'Copy as curl' }).click();
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
    const command = await page.evaluate(() => navigator.clipboard.readText());
    expect(command).toContain(WALLET);
    expect(command).toContain(OTHER);
  });

  test('names the comparison in its share dialog and shows the title on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto(path);
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    const title = page.getByRole('dialog', { name: 'Share this comparison' }).getByRole('heading', { name: 'Share this comparison' });
    await expect(title).toBeVisible();
    expect((await title.boundingBox())!.width).toBeGreaterThan(100);
  });

  test('offers another comparison from its own page', async ({ page }) => {
    await page.goto(path);
    const panel = page.getByRole('region', { name: 'Compare with another wallet' });
    await panel.getByRole('textbox').fill('0x00000000000000000000000000000000000e2e03');
    await panel.getByRole('button', { name: 'Go', exact: true }).click();
    await expect(page).toHaveURL(/\/vs\/0x00000000000000000000000000000000000e2e03$/);
  });

  for (const width of [375, 1280]) {
    test(`lines the dialog close button up with the tabs at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openWallet(page);
      await page.getByRole('button', { name: 'Share', exact: true }).click();
      const middle = (box: { y: number; height: number }) => box.y + box.height / 2;
      const dialog = page.getByRole('dialog');
      const label = await dialog.locator('.card-tab[aria-pressed="false"] span').first().evaluate((e) => { const range = document.createRange(); range.selectNodeContents(e); const r = range.getBoundingClientRect(); return { y: r.y, height: r.height }; });
      const icon = (await dialog.getByRole('button', { name: 'Close' }).locator('svg').boundingBox())!;
      expect(Math.abs(middle(label) - middle(icon))).toBeLessThanOrEqual(1);
    });
  }

  const openCompare = async (page: Page, search = '') => {
    await openWallet(page, search);
    await page.getByRole('button', { name: 'Compare with another wallet' }).click();
    return page.getByRole('region', { name: 'Compare with another wallet' });
  };

  test('starts from the top bar and keeps the current style', async ({ page }) => {
    const panel = await openCompare(page, '?card=fade');
    await panel.getByRole('textbox').fill('nonsense');
    await panel.getByRole('button', { name: 'Go', exact: true }).click();
    await expect(panel.getByRole('alert')).toBeVisible();
    await panel.getByRole('textbox').fill(OTHER);
    await panel.getByRole('button', { name: 'Go', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/vs/${OTHER}\\?card=fade$`));
  });

  test('compares with a random whale in one tap', async ({ page }) => {
    const panel = await openCompare(page);
    await panel.getByRole('button', { name: 'Compare with a whale' }).click();
    await expect(page).toHaveURL(/\/vs\/[a-z.]+\.eth$/);
  });

  test('is a menu like the others, closed by Escape, one open at a time', async ({ page }) => {
    const panel = await openCompare(page, '?chain=base');
    await page.getByRole('button', { name: 'Ask AI' }).click();
    await expect(panel).toHaveCount(0);
    await page.getByRole('button', { name: 'Compare with another wallet' }).click();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(page).toHaveURL(/chain=base/);
    await expect(page.getByRole('button', { name: 'Compare with another wallet' })).toBeFocused();
  });

  test('leaves portfolio and story as the only views of the wallet', async ({ page }) => {
    await openWallet(page);
    await expect(page.locator('.lead').getByRole('button', { name: 'VS', exact: true })).toHaveCount(0);
  });

  for (const width of [320, 360, 375, 430]) {
    test(`fits the top bar on one row, and the menu on screen, at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      const panel = await openCompare(page);
      expect((await page.locator('.top').boundingBox())!.height).toBeLessThanOrEqual(68);
      await expect(panel).toBeInViewport({ ratio: 1 });
      await expectNoHorizontalScroll(page);
    });
  }

  test('keeps the share dialog about sharing', async ({ page }) => {
    await openWallet(page);
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'VS', exact: true })).toHaveCount(0);
  });

  for (const viewport of [{ width: 320, height: 640 }, { width: 375, height: 667 }]) {
    test(`fits at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(path);
      await expect(page.locator('.vs-strata').first()).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  }
});

test.describe('content security policy', () => {
  test('blocks scripts and requests to other sites', async ({ page }) => {
    await openWallet(page);
    const [script, request] = await page.evaluate(async () => {
      const script = await new Promise((resolve) => {
        document.addEventListener('securitypolicyviolation', (e) => resolve(e.violatedDirective), { once: true });
        const tag = document.createElement('script');
        tag.src = 'https://example.com/injected.js';
        document.head.append(tag);
      });
      const request = await fetch('https://example.com/').then(() => 'sent', () => 'blocked');
      return [script, request];
    });
    expect(script).toContain('script-src');
    expect(request).toBe('blocked');
  });

  test('leaves every feature of the page alone', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const violations: string[] = [];
    page.on('console', (message) => { if (message.text().includes('Content Security Policy')) violations.push(message.text()); });
    await openWallet(page);
    const lead = page.locator('.lead');
    await lead.getByRole('button', { name: 'Story' }).click();
    await lead.getByRole('button', { name: 'Portfolio' }).click();
    await page.getByRole('button', { name: 'Ask AI' }).click();
    await page.getByRole('button', { name: 'Copy for any AI' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Copied' })).toBeAttached();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Copy image' }).click();
    await expect(dialog.getByRole('button', { name: 'Copied' })).toBeVisible();
    expect(violations).toEqual([]);
  });
});

test.describe('Ask AI', () => {
  const openMenu = async (page: Page, search = '') => {
    await openWallet(page, search);
    await page.getByRole('button', { name: 'Ask AI' }).click();
  };

  test('links the wallet in each assistant, in a new tab', async ({ page }) => {
    await openMenu(page);
    for (const [name, origin] of [['Open in ChatGPT', 'https://chatgpt.com/'], ['Open in Claude', 'https://claude.ai/new']]) {
      const link = page.getByRole('link', { name });
      await expect(link).toHaveAttribute('href', new RegExp(`^${origin}.*${WALLET}%2Fintro\\.md`));
      await expect(link).toHaveAttribute('target', '_blank');
    }
  });

  test('copies the task and the whole wallet', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openMenu(page);
    await page.getByRole('button', { name: 'Copy for any AI' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Copied' })).toBeAttached();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('Summarize');
    expect(text).toContain('## Portfolio');
  });

  test('keeps its width while copying, after copying and when copying fails', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    let release = () => {};
    const held = new Promise<void>((resolve) => { release = resolve; });
    let fail = false;
    await page.route(`**/${WALLET}/intro.md`, async (route) => {
      if (fail) return route.fulfill({ status: 500 });
      await held;
      await route.continue();
    });
    await openMenu(page);
    const panel = page.getByRole('group', { name: 'Ask an AI assistant about this wallet' });
    const copy = page.getByRole('button', { name: 'Copy for any AI' });
    const width = (await panel.boundingBox())!.width;
    await copy.click();
    await expect(copy).toHaveAttribute('aria-busy', 'true');
    expect((await panel.boundingBox())!.width).toBe(width);
    release();
    await expect(panel.getByRole('status').filter({ hasText: 'Copied' })).toBeAttached();
    expect((await panel.boundingBox())!.width).toBe(width);
    fail = true;
    await copy.click();
    await expect(panel.getByText('Couldn’t copy. Try again in a minute.')).toBeVisible();
    expect((await panel.boundingBox())!.width).toBe(width);
  });

  test('closes on Escape without clearing the chain filter', async ({ page }) => {
    await openMenu(page, '?chain=base');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('link', { name: 'Open in ChatGPT' })).toHaveCount(0);
    await expect(page).toHaveURL(/chain=base/);
    await expect(page.getByRole('button', { name: 'Ask AI' })).toBeFocused();
  });

  test('lines up its icons with the Sections checkboxes', async ({ page }) => {
    const lead = async (group: string, mark: string) => {
      const popover = page.getByRole('group', { name: group });
      const [box, item] = [await popover.boundingBox(), await popover.locator(mark).first().boundingBox()];
      return { x: item!.x - box!.x, width: item!.width };
    };
    await openMenu(page);
    await expect(page.getByRole('group', { name: 'Ask an AI assistant about this wallet' }).locator('svg')).toHaveCount(3);
    const icon = await lead('Ask an AI assistant about this wallet', 'svg');
    await page.getByRole('button', { name: 'Sections' }).click();
    expect(await lead('Sections shown on this page', 'input')).toEqual(icon);
  });

  test('shows one menu at a time', async ({ page }) => {
    await openMenu(page);
    await page.getByRole('button', { name: 'Sections' }).click();
    await expect(page.getByRole('link', { name: 'Open in ChatGPT' })).toHaveCount(0);
  });

  for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }]) {
    test(`fits at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openMenu(page);
      await expect(page.getByRole('link', { name: 'Open in Claude' })).toBeInViewport({ ratio: 1 });
      await expectNoHorizontalScroll(page);
    });
  }
});

test.describe('comparison while reading', () => {
  // New every time: a wallet read by an earlier run would come straight from the data cache.
  const slowWallet = () => `${SLOW_PREFIX}${Date.now().toString(16).padStart(20, '0')}${Math.random().toString(16).slice(2).padEnd(16, '0').slice(0, 16)}`;
  const reading = (page: Page) => page.getByRole('status').filter({ hasText: 'Reading both wallets' });

  for (const viewport of [{ width: 320, height: 640 }, { width: 375, height: 700 }, { width: 744, height: 900 }, { width: 1280, height: 800 }]) {
    test(`shows the layout, then the data in the same place, at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/${WALLET}/vs/${slowWallet()}`, { waitUntil: 'commit' });
      await expect(reading(page)).toBeVisible();
      await expectNoHorizontalScroll(page);
      const before = (await page.locator('.vs-layers').boundingBox())!;
      await expect(page.getByText(/^As of /)).toBeVisible();
      await expect(reading(page)).toHaveCount(0);
      expect((await page.locator('.vs-layers').boundingBox())!.y).toBeCloseTo(before.y, 0);
      await expectNoHorizontalScroll(page);
    });
  }

  test('shows it when moving from one comparison to another', async ({ page }) => {
    await page.goto(`/${WALLET}/vs/0x00000000000000000000000000000000000e2e03`);
    const panel = page.getByRole('region', { name: 'Compare with another wallet' });
    await panel.getByRole('textbox').fill(slowWallet());
    await panel.getByRole('button', { name: 'Go', exact: true }).click();
    await expect(reading(page)).toBeVisible();
    await expect(page.getByText(/^As of /)).toBeVisible();
  });

  test('skips it when the wallets are already cached', async ({ page }) => {
    const path = `/${WALLET}/vs/0x00000000000000000000000000000000000e2e03`;
    await page.request.get(path);
    expect(await (await page.request.get(path)).text()).not.toContain('Reading both wallets');
  });
});

test.describe('Sections', () => {
  const openSections = async (page: Page) => {
    await openWallet(page);
    await page.getByRole('button', { name: 'Sections' }).click();
    return page.getByRole('group', { name: 'Sections shown on this page' });
  };

  test('hides a section in the link and always leaves one', async ({ page }) => {
    const menu = await openSections(page);
    await menu.getByRole('checkbox', { name: 'Tokens' }).click();
    await expect(page).toHaveURL(/hide=tokens/);
    await expect(page.getByRole('heading', { name: 'Tokens' })).toHaveCount(0);
    await menu.getByRole('checkbox', { name: 'Chains' }).click();
    await expect(menu.getByRole('checkbox', { name: 'Positions' })).toBeDisabled();
  });

  for (const width of [320, 390]) {
    test(`fits at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await expect(await openSections(page)).toBeInViewport({ ratio: 1 });
      await expectNoHorizontalScroll(page);
    });
  }
});

test('abbreviates a very large token amount', async ({ page }) => {
  await openWallet(page);
  await expect(page.getByRole('cell', { name: '1.8e+207', exact: true })).toBeVisible();
});

test('colors health factors by band only', async ({ page }) => {
  await openWallet(page);
  await expect(page.locator('.health.critical')).toHaveText('Health factor 1.05');
  await expect(page.locator('.health.low')).toHaveText('Health factor 1.30');
  await expect(page.locator('.health', { hasText: '2.50' })).not.toHaveClass(/critical|low/);
  await expect(page.locator('.health.critical')).not.toHaveCSS('color', await page.locator('.health.low').evaluate((e) => getComputedStyle(e).color));
});

test.describe('share dialog', () => {
  const openShare = async (page: Page, search = '') => {
    await openWallet(page, search);
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  };
  const groupsShareARow = (page: Page) => page.locator('.card-group').evaluateAll((groups) => groups[0].getBoundingClientRect().top === groups[1].getBoundingClientRect().top);

  test('shares the selected chain', async ({ page }) => {
    await openShare(page, '?chain=base');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('img')).toHaveAttribute('src', /chain=base/);
    await expect(dialog.getByRole('link', { name: 'Post on X' })).toHaveAttribute('href', /on\+Base/);
    await expect(dialog.getByRole('link', { name: 'Download' })).toHaveAttribute('href', /chain=base&scale=2/);
  });

  test('copies the card as an image and shows progress', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openShare(page, '?chain=base');
    const button = page.getByRole('button', { name: 'Copy image' });
    await button.click();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Copied' })).toBeVisible();
    expect(await page.evaluate(async () => (await navigator.clipboard.read())[0].types)).toContain('image/png');
  });

  test('copies embed code for the current card without changing the dialog height', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openShare(page, '?chain=base');
    const dialog = page.getByRole('dialog');
    const height = (await dialog.boundingBox())!.height;
    await dialog.getByRole('button', { name: 'Embed' }).click();
    await expect(dialog.getByRole('button', { name: 'Copied' })).toBeVisible();
    expect((await dialog.boundingBox())!.height).toBeCloseTo(height, 1);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^<a href="http.+\?chain=base"><img src="http.+\/card\?card=vivid&chain=base" width="600" alt=".+ on Open Portfolio"><\/a>$/);
  });

  test('switches to the wallet story, which clears the chain filter and keeps layout and style', async ({ page }) => {
    await openShare(page, '?chain=base');
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Story' }).click();
    const card = dialog.getByRole('img');
    await expect(card).toHaveAttribute('src', /card=story$/);
    await expect(dialog.getByRole('link', { name: 'Post on X' })).toHaveAttribute('href', /on-chain\+since\+2019/);
    await dialog.getByRole('button', { name: 'Side' }).click();
    await expect(card).toHaveAttribute('src', /\?card=story-fade$/);
    await expect(page).toHaveURL(/\?card=story-fade$/);
    await dialog.getByRole('button', { name: 'Portfolio' }).click();
    await expect(card).toHaveAttribute('src', /\?card=fade$/);
  });

  test.describe('on a desktop', () => {
    test.use({ viewport: DESKTOP });
    test('shows the card at half its width, which keeps small text sharp', async ({ page }) => {
      await openShare(page);
      expect((await page.locator('.share-preview img').boundingBox())!.width).toBeCloseTo(600, 1);
      for (const action of await page.locator('.share-actions > *').all()) expect((await action.boundingBox())!.height).toBeCloseTo(44, 0);
    });
  });

  test.describe('on a tablet', () => {
    test.use({ viewport: TABLET });
    test('keeps layout and style on one row', async ({ page }) => {
      await openShare(page);
      expect(await groupsShareARow(page)).toBe(true);
    });
  });

  test('keeps the title and the card content choice on one row on a desktop', async ({ page }) => {
    await openShare(page);
    const dialog = page.getByRole('dialog');
    const [title, tab] = await Promise.all([dialog.getByRole('heading').boundingBox(), dialog.getByRole('button', { name: 'Portfolio' }).boundingBox()]);
    expect(title!.width).toBeGreaterThan(100);
    expect(Math.abs((title!.y + title!.height / 2) - (tab!.y + tab!.height / 2))).toBeLessThanOrEqual(1);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: PHONE });
    test('puts the card content choice beside close, keeping the title for screen readers', async ({ page }) => {
      await openShare(page);
      const dialog = page.getByRole('dialog', { name: 'Share this wallet' });
      const [tab, close] = await Promise.all([dialog.getByRole('button', { name: 'Story' }).boundingBox(), dialog.getByRole('button', { name: 'Close' }).boundingBox()]);
      expect(tab!.y).toBe(close!.y);
      expect((await dialog.getByRole('heading').boundingBox())!.width).toBeLessThanOrEqual(1);
    });
    for (const width of [360, 375, 430]) {
      test(`keeps layout and style on one row at ${width}px, at full touch size`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await openShare(page);
        expect(await groupsShareARow(page)).toBe(true);
        expect((await page.locator('.card-option').first().boundingBox())!.width).toBeGreaterThanOrEqual(44);
        expect((await page.locator('.card-option').first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await expectNoHorizontalScroll(page);
      });
    }

    test('stacks layout and style, with their options aligned, when they cannot fit', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await openShare(page);
      expect(await groupsShareARow(page)).toBe(false);
      const options = await page.locator('.card-group').evaluateAll((groups) => groups.map((g) => g.querySelector('.card-option')!.getBoundingClientRect().left));
      expect(options[0]).toBe(options[1]);
    });

    test('uses the width the styles ask for, not the browser default limit', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await openShare(page);
      expect((await page.getByRole('dialog').boundingBox())!.width).toBe(343);
    });
  });
});

test('renders share cards as 1200×630 images', async ({ request }) => {
  for (const search of ['card=vivid', 'card=fade&chain=base', 'card=blend&chain=unknown', 'card=story', 'card=story-fade', 'card=story-blend&chain=base']) {
    const response = await request.get(`/${WALLET}/card?${search}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('image/png');
    const png = await response.body();
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  }
});

test('renders a double-resolution card, and only at the supported scale', async ({ request }) => {
  const size = async (scale: string) => {
    const png = await (await request.get(`/${WALLET}/card?card=vivid&scale=${scale}`)).body();
    return [png.readUInt32BE(16), png.readUInt32BE(20)];
  };
  expect(await size('2')).toEqual([2400, 1260]);
  expect(await size('50')).toEqual([1200, 630]);
});
