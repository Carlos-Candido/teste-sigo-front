"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchJson } from "@/lib/api";
import { fetchCepAddress } from "@/lib/cep";
import type { CrudConfig } from "@/components/CrudPanel";
import { entityConfigs } from "@/models/entityConfigs";
import {
  getAllowedManagementConfigs,
  getEntityCapability,
  type EntityCapability,
} from "@/lib/accessControl";
import { DashboardTabs } from "@/components/Dashboard/DashboardTabs";
import { NavBar } from "@/components/Sidebar/NavBar";
import { ProtectedRoute } from "@/components/Auth/RouteGuards";
import {
  buildEntityLabel,
  findRelationLabel,
  formatCep,
  formatCpf,
  formatCpfCnpj,
  formatCnpj,
  formatEnumValue,
  formatStateValue,
  getEnumOptions,
  getRecordId,
  getRelationEntityKey,
  isOwnIdField,
  isStateField,
  maskFieldValue,
  normalizeFieldKey,
  normalizeSubmitValue,
  stateOptions,
  type RelationOption,
  type RelationOptionsMap,
  type SelectOption,
} from "@/lib/fieldMetadata";

type FormMode = "create" | "edit" | "view";
type FormValue = Record<string, unknown>;
type BuildPayloadOptions = {
  includeArrays?: boolean;
  parentId?: number | null;
  parentListKey?: string;
  entityKey?: string;
  formMode?: FormMode;
};

const managementKeys = [
  "clientes",
  "funcionarios",
  "marcas",
  "servicos",
  "pecas",
  "veiculos",
  "pedidos",
];

const PAGE_SIZE = 45;

const parentIdFieldByList: Record<string, string> = {
  telefones: "ClienteId",
  funcionarioservicos: "IdServico",
  pedidopecas: "IdPedido",
  pedidoservicos: "IdPedido",
};

const partConditionOptions: SelectOption[] = [
  { value: "Nova", label: "Nova" },
  { value: "Usada", label: "Usada" },
  { value: "Recondicionada", label: "Recondicionada" },
  { value: "Danificada", label: "Danificada" },
];

const hiddenFieldByEntity: Record<string, string[]> = {
  clientes: ["senha"],
  funcionarios: ["senha"],
};

const shouldHideFieldForEntity = (entityKey: string, key: string): boolean =>
  (hiddenFieldByEntity[entityKey] ?? []).includes(normalizeFieldKey(key));

const shouldCreateWithArrays = (entityKey: string): boolean =>
  entityKey === "servicos";

const fieldLabels: Record<string, string> = {
  id: "ID",
  nome: "Nome",
  email: "Email",
  senha: "Senha",
  cpf: "CPF",
  cnpj: "CNPJ",
  cpfcnpj: "CPF/CNPJ",
  obs: "Observação",
  razao: "Razão social",
  datanasc: "Data de nascimento",
  numero: "Número",
  rua: "Rua",
  cidade: "Cidade",
  cep: "CEP",
  bairro: "Bairro",
  estado: "Estado",
  pais: "País",
  complemento: "Complemento",
  sexo: "Sexo",
  tipocliente: "Tipo de cliente",
  situacao: "Situação",
  telefones: "Telefones",
  ddd: "DDD",
  desc: "Descrição curta",
  descricao: "Descrição",
  tipomarca: "Tipo de marca",
  valor: "Valor",
  garantia: "Garantia",
  funcionarioservicos: "Funcionários do serviço",
  idfuncionario: "Funcionário",
  idservico: "Serviço",
  tempodec: "Tempo decimal",
  tipo: "Tipo",
  quantidade: "Quantidade",
  unidade: "Unidade",
  idmarca: "Marca",
  dataaquisicao: "Data de aquisição",
  fornecedor: "Fornecedor",
  idcliente: "Cliente",
  idoficina: "Oficina",
  idveiculo: "Veículo",
  valortotal: "Valor total",
  descontoreais: "Desconto em reais",
  descontoporcentagem: "Desconto em porcentagem",
  descontototalreais: "Desconto total em reais",
  descontoservicoporcentagem: "Desconto do serviço em porcentagem",
  descontoservicoreais: "Desconto do serviço em reais",
  descontopecaporcentagem: "Desconto da peça em porcentagem",
  descontopecareais: "Desconto da peça em reais",
  observacao: "Observação",
  datainicio: "Data de início",
  datafim: "Data de fim",
  pedidopecas: "Peças do pedido",
  pedidoservicos: "Serviços do pedido",
  idpedido: "Pedido",
  idpeca: "Peça",
  quantvezes: "Quantidade de vezes",
  datainstalacao: "Data de instalação",
  nomeveiculo: "Nome do veículo",
  tipoveiculo: "Tipo do veículo",
  placaveiculo: "Placa",
  chassisveiculo: "Chassi",
  anofab: "Ano de fabricação",
  quilometragem: "Quilometragem",
  combustivel: "Combustível",
  seguro: "Seguro",
  cor: "Cor",
  clienteid: "Cliente",
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getRecordValue = (record: Record<string, unknown>, key: string) => {
  if (key in record) return record[key];
  const normalized = normalizeFieldKey(key);
  const matchedKey = Object.keys(record).find(
    (candidate) => normalizeFieldKey(candidate) === normalized
  );
  return matchedKey ? record[matchedKey] : undefined;
};

const cloneTemplate = (value: Record<string, unknown>): FormValue =>
  JSON.parse(JSON.stringify(value)) as FormValue;

const mergeWithTemplate = (template: unknown, value: unknown): unknown => {
  if (Array.isArray(template)) {
    const templateItem = template[0];
    const items = Array.isArray(value) ? value : [];

    if (templateItem && isPlainObject(templateItem)) {
      return items.map((item) =>
        isPlainObject(item) ? mergeWithTemplate(templateItem, item) : templateItem
      );
    }

    return items;
  }

  if (isPlainObject(template)) {
    const result: Record<string, unknown> = {};
    const recordValue = isPlainObject(value) ? value : {};

    Object.keys(template).forEach((key) => {
      result[key] = mergeWithTemplate(
        template[key],
        getRecordValue(recordValue, key)
      );
    });

    return result;
  }

  return value ?? template;
};

const buildPayload = (
  template: unknown,
  value: unknown,
  key = "",
  options: BuildPayloadOptions = {}
): unknown => {
  if (Array.isArray(template)) {
    if (options.includeArrays === false) return undefined;
    const templateItem = template[0];
    const items = Array.isArray(value) ? value : [];
    if (!templateItem) return items;
    return items.map((item) =>
      buildPayload(templateItem, item, key, {
        ...options,
        parentListKey: key,
      })
    );
  }

  if (isPlainObject(template)) {
    const result: Record<string, unknown> = {};
    const recordValue = isPlainObject(value) ? value : {};

    Object.keys(template).forEach((key) => {
      if (isOwnIdField(key)) return;
      if (
        !options.parentListKey &&
        options.entityKey &&
        options.formMode === "edit" &&
        shouldHideFieldForEntity(options.entityKey, key)
      ) {
        return;
      }
      const parentField = options.parentListKey
        ? parentIdFieldByList[normalizeFieldKey(options.parentListKey)]
        : null;
      if (
        parentField &&
        normalizeFieldKey(key) === normalizeFieldKey(parentField)
      ) {
        if (options.parentId) result[key] = options.parentId;
        return;
      }

      const payloadValue = buildPayload(template[key], recordValue[key], key, options);
      if (payloadValue !== undefined) result[key] = payloadValue;
    });

    return result;
  }

  return normalizeSubmitValue(key, template, value);
};

const extractList = (data: unknown): FormValue[] => {
  if (Array.isArray(data)) return data as FormValue[];

  if (isPlainObject(data)) {
    const nested = data.data ?? data.items ?? data.result;
    if (Array.isArray(nested)) return nested as FormValue[];
    if (isPlainObject(nested) && Array.isArray(nested.items)) {
      return nested.items as FormValue[];
    }
  }

  return [];
};

const getItemId = (item: FormValue): number | null => {
  const raw =
    item.Id ??
    item.id ??
    item.ID ??
    getRecordValue(item, "Id") ??
    getRecordValue(item, "id");
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
};

const officeFieldKeys = [
  "IdOficina",
  "idOficina",
  "OficinaId",
  "oficinaId",
  "id_oficina",
];

const findOfficeFieldKey = (record: FormValue): string | null => {
  const normalizedKeys = officeFieldKeys.map(normalizeFieldKey);
  return (
    Object.keys(record).find((key) =>
      normalizedKeys.includes(normalizeFieldKey(key))
    ) ?? null
  );
};

const getOfficeIdFromRecord = (record: FormValue): number | null => {
  const raw = officeFieldKeys
    .map((key) => getRecordValue(record, key))
    .find((value) => value !== undefined && value !== null && value !== "");
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const isRecordInOwnOffice = (
  item: FormValue,
  capability: EntityCapability,
  oficinaId: number | null
): boolean => {
  if (!capability.scopeToOwnOffice || !oficinaId) return true;
  const recordOfficeId = getOfficeIdFromRecord(item);
  return !recordOfficeId || recordOfficeId === oficinaId;
};

const getNestedRecordId = (value: unknown): number | null => {
  if (!isPlainObject(value)) return null;

  const directId = getItemId(value);
  if (directId) return directId;

  const nested = value.data ?? value.Data ?? value.result ?? value.item;
  if (isPlainObject(nested)) return getNestedRecordId(nested);

  return null;
};

const hasArrayItems = (template: unknown, value: unknown): boolean => {
  if (Array.isArray(template)) {
    return Array.isArray(value) && value.length > 0;
  }

  if (!isPlainObject(template) || !isPlainObject(value)) return false;

  return Object.keys(template).some((key) => hasArrayItems(template[key], value[key]));
};

const getAutoParentField = (path: Array<string | number>): string | null => {
  const listKey = [...path]
    .reverse()
    .find((part) => typeof part === "string" && parentIdFieldByList[normalizeFieldKey(part)]);

  return typeof listKey === "string"
    ? parentIdFieldByList[normalizeFieldKey(listKey)]
    : null;
};

const formatValue = (
  key: string,
  value: unknown,
  relationOptions: RelationOptionsMap
): string => {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) return `${value.length} itens`;
  if (isPlainObject(value)) return "-";

  const relationLabel = findRelationLabel(relationOptions, key, value);
  if (relationLabel) return relationLabel;

  const enumLabel = formatEnumValue(key, value);
  if (enumLabel) return enumLabel;

  if (isStateField(key)) return formatStateValue(value);

  const normalized = normalizeFieldKey(key);
  if (normalized.includes("cpfcnpj")) return formatCpfCnpj(value);
  if (normalized.includes("cpf") && !normalized.includes("cnpj")) return formatCpf(value);
  if (normalized.includes("cnpj")) return formatCnpj(value);
  if (normalized === "cep") return formatCep(value);

  return String(value);
};

const formatFieldLabel = (key: string): string => {
  const mappedLabel = fieldLabels[normalizeFieldKey(key)];
  if (mappedLabel) return mappedLabel;

  const withSpaces = key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\bid\b/gi, "ID")
    .trim();

  return withSpaces
    .split(" ")
    .filter(Boolean)
    .map((word) =>
      word.toLowerCase() === "id"
        ? "ID"
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join(" ");
};

const getInputType = (key: string, templateValue: unknown): string => {
  const loweredKey = key.toLowerCase();
  const normalized = normalizeFieldKey(key);
  if (
    normalized === "cep" ||
    normalized.includes("cpf") ||
    normalized.includes("cnpj")
  ) {
    return "text";
  }
  if (loweredKey.includes("senha")) return "password";
  if (loweredKey.includes("email")) return "email";
  if (typeof templateValue === "number") return "number";
  if (
    typeof templateValue === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(templateValue)
  ) {
    return "date";
  }
  return "text";
};

const getFieldOptions = (
  key: string,
  path: Array<string | number> = []
): SelectOption[] | null => {
  const isPartOrderState = path.some(
    (part) =>
      typeof part === "string" && normalizeFieldKey(part) === "pedidopecas"
  );
  if (isPartOrderState && normalizeFieldKey(key) === "estado") {
    return partConditionOptions;
  }
  if (isStateField(key)) return stateOptions;
  return getEnumOptions(key);
};

const getDisplayKeys = (
  template: Record<string, unknown>,
  entityKey: string
): string[] => {
  const keys = Object.keys(template).filter((key) => {
    if (shouldHideFieldForEntity(entityKey, key)) return false;
    const value = template[key];
    return value === null || typeof value !== "object";
  });

  if (!keys.includes("Id")) keys.unshift("Id");
  return keys.slice(0, 6);
};

const setAtPath = (
  source: unknown,
  path: Array<string | number>,
  value: unknown
): unknown => {
  if (path.length === 0) return value;

  const [head, ...rest] = path;

  if (Array.isArray(source)) {
    const clone = [...source];
    const index = typeof head === "number" ? head : Number(head);
    clone[index] = setAtPath(clone[index], rest, value);
    return clone;
  }

  const record = isPlainObject(source) ? source : {};
  return {
    ...record,
    [head]: setAtPath(record[head as string], rest, value),
  };
};

type RelationComboFieldProps = {
  label: string;
  value: unknown;
  options: RelationOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

function RelationComboField({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: RelationComboFieldProps) {
  const selectedOption = options.find(
    (option) => String(option.value) === String(value)
  );
  const [query, setQuery] = useState(selectedOption?.label ?? "");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setQuery(selectedOption?.label ?? "");
  }, [selectedOption?.label, value]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? options.filter((option) => {
          const label = option.label.toLowerCase();
          const optionValue = String(option.value).toLowerCase();
          return label.includes(normalizedQuery) || optionValue.includes(normalizedQuery);
        })
      : options;

    return filtered.slice(0, 10);
  }, [options, query]);

  return (
    <label className="sigo-label relative rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-3">
      <span>{label}</span>
      <input
        className="sigo-input"
        type="text"
        value={query}
        placeholder="Digite para buscar"
        autoComplete="off"
        disabled={disabled}
        onFocus={() => {
          if (!disabled) setIsOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onChange={(event) => {
          if (disabled) return;
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          setIsOpen(true);
          if (!nextQuery.trim()) onChange("");
        }}
      />
      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 max-h-64 overflow-auto rounded-lg border border-[var(--sigo-border)] bg-white p-1 shadow-[var(--sigo-shadow-lg)]">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={String(option.value)}
                type="button"
                className={`w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${
                  String(option.value) === String(value)
                    ? "bg-[var(--sigo-blue)] text-white"
                    : "text-[var(--sigo-text)] hover:bg-[var(--sigo-surface-soft)]"
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(String(option.value));
                  setQuery(option.label);
                  setIsOpen(false);
                }}
              >
                {option.label}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm font-medium text-[var(--sigo-muted)]">
              Nenhum registro encontrado.
            </p>
          )}
        </div>
      ) : null}
    </label>
  );
}

export default function GerenciaPage() {
  const { baseUrl, token, userRole, oficinaId } = useAuth();
  const entities = useMemo(
    () =>
      getAllowedManagementConfigs(
        entityConfigs.filter((config) => managementKeys.includes(config.key)),
        userRole,
        oficinaId
      ),
    [oficinaId, userRole]
  );
  const [selectedKey, setSelectedKey] = useState("");
  const selectedConfig =
    entities.find((config) => config.key === selectedKey) ?? entities[0];
  const selectedCapability = selectedConfig
    ? getEntityCapability(userRole, selectedConfig.key)
    : null;
  const [items, setItems] = useState<FormValue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [lastCepLookup, setLastCepLookup] = useState("");
  const [formData, setFormData] = useState<FormValue>(() =>
    cloneTemplate(entityConfigs[0].template)
  );
  const [relationOptions, setRelationOptions] = useState<RelationOptionsMap>(
    {}
  );

  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token]
  );

  useEffect(() => {
    if (!entities.length) return;
    if (!entities.some((config) => config.key === selectedKey)) {
      setSelectedKey(entities[0].key);
    }
  }, [entities, selectedKey]);

  const applyLoggedOficina = (data: FormValue): FormValue => {
    if (!selectedCapability?.scopeToOwnOffice || !oficinaId) return data;
    const officeField = findOfficeFieldKey(data);
    if (!officeField) return data;
    return setAtPath(data, [officeField], oficinaId) as FormValue;
  };

  const loadList = async (config: CrudConfig) => {
    if (!config.listPath) {
      setItems([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    const result = await fetchJson(baseUrl, config.listPath, {
      method: "GET",
      headers: authHeaders,
    });

    if (!result.ok) {
      const message =
        isPlainObject(result.data) && typeof result.data.Message === "string"
          ? result.data.Message
          : "Falha ao carregar registros";
      setError(message);
      setItems([]);
      setIsLoading(false);
      return;
    }

    const capability = getEntityCapability(userRole, config.key);
    setItems(
      extractList(result.data).filter((item) =>
        isRecordInOwnOffice(item, capability, oficinaId)
      )
    );
    setIsLoading(false);
  };

  const resolveCreatedId = async (resultData: unknown): Promise<number | null> => {
    const directId = getNestedRecordId(resultData);
    if (directId) return directId;

    if (!selectedConfig?.listPath) return null;

    const listResult = await fetchJson(baseUrl, selectedConfig.listPath, {
      method: "GET",
      headers: authHeaders,
    });

    if (!listResult.ok) return null;

    return extractList(listResult.data).reduce<number | null>((maxId, item) => {
      const id = getItemId(item);
      if (!id) return maxId;
      return maxId === null || id > maxId ? id : maxId;
    }, null);
  };

  const loadRelationOptions = async () => {
    const configs = getAllowedManagementConfigs(
      entityConfigs.filter((config) => config.listPath),
      userRole,
      oficinaId
    );
    const entries = await Promise.all(
      configs.map(async (config) => {
        const result = await fetchJson(baseUrl, config.listPath as string, {
          method: "GET",
          headers: authHeaders,
        });

        if (!result.ok) return [config.key, []] as const;

        const capability = getEntityCapability(userRole, config.key);
        const options = extractList(result.data)
          .filter((item) => isRecordInOwnOffice(item, capability, oficinaId))
          .map((item) => {
            const id = getRecordId(item);
            if (!id) return null;
            return {
              value: id,
              label: buildEntityLabel(config.key, item),
              item,
            };
          })
          .filter(Boolean) as RelationOptionsMap[string];

        return [config.key, options] as const;
      })
    );

    setRelationOptions(Object.fromEntries(entries));
  };

  useEffect(() => {
    if (!selectedConfig) return;
    setFormMode("create");
    setEditingId(null);
    setFormData(applyLoggedOficina(cloneTemplate(selectedConfig.template)));
    setShowForm(false);
    setSearchTerm("");
    setCurrentPage(1);
    loadList(selectedConfig);
  }, [selectedConfig, baseUrl, token, oficinaId, userRole]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (!token) return;
    loadRelationOptions();
  }, [baseUrl, token, userRole, oficinaId]);

  const openCreateForm = () => {
    if (!selectedConfig || !selectedCapability?.canCreate) return;
    setFormMode("create");
    setEditingId(null);
    setFormData(applyLoggedOficina(cloneTemplate(selectedConfig.template)));
    setShowForm(true);
  };

  const handleEdit = async (item: FormValue, nextMode: FormMode = "edit") => {
    if (!selectedConfig) return;
    const id = getItemId(item);
    if (!id) return;
    let itemToEdit = item;

    if (selectedConfig.getByIdPath) {
      setIsLoading(true);
      setError(null);
      const result = await fetchJson(
        baseUrl,
        selectedConfig.getByIdPath(String(id)),
        {
          method: "GET",
          headers: authHeaders,
        }
      );

      if (result.ok) {
        const list = extractList(result.data);
        const fullRecord =
          isPlainObject(result.data) && !Array.isArray(result.data)
            ? ((result.data.Data ?? result.data.data ?? result.data) as unknown)
            : list[0];
        if (isPlainObject(fullRecord)) {
          itemToEdit = fullRecord;
        }
      }
      setIsLoading(false);
    }

    setFormMode(nextMode);
    setEditingId(id);
    setFormData(
      applyLoggedOficina(mergeWithTemplate(selectedConfig.template, itemToEdit) as FormValue)
    );
    setShowForm(true);
  };

  const handleCreate = async () => {
    if (!selectedConfig || !selectedCapability?.canCreate) return;
    setIsLoading(true);
    setError(null);
    const result = await fetchJson(baseUrl, selectedConfig.createPath, {
      method: "POST",
      headers: authHeaders,
      body: buildPayload(selectedConfig.template, formData, "", {
        includeArrays: shouldCreateWithArrays(selectedConfig.key),
        entityKey: selectedConfig.key,
        formMode: "create",
      }),
    });

    if (!result.ok) {
      const message =
        isPlainObject(result.data) && typeof result.data.Message === "string"
          ? result.data.Message
          : "Falha ao criar registro";
      setError(message);
      setIsLoading(false);
      return;
    }

    if (
      selectedConfig.updatePath &&
      hasArrayItems(selectedConfig.template, formData)
    ) {
      const createdId = await resolveCreatedId(result.data);
      if (createdId) {
        const childResult = await fetchJson(
          baseUrl,
          selectedConfig.updatePath(String(createdId)),
          {
            method: "PUT",
            headers: authHeaders,
            body: buildPayload(selectedConfig.template, formData, "", {
              includeArrays: true,
              parentId: createdId,
              entityKey: selectedConfig.key,
              formMode: "create",
            }),
          }
        );

        if (!childResult.ok) {
          const message =
            isPlainObject(childResult.data) &&
            typeof childResult.data.Message === "string"
              ? childResult.data.Message
              : "Registro principal criado, mas falha ao salvar itens vinculados";
          setError(message);
          setIsLoading(false);
          return;
        }
      }
    }

    setShowForm(false);
    await loadList(selectedConfig);
  };

  const handleUpdate = async () => {
    if (
      !selectedConfig?.updatePath ||
      !editingId ||
      !selectedCapability?.canUpdate
    ) {
      return;
    }
    setIsLoading(true);
    setError(null);
    const result = await fetchJson(
      baseUrl,
      selectedConfig.updatePath(String(editingId)),
      {
        method: "PUT",
        headers: authHeaders,
        body: buildPayload(selectedConfig.template, formData, "", {
          includeArrays: true,
          parentId: editingId,
          entityKey: selectedConfig.key,
          formMode: "edit",
        }),
      }
    );

    if (!result.ok) {
      const message =
        isPlainObject(result.data) && typeof result.data.Message === "string"
          ? result.data.Message
          : "Falha ao atualizar registro";
      setError(message);
      setIsLoading(false);
      return;
    }

    setShowForm(false);
    await loadList(selectedConfig);
  };

  const handleDelete = async (id: number) => {
    if (!selectedConfig?.deletePath || !selectedCapability?.canDelete) return;
    if (!window.confirm("Deseja realmente excluir este registro?")) return;

    setIsLoading(true);
    setError(null);
    const result = await fetchJson(
      baseUrl,
      selectedConfig.deletePath(String(id)),
      {
        method: "DELETE",
        headers: authHeaders,
      }
    );

    if (!result.ok) {
      const message =
        isPlainObject(result.data) && typeof result.data.Message === "string"
          ? result.data.Message
          : "Falha ao excluir registro";
      setError(message);
      setIsLoading(false);
      return;
    }

    await loadList(selectedConfig);
  };

  const handleFieldChange = (
    path: Array<string | number>,
    templateValue: unknown,
    value: string
  ) => {
    let nextValue: unknown = value;
    const key = String(path[path.length - 1] ?? "");
    const normalized = normalizeFieldKey(key);

    if (
      normalized === "cep" ||
      normalized.includes("cpf") ||
      normalized.includes("cnpj")
    ) {
      nextValue = maskFieldValue(key, value);
    } else if (typeof templateValue === "number") {
      const parsed = Number(value);
      nextValue = Number.isNaN(parsed) ? templateValue : parsed;
    } else {
      nextValue = maskFieldValue(key, value);
    }

    setFormData((prev) => setAtPath(prev, path, nextValue) as FormValue);

    if (normalized === "cep") {
      const cepDigits = String(value).replace(/\D/g, "");
      const lookupKey = `${selectedConfig.key}:${path.join(".")}:${cepDigits}`;
      if (cepDigits.length === 8 && lookupKey !== lastCepLookup) {
        setLastCepLookup(lookupKey);
        const parentPath = path.slice(0, -1);
        fetchCepAddress(baseUrl, cepDigits, authHeaders).then((address) => {
          if (!address) return;
          setFormData((prev) => {
            let next: unknown = prev;
            const applySibling = (field: string, fieldValue?: string) => {
              if (!fieldValue) return;
              next = setAtPath(next, [...parentPath, field], fieldValue);
            };

            applySibling("Rua", address.rua);
            applySibling("Bairro", address.bairro);
            applySibling("Cidade", address.cidade);
            applySibling("Estado", address.estado);
            applySibling("Complemento", address.complemento);
            applySibling("Pais", address.pais);

            return next as FormValue;
          });
        });
      }
    }
  };

  const renderFields = (
    template: Record<string, unknown>,
    value: Record<string, unknown>,
    path: Array<string | number> = []
  ) =>
    Object.keys(template).map((key) => {
      const templateValue = template[key];
      const currentValue = value[key];
      const fieldPath = [...path, key];
      const autoParentField = getAutoParentField(path);

      if (
        isOwnIdField(key, path) ||
        (path.length === 0 &&
          formMode !== "create" &&
          shouldHideFieldForEntity(selectedConfig.key, key)) ||
        (autoParentField &&
          normalizeFieldKey(key) === normalizeFieldKey(autoParentField))
      ) {
        return null;
      }

      if (Array.isArray(templateValue)) {
        const items = Array.isArray(currentValue) ? currentValue : [];
        const itemTemplate = templateValue[0] as Record<string, unknown> | undefined;

        return (
          <div
            key={fieldPath.join(".")}
            className="rounded-lg border border-[var(--sigo-border)] bg-white shadow-[var(--sigo-shadow-sm)] md:col-span-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] px-4 py-3">
              <div>
                <p className="text-sm font-extrabold text-[var(--sigo-text)]">
                {formatFieldLabel(key)}
                </p>
                <p className="mt-1 text-xs font-medium text-[var(--sigo-muted)]">
                  Adicione e organize os itens vinculados.
                </p>
              </div>
              {itemTemplate && formMode !== "view" ? (
                <button
                  type="button"
                  className="sigo-button min-h-9 px-3 text-xs"
                  onClick={() => {
                    const nextItems = [...items, cloneTemplate(itemTemplate)];
                    setFormData((prev) =>
                      setAtPath(prev, fieldPath, nextItems) as FormValue
                    );
                  }}
                >
                  Adicionar
                </button>
              ) : null}
            </div>
            <div className="grid gap-3 p-4">
              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--sigo-border-strong)] bg-[var(--sigo-surface-soft)] px-4 py-3 text-sm font-semibold text-[var(--sigo-muted)]">
                  Sem itens adicionados.
                </p>
              ) : null}
              {items.map((item, index) => (
                <div
                  key={`${key}-${index}`}
                  className="rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-[var(--sigo-muted)]">
                      Item
                    </p>
                    {formMode !== "view" ? (
                      <button
                        type="button"
                        className="text-xs font-bold text-[var(--sigo-danger)]"
                        onClick={() => {
                          const nextItems = items.filter((_, idx) => idx !== index);
                          setFormData((prev) =>
                            setAtPath(prev, fieldPath, nextItems) as FormValue
                          );
                        }}
                      >
                        Remover
                      </button>
                    ) : null}
                  </div>
                  {itemTemplate && isPlainObject(item) ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {renderFields(
                        itemTemplate,
                        item as Record<string, unknown>,
                        [...fieldPath, index]
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        );
      }

      if (isPlainObject(templateValue) && isPlainObject(currentValue)) {
        return (
          <div key={fieldPath.join(".")} className="grid gap-3 md:col-span-2">
            <p className="text-sm font-extrabold text-[var(--sigo-text)]">
              {formatFieldLabel(key)}
            </p>
            {renderFields(templateValue, currentValue, fieldPath)}
          </div>
        );
      }

      const normalizedValue =
        currentValue === undefined || currentValue === null
          ? templateValue ?? ""
          : currentValue;
      const displayValue =
        normalizeFieldKey(key) === "cep" ||
        normalizeFieldKey(key).includes("cpf") ||
        normalizeFieldKey(key).includes("cnpj")
          ? maskFieldValue(key, normalizedValue)
          : String(normalizedValue);
      const fieldOptions = getFieldOptions(key, path);
      const relationEntityKey = getRelationEntityKey(key);
      const isLoggedOficinaField =
        selectedCapability?.scopeToOwnOffice &&
        Boolean(oficinaId) &&
        ["idoficina", "oficinaid"].includes(normalizeFieldKey(key));
      const loggedOficinaLabel =
        findRelationLabel(relationOptions, "idOficina", oficinaId) ||
        (oficinaId ? `Oficina #${oficinaId}` : "");

      if (isLoggedOficinaField) {
        return (
          <label
            key={fieldPath.join(".")}
            className="sigo-label rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-3"
          >
            <span>{formatFieldLabel(key)}</span>
            <input
              className="sigo-input"
              type="text"
              value={loggedOficinaLabel || "Oficina logada"}
              disabled
            />
          </label>
        );
      }

      if (relationEntityKey) {
        return (
          <RelationComboField
            key={fieldPath.join(".")}
            label={formatFieldLabel(key)}
            value={normalizedValue}
            options={relationOptions[relationEntityKey] ?? []}
            disabled={formMode === "view"}
            onChange={(nextValue) =>
              handleFieldChange(fieldPath, templateValue, nextValue)
            }
          />
        );
      }

      return (
        <label key={fieldPath.join(".")} className="sigo-label rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-3">
          <span>{formatFieldLabel(key)}</span>
          {fieldOptions ? (
            <select
              className="sigo-input"
              value={String(normalizedValue)}
              disabled={formMode === "view"}
              onChange={(event) =>
                handleFieldChange(fieldPath, templateValue, event.target.value)
              }
            >
              <option value="">Selecione</option>
              {fieldOptions.map((option) => (
                <option key={String(option.value)} value={String(option.value)}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="sigo-input"
              type={getInputType(key, templateValue)}
              value={displayValue}
              disabled={formMode === "view"}
              inputMode={
                normalizeFieldKey(key).includes("cpf") ||
                normalizeFieldKey(key).includes("cnpj") ||
                normalizeFieldKey(key) === "cep"
                  ? "numeric"
                  : undefined
              }
              onChange={(event) =>
                handleFieldChange(fieldPath, templateValue, event.target.value)
              }
            />
          )}
        </label>
      );
    });

  if (!selectedConfig) {
    return (
      <div className="sigo-page">
        <NavBar />
        <main className="sigo-shell py-8">
          <div className="sigo-card p-5 text-sm text-[var(--sigo-muted)]">
            Nenhuma classe configurada.
          </div>
        </main>
      </div>
    );
  }

  const displayKeys = getDisplayKeys(selectedConfig.template, selectedConfig.key);
  const filteredItems = items.filter((item) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;

    return Object.keys(selectedConfig.template).some((key) => {
      const rawValue = getRecordValue(item, key) ?? item[key];
      const formattedValue = formatValue(key, rawValue, relationOptions);
      return formattedValue.toLowerCase().includes(query);
    });
  });
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const normalizedPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (normalizedPage - 1) * PAGE_SIZE;
  const paginatedItems = filteredItems.slice(
    pageStartIndex,
    pageStartIndex + PAGE_SIZE
  );

  return (
    <ProtectedRoute>
      <div className="sigo-page">
      <NavBar />
      <main className="sigo-shell grid gap-6 py-8">
        <DashboardTabs />

        <header className="sigo-card overflow-hidden">
          <div className="flex flex-col gap-3 bg-[linear-gradient(135deg,var(--sigo-blue-deep),var(--sigo-blue))] p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-100">
              Gerencia
            </p>
            <h1 className="mt-3 text-3xl font-black text-white lg:text-4xl">
              Cadastros e registros
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50">
              Selecione uma área, consulte registros e mantenha as informações operacionais
            </p>
          </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="sigo-card h-fit overflow-hidden lg:sticky lg:top-28">
            <div className="border-b border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] px-4 py-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sigo-soft)]">
                Entidades
              </p>
            </div>
            <nav className="grid gap-2 p-3">
              {entities.map((config) => (
                <button
                  key={config.key}
                  type="button"
                  className={`rounded-lg border px-4 py-3 text-left text-sm font-black ${
                    config.key === selectedKey
                      ? "border-transparent bg-[linear-gradient(135deg,var(--sigo-blue-deep),var(--sigo-blue))] text-white shadow-[0_12px_24px_rgba(7,95,189,0.2)]"
                      : "border-[var(--sigo-border)] bg-white text-[var(--sigo-blue-deep)] hover:border-[var(--sigo-border-strong)] hover:bg-[var(--sigo-surface-soft)]"
                  }`}
                  onClick={() => setSelectedKey(config.key)}
                >
                  {config.label}
                </button>
              ))}
            </nav>
          </aside>

          <section className="sigo-card overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-[var(--sigo-border)] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-extrabold text-[var(--sigo-text)]">
                  {filteredItems.length} de {items.length} registro(s).
                </h2>
              </div>
              {selectedCapability?.canCreate ? (
                <button
                  type="button"
                  className="sigo-button sigo-button-primary"
                  onClick={openCreateForm}
                >
                  Criar
                </button>
              ) : null}
            </div>

            <div className="p-5">
              {error ? (
                <div className="sigo-error mb-4 px-4 py-3 text-sm font-semibold">
                  {error}
                </div>
              ) : null}

              <div className="mb-4 grid gap-3 rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                <label className="sigo-label">
                  <span>Pesquisar registros</span>
                  <input
                    className="sigo-input bg-white"
                    type="search"
                    value={searchTerm}
                    placeholder={`Buscar em ${selectedConfig.label.toLowerCase()}`}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </label>
                <label className="sigo-label min-w-44">
                  <span>Filtro</span>
                  <select className="sigo-input bg-white" defaultValue="">
                    <option value="">Todos os registros</option>
                    <option value="recentes">Mais recentes</option>
                    <option value="ativos">Ativos</option>
                    <option value="pendentes">Pendentes</option>
                  </select>
                </label>
              </div>

              {isLoading ? (
                <p className="text-sm font-semibold text-[var(--sigo-muted)]">
                  Carregando...
                </p>
              ) : filteredItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--sigo-border-strong)] bg-[var(--sigo-surface-soft)] px-5 py-10 text-center">
                  <p className="text-sm font-bold text-[var(--sigo-muted)]">
                    Nenhum registro encontrado.
                  </p>
                </div>
              ) : (
                <div className="sigo-scrollbar overflow-auto rounded-lg border border-[var(--sigo-border)]">
                  <table className="sigo-table">
                    <thead>
                      <tr>
                        {displayKeys.map((key) => (
                          <th key={key}>{formatFieldLabel(key)}</th>
                        ))}
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((item, index) => {
                        const id = getItemId(item);
                        const rowIndex = pageStartIndex + index;
                        return (
                          <tr key={`${selectedConfig.key}-${id ?? rowIndex}`}>
                            {displayKeys.map((key) => (
                              <td key={`${key}-${rowIndex}`}>
                                {formatValue(
                                  key,
                                  getRecordValue(item, key) ?? item[key],
                                  relationOptions
                                )}
                              </td>
                            ))}
                            <td>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="sigo-button min-h-9 px-3 text-xs"
                                  disabled={!id}
                                  onClick={() =>
                                    handleEdit(
                                      item,
                                      selectedCapability?.canUpdate
                                        ? "edit"
                                        : "view"
                                    )
                                  }
                                >
                                  {selectedCapability?.canUpdate ? "Editar" : "Ver"}
                                </button>
                                {selectedCapability?.canDelete ? (
                                  <button
                                    type="button"
                                    className="sigo-button sigo-button-danger min-h-9 px-3 text-xs"
                                    disabled={!selectedConfig.deletePath || !id}
                                    onClick={() => id && handleDelete(id)}
                                  >
                                    Excluir
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {!isLoading && filteredItems.length > 0 ? (
                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-[var(--sigo-border)] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-[var(--sigo-muted)]">
                    Mostrando {pageStartIndex + 1}-
                    {Math.min(pageStartIndex + PAGE_SIZE, filteredItems.length)} de{" "}
                    {filteredItems.length} registro(s)
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="sigo-button min-h-9 px-3 text-xs"
                      disabled={normalizedPage <= 1}
                      onClick={() =>
                        setCurrentPage((page) => Math.max(1, page - 1))
                      }
                    >
                      Anterior
                    </button>
                    <span className="sigo-badge">
                      Pagina {normalizedPage} de {totalPages}
                    </span>
                    <button
                      type="button"
                      className="sigo-button min-h-9 px-3 text-xs"
                      disabled={normalizedPage >= totalPages}
                      onClick={() =>
                        setCurrentPage((page) => Math.min(totalPages, page + 1))
                      }
                    >
                      Proxima
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </main>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 px-4 py-8">
          <div className="sigo-card w-full max-w-4xl overflow-hidden">
            <div className="flex flex-col gap-3 bg-[linear-gradient(135deg,var(--sigo-blue-deep),var(--sigo-blue))] px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-100">
                  {selectedConfig.label}
                </p>
                <h2 className="mt-1 text-xl font-black text-white">
                  {formMode === "view"
                    ? `Ver ${selectedConfig.label}`
                    : formMode === "edit"
                      ? `Editar ${selectedConfig.label}`
                      : `Criar ${selectedConfig.label}`}
                </h2>

              </div>
            </div>

            <div className="sigo-scrollbar max-h-[72vh] overflow-y-auto p-5">
              <div className="rounded-lg border border-[var(--sigo-border)] bg-white p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--sigo-border)] pb-4">
                  <div>
                    <p className="text-sm font-black text-[var(--sigo-text)]">
                      Informações do registro
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                {renderFields(selectedConfig.template, formData)}
                </div>
              </div>

              {error ? (
                <div className="sigo-error mt-5 px-4 py-3 text-sm font-semibold">
                  {error}
                </div>
              ) : null}

              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[var(--sigo-border)] pt-5 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  className="sigo-button"
                  onClick={() => setShowForm(false)}
                >
                  {formMode === "view" ? "Fechar" : "Cancelar"}
                </button>
                {formMode !== "view" ? (
                  <button
                    type="button"
                    className="sigo-button sigo-button-primary"
                    disabled={
                      isLoading ||
                      (formMode === "edit" && !selectedConfig.updatePath)
                    }
                    onClick={formMode === "edit" ? handleUpdate : handleCreate}
                  >
                    {isLoading
                      ? "Salvando..."
                      : formMode === "edit"
                        ? "Salvar alteracoes"
                        : "Criar registro"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </ProtectedRoute>
  );
}
