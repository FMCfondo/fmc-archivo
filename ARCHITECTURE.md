# Arquitectura — Archivo FMC

Guía para entender el proyecto en 5 minutos. Si algo de este documento contradice el código,
el código manda — y este archivo debe actualizarse en el mismo PR.

## Qué es

Sistema de archivo documental contable **multiempresa**: documentos (facturas, nóminas,
egresos…) organizados en **carpetas jerárquicas**, cada uno con sus **soportes** (pagos,
registros contables, comprobantes), consecutivo por serie contable (ej. `CC-10-42`),
referencia a la **carpeta física** (rótulo + ubicación) y un **PDF unido** imprimible.
Uso interno de FMC con miras a venderse como SaaS.

## Glosario (imprescindible — el vocabulario del código tiene historia)

| Término en BD | En la UI actual | Qué es realmente |
|---|---|---|
| `tipos_documento` | **Carpeta** (en `/carpetas`) / "Categoría" (en `/catalogo`) | Carpeta jerárquica (`parentId`), dueña de la serie de consecutivos (`prefijo`+`libro`) |
| `expedientes` | **Documento** (la fila de la tabla de `/carpetas`) | La unidad de archivo: metadatos + consecutivo + carpeta física |
| `expedientes.concepto` | "Nombre del documento" | Nombre visible; `/api/subir` lo llena con el nombre del archivo |
| `documentos` | **Soportes** / archivos | Los archivos físicos en R2 (principal + soportes de un expediente) |
| `consecutivos` | (invisible) | Contador por empresa+carpeta-dueña-de-serie |

## Las dos interfaces (estado de la migración)

- **`/carpetas` es la interfaz PRINCIPAL** (el home `/` y el login redirigen ahí): explorador
  de carpetas → tabla editable de documentos (nombre, carpeta, soportes, carpeta física, PDF).
- **`/expedientes` es la interfaz anterior, parcialmente vigente**:
  - Vivo y enlazado: el listado con filtros (nav "Buscar"), `export/` (CSV) y `[id]/pdf/`
    (PDF unido — **la UI nueva depende de esta ruta**).
  - Legado en retirada: `nuevo/`, `[id]/editar/` — son hoy el único lugar donde se editan
    periodo/tercero/valor/estado (pendiente portarlo a `/carpetas`, Fase 4 del plan).
- **`/catalogo`** administra la misma tabla que `/carpetas` (pendiente de unificar).

## Flujo de una petición

```
middleware.ts (src/) — auth-gate + CSP + forzar cambio de clave
  └─ src/app/(app)/layout.tsx — nav + empresa activa
       └─ página (server component) → server actions / route handlers
            └─ src/lib/* (sesión, validación, bitácora, R2) → Drizzle → Neon
                                                            → S3 client → R2
```

## Flujo de subida de archivos (el vigente)

El navegador **NO sube directo a R2** (la red de la empresa bloquea `cloudflarestorage.com`).
Todo va por **`POST /api/subir`** (mismo dominio): valida sesión + Zod + **magic bytes**
(solo PDF/JPG/PNG reales), crea el expediente si hace falta (con consecutivo), hace `PutObject`
a R2 y registra en BD + bitácora. Límite ~4.5 MB por archivo (límite de request de Vercel).
La vía de URLs prefirmadas fue **eliminada** (existió; ver git history si se necesita para
archivos grandes — habría que re-validar contentType y prefijo de empresa).

## Seguridad (implementado)

- Auth.js v5 (credenciales + bcrypt), JWT; rate limiting de login vía tabla `intentos_login`.
- CSP + HSTS + X-Frame-Options etc. (`middleware.ts` + `next.config.ts`).
- Soft-delete (`eliminadoEn`) + bitácora (`bitacora`) en las mutaciones de expedientes/documentos.
- Multiempresa por `empresaId` en cada query (capa de datos; no hay RLS — el navegador nunca
  toca la BD).
- Pendientes conocidos (plan aprobado, Fase 3): aplicar roles en las mutaciones, transacciones
  (migrar driver a `neon-serverless`), bitácora en catálogo/equipo/cuenta.

## Mapa de código

```
src/
├── middleware.ts      auth-gate + CSP (corre en toda petición)
├── auth.ts            NextAuth (credenciales, rate limit, callbacks JWT)
├── db/                schema.ts (8 tablas) + index.ts (cliente Neon)
├── lib/               utilidades: session (guards), tipos (árbol de carpetas + series),
│                      r2, bitacora, validacion (Zod), validar-archivo (magic bytes),
│                      format, reintentos
└── app/
    ├── login/         página + action de login
    ├── api/           auth (NextAuth) + subir (proxy de subida a R2)
    └── (app)/         zona autenticada: carpetas (UI principal), expedientes (buscar +
                       legado + pdf/export), inicio (dashboard), catalogo, equipo, cuenta
scripts/               ops/ (seguros) + one-shot/ (ya ejecutados) + seed.ts — ver scripts/README.md
drizzle/               migraciones SQL generadas (drizzle-kit)
```

## Convenciones

- Dominio y UI en **español**; kebab-case en archivos; server actions por módulo de ruta
  (`actions.ts`), componentes cliente junto a su ruta.
- Toda mutación debe: validar con Zod, filtrar por `empresaId`, registrar bitácora,
  y usar soft-delete — (aún no se cumple al 100%; ver plan de refactor).
