export type SelectOption = {
  value: string | number;
  label: string;
};

export type RelationOption = SelectOption & {
  item?: Record<string, unknown>;
};

export type RelationOptionsMap = Record<string, RelationOption[]>;

export const normalizeFieldKey = (key: string): string =>
  key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

export const onlyDigits = (value: unknown): string =>
  String(value ?? "").replace(/\D/g, "");

const clampDigits = (value: unknown, maxLength: number): string =>
  onlyDigits(value).slice(0, maxLength);

export const formatCpf = (value: unknown): string => {
  const digits = clampDigits(value, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
};

export const formatCnpj = (value: unknown): string => {
  const digits = clampDigits(value, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

export const formatCpfCnpj = (value: unknown): string => {
  const digits = onlyDigits(value);
  return digits.length > 11 ? formatCnpj(digits) : formatCpf(digits);
};

export const formatCep = (value: unknown): string => {
  const digits = clampDigits(value, 8);
  return digits.replace(/^(\d{5})(\d)/, "$1-$2");
};

export const formatPhone = (value: unknown): string => {
  const digits = clampDigits(value, 11);
  if (digits.length <= 8) {
    return digits.replace(/^(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
};

export const formatDdd = (value: unknown): string => clampDigits(value, 2);

export const enumOptionsByKey: Record<string, SelectOption[]> = {
  sexo: [
    { value: 1, label: "Masculino" },
    { value: 2, label: "Feminino" },
    { value: 3, label: "Outro" },
  ],
  situacao: [
    { value: 1, label: "Ativo" },
    { value: 2, label: "Inativo" },
  ],
  status: [
    { value: 0, label: "Pendente" },
    { value: 1, label: "Aguardando peças" },
    { value: 2, label: "Em andamento" },
    { value: 3, label: "Concluído" },
  ],
  tipocliente: [
    { value: 1, label: "Fisico" },
    { value: 2, label: "Juridico" },
  ],
};

export const stateOptions: SelectOption[] = [
  { value: "AC", label: "AC" },
  { value: "AL", label: "AL" },
  { value: "AP", label: "AP" },
  { value: "AM", label: "AM" },
  { value: "BA", label: "BA" },
  { value: "CE", label: "CE" },
  { value: "DF", label: "DF" },
  { value: "ES", label: "ES" },
  { value: "GO", label: "GO" },
  { value: "MA", label: "MA" },
  { value: "MT", label: "MT" },
  { value: "MS", label: "MS" },
  { value: "MG", label: "MG" },
  { value: "PA", label: "PA" },
  { value: "PB", label: "PB" },
  { value: "PR", label: "PR" },
  { value: "PE", label: "PE" },
  { value: "PI", label: "PI" },
  { value: "RJ", label: "RJ" },
  { value: "RN", label: "RN" },
  { value: "RS", label: "RS" },
  { value: "RO", label: "RO" },
  { value: "RR", label: "RR" },
  { value: "SC", label: "SC" },
  { value: "SP", label: "SP" },
  { value: "SE", label: "SE" },
  { value: "TO", label: "TO" },
];

const relationEntityByKey: Record<string, string> = {
  clienteid: "clientes",
  idcliente: "clientes",
  oficinaid: "oficinas",
  idoficina: "oficinas",
  funcionarioid: "funcionarios",
  idfuncionario: "funcionarios",
  marcaid: "marcas",
  idmarca: "marcas",
  veiculoid: "veiculos",
  idveiculo: "veiculos",
  pecaid: "pecas",
  idpeca: "pecas",
  servicoid: "servicos",
  idservico: "servicos",
  pedidoid: "pedidos",
  idpedido: "pedidos",
};

export const getEnumOptions = (key: string): SelectOption[] | null =>
  enumOptionsByKey[normalizeFieldKey(key)] ?? null;

export const isStateField = (key: string): boolean =>
  normalizeFieldKey(key) === "estado";

export const isOwnIdField = (
  key: string,
  path: Array<string | number> = []
): boolean => {
  const normalized = normalizeFieldKey(key);
  void path;
  return ["id", "codigo"].includes(normalized);
};

export const getRelationEntityKey = (key: string): string | null =>
  relationEntityByKey[normalizeFieldKey(key)] ?? null;

export const isRelationIdField = (key: string): boolean =>
  Boolean(getRelationEntityKey(key));

export const shouldStripMask = (key: string): boolean => {
  const normalized = normalizeFieldKey(key);
  return (
    normalized.includes("cpf") ||
    normalized.includes("cnpj") ||
    normalized === "documento" ||
    normalized === "cep"
  );
};

export const maskFieldValue = (key: string, value: unknown): string => {
  const normalized = normalizeFieldKey(key);
  if (normalized === "documento" || normalized.includes("cpfcnpj")) {
    return formatCpfCnpj(value);
  }
  if (normalized.includes("cpf") && !normalized.includes("cnpj")) {
    return formatCpf(value);
  }
  if (normalized.includes("cnpj")) {
    return formatCnpj(value);
  }
  if (normalized === "cep") {
    return formatCep(value);
  }
  if (normalized === "ddd") {
    return formatDdd(value);
  }
  if (normalized.includes("telefone") || normalized === "numero") {
    return String(value ?? "");
  }
  return String(value ?? "");
};

export const normalizeSubmitValue = (
  key: string,
  templateValue: unknown,
  value: unknown
): unknown => {
  const normalized = normalizeFieldKey(key);
  const shouldUseDigits = shouldStripMask(key);
  const raw = shouldUseDigits ? onlyDigits(value) : value;

  if (typeof templateValue === "number") {
    const parsed = Number(raw ?? templateValue);
    return Number.isNaN(parsed) ? templateValue : parsed;
  }

  if (typeof templateValue === "string") {
    if (isStateField(key)) return String(value ?? "").toUpperCase();
    if (normalized.includes("cpf") || normalized.includes("cnpj")) {
      return onlyDigits(value);
    }
    if (normalized === "cep") return onlyDigits(value);
    return String(raw ?? templateValue ?? "");
  }

  return raw ?? templateValue;
};

export const formatStateValue = (value: unknown): string => {
  const text = String(value ?? "").trim().toUpperCase();
  return stateOptions.find((option) => option.value === text)?.label ?? text;
};

export const formatEnumValue = (key: string, value: unknown): string | null => {
  const options = getEnumOptions(key);
  if (!options) return null;
  const stringValue = String(value ?? "");
  return (
    options.find((option) => String(option.value) === stringValue)?.label ??
    stringValue
  );
};

export const getRecordId = (item: Record<string, unknown>): string | null => {
  const value = item.Id ?? item.id ?? item.ID;
  if (value === null || value === undefined || value === "") return null;
  return String(value);
};

export const buildEntityLabel = (
  entityKey: string,
  item: Record<string, unknown>
): string => {
  const fieldsByEntity: Record<string, string[]> = {
    clientes: ["Nome", "nome"],
    oficinas: ["Nome", "nome"],
    funcionarios: ["Nome", "nome"],
    marcas: ["Nome", "nome"],
    servicos: ["Nome", "nome"],
    pecas: ["Nome", "nome"],
    veiculos: ["NomeVeiculo", "nomeVeiculo", "Nome", "nome"],
    pedidos: ["Id", "id", "Observacao"],
  };

  const fields = fieldsByEntity[entityKey] ?? ["Nome", "nome", "Descricao"];
  const labelParts = fields
    .map((field) => {
      const normalizedField = normalizeFieldKey(field);
      const matchingKey = Object.keys(item).find(
        (candidate) => normalizeFieldKey(candidate) === normalizedField
      );
      return matchingKey ? item[matchingKey] : undefined;
    })
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map((value) => String(value))
    .filter((value, index, values) => values.indexOf(value) === index);

  const id = getRecordId(item);
  if (entityKey === "pedidos" && id) return `Pedido #${id}`;
  if (labelParts.length > 0) return labelParts[0];
  return id ? `#${id}` : "Registro";
};

export const findRelationLabel = (
  relationOptions: RelationOptionsMap,
  key: string,
  value: unknown
): string | null => {
  const entityKey = getRelationEntityKey(key);
  if (!entityKey) return null;
  const options = relationOptions[entityKey] ?? [];
  const found = options.find((option) => String(option.value) === String(value));
  if (found) return found.label;
  if (value === null || value === undefined || value === "") return "-";
  return `#${String(value)}`;
};
