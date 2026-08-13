import { redirect } from "next/navigation";
import { routes } from "@/navigation/routes";

export default function CadastroClientePage() {
  redirect(routes.register);
}
