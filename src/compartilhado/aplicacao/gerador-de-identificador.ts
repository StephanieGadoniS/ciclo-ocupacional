export interface GeradorDeIdentificador {
  gerar(): string;
}

export class GeradorUuid implements GeradorDeIdentificador {
  gerar(): string {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }

    return gerarIdentificadorTemporario();
  }
}

function gerarIdentificadorTemporario(): string {
  const trechoAleatorio = Math.random().toString(36).slice(2, 10);
  return `temporario-${Date.now()}-${trechoAleatorio}`;
}
