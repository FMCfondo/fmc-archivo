/**
 * Constantes de configuración de la aplicación — única fuente de verdad.
 * Si un límite o política aparece en la UI y en el servidor, debe salir de aquí.
 */

/** Home de la app: aterrizaje tras login y destino de los redirects genéricos. */
export const RUTA_INICIO = "/carpetas";

/** Política de contraseñas (alta de usuarios y cambio de clave). */
export const MIN_PASSWORD = 8;

/** Costo de bcrypt para hashear contraseñas. */
export const BCRYPT_COST = 10;

/** Límite de subida por archivo. ~4.5 MB es el máximo de body que acepta Vercel. */
export const MAX_SUBIDA_BYTES = Math.floor(4.5 * 1024 * 1024);
export const MAX_SUBIDA_TEXTO = "4.5 MB";

/** Tipos de archivo aceptados (el servidor valida el contenido real por magic bytes). */
export const ACCEPT_ARCHIVOS = "application/pdf,image/jpeg,image/png";

/** Límites de listados. */
export const LIMITE_LISTADO = 300;
export const LIMITE_EXPORT = 5000;
