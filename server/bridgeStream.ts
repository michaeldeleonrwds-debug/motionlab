import type { IncomingMessage, ServerResponse } from 'node:http';

/** Keep proxy connections active and release the timer as soon as a client leaves. */
export function openBridgeStream(req: IncomingMessage, res: ServerResponse, clients: Set<ServerResponse>) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no',
  });
  req.socket.setTimeout(0);
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: 'bridge_connected', connectedClients: clients.size + 1 })}\n\n`);
  clients.add(res);
  const heartbeat = setInterval(() => {
    if (!res.destroyed && !res.writableEnded && !res.writableNeedDrain) res.write(': heartbeat\n\n');
  }, 15000);
  heartbeat.unref();
  const cleanup = () => {
    clearInterval(heartbeat);
    clients.delete(res);
  };
  res.once('close', cleanup);
  res.once('error', cleanup);
}
