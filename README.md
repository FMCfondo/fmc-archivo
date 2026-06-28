# Archivo FMC

Sistema de archivo documental por **expedientes**: cada expediente (factura, nómina, egreso…)
agrupa su documento principal y todos sus soportes (pago, registro contable, comprobante
bancario), con su consecutivo automático y los datos de la carpeta física. Multiempresa.

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind
- **Neon** (PostgreSQL) + Drizzle ORM
- **Auth.js** (login con correo/contraseña)
- **Cloudflare R2** (almacenamiento de los PDF; descargas sin costo)

## Puesta en marcha

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Copiar `.env.example` a `.env.local` y rellenar los valores (Neon y R2):
   ```bash
   cp .env.example .env.local
   ```
3. Crear las tablas y cargar el catálogo inicial:
   ```bash
   npm run db:migrate   # aplica el esquema a la base de datos
   npm run db:seed      # crea empresa FMC, usuario admin y el catálogo
   ```
4. Arrancar en desarrollo:
   ```bash
   npm run dev
   ```
   Abrir http://localhost:3000 e iniciar sesión con el usuario admin del seed
   (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run db:generate` | Genera migración SQL desde el esquema |
| `npm run db:migrate` | Aplica las migraciones a Neon |
| `npm run db:seed` | Crea empresa, admin y catálogo |

## Cloudflare R2 — CORS

Para que el navegador suba archivos directo a R2, el bucket necesita una política CORS que
permita tu origen. En el bucket → **Settings → CORS Policy**:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://TU-DOMINIO.vercel.app"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## Notas de seguridad

- `.env.local` no se versiona (está en `.gitignore`). No subir secretos al repo.
- Cambiar la contraseña del usuario admin tras el primer ingreso.

## Estructura

- `src/db/` — esquema, cliente y seed
- `src/auth.ts` — configuración de Auth.js
- `src/lib/` — sesión, R2, formato
- `src/app/(app)/expedientes/` — listado, creación, detalle y subida
- `src/app/(app)/catalogo/` — gestión de categorías
