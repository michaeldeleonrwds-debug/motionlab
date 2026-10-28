// Exercise the actual HTTP stream through the local reverse proxy without editing projects.
const urls = process.argv.slice(2);
const durationMs = Number(process.env.STREAM_CHECK_MS || 75000);
if (!urls.length) urls.push('http://motionlab.test');
const results = await Promise.all(urls.map(async (base) => {
  const controller = new AbortController();
  const start = Date.now();
  const timer = setTimeout(() => controller.abort(), durationMs);
  let chunks = 0;
  let heartbeats = 0;
  let connected = false;
  try {
    const response = await fetch(`${base}/api/mcp/bridge-stream`, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    for await (const chunk of response.body) {
      const text = new TextDecoder().decode(chunk);
      chunks++;
      connected ||= text.includes('bridge_connected');
      heartbeats += (text.match(/: heartbeat/g) || []).length;
    }
    throw new Error('Stream ended unexpectedly');
  } catch (error) {
    const elapsedMs = Date.now() - start;
    const passed = controller.signal.aborted && connected && elapsedMs >= durationMs - 100;
    return { base, passed, elapsedMs, chunks, heartbeats, error: passed ? undefined : String(error) };
  } finally {
    clearTimeout(timer);
  }
}));
console.log(JSON.stringify(results));
if (results.some((result) => !result.passed)) process.exitCode = 1;
