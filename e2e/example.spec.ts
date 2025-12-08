import { test, expect } from '@playwright/test';

test('has title and says hello', async ({ page }) => {
    await page.goto('http://localhost:8080');

    // Expect a title "to contain" a substring.
    await expect(page.getByRole('heading', { name: 'gRPC React Calculator' })).toBeVisible();

    page.on('console', msg => console.log(`Browser Console: ${msg.text()}`));

    // Click the button and wait for the log to appear
    await page.getByRole('button', { name: 'Say Hello' }).click();

    // Check for Hello response in the logs
    // The "Logs:" section is in a div. We look for a list item.
    // Note: The backend adds "(Header: greeter)" to the message if the header is present.
    await expect(page.getByText('Response: Hello World (Header: greeter)')).toBeVisible({ timeout: 5000 });

    // Now test Calculator
    await page.getByRole('button', { name: 'Calculate 10+20' }).click();

    // Check for Sum response
    await expect(page.getByText('Sum Result: 30')).toBeVisible({ timeout: 5000 });
});
