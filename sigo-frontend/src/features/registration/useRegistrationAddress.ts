"use client";

import { useEffect, useRef } from "react";
import { fetchCepAddress } from "@/lib/cep";
import { onlyDigits } from "@/lib/fieldMetadata";
import type { RegistrationAddress } from "@/features/registration/registration";

export function useRegistrationAddress<T extends RegistrationAddress>(
  baseUrl: string,
  form: T,
  setForm: React.Dispatch<React.SetStateAction<T>>
) {
  const lastLookup = useRef("");

  useEffect(() => {
    const postalCode = onlyDigits(form.postalCode);
    if (postalCode.length !== 8 || postalCode === lastLookup.current) return;

    const controller = new AbortController();
    lastLookup.current = postalCode;

    const fillAddress = async () => {
      const address = await fetchCepAddress(baseUrl, postalCode);
      if (!address || controller.signal.aborted) return;
      setForm((current) => ({
        ...current,
        street: address.rua || current.street,
        district: address.bairro || current.district,
        city: address.cidade || current.city,
        state: address.estado || current.state,
        complement: address.complemento || current.complement,
        country: address.pais || current.country,
      }));
    };

    void fillAddress();
    return () => controller.abort();
  }, [baseUrl, form.postalCode, setForm]);
}
