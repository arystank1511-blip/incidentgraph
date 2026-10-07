import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('admin@incidentgraph.local');
  await page.getByLabel('Password', { exact: true }).fill('browser-test-workspace-only');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'System overview' })).toBeVisible();
}
const reviewRoutes = [
  '/',
  '/architecture',
  '/login',
  '/app/overview',
  '/app/incidents',
  '/app/incidents/INC-1042',
  '/app/services',
  '/app/service-map',
  '/app/logs',
  '/app/metrics',
  '/app/traces',
  '/app/deployments',
  '/app/settings',
];
test('API rejects unauthorized writes and invalid filters', async ({ request }) => {
  const write = await request.post('/api/incidents', { data: { title: 'Untrusted incident' } });
  expect(write.status()).toBe(401);
  expect((await request.get('/api/bootstrap')).status()).toBe(401);
  await request.post('/api/auth/login', {
    data: { email: 'admin@incidentgraph.local', password: 'browser-test-workspace-only' },
  });
  expect((await request.get('/api/logs?page=-1')).status()).toBe(400);
  expect((await request.get('/api/incidents/missing')).status()).toBe(404);
  const staging = await request.get('/api/bootstrap?environment=staging');
  expect((await staging.json()).incidents).toHaveLength(0);
});
test('investigation, logs, graph, and keyboard navigation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'System overview' })).toBeVisible();
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
  await expect(page.locator('.react-flow__edge-path').first()).toHaveAttribute('d', /^M/);
  await page.screenshot({ path: 'docs/screenshots/overview.png', fullPage: true });
  await page.goto('/app/incidents/INC-1042');
  await expect(
    page.getByRole('heading', { name: 'PostgreSQL connection pool exhaustion' }),
  ).toBeVisible();
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
  await expect(page.locator('.react-flow__edge-path').first()).toHaveAttribute('d', /^M/);
  await page.screenshot({ path: 'docs/screenshots/investigation.png', fullPage: true });
  await page.getByRole('button', { name: 'How this score was calculated' }).click();
  await expect(page.getByText('30% temporal + 25% dependency', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: /14:31:58 Connection pool/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByLabel('Incident status', { exact: true }).selectOption('Identified');
  await expect(
    page.getByRole('status').filter({ hasText: 'Investigation updated.' }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Incident status', { exact: true })).toHaveValue('Identified');
  await page.getByRole('button', { name: /^Activity/ }).click();
  await page
    .getByLabel('Add an investigation note')
    .fill('Test: verified the connection pool evidence and query wait time.');
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await expect(
    page.getByText('Test: verified the connection pool evidence and query wait time.'),
  ).toBeVisible();
  await page.goto('/app/logs?service=payment-service');
  await page.getByLabel('Log search query').fill('timeout OR connection');
  await page.getByRole('button', { name: 'Run query' }).click();
  await page
    .getByRole('button', { name: /Expand log/ })
    .first()
    .click();
  await expect(page.getByText('STRUCTURED CONTEXT')).toBeVisible();
  await page.getByRole('link', { name: 'Open trace', exact: true }).click();
  await expect(page.getByText('Critical path insight', { exact: true })).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Command center' })).toBeVisible();
  await page.getByRole('button', { name: 'View Service Map', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Service map', exact: true })).toBeVisible();
  await page.locator('.react-flow__node[data-id="postgres-main"]').click();
  await expect(page.getByRole('dialog')).toContainText('postgres-main');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByLabel('Environment', { exact: true }).selectOption('staging');
  await page.goto('/app/incidents');
  await expect(page.getByText('No incidents in this view')).toBeVisible();
  expect(errors).toEqual([]);
});
test('declare an incident, filter and find it again', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Declare incident', exact: true }).click();
  await page.getByLabel('Incident title').fill('Checkout timeout verification');
  await page.getByLabel('payment-service', { exact: true }).check();
  await page.getByRole('dialog').getByRole('button', { name: 'Declare incident' }).click();
  await expect(page.getByRole('heading', { name: 'Checkout timeout verification' })).toBeVisible();
  await page.goto('/app/incidents');
  await page.getByLabel('Search incidents').fill('Checkout timeout verification');
  await expect(page.getByRole('link', { name: /^Checkout timeout verification/ })).toBeVisible();
});
test('public pages and mobile layouts have no page overflow', async ({ page }) => {
  test.setTimeout(120000);
  await signIn(page);
  for (const path of reviewRoutes) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      )
      .toBe(true);
  }
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Logs', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Logs explorer' })).toBeVisible();
});

test('captures the public landing page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Understand why/ })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/landing.png', fullPage: true });
});

test('service inspection, global search and metric filters use matching data', async ({ page }) => {
  await signIn(page);
  await page.goto('/app/services');
  await page.getByLabel('Search services').fill('postgres');
  await page.getByRole('button', { name: 'Inspect postgres-main', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('810');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.keyboard.press('Control+k');
  await page.getByLabel('Global search').fill('Payment failures');
  await page.getByRole('button', { name: /Payment failures Incident/ }).click();
  await expect(page.getByRole('heading', { name: 'Payment failures', exact: true })).toBeVisible();
  await page.goto('/app/metrics');
  await page.getByLabel('Metrics service').selectOption('postgres-main');
  await page.getByRole('button', { name: 'Last 15m', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Database connections', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cache hit rate', exact: true })).toHaveCount(0);
  await page.goto('/app/deployments?service=payment-service');
  await expect(page.getByRole('cell', { name: 'payment-service v2.4.1' })).toBeVisible();
});

test('all primary screens pass automated WCAG A/AA checks', async ({ page }) => {
  test.setTimeout(180000);
  await signIn(page);
  for (const path of reviewRoutes) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    if (['/app/overview', '/app/incidents/INC-1042', '/app/service-map'].includes(path)) {
      await expect(page.locator('.react-flow__node').first()).toBeVisible();
    }
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      result.violations.map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.map((node) => node.target),
      })),
    ).toEqual([]);
  }
});

test('primary routes and their internal links load without browser errors', async ({
  page,
  request,
}) => {
  test.setTimeout(180000);
  await signIn(page);
  const failures: string[] = [];
  const links = new Set<string>();
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  for (const route of reviewRoutes) {
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
    const hrefs = await page
      .locator('a[href]')
      .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href') ?? ''));
    for (const href of hrefs) {
      if (href.startsWith('/') && !href.startsWith('//')) links.add(href.split('#')[0]);
    }
  }
  for (const href of links) {
    const response = await request.get(href);
    expect(response.ok(), `Broken internal link: ${href}`).toBe(true);
  }
  expect(failures).toEqual([]);
});

test('private login, script injection defenses and logout protect workspace data', async ({
  page,
}) => {
  // Inject into the HTML parser, outside Playwright's privileged evaluate context.
  await page.route('**/login', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      '</body>',
      "<script>document.body.dataset.securityProbe = 'executed'</script></body>",
    );
    await route.fulfill({ response, body });
  });
  const response = await page.goto('/login');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  const headers = response!.headers();
  expect(headers['content-security-policy']).toContain("'strict-dynamic'");
  expect(headers['content-security-policy']).not.toContain("'unsafe-eval'");
  expect(
    headers['content-security-policy']
      ?.split(';')
      .find((part) => part.trim().startsWith('script-src')),
  ).not.toContain("'unsafe-inline'");
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(await page.locator('body').getAttribute('data-security-probe')).toBeNull();
  await page.unroute('**/login');
  await signIn(page);
  await page.goto('/app/incidents/INC-1042');
  await page.getByRole('button', { name: /^Activity/ }).click();
  const payload = '<img src=x onerror="document.body.dataset.securityProbe=1">';
  await page.getByLabel('Add an investigation note').fill(payload);
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await expect(page.getByText(payload, { exact: true })).toBeVisible();
  expect(await page.locator('img[src="x"]').count()).toBe(0);
  await page.goto('/app/settings');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/app/incidents/INC-1042');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Payment failures', { exact: true })).toHaveCount(0);
});
