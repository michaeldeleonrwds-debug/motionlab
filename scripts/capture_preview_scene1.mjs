import { chromium } from 'playwright';
import path from 'path';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');

  // Produce project in this browser session
  console.log('Compiling project in browser...');
  await page.evaluate(async () => {
    if (window.__MOTIONLAB_MCP__) {
      await window.__MOTIONLAB_MCP__.callTool('produce_project', {
        prompt: 'Create a cinematic commercial for Angora Web Services',
        loadIntoEditor: true,
      });
      // Seek to 1.5s
      window.__MOTIONLAB_MCP__.callTool('command_run', { id: 'time.set', params: { time: 1.5 } });
    }
  });

  await page.waitForTimeout(1200);
  const screenshotPath = path.resolve('09-motionlab-scene1-program-monitor.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Saved program monitor screenshot to:', screenshotPath);

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
