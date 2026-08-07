import { fetchJson } from "@/lib/api";
import { onlyDigits } from "@/lib/fieldMetadata";

export type CepAddress = {
  rua?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  complemento?: string;
  pais?: string;
};

const pickString = (
  record: Record<string, unknown>,
  keys: string[]
): string => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

export const fetchCepAddress = async (
  baseUrl: string,
  cep: string,
  headers?: HeadersInit
): Promise<CepAddress | null> => {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return null;

  const result = await fetchJson(baseUrl, `/api/v1/ceps/${digits}`, {
    method: "GET",
    headers,
  });

  if (result.ok && result.data && typeof result.data === "object") {
    const envelope = result.data as Record<string, unknown>;
    const data =
      envelope.data && typeof envelope.data === "object"
        ? (envelope.data as Record<string, unknown>)
        : envelope.Data && typeof envelope.Data === "object"
          ? (envelope.Data as Record<string, unknown>)
          : envelope;

    if (data.erro === true || data.erro === "true") return null;

    return {
      rua: pickString(data, ["logradouro", "Rua", "rua"]),
      bairro: pickString(data, ["bairro", "Bairro"]),
      cidade: pickString(data, ["localidade", "cidade", "Cidade"]),
      estado: pickString(data, ["uf", "Estado", "estado"]),
      complemento: pickString(data, ["complemento", "Complemento"]),
      pais: "Brasil",
    };
  }

  try {
    const viaCepResponse = await fetch(
      `https://viacep.com.br/ws/${digits}/json/`
    );
    if (!viaCepResponse.ok) return null;

    const data = (await viaCepResponse.json()) as Record<string, unknown>;
    if (data.erro === true || data.erro === "true") return null;

    return {
      rua: pickString(data, ["logradouro"]),
      bairro: pickString(data, ["bairro"]),
      cidade: pickString(data, ["localidade"]),
      estado: pickString(data, ["uf"]),
      complemento: pickString(data, ["complemento"]),
      pais: "Brasil",
    };
  } catch {
    return null;
  }
};
