"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { fetchJson } from "@/lib/api";
import { NavBar } from "@/components/Sidebar/NavBar";
import { SectionCard } from "@/components/Form/SectionCard";
import { TextInput } from "@/components/Form/TextInput";
import { ConnectionSettings } from "@/components/Form/ConnectionSettings";
import { routes } from "@/navigation/routes";
import { PublicOnlyRoute } from "@/components/Auth/RouteGuards";
import { formatCep, formatCnpj, onlyDigits, stateOptions } from "@/lib/fieldMetadata";
import { fetchCepAddress } from "@/lib/cep";

type OficinaForm = {
  Nome: string;
  CNPJ: string;
  Email: string;
  Numero: number;
  Rua: string;
  Cidade: string;
  Cep: string;
  Bairro: string;
  Estado: string;
  Pais: string;
  Complemento: string;
  Senha: string;
};

const buildDefaultForm = (): OficinaForm => ({
  Nome: "",
  CNPJ: "",
  Email: "",
  Numero: 0,
  Rua: "",
  Cidade: "",
  Cep: "",
  Bairro: "",
  Estado: "",
  Pais: "Brasil",
  Complemento: "",
  Senha: "",
});

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

const extractToken = (data: unknown): string => {
  if (typeof data === "string") return data;
  if (!data || typeof data !== "object") return "";

  const record = data as Record<string, unknown>;
  const token =
    record.accessToken ?? record.AccessToken ?? record.token ?? record.Token;
  if (typeof token === "string") return token;

  return extractToken(record.data) || extractToken(record.Data);
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

export default function CadastroOficinaPage() {
  const router = useRouter();
  const { baseUrl, setBaseUrl, setToken } = useAuth();
  const [formData, setFormData] = useState<OficinaForm>(buildDefaultForm);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCepLookup, setLastCepLookup] = useState("");

  const updateField = (key: keyof OficinaForm, value: string) => {
    const maskedValue =
      key === "CNPJ" ? formatCnpj(value) : key === "Cep" ? formatCep(value) : value;
    setFormData((prev) => ({ ...prev, [key]: maskedValue }));
  };

  const updateNumberField = (key: keyof OficinaForm, value: string) => {
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
  }, [baseUrl, formData.Cep]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const senha = formData.Senha.trim();
    if (!senha) {
      setError("Informe a senha da oficina.");
      setIsLoading(false);
      return;
    }

    const payload = {
      ...formData,
      CNPJ: onlyDigits(formData.CNPJ),
      Cep: Number(onlyDigits(formData.Cep) || 0),
      Senha: senha,
      Situacao: 1,
    };

    const result = await fetchJson(baseUrl, "/api/v1/oficinas", {
      method: "POST",
      body: payload,
    });

    if (result.ok) {
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
        setIsLoading(false);
        return;
      }

      setToken(token);
      router.replace(routes.dashboard);
      return;
    }

    const message = extractErrorMessage(result.data) ?? "Falha ao cadastrar";
    setError(message);
    setIsLoading(false);
  };

  return (
    <PublicOnlyRoute>
      <div className="sigo-page">
      <NavBar />
      <main className="sigo-shell grid gap-6 py-8">
        <section className="sigo-card overflow-hidden">
          <div className="grid gap-5 bg-[var(--sigo-blue-deep)] p-6 text-white sm:grid-cols-[auto_1fr] sm:items-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-lg border border-white/15 bg-white/10 p-1.5">
              <img
                src="/sigo-logo.png"
                alt="Logo SIGO"
                className="h-full w-full object-contain"
              />
            </span>
            <div>
              <p className="text-sm font-bold text-blue-100">
                Cadastro direcionado
              </p>
              <h1 className="mt-1 text-3xl font-black text-white">
                Oficina
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-50">
                Crie a conta da oficina com os dados fiscais, contato e
                endereco principal.
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <SectionCard
            title="Dados da oficina"
            description="Mantenha os dados de identificacao e endereco atualizados para operacao."
          >
            <form className="grid gap-6" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Nome"
                  value={formData.Nome}
                  onChange={(value) => updateField("Nome", value)}
                />
                <TextInput
                  label="CNPJ"
                  value={formData.CNPJ}
                  onChange={(value) => updateField("CNPJ", value)}
                  placeholder="00.000.000/0000-00"
                />
                <TextInput
                  label="Email"
                  value={formData.Email}
                  onChange={(value) => updateField("Email", value)}
                  type="email"
                />
                <TextInput
                  label="Senha"
                  value={formData.Senha}
                  onChange={(value) => updateField("Senha", value)}
                  type="password"
                />
              </div>

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
                  value="Brasil"
                  onChange={() => undefined}
                  disabled
                />
                <TextInput
                  label="Complemento"
                  value={formData.Complemento}
                  onChange={(value) => updateField("Complemento", value)}
                  className="md:col-span-2"
                />
              </div>

              {error ? (
                <div className="sigo-error px-4 py-3 text-sm font-semibold">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 border-t border-[var(--sigo-border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
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
                  {isLoading ? "Salvando..." : "Criar oficina"}
                </button>
              </div>
            </form>
          </SectionCard>

          <aside className="grid content-start gap-4">
            <ConnectionSettings
              baseUrl={baseUrl}
              onBaseUrlChange={setBaseUrl}
            />
            <div className="sigo-card p-5">
              <p className="text-sm font-extrabold text-[var(--sigo-text)]">
                Outro tipo de cadastro
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--sigo-muted)]">
                Para cadastrar um cliente, use o formulario dedicado.
              </p>
              <Link
                className="sigo-button mt-4 w-full"
                href={routes.registerCliente}
              >
                Cadastro de cliente
              </Link>
            </div>
          </aside>
        </div>
      </main>
      </div>
    </PublicOnlyRoute>
  );
}
