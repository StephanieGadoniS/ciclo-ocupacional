// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PerfilAutenticado } from "@/src/modulos/acesso/dominio/perfil-autenticado";
import { PERFIS_DE_ACESSO } from "@/src/modulos/acesso/dominio/perfil-de-acesso";
import {
  AGENDAMENTOS_DE_DEMONSTRACAO,
  COLABORADORES_DE_DEMONSTRACAO,
} from "@/src/modulos/agendamentos/apresentacao/dados-de-demonstracao";
import type {
  AgendamentoParaPainel,
  EventoDoAgendamentoParaPainel,
} from "@/src/modulos/agendamentos/apresentacao/tipos-do-painel";
import { PainelDoCiclo } from "./painel-do-ciclo";

afterEach(cleanup);

describe("Navegação do painel", () => {
  it("mostra as áreas permitidas para o usuário de RH", () => {
    renderizarPainel(PERFIS_DE_ACESSO.RH);

    expect(
      screen.getByRole("button", { name: /^Colaboradores$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Agenda clínica$/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Colaboradores$/i }));

    expect(
      screen.getByRole("heading", { name: "Colaboradores", level: 1 }),
    ).toBeInTheDocument();
  });

  it("protege a página do RH e abre a agenda para o login da clínica", () => {
    renderizarPainel(PERFIS_DE_ACESSO.CLINICA);

    expect(
      screen.queryByRole("button", { name: /^Colaboradores$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Agenda clínica$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Olá, Lucas/i, level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Usuário RH/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Agenda clínica$/i }));

    expect(
      screen.getByRole("heading", { name: "Agenda clínica", level: 1 }),
    ).toBeInTheDocument();
  });
});

describe("Fluxo operacional por perfil", () => {
  it("abre no RH os registros contabilizados e mantém as ações do perfil", () => {
    renderizarPainel(PERFIS_DE_ACESSO.RH);

    expect(
      screen.getByRole("button", {
        name: "Abrir Aguardando agenda: 1 agendamento",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Abrir Confirmados: 2 agendamentos",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /^Abrir Pedem atenção: \d+ agendamentos?$/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Abrir Realizados: 1 agendamento",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Abrir Aguardando agenda: 1 agendamento",
      }),
    );

    const modalDoIndicador = screen.getByRole("dialog", {
      name: "Aguardando agenda",
    });
    expect(within(modalDoIndicador).getByText("01 agendamento")).toBeInTheDocument();
    expect(
      within(modalDoIndicador).getByRole("button", {
        name: "Ver detalhes de Ana Torres",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(modalDoIndicador).getByRole("button", {
        name: "Ver detalhes de Ana Torres",
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Detalhes da solicitação" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancelar solicitação" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Definir horário" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Manhã")).toBeInTheDocument();
    expect(screen.getByText("***.***.***-42")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Histórico operacional" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Solicitação de exame criada pelo RH."),
    ).toBeInTheDocument();
  });

  it("abre os registros contabilizados no indicador da clínica e permite ver detalhes", () => {
    const hoje = obterDataAtualParaTeste();
    const agendamentoEmAtencao: AgendamentoParaPainel = {
      ...AGENDAMENTOS_DE_DEMONSTRACAO[0],
      id: "agendamento-atencao",
      dataDeReferencia: hoje,
      dataLimite: hoje,
    };
    const agendamentoAtrasado: AgendamentoParaPainel = {
      ...AGENDAMENTOS_DE_DEMONSTRACAO[4],
      id: "agendamento-atrasado",
      dataDeReferencia: "2020-01-01",
      dataLimite: "2020-01-01",
    };
    const agendamentoEmDia: AgendamentoParaPainel = {
      ...AGENDAMENTOS_DE_DEMONSTRACAO[1],
      id: "agendamento-em-dia",
      dataDeReferencia: "2099-12-31",
      dataLimite: "2099-12-31",
      inicioAgendado: "2099-12-30T09:00:00-03:00",
      fimAgendado: "2099-12-30T09:30:00-03:00",
    };

    renderizarPainel(PERFIS_DE_ACESSO.CLINICA, {
      agendamentos: [
        agendamentoEmAtencao,
        agendamentoAtrasado,
        agendamentoEmDia,
      ],
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Abrir Pedem atenção: 2 agendamentos",
      }),
    );

    const modalDoIndicador = screen.getByRole("dialog", {
      name: "Pedem atenção",
    });
    expect(within(modalDoIndicador).getByText("02 agendamentos")).toBeInTheDocument();
    expect(
      within(modalDoIndicador).getByRole("button", {
        name: "Ver detalhes de Ana Torres",
      }),
    ).toBeInTheDocument();
    expect(
      within(modalDoIndicador).getByRole("button", {
        name: "Ver detalhes de Elisa Nunes",
      }),
    ).toBeInTheDocument();
    expect(within(modalDoIndicador).queryByText("Bruno Lima")).not.toBeInTheDocument();

    fireEvent.click(
      within(modalDoIndicador).getByRole("button", {
        name: "Ver detalhes de Ana Torres",
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "Detalhes da solicitação",
      }),
    ).toBeInTheDocument();
  });

  it("permite que somente a clínica registre um atendimento realizado", async () => {
    const agendamento = criarAgendamentoComHorarioIniciado();
    const aoConcluir = vi.fn(async () => null);

    renderizarPainel(PERFIS_DE_ACESSO.CLINICA, {
      agendamentos: [agendamento],
      aoConcluir,
    });

    fireEvent.click(
      screen.getAllByRole("button", { name: /Bruno Lima/i })[0],
    );

    const botaoRealizado = screen.getByRole("button", {
      name: /Marcar como realizado/i,
    });
    expect(botaoRealizado).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /Não compareceu/i }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reagendar" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Cancelar atendimento" }),
    ).toBeEnabled();

    fireEvent.click(botaoRealizado);

    await waitFor(() => expect(aoConcluir).toHaveBeenCalledWith(agendamento.id));
    expect(
      screen.getByRole("status"),
    ).toHaveTextContent("Exame marcado como realizado.");

    cleanup();
    renderizarPainel(PERFIS_DE_ACESSO.RH, {
      agendamentos: [agendamento],
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: /Bruno Lima/i })[0],
    );

    expect(
      screen.queryByRole("button", { name: /Marcar como realizado/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Não compareceu/i }),
    ).not.toBeInTheDocument();
  });

  it("mantém reagendar e cancelar após uma falta com prazo encerrado", () => {
    const naoCompareceu: AgendamentoParaPainel = {
      ...AGENDAMENTOS_DE_DEMONSTRACAO[4],
      dataDeReferencia: "2020-01-01",
      dataLimite: "2020-01-01",
    };
    renderizarPainel(PERFIS_DE_ACESSO.CLINICA, {
      agendamentos: [naoCompareceu],
    });

    fireEvent.click(
      screen.getAllByRole("button", { name: /Elisa Nunes/i })[0],
    );

    expect(screen.getByRole("button", { name: "Reagendar" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Cancelar atendimento" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Não compareceu" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Cancele este fluxo para que o RH possa abrir uma nova solicitação/i),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reagendar" }));
    expect(
      screen.getByRole("heading", { name: "Reagendar exame" }),
    ).toBeInTheDocument();
  });

  it("exige um motivo ao cancelar e envia a justificativa ao repositório", async () => {
    const aoCancelar = vi.fn(async () => null);

    renderizarPainel(PERFIS_DE_ACESSO.RH, {
      agendamentos: [AGENDAMENTOS_DE_DEMONSTRACAO[0]],
      aoCancelar,
    });

    fireEvent.click(
      screen.getAllByRole("button", { name: /Ana Torres/i })[0],
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Cancelar solicitação/i }),
    );

    fireEvent.change(screen.getByLabelText(/Motivo do cancelamento/i), {
      target: { value: "Admissão adiada pela empresa." },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Confirmar cancelamento/i }),
    );

    await waitFor(() =>
      expect(aoCancelar).toHaveBeenCalledWith(
        AGENDAMENTOS_DE_DEMONSTRACAO[0].id,
        "Admissão adiada pela empresa.",
      ),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Solicitação cancelada com sucesso.",
    );
  });

  it("adapta o campo de data ao tipo de exame selecionado", () => {
    renderizarPainel(PERFIS_DE_ACESSO.RH);

    fireEvent.click(
      screen.getByRole("button", { name: /Nova solicitação/i }),
    );
    fireEvent.change(screen.getByLabelText(/Tipo de exame/i), {
      target: { value: "demissional" },
    });

    expect(
      screen.getByLabelText(/Data de término do contrato/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /O prazo operacional será de 10 dias corridos/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/não avalia dispensa do exame/i),
    ).toBeInTheDocument();
  });

  it("atualiza os dados sob demanda e informa o resultado", async () => {
    const aoAtualizar = vi.fn(async () => null);
    renderizarPainel(PERFIS_DE_ACESSO.CLINICA, { aoAtualizar });

    fireEvent.click(screen.getByRole("button", { name: "Atualizar dados" }));

    await waitFor(() => expect(aoAtualizar).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent("Dados atualizados.");
  });
});

interface OpcoesDeRenderizacao {
  agendamentos?: AgendamentoParaPainel[];
  eventos?: EventoDoAgendamentoParaPainel[];
  aoAtualizar?(): Promise<string | null>;
  aoConcluir?(agendamentoId: string): Promise<string | null>;
  aoCancelar?(agendamentoId: string, motivo: string): Promise<string | null>;
}

function renderizarPainel(
  papel: PerfilAutenticado["papel"],
  opcoes: OpcoesDeRenderizacao = {},
) {
  const ehRh = papel === PERFIS_DE_ACESSO.RH;
  const perfil: PerfilAutenticado = {
    usuarioId: ehRh ? "usuario-rh" : "usuario-clinica",
    email: ehRh ? "rh@ciclo.test" : "clinica@ciclo.test",
    nomeCompleto: ehRh ? "Mariana Costa" : "Lucas Martins",
    papel,
    organizacaoId: ehRh ? "empresa-horizonte" : "clinica-bem-viver",
    organizacaoNome: ehRh ? "Grupo Horizonte" : "Clínica Bem Viver",
  };

  render(
    <PainelDoCiclo
      perfilAutenticado={perfil}
      dados={{
        agendamentos: opcoes.agendamentos ?? AGENDAMENTOS_DE_DEMONSTRACAO,
        colaboradores: COLABORADORES_DE_DEMONSTRACAO,
        clinicasRelacionadas: [
          { id: "clinica-bem-viver", nome: "Clínica Bem Viver" },
        ],
        recursosDaClinica: [
          {
            id: "agenda-medicina",
            nome: "Medicina do Trabalho",
            duracaoEmMinutos: 30,
          },
        ],
        eventosDoAgendamento: opcoes.eventos ?? EVENTOS_DE_DEMONSTRACAO,
      }}
      aoSair={vi.fn()}
      aoAtualizar={opcoes.aoAtualizar ?? vi.fn(async () => null)}
      aoCriarSolicitacao={vi.fn(async () => null)}
      aoSalvarHorario={vi.fn(async () => null)}
      aoConcluir={opcoes.aoConcluir ?? vi.fn(async () => null)}
      aoRegistrarFalta={vi.fn(async () => null)}
      aoCancelar={opcoes.aoCancelar ?? vi.fn(async () => null)}
    />,
  );
}

const EVENTOS_DE_DEMONSTRACAO: EventoDoAgendamentoParaPainel[] = [
  {
    id: "evento-demo-1",
    agendamentoId: AGENDAMENTOS_DE_DEMONSTRACAO[0].id,
    statusAnterior: null,
    statusAtual: "solicitado",
    descricao: "Solicitação de exame criada pelo RH.",
    realizadoPorNome: "Mariana Costa",
    ocorridoEm: "2026-08-04T13:20:00.000Z",
  },
];

function criarAgendamentoComHorarioIniciado(): AgendamentoParaPainel {
  const inicio = new Date(Date.now() - 60 * 60 * 1000);
  const fim = new Date(Date.now() - 30 * 60 * 1000);

  return {
    ...AGENDAMENTOS_DE_DEMONSTRACAO[1],
    dataLimite: "2099-12-31",
    inicioAgendado: inicio.toISOString(),
    fimAgendado: fim.toISOString(),
  };
}

function obterDataAtualParaTeste(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}
