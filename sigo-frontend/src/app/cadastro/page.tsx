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
  formatCpfCnpj,
  formatPhone,
  onlyDigits,
  stateOptions,
} from "@/lib/fieldMetadata";
import { fetchCepAddress } from "@/lib/cep";

type CadastroForm = {
  Nome: string;
  Email: string;
  senha: string;
  Senha: string;
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
  Sexo: number;
};

type CadastroMode = "cliente" | "oficina";

const buildDefaultForm = (): CadastroForm => ({
  Nome: "",
  Email: "",
  senha: "",
  Senha: "",
  Documento: "",
  Telefone: "",
  Obs: "",
  razao: "",
  DataNasc: "",
  Numero: 0,
  Rua: "",
  Cidade: "",
  Cep: "",
  Bairro: "",
  Estado: "",
  Pais: "",
  Complemento: "",
  Sexo: 1,
});

const normalizeDigits = (value: string) => value.replace(/\D/g, "");

const isCpfDocument = (value: string) => normalizeDigits(value).length <= 11;

const extractErrorMessage = (data: unknown): string | null => {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const message =
    (record.Message as string | undefined) ||
    (record.message as string | undefined) ||
    (record.title as string | undefined) ||
    (record.detail as string | undefined);

  if (message && message.trim()) return message;

  const errors = record.Errors ?? record.errors ?? record.data;
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
  const { baseUrl, setBaseUrl, setToken } = useAuth();
  const [formData, setFormData] = useState<CadastroForm>(buildDefaultForm);
  const [cadastroMode, setCadastroMode] = useState<CadastroMode>("cliente");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCepLookup, setLastCepLookup] = useState("");
  const isSubmittingRef = useRef(false);

  const isOficinaMode = cadastroMode === "oficina";
  const isClienteCpf = !isOficinaMode && isCpfDocument(formData.Documento);
  const documentLabel = isOficinaMode ? "CNPJ" : isClienteCpf ? "CPF" : "CNPJ";
  const documentPlaceholder = isClienteCpf
    ? "000.000.000-00"
    : "00.000.000/0000-00";

  const updateField = (key: keyof CadastroForm, value: string) => {
    const maskedValue =
      key === "Documento"
        ? isOficinaMode
          ? formatCnpj(value)
          : isCpfDocument(value)
          ? formatCpf(value)
          : formatCpfCnpj(value)
        : key === "Telefone"
          ? formatPhone(value)
        : key === "Cep"
          ? formatCep(value)
          : value;
    setFormData((prev) => ({ ...prev, [key]: maskedValue }));
  };

  const updateNumberField = (key: keyof CadastroForm, value: string) => {
    const parsed = Number(value);
    setFormData((prev) => ({
      ...prev,
      [key]: Number.isNaN(parsed) ? 0 : parsed,
    }));
  };

  useEffect(() => {
    const cepDigits = onlyDigits(formData.Cep);
    if (cepDigits.length !== 8 || cepDigits === lastCepLookup) return;

    let isMounted = true;
    setLastCepLookup(cepDigits);

    fetchCepAddress(baseUrl, cepDigits).then((address) => {
      if (!isMounted || !address) return;
      setFormData((prev) => ({
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
  }, [baseUrl, formData.Cep, lastCepLookup]);

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
              ddd: Number(telefoneDigits.slice(0, 2)),
              numero: telefoneDigits.slice(2),
            },
          ]
        : [];
    const senha = (formData.Senha || formData.senha).trim();
    if (isOficinaMode && !senha) {
      setError("Informe a senha da oficina.");
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

    const fullClientePayload = {
      nome: formData.Nome,
      email: formData.Email,
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
      sexo: formData.Sexo,
      tipoCliente: isCpfDocument(formData.Documento) ? 1 : 2,
      telefones: clienteTelefones,
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
          },
        })
      : await fetchJson(baseUrl, "/api/v1/clientes/cadastros", {
          method: "POST",
          body: {
            Cpf: documentDigits,
            Nome: formData.Nome,
            Email: formData.Email,
            Senha: senha,
          },
        });

    if (result.ok && isOficinaMode) {
      router.replace(routes.login);
      return;
    }

    if (result.ok) {
      const clienteId = extractClienteId(result.data);
      if (!clienteId) {
        setError("Cliente criado, mas nao foi possivel identificar o cadastro.");
        isSubmittingRef.current = false;
        setIsLoading(false);
        return;
      }

      const loginResult = await fetchJson(baseUrl, "/api/v1/clientes/login", {
        method: "POST",
        body: {
          Cpf: documentDigits,
          Senha: senha,
        },
      });

      const token = extractToken(loginResult.data).trim().replace(/^Bearer\s+/i, "");
      if (!loginResult.ok || !token) {
        setError("Cliente criado, mas nao foi possivel entrar para completar o cadastro.");
        isSubmittingRef.current = false;
        setIsLoading(false);
        return;
      }

      const updateResult = await fetchJson(baseUrl, `/api/v1/clientes/${clienteId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: fullClientePayload,
      });

      if (!updateResult.ok) {
        setError(extractErrorMessage(updateResult.data) ?? "Cliente criado, mas nao foi possivel completar os dados.");
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
        <div className="grid w-full max-w-6xl overflow-hidden rounded-2xl border border-[var(--sigo-border)] bg-white shadow-[var(--sigo-shadow-lg)] lg:grid-cols-[0.95fr_1.35fr] lg:divide-x lg:divide-[var(--sigo-border)]">
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
              <h1 className="mt-3 text-3xl font-black leading-tight text-white lg:text-4xl">
                Entre para o SIGO
              </h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-blue-50 lg:text-base lg:leading-7">
                Informe os dados principais para criar seu cadastro e acessar o sistema de gestão de oficinas mais completo do mercado. Clientes e oficinas, todos em um só lugar.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            </div>
          </section>

          <section className="flex max-h-none flex-col bg-white lg:max-h-[calc(100vh-7rem)]">
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
                  Sistema de gestao de oficinas
                </p>
              </div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="mt-2 text-3xl font-black text-[var(--sigo-text)]">
                    {isOficinaMode ? "Cadastro de oficina" : "Cadastro de cliente"}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--sigo-muted)]">
                    {isOficinaMode
                      ? "Preencha os dados juridicos da oficina"
                      : "Preencha os dados principais"}
                  </p>
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
                  onClick={() => setCadastroMode("cliente")}
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
                    setFormData((prev) => ({
                      ...prev,
                      Documento: formatCnpj(prev.Documento),
                    }));
                  }}
                >
                  Oficina
                </button>
              </div>
            </div>

            <form
              className="sigo-scrollbar grid gap-5 overflow-y-auto p-6 sm:p-8"
              onSubmit={handleSubmit}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Nome"
                  value={formData.Nome}
                  onChange={(value) => updateField("Nome", value)}
                />
                <TextInput
                  label="Email"
                  value={formData.Email}
                  onChange={(value) => updateField("Email", value)}
                  type="email"
                />
                <TextInput
                  label={documentLabel}
                  value={formData.Documento}
                  onChange={(value) => updateField("Documento", value)}
                  placeholder={documentPlaceholder}
                />
                <TextInput
                  label="Senha"
                  value={formData.senha}
                  onChange={(value) => updateField("senha", value)}
                  type="password"
                />
              </div>

              {!isOficinaMode ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <TextInput
                    label="Telefone"
                    value={formData.Telefone}
                    onChange={(value) => updateField("Telefone", value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              ) : null}

              {!isOficinaMode ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <TextInput
                    label="Observação"
                    value={formData.Obs}
                    onChange={(value) => updateField("Obs", value)}
                  />
                  <TextInput
                    label="Razão social"
                    value={formData.razao}
                    onChange={(value) => updateField("razao", value)}
                  />
                  <TextInput
                    label="Data de nascimento"
                    value={formData.DataNasc}
                    onChange={(value) => updateField("DataNasc", value)}
                    type="date"
                  />
                </div>
              ) : null}

              {isOficinaMode ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <TextInput
                    label="ObservaÃ§Ã£o"
                    value={formData.Obs}
                    onChange={(value) => updateField("Obs", value)}
                  />
                  <TextInput
                    label="RazÃ£o social"
                    value={formData.razao}
                    onChange={(value) => updateField("razao", value)}
                  />
                  <TextInput
                    label="Data de nascimento"
                    value={formData.DataNasc}
                    onChange={(value) => updateField("DataNasc", value)}
                    type="date"
                  />
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-3">
                <NumberField
                  label="Número"
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
                  label="Pais"
                  value={formData.Pais}
                  onChange={(value) => updateField("Pais", value)}
                />
                <TextInput
                  label="Complemento"
                  value={formData.Complemento}
                  onChange={(value) => updateField("Complemento", value)}
                />
              </div>

              {isClienteCpf ? (
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

              <div className="flex flex-col gap-3 border-t border-[var(--sigo-border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
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
