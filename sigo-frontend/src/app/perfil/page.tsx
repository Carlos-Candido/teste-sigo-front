"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardTabs } from "@/components/Dashboard/DashboardTabs";
import { NavBar } from "@/components/Sidebar/NavBar";
import { ProtectedRoute } from "@/components/Auth/RouteGuards";
import { useAuth } from "@/hooks/useAuth";
import { fetchJson } from "@/lib/api";
import { fetchCepAddress } from "@/lib/cep";
import {
  getProfileEditableFields,
  getProfileEntityKey,
  isAllowedField,
  normalizeRole,
} from "@/lib/accessControl";
import {
  formatCep,
  formatCpfCnpj,
  formatDdd,
  formatPhone,
  getEnumOptions,
  isOwnIdField,
  isStateField,
  maskFieldValue,
  normalizeFieldKey,
  normalizeSubmitValue,
  onlyDigits,
  stateOptions,
  type SelectOption,
} from "@/lib/fieldMetadata";
import { entityConfigs } from "@/models/entityConfigs";
import { routes } from "@/navigation/routes";

type FormValue = Record<string, unknown>;

const fieldLabels: Record<string, string> = {
  nome: "Nome",
  email: "Email",
  senha: "Senha",
  cargo: "Cargo",
  obs: "Observacao",
  razao: "Razao social",
  datanasc: "Data de nascimento",
  numero: "Numero",
  rua: "Rua",
  cidade: "Cidade",
  cep: "CEP",
  bairro: "Bairro",
  estado: "Estado",
  pais: "Pais",
  complemento: "Complemento",
  sexo: "Sexo",
  tipocliente: "Tipo de cliente",
  telefones: "Telefones",
  ddd: "DDD",
};

const isPlainObject = (value: unknown): value is FormValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cloneTemplate = (value: FormValue): FormValue =>
  JSON.parse(JSON.stringify(value)) as FormValue;

const getRecordValue = (record: FormValue, key: string): unknown => {
  if (key in record) return record[key];
  const normalized = normalizeFieldKey(key);
  const matchedKey = Object.keys(record).find(
    (candidate) => normalizeFieldKey(candidate) === normalized
  );
  return matchedKey ? record[matchedKey] : undefined;
};

const getRecordId = (record: FormValue): number | null => {
  const raw =
    getRecordValue(record, "Id") ??
    getRecordValue(record, "id") ??
    getRecordValue(record, "ID");
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const extractList = (data: unknown): FormValue[] => {
  if (Array.isArray(data)) return data as FormValue[];
  if (isPlainObject(data)) {
    const nested = data.Data ?? data.data ?? data.items ?? data.result;
    if (Array.isArray(nested)) return nested as FormValue[];
    if (isPlainObject(nested) && Array.isArray(nested.items)) {
      return nested.items as FormValue[];
    }
  }
  return [];
};

const extractRecord = (data: unknown): FormValue | null => {
  if (isPlainObject(data)) {
    const nested = data.Data ?? data.data ?? data.result ?? data.item;
    if (isPlainObject(nested)) return nested;
    return data;
  }
  return extractList(data)[0] ?? null;
};

const mergeWithTemplate = (template: unknown, value: unknown): unknown => {
  if (Array.isArray(template)) {
    const itemTemplate = template[0];
    const items = Array.isArray(value) ? value : [];
    if (itemTemplate && isPlainObject(itemTemplate)) {
      return items.map((item) =>
        isPlainObject(item) ? mergeWithTemplate(itemTemplate, item) : itemTemplate
      );
    }
    return items;
  }

  if (isPlainObject(template)) {
    const result: FormValue = {};
    const recordValue = isPlainObject(value) ? value : {};
    Object.keys(template).forEach((key) => {
      result[key] = mergeWithTemplate(template[key], getRecordValue(recordValue, key));
    });
    return result;
  }

  return value ?? template;
};

const clearPasswordValues = (value: FormValue): FormValue =>
  Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => [
      key,
      normalizeFieldKey(key).includes("senha") ? "" : fieldValue,
    ])
  );

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

const getAtPath = (source: unknown, path: Array<string | number>): unknown =>
  path.reduce<unknown>((current, segment) => {
    if (Array.isArray(current)) {
      return current[typeof segment === "number" ? segment : Number(segment)];
    }
    if (isPlainObject(current)) return current[segment as string];
    return undefined;
  }, source);

const formatFieldLabel = (key: string): string => {
  const mapped = fieldLabels[normalizeFieldKey(key)];
  if (mapped) return mapped;
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
};

const getInputType = (key: string, templateValue: unknown): string => {
  const normalized = normalizeFieldKey(key);
  if (normalized === "cep" || normalized === "ddd" || normalized.includes("cpf")) {
    return "text";
  }
  if (normalized.includes("senha")) return "password";
  if (normalized.includes("email")) return "email";
  if (typeof templateValue === "number") return "number";
  if (
    typeof templateValue === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(templateValue)
  ) {
    return "date";
  }
  return "text";
};

const isPhonePath = (path: Array<string | number>): boolean =>
  path.some(
    (segment) =>
      typeof segment === "string" && normalizeFieldKey(segment) === "telefones"
  );

const isPhoneNumberField = (
  key: string,
  path: Array<string | number>
): boolean => {
  const normalized = normalizeFieldKey(key);
  return isPhonePath(path) && (normalized === "numero" || normalized.includes("telefone"));
};

const isPhoneDddField = (key: string, path: Array<string | number>): boolean =>
  isPhonePath(path) && normalizeFieldKey(key) === "ddd";

const formatLocalPhone = (value: unknown): string => {
  const digits = onlyDigits(value).slice(0, 9);
  if (digits.length <= 8) {
    return digits.replace(/^(\d{4})(\d)/, "$1-$2");
  }
  return digits.replace(/^(\d{5})(\d)/, "$1-$2");
};

const getFieldOptions = (key: string): SelectOption[] | null => {
  if (isStateField(key)) return stateOptions;
  return getEnumOptions(key);
};

const displayValue = (
  key: string,
  value: unknown,
  path: Array<string | number> = []
): string => {
  const normalized = normalizeFieldKey(key);
  const enumOptions = getEnumOptions(key);
  if (enumOptions) {
    const stringValue = String(value ?? "");
    return (
      enumOptions.find((option) => String(option.value) === stringValue)?.label ??
      stringValue
    );
  }
  if (normalized === "cep") return formatCep(value);
  if (normalized.includes("cpf") || normalized.includes("cnpj")) {
    return formatCpfCnpj(value);
  }
  if (isPhoneNumberField(key, path)) return formatLocalPhone(value);
  if (isPhoneDddField(key, path)) return formatDdd(value);
  return String(value ?? "");
};

export default function PerfilPage() {
  const router = useRouter();
  const {
    baseUrl,
    token,
    userRole,
    userId,
    userEmail,
    oficinaId,
    fullName,
    logout,
  } = useAuth();
  const normalizedRole = normalizeRole(userRole);
  const entityKey = getProfileEntityKey(userRole);
  const editableFields = useMemo(
    () => getProfileEditableFields(userRole),
    [userRole]
  );
  const config = useMemo(
    () => entityConfigs.find((item) => item.key === entityKey) ?? null,
    [entityKey]
  );
  const [profileId, setProfileId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormValue>({});
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCepLookup, setLastCepLookup] = useState("");

  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token]
  );

  const resolvedProfileId =
    normalizedRole === "oficina" ? oficinaId ?? userId : userId;
  const homeRoute =
    normalizedRole === "cliente" ? routes.clientHome : routes.dashboard;

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      if (!config) {
        setError("Perfil nao encontrado para este tipo de usuario.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      let record: FormValue | null = null;
      let nextProfileId = resolvedProfileId;

      if (nextProfileId && config.getByIdPath) {
        const result = await fetchJson(baseUrl, config.getByIdPath(String(nextProfileId)), {
          method: "GET",
          headers: authHeaders,
        });
        if (result.ok) record = extractRecord(result.data);
      }

      if (!record && config.listPath && userEmail) {
        const listResult = await fetchJson(baseUrl, config.listPath, {
          method: "GET",
          headers: authHeaders,
        });
        const email = userEmail.trim().toLowerCase();
        const matched = extractList(listResult.data).find(
          (item) => String(getRecordValue(item, "Email") ?? "").toLowerCase() === email
        );
        if (matched) {
          record = matched;
          nextProfileId = getRecordId(matched);
        }
      }

      if (!isMounted) return;

      if (!record) {
        setError("Nao foi possivel carregar sua conta.");
        setFormData(cloneTemplate(config.template));
        setIsLoading(false);
        return;
      }

      setProfileId(nextProfileId ?? getRecordId(record));
      setFormData(
        clearPasswordValues(mergeWithTemplate(config.template, record) as FormValue)
      );
      setIsLoading(false);
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [authHeaders, baseUrl, config, resolvedProfileId, userEmail]);

  const updateField = (
    path: Array<string | number>,
    templateValue: unknown,
    value: string
  ) => {
    const key = String(path[path.length - 1] ?? "");
    const normalized = normalizeFieldKey(key);
    let nextValue: unknown = value;

    if (normalized === "cep") {
      nextValue = formatCep(value);
    } else if (normalized.includes("cpf") || normalized.includes("cnpj")) {
      nextValue = formatCpfCnpj(value);
    } else if (isPhoneNumberField(key, path)) {
      const digits = onlyDigits(value).slice(0, 11);
      const parentPath = path.slice(0, -1);
      const ddd = digits.slice(0, 2);
      const number = digits.slice(2);
      setFormData((prev) => {
        let next = setAtPath(prev, path, formatLocalPhone(number));
        next = setAtPath(next, [...parentPath, "DDD"], ddd);
        return next as FormValue;
      });
      return;
    } else if (isPhoneDddField(key, path)) {
      nextValue = formatDdd(value);
    } else if (typeof templateValue === "number") {
      const parsed = Number(value);
      nextValue = Number.isNaN(parsed) ? templateValue : parsed;
    } else {
      nextValue = maskFieldValue(key, value);
    }

    setFormData((prev) => setAtPath(prev, path, nextValue) as FormValue);

    if (normalized === "cep") {
      const cepDigits = onlyDigits(value);
      const lookupKey = `${path.join(".")}:${cepDigits}`;
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

  const buildPayload = (
    template: unknown,
    value: unknown,
    path: Array<string | number> = []
  ): unknown => {
    if (Array.isArray(template)) {
      const itemTemplate = template[0];
      const items = Array.isArray(value) ? value : [];
      if (!itemTemplate) return items;
      return items.map((item, index) =>
        buildPayload(itemTemplate, item, [...path, index])
      );
    }

    if (isPlainObject(template)) {
      const recordValue = isPlainObject(value) ? value : {};
      const result: FormValue = {};

      Object.keys(template).forEach((key) => {
        const isTopLevel = path.length === 0;
        if (isTopLevel && !isAllowedField(editableFields, key)) return;

        const normalized = normalizeFieldKey(key);
        if (isOwnIdField(key)) {
          if (isPhonePath(path)) {
            const rawId = getRecordValue(recordValue, key);
            const parsedId = Number(rawId);
            if (Number.isFinite(parsedId) && parsedId > 0) {
              result[key] = parsedId;
            }
          }
          return;
        }

        if (isPhonePath(path) && normalized === "clienteid") return;

        if (normalized === "clienteid" && normalizedRole === "cliente" && profileId) {
          result[key] = profileId;
          return;
        }

        const payloadValue = buildPayload(
          template[key],
          getRecordValue(recordValue, key),
          [...path, key]
        );

        if (
          normalized.includes("senha") &&
          typeof payloadValue === "string" &&
          !payloadValue.trim()
        ) {
          return;
        }

        if (payloadValue !== undefined) result[key] = payloadValue;
      });

      if (path.length === 0 && normalizedRole === "cliente") {
        ["Email", "Cpf_Cnpj", "TipoCliente"].forEach((field) => {
          if (!(field in template) || field in result) return;
          result[field] = normalizeSubmitValue(
            field,
            template[field],
            getRecordValue(recordValue, field)
          );
        });
      }

      return result;
    }

    const key = String(path[path.length - 1] ?? "");
    if (isPhoneNumberField(key, path)) return onlyDigits(value);
    return normalizeSubmitValue(key, template, value);
  };

  const handleUpdate = async () => {
    if (!config?.updatePath || !profileId) return;
    setIsLoading(true);
    setError(null);

    const result = await fetchJson(baseUrl, config.updatePath(String(profileId)), {
      method: "PUT",
      headers: authHeaders,
      body: buildPayload(config.template, formData),
    });

    if (!result.ok) {
      setError("Falha ao atualizar sua conta.");
      setIsLoading(false);
      return;
    }

    setIsEditing(false);
    setIsLoading(false);
  };

  const handleDelete = async () => {
    if (!config?.deletePath || !profileId) return;
    if (!window.confirm("Deseja realmente deletar sua conta?")) return;

    setIsLoading(true);
    setError(null);
    const result = await fetchJson(baseUrl, config.deletePath(String(profileId)), {
      method: "DELETE",
      headers: authHeaders,
    });

    if (!result.ok) {
      setError("Falha ao deletar sua conta.");
      setIsLoading(false);
      return;
    }

    logout();
    router.replace(routes.login);
  };

  const renderScalarField = (
    key: string,
    templateValue: unknown,
    value: unknown,
    path: Array<string | number>
  ) => {
    const options = getFieldOptions(key);
    const isPasswordField = normalizeFieldKey(key).includes("senha");
    const normalizedValue =
      value === undefined || value === null ? templateValue ?? "" : value;
    const parentValue = getAtPath(formData, path.slice(0, -1));
    const phoneDisplayValue = (() => {
      if (!isPhoneNumberField(key, path)) return null;
      const ddd = isPlainObject(parentValue) ? getRecordValue(parentValue, "DDD") : "";
      const numberDigits = onlyDigits(normalizedValue);
      const digits =
        numberDigits.length > 9 ? numberDigits : `${onlyDigits(ddd)}${numberDigits}`;
      return formatPhone(digits);
    })();
    const fieldDisplayValue =
      phoneDisplayValue ?? displayValue(key, normalizedValue, path);

    return (
      <label
        key={path.join(".")}
        className="sigo-label rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-3"
      >
        <span>{formatFieldLabel(key)}</span>
        {isEditing ? (
          options ? (
            <select
              className="sigo-input"
              value={String(normalizedValue)}
              onChange={(event) => updateField(path, templateValue, event.target.value)}
            >
              <option value="">Selecione</option>
              {options.map((option) => (
                <option key={String(option.value)} value={String(option.value)}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="sigo-input"
              type={getInputType(key, templateValue)}
              value={
                isPasswordField
                  ? String(value ?? "")
                  : fieldDisplayValue
              }
              onChange={(event) => updateField(path, templateValue, event.target.value)}
            />
          )
        ) : (
          <span className="min-h-11 rounded-lg border border-[var(--sigo-border)] bg-white px-3 py-3 text-sm font-bold text-[var(--sigo-text)]">
            {isPasswordField
              ? "Nao alterada"
              : fieldDisplayValue || "-"}
          </span>
        )}
      </label>
    );
  };

  const renderArrayField = (
    key: string,
    templateValue: unknown[],
    value: unknown,
    path: Array<string | number>
  ) => {
    const items = Array.isArray(value) ? value : [];
    const itemTemplate = templateValue[0] as FormValue | undefined;

    return (
      <div
        key={path.join(".")}
        className="rounded-lg border border-[var(--sigo-border)] bg-white md:col-span-2"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] px-4 py-3">
          <p className="text-sm font-extrabold text-[var(--sigo-text)]">
            {formatFieldLabel(key)}
          </p>
          {isEditing && itemTemplate ? (
            <button
              type="button"
              className="sigo-button min-h-9 px-3 text-xs"
              onClick={() => {
                const nextItems = [...items, cloneTemplate(itemTemplate)];
                setFormData((prev) => setAtPath(prev, path, nextItems) as FormValue);
              }}
            >
              Adicionar
            </button>
          ) : null}
        </div>
        <div className="grid gap-3 p-4">
          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--sigo-border-strong)] bg-[var(--sigo-surface-soft)] px-4 py-3 text-sm font-semibold text-[var(--sigo-muted)]">
              Nenhum telefone cadastrado.
            </p>
          ) : null}
          {items.map((item, index) => (
            <div
              key={`${key}-${index}`}
              className="rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-[var(--sigo-blue-deep)]">
                  Telefone {index + 1}
                </p>
                {isEditing ? (
                  <button
                    type="button"
                    className="text-sm font-bold text-[var(--sigo-danger)]"
                    onClick={() => {
                      const nextItems = items.filter((_, itemIndex) => itemIndex !== index);
                      setFormData((prev) => setAtPath(prev, path, nextItems) as FormValue);
                    }}
                  >
                    Remover
                  </button>
                ) : null}
              </div>
              {itemTemplate && isPlainObject(item) ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {Object.keys(itemTemplate)
                    .filter((field) => {
                      const normalized = normalizeFieldKey(field);
                      return !["id", "clienteid", "ddd"].includes(normalized);
                    })
                    .map((field) =>
                      renderScalarField(
                        field,
                        itemTemplate[field],
                        getRecordValue(item, field),
                        [...path, index, field]
                      )
                    )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFields = () => {
    if (!config) return null;

    return Object.keys(config.template)
      .filter((key) => isAllowedField(editableFields, key))
      .map((key) => {
        const templateValue = config.template[key];
        const value = getRecordValue(formData, key);
        if (Array.isArray(templateValue)) {
          return renderArrayField(key, templateValue, value, [key]);
        }
        return renderScalarField(key, templateValue, value, [key]);
      });
  };

  return (
    <ProtectedRoute>
      <div className="sigo-page">
        <NavBar />
        <main className="sigo-shell grid gap-6 py-8">
          {normalizedRole !== "cliente" ? <DashboardTabs /> : null}

          <section className="sigo-card overflow-hidden">
            <div className="flex flex-col gap-3 bg-[linear-gradient(135deg,var(--sigo-blue-deep),var(--sigo-blue))] p-6 text-white sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-100">
                  Perfil
                </p>
                <h1 className="mt-3 text-3xl font-black text-white lg:text-4xl">
                  {fullName || "Minha conta"}
                </h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="sigo-button bg-white text-[var(--sigo-blue-deep)]"
                  onClick={() => setIsEditing(true)}
                  disabled={isLoading || !config}
                >
                  Editar minha conta
                </button>
                <button
                  type="button"
                  className="sigo-button sigo-button-danger bg-white"
                  onClick={handleDelete}
                  disabled={isLoading || !config?.deletePath || !profileId}
                >
                  Deletar minha conta
                </button>
              </div>
            </div>
          </section>

          {error ? (
            <div className="sigo-error px-4 py-3 text-sm font-semibold">
              {error}
            </div>
          ) : null}

          <section className="sigo-card p-5">
            {isLoading ? (
              <p className="text-sm font-semibold text-[var(--sigo-muted)]">
                Carregando...
              </p>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">{renderFields()}</div>
                {isEditing ? (
                  <div className="mt-6 flex flex-col gap-3 border-t border-[var(--sigo-border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <Link
                      className="text-sm font-bold text-[var(--sigo-muted)] hover:text-[var(--sigo-blue)]"
                      href={homeRoute}
                    >
                      Voltar para pagina principal
                    </Link>
                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                      <button
                        type="button"
                        className="sigo-button"
                        onClick={() => setIsEditing(false)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="sigo-button sigo-button-primary"
                        onClick={handleUpdate}
                        disabled={isLoading || !profileId}
                      >
                        Salvar alteracoes
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
