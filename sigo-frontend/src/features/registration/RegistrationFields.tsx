import { TextInput } from "@/components/Form/TextInput";
import { stateOptions } from "@/lib/fieldMetadata";
import type {
  RegistrationAddress,
  RegistrationErrors,
} from "@/features/registration/registration";

type AddressFieldsProps<T extends RegistrationAddress> = {
  form: T;
  errors: RegistrationErrors<T>;
  disabled: boolean;
  onChange: (field: keyof RegistrationAddress, value: string) => void;
};

export function AddressFields<T extends RegistrationAddress>({
  form,
  errors,
  disabled,
  onChange,
}: AddressFieldsProps<T>) {
  return (
    <fieldset className="grid gap-4 md:grid-cols-3" disabled={disabled}>
      <legend className="mb-1 text-sm font-black text-[var(--sigo-blue)] md:col-span-3">
        Endereço
      </legend>
      <TextInput
        id="registration-number"
        name="number"
        label="Número"
        value={form.number}
        onChange={(value) => onChange("number", value.replace(/\D/g, "").slice(0, 8))}
        inputMode="numeric"
        error={errors.number}
        required
      />
      <TextInput
        id="registration-street"
        name="street"
        label="Rua"
        value={form.street}
        onChange={(value) => onChange("street", value)}
        className="md:col-span-2"
        maxLength={500}
        error={errors.street}
        required
      />
      <TextInput
        id="registration-city"
        name="city"
        label="Cidade"
        value={form.city}
        onChange={(value) => onChange("city", value)}
        maxLength={500}
        error={errors.city}
        required
      />
      <TextInput
        id="registration-postal-code"
        name="postalCode"
        label="CEP"
        value={form.postalCode}
        onChange={(value) => onChange("postalCode", value)}
        placeholder="00000-000"
        inputMode="numeric"
        maxLength={9}
        error={errors.postalCode}
        required
      />
      <TextInput
        id="registration-district"
        name="district"
        label="Bairro"
        value={form.district}
        onChange={(value) => onChange("district", value)}
        maxLength={500}
        error={errors.district}
        required
      />
      <div className="sigo-label">
        <label htmlFor="registration-state">Estado</label>
        <select
          id="registration-state"
          name="state"
          className={`sigo-input ${errors.state ? "border-[var(--sigo-danger)]" : ""}`.trim()}
          value={form.state}
          onChange={(event) => onChange("state", event.target.value)}
          aria-invalid={Boolean(errors.state)}
          aria-describedby={errors.state ? "registration-state-error" : undefined}
          required
        >
          <option value="">Selecione</option>
          {stateOptions.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.state ? (
          <span id="registration-state-error" className="text-xs font-semibold text-[var(--sigo-danger)]">
            {errors.state}
          </span>
        ) : null}
      </div>
      <TextInput
        id="registration-country"
        name="country"
        label="País"
        value="Brasil"
        onChange={() => undefined}
        disabled
      />
      <TextInput
        id="registration-complement"
        name="complement"
        label="Complemento"
        value={form.complement}
        onChange={(value) => onChange("complement", value)}
        maxLength={500}
      />
    </fieldset>
  );
}

type RegistrationFooterProps = {
  isLoading: boolean;
  submitLabel: string;
};

export function RegistrationFooter({ isLoading, submitLabel }: RegistrationFooterProps) {
  return (
    <button
      type="submit"
      className="sigo-button sigo-button-primary w-full sm:w-auto"
      disabled={isLoading}
    >
      {isLoading ? "Salvando..." : submitLabel}
    </button>
  );
}
