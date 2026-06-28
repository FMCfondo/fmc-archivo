export function formatCOP(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (Number.isNaN(n)) return String(v);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatTamano(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

export const ETIQUETAS_SOPORTE: Record<string, string> = {
  principal: "Documento principal",
  factura: "Factura",
  soporte_pago: "Soporte de pago",
  registro_contable: "Registro contable",
  comprobante_bancario: "Comprobante bancario",
  otro: "Otro",
};

export const ETIQUETAS_ESTADO: Record<string, string> = {
  pendiente: "Pendiente",
  completo: "Completo",
  fusionado: "Fusionado",
};
