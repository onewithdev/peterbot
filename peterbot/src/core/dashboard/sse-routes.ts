import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { passwordAuth } from "./auth.js";
import { getEventsSince } from "../../features/jobs/events-repository.js";

const sseRoutes = new Hono();

sseRoutes.get("/", passwordAuth, async (c) => {
  const sinceParam = c.req.query("since");
  let lastId = sinceParam ? parseInt(sinceParam, 10) : 0;

  if (isNaN(lastId) || lastId < 0) {
    lastId = 0;
  }

  return streamSSE(c, async (stream) => {
    // Replay phase: send any missed events immediately
    const missedEvents = await getEventsSince(lastId);
    for (const event of missedEvents) {
      await stream.writeSSE({
        id: String(event.id),
        event: event.event,
        data: JSON.stringify({ type: event.event, jobId: event.jobId, payload: JSON.parse(event.payload || '{}') }),
      });
      if (event.id > lastId) {
        lastId = event.id;
      }
    }

    // Polling loop with keepalive
    let keepaliveCounter = 0;

    while (!stream.closed) {
      // Poll for new events every 2 seconds (1 iteration = 2s)
      await stream.sleep(2000);

      if (stream.closed) break;

      // Check for new events
      const newEvents = await getEventsSince(lastId);
      for (const event of newEvents) {
        await stream.writeSSE({
          id: String(event.id),
          event: event.event,
          data: JSON.stringify({ type: event.event, jobId: event.jobId, payload: JSON.parse(event.payload || '{}') }),
        });
        if (event.id > lastId) {
          lastId = event.id;
        }
      }

      // Keepalive: send comment every 15 seconds (every 7-8 iterations at 2s interval)
      keepaliveCounter++;
      if (keepaliveCounter >= 7) {
        await stream.writeSSE({
          comment: "keepalive",
        });
        keepaliveCounter = 0;
      }
    }
  });
});

export { sseRoutes };
