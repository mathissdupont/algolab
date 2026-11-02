// Serves the static export under /algolab, mirroring GitHub Pages.
import http from "node:http";
import handler from "serve-handler";

const BASE = "/algolab";
const port = Number(process.env.PORT || 4173);

http
  .createServer((req, res) => {
    if (!req.url.startsWith(BASE)) {
      res.writeHead(302, { location: `${BASE}/` });
      return res.end();
    }
    req.url = req.url.slice(BASE.length) || "/";
    return handler(req, res, { public: "out", trailingSlash: true });
  })
  .listen(port, () => console.log(`serving out/ at http://localhost:${port}${BASE}/`));
