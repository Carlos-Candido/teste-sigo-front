import type { CrudConfig } from "@/components/CrudPanel";
import {
  isOwnIdField,
  isRelationIdField,
  normalizeFieldKey,
} from "@/lib/fieldMetadata";

export type RoleKey = "cliente" | "oficina" | "funcionario" | "unknown";

export type EntityCapability = {
  canList: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  scopeToOwnOffice?: boolean;
};

const emptyCapability: EntityCapability = {
  canList: false,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
};

const fullCapability: EntityCapability = {
  canList: true,
  canCreate: true,
  canUpdate: true,
  canDelete: true,
  scopeToOwnOffice: true,
};

const editableNoDelete: EntityCapability = {
  canList: true,
  canCreate: true,
  canUpdate: true,
  canDelete: false,
  scopeToOwnOffice: true,
};

const readOnlyScoped: EntityCapability = {
  canList: true,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
  scopeToOwnOffice: true,
};

const clientProfileCapability: EntityCapability = {
  canList: true,
  canCreate: true,
  canUpdate: true,
  canDelete: false,
};

const roleCapabilities: Record<
  Exclude<RoleKey, "unknown">,
  Record<string, EntityCapability>
> = {
  oficina: {
    clientes: {
      ...readOnlyScoped,
      canCreate: true,
      canUpdate: true,
      canDelete: true,
    },
    funcionarios: fullCapability,
    veiculos: fullCapability,
    pecas: fullCapability,
    servicos: fullCapability,
    pedidos: fullCapability,
    marcas: fullCapability,
  },
  funcionario: {
    clientes: readOnlyScoped,
    veiculos: fullCapability,
    pecas: fullCapability,
    servicos: fullCapability,
    pedidos: editableNoDelete,
  },
  cliente: {
    clientes: clientProfileCapability,
  },
};

const profileEntityByRole: Record<Exclude<RoleKey, "unknown">, string | null> = {
  cliente: "clientes",
  oficina: "oficinas",
  funcionario: "funcionarios",
};

const profileEditableFieldsByRole: Record<Exclude<RoleKey, "unknown">, string[]> = {
  oficina: [
    "Nome",
    "Numero",
    "Rua",
    "Cidade",
    "Cep",
    "Bairro",
    "Estado",
    "Pais",
    "Complemento",
  ],
  funcionario: ["Nome", "Cargo", "Email"],
  cliente: [
    "Nome",
    "Obs",
    "razao",
    "DataNasc",
    "Numero",
    "Rua",
    "Cidade",
    "Cep",
    "Bairro",
    "Estado",
    "Pais",
    "Complemento",
    "Sexo",
    "Telefones",
  ],
};

export const normalizeRole = (role: string | null | undefined): RoleKey => {
  const normalized = String(role ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (normalized.includes("cliente") || normalized.includes("client")) {
    return "cliente";
  }

  if (normalized.includes("oficina") || normalized.includes("workshop")) {
    return "oficina";
  }

  if (
    normalized.includes("funcionario") ||
    normalized.includes("employee") ||
    normalized.includes("colaborador")
  ) {
    return "funcionario";
  }

  return "unknown";
};

export const getEntityCapability = (
  role: string | null | undefined,
  entityKey: string
): EntityCapability => {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "unknown") return emptyCapability;
  return roleCapabilities[normalizedRole][entityKey] ?? emptyCapability;
};

export const getProfileEntityKey = (
  role: string | null | undefined
): string | null => {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "unknown") return null;
  return profileEntityByRole[normalizedRole];
};

export const getProfileEditableFields = (
  role: string | null | undefined
): string[] => {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "unknown") return [];
  return profileEditableFieldsByRole[normalizedRole];
};

export const isAllowedField = (fields: string[], key: string): boolean => {
  const normalizedKey = normalizeFieldKey(key);
  return fields.some((field) => normalizeFieldKey(field) === normalizedKey);
};

export const isProfileFieldVisible = (
  key: string,
  role: string | null | undefined,
  isCompanyClient: boolean
): boolean => {
  const normalizedKey = normalizeFieldKey(key);

  if (
    isOwnIdField(key) ||
    isRelationIdField(key) ||
    normalizedKey.includes("senha") ||
    normalizedKey.includes("password")
  ) {
    return false;
  }

  if (normalizeRole(role) !== "cliente") return true;
  if (isCompanyClient && normalizedKey === "obs") return false;
  if (isCompanyClient && ["datanasc", "sexo"].includes(normalizedKey)) return false;
  if (!isCompanyClient && normalizedKey === "razao") return false;

  return true;
};

export const getScopedListPath = (
  entityKey: string,
  listPath: string | undefined,
  oficinaId: number | null
): string | undefined => {
  if (entityKey === "clientes" && oficinaId) {
    return `/api/v1/clientes/oficinas/${oficinaId}`;
  }

  return listPath;
};

export const applyCapabilityToConfig = (
  config: CrudConfig,
  capability: EntityCapability,
  oficinaId: number | null,
  role: string | null | undefined
): CrudConfig => ({
  ...config,
  listPath: capability.canList
    ? role && normalizeRole(role) === "cliente" && config.key === "clientes"
      ? undefined
      : getScopedListPath(config.key, config.listPath, oficinaId)
    : undefined,
  updatePath: capability.canUpdate ? config.updatePath : undefined,
  deletePath: capability.canDelete ? config.deletePath : undefined,
});

export const getAllowedManagementConfigs = (
  configs: CrudConfig[],
  role: string | null | undefined,
  oficinaId: number | null
): CrudConfig[] =>
  configs
    .map((config) => ({
      config,
      capability: getEntityCapability(role, config.key),
    }))
    .filter(({ capability }) => capability.canList)
    .map(({ config, capability }) =>
      applyCapabilityToConfig(config, capability, oficinaId, role)
    );
