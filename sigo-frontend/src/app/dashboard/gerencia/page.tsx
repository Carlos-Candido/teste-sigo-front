"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMinimumLoading } from "@/hooks/useMinimumLoading";
import { fetchJson } from "@/lib/api";
import { fetchCepAddress } from "@/lib/cep";
import type { CrudConfig } from "@/components/CrudPanel";
import { entityConfigs } from "@/models/entityConfigs";
import {
  getAllowedManagementConfigs,
  getEntityCapability,
  normalizeRole,
  type EntityCapability,
} from "@/lib/accessControl";
import { DashboardSidebar } from "@/components/Dashboard/DashboardSidebar";
import { SigoLoader } from "@/components/Loading/SigoLoader";
import { NavBar } from "@/components/Sidebar/NavBar";
import { ProtectedRoute } from "@/components/Auth/RouteGuards";
import {
  buildEntityLabel,
  findRelationLabel,
  formatCep,
  formatCpf,
  formatCnpj,
  formatPhone,
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
  onlyDigits,
  stateOptions,
  type RelationOption,
  type RelationOptionsMap,
  type SelectOption,
} from "@/lib/fieldMetadata";

type FormMode = "create" | "edit" | "view";
type DiscountType = "percent" | "money";
type ManagementFilter = { key: string; label: string; type?: "text" | "number" | "date" | "select"; fields?: string[]; options?: SelectOption[]; };
type FormValue = Record<string, unknown>;
type BuildPayloadOptions = {
  includeArrays?: boolean;
  parentId?: number | null;
  parentListKey?: string;
  entityKey?: string;
  formMode?: FormMode;
};

type SavedImagePreview = {
  id: string;
  label: string;
  url: string;
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

const PAGE_SIZE = 10;
const activeStatusOptions: SelectOption[] = [{ value: 1, label: "Ativo" }, { value: 0, label: "Inativo" }];
const managementFiltersByEntity: Record<string, ManagementFilter[]> = {
  clientes: [{ key: "id", label: "ID", type: "number", fields: ["Id"] }, { key: "name", label: "Nome", fields: ["Nome"] }, { key: "cpf", label: "CPF", fields: ["Cpf_Cnpj", "Cpf"] }, { key: "phone", label: "Telefone" }, { key: "email", label: "E-mail", fields: ["Email"] }, { key: "situation", label: "Status", type: "select", options: activeStatusOptions }],
  veiculos: [{ key: "id", label: "ID", type: "number", fields: ["Id"] }, { key: "plate", label: "Placa", fields: ["PlacaVeiculo"] }, { key: "model", label: "Modelo", fields: ["ModeloVeiculo"] }, { key: "owner", label: "Cliente" }, { key: "year", label: "Ano", type: "number", fields: ["AnoFab"] }, { key: "chassis", label: "Chassi", fields: ["ChassiVeiculo"] }],
  funcionarios: [{ key: "id", label: "ID", type: "number", fields: ["Id"] }, { key: "name", label: "Nome", fields: ["Nome"] }, { key: "cpf", label: "CPF", fields: ["Cpf"] }, { key: "role", label: "Cargo", fields: ["Cargo"] }, { key: "situation", label: "Status", type: "select", options: activeStatusOptions }],
  marcas: [{ key: "id", label: "ID", type: "number", fields: ["Id"] }, { key: "name", label: "Nome", fields: ["Nome"] }, { key: "brandType", label: "Tipo", fields: ["TipoMarca"] }],
  servicos: [{ key: "id", label: "ID", type: "number", fields: ["Id"] }, { key: "name", label: "Nome", fields: ["Nome"] }, { key: "serviceEmployee", label: "Funcionário" }],
  pecas: [{ key: "id", label: "ID", type: "number", fields: ["Id"] }, { key: "name", label: "Nome", fields: ["Nome"] }, { key: "ean", label: "EAN", fields: ["EAN"] }, { key: "brand", label: "Marca" }, { key: "stock", label: "Estoque", type: "select", options: [{ value: "with", label: "Com estoque" }, { value: "without", label: "Sem estoque" }] }, { key: "situation", label: "Status", type: "select", options: activeStatusOptions }],
  pedidos: [{ key: "id", label: "ID", type: "number", fields: ["Id"] }, { key: "client", label: "Cliente" }, { key: "vehicle", label: "Veículo" }, { key: "employee", label: "Funcionário" }, { key: "orderStatus", label: "Status", type: "select", options: [{ value: 0, label: "Pendente" }, { value: 1, label: "Aguardando peças" }, { value: 2, label: "Em andamento" }, { value: 3, label: "Concluído" }] }, { key: "startDate", label: "Data inicial", type: "date" }, { key: "endDate", label: "Data de fechamento", type: "date" }, { key: "value", label: "Valor", type: "number" }],
};

const normalizeVehicleStatus = (value: unknown): number => {
  const numericValue = Number(value);
  if (Number.isInteger(numericValue) && numericValue >= 0 && numericValue <= 3) {
    return numericValue;
  }

  const statuses: Record<string, number> = {
    pendente: 0,
    aguardandopecas: 1,
    emandamento: 2,
    concluido: 3,
  };
  return statuses[normalizeFieldKey(String(value ?? ""))] ?? 0;
};

const normalizeWorkflowStatus = (value: unknown): number =>
  normalizeVehicleStatus(value);

const parentIdFieldByList: Record<string, string> = {
  telefones: "ClienteId",
  funcionarioservicos: "IdServico",
  pedidopecas: "IdPedido",
  pedidoservicos: "IdPedido",
};

const hiddenFieldByList: Record<string, string[]> = {
  telefones: ["DDD"],
  pedidopecas: ["ValorUnitario"],
};

const partConditionOptions: SelectOption[] = [
  { value: "Nova", label: "Nova" },
  { value: "Usada", label: "Usada" },
  { value: "Recondicionada", label: "Recondicionada" },
  { value: "Danificada", label: "Danificada" },
];

const workflowStatusOptions: SelectOption[] = [
  { value: 0, label: "Pendente" },
  { value: 1, label: "Aguardando peças" },
  { value: 2, label: "Em andamento" },
  { value: 3, label: "Concluído" },
];

const editableOptionsByField: Record<string, string[]> = {
  modeloveiculo: [
    "KA", "FOCUS", "GOL", "CORSA", "HB20", "FIESTA", "ONIX", "MONZA",
    "UNO", "VECTRA", "SAVEIRO", "F1000", "MERIVA", "CELTA", "S10", "POLO",
    "PALIO", "COROLLA", "PARATI", "ASTRA", "SPACEFOX", "FOX", "MONTANA",
    "ECOSPORT", "STRADA", "CLASSIC", "KADETT", "D20", "DEL REY", "FIORINO",
    "CORCEL", "PRISMA", "KOMBI", "KWID", "VIRTUS", "COURIER", "CHEVETTE",
    "GOLF", "FUSCA", "TORO", "RANGER", "D10", "ETIOS", "APOLLO", "TRITON",
    "DUCATO", "IDEA", "LOGUS", "DOBLO", "VOYAGE", "SANTANA", "PASSAT", "JETTA",
    "T-CROSS", "NIVUS", "TAOS", "TIGUAN", "AMAROK", "BRASILIA", "VARIANT", "UP",
    "BORA", "QUANTUM", "POINTER", "VERSAILLES", "ROYALE", "PAMPA", "ESCORT",
    "VERONA", "FUSION", "EDGE", "TERRITORY", "MAVERICK", "MUSTANG", "BELINA",
    "CORCEL II", "DEL REY BELINA", "VERANEIO", "OPALA", "CARAVAN", "OMEGA",
    "SUPREMA", "ZAFIRA", "CRUZE", "SPIN", "TRACKER", "EQUINOX", "TRAILBLAZER",
    "BLAZER", "IPANEMA", "AGILE", "SONIC", "COBALT", "CAPTIVA", "BONANZA",
    "A10", "A20", "C10", "C20", "ARGO", "CRONOS", "PUNTO", "BRAVO", "STILO",
    "GRAND SIENA", "MOBI", "PULSE", "FASTBACK", "TEMPRA", "TIPO", "MAREA",
    "MAREA WEEKEND", "SIENA", "ELBA", "PREMIO", "147", "OGGI", "PANORAMA",
    "LINEA", "FREEMONT", "CITY", "CIVIC", "FIT", "HR-V", "WR-V", "CR-V",
    "ACCORD", "YARIS", "HILUX", "SW4", "RAV4", "CAMRY", "PRIUS", "BANDEIRANTE",
    "CRETA", "TUCSON", "SANTA FE", "AZERA", "ELANTRA", "I30", "VELOSTER",
    "SANDERO", "LOGAN", "DUSTER", "CAPTUR", "CLIO", "MEGANE", "FLUENCE",
    "KARDIAN", "OROCH", "SCENIC", "SYMBOL", "MARCH", "VERSA", "SENTRA",
    "KICKS", "FRONTIER", "LIVINA", "PAJERO", "LANCER", "OUTLANDER", "ASX",
  ],
  combustivel: [
    "GASOLINA", "ETANOL", "FLEX (GASOLINA/ETANOL)", "DIESEL", "DIESEL S-10",
    "DIESEL S-500", "GNV", "GLP", "Biodiesel", "Biometano", "Hidrogênio",
    "ELÉTRICO", "HÍBRIDO", "OUTRO",
  ],
  cor: [
    "BRANCO", "PRETO", "PRATA", "CINZA", "VERMELHO", "AZUL", "VERDE",
    "AMARELO", "LARANJA", "MARROM", "BEGE", "DOURADO", "ROXO", "ROSA", "VINHO", "CINZA ESCURO", "CINZA CLARO", "AZUL ESCURO", "AZUL CLARO", "VERDE ESCURO",
  ],
  cargo: [
    "ADMINISTRADOR", "GERENTE", "SUPERVISOR", "MECÂNICO", "ELETRICISTA",
    "FUNILEIRO", "PINTOR", "BORRACHEIRO", "CONSULTOR DE SERVIÇOS",
    "RECEPCIONISTA", "ESTOQUISTA", "VENDEDOR DE PEÇAS", "AUXILIAR DE MECÂNICO",
    "AUXILIAR ADMINISTRATIVO", "AUXILIAR DE SERVIÇOS", "OUTROS",
  ],
  tipomarca: [
    "MARCA DE VEÍCULO", "MARCA DE PEÇA", "MARCA DE PNEU", "MARCA DE LUBRIFICANTE",
    "MARCA DE BATERIA", "MARCA DE FERRAMENTA", "MARCA DE EQUIPAMENTO",
    "MARCA DE ACESSÓRIO", "OUTROS",
  ],
  fornecedor: [],

};

const normalizeOptionText = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const mergeEditableOptions = (base: string[], remote: string[]): string[] => {
  const seen = new Set<string>();
  return [...base, ...remote]
    .map((value) => String(value ?? "").trim())
    .filter((value) => {
      const normalized = normalizeOptionText(value);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
};

const getEditableFieldOptions = (
  entityKey: string,
  key: string,
  registrationOptions: Record<string, string[]> = {}
): string[] | null => {
  void entityKey;
  const normalized = normalizeFieldKey(key);
  const isEditableField =
    Object.prototype.hasOwnProperty.call(editableOptionsByField, normalized) ||
    Object.prototype.hasOwnProperty.call(registrationOptions, normalized);
  if (!isEditableField) return null;
  const base = editableOptionsByField[normalized] ?? [];
  const remote = registrationOptions[normalized] ?? [];
  return mergeEditableOptions(base, remote);
};

const extractRegistrationOptions = (payload: unknown): Record<string, string[]> => {
  if (!isPlainObject(payload)) return {};
  const envelope = isPlainObject(payload.data)
    ? payload.data
    : isPlainObject(payload.Data)
      ? payload.Data
      : payload;
  const mapping: Record<string, string[]> = {
    modeloveiculo: ["ModelosVeiculo", "modelosVeiculo"],
    combustivel: ["Combustiveis", "combustiveis"],
    cor: ["Cores", "cores"],
    cargo: ["Cargos", "cargos"],
    tipomarca: ["TiposMarca", "tiposMarca"],
    fornecedor: ["Fornecedores", "fornecedores"],
  };

  return Object.fromEntries(
    Object.entries(mapping).map(([field, aliases]) => {
      const values = aliases
        .map((alias) => getRecordValue(envelope, alias))
        .find(Array.isArray);
      return [
        field,
        Array.isArray(values)
          ? mergeEditableOptions([], values.map((value) => String(value ?? "")))
          : [],
      ];
    })
  );
};

const normalizeSpecialTextField = (key: string, value: string): string => {
  const normalized = normalizeFieldKey(key);
  if (normalized === "placaveiculo") {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  }
  if (normalized === "chassiveiculo") {
    return value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17);
  }
  if (normalized === "seguro") {
    return onlyDigits(value).slice(0, 100);
  }
  if (normalized === "tempodec") {
    const digits = onlyDigits(value).slice(0, 4);
    if (digits.length <= 2) return digits;
    const hours = digits.slice(0, 2);
    const rawMinutes = digits.slice(2);
    const minutes = rawMinutes.length === 2
      ? String(Math.min(60, Number(rawMinutes))).padStart(2, "0")
      : rawMinutes;
    return `${hours}:${minutes}`;
  }
  return value;
};


const hiddenFieldByEntity: Record<string, string[]> = {
  clientes: ["senha"],
  pecas: ["quantidadeestoque"],
};

const imageUploadPathByEntity: Record<string, (id: number) => string> = {
  veiculos: (id) => `/api/v1/veiculos/${id}/imagens`,
};

const imageListFieldByEntity: Record<string, string> = {
  veiculos: "Imagens",
};

const shouldHideFieldForEntity = (entityKey: string, key: string): boolean =>
  (hiddenFieldByEntity[entityKey] ?? []).includes(normalizeFieldKey(key));

const shouldCreateWithArrays = (entityKey: string): boolean =>
  entityKey === "servicos" || entityKey === "clientes";

const getCreateTemplate = (config: CrudConfig): Record<string, unknown> =>
  config.createTemplate ?? config.template;

const applyPieceStockTotal = (payload: unknown): unknown => {
  if (!isPlainObject(payload)) return payload;
  const quantity = Math.floor(
    Math.max(0, Number(getRecordValue(payload, "Quantidade")) || 0)
  );
  const unit = Math.max(0, Number(getRecordValue(payload, "Unidade")) || 0);
  return {
    ...payload,
    Quantidade: quantity,
    quantidadeEstoque: quantity * unit,
  };
};

const normalizePieceFormRecord = (record: FormValue): FormValue => {
  const stock = Number(
    getRecordValue(record, "quantidadeEstoque") ??
      getRecordValue(record, "Quantidade_Estoque")
  );
  const unit = Number(getRecordValue(record, "Unidade"));
  if (!Number.isFinite(stock) || !Number.isFinite(unit) || unit <= 0) {
    return record;
  }
  return {
    ...record,
    Quantidade: Math.floor(stock / unit),
  };
};

const getDeleteActionLabel = (entityKey: string): string =>
  entityKey === "clientes" ? "Inativar" : "Excluir";

const isClientOfficeLinkActive = (item: FormValue): boolean => {
  const value = getRecordValue(item, "VinculoAtivo");
  if (value === undefined || value === null || value === "") return true;
  return value === true || String(value).trim().toLowerCase() === "true" || String(value).trim() === "1";
};

const getVehicleValidationError = (data: FormValue): string | null => {
  const plate = String(getRecordValue(data, "PlacaVeiculo") ?? "").toUpperCase();
  const chassis = String(getRecordValue(data, "ChassiVeiculo") ?? "").toUpperCase();
  const insurance = String(getRecordValue(data, "Seguro") ?? "");
  const validPlate = /^(?:[A-Z]{3}[0-9][A-Z][0-9]{2}|[A-Z]{3}[0-9]{4})$/;

  if (!validPlate.test(plate)) {
    return "Informe uma placa válida no padrão ABC1D23 ou ABC1234.";
  }
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(chassis)) {
    return "O chassi deve ter exatamente 17 letras maiúsculas e números, sem I, O ou Q.";
  }
  if (insurance && !/^\d{1,100}$/.test(insurance)) {
    return "O N° do seguro deve conter somente números.";
  }
  return null;
};

const getFormValidationError = (
  entityKey: string,
  data: FormValue,
  mode: FormMode
): string | null => {
  const text = (key: string) => String(getRecordValue(data, key) ?? "").trim();
  const firstText = (...keys: string[]) => {
    for (const key of keys) {
      const value = text(key);
      if (value) return value;
    }
    return "";
  };
  const positiveId = (key: string) => Number(getRecordValue(data, key)) > 0;
  const requiredTextByEntity: Record<string, string[]> = {
    clientes: ["Nome", "Email", "DataNasc"],
    funcionarios: ["Nome", "Cpf", "Cargo", "Email"],
    marcas: ["Nome", "TipoMarca"],
    servicos: ["Nome"],
    pecas: ["Nome", "EAN"],
    veiculos: ["NomeVeiculo", "ModeloVeiculo", "PlacaVeiculo", "ChassiVeiculo", "Combustivel", "Cor"],
  };
  for (const key of requiredTextByEntity[entityKey] ?? []) {
    if (!text(key)) return `Preencha o campo ${formatFieldLabel(key)}.`;
  }
  if (entityKey === "clientes" && !firstText("Cpf_Cnpj", "CpfCnpj", "Cpf")) {
    return "Preencha o campo CPF ou CNPJ.";
  }
  const cepKey = Object.keys(data).find((key) => normalizeFieldKey(key) === "cep");
  if (cepKey && onlyDigits(data[cepKey]).length !== 8) {
    return "Informe um CEP válido com 8 dígitos.";
  }

  if (entityKey === "funcionarios" && mode === "create" && !text("Senha")) {
    return "Informe a senha inicial do funcionário.";
  }
  if (entityKey === "funcionarios" && text("Senha") && text("Senha").length < 6) {
    return "A senha deve ter pelo menos 6 caracteres.";
  }
  if (["clientes", "funcionarios"].includes(entityKey)) {
    const cpf = onlyDigits(
      entityKey === "clientes"
        ? firstText("Cpf_Cnpj", "CpfCnpj", "Cpf")
        : getRecordValue(data, "Cpf")
    );
    if (entityKey === "clientes" && ![11, 14].includes(cpf.length)) {
      return "Informe um CPF válido com 11 dígitos ou CNPJ com 14 dígitos.";
    }
    if (entityKey === "funcionarios" && cpf.length !== 11) {
      return "Informe um CPF válido com 11 dígitos.";
    }
    const email = text("Email");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Informe um e-mail válido.";
  }
  if (entityKey === "clientes") {
    const birthDate = firstText("DataNasc");
    if (birthDate && Number(birthDate.slice(0, 4)) > 9999) {
      return "O ano da data de nascimento deve ser no máximo 9999.";
    }
  }
  if (entityKey === "veiculos") {
    const mileage = Number(getRecordValue(data, "Quilometragem"));
    if (!Number.isFinite(mileage) || mileage < 0 || mileage > 9999999) {
      return "A quilometragem deve estar entre 0 e 9.999.999 km.";
    }
  }
  if (entityKey === "veiculos" && !positiveId("ClienteId")) {
    return "Selecione o cliente do veículo.";
  }
  if (entityKey === "pedidos") {
    for (const [key, label] of [["idCliente", "cliente"], ["idFuncionario", "funcionário"], ["idVeiculo", "veículo"]] as const) {
      if (!positiveId(key)) return `Selecione o ${label} do pedido.`;
    }
    const start = text("DataInicio").slice(0, 10);
    const end = text("DataFim").slice(0, 10);
    if (!start || !end) return "Informe as datas de início e término do pedido.";
    if (end < start) return "A data de término não pode ser anterior à data de início.";
    const pieceLines = getRecordValue(data, "Pedido_Pecas");
    for (const line of Array.isArray(pieceLines) ? pieceLines : []) {
      if (!isPlainObject(line)) continue;
      if (Number(getRecordValue(line, "Quantidade")) <= 0) return "A quantidade de cada peça deve ser maior que zero.";
      if (Number(getRecordValue(line, "ValorUnitario")) < 0) return "O valor unitário da peça não pode ser negativo.";
    }
  }
  const hasInvalidElapsedTime = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(hasInvalidElapsedTime);
    if (!isPlainObject(value)) return false;
    return Object.entries(value).some(([key, fieldValue]) =>
      normalizeFieldKey(key) === "tempodec"
        ? String(fieldValue ?? "").trim().length > 0 &&
          !/^\\d{2}:(?:[0-5]\\d|60)$/.test(String(fieldValue))
        : hasInvalidElapsedTime(fieldValue)
    );
  };
  if (hasInvalidElapsedTime(data)) {
    return "Informe o tempo decorrido no formato HH:MM, com minutos entre 00 e 60.";
  }
  if (["servicos", "pecas"].includes(entityKey) && Number(getRecordValue(data, "Valor")) < 0) {
    return "O valor não pode ser negativo.";
  }
  if (entityKey === "pecas" && ![8, 13].includes(onlyDigits(getRecordValue(data, "EAN")).length)) {
    return "O EAN deve conter exatamente 8 ou 13 dígitos.";
  }
  return null;
};

const fieldLabels: Record<string, string> = {
  id: "ID",
  nome: "Nome",
  email: "Email",
  senha: "Senha",
  valorunitario: "Valor unitário",
  cpf: "CPF",
  cnpj: "CNPJ",
  cpfcnpj: "CPF ou CNPJ",
  obs: "Observação",
  razao: "Razão",
  datanasc: "Data de nascimento",
  numero: "Número da residência",
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
  tempodec: "Tempo decorrido",
  tipo: "Tipo",
  ean: "EAN",
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
  modeloveiculo: "Modelo",
  placaveiculo: "Placa",
  chassisveiculo: "Chassi",
  anofab: "Ano de fabricação",
  quilometragem: "Quilometragem",
  combustivel: "Combustível",
  seguro: "N° do seguro",
  cor: "Cor",
  clienteid: "Cliente",
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getApiErrorMessage = (data: unknown, fallback: string): string => {
  if (!isPlainObject(data)) return fallback;

  const errors = data.errors ?? data.Errors;
  if (isPlainObject(errors)) {
    const messages = Object.values(errors).flatMap((value) =>
      Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : typeof value === "string"
          ? [value]
          : []
    );
    if (messages.length > 0) return messages.join(" | ");
  }

  const message = data.Message ?? data.message ?? data.detail ?? data.title;
  return typeof message === "string" && message.trim() ? message : fallback;
};

const isObservationField = (key: string): boolean =>
  ["obs", "observacao", "observacoes"].includes(normalizeFieldKey(key));

const getRecordValue = (record: Record<string, unknown>, key: string) => {
  if (key in record) return record[key];
  const normalized = normalizeFieldKey(key);
  const matchedKey = Object.keys(record).find(
    (candidate) => normalizeFieldKey(candidate) === normalized
  );
  return matchedKey ? record[matchedKey] : undefined;
};

const getRecordKey = (record: Record<string, unknown>, key: string): string => {
  const normalized = normalizeFieldKey(key);
  return (
    Object.keys(record).find(
      (candidate) => normalizeFieldKey(candidate) === normalized
    ) ?? key
  );
};

const cloneTemplate = (value: Record<string, unknown>): FormValue =>
  JSON.parse(JSON.stringify(value)) as FormValue;

const createEmptyListForm = (template: Record<string, unknown>): FormValue => {
  const clearLists = (value: unknown): unknown => {
    if (Array.isArray(value)) return [];
    if (!isPlainObject(value)) return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        clearLists(nestedValue),
      ])
    );
  };

  return clearLists(cloneTemplate(template)) as FormValue;
};

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

  if (
    typeof template === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(template) &&
    typeof value === "string"
  ) {
    return value.slice(0, 10);
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

      const normalizedKey = normalizeFieldKey(key);
      if (
        options.formMode === "edit" &&
        normalizedKey === "senha" &&
        !String(getRecordValue(recordValue, key) ?? "").trim()
      ) {
        return;
      }
      const payloadValue =
        normalizedKey === "pais"
          ? "Brasil"
          : normalizeFieldKey(options.parentListKey ?? "") === "telefones" &&
        normalizedKey === "numero"
          ? onlyDigits(getRecordValue(recordValue, key))
          : buildPayload(
              template[key],
              getRecordValue(recordValue, key),
              key,
              options
            );
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

const getImageList = (entityKey: string, record: FormValue): FormValue[] => {
  const field = imageListFieldByEntity[entityKey];
  if (!field) return [];
  const value = getRecordValue(record, field);
  return Array.isArray(value) ? (value.filter(isPlainObject) as FormValue[]) : [];
};

const getImageUrlPath = (image: FormValue): string => {
  const rawUrl =
    getRecordValue(image, "Url") ??
    getRecordValue(image, "url") ??
    getRecordValue(image, "Caminho") ??
    getRecordValue(image, "caminho");
  return String(rawUrl ?? "");
};

const getImageLabel = (image: FormValue, index: number): string => {
  const rawLabel =
    getRecordValue(image, "NomeOriginal") ??
    getRecordValue(image, "nomeOriginal") ??
    getRecordValue(image, "NomeArquivo") ??
    getRecordValue(image, "nomeArquivo");
  const label = String(rawLabel ?? "").trim();
  return label || `Imagem ${index + 1}`;
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

const getParentListKey = (path: Array<string | number>): string | null => {
  const listKey = [...path]
    .reverse()
    .find(
      (part) =>
        typeof part === "string" &&
        (parentIdFieldByList[normalizeFieldKey(part)] ||
          hiddenFieldByList[normalizeFieldKey(part)])
    );

  return typeof listKey === "string" ? listKey : null;
};

const isPhonePath = (path: Array<string | number>): boolean =>
  path.some(
    (part) =>
      typeof part === "string" && normalizeFieldKey(part) === "telefones"
  );

const isPhoneNumberField = (
  key: string,
  path: Array<string | number>
): boolean =>
  isPhonePath(path) && normalizeFieldKey(key) === "numero";

const getAtPath = (source: unknown, path: Array<string | number>): unknown =>
  path.reduce<unknown>((current, part) => {
    if (Array.isArray(current)) {
      return current[typeof part === "number" ? part : Number(part)];
    }
    if (isPlainObject(current)) return current[part as string];
    return undefined;
  }, source);

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
  if (normalized.includes("cpfcnpj")) return formatCpf(value);
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
  if (normalized === "datanasc") return "date";
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
  path: Array<string | number> = [],
  entityKey = ""
): SelectOption[] | null => {
  const isPartOrderState = path.some(
    (part) =>
      typeof part === "string" && normalizeFieldKey(part) === "pedidopecas"
  );
  if (isPartOrderState && normalizeFieldKey(key) === "estado") {
    return partConditionOptions;
  }
  if (isStateField(key)) return stateOptions;
  if (entityKey === "pedidos" && normalizeFieldKey(key) === "status") {
    return workflowStatusOptions;
  }
  return getEnumOptions(key);
};

const clearCreateSelectValues = (
  value: unknown,
  entityKey: string,
  path: Array<string | number> = []
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      clearCreateSelectValues(item, entityKey, [...path, index])
    );
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, fieldValue]) => {
        const fieldPath = [...path, key];
        if (!isPlainObject(fieldValue) && !Array.isArray(fieldValue) && getFieldOptions(key, fieldPath, entityKey)) {
          return [key, ""];
        }
        return [key, clearCreateSelectValues(fieldValue, entityKey, fieldPath)];
      })
    );
  }
  return value;
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

type TableColumn = {
  key: string;
  label: string;
  relationKey?: string;
  currency?: boolean;
  status?: "situacao" | "workflow";
};

const tableColumnsByEntity: Record<string, TableColumn[]> = {
  clientes: [
    { key: "Id", label: "ID" },
    { key: "Nome", label: "Nome" },
    { key: "Cpf_Cnpj", label: "CPF/CNPJ" },
    { key: "VinculoAtivo", label: "Status", status: "situacao" },
  ],
  veiculos: [
    { key: "Id", label: "ID" },
    { key: "NomeVeiculo", label: "Nome" },
    { key: "PlacaVeiculo", label: "Placa" },
    { key: "ClienteId", label: "Nome do cliente", relationKey: "ClienteId" },
  ],
  funcionarios: [
    { key: "Id", label: "ID" },
    { key: "Nome", label: "Nome" },
    { key: "Cpf", label: "CPF" },
    { key: "Cargo", label: "Cargo" },
    { key: "Situacao", label: "Status", status: "situacao" },
  ],
  marcas: [
    { key: "Id", label: "ID" },
    { key: "Nome", label: "Nome" },
    { key: "TipoMarca", label: "Tipo" },
  ],
  servicos: [
    { key: "Id", label: "ID" },
    { key: "Nome", label: "Nome" },
    { key: "Valor", label: "Valor", currency: true },
  ],
  pecas: [
    { key: "Id", label: "ID" },
    { key: "Nome", label: "Nome" },
    { key: "Valor", label: "Valor", currency: true },
    { key: "Quantidade", label: "Quantidade" },
  ],
  pedidos: [
    { key: "Id", label: "ID" },
    { key: "idCliente", label: "Nome do cliente", relationKey: "idCliente" },
    { key: "idVeiculo", label: "Placa", relationKey: "idVeiculo" },
    { key: "ValorTotal", label: "Valor", currency: true },
    { key: "Status", label: "Status", status: "workflow" },
  ],
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const statusPresentation = (
  value: unknown,
  kind: "situacao" | "workflow"
): { label: string; className: string } => {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (kind === "situacao") {
    const active = normalized === "1" || normalized === "ativo" || normalized === "true";
    return active
      ? { label: "Ativo", className: "border-emerald-200 bg-emerald-50 text-emerald-700" }
      : { label: "Inativo", className: "border-red-200 bg-red-50 text-red-700" };
  }

  const workflowStatuses: Record<string, { label: string; className: string }> = {
    "0": { label: "Pendente", className: "border-amber-200 bg-amber-50 text-amber-700" },
    pendente: { label: "Pendente", className: "border-amber-200 bg-amber-50 text-amber-700" },
    "1": { label: "Aguardando peças", className: "border-orange-200 bg-orange-50 text-orange-700" },
    aguardandopecas: { label: "Aguardando peças", className: "border-orange-200 bg-orange-50 text-orange-700" },
    "2": { label: "Em andamento", className: "border-blue-200 bg-blue-50 text-blue-700" },
    emandamento: { label: "Em andamento", className: "border-blue-200 bg-blue-50 text-blue-700" },
    "3": { label: "Concluído", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    concluido: { label: "Concluído", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  };

  return workflowStatuses[normalizeFieldKey(normalized)] ?? {
    label: String(value ?? "-"),
    className: "border-slate-200 bg-slate-50 text-slate-700",
  };
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

type RelationSearchFieldProps = {
  label: string;
  value: unknown;
  options: RelationOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

const RELATION_PAGE_SIZE = 10;

function RelationSearchField({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: RelationSearchFieldProps) {
  const selectedOption = options.find(
    (option) => String(option.value) === String(value)
  );
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return normalizedQuery
      ? options.filter((option) => {
          const label = option.label.toLowerCase();
          const optionValue = String(option.value).toLowerCase();
          return label.includes(normalizedQuery) || optionValue.includes(normalizedQuery);
        })
      : options;
  }, [options, query]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredOptions.length / RELATION_PAGE_SIZE)
  );
  const currentPage = Math.min(page, totalPages);
  const visibleOptions = filteredOptions.slice(
    (currentPage - 1) * RELATION_PAGE_SIZE,
    currentPage * RELATION_PAGE_SIZE
  );

  const openSearch = () => {
    if (disabled) return;
    setQuery("");
    setPage(1);
    setIsOpen(true);
  };

  return (
    <div className="sigo-label rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-3">
      <span>{label}</span>
      <button
        type="button"
        className="sigo-input flex items-center justify-between gap-3 bg-white text-left"
        disabled={disabled}
        onClick={openSearch}
      >
        <span className={selectedOption ? "text-[var(--sigo-text)]" : "text-[var(--sigo-muted)]"}>
          {selectedOption?.label ??
            (value && Number(value) > 0 ? `Registro #${String(value)}` : "Selecionar registro")}
        </span>
        <span aria-hidden="true" className="text-lg text-[var(--sigo-blue)]">⌕</span>
      </button>
      {isOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Pesquisar ${label}`}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setIsOpen(false);
          }}
        >
          <div className="sigo-card w-full max-w-md overflow-hidden bg-white shadow-[var(--sigo-shadow-lg)]">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--sigo-border)] px-4 py-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sigo-soft)]">
                  Selecionar registro
                </p>
                <h3 className="mt-1 text-lg font-black text-[var(--sigo-text)]">{label}</h3>
              </div>
              <button type="button" className="sigo-button h-10 min-h-0 w-10 p-0" onClick={() => setIsOpen(false)} aria-label="Fechar pesquisa">
                ×
              </button>
            </div>

            <div className="p-4">
              <input
                className="sigo-input bg-white"
                type="search"
                value={query}
                placeholder="Pesquisar por nome ou código"
                autoFocus
                onChange={(event) => setQuery(event.target.value)}
              />

              <div className="sigo-scrollbar mt-3 grid max-h-80 content-start gap-2 overflow-y-auto pr-1">
                {visibleOptions.length > 0 ? (
                  visibleOptions.map((option) => {
                    const isSelected = String(option.value) === String(value);
                    return (
                      <button
                        key={String(option.value)}
                        type="button"
                        className={`flex min-h-10 w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-bold ${
                          isSelected
                            ? "border-[var(--sigo-blue)] bg-[var(--sigo-blue-soft)] text-[var(--sigo-blue-deep)]"
                            : "border-[var(--sigo-border)] bg-white text-[var(--sigo-text)] hover:border-[var(--sigo-blue)] hover:bg-[var(--sigo-surface-soft)]"
                        }`}
                        onClick={() => {
                          onChange(String(option.value));
                          setIsOpen(false);
                        }}
                      >
                        <span>{option.label}</span>
                        <span className="text-xs text-[var(--sigo-muted)]">#{option.value}</span>
                      </button>
                    );
                  })
                ) : (
                  <p className="flex min-h-20 items-center justify-center text-sm font-semibold text-[var(--sigo-muted)]">
                    Nenhum registro encontrado.
                  </p>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--sigo-border)] pt-3">
                <button type="button" className="sigo-button min-h-10 px-3" disabled={currentPage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  Anterior
                </button>
                <span className="text-xs font-bold text-[var(--sigo-muted)]">
                  Página {currentPage} de {totalPages} · {filteredOptions.length} registro(s)
                </span>
                <button type="button" className="sigo-button min-h-10 px-3" disabled={currentPage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                  Próxima
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
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
  const canCreateSelected = selectedConfig
    ? selectedConfig.key === "clientes" && normalizeRole(userRole) === "cliente"
      ? true
      : Boolean(selectedCapability?.canCreate)
    : false;
  const [items, setItems] = useState<FormValue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { isVisible: showLoading, cycle: loadingCycle } = useMinimumLoading(
    isLoading,
    500
  );
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const [statusOrderItem, setStatusOrderItem] = useState<FormValue | null>(null);
  const [nextOrderStatus, setNextOrderStatus] = useState(0);
  const [statusSaving, setStatusSaving] = useState(false);
  const [stockAdjustmentItem, setStockAdjustmentItem] = useState<FormValue | null>(null);
  const [stockAdjustmentAmount, setStockAdjustmentAmount] = useState(1);
  const [stockAdjustmentSaving, setStockAdjustmentSaving] = useState(false);
  const [pedidoStatus, setPedidoStatus] = useState(0);
  const [originalPedidoPieceQuantities, setOriginalPedidoPieceQuantities] = useState<Record<string, number>>({});
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [serviceDiscountEnabled, setServiceDiscountEnabled] = useState(false);
  const [serviceDiscountType, setServiceDiscountType] = useState<DiscountType>("percent");
  const [serviceDiscountValue, setServiceDiscountValue] = useState(0);
  const [pieceDiscountEnabled, setPieceDiscountEnabled] = useState(false);
  const [pieceDiscountType, setPieceDiscountType] = useState<DiscountType>("percent");
  const [pieceDiscountValue, setPieceDiscountValue] = useState(0);
  const [manualTotalEnabled, setManualTotalEnabled] = useState(false);
  const [manualTotalValue, setManualTotalValue] = useState(0);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastCepLookup, setLastCepLookup] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [savedImages, setSavedImages] = useState<FormValue[]>([]);
  const [savedImagePreviews, setSavedImagePreviews] = useState<SavedImagePreview[]>([]);
  const [formData, setFormData] = useState<FormValue>(() =>
    cloneTemplate(entityConfigs[0].template)
  );
  const [relationOptions, setRelationOptions] = useState<RelationOptionsMap>(
    {}
  );
  const [loggedOficinaName, setLoggedOficinaName] = useState("");
  const [registrationOptions, setRegistrationOptions] = useState<Record<string, string[]>>({});

  const pedidoTotals = useMemo(() => {
    if (selectedConfig?.key !== "pedidos") {
      return { pieces: 0, services: 0, gross: 0, serviceDiscount: 0, pieceDiscount: 0, generalDiscount: 0, discount: 0, total: 0 };
    }

    const getPrice = (entityKey: string, id: unknown) => {
      const option = (relationOptions[entityKey] ?? []).find(
        (candidate) => String(candidate.value) === String(id)
      );
      return Number(
        option?.item ? getRecordValue(option.item, "Valor") ?? 0 : 0
      );
    };
    const getPieceUnitPrice = (id: unknown) => {
      const option = (relationOptions.pecas ?? []).find(
        (candidate) => String(candidate.value) === String(id)
      );
      if (!option?.item) return 0;
      const packagePrice = Math.max(0, Number(getRecordValue(option.item, "Valor")) || 0);
      const unitsPerPackage = Math.max(1, Number(getRecordValue(option.item, "Unidade")) || 1);
      return packagePrice / unitsPerPackage;
    };
    const pieceItems = getRecordValue(formData, "Pedido_Pecas");
    const serviceItems = getRecordValue(formData, "Pedido_Servicos");
    const pieces = (Array.isArray(pieceItems) ? pieceItems : []).reduce(
      (total, item) =>
        total +
        (isPlainObject(item)
          ? Math.max(
              0,
              Number(getRecordValue(item, "ValorUnitario")) ||
                getPieceUnitPrice(getRecordValue(item, "IdPeca"))
            ) *
            Math.max(0, Number(getRecordValue(item, "Quantidade")) || 0)
          : 0),
      0
    );
    const services = (Array.isArray(serviceItems) ? serviceItems : []).reduce(
      (total, item) =>
        total +
        (isPlainObject(item)
          ? getPrice("servicos", getRecordValue(item, "IdServico")) *
            Math.max(0, Number(getRecordValue(item, "QuantVezes")) || 0)
          : 0),
      0
    );
    const gross = pieces + services;
    const calculateDiscount = (
      enabled: boolean,
      type: DiscountType,
      value: number,
      base: number
    ) => {
      if (!enabled) return 0;
      const requested =
        type === "percent"
          ? base * (Math.min(100, Math.max(0, value)) / 100)
          : Math.max(0, value);
      return Math.min(base, requested);
    };
    const serviceDiscount = calculateDiscount(
      serviceDiscountEnabled,
      serviceDiscountType,
      serviceDiscountValue,
      services
    );
    const pieceDiscount = calculateDiscount(
      pieceDiscountEnabled,
      pieceDiscountType,
      pieceDiscountValue,
      pieces
    );
    const generalDiscount = calculateDiscount(
      discountEnabled,
      discountType,
      discountValue,
      gross
    );
    const discount = Math.min(gross, serviceDiscount + pieceDiscount + generalDiscount);

    return {
      pieces,
      services,
      gross,
      serviceDiscount,
      pieceDiscount,
      generalDiscount,
      discount,
      total: Math.max(0, gross - discount),
    };
  }, [
    discountEnabled,
    discountType,
    discountValue,
    serviceDiscountEnabled,
    serviceDiscountType,
    serviceDiscountValue,
    pieceDiscountEnabled,
    pieceDiscountType,
    pieceDiscountValue,
    formData,
    relationOptions,
    selectedConfig?.key,
  ]);

  const getPedidoPieceQuantities = (source: FormValue): Record<string, number> => {
    const lines =
      getRecordValue(source, "Pedido_Pecas") ??
      getRecordValue(source, "PedidoPecas");
    return (Array.isArray(lines) ? lines : []).reduce<Record<string, number>>(
      (totals, line) => {
        if (!isPlainObject(line)) return totals;
        const pieceId = String(getRecordValue(line, "IdPeca") ?? "");
        if (!pieceId) return totals;
        totals[pieceId] =
          (totals[pieceId] ?? 0) +
          Math.max(0, Number(getRecordValue(line, "Quantidade")) || 0);
        return totals;
      },
      {}
    );
  };

  const updateStockFromPedido = async (
    previousQuantities: Record<string, number>
  ): Promise<boolean> => {
    const nextQuantities = getPedidoPieceQuantities(formData);
    const pieceIds = new Set([
      ...Object.keys(previousQuantities),
      ...Object.keys(nextQuantities),
    ]);
    const changes = [...pieceIds]
      .map((pieceId) => ({
        pieceId,
        delta: (nextQuantities[pieceId] ?? 0) - (previousQuantities[pieceId] ?? 0),
      }))
      .filter(({ delta }) => delta !== 0);

    if (changes.length === 0) return true;

    for (const { pieceId, delta } of changes) {
      const option = (relationOptions.pecas ?? []).find(
        (candidate) => String(candidate.value) === pieceId
      );
      if (!option?.item) {
        setError(`Pedido salvo, mas não foi possível localizar a peça #${pieceId} para atualizar o estoque.`);
        return false;
      }

      const currentStock = Number(
        getRecordValue(option.item, "quantidadeEstoque") ??
          getRecordValue(option.item, "Quantidade_Estoque")
      );
      const unit = Math.max(1, Number(getRecordValue(option.item, "Unidade")) || 1);
      const normalizedStock = Number.isFinite(currentStock)
        ? currentStock
        : (Number(getRecordValue(option.item, "Quantidade")) || 0) * unit;
      const nextStock = normalizedStock - delta;

      if (nextStock < 0) {
        setError(`Estoque insuficiente para ${option.label}. Disponível: ${normalizedStock} unidade(s).`);
        return false;
      }

      const basePiecePayload = buildPayload(
        entityConfigs.find((config) => config.key === "pecas")?.template ?? {},
        {
          ...option.item,
          Quantidade: Math.floor(nextStock / unit),
          quantidadeEstoque: nextStock,
        },
        "",
        { includeArrays: true, entityKey: "pecas", formMode: "edit" }
      );
      const piecePayload = isPlainObject(basePiecePayload)
        ? {
            ...basePiecePayload,
            Quantidade: Math.floor(nextStock / unit),
            quantidadeEstoque: nextStock,
          }
        : basePiecePayload;
      const result = await fetchJson(baseUrl, `/api/v1/pecas/${pieceId}`, {
        method: "PUT",
        headers: authHeaders,
        body: piecePayload,
      });

      if (!result.ok) {
        setError(
          `Pedido salvo, mas falha ao atualizar o estoque de ${option.label}: ${getApiErrorMessage(
            result.data,
            `erro ${result.status}`
          )}`
        );
        return false;
      }
    }

    setOriginalPedidoPieceQuantities(nextQuantities);
    return true;
  };

  const validatePedidoStock = (
    previousQuantities: Record<string, number>
  ): string | null => {
    const nextQuantities = getPedidoPieceQuantities(formData);
    for (const [pieceId, requestedQuantity] of Object.entries(nextQuantities)) {
      const option = (relationOptions.pecas ?? []).find(
        (candidate) => String(candidate.value) === pieceId
      );
      if (!option?.item) return `Não foi possível verificar o estoque da peça #${pieceId}.`;

      const rawStock = Number(
        getRecordValue(option.item, "quantidadeEstoque") ??
          getRecordValue(option.item, "Quantidade_Estoque")
      );
      const unit = Math.max(1, Number(getRecordValue(option.item, "Unidade")) || 1);
      const currentStock = Number.isFinite(rawStock)
        ? rawStock
        : (Number(getRecordValue(option.item, "Quantidade")) || 0) * unit;
      const availableForOrder = currentStock + (previousQuantities[pieceId] ?? 0);

      if (requestedQuantity > availableForOrder) {
        return `${option.label}: quantidade solicitada (${requestedQuantity}) maior que o estoque disponível (${availableForOrder}).`;
      }
      if (currentStock <= 0 && requestedQuantity > (previousQuantities[pieceId] ?? 0)) {
        return `${option.label} está sem estoque e não pode ser adicionada ao pedido.`;
      }
    }
    return null;
  };

  const applyPedidoTotals = (payload: unknown): unknown => {
    if (selectedConfig?.key !== "pedidos" || !isPlainObject(payload)) return payload;

    const submittedDiscount = discountEnabled
      ? discountType === "percent"
        ? Math.min(100, Math.max(0, discountValue))
        : Math.min(pedidoTotals.gross, Math.max(0, discountValue))
      : 0;
    const submittedServiceDiscount = serviceDiscountEnabled
      ? serviceDiscountType === "percent"
        ? Math.min(100, Math.max(0, serviceDiscountValue))
        : Math.min(pedidoTotals.services, Math.max(0, serviceDiscountValue))
      : 0;
    const submittedPieceDiscount = pieceDiscountEnabled
      ? pieceDiscountType === "percent"
        ? Math.min(100, Math.max(0, pieceDiscountValue))
        : Math.min(pedidoTotals.pieces, Math.max(0, pieceDiscountValue))
      : 0;

    const withoutCalculatedFields = Object.fromEntries(
      Object.entries(payload).filter(
        ([key]) =>
          ![
            "valortotal",
            "descontoreais",
            "descontoporcentagem",
            "descontototalreais",
            "descontoservicoporcentagem",
            "descontoservicoreais",
            "descontopecaporcentagem",
            "descontopecareais",
          ].includes(normalizeFieldKey(key))
      )
    );
    const pieceLines = getRecordValue(payload, "Pedido_Pecas") ?? getRecordValue(payload, "PedidoPecas");
    const normalizedPieceLines = (Array.isArray(pieceLines) ? pieceLines : []).map((line) => {
      if (!isPlainObject(line)) return line;
      const pieceId = getRecordValue(line, "IdPeca");
      const option = (relationOptions.pecas ?? []).find(
        (candidate) => String(candidate.value) === String(pieceId)
      );
      const packagePrice = Math.max(0, Number(option?.item ? getRecordValue(option.item, "Valor") : 0) || 0);
      const unitsPerPackage = Math.max(1, Number(option?.item ? getRecordValue(option.item, "Unidade") : 1) || 1);
      const informedUnitPrice = Number(getRecordValue(line, "ValorUnitario"));
      return {
        ...line,
        ValorUnitario: Number.isFinite(informedUnitPrice) && informedUnitPrice > 0
          ? informedUnitPrice
          : packagePrice / unitsPerPackage,
      };
    });

    return {
      ...withoutCalculatedFields,
      Pedido_Pecas: normalizedPieceLines,
      ValorTotal: Math.round(((manualTotalEnabled ? manualTotalValue : pedidoTotals.total) + Number.EPSILON) * 100) / 100,
      DescontoReais:
        discountEnabled && discountType === "money" ? submittedDiscount : 0,
      DescontoPorcentagem:
        discountEnabled && discountType === "percent" ? submittedDiscount : 0,
      DescontoTotalReais:
        Math.round((pedidoTotals.discount + Number.EPSILON) * 100) / 100,
      DescontoServicoPorcentagem:
        serviceDiscountEnabled && serviceDiscountType === "percent"
          ? submittedServiceDiscount
          : 0,
      DescontoServicoReais:
        serviceDiscountEnabled && serviceDiscountType === "money"
          ? submittedServiceDiscount
          : 0,
      DescontoPecaPorcentagem:
        pieceDiscountEnabled && pieceDiscountType === "percent"
          ? submittedPieceDiscount
          : 0,
      DescontoPecaReais:
        pieceDiscountEnabled && pieceDiscountType === "money"
          ? submittedPieceDiscount
          : 0,
    };
  };

  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token]
  );

  const loadRegistrationOptions = async () => {
    if (!token) {
      setRegistrationOptions({});
      return;
    }
    const result = await fetchJson(baseUrl, "/api/v1/opcoes-cadastro", {
      method: "GET",
      headers: authHeaders,
    });
    if (!result.ok) return;
    const incoming = extractRegistrationOptions(result.data);
    setRegistrationOptions((current) => {
      const fields = new Set([...Object.keys(current), ...Object.keys(incoming)]);
      return Object.fromEntries(
        [...fields].map((field) => [
          field,
          mergeEditableOptions(current[field] ?? [], incoming[field] ?? []),
        ])
      );
    });
  };

  const rememberFormRegistrationOptions = (source: FormValue) => {
    const supportedFields = new Set([
      "modeloveiculo",
      "combustivel",
      "cor",
      "cargo",
      "tipomarca",
      "fornecedor",
    ]);
    setRegistrationOptions((current) => {
      const next = { ...current };
      Object.entries(source).forEach(([key, rawValue]) => {
        const normalized = normalizeFieldKey(key);
        if (!supportedFields.has(normalized)) return;
        const value = typeof rawValue === "string" ? rawValue.trim() : "";
        if (!value) return;
        next[normalized] = mergeEditableOptions(next[normalized] ?? [], [value]);
      });
      return next;
    });
  };

  useEffect(() => {
    void loadRegistrationOptions();
  }, [authHeaders, baseUrl, token]);
  useEffect(() => {
    if (selectedConfig?.key !== "veiculos" || savedImages.length === 0) {
      setSavedImagePreviews([]);
      return;
    }

    let isMounted = true;
    const objectUrls: string[] = [];

    const loadImages = async () => {
      const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
      const previews = await Promise.all(
        savedImages.map(async (image, index) => {
          const path = getImageUrlPath(image);
          if (!path) return null;
          const separator = path.startsWith("/") ? "" : "/";
          const url = path.startsWith("http")
            ? path
            : `${cleanBaseUrl}${separator}${path}`;

          try {
            const response = await fetch(url, { headers: authHeaders });
            if (!response.ok) return null;
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            objectUrls.push(objectUrl);
            return {
              id: String(getRecordValue(image, "Id") ?? getRecordValue(image, "id") ?? index),
              label: getImageLabel(image, index),
              url: objectUrl,
            } satisfies SavedImagePreview;
          } catch {
            return null;
          }
        })
      );

      if (isMounted) {
        setSavedImagePreviews(previews.filter(Boolean) as SavedImagePreview[]);
      } else {
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
      }
    };

    loadImages();

    return () => {
      isMounted = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [authHeaders, baseUrl, savedImages, selectedConfig?.key]);

  useEffect(() => {
    if (!entities.length) return;
    const requestedKey = new URLSearchParams(window.location.search).get("entidade");
    setSelectedKey((currentKey) => {
      if (requestedKey && entities.some((config) => config.key === requestedKey)) {
        return requestedKey;
      }
      return entities.some((config) => config.key === currentKey)
        ? currentKey
        : entities[0].key;
    });
  }, [entities]);

  const selectEntity = (key: string) => {
    setSelectedKey(key);
    setFilterValues({});
    setSearchTerm("");
    setCurrentPage(1);
    setShowForm(false);
  };

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
        const listPath = config.listPath as string;
        const paginationSeparator = listPath.includes("?") ? "&" : "?";
        const getPagePath = (page: number) =>
          `${listPath}${paginationSeparator}page=${page}&pageSize=100`;
        const result = await fetchJson(baseUrl, getPagePath(1), {
          method: "GET",
          headers: authHeaders,
        });

        if (!result.ok) return [config.key, []] as const;

        const totalPages = isPlainObject(result.data)
          ? Number(getRecordValue(result.data, "totalPages")) || 1
          : 1;
        const remainingPages =
          totalPages > 1
            ? await Promise.all(
                Array.from({ length: totalPages - 1 }, (_, index) => index + 2).map(
                  (page) =>
                    fetchJson(baseUrl, getPagePath(page), {
                      method: "GET",
                      headers: authHeaders,
                    })
                )
              )
            : [];
        const relationItems = [
          ...extractList(result.data),
          ...remainingPages.flatMap((pageResult) =>
            pageResult.ok ? extractList(pageResult.data) : []
          ),
        ];

        const capability = getEntityCapability(userRole, config.key);
        const options = relationItems
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
    setPedidoStatus(0);
    setOriginalPedidoPieceQuantities({});
    setDiscountEnabled(false);
    setDiscountType("percent");
    setDiscountValue(0);
    setServiceDiscountEnabled(false);
    setServiceDiscountType("percent");
    setServiceDiscountValue(0);
    setPieceDiscountEnabled(false);
    setPieceDiscountType("percent");
    setPieceDiscountValue(0);
    setManualTotalEnabled(false);
    setManualTotalValue(0);
    setFormData(
      applyLoggedOficina(
        clearCreateSelectValues(
          createEmptyListForm(getCreateTemplate(selectedConfig)),
          selectedConfig.key
        ) as FormValue
      )
    );
    setImageFiles([]);
    setSavedImages([]);
    setShowForm(false);
    setFilterValues({});
    setSearchTerm("");
    setCurrentPage(1);
    loadList(selectedConfig);
  }, [selectedConfig, baseUrl, token, oficinaId, userRole]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterValues, searchTerm]);

  useEffect(() => {
    if (!token) return;
    loadRelationOptions();
  }, [baseUrl, token, userRole, oficinaId]);

  useEffect(() => {
    if (!token || !oficinaId) {
      setLoggedOficinaName("");
      return;
    }

    let mounted = true;
    const loadLoggedOficinaName = async () => {
      const result = await fetchJson(baseUrl, `/api/v1/oficinas/${oficinaId}`, {
        method: "GET",
        headers: authHeaders,
      });
      if (!mounted || !result.ok || !isPlainObject(result.data)) return;
      const data = isPlainObject(result.data.data)
        ? result.data.data
        : isPlainObject(result.data.Data)
          ? result.data.Data
          : result.data;
      const name = getRecordValue(data, "Nome");
      if (typeof name === "string" && name.trim()) {
        setLoggedOficinaName(name.trim());
      }
    };

    void loadLoggedOficinaName();
    return () => {
      mounted = false;
    };
  }, [authHeaders, baseUrl, oficinaId, token]);

  const openCreateForm = () => {
    if (!selectedConfig || !canCreateSelected) return;
    setFormMode("create");
    setEditingId(null);
    setPedidoStatus(0);
    setDiscountEnabled(false);
    setDiscountType("percent");
    setDiscountValue(0);
    setServiceDiscountEnabled(false);
    setServiceDiscountType("percent");
    setServiceDiscountValue(0);
    setPieceDiscountEnabled(false);
    setPieceDiscountType("percent");
    setPieceDiscountValue(0);
    setManualTotalEnabled(false);
    setManualTotalValue(0);
    setFormData(
      applyLoggedOficina(
        clearCreateSelectValues(
          createEmptyListForm(getCreateTemplate(selectedConfig)),
          selectedConfig.key
        ) as FormValue
      )
    );
    setImageFiles([]);
    setSavedImages([]);
    void loadRelationOptions();
    void loadRegistrationOptions();
    setShowForm(true);
  };

  const openStockAdjustment = async (item: FormValue) => {
    const id = getItemId(item);
    if (!id) return;
    setError(null);
    setStockAdjustmentAmount(1);
    let fullItem = item;
    const pieceConfig = entityConfigs.find((config) => config.key === "pecas");
    if (pieceConfig?.getByIdPath) {
      const result = await fetchJson(baseUrl, pieceConfig.getByIdPath(String(id)), {
        method: "GET",
        headers: authHeaders,
      });
      if (result.ok) {
        const candidate = isPlainObject(result.data)
          ? (result.data.Data ?? result.data.data ?? result.data)
          : extractList(result.data)[0];
        if (isPlainObject(candidate)) fullItem = candidate;
      }
    }
    setStockAdjustmentItem(fullItem);
  };

  const handleStockAdjustment = async (direction: "add" | "subtract") => {
    if (!stockAdjustmentItem) return;
    const id = getItemId(stockAdjustmentItem);
    const amount = Math.floor(Number(stockAdjustmentAmount));
    if (!id || !Number.isFinite(amount) || amount <= 0) {
      setError("Informe uma quantidade inteira maior que zero.");
      return;
    }

    const unit = Math.max(1, Math.floor(Number(getRecordValue(stockAdjustmentItem, "Unidade")) || 1));
    const rawStock = Number(
      getRecordValue(stockAdjustmentItem, "quantidadeEstoque") ??
        getRecordValue(stockAdjustmentItem, "Quantidade_Estoque")
    );
    const currentStock = Number.isFinite(rawStock)
      ? Math.max(0, rawStock)
      : Math.max(0, Number(getRecordValue(stockAdjustmentItem, "Quantidade")) || 0) * unit;
    const stockDelta = amount * unit;

    if (direction === "subtract" && stockDelta > currentStock) {
      setError(`Não é possível diminuir ${amount}. Quantidade disponível: ${Math.floor(currentStock / unit)}.`);
      return;
    }

    const nextStock = direction === "add" ? currentStock + stockDelta : currentStock - stockDelta;
    const nextQuantity = Math.floor(nextStock / unit);
    const basePayload = buildPayload(
      entityConfigs.find((config) => config.key === "pecas")?.template ?? {},
      { ...stockAdjustmentItem, Quantidade: nextQuantity, quantidadeEstoque: nextStock },
      "",
      { includeArrays: true, entityKey: "pecas", formMode: "edit" }
    );
    const payload = isPlainObject(basePayload)
      ? { ...basePayload, Quantidade: nextQuantity, quantidadeEstoque: nextStock }
      : basePayload;

    setStockAdjustmentSaving(true);
    setError(null);
    const result = await fetchJson(baseUrl, `/api/v1/pecas/${id}`, {
      method: "PUT",
      headers: authHeaders,
      body: payload,
    });
    setStockAdjustmentSaving(false);

    if (!result.ok) {
      setError(getApiErrorMessage(result.data, `Falha ao atualizar o estoque (erro ${result.status}).`));
      return;
    }

    setStockAdjustmentItem(null);
    if (selectedConfig) await loadList(selectedConfig);
    await loadRelationOptions();
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
    if (selectedConfig.key === "pedidos") {
      setPedidoStatus(normalizeWorkflowStatus(getRecordValue(itemToEdit, "Status")));
      setOriginalPedidoPieceQuantities(getPedidoPieceQuantities(itemToEdit));
    }
    if (selectedConfig.key === "pedidos") {
      const percentage = Number(getRecordValue(itemToEdit, "DescontoPorcentagem")) || 0;
      const money = Number(getRecordValue(itemToEdit, "DescontoReais")) || 0;
      setDiscountEnabled(percentage > 0 || money > 0);
      setDiscountType(percentage > 0 ? "percent" : "money");
      setDiscountValue(percentage > 0 ? percentage : money);
      const servicePercentage = Number(getRecordValue(itemToEdit, "DescontoServicoPorcentagem")) || 0;
      const serviceMoney = Number(getRecordValue(itemToEdit, "DescontoServicoReais")) || 0;
      setServiceDiscountEnabled(servicePercentage > 0 || serviceMoney > 0);
      setServiceDiscountType(servicePercentage > 0 ? "percent" : "money");
      setServiceDiscountValue(servicePercentage > 0 ? servicePercentage : serviceMoney);
      const piecePercentage = Number(getRecordValue(itemToEdit, "DescontoPecaPorcentagem")) || 0;
      const pieceMoney = Number(getRecordValue(itemToEdit, "DescontoPecaReais")) || 0;
      setPieceDiscountEnabled(piecePercentage > 0 || pieceMoney > 0);
      setPieceDiscountType(piecePercentage > 0 ? "percent" : "money");
      setPieceDiscountValue(piecePercentage > 0 ? piecePercentage : pieceMoney);
    }
    if (selectedConfig.key === "pedidos") {
      setManualTotalEnabled(false);
      setManualTotalValue(Math.max(0, Number(getRecordValue(itemToEdit, "ValorTotal")) || 0));
    }
    if (selectedConfig.key === "pecas") {
      itemToEdit = normalizePieceFormRecord(itemToEdit);
    }
    setImageFiles([]);
    setSavedImages(getImageList(selectedConfig.key, itemToEdit));
    void loadRelationOptions();
    void loadRegistrationOptions();
    const mergedEditData = applyLoggedOficina(
      mergeWithTemplate(selectedConfig.template, itemToEdit) as FormValue
    );
    if (selectedConfig.key === "funcionarios") {
      const passwordKey = Object.keys(mergedEditData).find(
        (key) => normalizeFieldKey(key) === "senha"
      );
      if (passwordKey) mergedEditData[passwordKey] = "";
    }
    setFormData(mergedEditData);
    setShowForm(true);
  };

  const uploadImagesForEntity = async (
    entityKey: string,
    recordId: number
  ): Promise<boolean> => {
    const buildUploadPath = imageUploadPathByEntity[entityKey];
    if (!buildUploadPath || imageFiles.length === 0) return true;

    const body = new FormData();
    imageFiles.forEach((file) => body.append("imagens", file));

    const result = await fetchJson(baseUrl, buildUploadPath(recordId), {
      method: "POST",
      headers: authHeaders,
      body,
    });

    if (!result.ok) {
      const message =
        isPlainObject(result.data) && typeof result.data.Message === "string"
          ? result.data.Message
          : "Registro salvo, mas falha ao enviar imagem";
      setError(message);
      setIsLoading(false);
      return false;
    }

    setImageFiles([]);
    return true;
  };

  const removeSavedVehicleImage = async (imageId: string) => {
    if (
      selectedConfig?.key !== "veiculos" ||
      formMode === "view" ||
      !editingId
    ) {
      return;
    }

    const numericImageId = Number(imageId);
    if (!Number.isFinite(numericImageId) || numericImageId <= 0) {
      setError("Não foi possível identificar a imagem selecionada.");
      return;
    }

    setIsLoading(true);
    setError(null);
    const result = await fetchJson(
      baseUrl,
      `/api/v1/veiculos/${editingId}/imagens/${numericImageId}`,
      { method: "DELETE", headers: authHeaders }
    );

    if (!result.ok) {
      setError(
        `Falha ao remover imagem: ${getApiErrorMessage(
          result.data,
          result.status === 403
            ? "a API não permite que este usuário remova imagens do veículo"
            : `erro ${result.status}`
        )}`
      );
      setIsLoading(false);
      return;
    }

    setSavedImages((current) =>
      current.filter(
        (image) =>
          String(getRecordValue(image, "Id") ?? getRecordValue(image, "id")) !==
          imageId
      )
    );
    setSavedImagePreviews((current) =>
      current.filter((image) => image.id !== imageId)
    );
    setIsLoading(false);
  };

  const handleCreate = async () => {
    if (!selectedConfig || !canCreateSelected) return;
    const formValidationError = getFormValidationError(selectedConfig.key, formData, "create");
    if (formValidationError) {
      setError(formValidationError);
      return;
    }
    if (selectedConfig.key === "veiculos") {
      const validationError = getVehicleValidationError(formData);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    if (selectedConfig.key === "pedidos") {
      const stockError = validatePedidoStock({});
      if (stockError) {
        setError(stockError);
        return;
      }
    }
    setIsLoading(true);
    setError(null);
    const createTemplate = getCreateTemplate(selectedConfig);
    const rawCreatePayload = buildPayload(createTemplate, formData, "", {
      includeArrays: shouldCreateWithArrays(selectedConfig.key),
      entityKey: selectedConfig.key,
      formMode: "create",
    });
    let createPayload: unknown =
      selectedConfig.key === "clientes" && isPlainObject(rawCreatePayload)
        ? {
            ...rawCreatePayload,
            ...(onlyDigits(
              getRecordValue(formData, "Cpf_Cnpj") ?? getRecordValue(formData, "CpfCnpj") ?? getRecordValue(formData, "Cpf")
            ).length === 14 ? { sexo: 3 } : {}),
            telefones: Array.isArray(rawCreatePayload.telefones)
              ? rawCreatePayload.telefones.filter(
                  (telefone) =>
                    isPlainObject(telefone) &&
                    onlyDigits(getRecordValue(telefone, "numero")).length >= 8
                )
              : [],
          }
        : rawCreatePayload;
    createPayload = applyPedidoTotals(createPayload);
    if (selectedConfig.key === "pecas") {
      createPayload = applyPieceStockTotal(createPayload);
    }
    let createPath = selectedConfig.createPath;

    if (selectedConfig.key === "veiculos") {
      const clienteId = Number(getRecordValue(formData, "ClienteId"));
      if (!Number.isFinite(clienteId) || clienteId <= 0) {
        setError("Selecione o cliente do veículo.");
        setIsLoading(false);
        return;
      }

      createPath = `/api/v1/clientes/${clienteId}/veiculos`;
      if (isPlainObject(rawCreatePayload)) {
        createPayload = Object.fromEntries(
          Object.entries(rawCreatePayload).filter(
            ([key]) =>
              !["clienteid", "idcliente", "status"].includes(
                normalizeFieldKey(key)
              )
          )
        );
      }
    }

    const result = await fetchJson(baseUrl, createPath, {
      method: "POST",
      headers: authHeaders,
      body: createPayload,
    });

    if (!result.ok) {
      setError(getApiErrorMessage(result.data, "Falha ao criar registro"));
      setIsLoading(false);
      return;
    }

    let createdId = getNestedRecordId(result.data);

    if (
      selectedConfig.key !== "clientes" &&
      selectedConfig.updatePath &&
      hasArrayItems(createTemplate, formData)
    ) {
      createdId = createdId ?? (await resolveCreatedId(result.data));
      if (createdId) {
        const childResult = await fetchJson(
          baseUrl,
          selectedConfig.updatePath(String(createdId)),
          {
            method: "PUT",
            headers: authHeaders,
            body: applyPedidoTotals(
              buildPayload(selectedConfig.template, formData, "", {
                includeArrays: true,
                parentId: createdId,
                entityKey: selectedConfig.key,
                formMode: "create",
              })
            ),
          }
        );

        if (!childResult.ok) {
          setError(getApiErrorMessage(childResult.data, "Registro principal criado, mas falha ao salvar itens vinculados"));
          setIsLoading(false);
          return;
        }
      }
    }

    if (selectedConfig.key === "pedidos") {
      const stockUpdated = await updateStockFromPedido({});
      if (!stockUpdated) {
        setIsLoading(false);
        return;
      }
    }

    if (imageFiles.length > 0) {
      const imageTargetId = createdId ?? (await resolveCreatedId(result.data));
      if (!imageTargetId) {
        setError("Registro criado, mas não foi possível identificar o ID para enviar imagem.");
        setIsLoading(false);
        return;
      }

      const uploaded = await uploadImagesForEntity(selectedConfig.key, imageTargetId);
      if (!uploaded) return;
    }

    rememberFormRegistrationOptions(formData);
    setShowForm(false);
    await Promise.all([loadList(selectedConfig), loadRegistrationOptions()]);
  };

  const handleUpdate = async () => {
    if (
      !selectedConfig?.updatePath ||
      !editingId ||
      !selectedCapability?.canUpdate
    ) {
      return;
    }
    const formValidationError = getFormValidationError(selectedConfig.key, formData, "edit");
    if (formValidationError) {
      setError(formValidationError);
      return;
    }
    if (selectedConfig.key === "veiculos") {
      const validationError = getVehicleValidationError(formData);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    if (selectedConfig.key === "pedidos") {
      const stockError = validatePedidoStock(originalPedidoPieceQuantities);
      if (stockError) {
        setError(stockError);
        return;
      }
    }
    setIsLoading(true);
    setError(null);
    const updatedPedidoStatus = normalizeWorkflowStatus(pedidoStatus);
    if (selectedConfig.key === "pedidos") {
      const statusResult = await fetchJson(
        baseUrl,
        `/api/v1/pedidos/${editingId}/status`,
        {
          method: "PATCH",
          headers: authHeaders,
          body: { status: updatedPedidoStatus },
        }
      );

      if (!statusResult.ok) {
        setError(
          `Falha no PATCH do status do pedido: ${getApiErrorMessage(
            statusResult.data,
            `erro ${statusResult.status}`
          )}`
        );
        setIsLoading(false);
        return;
      }
    }
    const updatePath =
      selectedConfig.key === "clientes" && normalizeRole(userRole) === "oficina"
        ? `/api/v1/oficinas/me/clientes/${editingId}`
        : selectedConfig.key === "veiculos"
          ? `/api/v1/oficinas/me/veiculos/${editingId}`
          : selectedConfig.updatePath(String(editingId));
    const isOfficeClientUpdate =
      selectedConfig.key === "clientes" && normalizeRole(userRole) === "oficina";
    const phoneFieldKey = Object.keys(formData).find(
      (key) => normalizeFieldKey(key) === "telefones"
    );
    const updateFormData =
      isOfficeClientUpdate && phoneFieldKey
        ? {
            ...formData,
            [phoneFieldKey]: Array.isArray(formData[phoneFieldKey])
              ? formData[phoneFieldKey].filter(
                  (phone) => isPlainObject(phone) && !getItemId(phone)
                )
              : [],
          }
        : formData;
    const rawUpdatePayload = buildPayload(
      selectedConfig.template,
      updateFormData,
      "",
      {
        includeArrays: true,
        parentId: editingId,
        entityKey: selectedConfig.key,
        formMode: "edit",
      }
    );
    let updatePayload =
      (selectedConfig.key === "veiculos" || selectedConfig.key === "pedidos") &&
      isPlainObject(rawUpdatePayload)
        ? {
            ...Object.fromEntries(
              Object.entries(rawUpdatePayload).filter(
                ([key]) =>
                  selectedConfig.key === "veiculos"
                    ? !["clienteid", "idcliente", "status"].includes(
                        normalizeFieldKey(key)
                      )
                    : normalizeFieldKey(key) !== "status"
              )
            ),
          }
        : rawUpdatePayload;
    if (
      selectedConfig.key === "clientes" &&
      isPlainObject(updatePayload) &&
      onlyDigits(
        getRecordValue(formData, "Cpf_Cnpj") ?? getRecordValue(formData, "CpfCnpj") ?? getRecordValue(formData, "Cpf")
      ).length === 14
    ) {
      updatePayload = { ...updatePayload, Sexo: 3 };
    }
    updatePayload = applyPedidoTotals(updatePayload);
    if (selectedConfig.key === "pecas") {
      updatePayload = applyPieceStockTotal(updatePayload);
    }
    const result = await fetchJson(
      baseUrl,
      updatePath,
      {
        method: "PUT",
        headers: authHeaders,
        body: updatePayload,
      }
    );

    if (!result.ok) {
      setError(getApiErrorMessage(result.data, "Falha ao atualizar registro"));
      setIsLoading(false);
      return;
    }

    if (selectedConfig.key === "pedidos") {
      const stockUpdated = await updateStockFromPedido(
        originalPedidoPieceQuantities
      );
      if (!stockUpdated) {
        setIsLoading(false);
        return;
      }
    }

    const uploaded = await uploadImagesForEntity(selectedConfig.key, editingId);
    if (!uploaded) return;

    rememberFormRegistrationOptions(formData);
    setShowForm(false);
    await Promise.all([loadList(selectedConfig), loadRegistrationOptions()]);
  };

  const handleDelete = async (id: number) => {
    if (!selectedConfig?.deletePath || !selectedCapability?.canDelete) return;
    setPendingDeleteId(null);
    setIsLoading(true);
    setError(null);
    const normalizedUserRole = normalizeRole(userRole);
    const deletePath =
      selectedConfig.key === "clientes" && ["oficina", "funcionario"].includes(normalizedUserRole)
        ? `/api/v1/oficinas/me/clientes/${id}/vinculo`
        : selectedConfig.key === "veiculos" &&
            ["oficina", "funcionario"].includes(normalizedUserRole)
          ? `/api/v1/oficinas/me/veiculos/${id}`
          : selectedConfig.deletePath(String(id));
    const result = await fetchJson(
      baseUrl,
      deletePath,
      {
        method: "DELETE",
        headers: authHeaders,
      }
    );

    if (!result.ok) {
      setError(getApiErrorMessage(result.data, `Falha ao ${getDeleteActionLabel(selectedConfig.key).toLowerCase()} registro`));
      setIsLoading(false);
      return;
    }

    await loadList(selectedConfig);
  };

  const openOrderStatusModal = (item: FormValue) => {
    setStatusOrderItem(item);
    setNextOrderStatus(normalizeWorkflowStatus(getRecordValue(item, "Status")));
    setError(null);
  };

  const handleOrderStatusUpdate = async () => {
    const orderId = statusOrderItem ? getItemId(statusOrderItem) : null;
    if (!orderId || selectedConfig.key !== "pedidos") return;
    setStatusSaving(true);
    setError(null);
    const result = await fetchJson(baseUrl, `/api/v1/pedidos/${orderId}/status`, {
      method: "PATCH",
      headers: authHeaders,
      body: { status: nextOrderStatus },
    });
    if (!result.ok) {
      setError(getApiErrorMessage(result.data, "Falha ao atualizar o status do pedido."));
      setStatusSaving(false);
      return;
    }
    setStatusOrderItem(null);
    setStatusSaving(false);
    await loadList(selectedConfig);
  };

  const handleRemoveListItem = async (
    listKey: string,
    fieldPath: Array<string | number>,
    items: unknown[],
    item: unknown,
    index: number
  ) => {
    const normalizedListKey = normalizeFieldKey(listKey);
    const itemId = isPlainObject(item) ? getItemId(item) : null;

    if (normalizedListKey === "telefones" && itemId) {
      setIsLoading(true);
      setError(null);
      const result = await fetchJson(baseUrl, `/api/v1/telefones/${itemId}`, {
        method: "DELETE",
        headers: authHeaders,
      });

      if (!result.ok) {
              const message =
            isPlainObject(result.data) && typeof result.data.Message === "string"
              ? result.data.Message
              : result.status === 403
              ? "A API recusou excluir este telefone para o usuário atual."
              : "Falha ao remover telefone.";
        setError(message);
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
    }

    const nextItems = items.filter((_, idx) => idx !== index);
    setFormData((prev) => setAtPath(prev, fieldPath, nextItems) as FormValue);
  };

  const handleFieldChange = (
    path: Array<string | number>,
    templateValue: unknown,
    value: string
  ) => {
    let nextValue: unknown = value;
    const key = String(path[path.length - 1] ?? "");
    const normalized = normalizeFieldKey(key);

    if (isPhoneNumberField(key, path)) {
      const digits = onlyDigits(value).slice(0, 11);
      const parentPath = path.slice(0, -1);
      const ddd = digits.slice(0, 2);
      const number = digits.slice(2);
      setFormData((prev) => {
        let next = setAtPath(prev, path, number);
        const parent = getAtPath(prev, parentPath);
        const dddKey = isPlainObject(parent)
          ? getRecordKey(parent, "DDD")
          : "DDD";
        next = setAtPath(next, [...parentPath, dddKey], ddd);
        return next as FormValue;
      });
      return;
    }

    if (
      normalized === "cep" ||
      normalized.includes("cpf") ||
      normalized.includes("cnpj")
    ) {
      nextValue =
        selectedConfig.key === "clientes" &&
          (normalized.includes("cpfcnpj") || (formMode === "create" && normalized === "cpf"))
          ? maskFieldValue("Cpf_Cnpj", value)
          : maskFieldValue(key, value);
    } else if (normalized === "ean") {
      nextValue = onlyDigits(value).slice(0, 13);
    } else if (["placaveiculo", "chassiveiculo", "seguro", "tempodec"].includes(normalized)) {
      nextValue = normalizeSpecialTextField(key, value);
    } else if (typeof templateValue === "number") {
      const parsed = Number(value);
      nextValue = Number.isNaN(parsed)
        ? templateValue
        : normalized === "quilometragem"
          ? Math.min(9999999, Math.max(0, parsed))
          : parsed;
    } else {
      const maskedValue = maskFieldValue(key, value);
      nextValue =
        typeof templateValue === "string" &&
        !normalized.includes("email") &&
        !normalized.includes("senha") &&
        !normalized.startsWith("data")
          ? String(maskedValue).toUpperCase()
          : maskedValue;
    }

    if (
      selectedConfig.key === "pedidos" &&
      path.length === 1 &&
      normalized === "status"
    ) {
      setPedidoStatus(normalizeWorkflowStatus(nextValue));
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
              const parent = getAtPath(next, parentPath);
              const siblingKey = isPlainObject(parent)
                ? getRecordKey(parent, field)
                : field;
              next = setAtPath(next, [...parentPath, siblingKey], fieldValue);
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

  const selectImageFiles = (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith("image/"));
    const rejectedCount = files.length - images.length;

    setImageFiles(images);
    if (rejectedCount > 0) {
      setError(
        rejectedCount === 1
          ? "Um arquivo foi ignorado porque não é uma imagem."
          : `${rejectedCount} arquivos foram ignorados porque não são imagens.`
      );
    } else {
      setError(null);
    }
  };

  const renderImageField = () => {
    if (!selectedConfig || !imageUploadPathByEntity[selectedConfig.key]) return null;

    return (
      <div className="mt-4 overflow-hidden rounded-lg border border-[var(--sigo-border)] bg-white shadow-[var(--sigo-shadow-sm)]">
        <div className="border-b border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] px-4 py-3">
          <p className="text-sm font-black text-[var(--sigo-text)]">Imagens</p>
          <p className="mt-1 text-xs font-medium text-[var(--sigo-muted)]">
            Adicione e organize as imagens vinculadas.
          </p>
        </div>

        <div className="grid gap-3 p-4">

        {savedImagePreviews.length > 0 ? (
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {savedImagePreviews.map((image) => (
              <figure
                key={image.id}
                className="relative overflow-hidden rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)]"
              >
                <img
                  src={image.url}
                  alt={image.label}
                  className="aspect-video w-full object-cover"
                />
                <figcaption className="truncate px-3 py-2 text-xs font-semibold text-[var(--sigo-muted)]">
                  {image.label}
                </figcaption>
                {formMode !== "view" ? (
                  <button
                    type="button"
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-sm bg-white/95 text-xl font-black leading-none text-red-600 shadow-md transition-colors hover:bg-red-50 hover:text-red-700"
                    aria-label={`Remover ${image.label}`}
                    title="Remover imagem salva"
                    onClick={() => void removeSavedVehicleImage(image.id)}
                  >
                    ×
                  </button>
                ) : null}
              </figure>
            ))}
          </div>
        ) : formMode !== "create" ? (
          <p className="mb-4 rounded-lg border border-dashed border-[var(--sigo-border-strong)] bg-[var(--sigo-surface-soft)] px-4 py-3 text-sm font-semibold text-[var(--sigo-muted)]">
            Nenhuma imagem salva.
          </p>
        ) : null}

        {formMode !== "view" ? (
          <div className="grid gap-3">
          <label
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--sigo-border-strong)] bg-[var(--sigo-surface-soft)] px-4 py-6 text-center transition-colors hover:border-[var(--sigo-blue)] hover:bg-[var(--sigo-blue-soft)]"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              selectImageFiles(Array.from(event.dataTransfer.files));
            }}
          >
            <img src="/mais.png" alt="" aria-hidden="true" className="h-9 w-9 object-contain" />
            <span className="text-sm font-black text-[var(--sigo-blue-deep)]">
              Adicionar imagens
            </span>
            <span className="text-xs font-semibold text-[var(--sigo-muted)]">
              Clique ou arraste somente imagens para esta área
            </span>
            <input
              className="sr-only"
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                selectImageFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
            {imageFiles.length > 0 ? (
              <span className="text-xs font-semibold text-[var(--sigo-muted)]">
                {imageFiles.length} imagem(ns) selecionada(s).
              </span>
            ) : null}
          </label>
          {imageFiles.length > 0 ? (
            <div className="grid gap-2">
              {imageFiles.map((file, index) => (
                <div
                  key={`${file.name}-${file.lastModified}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] px-3 py-2"
                >
                  <span className="min-w-0 truncate text-xs font-semibold text-[var(--sigo-text)]">
                    {file.name}
                  </span>
                  <button
                    type="button"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-transparent text-xl font-black leading-none text-red-600 hover:bg-red-50 hover:text-red-700"
                    aria-label={`Remover ${file.name}`}
                    title="Remover imagem"
                    onClick={() =>
                      setImageFiles((current) =>
                        current.filter((_, fileIndex) => fileIndex !== index)
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          </div>
        ) : null}
        </div>
      </div>
    );
  };

  const renderDiscountControl = (
    title: string,
    enabled: boolean,
    setEnabled: (enabled: boolean) => void,
    type: DiscountType,
    setType: (type: DiscountType) => void,
    value: number,
    setValue: (value: number) => void,
    maximum: number,
    applied: number
  ) => (
    <div className="rounded-md border border-[var(--sigo-border)] bg-white p-3">
      <button
        type="button"
        className="text-sm font-extrabold text-[var(--sigo-blue)]"
        onClick={() => {
          setEnabled(!enabled);
          if (enabled) setValue(0);
        }}
      >
        {enabled ? `Remover ${title.toLowerCase()}` : `+ Adicionar ${title.toLowerCase()}`}
      </button>
      {enabled ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-[12rem_1fr]">
          <label className="sigo-label">
            <span>Tipo de desconto</span>
            <select
              className="sigo-input bg-white"
              value={type}
              onChange={(event) => {
                setType(event.target.value as DiscountType);
                setValue(0);
              }}
            >
              <option value="percent">Porcentagem (%)</option>
              <option value="money">Valor em reais (R$)</option>
            </select>
          </label>
          <label className="sigo-label">
            <span>{type === "percent" ? "Desconto (%)" : "Desconto (R$)"}</span>
            <input
              className="sigo-input bg-white"
              type="number"
              min="0"
              max={type === "percent" ? 100 : maximum}
              step={type === "percent" ? 1 : 0.01}
              value={value}
              onChange={(event) => setValue(Math.max(0, Number(event.target.value) || 0))}
            />
          </label>
          <p className="text-xs font-bold text-[var(--sigo-muted)] sm:col-span-2">
            Aplicado: {currencyFormatter.format(applied)}
          </p>
        </div>
      ) : null}
    </div>
  );
  const renderFields = (
    template: Record<string, unknown>,
    value: Record<string, unknown>,
    path: Array<string | number> = []
  ) => {
    const fieldOrder = (key: string) => {
      if (Array.isArray(template[key])) return 2;
      if (isObservationField(key)) return 1;
      return 0;
    };
    const orderedKeys = Object.keys(template).sort(
      (first, second) => fieldOrder(first) - fieldOrder(second)
    );

    return orderedKeys.map((key) => {
      const templateValue = template[key];
      const currentValue = value[key];
      const fieldPath = [...path, key];
      const normalizedFieldKey = normalizeFieldKey(key);
      const autoParentField = getAutoParentField(path);
      const parentListKey = getParentListKey(path);
      const hiddenFields = parentListKey
        ? hiddenFieldByList[normalizeFieldKey(parentListKey)] ?? []
        : [];

      if (
        isOwnIdField(key, path) ||
        (path.length === 0 &&
          normalizeFieldKey(key) === "status" &&
          (selectedConfig.key === "veiculos" ||
            (selectedConfig.key === "pedidos" && formMode === "create"))) ||
        (path.length === 0 &&
          shouldHideFieldForEntity(selectedConfig.key, key)) ||
        hiddenFields.some((field) => normalizeFieldKey(field) === normalizeFieldKey(key)) ||
        (autoParentField &&
          normalizeFieldKey(key) === normalizeFieldKey(autoParentField))
      ) {
        return null;
      }

      if (selectedConfig.key === "clientes" && path.length === 0) {
        const documentLength = onlyDigits(
          getRecordValue(value, "Cpf_Cnpj") ?? getRecordValue(value, "CpfCnpj") ?? getRecordValue(value, "Cpf")
        ).length;
        if (normalizedFieldKey === "razao" && documentLength !== 14) return null;
        if (["obs", "observacao", "sexo"].includes(normalizedFieldKey) && documentLength === 14) return null;
      }

      if (
        selectedConfig.key === "pedidos" &&
        path.length === 0 &&
        [
          "descontoreais",
          "descontoporcentagem",
          "descontototalreais",
          "descontoservicoporcentagem",
          "descontoservicoreais",
          "descontopecaporcentagem",
          "descontopecareais",
        ].includes(normalizedFieldKey)
      ) {
        return null;
      }

      if (
        selectedConfig.key === "pedidos" &&
        path.length === 0 &&
        normalizedFieldKey === "valortotal"
      ) {
        return (
          <div
            key={fieldPath.join(".")}
            className="grid gap-4 rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-4 md:col-span-2"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-[var(--sigo-border)] bg-white p-3">
                <p className="text-xs font-bold text-[var(--sigo-muted)]">Peças</p>
                <p className="mt-1 text-base font-black text-[var(--sigo-text)]">
                  {currencyFormatter.format(pedidoTotals.pieces)}
                </p>
              </div>
              <div className="rounded-md border border-[var(--sigo-border)] bg-white p-3">
                <p className="text-xs font-bold text-[var(--sigo-muted)]">Serviços</p>
                <p className="mt-1 text-base font-black text-[var(--sigo-text)]">
                  {currencyFormatter.format(pedidoTotals.services)}
                </p>
              </div>
              <div className="rounded-md border border-[var(--sigo-border)] bg-white p-3">
                <p className="text-xs font-bold text-[var(--sigo-muted)]">Valor total</p>
                <p className="mt-1 text-base font-black text-[var(--sigo-blue)]">
                  {currencyFormatter.format(manualTotalEnabled ? manualTotalValue : pedidoTotals.total)}
                </p>
              </div>
            </div>

            {formMode !== "view" ? (
              <div>
                <label className="mb-3 flex cursor-pointer items-center gap-3 rounded-md border border-[var(--sigo-border)] bg-white p-3 text-sm font-bold text-[var(--sigo-text)]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--sigo-blue)]"
                    checked={manualTotalEnabled}
                    onChange={(event) => {
                      const enabled = event.target.checked;
                      setManualTotalEnabled(enabled);
                      if (enabled && manualTotalValue <= 0) setManualTotalValue(pedidoTotals.total);
                    }}
                  />
                  Alterar valor total manualmente
                </label>
                {manualTotalEnabled ? (
                  <label className="sigo-label mb-3">
                    <span>Valor total manual</span>
                    <input
                      className="sigo-input bg-white"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={manualTotalValue}
                      onChange={(event) => setManualTotalValue(Math.max(0, Number(event.target.value) || 0))}
                    />
                    <small className="text-xs font-semibold text-amber-700">
                      Este valor substituirá o total calculado automaticamente.
                    </small>
                  </label>
                ) : null}
                <div className="grid gap-3">
                  {renderDiscountControl(
                    "Desconto geral",
                    discountEnabled,
                    setDiscountEnabled,
                    discountType,
                    setDiscountType,
                    discountValue,
                    setDiscountValue,
                    pedidoTotals.gross,
                    pedidoTotals.generalDiscount
                  )}
                  {renderDiscountControl(
                    "Desconto de serviços",
                    serviceDiscountEnabled,
                    setServiceDiscountEnabled,
                    serviceDiscountType,
                    setServiceDiscountType,
                    serviceDiscountValue,
                    setServiceDiscountValue,
                    pedidoTotals.services,
                    pedidoTotals.serviceDiscount
                  )}
                  {renderDiscountControl(
                    "Desconto de peças",
                    pieceDiscountEnabled,
                    setPieceDiscountEnabled,
                    pieceDiscountType,
                    setPieceDiscountType,
                    pieceDiscountValue,
                    setPieceDiscountValue,
                    pedidoTotals.pieces,
                    pedidoTotals.pieceDiscount
                  )}
                </div>
              </div>
            ) : pedidoTotals.discount > 0 ? (
              <p className="text-sm font-bold text-[var(--sigo-muted)]">
                Desconto aplicado: {currencyFormatter.format(pedidoTotals.discount)}
              </p>
            ) : null}
          </div>
        );
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
                    const nextItems = [
                      ...items,
                      clearCreateSelectValues(
                        cloneTemplate(itemTemplate),
                        selectedConfig.key,
                        fieldPath
                      ),
                    ];
                    setFormData((prev) =>
                      setAtPath(prev, fieldPath, nextItems) as FormValue
                    );
                  }}
                >
                  <img
                    src="/mais.png"
                    alt=""
                    aria-hidden="true"
                    className="h-4 w-4 object-contain"
                  />
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
              {items.map((item, index) => {
                const isExistingOfficeClientPhone =
                  normalizeFieldKey(key) === "telefones" &&
                  formMode === "edit" &&
                  normalizeRole(userRole) === "oficina" &&
                  isPlainObject(item) &&
                  Boolean(getItemId(item));

                return (
                  <div
                    key={`${key}-${index}`}
                    className="rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        {normalizeFieldKey(key) !== "telefones" ? (
                          <p className="text-xs font-bold text-[var(--sigo-muted)]">
                            Item
                          </p>
                        ) : null}
                        {isExistingOfficeClientPhone ? (
                          <p className="mt-1 text-xs font-semibold text-[var(--sigo-soft)]">
                            Telefone já cadastrado — somente leitura
                          </p>
                        ) : null}
                      </div>
                      {formMode !== "view" && !isExistingOfficeClientPhone ? (
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-transparent text-xl font-black leading-none text-red-600 hover:bg-red-50 hover:text-red-700"
                          aria-label="Remover item"
                          title="Remover item"
                          onClick={() =>
                            handleRemoveListItem(key, fieldPath, items, item, index)
                          }
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                    {itemTemplate && isPlainObject(item) ? (
                      <fieldset disabled={isExistingOfficeClientPhone}>
                        <div className="grid gap-3 md:grid-cols-2">
                          {renderFields(
                            itemTemplate,
                            item as Record<string, unknown>,
                            [...fieldPath, index]
                          )}
                        </div>
                      </fieldset>
                    ) : null}
                  </div>
                );
              })}
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
        selectedConfig.key === "pedidos" &&
              fieldPath.length === 1 &&
              normalizeFieldKey(key) === "status"
            ? pedidoStatus
          : currentValue === undefined || currentValue === null
          ? templateValue ?? ""
          : currentValue;
      const displayValue =
        isPhoneNumberField(key, fieldPath)
          ? formatPhone(
              `${onlyDigits(
                isPlainObject(getAtPath(formData, fieldPath.slice(0, -1)))
                  ? getRecordValue(
                      getAtPath(formData, fieldPath.slice(0, -1)) as FormValue,
                      "DDD"
                    )
                  : ""
              )}${onlyDigits(normalizedValue)}`
            )
          : normalizeFieldKey(key) === "cep" ||
        normalizeFieldKey(key).includes("cpf") ||
        normalizeFieldKey(key).includes("cnpj")
          ? selectedConfig.key === "clientes" &&
            (normalizeFieldKey(key).includes("cpfcnpj") ||
              (formMode === "create" && normalizeFieldKey(key) === "cpf"))
            ? maskFieldValue("Cpf_Cnpj", normalizedValue)
            : maskFieldValue(key, normalizedValue)
          : String(normalizedValue);
      const fieldOptions = getFieldOptions(key, path, selectedConfig.key);
      const editableFieldOptions = getEditableFieldOptions(selectedConfig.key, key, registrationOptions);
      const editableOptionsId = editableFieldOptions
        ? `options-${selectedConfig.key}-${fieldPath.join("-")}`
        : undefined;
      const matchedFieldOption = fieldOptions?.find(
        (option) =>
          String(option.value) === String(normalizedValue) ||
          normalizeFieldKey(String(option.value)) ===
            normalizeFieldKey(String(normalizedValue)) ||
          normalizeFieldKey(option.label) ===
            normalizeFieldKey(String(normalizedValue))
      );
      const selectValue = matchedFieldOption?.value ?? normalizedValue;
      const hasUnmappedOption =
        Boolean(fieldOptions) &&
        !matchedFieldOption &&
        String(normalizedValue ?? "").trim().length > 0;
      const relationEntityKey = getRelationEntityKey(key);
      const isLoggedOficinaField =
        selectedCapability?.scopeToOwnOffice &&
        Boolean(oficinaId) &&
        ["idoficina", "oficinaid"].includes(normalizeFieldKey(key));
      const loggedOficinaLabel =
        loggedOficinaName ||
        findRelationLabel(relationOptions, "idOficina", oficinaId) ||
        (oficinaId ? `Oficina #${oficinaId}` : "");

      if (normalizeFieldKey(key) === "pais") {
        return (
          <label
            key={fieldPath.join(".")}
            className="sigo-label rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-3"
          >
            <span>{formatFieldLabel(key)}</span>
            <input className="sigo-input" type="text" value="Brasil" disabled />
          </label>
        );
      }

      if (isObservationField(key)) {
        return (
          <label
            key={fieldPath.join(".")}
            className="sigo-label rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-4 md:col-span-2"
          >
            <span>{formatFieldLabel(key)}</span>
            <div className="relative">
              <textarea
                className="sigo-input sigo-observation-input resize-y bg-white"
                value={displayValue}
                disabled={formMode === "view"}
                aria-label={formatFieldLabel(key)}
                onChange={(event) =>
                  handleFieldChange(fieldPath, templateValue, event.target.value)
                }

              />
              {!displayValue ? (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-semibold text-[var(--sigo-soft)]">
                  Digite as observações do registro
                </span>
              ) : null}
            </div>
          </label>
        );
      }

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
        const availableRelationOptions =
          selectedConfig.key === "pedidos" && relationEntityKey === "pecas"
            ? (relationOptions[relationEntityKey] ?? []).filter((option) => {
                if (String(option.value) === String(normalizedValue)) return true;
                if (!option.item) return false;
                const rawStock = Number(
                  getRecordValue(option.item, "quantidadeEstoque") ??
                    getRecordValue(option.item, "Quantidade_Estoque")
                );
                const unit = Math.max(
                  1,
                  Number(getRecordValue(option.item, "Unidade")) || 1
                );
                const stock = Number.isFinite(rawStock)
                  ? rawStock
                  : (Number(getRecordValue(option.item, "Quantidade")) || 0) * unit;
                return stock > 0;
              })
            : relationOptions[relationEntityKey] ?? [];
        return (
          <RelationSearchField
            key={fieldPath.join(".")}
            label={formatFieldLabel(key)}
            value={normalizedValue}
            options={availableRelationOptions}
            disabled={formMode === "view"}
            onChange={(nextValue) =>
              handleFieldChange(fieldPath, templateValue, nextValue)
            }
          />
        );
      }

      return (
        <label key={fieldPath.join(".")} className="sigo-label rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-3">
          <span>{isPhoneNumberField(key, fieldPath) ? "Telefone" : selectedConfig.key === "clientes" && formMode === "create" && normalizeFieldKey(key) === "cpf" ? "CPF ou CNPJ" : selectedConfig.key === "funcionarios" && normalizeFieldKey(key) === "senha" ? (formMode === "edit" ? "Redefinição de senha" : "Senha inicial") : formatFieldLabel(key)}</span>
          {fieldOptions ? (
            <select
              className="sigo-input"
              value={String(selectValue)}
              disabled={formMode === "view"}
              onChange={(event) =>
                handleFieldChange(fieldPath, templateValue, event.target.value)
              }
            >
              <option value="">Selecione</option>
              {hasUnmappedOption ? (
                <option value={String(normalizedValue)}>
                  {String(normalizedValue)}
                </option>
              ) : null}
              {fieldOptions.map((option) => (
                <option key={String(option.value)} value={String(option.value)}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input
                className={`sigo-input ${typeof templateValue === "string" && !normalizeFieldKey(key).includes("email") && !normalizeFieldKey(key).includes("senha") ? "uppercase" : ""}`}
                type={getInputType(key, templateValue)}
                value={displayValue}
                disabled={formMode === "view"}
                list={editableOptionsId}
                placeholder={
                  ["valor", "valorunitario"].includes(normalizeFieldKey(key))
                    ? "0,00"
                    : normalizeFieldKey(key) === "ean"
                      ? "00000000 ou 0000000000000"
                    : normalizeFieldKey(key) === "tempodec"
                      ? "00:00"
                    : normalizeFieldKey(key).includes("cpf")
                    ? (normalizeFieldKey(key).includes("cpfcnpj") || (selectedConfig.key === "clientes" && formMode === "create" && normalizeFieldKey(key) === "cpf") ? "000.000.000-00 ou 00.000.000/0000-00" : "000.000.000-00")
                    : normalizeFieldKey(key) === "cep"
                      ? "00000-000"
                      : normalizeFieldKey(key) === "placaveiculo"
                        ? "ABC1D23 ou ABC1234"
                        : normalizeFieldKey(key) === "chassiveiculo"
                          ? "9BWZZZ377VT004251"
                          : undefined
                }
                maxLength={
                  normalizeFieldKey(key).includes("cpfcnpj") ||
                  (selectedConfig.key === "clientes" && formMode === "create" && normalizeFieldKey(key) === "cpf")
                    ? 18
                    : normalizeFieldKey(key).includes("cpf")
                      ? 14
                    : normalizeFieldKey(key) === "cep"
                      ? 9
                      : normalizeFieldKey(key) === "placaveiculo"
                        ? 7
                        : normalizeFieldKey(key) === "chassiveiculo"
                          ? 17
                          : normalizeFieldKey(key) === "seguro"
                            ? 100
                            : normalizeFieldKey(key) === "ean"
                              ? 13
                            : normalizeFieldKey(key) === "tempodec"
                              ? 5
                            : undefined
                }
                pattern={
                  normalizeFieldKey(key) === "placaveiculo"
                    ? "(?:[A-Z]{3}[0-9][A-Z][0-9]{2}|[A-Z]{3}[0-9]{4})"
                    : normalizeFieldKey(key) === "chassiveiculo"
                      ? "[A-HJ-NPR-Z0-9]{17}"
                      : normalizeFieldKey(key) === "seguro"
                        ? "[0-9]{0,100}"
                      : normalizeFieldKey(key) === "tempodec"
                        ? "[0-9]{2}:(?:[0-5][0-9]|60)"
                        : undefined
                }
                inputMode={
                  ["valor", "valorunitario"].includes(normalizeFieldKey(key))
                    ? "decimal"
                    : ["ean", "seguro", "tempodec"].includes(normalizeFieldKey(key))
                      ? "numeric"
                    : normalizeFieldKey(key).includes("cpf") ||
                        normalizeFieldKey(key).includes("cnpj") ||
                        normalizeFieldKey(key) === "cep"
                      ? "numeric"
                      : undefined
                }
                max={
                  normalizeFieldKey(key) === "datanasc"
                    ? "9999-12-31"
                    : normalizeFieldKey(key) === "quilometragem"
                      ? 9999999
                      : undefined
                }
                min={normalizeFieldKey(key) === "quilometragem" ? 0 : undefined}
                step={
                  ["valor", "valorunitario"].includes(normalizeFieldKey(key))
                    ? "0.01"
                    : undefined
                }
                onChange={(event) =>
                  handleFieldChange(fieldPath, templateValue, event.target.value)
                }

              />
              {selectedConfig.key === "funcionarios" && normalizeFieldKey(key) === "senha" && formMode === "edit" ? (
                <p className="mt-2 text-xs font-bold text-amber-700">Ao preencher este campo, a senha atual do funcionário será redefinida.</p>
              ) : null}
              {editableFieldOptions ? (
                <datalist id={editableOptionsId}>
                  {editableFieldOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              ) : null}
            </>
          )}
        </label>
      );
    });
  };

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

  const displayColumns =
    tableColumnsByEntity[selectedConfig.key] ??
    getDisplayKeys(selectedConfig.template, selectedConfig.key).map((key) => ({
      key,
      label: formatFieldLabel(key),
    }));
  const filterDefinitions = managementFiltersByEntity[selectedConfig.key] ?? [];
  const normalizeFilterText = (value: unknown) =>
    String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const matchesFilterFields = (item: FormValue, fields: string[], query: string) =>
    fields.some((field) => normalizeFilterText(getRecordValue(item, field)).includes(normalizeFilterText(query)));

  const filteredItems = items.filter((item) => {
    const globalQuery = normalizeFilterText(searchTerm.trim());
    const matchesGlobalSearch =
      !globalQuery ||
      Object.keys(selectedConfig.template).some((key) =>
        normalizeFilterText(
          formatValue(key, getRecordValue(item, key) ?? item[key], relationOptions)
        ).includes(globalQuery)
      );
    if (!matchesGlobalSearch) return false;
    return filterDefinitions.every((filter) => {
      const query = String(filterValues[filter.key] ?? "").trim();
      if (!query) return true;
      if (filter.fields?.length) {
        if (["id", "year"].includes(filter.key)) {
          return filter.fields.some((field) => String(getRecordValue(item, field) ?? "") === query);
        }
        return matchesFilterFields(item, filter.fields, query);
      }

      if (filter.key === "phone") {
        const phones = getRecordValue(item, "Telefones");
        return (Array.isArray(phones) ? phones : []).some((phone) => {
          if (!isPlainObject(phone)) return false;
          return onlyDigits(`${getRecordValue(phone, "DDD") ?? ""}${getRecordValue(phone, "Numero") ?? ""}`).includes(onlyDigits(query));
        });
      }
      if (filter.key === "situation") {
        if (selectedConfig.key === "clientes") {
          const linkValue = getRecordValue(item, "VinculoAtivo");
          const isActive =
            linkValue === true ||
            String(linkValue ?? "").trim().toLowerCase() === "true" ||
            String(linkValue ?? "").trim() === "1";
          return query === (isActive ? "1" : "2");
        }
        return String(getRecordValue(item, "Situacao") ?? getRecordValue(item, "Status") ?? "") === query;
      }
      if (filter.key === "owner") {
        return normalizeFilterText(findRelationLabel(relationOptions, "ClienteId", getRecordValue(item, "ClienteId"))).includes(normalizeFilterText(query));
      }
      if (filter.key === "brand") {
        return normalizeFilterText(findRelationLabel(relationOptions, "IdMarca", getRecordValue(item, "IdMarca"))).includes(normalizeFilterText(query));
      }
      if (filter.key === "stock") {
        const stock = Number(getRecordValue(item, "quantidadeEstoque") ?? getRecordValue(item, "Quantidade_Estoque") ?? 0);
        return query === "with" ? stock > 0 : stock <= 0;
      }
      if (filter.key === "serviceEmployee") {
        const connections = getRecordValue(item, "Funcionario_Servicos") ?? getRecordValue(item, "FuncionarioServicos");
        return (Array.isArray(connections) ? connections : []).some((connection) =>
          isPlainObject(connection) && normalizeFilterText(
            findRelationLabel(relationOptions, "IdFuncionario", getRecordValue(connection, "IdFuncionario"))
          ).includes(normalizeFilterText(query))
        );
      }
      if (filter.key === "client") {
        return normalizeFilterText(findRelationLabel(relationOptions, "idCliente", getRecordValue(item, "idCliente"))).includes(normalizeFilterText(query));
      }
      if (filter.key === "employee") {
        return normalizeFilterText(findRelationLabel(relationOptions, "idFuncionario", getRecordValue(item, "idFuncionario"))).includes(normalizeFilterText(query));
      }
      if (filter.key === "vehicle") {
        const vehicleId = getRecordValue(item, "idVeiculo");
        const option = (relationOptions.veiculos ?? []).find((candidate) => String(candidate.value) === String(vehicleId));
        const searchable = option?.item
          ? `${option.label} ${getRecordValue(option.item, "PlacaVeiculo") ?? ""}`
          : option?.label ?? "";
        return normalizeFilterText(searchable).includes(normalizeFilterText(query));
      }
      if (filter.key === "orderStatus") return String(getRecordValue(item, "Status") ?? "") === query;
      if (filter.key === "startDate") return String(getRecordValue(item, "DataInicio") ?? "").slice(0, 10) === query;
      if (filter.key === "endDate") return String(getRecordValue(item, "DataFim") ?? "").slice(0, 10) === query;
      if (filter.key === "value") return Number(getRecordValue(item, "ValorTotal")) === Number(query);
      return true;
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
    <ProtectedRoute allowedRoles={["oficina", "funcionario"]}>
      <div className="sigo-page">
      <NavBar />
      <main className="sigo-shell sigo-dashboard-shell sigo-management-shell grid gap-7 py-8 lg:grid-cols-[310px_minmax(0,1fr)] lg:items-start">
        <DashboardSidebar
          activeEntity={selectedConfig?.key}
          availableEntities={entities.map((config) => config.key)}
          onEntitySelect={selectEntity}
        />
        <div className="min-w-0">
          <section className="sigo-card overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-[var(--sigo-border)] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="mb-1 text-sm font-black uppercase tracking-[0.12em] text-[var(--sigo-blue)]">
                  {selectedConfig.label}
                </p>
                <h2 className="text-xl font-extrabold text-[var(--sigo-text)]">
                  {filteredItems.length} de {items.length} registro(s).
                </h2>
              </div>
              {canCreateSelected ? (
                <button
                  type="button"
                  className="sigo-button sigo-button-primary !rounded-[2px]"
                  onClick={openCreateForm}
                >
                  <img
                    src="/mais.png"
                    alt=""
                    aria-hidden="true"
                    className="h-4 w-4 object-contain brightness-0 invert"
                  />
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

              <div className="mb-4 grid gap-3 rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <label className="sigo-label min-w-0">
                  <span>Pesquisar registros</span>
                  <input
                    className="sigo-input bg-white"
                    type="search"
                    value={searchTerm}
                    placeholder={`Buscar em ${selectedConfig.label.toLowerCase()}`}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="sigo-button min-h-[46px] min-w-40 bg-white text-[var(--sigo-muted)]"
                  onClick={() => setFiltersModalOpen(true)}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-5 w-5 fill-none stroke-slate-500"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 5h16l-6 7v5l-4 2v-7L4 5Z" />
                  </svg>
                  Filtros
                  {Object.values(filterValues).filter(Boolean).length > 0 ? (
                    <span className="sigo-badge ml-1">
                      {Object.values(filterValues).filter(Boolean).length}
                    </span>
                  ) : null}
                </button>
              </div>
              <div className="h-[27.5rem] overflow-hidden">
                {showLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <SigoLoader key={loadingCycle} compact />
                  </div>
                ) : filteredItems.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-[var(--sigo-border-strong)] bg-[var(--sigo-surface-soft)] px-5 py-10 text-center">
                  <p className="text-sm font-bold text-[var(--sigo-muted)]">
                    Nenhum registro encontrado.
                  </p>
                </div>
              ) : (
                <div className="sigo-scrollbar h-full overflow-auto rounded-lg border border-[var(--sigo-border)]">
                  <table className="sigo-table sigo-management-table h-full min-w-[980px] table-auto">
                    <thead>
                      <tr>
                        {displayColumns.map((column) => (
                          <th key={column.key} className="whitespace-nowrap">
                            {column.label}
                          </th>
                        ))}
                        <th className={`${selectedConfig.key === "pedidos" ? "w-32" : "w-24"} whitespace-nowrap text-center`}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((item, index) => {
                        const id = getItemId(item);
                        const rowIndex = pageStartIndex + index;
                        const clientLinkActive =
                          selectedConfig.key !== "clientes" || isClientOfficeLinkActive(item);
                        return (
                          <tr
                            className="h-10 cursor-pointer"
                            key={`${selectedConfig.key}-${id ?? rowIndex}`}
                            role="button"
                            tabIndex={0}
                            title="Visualizar registro"
                            onClick={() => handleEdit(item, "view")}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                void handleEdit(item, "view");
                              }
                            }}
                          >
                            {displayColumns.map((column) => {
                              const storedValue =
                                getRecordValue(item, column.key) ?? item[column.key];
                              const rawValue =
                                selectedConfig.key === "pecas" &&
                                normalizeFieldKey(column.key) === "quantidade"
                                  ? (() => {
                                      const stock = Number(
                                        getRecordValue(item, "quantidadeEstoque") ??
                                          getRecordValue(item, "Quantidade_Estoque")
                                      );
                                      const unit = Number(getRecordValue(item, "Unidade"));
                                      return Number.isFinite(stock) &&
                                        Number.isFinite(unit) &&
                                        unit > 0
                                        ? Math.floor(stock / unit)
                                        : storedValue;
                                    })()
                                  : storedValue;

                              if (column.status) {
                                const status = statusPresentation(rawValue, column.status);
                                return (
                                  <td key={`${column.key}-${rowIndex}`} className="whitespace-nowrap">
                                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${status.className}`}>
                                      {status.label}
                                    </span>
                                  </td>
                                );
                              }

                              const relatedVehicle =
                                selectedConfig.key === "pedidos" && column.label === "Placa"
                                  ? (relationOptions.veiculos ?? []).find(
                                      (option) => String(option.value) === String(rawValue)
                                    )?.item
                                  : undefined;
                              const value =
                                selectedConfig.key === "pedidos" && column.label === "Placa"
                                  ? String(
                                      relatedVehicle
                                        ? getRecordValue(relatedVehicle, "PlacaVeiculo") ?? "-"
                                        : "-"
                                    )
                                  : column.relationKey
                                ? findRelationLabel(
                                    relationOptions,
                                    column.relationKey,
                                    rawValue
                                  )
                                : column.currency
                                  ? currencyFormatter.format(Number(rawValue) || 0)
                                  : formatValue(
                                      column.key,
                                      rawValue,
                                      relationOptions
                                    );

                              return (
                                <td key={`${column.key}-${rowIndex}`} className="whitespace-nowrap">
                                  {value}
                                </td>
                              );
                            })}
                            <td
                              className={`${selectedConfig.key === "pedidos" ? "w-32" : "w-24"} whitespace-nowrap`}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              <div className={`flex ${selectedConfig.key === "pedidos" ? "w-32" : "w-24"} flex-nowrap items-center justify-center gap-1`}>
                                {selectedConfig.key === "pecas" && selectedCapability?.canUpdate ? (
                                  <button
                                    type="button"
                                    className="flex h-7 w-7 items-center justify-center rounded-md bg-transparent p-0.5 hover:bg-blue-50 disabled:opacity-50"
                                    disabled={!id}
                                    title="Ajustar quantidade do estoque"
                                    aria-label="Ajustar quantidade do estoque"
                                    onClick={() => void openStockAdjustment(item)}
                                  >
                                    <img
                                      src="/mais.png"
                                      alt=""
                                      className="sigo-record-add-icon h-5 w-5 object-contain"
                                    />
                                  </button>
                                ) : null}
                                {selectedConfig.key === "pedidos" && selectedCapability?.canUpdate ? (
                                  <button
                                    type="button"
                                    className="flex h-7 w-7 items-center justify-center rounded-md bg-transparent p-0.5 hover:bg-blue-50 disabled:opacity-50"
                                    disabled={!id}
                                    title="Alterar status"
                                    aria-label="Alterar status do pedido"
                                    onClick={() => openOrderStatusModal(item)}
                                  >
                                    <img
                                      src="/refresh.png"
                                      alt=""
                                      aria-hidden="true"
                                      className="h-5 w-5 object-contain"
                                      style={{
                                        filter:
                                          "brightness(0) saturate(100%) invert(55%) sepia(87%) saturate(1718%) hue-rotate(118deg) brightness(91%) contrast(101%)",
                                      }}
                                    />
                                  </button>
                                ) : null}
                                <button
                                  hidden={!clientLinkActive}
                                  type="button"
                                  className="flex h-7 w-7 items-center justify-center rounded-md bg-transparent p-0.5 hover:bg-[var(--sigo-surface-soft)] disabled:opacity-50"
                                  disabled={!id}
                                  title={selectedCapability?.canUpdate ? "Editar" : "Ver"}
                                  aria-label={selectedCapability?.canUpdate ? "Editar" : "Ver"}
                                  onClick={() =>
                                    handleEdit(
                                      item,
                                      selectedCapability?.canUpdate
                                        ? "edit"
                                        : "view"
                                    )
                                  }
                                >
                                  <img
                                    src="/pencil.png"
                                    alt=""
                                    className="h-5 w-5 object-contain"
                                  />
                                </button>
                                {selectedCapability?.canDelete ? (
                                  <button
                                    hidden={!clientLinkActive}
                                      type="button"
                                      className="flex h-7 w-7 items-center justify-center rounded-md bg-transparent p-0.5 hover:bg-red-50 disabled:opacity-50"
                                    disabled={!selectedConfig.deletePath || !id}
                                    title={getDeleteActionLabel(selectedConfig.key)}
                                    aria-label={getDeleteActionLabel(selectedConfig.key)}
                                    onClick={() => id && setPendingDeleteId(id)}
                                  >
                                    <img
                                      src={
                                        getDeleteActionLabel(selectedConfig.key) === "Inativar"
                                          ? "/fechar.png"
                                          : "/delete.png"
                                      }
                                      alt=""
                                      className={`h-5 w-5 object-contain ${
                                        getDeleteActionLabel(selectedConfig.key) === "Inativar"
                                          ? "brightness-0 saturate-100 [filter:invert(16%)_sepia(98%)_saturate(7046%)_hue-rotate(359deg)_brightness(101%)_contrast(117%)]"
                                          : ""
                                      }`}
                                    />
                                  </button>
                                ) : (
                                  <span className="h-7 w-7" aria-hidden="true" />
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {Array.from({
                        length: Math.max(0, PAGE_SIZE - paginatedItems.length),
                      }).map((_, index) => (
                        <tr
                          key={`empty-${normalizedPage}-${index}`}
                          className="h-10"
                          aria-hidden="true"
                        >
                          <td
                            colSpan={displayColumns.length + 1}
                            className="bg-white"
                          >
                            &nbsp;
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )}
              </div>

                <div
                  className={`mt-4 flex min-h-[3.75rem] flex-col gap-3 rounded-lg border border-[var(--sigo-border)] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                    showLoading ? "invisible" : ""
                  }`}
                  aria-hidden={showLoading}
                >
                  <p className="text-sm font-semibold text-[var(--sigo-muted)]">
                    Mostrando {filteredItems.length > 0 ? pageStartIndex + 1 : 0}-
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
                      Página {normalizedPage} de {totalPages}
                    </span>
                    <button
                      type="button"
                      className="sigo-button min-h-9 px-3 text-xs"
                      disabled={normalizedPage >= totalPages}
                      onClick={() =>
                        setCurrentPage((page) => Math.min(totalPages, page + 1))
                      }
                    >
                      Próxima
                    </button>
                  </div>
                </div>
            </div>
          </section>
        </div>
      </main>

      {filtersModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4">
          <div
            className="sigo-card flex max-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col overflow-hidden bg-white"
            role="dialog"
            aria-modal="true"
            aria-labelledby="management-filters-title"
          >
            <div className="flex shrink-0 items-center justify-between gap-4 bg-[linear-gradient(135deg,var(--sigo-blue-deep),var(--sigo-blue))] px-5 py-4 text-white">
              <div>
                <h2 id="management-filters-title" className="mt-1 text-xl font-black text-white">
                  Filtros de {selectedConfig.label}
                </h2>
              </div>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center text-xl font-black text-white"
                aria-label="Fechar filtros"
                onClick={() => setFiltersModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="sigo-scrollbar grid flex-1 gap-4 overflow-y-auto bg-white p-5 sm:grid-cols-2">
              {filterDefinitions.map((filter) => (
                <label key={filter.key} className="sigo-label min-w-0">
                  <span>{filter.label}</span>
                  {filter.type === "select" ? (
                    <select
                      className="sigo-input bg-white"
                      value={filterValues[filter.key] ?? ""}
                      onChange={(event) =>
                        setFilterValues((current) => ({
                          ...current,
                          [filter.key]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Todos</option>
                      {(filter.options ?? []).map((option) => (
                        <option key={String(option.value)} value={String(option.value)}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="sigo-input bg-white"
                      type={filter.type ?? "search"}
                      step={filter.key === "value" ? "0.01" : undefined}
                      min={filter.type === "number" ? "0" : undefined}
                      value={filterValues[filter.key] ?? ""}
                      placeholder={`Filtrar por ${filter.label.toLowerCase()}`}
                      onChange={(event) =>
                        setFilterValues((current) => ({
                          ...current,
                          [filter.key]: event.target.value,
                        }))
                      }
                    />
                  )}
                </label>
              ))}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-[var(--sigo-border)] bg-white px-5 py-4">
              <button
                type="button"
                className="sigo-button border-0 bg-transparent text-red-600 shadow-none"
                onClick={() => setFiltersModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="sigo-button bg-white text-[var(--sigo-blue)]"
                disabled={!Object.values(filterValues).some(Boolean)}
                onClick={() => setFilterValues({})}
              >
                Limpar filtros
              </button>
              <button
                type="button"
                className="sigo-button sigo-button-primary"
                onClick={() => setFiltersModalOpen(false)}
              >
                Aplicar filtros
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/60 p-4">
          <div className="sigo-card flex max-h-[calc(100vh-5rem)] w-full max-w-3xl flex-col overflow-hidden">
            <div className="shrink-0 flex flex-col gap-3 bg-[linear-gradient(135deg,var(--sigo-blue-deep),var(--sigo-blue))] px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-white">
                  {formMode === "view"
                    ? `Ver ${selectedConfig.label}`
                    : formMode === "edit"
                      ? `Editar ${selectedConfig.label}`
                      : `Criar ${selectedConfig.label}`}
                </h2>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-md bg-transparent text-2xl font-black leading-none text-white hover:bg-white/10"
                onClick={() => setShowForm(false)}
                aria-label="Fechar formulário"
                title="Fechar"
              >
                ×
              </button>
            </div>

            <div className="sigo-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
              <div className="rounded-lg border border-[var(--sigo-border)] bg-white p-4">
                <div className="grid gap-4 md:grid-cols-2">
                {renderFields(
                  formMode === "create"
                    ? getCreateTemplate(selectedConfig)
                    : selectedConfig.template,
                  formData
                )}
                </div>
                {renderImageField()}
              </div>

              {error ? (
                <div className="sigo-error mt-5 px-4 py-3 text-sm font-semibold">
                  {error}
                </div>
              ) : null}
            </div>

              <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-[var(--sigo-border)] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  className={`sigo-button !border-transparent !bg-transparent shadow-none ${
                    formMode === "view"
                      ? ""
                      : "!text-red-600 hover:!bg-red-50"
                  }`}
                  onClick={() => setShowForm(false)}
                >
                  {formMode === "view" ? "Fechar" : "Cancelar"}
                </button>
                {formMode !== "view" ? (
                  <button
                    type="button"
                    className={`sigo-button !rounded-[2px] ${
                      formMode === "create"
                        ? "sigo-modal-create-button !border-emerald-600 !bg-emerald-600 text-white hover:!bg-emerald-700"
                        : "sigo-button-primary"
                    }`}
                    disabled={
                      isLoading ||
                      (formMode === "edit" && !selectedConfig.updatePath)
                    }
                    onClick={formMode === "edit" ? handleUpdate : handleCreate}
                  >
                    {formMode === "create" && !isLoading ? (
                      <img
                        src="/mais.png"
                        alt=""
                        aria-hidden="true"
                        className="h-4 w-4 object-contain brightness-0 invert"
                      />
                    ) : null}
                    {formMode === "create" ? (
                      <span className="sigo-modal-create-label">
                        {isLoading ? "Salvando..." : "Criar"}
                      </span>
                    ) : isLoading ? (
                      "Salvando..."
                    ) : (
                      "Salvar alterações"
                    )}
                  </button>
                ) : null}
              </div>
          </div>
        </div>
      ) : null}
      {stockAdjustmentItem ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="sigo-card w-full max-w-md overflow-hidden bg-white">
            <div className="flex items-center justify-between bg-[linear-gradient(135deg,var(--sigo-blue-deep),var(--sigo-blue))] px-5 py-4 text-white">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/75">Estoque</p>
                <h2 className="mt-1 text-lg font-black text-white">
                  {String(getRecordValue(stockAdjustmentItem, "Nome") ?? "Peça")}
                </h2>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center bg-transparent text-2xl font-black text-white hover:bg-white/10"
                onClick={() => {
                  setStockAdjustmentItem(null);
                  setError(null);
                }}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="grid gap-4 p-5">
              <div className="rounded-sm border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-4">
                <p className="text-xs font-bold text-[var(--sigo-muted)]">Quantidade no estoque</p>
                <p className="mt-1 text-3xl font-black text-[var(--sigo-blue-deep)]">
                  {Math.floor(
                    Math.max(
                      0,
                      Number(
                        getRecordValue(stockAdjustmentItem, "quantidadeEstoque") ??
                          getRecordValue(stockAdjustmentItem, "Quantidade_Estoque") ??
                          0
                      )
                    ) /
                      Math.max(1, Math.floor(Number(getRecordValue(stockAdjustmentItem, "Unidade")) || 1))
                  )}
                </p>
              </div>
              <label className="sigo-label">
                <span>Quantidade para ajustar</span>
                <input
                  className="sigo-input"
                  type="number"
                  min="1"
                  step="1"
                  value={stockAdjustmentAmount}
                  onChange={(event) => setStockAdjustmentAmount(Number(event.target.value))}
                />
              </label>
              {error ? <div className="sigo-error px-4 py-3 text-sm font-semibold">{error}</div> : null}
            </div>
            <div className="flex justify-end gap-3 border-t border-[var(--sigo-border)] bg-white px-5 py-4">
              <button
                type="button"
                className="sigo-button !border-red-200 !text-red-600 hover:!bg-red-50"
                disabled={stockAdjustmentSaving}
                onClick={() => void handleStockAdjustment("subtract")}
              >
                Diminuir
              </button>
              <button
                type="button"
                className="sigo-button sigo-button-primary"
                disabled={stockAdjustmentSaving}
                onClick={() => void handleStockAdjustment("add")}
              >
                <img src="/mais.png" alt="" aria-hidden="true" className="h-4 w-4 brightness-0 invert" />
                {stockAdjustmentSaving ? "Salvando..." : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {statusOrderItem ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="order-status-title">
          <div className="sigo-card w-full max-w-md overflow-hidden bg-white">
            <header className="flex items-center justify-between bg-[linear-gradient(135deg,var(--sigo-blue-deep),var(--sigo-blue))] px-5 py-4 text-white">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/75">Pedido #{getItemId(statusOrderItem)}</p>
                <h2 id="order-status-title" className="mt-1 text-lg font-black text-white">Alterar status</h2>
              </div>
              <button type="button" className="flex h-9 w-9 items-center justify-center bg-transparent text-2xl font-black text-white hover:bg-white/10" onClick={() => setStatusOrderItem(null)} aria-label="Fechar">×</button>
            </header>
            <div className="grid gap-4 p-5">
              <label className="sigo-label">
                <span>Novo status</span>
                <select className="sigo-input bg-white" value={nextOrderStatus} onChange={(event) => setNextOrderStatus(Number(event.target.value))}>
                  {workflowStatusOptions.map((option) => <option key={String(option.value)} value={Number(option.value)}>{option.label}</option>)}
                </select>
              </label>
              {error ? <div className="sigo-error px-4 py-3 text-sm font-semibold">{error}</div> : null}
            </div>
            <footer className="flex justify-end gap-3 border-t border-[var(--sigo-border)] bg-white p-4">
              <button type="button" className="sigo-button !border-transparent !bg-transparent !text-red-600 shadow-none hover:!bg-red-50" disabled={statusSaving} onClick={() => setStatusOrderItem(null)}>Cancelar</button>
              <button type="button" className="sigo-button sigo-button-primary" disabled={statusSaving} onClick={() => void handleOrderStatusUpdate()}>
                <img src="/refresh.png" alt="" aria-hidden="true" className="h-4 w-4 object-contain brightness-0 invert" />
                {statusSaving ? "Atualizando..." : "Atualizar status"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
      {pendingDeleteId ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="sigo-card w-full max-w-md overflow-hidden bg-white">
            <header className="bg-[linear-gradient(135deg,var(--sigo-blue-deep),var(--sigo-blue))] px-5 py-4 text-white">
              <h2 className="text-lg font-black text-white">Confirmar ação</h2>
            </header>
            <div className="p-5 text-sm font-semibold text-[var(--sigo-text)]">
              Deseja realmente {getDeleteActionLabel(selectedConfig.key).toLowerCase()} este registro? Esta ação pode não ser reversível.
            </div>
            <footer className="flex justify-end gap-3 border-t border-[var(--sigo-border)] p-4">
              <button type="button" className="sigo-button" onClick={() => setPendingDeleteId(null)}>Cancelar</button>
              <button type="button" className="sigo-button !border-red-600 !bg-red-600 !text-white" onClick={() => void handleDelete(pendingDeleteId)}>Confirmar</button>
            </footer>
          </div>
        </div>
      ) : null}
      </div>
    </ProtectedRoute>
  );
}
