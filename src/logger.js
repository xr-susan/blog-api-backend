const LEVELS = new Set(["silent", "info"]);

export function createRequestLogger(config) {
  const level = LEVELS.has(config.logLevel) ? config.logLevel : "info";

  return function logRequest(req, res, startedAt, url) {
    if (level === "silent") {
      return;
    }

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const entry = {
      time: new Date().toISOString(),
      method: req.method,
      path: url.pathname,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
      userAgent: req.headers["user-agent"] || ""
    };

    console.log(JSON.stringify(entry));
  };
}
