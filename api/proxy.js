// Vercel Node.js function: proxy for behnegar.top
// Optional env var: PROXY_KEY (must match PROXY_KEY on the Cloudflare worker)
export const config = { api: { bodyParser: false } };

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  try {
    const u = new URL(req.url, "http://localhost");
    const target = u.searchParams.get("url");
    if (!target) return res.status(400).send("missing url");

    let t;
    try { t = new URL(target); } catch (e) { return res.status(400).send("bad url"); }
    if (!/(^|\.)behnegar\.top$/i.test(t.hostname)) return res.status(403).send("forbidden host");

    const key = process.env.PROXY_KEY;
    if (key && req.headers["x-proxy-key"] !== key) return res.status(401).send("unauthorized");

    const h = {};
    for (const n of ["user-agent", "accept", "accept-language", "cookie", "content-type", "referer"]) {
      if (req.headers[n]) h[n] = req.headers[n];
    }
    const hasBody = !["GET", "HEAD"].includes(req.method);
    const r = await fetch(t.toString(), {
      method: req.method,
      headers: h,
      body: hasBody ? await readBody(req) : undefined,
      redirect: "follow",
    });

    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("x-proxy-saw-cookie-length", String((req.headers["cookie"] || "").length));
    res.setHeader("x-proxy-saw-ua", String(req.headers["user-agent"] || "").slice(0, 60));
    const ct = r.headers.get("content-type");
    if (ct) res.setHeader("content-type", ct);
    res.status(r.status).send(buf);
  } catch (e) {
    res.status(502).send("proxy error: " + String(e));
  }
}
