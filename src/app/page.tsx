import { redirect } from "next/navigation";
import { RUTA_INICIO } from "@/lib/constantes";

export default function Home() {
  redirect(RUTA_INICIO);
}
