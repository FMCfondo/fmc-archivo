// Verifica el login real (Auth.js credentials) + render del dashboard protegido.
const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const jar = new Map<string, string>();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
function store(res: Response) {
  const setCookies = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookies) {
    const pair = c.split(";")[0];
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1);
    if (v === "") jar.delete(k);
    else jar.set(k, v);
  }
}

async function main() {
  // 1) CSRF
  let res = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: cookieHeader() } });
  store(res);
  const { csrfToken } = (await res.json()) as { csrfToken: string };

  // 2) Login con credenciales
  const body = new URLSearchParams({
    csrfToken,
    email: "admin@fmc.local",
    password: "cambiar123",
    callbackUrl: `${BASE}/inicio`,
  });
  res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
    body,
    redirect: "manual",
  });
  store(res);
  const hasSession = [...jar.keys()].some((k) => k.includes("session-token"));
  console.log("POST login status:", res.status, "| cookie de sesión:", hasSession);

  // 3) Página protegida
  res = await fetch(`${BASE}/carpetas`, { headers: { cookie: cookieHeader() }, redirect: "manual" });
  const html = await res.text();
  console.log("GET /carpetas status:", res.status);
  const dashboard = html.includes("Carpetas") && html.includes("Nueva carpeta");
  console.log("render carpetas:", dashboard);

  if (hasSession && res.status === 200 && dashboard) {
    console.log("\n✅ LOGIN + DASHBOARD OK");
    process.exit(0);
  }
  console.log("\n✗ Algo falló (sesión o render).");
  process.exit(1);
}

main().catch((e) => {
  console.error("✗ Error:", e);
  process.exit(1);
});
