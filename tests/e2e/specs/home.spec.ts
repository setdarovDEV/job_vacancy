import { test, expect } from '@playwright/test';

test('home page loads and shows vacancies', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Job Vacancy/);
  await expect(page.locator('body')).toContainText('vakansiya');
});

test('navigation to sign in works', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Kirish|Sign in|Войти/ }).first().click();
  await expect(page).toHaveURL(/.*login.*/);
});
