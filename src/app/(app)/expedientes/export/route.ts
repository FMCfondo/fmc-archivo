import { type NextRequest } from "next/server";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { expedientes, tiposDocumento } from "@/db/schema";
import { requireEmpresaId } from "@/lib/session";

type EstadoExpediente = "pendiente" | "completo" | "fusionado";

function cell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const { empresaId } = await requireEmpresaId();
  const sp = req.nextUrl.searchParams;

  const conds: SQL[] = [eq(expedientes.empresaId, empresaId)];
  if (sp.get("tipoId")) conds.push(eq(expedientes.tipoId, sp.get("tipoId")!));
  if (sp.get("periodo")) conds.push(eq(expedientes.periodo, sp.get("periodo")!));
  if (sp.get("estado")) conds.push(eq(expedientes.estado, sp.get("estado") as EstadoExpediente));
  if (sp.get("q")) {
    const like = `%${sp.get("q")}%`;
    conds.push(
      or(
        ilike(expedientes.consecutivo, like),
        ilike(expedientes.tercero, like),
        ilike(expedientes.concepto, like),
        ilike(expedientes.nitTercero, like),
      )!,
    );
  }

  const filas = await db
    .select({
      consecutivo: expedientes.consecutivo,
      tipo: tiposDocumento.nombre,
      periodo: expedientes.periodo,
      fecha: expedientes.fecha,
      tercero: expedientes.tercero,
      nit: expedientes.nitTercero,
      concepto: expedientes.concepto,
      valor: expedientes.valor,
      estado: expedientes.estado,
      carpeta: expedientes.tieneCarpetaFisica,
      rotulo: expedientes.rotuloCarpeta,
      ubicacion: expedientes.ubicacionFisica,
      folio: expedientes.folio,
    })
    .from(expedientes)
    .innerJoin(tiposDocumento, eq(expedientes.tipoId, tiposDocumento.id))
    .where(and(...conds))
    .orderBy(desc(expedientes.creadoEn))
    .limit(5000);

  const encabezados = [
    "Consecutivo",
    "Tipo",
    "Periodo",
    "Fecha",
    "Tercero",
    "NIT",
    "Concepto",
    "Valor",
    "Estado",
    "Carpeta fisica",
    "Rotulo",
    "Ubicacion",
    "Folio",
  ];

  const lineas = filas.map((f) =>
    [
      f.consecutivo,
      f.tipo,
      f.periodo,
      f.fecha,
      f.tercero,
      f.nit,
      f.concepto,
      f.valor,
      f.estado,
      f.carpeta ? "Si" : "No",
      f.rotulo,
      f.ubicacion,
      f.folio,
    ]
      .map(cell)
      .join(","),
  );

  const csv = "﻿" + [encabezados.join(","), ...lineas].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="expedientes-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
