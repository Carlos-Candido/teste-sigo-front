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
import {
  enumOptionsByKey,
  formatCep,
  formatCpfCnpj,
  onlyDigits,
  stateOptions,
} from "@/lib/fieldMetadata";
import { fetchCepAddress } from "@/lib/cep";

type TelefoneForm = {
  Numero: string;
  DDD: number;
};

type ClienteForm = {
  Nome: string;
  Email: string;
  senha: string;
  Cpf_Cnpj: string;
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
  TipoCliente: number;
  Telefones: TelefoneForm[];
};

const buildDefaultForm = (): ClienteForm => ({
  Nome: "",
  Email: "",
  senha: "",
  Cpf_Cnpj: "",
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
  TipoCliente: 1,
  Telefones: [],
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

export default function CadastroClientePage() {
  const router = useRouter();
  const { baseUrl, setBaseUrl } = useAuth();
  const [formData, setFormData] = useState<ClienteForm>(buildDefaultForm);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCepLookup, setLastCepLookup] = useState("");

  const updateField = (key: keyof ClienteForm, value: string) => {
    const maskedValue =
      key === "Cpf_Cnpj"
        ? formatCpfCnpj(value)
        : key === "Cep"
          ? formatCep(value)
          : value;
    setFormData((prev) => ({ ...prev, [key]: maskedValue }));
  };

  const updateNumberField = (key: keyof ClienteForm, value: string) => {
    const parsed = Number(value);
    setFormData((prev) => ({
      ...prev,
      [key]: Number.isNaN(parsed) ? 0 : parsed,
    }));
  };

  const addTelefone = () => {
    setFormData((prev) => ({
      ...prev,
      Telefones: [...prev.Telefones, { Numero: "", DDD: 0 }],
    }));
  };

  const updateTelefone = (
    index: number,
    key: keyof TelefoneForm,
    value: string
  ) => {
    setFormData((prev) => {
      const next = [...prev.Telefones];
      const current = next[index];
      if (!current) return prev;
      next[index] = {
        ...current,
        [key]: key === "DDD" ? Number(value || 0) : value,
      };
      return { ...prev, Telefones: next };
    });
  };

  const removeTelefone = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      Telefones: prev.Telefones.filter((_, idx) => idx !== index),
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
    setError(null);
    setIsLoading(true);

    const payload = {
      ...formData,
      Cpf_Cnpj: onlyDigits(formData.Cpf_Cnpj),
      Cep: onlyDigits(formData.Cep),
      Telefones: formData.Telefones.map((telefone) => ({
        Numero: telefone.Numero,
        DDD: telefone.DDD,
      })),
    };

    const result = await fetchJson(baseUrl, "/api/v1/clientes", {
      method: "POST",
      body: payload,
    });

    if (result.ok) {
      router.replace(routes.login);
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
                Cliente
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-50">
                Crie o acesso do cliente com documento, endereço e telefones.
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <SectionCard
            title="Dados do cliente"
            description="Organize informações pessoais, endereço e contatos antes de salvar."
          >
            <form className="grid gap-6" onSubmit={handleSubmit}>
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
                  label="Senha"
                  value={formData.senha}
                  onChange={(value) => updateField("senha", value)}
                  type="password"
                />
                <TextInput
                  label="CPF/CNPJ"
                  value={formData.Cpf_Cnpj}
                  onChange={(value) => updateField("Cpf_Cnpj", value)}
                  placeholder="000.000.000-00"
                />
                <TextInput
                  label="Observação"
                  value={formData.Obs}
                  onChange={(value) => updateField("Obs", value)}
                />
                <TextInput
                  label="Razão"
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
                  className="md:col-span-2"
                />
                <SelectField
                  label="Sexo"
                  value={formData.Sexo}
                  options={enumOptionsByKey.sexo}
                  onChange={(value) => updateNumberField("Sexo", value)}
                />
                <SelectField
                  label="Tipo de cliente"
                  value={formData.TipoCliente}
                  options={enumOptionsByKey.tipocliente}
                  onChange={(value) =>
                    updateNumberField("TipoCliente", value)
                  }
                />
              </div>

              <div className="sigo-card-soft p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-[var(--sigo-text)]">
                      Telefones
                    </p>
                    <p className="text-xs font-medium text-[var(--sigo-muted)]">
                      Contatos vinculados ao cliente.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="sigo-button min-h-9 px-3 text-xs"
                    onClick={addTelefone}
                  >
                    Adicionar
                  </button>
                </div>
                <div className="mt-4 grid gap-3">
                  {formData.Telefones.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-[var(--sigo-border-strong)] bg-white px-4 py-3 text-sm font-medium text-[var(--sigo-muted)]">
                      Nenhum telefone adicionado.
                    </p>
                  ) : null}
                  {formData.Telefones.map((telefone, index) => (
                    <div
                      key={`telefone-${index}`}
                      className="rounded-lg border border-[var(--sigo-border)] bg-white p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-[var(--sigo-blue-deep)]">
                          Telefone {index + 1}
                        </p>
                        <button
                          type="button"
                          className="text-sm font-bold text-[var(--sigo-danger)] hover:text-red-700"
                          onClick={() => removeTelefone(index)}
                        >
                          Remover
                        </button>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px]">
                        <TextInput
                          label="Numero"
                          value={telefone.Numero}
                          onChange={(value) =>
                            updateTelefone(index, "Numero", value)
                          }
                        />
                        <NumberField
                          label="DDD"
                          value={telefone.DDD}
                          onChange={(value) =>
                            updateTelefone(index, "DDD", value)
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
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
                  {isLoading ? "Salvando..." : "Criar cliente"}
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
                Para cadastrar uma oficina, use o formulario dedicado.
              </p>
              <Link
                className="sigo-button mt-4 w-full"
                href={routes.registerOficina}
              >
                Cadastro de oficina
              </Link>
            </div>
          </aside>
        </div>
      </main>
      </div>
    </PublicOnlyRoute>
  );
}
