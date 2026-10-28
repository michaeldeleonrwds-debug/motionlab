import { chromium } from 'playwright';
import path from 'path';

async function run() {
  console.log('Launching browser to verify MCIE Skills Library UI...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');

  // Open AI Drawer if not open
  const openCopilotBtn = page.getByTestId('toggle-ai-drawer-btn');
  if (await openCopilotBtn.isVisible()) {
    console.log('Clicking toggle-ai-drawer-btn...');
    await openCopilotBtn.click();
    await page.waitForTimeout(500);
  }

  // Click "Skills" subtab
  const skillsTab = page.getByRole('button', { name: /skills/i });
  if (await skillsTab.isVisible()) {
    console.log('Clicking Skills tab...');
    await skillsTab.click();
    await page.waitForTimeout(600);
  }

  const screenshotPath = path.resolve('07-motionlab-skills-library-panel.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Saved Skills Library panel screenshot to:', screenshotPath);

  // Test executing produce_project via window.__MOTIONLAB_MCP__
  console.log('Testing produce_project tool call in browser...');
  const result = await page.evaluate(async () => {
    if (window.__MOTIONLAB_MCP__) {
      return await window.__MOTIONLAB_MCP__.callTool('produce_project', {
        prompt: 'Create an authoritative 15-second commercial for Angora Web Services with kinetic typography and geometric accents',
        loadIntoEditor: true,
      });
    }
    return { error: 'window.__MOTIONLAB_MCP__ not found' };
  });

  console.log('produce_project execution result:', {
    ok: result.ok,
    name: result.name,
    rubricScore: result.rubricScore,
    grade: result.grade,
    isPassing: result.isPassing,
    clipCount: result.clipCount,
  });

  await page.waitForTimeout(1000);
  const compiledProjectScreenshot = path.resolve('08-motionlab-compiled-director-project.png');
  await page.screenshot({ path: compiledProjectScreenshot });
  console.log('Saved compiled project screenshot to:', compiledProjectScreenshot);

  await browser.close();
  console.log('Browser verification completed successfully.');
}

run().catch((err) => {
  console.error('Browser verification failed:', err);
  process.exit(1);
});
