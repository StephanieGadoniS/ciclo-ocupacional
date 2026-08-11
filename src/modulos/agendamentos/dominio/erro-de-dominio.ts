export class ErroDeDominio extends Error {
  constructor(
    mensagem: string,
    public readonly codigo: string,
  ) {
    super(mensagem);
    this.name = "ErroDeDominio";
  }
}
