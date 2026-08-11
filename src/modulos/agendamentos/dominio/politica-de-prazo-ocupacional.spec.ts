import { describe, expect, it } from "vitest";
import { ErroDeDominio } from "./erro-de-dominio";
import { PoliticaDePrazoOcupacional } from "./politica-de-prazo-ocupacional";
import { STATUS_DO_AGENDAMENTO, TIPOS_DE_EXAME } from "./tipos-do-agendamento";

describe("Política de prazo ocupacional", () => {
  it("calcula dez dias após o desligamento para o exame demissional", () => {
    expect(
      PoliticaDePrazoOcupacional.calcularDataLimite(
        TIPOS_DE_EXAME.DEMISSIONAL,
        "2026-08-05",
      ),
    ).toBe("2026-08-15");
  });

  it("mantém a data de referência como limite no exame admissional", () => {
    expect(
      PoliticaDePrazoOcupacional.calcularDataLimite(
        TIPOS_DE_EXAME.ADMISSIONAL,
        "2026-08-12",
      ),
    ).toBe("2026-08-12");
  });

  it("aceita desligamento recente ainda dentro do prazo demissional", () => {
    expect(() =>
      PoliticaDePrazoOcupacional.validarDataDeReferencia(
        TIPOS_DE_EXAME.DEMISSIONAL,
        "2026-08-01",
        "2026-08-05T12:00:00.000Z",
      ),
    ).not.toThrow();
  });

  it("recusa desligamento cujo prazo demissional já encerrou", () => {
    expect(() =>
      PoliticaDePrazoOcupacional.validarDataDeReferencia(
        TIPOS_DE_EXAME.DEMISSIONAL,
        "2026-07-20",
        "2026-08-05T12:00:00.000Z",
      ),
    ).toThrowError("O prazo de 10 dias do exame demissional já encerrou.");
  });

  it("recusa exame de retorno para afastamento inferior a trinta dias", () => {
    expect(() =>
      PoliticaDePrazoOcupacional.validarDadosEspecificos(
        TIPOS_DE_EXAME.RETORNO_AO_TRABALHO,
        29,
      ),
    ).toThrowError(ErroDeDominio);
  });

  it("sinaliza agendamento marcado depois do prazo", () => {
    expect(
      PoliticaDePrazoOcupacional.classificar(
        {
          status: STATUS_DO_AGENDAMENTO.AGENDADO,
          dataLimite: "2026-08-10",
          inicioAgendado: "2026-08-11T09:00:00-03:00",
        },
        "2026-08-05",
      ),
    ).toBe("atrasado");
  });

  it("coloca em atenção uma solicitação a dois dias do prazo", () => {
    expect(
      PoliticaDePrazoOcupacional.classificar(
        {
          status: STATUS_DO_AGENDAMENTO.SOLICITADO,
          dataLimite: "2026-08-07",
        },
        "2026-08-05",
      ),
    ).toBe("atencao");
  });

  it("descreve a data de referência de acordo com o exame", () => {
    expect(
      PoliticaDePrazoOcupacional.descricaoDaDataDeReferencia(
        TIPOS_DE_EXAME.RETORNO_AO_TRABALHO,
      ),
    ).toBe("Data prevista para retorno");
    expect(
      PoliticaDePrazoOcupacional.orientacaoDaDataDeReferencia(
        TIPOS_DE_EXAME.DEMISSIONAL,
      ),
    ).toContain("término do contrato");
  });
});
