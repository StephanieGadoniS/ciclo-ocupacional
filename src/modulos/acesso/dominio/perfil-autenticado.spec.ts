import { describe, expect, it } from "vitest";
import { obterIniciais, obterPrimeiroNome } from "./perfil-autenticado";

describe("Perfil autenticado", () => {
  it("obtém o primeiro nome para personalizar a saudação", () => {
    expect(obterPrimeiroNome("  Mariana Costa ")).toBe("Mariana");
  });

  it("combina a primeira e a última inicial no avatar", () => {
    expect(obterIniciais("Lucas de Souza Martins")).toBe("LM");
  });
});
