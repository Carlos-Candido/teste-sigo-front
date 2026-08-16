import { describe, expect, it } from "vitest";
import {
  buildClientProfilePayload,
  changeClientType,
  clientTypes,
  createClientRegistrationForm,
  createOfficeRegistrationForm,
  isValidCnpj,
  isValidCpf,
  validateClientRegistration,
  validateOfficeRegistration,
} from "@/features/registration/registration";

const createValidClient = () => ({
  ...createClientRegistrationForm(),
  name: "Maria da Silva",
  email: "maria@example.com",
  password: "Senha123",
  document: "529.982.247-25",
  phone: "(47) 99999-9999",
  birthDate: "1990-05-10",
  gender: "2",
  number: "120",
  street: "Rua das Flores",
  city: "Blumenau",
  postalCode: "89010-000",
  district: "Centro",
  state: "SC",
});

describe("cadastro público", () => {
  it("valida os dígitos verificadores de CPF e CNPJ", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.111.111/1111-11")).toBe(false);
  });

  it("limpa documento e estado incompatível ao trocar o tipo de cliente", () => {
    const physical = {
      ...createValidClient(),
      document: "529.982.247-25",
      observation: "Prefere contato por telefone",
      corporateName: "valor indevido",
    };

    const company = changeClientType(physical, clientTypes.company);
    expect(company.document).toBe("");
    expect(company.observation).toBe("");

    const physicalAgain = changeClientType(
      { ...company, document: "11.222.333/0001-81", corporateName: "Empresa SIGO Ltda." },
      clientTypes.individual
    );
    expect(physicalAgain.document).toBe("");
    expect(physicalAgain.corporateName).toBe("");
  });

  it("não envia Razão Social para pessoa física", () => {
    const payload = buildClientProfilePayload(
      { ...createValidClient(), observation: "Cadastro físico" },
      42
    );

    expect(payload).toHaveProperty("obs", "Cadastro físico");
    expect(payload).not.toHaveProperty("razao");
    expect(payload.tipoCliente).toBe(1);
  });

  it("não envia Obs para pessoa jurídica", () => {
    const payload = buildClientProfilePayload(
      {
        ...createValidClient(),
        clientType: clientTypes.company,
        document: "11.222.333/0001-81",
        corporateName: "Empresa SIGO Ltda.",
        observation: "valor indevido",
      },
      43
    );

    expect(payload).toHaveProperty("razao", "Empresa SIGO Ltda.");
    expect(payload).not.toHaveProperty("obs");
    expect(payload.tipoCliente).toBe(2);
  });

  it("exige Razão Social somente para pessoa jurídica", () => {
    const company = {
      ...createValidClient(),
      clientType: clientTypes.company,
      document: "11.222.333/0001-81",
      corporateName: "",
    };
    expect(validateClientRegistration(company).corporateName).toBe("Informe a razão social.");
    expect(validateClientRegistration(createValidClient()).corporateName).toBeUndefined();
  });

  it("valida o DTO real da oficina antes do envio", () => {
    const office = {
      ...createOfficeRegistrationForm(),
      name: "Oficina SIGO",
      email: "oficina@example.com",
      password: "Senha123",
      document: "11.222.333/0001-81",
      number: "80",
      street: "Rua Azul",
      city: "Blumenau",
      postalCode: "89010-000",
      district: "Centro",
      state: "SC",
    };
    expect(validateOfficeRegistration(office)).toEqual({});
  });
});
