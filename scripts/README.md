# Scripts

Herramientas operativas del proyecto. **Todos leen `.env.local`**, así que apuntan a la base
de datos y al bucket que estén configurados ahí (hoy: producción). Ejecutar con criterio.

## `ops/` — seguros (solo lectura o verificación)

| Script | npm | Qué hace |
|---|---|---|
| `ops/estado.ts` | `npm run ops:estado` | Cuenta los documentos importados por carpeta |
| `ops/verificar-admin.ts` | `npm run ops:verificar-admin` | Lista usuarios y su flag `debeCambiarPassword` |
| `ops/verificar-seguridad.ts` | `npm run ops:verificar-seguridad` | Últimos intentos de login y entradas de bitácora |
| `ops/smoke-login.ts` | `npm run ops:smoke-login` | Prueba login + página protegida contra `TEST_BASE_URL` (por defecto localhost:3000). Requiere credenciales de prueba en el código o entorno |

## `one-shot/` — ya ejecutados; NO volver a correr sin leerlos

| Script | Estado | Peligro |
|---|---|---|
| `one-shot/importar.ts` | ✅ Ejecutado (jun-2026): importó 1,253 documentos del Drive | `--real` sube archivos; **`--reset` BORRA todos los documentos importados** de BD y R2. La ruta del Drive está hardcodeada a la máquina original |
| `one-shot/r2-cors.ts` | Obsoleto: era para la subida prefirmada, retirada. Las subidas van por `/api/subir` (servidor) y no necesitan CORS | Escribe la política CORS del bucket |
| `one-shot/r2-test.ts` | Smoke test de conectividad R2 (put/get/delete de un archivo de prueba) | Inofensivo, pero escribe/borra un objeto `__test__/` |

## `seed.ts`

`npm run db:seed` — crea la empresa FMC, el usuario admin (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`,
**la contraseña es obligatoria, sin valor por defecto**) y el catálogo inicial de carpetas.
Es idempotente: no duplica lo que ya existe.
