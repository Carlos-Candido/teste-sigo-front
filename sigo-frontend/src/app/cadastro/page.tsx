"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { fetchJson } from "@/lib/api";
import { NavBar } from "@/components/Sidebar/NavBar";
import { TextInput } from "@/components/Form/TextInput";
import { routes } from "@/navigation/routes";
import { PublicOnlyRoute } from "@/components/Auth/RouteGuards";
import {
  enumOptionsByKey,
  formatCep,
  formatCnpj,
  formatCpf,
  formatPhone,
  onlyDigits,
  stateOptions,
} from "@/lib/fieldMetadata";
import { fetchCepAddress } from "@/lib/cep";

type CadastroForm = {
  Nome: string;
  Email: string;
  senha: string;
  Documento: string;
  Telefone: string;
  Obs: string;
  razao: string;
  DataNasc: string;
  Numero: number;
  Rua: string;
  Cidade: string;
  Cep: string;
  Bairro: string;
  Estado: string;
  Pais: string;
  Complemento: string;
  Sexo: number | "";
};

type CadastroMode = "cliente" | "oficina";

const getTodayIso = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildDefaultForm = (): CadastroForm => ({
  Nome: "",
  Email: "",
  senha: "",
  Documento: "",
  Telefone: "",
  Obs: "",
  razao: "",
  DataNasc: getTodayIso(),
  Numero: 0,
  Rua: "",
  Cidade: "",
  Cep: "",
  Bairro: "",
  Estado: "",
  Pais: "Brasil",
  Complemento: "",
  Sexo: "",
});

const getClienteValidationError = (form: CadastroForm): string | null => {
  const name = form.Nome.trim();
  const email = form.Email.trim();
  const password = form.senha;
  const cep = onlyDigits(form.Cep);
  const phone = onlyDigits(form.Telefone);
  const today = new Date();
  const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  const documentLength = onlyDigits(form.Documento).length;
  if (![11, 14].includes(documentLength)) {
    return "O CPF deve ter 11 dígitos ou o CNPJ deve ter 14 dígitos.";
  }
  if (!name || name.length > 100) {
    return "O nome é obrigatório e deve ter no máximo 100 caracteres.";
  }
  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return "Informe um e-mail válido com no máximo 254 caracteres.";
  }
  if (
    password.length < 8 ||
    password.length > 128 ||
    !/[A-Za-z]/.test(password) ||
    !/\d/.test(password)
  ) {
    return "A senha deve ter entre 8 e 128 caracteres, uma letra e um número.";
  }
  if (cep.length !== 8) return "O CEP deve conter 8 dígitos.";
  if (phone && phone.length !== 10 && phone.length !== 11) {
    return "O telefone deve conter DDD e 8 ou 9 dígitos.";
  }
  if (form.Numero < 0) return "O número do endereço não pode ser negativo.";
  if (form.DataNasc && form.DataNasc > localToday) {
    return "A data de nascimento não pode estar no futuro.";
  }

  return null;
};

const extractErrorMessage = (data: unknown): string | null => {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const errors = record.Errors ?? record.errors;
  if (errors && typeof errors === "object") {
    const values = Object.values(errors as Record<string, unknown>);
    const list = values.flatMap((value) => {
      if (typeof value === "string") return [value];
      if (Array.isArray(value)) {
        return value.filter((item) => typeof item === "string");
      }
      return [];
    });
    if (list.length > 0) return list.join(" | ");
  }

  if (record.data && typeof record.data === "object") {
    const nestedMessage = extractErrorMessage(record.data);
    if (nestedMessage) return nestedMessage;
  }

  const message =
    (record.Message as string | undefined) ||
    (record.message as string | undefined) ||
    (record.detail as string | undefined) ||
    (record.title as string | undefined);

  if (message && message.trim()) return message;

  return null;
};

type NumberFieldProps = {
  label: string;
  value: number;
  onChange: (value: string) => void;
};

function NumberField({ label, value, onChange }: NumberFieldProps) {
  return (
    <label className="sigo-label">
      <span>{label}</span>
      <input
        className="sigo-input"
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

type SelectFieldProps = {
  label: string;
  value: string | number;
  options: Array<{ value: string | number; label: string }>;
  onChange: (value: string) => void;
};

function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  return (
    <label className="sigo-label">
      <span>{label}</span>
      <select
        className="sigo-input"
        value={String(value)}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Selecione</option>
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function CadastroPage() {
  const router = useRouter();
  const { baseUrl, setToken } = useAuth();
  const [cadastroMode, setCadastroMode] = useState<CadastroMode>("cliente");
  const [forms, setForms] = useState<Record<CadastroMode, CadastroForm>>(() => ({
    cliente: buildDefaultForm(),
    oficina: buildDefaultForm(),
  }));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCepLookups, setLastCepLookups] = useState<
    Record<CadastroMode, string>
  >({ cliente: "", oficina: "" });
  const isSubmittingRef = useRef(false);

  const isOficinaMode = cadastroMode === "oficina";
  const formData = forms[cadastroMode];
  const lastCepLookup = lastCepLookups[cadastroMode];
  const clienteDocumentLength = onlyDigits(formData.Documento).length;
  const isClienteCnpj = !isOficinaMode && clienteDocumentLength > 11;
  const documentLabel = isOficinaMode ? "CNPJ" : isClienteCnpj ? "CNPJ" : "CPF";
  const documentPlaceholder = isOficinaMode || isClienteCnpj
    ? "00.000.000/0000-00"
    : "000.000.000-00";

  const setCurrentForm = (
    updater: (previous: CadastroForm) => CadastroForm
  ) => {
    setForms((previous) => ({
      ...previous,
      [cadastroMode]: updater(previous[cadastroMode]),
    }));
  };

  const updateField = (key: keyof CadastroForm, value: string) => {
    const maskedValue =
      key === "Documento"
        ? isOficinaMode || onlyDigits(value).length > 11
          ? formatCnpj(value)
          : formatCpf(value)
        : key === "Telefone"
          ? formatPhone(value)
        : key === "Cep"
          ? formatCep(value)
          : value;
    setCurrentForm((prev) => ({ ...prev, [key]: maskedValue }));
  };

  const updateNumberField = (key: keyof CadastroForm, value: string) => {
    const parsed = Number(value);
    setCurrentForm((prev) => ({
      ...prev,
      [key]: Number.isNaN(parsed) ? 0 : parsed,
    }));
  };

  useEffect(() => {
    const cepDigits = onlyDigits(formData.Cep);
    if (cepDigits.length !== 8 || cepDigits === lastCepLookup) return;

    let isMounted = true;
    setLastCepLookups((previous) => ({
      ...previous,
      [cadastroMode]: cepDigits,
    }));

    fetchCepAddress(baseUrl, cepDigits).then((address) => {
      if (!isMounted || !address) return;
      setCurrentForm((prev) => ({
        ...prev,
        Rua: address.rua || prev.Rua,
        Bairro: address.bairro || prev.Bairro,
        Cidade: address.cidade || prev.Cidade,
        Estado: address.estado || prev.Estado,
        Complemento: address.complemento || prev.Complemento,
        Pais: address.pais || prev.Pais,
      }));
    });

    return () => {
      isMounted = false;
    };
  }, [baseUrl, cadastroMode, formData.Cep]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setError(null);
    setIsLoading(true);

    const documentDigits = onlyDigits(formData.Documento);
    const cepDigits = onlyDigits(formData.Cep);
    const telefoneDigits = onlyDigits(formData.Telefone);
    const clienteTelefones =
      telefoneDigits.length >= 10
        ? [
            {
              DDD: Number(telefoneDigits.slice(0, 2)),
              Numero: telefoneDigits.slice(2),
            },
          ]
        : [];
    const senha = formData.senha.trim();
    const clienteValidationError = isOficinaMode
      ? null
      : getClienteValidationError(formData);
    if (clienteValidationError || (isOficinaMode && !senha)) {
      setError(clienteValidationError ?? "Informe a senha da oficina.");
      isSubmittingRef.current = false;
      setIsLoading(false);
      return;
    }
    const extractToken = (data: unknown): string => {
      if (typeof data === "string") return data;
      if (!data || typeof data !== "object") return "";

      const record = data as {
        accessToken?: string;
        AccessToken?: string;
        token?: string;
        Token?: string;
        data?: unknown;
        Data?: unknown;
      };

      return (
        record.accessToken ??
        record.AccessToken ??
        record.token ??
        record.Token ??
        extractToken(record.data) ??
        extractToken(record.Data)
      );
    };

    const extractClienteId = (data: unknown): number | null => {
      if (!data || typeof data !== "object") return null;
      const record = data as {
        clienteId?: number;
        ClienteId?: number;
        id?: number;
        Id?: number;
        data?: unknown;
        Data?: unknown;
      };
      const id = record.clienteId ?? record.ClienteId ?? record.id ?? record.Id;
      if (Number.isFinite(Number(id)) && Number(id) > 0) return Number(id);
      return extractClienteId(record.data) ?? extractClienteId(record.Data);
    };

    const result = isOficinaMode
      ? await fetchJson(baseUrl, "/api/v1/oficinas", {
          method: "POST",
          body: {
          Nome: formData.Nome,
          CNPJ: documentDigits,
          Email: formData.Email,
          Numero: formData.Numero,
          Rua: formData.Rua,
          Cidade: formData.Cidade,
          Cep: Number(cepDigits || 0),
          Bairro: formData.Bairro,
          Estado: formData.Estado,
          Pais: formData.Pais,
          Complemento: formData.Complemento,
          Senha: senha,
          Situacao: 1,
          },
        })
      : await fetchJson(baseUrl, "/api/v1/clientes/cadastros", {
          method: "POST",
          body: {
            cpf: documentDigits,
            nome: formData.Nome.trim(),
            email: formData.Email.trim().toLowerCase(),
            senha,
          },
        });

    if (result.ok && isOficinaMode) {
      const loginResult = await fetchJson(baseUrl, "/api/v1/oficinas/login", {
        method: "POST",
        body: {
          Email: formData.Email.trim().toLowerCase(),
          Password: senha,
        },
      });
      const token = extractToken(loginResult.data)
        .trim()
        .replace(/^Bearer\s+/i, "");

      if (!loginResult.ok || !token) {
        setError(
          "Oficina criada, mas não foi possível entrar automaticamente. Tente entrar pela tela de login."
        );
        isSubmittingRef.current = false;
        setIsLoading(false);
        return;
      }

      setToken(token);
      router.replace(routes.dashboard);
      return;
    }

    if (result.ok) {
      const clienteId = extractClienteId(result.data);
      if (!clienteId) {
        setError("Cliente criado, mas não foi possível identificar o cadastro.");
        isSubmittingRef.current = false;
        setIsLoading(false);
        return;
      }

      const loginResult = await fetchJson(baseUrl, "/api/v1/clientes/login", {
        method: "POST",
        body: {
          cpf: documentDigits,
          senha,
        },
      });

      const token = extractToken(loginResult.data).trim().replace(/^Bearer\s+/i, "");
      if (!loginResult.ok || !token) {
        setError("Cliente criado, mas não foi possível entrar para completar o cadastro.");
        isSubmittingRef.current = false;
        setIsLoading(false);
        return;
      }

      const fullClientePayload = {
        nome: formData.Nome.trim(),
        email: formData.Email.trim().toLowerCase(),
        cpf_Cnpj: documentDigits,
        obs: formData.Obs,
        razao: formData.razao,
        dataNasc: formData.DataNasc || "0001-01-01",
        numero: formData.Numero,
        rua: formData.Rua,
        cidade: formData.Cidade,
        cep: cepDigits,
        bairro: formData.Bairro,
        estado: formData.Estado,
        pais: formData.Pais,
        complemento: formData.Complemento,
        sexo: documentDigits.length === 14 ? 3 : Number(formData.Sexo),
        tipoCliente: documentDigits.length === 14 ? 2 : 1,
        telefones: clienteTelefones.map((telefone) => ({
          id: 0,
          numero: telefone.Numero,
          ddd: telefone.DDD,
          clienteId,
        })),
        senha: "",
      };

      const updateResult = await fetchJson(baseUrl, `/api/v1/clientes/${clienteId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: fullClientePayload,
      });

      if (!updateResult.ok) {
        setError(extractErrorMessage(updateResult.data) ?? "Cliente criado, mas não foi possível completar os dados.");
        isSubmittingRef.current = false;
        setIsLoading(false);
        return;
      }

      setToken(token);
      router.replace(routes.clientHome);
      return;
    }

    const message = extractErrorMessage(result.data) ?? "Falha ao cadastrar";
    setError(message);
    isSubmittingRef.current = false;
    setIsLoading(false);
  };

  return (
    <PublicOnlyRoute>
      <div className="sigo-page">
      <NavBar />
      <main className="sigo-shell flex min-h-[calc(100vh-5rem)] items-center justify-center py-8 lg:py-12">
        <div
          className="sigo-registration-card grid w-full max-w-6xl overflow-hidden border border-[var(--sigo-border)] bg-white shadow-[var(--sigo-shadow-lg)] lg:grid-cols-[0.95fr_1.35fr] lg:divide-x lg:divide-[var(--sigo-border)]"
          style={{ borderRadius: "1rem 0 0 1rem" }}
        >
          <section className="flex flex-col justify-between bg-[linear-gradient(to_bottom_right,rgba(8,47,99,0.96),rgba(7,95,189,0.84)),url('https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&q=80')] bg-cover bg-center p-8 text-white lg:p-10">
            <div>
              <div className="mb-7 flex h-24 w-24 items-center justify-center lg:h-32 lg:w-32">
                <img
                  src="/sigo-logo.png"
                  alt="Logo SIGO"
                  className="h-full w-full object-contain"
                />
              </div>
              <p className="text-sm font-bold uppercase tracking-[0.12em] text-blue-100">
                Novo cadastro
              </p>
              <h1 className="sigo-public-hero-title mt-3 text-3xl font-black leading-tight text-white lg:text-4xl">
                Entre para o SIGO
              </h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-blue-50 lg:text-base lg:leading-7">
                Informe os dados principais para criar seu cadastro e acessar o sistema de gestão de oficinas mais completo do mercado. Clientes e oficinas, todos em um só lugar.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            </div>
          </section>

          <section className="flex min-h-0 flex-col bg-white">
            <div className="border-b border-[var(--sigo-border)] px-6 py-6 sm:px-8">
              <div className="mb-5 flex items-center gap-3 lg:hidden">
                <span className="flex h-16 w-16 items-center justify-center">
                  <img
                    src="/sigo-logo.png"
                    alt="Logo SIGO"
                    className="h-full w-full object-contain"
                  />
                </span>
                <p className="text-sm font-semibold text-[var(--sigo-muted)]">
                  Sistema de gestão de oficinas
                </p>
              </div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                </div>
              </div>
              <div className="mt-5 grid gap-2 rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-1 sm:grid-cols-2">
                <button
                  type="button"
                  className={`sigo-button min-h-11 ${
                    !isOficinaMode
                      ? "sigo-button-primary"
                      : "bg-white text-[var(--sigo-text)]"
                  }`}
                  onClick={() => {
                    setCadastroMode("cliente");
                    setError(null);
                  }}
                >
                  Cliente
                </button>
                <button
                  type="button"
                  className={`sigo-button min-h-11 ${
                    isOficinaMode
                      ? "sigo-button-primary"
                      : "bg-white text-[var(--sigo-text)]"
                  }`}
                  onClick={() => {
                    setCadastroMode("oficina");
                    setError(null);
                  }}
                >
                  Oficina
                </button>
              </div>
            </div>

            <form
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              onSubmit={handleSubmit}
            >
              <div className="sigo-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6 sm:p-8">
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label={isOficinaMode ? "Nome da oficina" : "Nome completo"}
                  value={formData.Nome}
                  onChange={(value) => updateField("Nome", value)}
                />
                <TextInput
                  label="E-mail"
                  value={formData.Email}
                  onChange={(value) => updateField("Email", value)}
                  type="email"
                />
                <TextInput
                  label={documentLabel}
                  value={formData.Documento}
                  onChange={(value) => updateField("Documento", value)}
                  placeholder={documentPlaceholder}
                  maxLength={18}
                  inputMode="numeric"
                  helperText={
                    isOficinaMode || isClienteCnpj
                      ? "Digite os 14 números do CNPJ; a pontuação é aplicada automaticamente."
                      : "Digite os 11 números do CPF; a pontuação é aplicada automaticamente."
                  }
                />
                <TextInput
                  label="Senha"
                  value={formData.senha}
                  onChange={(value) => updateField("senha", value)}
                  type="password"
                  helperText="Entre 8 e 128 caracteres, com pelo menos uma letra e um número."
                />
              </div>

              {!isOficinaMode ? (
                <div className="grid items-start gap-4 md:grid-cols-2">
                  <TextInput
                    label="Telefone"
                    value={formData.Telefone}
                    onChange={(value) => updateField("Telefone", value)}
                    placeholder="(00) 00000-0000"
                    helperText="Opcional. Informe DDD e 8 ou 9 dígitos."
                  />
                  <TextInput
                    label="Data de nascimento"
                    value={formData.DataNasc}
                    onChange={(value) => updateField("DataNasc", value)}
                    type="date"
                    max="9999-12-31"
                  />
                </div>
              ) : null}

              {!isOficinaMode ? (
                <div className="grid items-start gap-4">
                  {!isClienteCnpj ? (
                    <TextInput
                      label="Observação"
                      value={formData.Obs}
                      onChange={(value) => updateField("Obs", value)}
                    />
                  ) : (
                    <TextInput
                      label="Razão social"
                      value={formData.razao}
                      onChange={(value) => updateField("razao", value)}
                      helperText="Opcional."
                    />
                  )}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-3">
                <NumberField
                  label="Número da residência"
                  value={formData.Numero}
                  onChange={(value) => updateNumberField("Numero", value)}
                />
                <TextInput
                  label="Rua"
                  value={formData.Rua}
                  onChange={(value) => updateField("Rua", value)}
                  className="md:col-span-2"
                />
                <TextInput
                  label="Cidade"
                  value={formData.Cidade}
                  onChange={(value) => updateField("Cidade", value)}
                />
                <TextInput
                  label="CEP"
                  value={formData.Cep}
                  onChange={(value) => updateField("Cep", value)}
                  placeholder="00000-000"
                />
                <TextInput
                  label="Bairro"
                  value={formData.Bairro}
                  onChange={(value) => updateField("Bairro", value)}
                />
                <SelectField
                  label="Estado"
                  value={formData.Estado}
                  options={stateOptions}
                  onChange={(value) => updateField("Estado", value)}
                />
                <TextInput
                  label="País"
                  value="Brasil"
                  onChange={() => undefined}
                  disabled
                />
                <TextInput
                  label="Complemento"
                  value={formData.Complemento}
                  onChange={(value) => updateField("Complemento", value)}
                />
              </div>

              {!isOficinaMode ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <SelectField
                    label="Sexo"
                    value={formData.Sexo}
                    options={enumOptionsByKey.sexo}
                    onChange={(value) => updateNumberField("Sexo", value)}
                  />
                </div>
              ) : null}

              {error ? (
                <div className="sigo-error px-4 py-3 text-sm font-semibold">
                  {error}
                </div>
              ) : null}
              </div>

              <div className="flex shrink-0 flex-col gap-3 border-t border-[var(--sigo-border)] bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <Link
                  className="text-sm font-bold text-[var(--sigo-muted)] hover:text-[var(--sigo-blue)]"
                  href={routes.login}
                >
                  Voltar para login
                </Link>
                <button
                  type="submit"
                  className="sigo-button sigo-button-primary"
                  disabled={isLoading}
                >
                  {isLoading
                    ? "Salvando..."
                    : isOficinaMode
                      ? "Criar oficina"
                      : "Criar conta"}
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
      </div>
    </PublicOnlyRoute>
  );
}
