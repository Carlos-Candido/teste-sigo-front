"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AuthPageLayout } from "@/components/Auth/AuthPageLayout";
import { PublicOnlyRoute } from "@/components/Auth/RouteGuards";
import { TextInput } from "@/components/Form/TextInput";
import { useAuth } from "@/hooks/useAuth";
import { fetchJson } from "@/lib/api";
import { formatCep, formatCnpj } from "@/lib/fieldMetadata";
import { routes } from "@/navigation/routes";
import { AddressFields, RegistrationFooter } from "@/features/registration/RegistrationFields";
import {
  buildOfficeRegistrationPayload,
  createOfficeRegistrationForm,
  extractAccessToken,
  extractRegistrationError,
  validateOfficeRegistration,
  type OfficeRegistrationForm as OfficeRegistrationFormState,
  type RegistrationAddress,
  type RegistrationErrors,
} from "@/features/registration/registration";
import { useRegistrationAddress } from "@/features/registration/useRegistrationAddress";

type SubmissionState = "idle" | "submitting" | "success" | "partial";

const inputIdByField: Partial<Record<keyof OfficeRegistrationFormState, string>> = {
  name: "office-name",
  email: "office-email",
  password: "office-password",
  document: "office-document",
  number: "registration-number",
  street: "registration-street",
  city: "registration-city",
  postalCode: "registration-postal-code",
  district: "registration-district",
  state: "registration-state",
};

export function OfficeRegistrationForm() {
  const router = useRouter();
  const { baseUrl, setToken } = useAuth();
  const [form, setForm] = useState(createOfficeRegistrationForm);
  const [errors, setErrors] = useState<RegistrationErrors<OfficeRegistrationFormState>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const submittingRef = useRef(false);
  useRegistrationAddress(baseUrl, form, setForm);

  const isLoading = submissionState === "submitting";

  const updateField = <K extends keyof OfficeRegistrationFormState>(
    field: K,
    value: OfficeRegistrationFormState[K]
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setRequestError(null);
  };

  const updateAddress = (field: keyof RegistrationAddress, value: string) => {
    updateField(field, field === "postalCode" ? formatCep(value) : value);
  };

  const focusFirstError = (nextErrors: RegistrationErrors<OfficeRegistrationFormState>) => {
    const firstField = Object.keys(nextErrors)[0] as keyof OfficeRegistrationFormState | undefined;
    const inputId = firstField ? inputIdByField[firstField] : undefined;
    if (inputId) document.getElementById(inputId)?.focus();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;

    const validationErrors = validateOfficeRegistration(form);
    setErrors(validationErrors);
    setRequestError(null);
    if (Object.keys(validationErrors).length) {
      focusFirstError(validationErrors);
      return;
    }

    submittingRef.current = true;
    setSubmissionState("submitting");
    const registrationResult = await fetchJson(baseUrl, "/api/v1/oficinas", {
      method: "POST",
      body: buildOfficeRegistrationPayload(form),
    });
    if (!registrationResult.ok) {
      setRequestError(extractRegistrationError(registrationResult.data, "Não foi possível cadastrar a oficina."));
      setSubmissionState("idle");
      submittingRef.current = false;
      return;
    }

    const loginResult = await fetchJson(baseUrl, "/api/v1/oficinas/login", {
      method: "POST",
      body: {
        email: form.email.trim().toLowerCase(),
        password: form.password,
      },
    });
    const token = extractAccessToken(loginResult.data);
    if (!loginResult.ok || !token) {
      setRequestError("A oficina foi criada, mas não foi possível entrar automaticamente. Entre pela tela de login.");
      setSubmissionState("partial");
      submittingRef.current = false;
      return;
    }

    setSubmissionState("success");
    window.setTimeout(() => {
      setToken(token);
      router.replace(routes.dashboard);
    }, 700);
  };

  return (
    <PublicOnlyRoute>
      <AuthPageLayout
        eyebrow="Novo cadastro"
        title="Cadastrar oficina"
        description="Crie a conta da oficina com os dados reais usados pelo SIGO."
        wide
      >
        <form className="grid gap-6 p-6 sm:p-8" onSubmit={handleSubmit} noValidate>
          <fieldset className="grid gap-4 md:grid-cols-2" disabled={isLoading}>
            <legend className="mb-1 text-sm font-black text-[var(--sigo-blue)] md:col-span-2">
              Dados da oficina
            </legend>
            <TextInput
              id="office-name"
              name="name"
              label="Nome da oficina"
              value={form.name}
              onChange={(value) => updateField("name", value)}
              maxLength={100}
              autoComplete="organization"
              error={errors.name}
              required
            />
            <TextInput
              id="office-email"
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
              id="office-document"
              name="document"
              label="CNPJ"
              value={form.document}
              onChange={(value) => updateField("document", formatCnpj(value))}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
              maxLength={18}
              error={errors.document}
              required
            />
            <TextInput
              id="office-password"
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
          </fieldset>

          <AddressFields form={form} errors={errors} disabled={isLoading} onChange={updateAddress} />

          {requestError ? (
            <div className="sigo-error px-4 py-3 text-sm font-semibold leading-6" role="alert">
              {requestError}
            </div>
          ) : null}
          {submissionState === "success" ? (
            <div className="sigo-success px-4 py-3 text-sm font-semibold" role="status">
              Oficina cadastrada com sucesso. Abrindo o painel...
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
              <RegistrationFooter isLoading={isLoading || submissionState === "success"} submitLabel="Cadastrar oficina" />
            )}
          </div>
        </form>
      </AuthPageLayout>
    </PublicOnlyRoute>
  );
}
