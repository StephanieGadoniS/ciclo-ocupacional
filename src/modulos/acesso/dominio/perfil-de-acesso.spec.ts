import { describe, expect, it } from "vitest";
import {
  PAGINAS_DO_PAINEL,
  PERFIS_DE_ACESSO,
  obterPaginaPermitida,
  obterPaginasPermitidas,
  podeAcessarPagina,
} from "./perfil-de-acesso";

describe("Perfil de acesso", () => {
  it("permite que o RH gerencie colaboradores, mas não a agenda da clínica", () => {
    expect(
      podeAcessarPagina(
        PERFIS_DE_ACESSO.RH,
        PAGINAS_DO_PAINEL.COLABORADORES,
      ),
    ).toBe(true);
    expect(
      podeAcessarPagina(
        PERFIS_DE_ACESSO.RH,
        PAGINAS_DO_PAINEL.AGENDA_CLINICA,
      ),
    ).toBe(false);
  });

  it("permite que a clínica gerencie sua agenda, mas não o cadastro da empresa", () => {
    expect(
      podeAcessarPagina(
        PERFIS_DE_ACESSO.CLINICA,
        PAGINAS_DO_PAINEL.AGENDA_CLINICA,
      ),
    ).toBe(true);
    expect(
      podeAcessarPagina(
        PERFIS_DE_ACESSO.CLINICA,
        PAGINAS_DO_PAINEL.COLABORADORES,
      ),
    ).toBe(false);
  });

  it("mantém visão geral, agendamentos e configurações como áreas comuns", () => {
    const paginasDoRh = obterPaginasPermitidas(PERFIS_DE_ACESSO.RH);
    const paginasDaClinica = obterPaginasPermitidas(PERFIS_DE_ACESSO.CLINICA);

    for (const pagina of [
      PAGINAS_DO_PAINEL.VISAO_GERAL,
      PAGINAS_DO_PAINEL.AGENDAMENTOS,
      PAGINAS_DO_PAINEL.CONFIGURACOES,
    ]) {
      expect(paginasDoRh).toContain(pagina);
      expect(paginasDaClinica).toContain(pagina);
    }
  });

  it("redireciona uma página proibida para a visão geral", () => {
    expect(
      obterPaginaPermitida(
        PERFIS_DE_ACESSO.CLINICA,
        PAGINAS_DO_PAINEL.COLABORADORES,
      ),
    ).toBe(PAGINAS_DO_PAINEL.VISAO_GERAL);
  });
});

