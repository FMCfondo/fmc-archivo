# Archivo FMC

Sistema de archivo documental contable **multiempresa**: documentos organizados en carpetas
jerárquicas, cada uno con sus soportes, consecutivo por serie contable, referencia a la
carpeta física y PDF unido imprimible.

> 📐 **Antes de tocar código, lee [ARCHITECTURE.md](ARCHITECTURE.md)** — explica el glosario
> del dominio, cuál de las dos interfaces es la principal y el flujo real de subida de archivos.

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind
- **Neon** (PostgreSQL serverless) + Drizzle ORM
- **Auth.js v5** (login con correo/contraseña + rate limiting)
- **Cloudflare R2** (almacenamiento de archivos; descargas sin costo de egreso)
- Desplegado en **Vercel** (por CLI: `vercel deploy --prod`)

## Puesta en marcha

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Copiar `.env.example` a `.env.local` y rellenar los valores (Neon y R2).
   `SEED_ADMIN_PASSWORD` es obligatoria (mínimo 8 caracteres, sin valor por defecto).
3. Crear las tablas y cargar el catálogo inicial:
   ```bash
   npm run db:migrate   # aplica el esquema a la base de datos
   npm run db:seed      # crea empresa FMC, usuario admin y el catálogo de carpetas
   ```
4. Arrancar en desarrollo:
   ```bash
   npm run dev
   ```
   Abrir http://localhost:3000 — al primer ingreso el sistema exige cambiar la contraseña.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` / `build` / `start` | Ciclo estándar de Next.js |
| `npm run db:generate` | Genera migración SQL desde `src/db/schema.ts` |
| `npm run db:migrate` | Aplica las migraciones a Neon |
| `npm run db:seed` | Empresa + admin + catálogo inicial (idempotente) |
| `npm run ops:estado` | Conteo de documentos importados por carpeta |
| `npm run ops:verificar-admin` | Usuarios y flag de cambio de contraseña |
| `npm run ops:verificar-seguridad` | Últimos intentos de login y bitácora |
| `npm run ops:smoke-login` | Prueba login + página protegida (`TEST_BASE_URL`) |

Más detalle (incluidos los scripts one-shot peligrosos): [scripts/README.md](scripts/README.md).

## Subida de archivos

Todo archivo sube por **`POST /api/subir`** (el servidor guarda en R2). **No se necesita
configurar CORS en el bucket** — la vía de subida directa del navegador fue retirada.
Solo se aceptan PDF/JPG/PNG (validados por contenido real, no por extensión), máx ~4.5 MB.

## Seguridad

- `.env.local` no se versiona. No subir secretos al repo (las claves de producción viven
  en las variables de entorno de Vercel).
- Soft-delete + bitácora de auditoría en las mutaciones de documentos.
- Detalle completo del modelo de seguridad en [ARCHITECTURE.md](ARCHITECTURE.md#seguridad-implementado).
