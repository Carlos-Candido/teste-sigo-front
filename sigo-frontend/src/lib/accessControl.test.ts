import { describe, expect, it } from "vitest";
import {
  getEntityCapability,
  isProfileFieldVisible,
  normalizeRole,
} from "@/lib/accessControl";
import { routes } from "@/navigation/routes";

describe("acesso do funcionário", () => {
  it("mantém o funcionário como papel próprio e abre o dashboard principal", () => {
    expect(normalizeRole("Funcionario")).toBe("funcionario");
    expect(routes.employeeHome).toBe(routes.dashboard);
  });

  it("preserva as permissões operacionais sem liberar administração", () => {
    expect(getEntityCapability("Funcionario", "pedidos")).toMatchObject({
      canList: true,
      canCreate: true,
      canUpdate: true,
      canDelete: false,
    });
    expect(getEntityCapability("Funcionario", "funcionarios").canList).toBe(false);
    expect(getEntityCapability("Funcionario", "marcas").canList).toBe(false);
  });
});

describe("visibilidade dos dados do perfil", () => {
  it("mostra todos os dados da oficina, exceto IDs e credenciais", () => {
    expect(isProfileFieldVisible("Nome", "Oficina", false)).toBe(true);
    expect(isProfileFieldVisible("CNPJ", "Oficina", false)).toBe(true);
    expect(isProfileFieldVisible("Email", "Oficina", false)).toBe(true);
    expect(isProfileFieldVisible("Situacao", "Oficina", false)).toBe(true);
    expect(isProfileFieldVisible("Id", "Oficina", false)).toBe(false);
    expect(isProfileFieldVisible("IdOficina", "Funcionario", false)).toBe(false);
    expect(isProfileFieldVisible("Senha", "Oficina", false)).toBe(false);
  });

  it("respeita os campos exclusivos de cliente pessoa física ou jurídica", () => {
    expect(isProfileFieldVisible("Obs", "Cliente", false)).toBe(true);
    expect(isProfileFieldVisible("razao", "Cliente", false)).toBe(false);
    expect(isProfileFieldVisible("Obs", "Cliente", true)).toBe(false);
    expect(isProfileFieldVisible("razao", "Cliente", true)).toBe(true);
    expect(isProfileFieldVisible("DataNasc", "Cliente", true)).toBe(false);
    expect(isProfileFieldVisible("Sexo", "Cliente", true)).toBe(false);
    expect(isProfileFieldVisible("DataNasc", "Cliente", false)).toBe(true);
    expect(isProfileFieldVisible("Sexo", "Cliente", false)).toBe(true);
  });
});
