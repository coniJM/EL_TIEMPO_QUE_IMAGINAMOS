const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "respuestas.json");
const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 8787);
const MAX_BODY = 16 * 1024;
const pool = process.env.DATABASE_URL
  ? new (require("pg").Pool)({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3
    })
  : null;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function readLocalAnswers() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function readAnswers() {
  if (!pool) return readLocalAnswers();
  const result = await pool.query(
    "SELECT q1, q2, answer_text AS text, created_at FROM flor_respuestas ORDER BY id"
  );
  return result.rows.map((row) => ({
    q1: row.q1,
    q2: row.q2,
    text: row.text,
    createdAt: row.created_at.toISOString()
  }));
}

async function saveAnswer(answer) {
  if (pool) {
    await pool.query(
      "INSERT INTO flor_respuestas (q1, q2, answer_text) VALUES ($1, $2, $3)",
      [answer.q1, answer.q2, answer.text]
    );
    const count = await pool.query("SELECT COUNT(*)::int AS total FROM flor_respuestas");
    return { saved: true, count: count.rows[0].total };
  }

  const answers = readLocalAnswers();
  answers.push({ ...answer, createdAt: new Date().toISOString() });
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(answers, null, 2));
  return { saved: true, count: answers.length };
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(value));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY) {
        reject(Object.assign(new Error("La respuesta es demasiado grande."), { status: 413 }));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function handleApi(request, response) {
  if (request.method === "GET" && request.url === "/api/respuestas") {
    try {
      return sendJson(response, 200, await readAnswers());
    } catch (error) {
      console.error("Error leyendo respuestas:", error.message);
      return sendJson(response, 500, { error: "No se pudieron leer las respuestas." });
    }
  }

  if (request.method !== "POST" || request.url !== "/api/respuestas") {
    return sendJson(response, 405, { error: "Método no permitido." });
  }

  try {
    const incoming = JSON.parse(await readRequestBody(request));
    const q1 = Number(incoming.q1);
    const q2 = Number(incoming.q2);
    const text = String(incoming.text || "").trim().slice(0, 700);

    if (!Number.isInteger(q1) || q1 < 0 || q1 > 4 ||
        !Number.isInteger(q2) || q2 < 0 || q2 > 4) {
      return sendJson(response, 400, { error: "Respuesta inválida." });
    }

    return sendJson(response, 201, await saveAnswer({ q1, q2, text }));
  } catch (error) {
    console.error("Error guardando respuesta:", error.message);
    const status = error.status || (error instanceof SyntaxError ? 400 : 500);
    return sendJson(response, status, { error: "No se pudo guardar la respuesta." });
  }
}

async function start() {
  if (pool) {
    await pool.query(
      "CREATE TABLE IF NOT EXISTS flor_respuestas (" +
      "id BIGSERIAL PRIMARY KEY, " +
      "q1 SMALLINT NOT NULL CHECK (q1 BETWEEN 0 AND 4), " +
      "q2 SMALLINT NOT NULL CHECK (q2 BETWEEN 0 AND 4), " +
      "answer_text VARCHAR(700) NOT NULL DEFAULT '', " +
      "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"
    );
    console.log("Base de datos en línea conectada.");
  }

  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname.startsWith("/api/")) {
      void handleApi(request, response);
      return;
    }

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
  });
}

start().catch((error) => {
  console.error("No se pudo iniciar el servidor:", error.message);
  process.exit(1);
});
