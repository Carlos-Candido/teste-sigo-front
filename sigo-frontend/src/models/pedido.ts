export type PedidoPeca = {
  IdPedido: number;
  IdPeca: number;
  Quantidade: number;
  DataInstalacao: string;
  Estado: string;
  Observacao: string;
};

export type PedidoServico = {
  IdPedido: number;
  IdServico: number;
  QuantVezes: number;
};

export default interface Pedido {
  Id: number;
  idCliente: number;
  idFuncionario: number;
  idOficina: number;
  idVeiculo: number;
  ValorTotal: number;
  DescontoReais: number;
  DescontoPorcentagem: number;
  DescontoTotalReais: number;
  DescontoServicoPorcentagem: number;
  DescontoServicoReais: number;
  DescontoPecaPorcentagem: number;
  descontoPecaReais: number;
  Observacao: string;
  DataInicio: string;
  DataFim: string;
  Status: number;
  Pedido_Pecas: PedidoPeca[];
  Pedido_Servicos: PedidoServico[];
}
