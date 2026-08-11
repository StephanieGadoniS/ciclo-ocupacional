// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AGENDAMENTOS_DE_DEMONSTRACAO } from "@/src/modulos/agendamentos/apresentacao/dados-de-demonstracao";
import { STATUS_DO_AGENDAMENTO } from "@/src/modulos/agendamentos/dominio/tipos-do-agendamento";
import type {
  AgendamentoParaPainel,
  DadosDoNovoHorario,
} from "@/src/modulos/agendamentos/apresentacao/tipos-do-painel";
import { ModalAgendarExame } from "./modal-agendar-exame";

const agendamento: AgendamentoParaPainel = {
  ...AGENDAMENTOS_DE_DEMONSTRACAO[0],
  dataDeReferencia: "2026-08-19",
  dataLimite: "2026-08-19",
};

const recursos = [
  {
    id: "agenda-medicina",
    nome: "Medicina do Trabalho",
    duracaoEmMinutos: 30,
  },
];

function renderizarModal({
  agendamentoAtual = agendamento,
  agendamentos,
  aoSalvar = vi.fn(async () => null),
}: {
  agendamentoAtual?: AgendamentoParaPainel;
  agendamentos?: AgendamentoParaPainel[];
  aoSalvar?: (
    dados: DadosDoNovoHorario,
  ) => Promise<string | null> | string | null;
} = {}) {
  render(
    <ModalAgendarExame
      agendamento={agendamentoAtual}
      agendamentos={agendamentos ?? [agendamentoAtual]}
      recursos={recursos}
      aoFechar={vi.fn()}
      aoSalvar={aoSalvar}
    />,
  );

  return { aoSalvar };
}

function selecionarData(data = "2026-08-10") {
  fireEvent.change(screen.getByLabelText("Data"), {
    target: { value: data },
  });
}

describe("Modal de agendamento da clínica", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T12:00:00.000Z"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("pré-seleciona a agenda única e mostra horários dentro do expediente", () => {
    renderizarModal();
    selecionarData();

    expect(screen.getByLabelText("Agenda responsável")).toHaveTextContent(
      "Medicina do Trabalho30 min",
    );
    expect(
      screen.queryByRole("combobox", { name: "Agenda responsável" }),
    ).not.toBeInTheDocument();
    const grade = screen.getByRole("group", { name: "Horários livres" });
    expect(within(grade).getAllByRole("button")).toHaveLength(20);
    expect(within(grade).getByRole("button", { name: "08:00" })).toBeVisible();
    expect(within(grade).getByRole("button", { name: "17:30" })).toBeVisible();
    expect(screen.queryByLabelText("Horário")).not.toBeInTheDocument();
  });

  it("oculta um horário já ocupado na agenda de Medicina do Trabalho", () => {
    const horarioOcupado: AgendamentoParaPainel = {
      ...AGENDAMENTOS_DE_DEMONSTRACAO[1],
      id: "agendamento-ocupado",
      status: STATUS_DO_AGENDAMENTO.AGENDADO,
      recursoDaClinicaId: "agenda-medicina",
      recursoDaClinicaNome: "Medicina do Trabalho",
      inicioAgendado: "2026-08-10T15:30:00-03:00",
      fimAgendado: "2026-08-10T16:00:00-03:00",
    };
    renderizarModal({ agendamentos: [agendamento, horarioOcupado] });

    selecionarData();
    expect(
      screen.queryByRole("button", { name: "15:30" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "16:00" })).toBeVisible();
  });

  it("recusa sábado e domingo sem oferecer horários", () => {
    renderizarModal();
    selecionarData("2026-08-09");

    expect(
      screen.getByText(
        "A clínica atende somente de segunda a sexta-feira. Escolha um dia útil.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Horários livres" }),
    ).not.toBeInTheDocument();
  });

  it("permite reagendar um não comparecimento depois do prazo original", () => {
    const naoCompareceu: AgendamentoParaPainel = {
      ...agendamento,
      status: STATUS_DO_AGENDAMENTO.NAO_COMPARECEU,
      dataDeReferencia: "2026-08-01",
      dataLimite: "2026-08-01",
      recursoDaClinicaId: "agenda-medicina",
      recursoDaClinicaNome: "Medicina do Trabalho",
      inicioAgendado: "2026-08-01T09:00:00-03:00",
      fimAgendado: "2026-08-01T09:30:00-03:00",
    };
    renderizarModal({ agendamentoAtual: naoCompareceu });

    expect(screen.getByLabelText("Data")).not.toHaveAttribute("max");
    selecionarData("2026-08-10");

    expect(screen.getByRole("button", { name: "08:00" })).toBeVisible();
    expect(
      screen.getByText(/O prazo original encerrou, mas este atendimento pode ser reagendado/i),
    ).toBeInTheDocument();
  });

  it("envia o horário clicado com duração de 30 minutos", async () => {
    const aoSalvar = vi.fn(async () => null);
    renderizarModal({ aoSalvar });
    selecionarData();
    fireEvent.click(screen.getByRole("button", { name: "15:30" }));

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Confirmar horário" }),
      );
    });

    expect(aoSalvar).toHaveBeenCalledWith({
      recursoDaClinicaId: "agenda-medicina",
      recursoDaClinicaNome: "Medicina do Trabalho",
      inicio: "2026-08-10T15:30:00-03:00",
      fim: "2026-08-10T19:00:00.000Z",
    });
  });
});
