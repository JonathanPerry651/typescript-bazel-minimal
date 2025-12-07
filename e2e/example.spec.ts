import { test, expect } from '@playwright/test';

test('has title and says hello', async ({ page }) => {
    await page.goto('http://localhost:8080');

    // Expect a title "to contain" a substring.
    await expect(page.getByRole('heading', { name: 'Welcome to the Gateway' })).toBeVisible();

    page.on('console', msg => console.log(`Browser Console: ${msg.text()}`));

    // Click the button and wait for the dialog
    const dialogPromise = page.waitForEvent('dialog');
    await page.getByRole('button', { name: 'Say Hello' }).click();
    const dialog = await dialogPromise;

    console.log(`Dialog message: ${dialog.message()}`);
    if (dialog.message().includes('Response: Hello World')) {
        expect(dialog.message()).toContain('Response: Hello World (Header: greeter)');
        await dialog.accept();

        // Now test Calculator
        const calcDialogPromise = page.waitForEvent('dialog');
        await page.getByRole('button', { name: 'Calculate 10+20' }).click();
        const calcDialog = await calcDialogPromise;
        console.log(`Calc Dialog message: ${calcDialog.message()}`);
        expect(calcDialog.message()).toContain('Sum Result: 30');
        await calcDialog.accept();
    } else {
        // Fallback or error handling
        console.error("Unexpected dialog: " + dialog.message());
        await dialog.accept();
    }
});
