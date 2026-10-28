import { chromium } from 'playwright';

async function capture() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(1500);

  // If AI drawer is not open, open it
  const aiDrawer = await page.$('[data-testid="ai-mcp-panel"]');
  if (!aiDrawer) {
    const aiToggle = await page.$('button[title*="Copilot"], button:has-text("Copilot"), button:has-text("AI")');
    if (aiToggle) await aiToggle.click();
    await page.waitForTimeout(800);
  }

  // Click on Memory Vault button
  const vaultBtn = page.getByRole('button', { name: 'Memory Vault' });
  if (await vaultBtn.count() > 0) {
    await vaultBtn.click();
  }
  await page.waitForTimeout(1000);

  const screenshotPath = 'C:/Users/REYMARK/.gemini/antigravity/brain/3c90f9e2-da2d-42d6-8add-a7b0a5b26682/06-motionlab-memory-vault-panel.png';
  await page.screenshot({ path: screenshotPath });
  console.log('Saved screenshot successfully to:', screenshotPath);
  await browser.close();
}

capture().catch((err) => {
  console.error('Screenshot error:', err);
  process.exit(1);
});
