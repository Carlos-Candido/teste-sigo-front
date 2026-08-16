import { isValidEmail, validateNewPassword } from "@/lib/auth-api";
import { onlyDigits } from "@/lib/fieldMetadata";

export const clientTypes = {
  individual: "fisico",
  company: "juridico",
} as const;

export type ClientType = (typeof clientTypes)[keyof typeof clientTypes];

export type RegistrationAddress = {
  number: string;
  street: string;
  city: string;
  postalCode: string;
  district: string;
  state: string;
  country: string;
  complement: string;
};

export type ClientRegistrationForm = RegistrationAddress & {
  clientType: ClientType;
  name: string;
  email: string;
  password: string;
  document: string;
  phone: string;
  observation: string;
  corporateName: string;
  birthDate: string;
  gender: string;
};

export type OfficeRegistrationForm = RegistrationAddress & {
  name: string;
  email: string;
  password: string;
  document: string;
};

export type RegistrationErrors<T> = Partial<Record<keyof T, string>>;

const createAddress = (): RegistrationAddress => ({
  number: "",
  street: "",
  city: "",
  postalCode: "",
  district: "",
  state: "",
  country: "Brasil",
  complement: "",
});

export const createClientRegistrationForm = (): ClientRegistrationForm => ({
  ...createAddress(),
  clientType: clientTypes.individual,
  name: "",
  email: "",
  password: "",
  document: "",
  phone: "",
  observation: "",
  corporateName: "",
  birthDate: "",
  gender: "",
});

export const createOfficeRegistrationForm = (): OfficeRegistrationForm => ({
  ...createAddress(),
  name: "",
  email: "",
  password: "",
  document: "",
});

const hasRepeatedDigits = (value: string): boolean => /^(\d)\1+$/.test(value);

export const isValidCpf = (value: string): boolean => {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || hasRepeatedDigits(digits)) return false;

  const calculateDigit = (length: number): number => {
    const sum = digits
      .slice(0, length)
      .split("")
      .reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(9) === Number(digits[9]) && calculateDigit(10) === Number(digits[10]);
};

export const isValidCnpj = (value: string): boolean => {
  const digits = onlyDigits(value);
  if (digits.length !== 14 || hasRepeatedDigits(digits)) return false;

  const calculateDigit = (length: 12 | 13): number => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = digits
      .slice(0, length)
      .split("")
      .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return calculateDigit(12) === Number(digits[12]) && calculateDigit(13) === Number(digits[13]);
};

const validateAddress = <T extends RegistrationAddress>(
  form: T,
  errors: RegistrationErrors<T>
): void => {
  if (!form.number.trim() || !/^\d+$/.test(form.number)) {
    errors.number = "Informe um número de endereço válido.";
  }
  if (!form.street.trim()) errors.street = "Informe a rua.";
  if (!form.city.trim()) errors.city = "Informe a cidade.";
  if (onlyDigits(form.postalCode).length !== 8) {
    errors.postalCode = "Informe um CEP com 8 dígitos.";
  }
  if (!form.district.trim()) errors.district = "Informe o bairro.";
  if (!form.state) errors.state = "Selecione o estado.";
};

const validateIdentity = <T extends { name: string; email: string; password: string }>(
  form: T,
  errors: RegistrationErrors<T>
): void => {
  if (!form.name.trim() || form.name.trim().length > 100) {
    errors.name = "Informe um nome com até 100 caracteres.";
  }
  if (!isValidEmail(form.email) || form.email.trim().length > 254) {
    errors.email = "Informe um e-mail válido.";
  }
  const passwordError = validateNewPassword(form.password);
  if (passwordError) {
    errors.password = form.password ? passwordError : "Informe a senha.";
  }
};

export const validateClientRegistration = (
  form: ClientRegistrationForm
): RegistrationErrors<ClientRegistrationForm> => {
  const errors: RegistrationErrors<ClientRegistrationForm> = {};
  validateIdentity(form, errors);
  validateAddress(form, errors);

  const isCompany = form.clientType === clientTypes.company;
  if (isCompany ? !isValidCnpj(form.document) : !isValidCpf(form.document)) {
    errors.document = `Informe um ${isCompany ? "CNPJ" : "CPF"} válido.`;
  }
  if (isCompany && !form.corporateName.trim()) {
    errors.corporateName = "Informe a razão social.";
  }

  const phoneDigits = onlyDigits(form.phone);
  if (phoneDigits && ![10, 11].includes(phoneDigits.length)) {
    errors.phone = "Informe DDD e um telefone com 8 ou 9 dígitos.";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.birthDate)) {
    errors.birthDate = "Informe a data de nascimento.";
  } else if (form.birthDate > getTodayIso()) {
    errors.birthDate = "A data de nascimento não pode estar no futuro.";
  }
  if (!form.gender) errors.gender = "Selecione o sexo.";

  return errors;
};

export const validateOfficeRegistration = (
  form: OfficeRegistrationForm
): RegistrationErrors<OfficeRegistrationForm> => {
  const errors: RegistrationErrors<OfficeRegistrationForm> = {};
  validateIdentity(form, errors);
  validateAddress(form, errors);
  if (!isValidCnpj(form.document)) errors.document = "Informe um CNPJ válido.";
  return errors;
};

export const changeClientType = (
  form: ClientRegistrationForm,
  clientType: ClientType
): ClientRegistrationForm => ({
  ...form,
  clientType,
  document: "",
  observation: clientType === clientTypes.company ? "" : form.observation,
  corporateName: clientType === clientTypes.individual ? "" : form.corporateName,
});

export const buildClientRegistrationPayload = (form: ClientRegistrationForm) => ({
  cpf_Cnpj: onlyDigits(form.document),
  nome: form.name.trim(),
  email: form.email.trim().toLowerCase(),
  senha: form.password,
});

export const buildClientProfilePayload = (
  form: ClientRegistrationForm,
  clientId: number
) => {
  const phoneDigits = onlyDigits(form.phone);
  const typeSpecificFields = form.clientType === clientTypes.company
    ? { razao: form.corporateName.trim() }
    : { obs: form.observation.trim() };

  return {
    nome: form.name.trim(),
    email: form.email.trim().toLowerCase(),
    cpf_Cnpj: onlyDigits(form.document),
    dataNasc: form.birthDate,
    numero: Number(form.number),
    rua: form.street.trim(),
    cidade: form.city.trim(),
    cep: onlyDigits(form.postalCode),
    bairro: form.district.trim(),
    estado: form.state,
    pais: "Brasil",
    complemento: form.complement.trim(),
    sexo: Number(form.gender),
    tipoCliente: form.clientType === clientTypes.company ? 2 : 1,
    telefones: phoneDigits
      ? [{
          id: 0,
          numero: phoneDigits.slice(2),
          ddd: Number(phoneDigits.slice(0, 2)),
          clienteId: clientId,
        }]
      : [],
    senha: "",
    ...typeSpecificFields,
  };
};

export const buildOfficeRegistrationPayload = (form: OfficeRegistrationForm) => ({
  nome: form.name.trim(),
  cnpj: onlyDigits(form.document),
  email: form.email.trim().toLowerCase(),
  numero: Number(form.number),
  rua: form.street.trim(),
  cidade: form.city.trim(),
  cep: Number(onlyDigits(form.postalCode)),
  bairro: form.district.trim(),
  estado: form.state,
  pais: "Brasil",
  complemento: form.complement.trim(),
  senha: form.password,
  situacao: 1,
});

export const extractAccessToken = (data: unknown): string => {
  if (typeof data === "string") return data.trim().replace(/^Bearer\s+/i, "");
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;
  for (const key of ["accessToken", "AccessToken", "token", "Token"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().replace(/^Bearer\s+/i, "");
    }
  }
  return extractAccessToken(record.data) || extractAccessToken(record.Data);
};

export const extractClientId = (data: unknown): number | null => {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  for (const key of ["clienteId", "ClienteId", "id", "Id"]) {
    const parsed = Number(record[key]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return extractClientId(record.data) ?? extractClientId(record.Data);
};

export const extractRegistrationError = (data: unknown, fallback: string): string => {
  if (typeof data === "string" && data.trim()) return data;
  if (!data || typeof data !== "object") return fallback;
  const record = data as Record<string, unknown>;
  const errors = record.errors ?? record.Errors;
  if (errors && typeof errors === "object") {
    const messages = Object.values(errors as Record<string, unknown>).flatMap((value) => {
      if (typeof value === "string" && value.trim()) return [value];
      if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
      }
      return [];
    });
    if (messages.length) return messages.join(" | ");
  }
  for (const key of ["detail", "message", "Message", "title"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return extractRegistrationError(record.data, fallback) || extractRegistrationError(record.Data, fallback);
};

export const getTodayIso = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
