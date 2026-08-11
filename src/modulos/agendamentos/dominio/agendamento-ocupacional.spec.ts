import { describe, expect, it } from "vitest";
import { AgendamentoOcupacional } from "./agendamento-ocupacional";
import { ErroDeDominio } from "./erro-de-dominio";
import {
  PERIODOS_PREFERIDOS,
  STATUS_DO_AGENDAMENTO,
  TIPOS_DE_EXAME,
} from "./tipos-do-agendamento";

function criarSolicitacao() {
  return AgendamentoOcupacional.solicitar(
    {
      id: "agendamento-1",
      empresaId: "empresa-1",
      clinicaId: "clinica-1",
      colaboradorId: "colaborador-1",
      tipoDeExame: TIPOS_DE_EXAME.ADMISSIONAL,
      dataDeReferencia: "2026-08-15",
      periodoPreferido: PERIODOS_PREFERIDOS.MANHA,
      criadoPor: "usuario-rh",
      criadoEm: "2026-08-05T12:00:00.000Z",
    },
    "evento-1",
  ).agendamento;
}

describe("Agendamento ocupacional", () => {
  it("nasce com o status solicitado e sem horário", () => {
    const dados = criarSolicitacao().obterDados();

    expect(dados.status).toBe(STATUS_DO_AGENDAMENTO.SOLICITADO);
    expect(dados.inicioAgendado).toBeNull();
  });

  it("pode ser agendado e depois concluído", () => {
    const agendado = criarSolicitacao().agendar(
      {
        recursoDaClinicaId: "agenda-1",
        inicio: "2026-08-10T09:00:00-03:00",
        fim: "2026-08-10T09:30:00-03:00",
      },
      {
        eventoId: "evento-2",
        realizadoPor: "usuario-clinica",
        ocorridoEm: "2026-08-05T13:00:00.000Z",
      },
    ).agendamento;

    const resultado = agendado.concluir({
      eventoId: "evento-3",
      realizadoPor: "usuario-clinica",
      ocorridoEm: "2026-08-10T12:35:00.000Z",
    });

    expect(resultado.agendamento.obterDados().status).toBe(
      STATUS_DO_AGENDAMENTO.REALIZADO,
    );
    expect(resultado.evento.statusAnterior).toBe(
      STATUS_DO_AGENDAMENTO.AGENDADO,
    );
  });

  it("não permite concluir uma solicitação sem horário confirmado", () => {
    expect(() =>
      criarSolicitacao().concluir({
        eventoId: "evento-2",
        realizadoPor: "usuario-clinica",
        ocorridoEm: "2026-08-05T13:00:00.000Z",
      }),
    ).toThrowError(ErroDeDominio);
  });

  it("não permite criar solicitação com data de referência no passado", () => {
    expect(() =>
      AgendamentoOcupacional.solicitar(
        {
          id: "agendamento-2",
          empresaId: "empresa-1",
          clinicaId: "clinica-1",
          colaboradorId: "colaborador-1",
          tipoDeExame: TIPOS_DE_EXAME.ADMISSIONAL,
          dataDeReferencia: "2026-08-04",
          periodoPreferido: PERIODOS_PREFERIDOS.MANHA,
          criadoPor: "usuario-rh",
          criadoEm: "2026-08-05T12:00:00.000Z",
        },
        "evento-2",
      ),
    ).toThrowError("A data de referência não pode estar no passado.");
  });

  it("não permite agendar no passado", () => {
    expect(() =>
      criarSolicitacao().agendar(
        {
          recursoDaClinicaId: "agenda-1",
          inicio: "2026-08-05T08:00:00-03:00",
          fim: "2026-08-05T08:30:00-03:00",
        },
        {
          eventoId: "evento-2",
          realizadoPor: "usuario-clinica",
          ocorridoEm: "2026-08-05T12:00:00.000Z",
        },
      ),
    ).toThrowError("Não é possível agendar um atendimento no passado.");
  });

  it("não permite agendar depois do prazo ocupacional", () => {
    expect(() =>
      criarSolicitacao().agendar(
        {
          recursoDaClinicaId: "agenda-1",
          inicio: "2026-08-16T09:00:00-03:00",
          fim: "2026-08-16T09:30:00-03:00",
        },
        {
          eventoId: "evento-2",
          realizadoPor: "usuario-clinica",
          ocorridoEm: "2026-08-05T12:00:00.000Z",
        },
      ),
    ).toThrowError(
      "O atendimento não pode ser agendado depois do prazo ocupacional.",
    );
  });

  it.each([
    ["sábado", "2026-08-08T09:00:00-03:00", "2026-08-08T09:30:00-03:00"],
    ["domingo", "2026-08-09T09:00:00-03:00", "2026-08-09T09:30:00-03:00"],
  ])("não permite agendar no %s", (_dia, inicio, fim) => {
    expect(() =>
      criarSolicitacao().agendar(
        {
          recursoDaClinicaId: "agenda-1",
          inicio,
          fim,
        },
        {
          eventoId: "evento-2",
          realizadoPor: "usuario-clinica",
          ocorridoEm: "2026-08-05T12:00:00.000Z",
        },
      ),
    ).toThrowError("A clínica atende somente de segunda a sexta-feira.");
  });

  it("exige que o horário de início use intervalos de 30 minutos", () => {
    expect(() =>
      criarSolicitacao().agendar(
        {
          recursoDaClinicaId: "agenda-1",
          inicio: "2026-08-10T15:50:00-03:00",
          fim: "2026-08-10T16:20:00-03:00",
        },
        {
          eventoId: "evento-2",
          realizadoPor: "usuario-clinica",
          ocorridoEm: "2026-08-05T12:00:00.000Z",
        },
      ),
    ).toThrowError("O horário de início deve usar intervalos de 30 minutos.");
  });

  it.each([
    ["antes da abertura", "2026-08-10T07:30:00-03:00", "2026-08-10T08:00:00-03:00"],
    ["depois do fechamento", "2026-08-10T17:30:00-03:00", "2026-08-10T18:30:00-03:00"],
  ])("não permite atendimento %s", (_cenario, inicio, fim) => {
    expect(() =>
      criarSolicitacao().agendar(
        {
          recursoDaClinicaId: "agenda-1",
          inicio,
          fim,
        },
        {
          eventoId: "evento-2",
          realizadoPor: "usuario-clinica",
          ocorridoEm: "2026-08-05T12:00:00.000Z",
        },
      ),
    ).toThrowError("A clínica realiza atendimentos entre 08:00 e 18:00.");
  });

  it("não permite registrar comparecimento antes do horário", () => {
    const agendado = criarSolicitacao().agendar(
      {
        recursoDaClinicaId: "agenda-1",
        inicio: "2026-08-10T09:00:00-03:00",
        fim: "2026-08-10T09:30:00-03:00",
      },
      {
        eventoId: "evento-2",
        realizadoPor: "usuario-clinica",
        ocorridoEm: "2026-08-05T12:00:00.000Z",
      },
    ).agendamento;

    expect(() =>
      agendado.registrarNaoComparecimento({
        eventoId: "evento-3",
        realizadoPor: "usuario-clinica",
        ocorridoEm: "2026-08-10T11:59:00.000Z",
      }),
    ).toThrowError(
      "O comparecimento só pode ser registrado após o início do atendimento.",
    );
  });

  it("permite reagendar depois de um não comparecimento mesmo após o prazo original", () => {
    const agendado = criarSolicitacao().agendar(
      {
        recursoDaClinicaId: "agenda-1",
        inicio: "2026-08-10T09:00:00-03:00",
        fim: "2026-08-10T09:30:00-03:00",
      },
      {
        eventoId: "evento-2",
        realizadoPor: "usuario-clinica",
        ocorridoEm: "2026-08-05T12:00:00.000Z",
      },
    ).agendamento;
    const faltou = agendado.registrarNaoComparecimento({
      eventoId: "evento-3",
      realizadoPor: "usuario-clinica",
      ocorridoEm: "2026-08-10T12:30:00.000Z",
    }).agendamento;

    const reagendado = faltou.agendar(
      {
        recursoDaClinicaId: "agenda-1",
        inicio: "2026-08-17T09:00:00-03:00",
        fim: "2026-08-17T09:30:00-03:00",
      },
      {
        eventoId: "evento-4",
        realizadoPor: "usuario-clinica",
        ocorridoEm: "2026-08-10T12:35:00.000Z",
      },
    ).agendamento;

    expect(reagendado.obterDados().status).toBe(
      STATUS_DO_AGENDAMENTO.AGENDADO,
    );
    expect(
      faltou.cancelar("Empresa encerrou a solicitação.", {
        eventoId: "evento-5",
        realizadoPor: "usuario-rh",
        ocorridoEm: "2026-08-10T12:40:00.000Z",
      }).agendamento.obterDados().status,
    ).toBe(STATUS_DO_AGENDAMENTO.CANCELADO);
  });

  it("exige uma justificativa compreensível para cancelar", () => {
    expect(() =>
      criarSolicitacao().cancelar("não", {
        eventoId: "evento-2",
        realizadoPor: "usuario-rh",
        ocorridoEm: "2026-08-05T13:00:00.000Z",
      }),
    ).toThrowError(ErroDeDominio);
  });
});
