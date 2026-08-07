import type {
  CrudConfig,
  ListFieldConfig,
  SearchConfig,
  ActionConfig,
} from "@/components/Table/CrudPanel";

const telefoneTemplate = {
  Id: 0,
  Numero: "",
  DDD: 0,
  ClienteId: 0,
};

const pedidoPecaTemplate = {
  IdPedido: 0,
  IdPeca: 0,
  Quantidade: 0,
  DataInstalacao: "2026-01-01",
  Estado: "",
  Observacao: "",
};

const pedidoServicoTemplate = {
  IdPedido: 0,
  IdServico: 0,
  QuantVezes: 1,
};

const funcionarioServicoTemplate = {
  IdFuncionario: 0,
  IdServico: 0,
  TempoDec: "",
};

const clienteListFields: ListFieldConfig[] = [
  {
    key: "Telefones",
    label: "Telefone",
    itemTemplate: telefoneTemplate,
  },
];

const servicoListFields: ListFieldConfig[] = [
  {
    key: "Funcionario_Servicos",
    label: "Funcionario_Servico",
    itemTemplate: funcionarioServicoTemplate,
  },
];

const pedidoListFields: ListFieldConfig[] = [
  {
    key: "Pedido_Pecas",
    label: "Pedido_Peca",
    itemTemplate: pedidoPecaTemplate,
  },
  {
    key: "Pedido_Servicos",
    label: "Pedido_Servico",
    itemTemplate: pedidoServicoTemplate,
  },
];

const clienteSearches: SearchConfig[] = [
  {
    label: "Nome",
    placeholder: "nome",
    path: (value) => `/api/v1/clientes/nome/${value}`,
  },
  {
    label: "Oficina",
    placeholder: "oficinaId",
    path: (value) => `/api/v1/clientes/oficinas/${value}`,
  },
];

const funcionarioSearches: SearchConfig[] = [
  {
    label: "Nome",
    placeholder: "nome",
    path: (value) => `/api/v1/funcionarios/nome/${value}`,
  },
];

const oficinaSearches: SearchConfig[] = [
  {
    label: "Nome",
    placeholder: "nome",
    path: (value) => `/api/v1/oficinas/nome/${value}`,
  },
];

const marcaSearches: SearchConfig[] = [
  {
    label: "Nome",
    placeholder: "nomeMarca",
    path: (value) => `/api/v1/marcas/nome/${value}`,
  },
];

const servicoSearches: SearchConfig[] = [
  {
    label: "Nome",
    placeholder: "nome",
    path: (value) => `/api/v1/servicos/nome/${value}`,
  },
];

const veiculoSearches: SearchConfig[] = [
  {
    label: "Placa",
    placeholder: "placa",
    path: (value) => `/api/v1/veiculos/placa/${value}`,
  },
  {
    label: "Tipo",
    placeholder: "tipo",
    path: (value) => `/api/v1/veiculos/tipo/${value}`,
  },
];

const telefoneSearches: SearchConfig[] = [
  {
    label: "Nome",
    placeholder: "nome",
    path: (value) => `/api/v1/telefones/nome/${value}`,
  },
];

const pedidoActions: ActionConfig[] = [
  {
    label: "Meus servicos",
    path: "/api/v1/pedidos/me/servicos",
  },
  {
    label: "Meus funcionarios",
    path: "/api/v1/pedidos/me/funcionarios",
  },
];

export const entityConfigs: CrudConfig[] = [
  {
    key: "clientes",
    label: "Cliente",
    description: "CRUD de clientes e telefones.",
    listPath: "/api/v1/clientes",
    getByIdPath: (id) => `/api/v1/clientes/${id}`,
    createPath: "/api/v1/clientes",
    updatePath: (id) => `/api/v1/clientes/${id}`,
    deletePath: (id) => `/api/v1/clientes/${id}`,
    searches: clienteSearches,
    template: {
      Id: 0,
      Nome: "",
      Email: "",
      Cpf_Cnpj: "",
      Obs: "",
      razao: "",
      DataNasc: "2026-01-01",
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
      Situacao: 1,
      Telefones: [telefoneTemplate],
    },
    listFields: clienteListFields,
  },
  {
    key: "oficinas",
    label: "Oficina",
    listPath: "/api/v1/oficinas",
    getByIdPath: (id) => `/api/v1/oficinas/${id}`,
    createPath: "/api/v1/oficinas",
    updatePath: (id) => `/api/v1/oficinas/${id}`,
    deletePath: (id) => `/api/v1/oficinas/${id}`,
    searches: oficinaSearches,
    template: {
      Id: 0,
      Nome: "",
      CNPJ: "",
      Email: "",
      Numero: 0,
      Rua: "",
      Cidade: "",
      Cep: 0,
      Bairro: "",
      Estado: "",
      Pais: "",
      Complemento: "",
      Senha: "",
      Situacao: 1,
    },
  },
  {
    key: "funcionarios",
    label: "Funcionario",
    listPath: "/api/v1/funcionarios",
    getByIdPath: (id) => `/api/v1/funcionarios/${id}`,
    createPath: "/api/v1/funcionarios",
    updatePath: (id) => `/api/v1/funcionarios/${id}`,
    deletePath: (id) => `/api/v1/funcionarios/${id}`,
    searches: funcionarioSearches,
    template: {
      Id: 0,
      Nome: "",
      Cpf: "",
      Cargo: "",
      Senha: "",
      Email: "",
      IdOficina: 0,
      Situacao: 1,
    },
  },
  {
    key: "marcas",
    label: "Marca",
    listPath: "/api/v1/marcas",
    getByIdPath: (id) => `/api/v1/marcas/${id}`,
    createPath: "/api/v1/marcas",
    updatePath: (id) => `/api/v1/marcas/${id}`,
    deletePath: (id) => `/api/v1/marcas/${id}`,
    searches: marcaSearches,
    template: {
      Id: 0,
      Nome: "",
      Desc: "",
      TipoMarca: "",
    },
  },
  {
    key: "servicos",
    label: "Servico",
    listPath: "/api/v1/servicos",
    getByIdPath: (id) => `/api/v1/servicos/${id}`,
    createPath: "/api/v1/servicos",
    updatePath: (id) => `/api/v1/servicos/${id}`,
    deletePath: (id) => `/api/v1/servicos/${id}`,
    searches: servicoSearches,
    template: {
      Id: 0,
      Nome: "",
      Descricao: "",
      Valor: 0,
      Garantia: "2026-01-01",
      IdOficina: 0,
      Funcionario_Servicos: [funcionarioServicoTemplate],
    },
    listFields: servicoListFields,
  },
  {
    key: "pecas",
    label: "Peca",
    listPath: "/api/v1/pecas",
    getByIdPath: (id) => `/api/v1/pecas/${id}`,
    createPath: "/api/v1/pecas",
    updatePath: (id) => `/api/v1/pecas/${id}`,
    deletePath: (id) => `/api/v1/pecas/${id}`,
    template: {
      Id: 0,
      Nome: "",
      Tipo: "",
      Descricao: "",
      Valor: 0,
      Quantidade: 0,
      Garantia: "2026-01-01",
      Unidade: 0,
      IdMarca: 0,
      DataAquisicao: "2026-01-01",
      Fornecedor: "",
      IdOficina: 0,
    },
  },
  {
    key: "pedidos",
    label: "Pedido",
    listPath: "/api/v1/pedidos",
    getByIdPath: (id) => `/api/v1/pedidos/${id}`,
    createPath: "/api/v1/pedidos",
    updatePath: (id) => `/api/v1/pedidos/${id}`,
    deletePath: (id) => `/api/v1/pedidos/${id}`,
    actions: pedidoActions,
    template: {
      Id: 0,
      idCliente: 0,
      idFuncionario: 0,
      idOficina: 0,
      idVeiculo: 0,
      ValorTotal: 0,
      DescontoReais: 0,
      DescontoPorcentagem: 0,
      DescontoTotalReais: 0,
      DescontoServicoPorcentagem: 0,
      DescontoServicoReais: 0,
      DescontoPecaPorcentagem: 0,
      descontoPecaReais: 0,
      Observacao: "",
      DataInicio: "2026-01-01",
      DataFim: "2026-01-02",
      Pedido_Pecas: [pedidoPecaTemplate],
      Pedido_Servicos: [pedidoServicoTemplate],
    },
    listFields: pedidoListFields,
  },
  {
    key: "telefones",
    label: "Telefone",
    getByIdPath: (id) => `/api/v1/telefones/${id}`,
    createPath: "/api/v1/telefones",
    updatePath: (id) => `/api/v1/telefones/${id}`,
    deletePath: (id) => `/api/v1/telefones/${id}`,
    searches: telefoneSearches,
    template: telefoneTemplate,
  },
  {
    key: "veiculos",
    label: "Veiculo",
    listPath: "/api/v1/veiculos",
    getByIdPath: (id) => `/api/v1/veiculos/${id}`,
    createPath: "/api/v1/veiculos",
    updatePath: (id) => `/api/v1/veiculos/${id}`,
    deletePath: (id) => `/api/v1/veiculos/${id}`,
    searches: veiculoSearches,
    template: {
      Id: 0,
      NomeVeiculo: "",
      TipoVeiculo: "",
      PlacaVeiculo: "",
      ChassiVeiculo: "",
      AnoFab: 2020,
      Quilometragem: 0,
      Combustivel: "",
      Seguro: "",
      Cor: "",
      ClienteId: 0,
      Status: 1,
    },
  },
];
