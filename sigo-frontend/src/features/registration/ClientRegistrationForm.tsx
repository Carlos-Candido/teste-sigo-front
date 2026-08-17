"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AuthPageLayout } from "@/components/Auth/AuthPageLayout";
import { PublicOnlyRoute } from "@/components/Auth/RouteGuards";
import { TextInput } from "@/components/Form/TextInput";
import { useAuth } from "@/hooks/useAuth";
import { fetchJson } from "@/lib/api";
import {
  enumOptionsByKey,
  formatCep,
  formatCnpj,
  formatCpf,
  formatPhone,
} from "@/lib/fieldMetadata";
import { routes } from "@/navigation/routes";
import { AddressFields, RegistrationFooter } from "@/features/registration/RegistrationFields";
import {
  buildClientProfilePayload,
  buildClientRegistrationPayload,
  changeClientType,
  clientTypes,
  createClientRegistrationForm,
  extractAccessToken,
  extractClientId,
  extractRegistrationError,
  getTodayIso,
  validateClientRegistration,
  type ClientRegistrationForm as ClientRegistrationFormState,
  type ClientType,
  type RegistrationAddress,
  type RegistrationErrors,
} from "@/features/registration/registration";
import { useRegistrationAddress } from "@/features/registration/useRegistrationAddress";

type SubmissionState = "idle" | "submitting" | "success" | "partial";

const inputIdByField: Partial<Record<keyof ClientRegistrationFormState, string>> = {
  name: "client-name",
  email: "client-email",
  password: "client-password",
  document: "client-document",
  phone: "client-phone",
  observation: "client-observation",
  corporateName: "client-corporate-name",
  birthDate: "client-birth-date",
  gender: "client-gender",
  number: "registration-number",
  street: "registration-street",
  city: "registration-city",
  postalCode: "registration-postal-code",
  district: "registration-district",
  state: "registration-state",
};

export function ClientRegistrationForm() {
  const router = useRouter();
  const { baseUrl, setToken } = useAuth();
  const [form, setForm] = useState(createClientRegistrationForm);
  const [errors, setErrors] = useState<RegistrationErrors<ClientRegistrationFormState>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const submittingRef = useRef(false);
  useRegistrationAddress(baseUrl, form, setForm);

  const isLoading = submissionState === "submitting";
  const isCompany = form.clientType === clientTypes.company;

  const clearFieldError = (field: keyof ClientRegistrationFormState) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setRequestError(null);
  };

  const updateField = <K extends keyof ClientRegistrationFormState>(
    field: K,
    value: ClientRegistrationFormState[K]
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    clearFieldError(field);
  };

  const updateAddress = (field: keyof RegistrationAddress, value: string) => {
    const nextValue = field === "postalCode" ? formatCep(value) : value;
    updateField(field, nextValue);
  };

  const selectClientType = (clientType: ClientType) => {
    setForm((current) => changeClientType(current, clientType));
    setErrors((current) => ({
      ...current,
      document: undefined,
      observation: undefined,
      corporateName: undefined,
      birthDate: undefined,
      gender: undefined,
    }));
    setRequestError(null);
  };

  const focusFirstError = (nextErrors: RegistrationErrors<ClientRegistrationFormState>) => {
    const firstField = Object.keys(nextErrors)[0] as keyof ClientRegistrationFormState | undefined;
    const inputId = firstField ? inputIdByField[firstField] : undefined;
    if (inputId) document.getElementById(inputId)?.focus();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;

    const validationErrors = validateClientRegistration(form);
    setErrors(validationErrors);
    setRequestError(null);
    if (Object.keys(validationErrors).length) {
      focusFirstError(validationErrors);
      return;
    }

    submittingRef.current = true;
    setSubmissionState("submitting");
    const document = buildClientRegistrationPayload(form).cpf_Cnpj;
    const registrationResult = await fetchJson(baseUrl, "/api/v1/clientes/cadastros", {
      method: "POST",
      body: buildClientRegistrationPayload(form),
    });

    if (!registrationResult.ok) {
      setRequestError(extractRegistrationError(registrationResult.data, "Não foi possível criar a conta."));
      setSubmissionState("idle");
      submittingRef.current = false;
      return;
    }

    const clientId = extractClientId(registrationResult.data);
    if (!clientId) {
      setRequestError("A conta foi criada, mas o identificador do cliente não foi retornado.");
      setSubmissionState("partial");
      submittingRef.current = false;
      return;
    }

    const loginResult = await fetchJson(baseUrl, "/api/v1/clientes/login", {
      method: "POST",
      body: { cpf_Cnpj: document, senha: form.password },
    });
    const token = extractAccessToken(loginResult.data);
    if (!loginResult.ok || !token) {
      setRequestError("A conta foi criada, mas não foi possível entrar para concluir o perfil. Entre pela tela de login.");
      setSubmissionState("partial");
      submittingRef.current = false;
      return;
    }

    const profileResult = await fetchJson(baseUrl, `/api/v1/clientes/${clientId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: buildClientProfilePayload(form, clientId),
    });
    if (!profileResult.ok) {
      setRequestError(extractRegistrationError(
        profileResult.data,
        "A conta foi criada, mas não foi possível concluir o perfil. Entre para revisar seus dados."
      ));
      setSubmissionState("partial");
      submittingRef.current = false;
      return;
    }

    setSubmissionState("success");
    window.setTimeout(() => {
      setToken(token);
      router.replace(routes.clientHome);
    }, 700);
  };

  return (
    <PublicOnlyRoute>
      <AuthPageLayout
        eyebrow="Novo cadastro"
        title="Criar conta de cliente"
        description="Escolha o tipo de cliente e informe os dados para acessar o SIGO."
        wide
      >
        <form className="grid gap-6 p-6 sm:p-8" onSubmit={handleSubmit} noValidate>
          <fieldset className="grid gap-2" disabled={isLoading}>
            <legend className="text-sm font-black text-[var(--sigo-muted)]">Tipo de cliente</legend>
            <div className="grid gap-2 rounded-lg border border-[var(--sigo-border)] bg-[var(--sigo-surface-soft)] p-1 sm:grid-cols-2">
              {([
                { value: clientTypes.individual, label: "Pessoa física" },
                { value: clientTypes.company, label: "Pessoa jurídica" },
              ] as const).map((option) => {
                const selected = form.clientType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`sigo-button min-h-11 ${selected ? "sigo-button-primary" : "bg-white text-[var(--sigo-text)]"}`}
                    onClick={() => selectClientType(option.value)}
                    aria-pressed={selected}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="grid items-start gap-4 md:grid-cols-2" disabled={isLoading}>
            <legend className="mb-1 text-sm font-black text-[var(--sigo-blue)] md:col-span-2">
              Dados da conta
            </legend>
            <TextInput
              id="client-name"
              name="name"
              label={isCompany ? "Nome do responsável ou nome fantasia" : "Nome completo"}
              value={form.name}
              onChange={(value) => updateField("name", value)}
              maxLength={100}
              autoComplete="name"
              error={errors.name}
              required
            />
            <TextInput
              id="client-email"
              name="email"
              label="E-mail"
              value={form.email}
              onChange={(value) => updateField("email", value)}
              type="email"
              inputMode="email"
              maxLength={254}
              autoComplete="email"
              error={errors.email}
              required
            />
            <TextInput
              id="client-document"
              name="document"
              label={isCompany ? "CNPJ" : "CPF"}
              value={form.document}
              onChange={(value) => updateField("document", isCompany ? formatCnpj(value) : formatCpf(value))}
              placeholder={isCompany ? "00.000.000/0000-00" : "000.000.000-00"}
              inputMode="numeric"
              maxLength={isCompany ? 18 : 14}
              error={errors.document}
              required
            />
            <TextInput
              id="client-password"
              name="password"
              label="Senha"
              value={form.password}
              onChange={(value) => updateField("password", value)}
              type="password"
              autoComplete="new-password"
              maxLength={128}
              helperText="Use de 8 a 128 caracteres, com pelo menos uma letra e um número."
              error={errors.password}
              showPasswordToggle
              required
            />
            <TextInput
              id="client-phone"
              name="phone"
              label="Telefone"
              value={form.phone}
              onChange={(value) => updateField("phone", formatPhone(value))}
              placeholder="(00) 00000-0000"
              inputMode="tel"
              maxLength={15}
              helperText="Opcional. Informe DDD e 8 ou 9 dígitos."
              error={errors.phone}
            />
            {isCompany ? (
              <TextInput
                id="client-corporate-name"
                name="corporateName"
                label="Razão social"
                value={form.corporateName}
                onChange={(value) => updateField("corporateName", value)}
                maxLength={500}
                error={errors.corporateName}
                required
              />
            ) : (
              <>
                <TextInput
                  id="client-birth-date"
                  name="birthDate"
                  label="Data de nascimento"
                  value={form.birthDate}
                  onChange={(value) => updateField("birthDate", value)}
                  type="date"
                  max={getTodayIso()}
                  error={errors.birthDate}
                  required
                />
                <TextInput
                  id="client-observation"
                  name="observation"
                  label="Observação"
                  value={form.observation}
                  onChange={(value) => updateField("observation", value)}
                  maxLength={500}
                  helperText="Opcional."
                  error={errors.observation}
                />
                <div className="sigo-label">
                  <label htmlFor="client-gender">Sexo</label>
                  <select
                    id="client-gender"
                    name="gender"
                    className={`sigo-input ${errors.gender ? "border-[var(--sigo-danger)]" : ""}`.trim()}
                    value={form.gender}
                    onChange={(event) => updateField("gender", event.target.value)}
                    aria-invalid={Boolean(errors.gender)}
                    aria-describedby={errors.gender ? "client-gender-error" : undefined}
                    required
                  >
                    <option value="">Selecione</option>
                    {enumOptionsByKey.sexo.map((option) => (
                      <option key={String(option.value)} value={String(option.value)}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors.gender ? (
                    <span id="client-gender-error" className="text-xs font-semibold text-[var(--sigo-danger)]">
                      {errors.gender}
                    </span>
                  ) : null}
                </div>
              </>
            )}
          </fieldset>

          <AddressFields form={form} errors={errors} disabled={isLoading} onChange={updateAddress} />

          {requestError ? (
            <div className="sigo-error px-4 py-3 text-sm font-semibold leading-6" role="alert">
              {requestError}
            </div>
          ) : null}
          {submissionState === "success" ? (
            <div className="sigo-success px-4 py-3 text-sm font-semibold" role="status">
              Conta criada com sucesso. Abrindo sua área de cliente...
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-[var(--sigo-border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Link className="text-sm font-bold text-[var(--sigo-muted)] hover:text-[var(--sigo-blue)]" href={routes.login}>
              Voltar para o login
            </Link>
            {submissionState === "partial" ? (
              <Link className="sigo-button sigo-button-primary" href={routes.login}>
                Ir para o login
              </Link>
            ) : (
              <RegistrationFooter isLoading={isLoading || submissionState === "success"} submitLabel="Criar conta" />
            )}
          </div>
        </form>
      </AuthPageLayout>
    </PublicOnlyRoute>
  );
}
