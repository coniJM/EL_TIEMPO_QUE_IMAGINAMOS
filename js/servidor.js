const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "respuestas.json");
const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 8787);
const MAX_BODY = 16 * 1024;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function readAnswers() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(value));
}

function handleApi(request, response) {
  if (request.method === "GET" && request.url === "/api/respuestas") {
    try {
      return sendJson(response, 200, readAnswers());
    } catch {
      return sendJson(response, 500, { error: "No se pudieron leer las respuestas." });
    }
  }

  if (request.method !== "POST" || request.url !== "/api/respuestas") {
    return sendJson(response, 405, { error: "Método no permitido." });
  }

  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
    if (body.length > MAX_BODY) {
      sendJson(response, 413, { error: "La respuesta es demasiado grande." });
      request.destroy();
    }
  });

  request.on("end", () => {
    try {
      const incoming = JSON.parse(body);
      const q1 = Number(incoming.q1);
      const q2 = Number(incoming.q2);
      const text = String(incoming.text || "").trim().slice(0, 700);

      if (!Number.isInteger(q1) || q1 < 0 || q1 > 4 ||
          !Number.isInteger(q2) || q2 < 0 || q2 > 4) {
        return sendJson(response, 400, { error: "Respuesta inválida." });
      }

      const answers = readAnswers();
      answers.push({ q1, q2, text, createdAt: new Date().toISOString() });
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(answers, null, 2));
      return sendJson(response, 201, { saved: true, count: answers.length });
    } catch {
      return sendJson(response, 400, { error: "No se pudo procesar la respuesta." });
    }
  });
}

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname.startsWith("/api/")) return handleApi(request, response);

  let relativePath;
  try {
    relativePath = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400);
    return response.end("Solicitud inválida.");
  }
  if (relativePath === "/") relativePath = "/index.html";
  const filePath = path.resolve(ROOT, "." + relativePath);
  if (!filePath.startsWith(ROOT + path.sep)) {
    response.writeHead(403);
    return response.end("Forbidden");
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return response.end("No se encontró el archivo.");
    }
    response.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(content);
  });
});

server.listen(PORT, HOST, () => {
  console.log("Experiencia disponible en http://localhost:" + PORT);
  console.log("Visualización disponible en http://localhost:" + PORT + "/visualizacion.html");
  console.log("Para otros dispositivos, cambia localhost por la IP local de este equipo.");
});
