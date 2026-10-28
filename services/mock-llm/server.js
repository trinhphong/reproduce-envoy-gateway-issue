const http = require("node:http");

const PORT = Number(process.env.PORT || 8088);
const INTERVAL_MS = 500;
const DURATION_MS = 25_000;
const WORDS = [
  "This ",
  "reply ",
  "is ",
  "sent ",
  "one ",
  "token ",
  "at ",
  "a ",
  "time. ",
];

function writeEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function createServer() {
  return http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
      return;
    }

    const path = req.url?.split("?")[0];
    if (req.method !== "POST" || path !== "/v1/chat/completions") {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
      return;
    }

    req.on("end", () => {
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      });
      res.flushHeaders();

      const started = Date.now();
      let index = 0;
      const timer = setInterval(() => {
        if (res.writableEnded) {
          clearInterval(timer);
          return;
        }
        if (Date.now() - started >= DURATION_MS) {
          clearInterval(timer);
          writeEvent(res, {
            id: "chatcmpl-demo",
            object: "chat.completion.chunk",
            model: "demo",
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          });
          res.write("data: [DONE]\n\n");
          res.end();
          return;
        }

        const content = WORDS[index % WORDS.length];
        index += 1;
        writeEvent(res, {
          id: "chatcmpl-demo",
          object: "chat.completion.chunk",
          model: "demo",
          choices: [{ index: 0, delta: { content }, finish_reason: null }],
        });
      }, INTERVAL_MS);

      res.on("close", () => clearInterval(timer));
    });
    req.resume();
  });
}

const server = createServer();
server.listen(PORT, "0.0.0.0", () => {
  console.log(`mock llm listening on ${PORT}`);
});
