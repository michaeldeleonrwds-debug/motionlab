import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function verifyTimelineHotkeys() {
  const outDir = path.join(process.cwd(), 'public', 'exports');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });

  console.log('--- 1. Loading MotionLab 4.0 Timeline ---');
  await page.goto('http://127.0.0.1:5170', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Switch to EDIT workspace to have standard timeline view
  const editTab = page.locator('[data-testid="workspace-tab-edit"]');
  if (await editTab.count() > 0) {
    await editTab.click();
    await page.waitForTimeout(400);
  }

  // 1. Verify Navigation Settings Popover
  console.log('--- 2. Testing Timeline Navigation Settings Popover ---');
  const navSettingsBtn = page.locator('[data-testid="timeline-nav-settings-btn"]');
  await navSettingsBtn.waitFor({ state: 'visible' });
  await navSettingsBtn.click();
  await page.waitForTimeout(300);

  const popover = page.locator('[data-testid="timeline-nav-settings-popover"]');
  const isPopoverVisible = await popover.isVisible();
  console.log('Popover visible:', isPopoverVisible);

  // Take screenshot of settings popover
  await page.screenshot({
    path: path.join(outDir, 'v4-timeline-nav-popover.png'),
  });
  console.log('Saved: v4-timeline-nav-popover.png');

  // Switch to Hotkeys Cheat Sheet tab
  const shortcutsTab = page.locator('[data-testid="nav-tab-shortcuts"]');
  await shortcutsTab.click();
  await page.waitForTimeout(200);

  await page.screenshot({
    path: path.join(outDir, 'v4-timeline-hotkeys-cheatsheet.png'),
  });
  console.log('Saved: v4-timeline-hotkeys-cheatsheet.png');

  // Close popover
  await navSettingsBtn.click();
  await page.waitForTimeout(200);

  // 2. Test Zoom Controls (+, -, F)
  console.log('--- 3. Testing Keyboard Zoom Shortcuts (+, -, F) ---');
  const initialZoom = await page.evaluate(() => {
    return (window as any).__MOTIONLAB_STORE__?.getState().timelineZoom;
  });
  console.log('Initial timeline zoom:', initialZoom);

  // Press '=' or '+' to zoom in
  await page.keyboard.press('=');
  await page.waitForTimeout(200);
  const zoomAfterPlus = await page.evaluate(() => {
    return (window as any).__MOTIONLAB_STORE__?.getState().timelineZoom;
  });
  console.log('Zoom after +/=: ', zoomAfterPlus, '(Expected >', initialZoom, ')');

  // Press '-' to zoom out
  await page.keyboard.press('-');
  await page.waitForTimeout(200);
  const zoomAfterMinus = await page.evaluate(() => {
    return (window as any).__MOTIONLAB_STORE__?.getState().timelineZoom;
  });
  console.log('Zoom after -: ', zoomAfterMinus, '(Expected <', zoomAfterPlus, ')');

  // Press 'f' to fit timeline
  await page.keyboard.press('f');
  await page.waitForTimeout(200);
  const zoomAfterFit = await page.evaluate(() => {
    return (window as any).__MOTIONLAB_STORE__?.getState().timelineZoom;
  });
  console.log('Zoom after F (Fit): ', zoomAfterFit);

  // 3. Test Frame Stepping (ArrowLeft, ArrowRight, Shift+Arrows)
  console.log('--- 4. Testing Frame Stepping (Arrows & Shift+Arrows) ---');
  // Seek to 1.000s first
  await page.evaluate(() => {
    (window as any).__MOTIONLAB_STORE__?.getState().setCurrentTime(1.0);
  });
  await page.waitForTimeout(100);

  // Step +1 frame (ArrowRight)
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
  const timeStep1 = await page.evaluate(() => {
    return (window as any).__MOTIONLAB_STORE__?.getState().currentTime;
  });
  console.log('Time after ArrowRight (+1 frame):', timeStep1, '(Initial 1.0)');

  // Step +10 frames (Shift+ArrowRight)
  await page.keyboard.press('Shift+ArrowRight');
  await page.waitForTimeout(100);
  const timeStep10 = await page.evaluate(() => {
    return (window as any).__MOTIONLAB_STORE__?.getState().currentTime;
  });
  console.log('Time after Shift+ArrowRight (+10 frames):', timeStep10);

  // Step -1 frame (ArrowLeft)
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(100);
  const timeBack1 = await page.evaluate(() => {
    return (window as any).__MOTIONLAB_STORE__?.getState().currentTime;
  });
  console.log('Time after ArrowLeft (-1 frame):', timeBack1);

  // Step -10 frames (Shift+ArrowLeft)
  await page.keyboard.press('Shift+ArrowLeft');
  await page.waitForTimeout(100);
  const timeBack10 = await page.evaluate(() => {
    return (window as any).__MOTIONLAB_STORE__?.getState().currentTime;
  });
  console.log('Time after Shift+ArrowLeft (-10 frames):', timeBack10);

  // Jump to Home (0s)
  await page.keyboard.press('Home');
  await page.waitForTimeout(100);
  const timeHome = await page.evaluate(() => {
    return (window as any).__MOTIONLAB_STORE__?.getState().currentTime;
  });
  console.log('Time after Home:', timeHome, '(Expected 0)');

  // Jump to End
  await page.keyboard.press('End');
  await page.waitForTimeout(100);
  const timeEnd = await page.evaluate(() => {
    return (window as any).__MOTIONLAB_STORE__?.getState().currentTime;
  });
  console.log('Time after End:', timeEnd, '(Expected > 0)');

  // 4. Test Ctrl + Wheel Timeline Zoom
  console.log('--- 5. Testing Ctrl + Mouse Wheel Timeline Zoom ---');
  const scrollArea = page.locator('[data-testid="timeline-scroll-area"]');
  const scrollBounding = await scrollArea.boundingBox();
  if (scrollBounding) {
    const targetX = scrollBounding.x + scrollBounding.width / 2;
    const targetY = scrollBounding.y + scrollBounding.height / 2;

    await page.mouse.move(targetX, targetY);

    const zoomBeforeWheel = await page.evaluate(() => {
      return (window as any).__MOTIONLAB_STORE__?.getState().timelineZoom;
    });

    // Dispatch Ctrl+Wheel event over scrollArea
    await page.evaluate(({ x, y }) => {
      const el = document.querySelector('[data-testid="timeline-scroll-area"]');
      if (el) {
        const event = new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          deltaY: -100, // Zoom in
          ctrlKey: true,
        });
        el.dispatchEvent(event);
      }
    }, { x: targetX, y: targetY });

    await page.waitForTimeout(200);

    const zoomAfterWheel = await page.evaluate(() => {
      return (window as any).__MOTIONLAB_STORE__?.getState().timelineZoom;
    });
    console.log('Zoom before Ctrl+Wheel:', zoomBeforeWheel, '-> Zoom after Ctrl+Wheel:', zoomAfterWheel);
  }

  // 5. Test Ctrl + Drag Panning
  console.log('--- 6. Testing Ctrl + Drag Timeline Panning ---');
  const ruler = page.locator('[data-testid="timeline-ruler"]');
  const rulerBounding = await ruler.boundingBox();
  if (rulerBounding) {
    const startX = rulerBounding.x + 400;
    const startY = rulerBounding.y + 14;

    const initialScrollLeft = await page.evaluate(() => {
      const scroller = document.querySelector('[data-testid="timeline-scroll-area"]');
      return scroller ? scroller.scrollLeft : 0;
    });

    // Hold Control, mouse down, drag 150px to the left, mouse up
    await page.keyboard.down('Control');
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 150, startY, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up('Control');
    await page.waitForTimeout(200);

    const afterPanScrollLeft = await page.evaluate(() => {
      const scroller = document.querySelector('[data-testid="timeline-scroll-area"]');
      return scroller ? scroller.scrollLeft : 0;
    });

    console.log('ScrollLeft before pan:', initialScrollLeft, '-> ScrollLeft after Ctrl+Drag pan:', afterPanScrollLeft);
  }

  // 6. Test Shift + Wheel Horizontal Scrolling
  console.log('--- 7. Testing Shift + Wheel Horizontal Scroll ---');
  if (scrollBounding) {
    const targetX = scrollBounding.x + scrollBounding.width / 2;
    const targetY = scrollBounding.y + scrollBounding.height / 2;

    const scrollBeforeShiftWheel = await page.evaluate(() => {
      const scroller = document.querySelector('[data-testid="timeline-scroll-area"]');
      return scroller ? scroller.scrollLeft : 0;
    });

    await page.evaluate(({ x, y }) => {
      const el = document.querySelector('[data-testid="timeline-scroll-area"]');
      if (el) {
        const event = new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          deltaY: 120, // scroll right
          shiftKey: true,
        });
        el.dispatchEvent(event);
      }
    }, { x: targetX, y: targetY });

    await page.waitForTimeout(200);

    const scrollAfterShiftWheel = await page.evaluate(() => {
      const scroller = document.querySelector('[data-testid="timeline-scroll-area"]');
      return scroller ? scroller.scrollLeft : 0;
    });

    console.log('ScrollLeft before Shift+Wheel:', scrollBeforeShiftWheel, '-> ScrollLeft after Shift+Wheel:', scrollAfterShiftWheel);
  }

  // 7. Verify Responsive Viewports
  console.log('--- 8. Verifying 1440x900 & 1366x768 Viewports ---');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(outDir, 'v4-timeline-1440x900.png'),
  });

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(outDir, 'v4-timeline-1366x768.png'),
  });

  console.log('All responsive screenshots saved.');
  await browser.close();
  console.log('=== TIMELINE HOTKEYS & NAVIGATION VERIFICATION COMPLETE ===');
}

verifyTimelineHotkeys().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
