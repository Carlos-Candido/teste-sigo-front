export default interface Peca {
  Id: number;
  Nome: string;
  Tipo: string;
  Descricao: string;
  Valor: number;
  Quantidade: number;
  quantidadeEstoque: number;
  Garantia: string;
  Unidade: number;
  IdMarca: number;
  DataAquisicao: string;
  Fornecedor: string;
  IdOficina?: number | null;
}
