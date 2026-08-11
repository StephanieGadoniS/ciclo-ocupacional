"use client";

import { Clock3 } from "lucide-react";
import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  ROTULOS_DOS_PERIODOS_PREFERIDOS,
  STATUS_DO_AGENDAMENTO,
} from "@/src/modulos/agendamentos/dominio/tipos-do-agendamento";
import type {
  AgendamentoParaPainel,
  DadosDoNovoHorario,
  RecursoDaClinicaParaSelecao,
} from "@/src/modulos/agendamentos/apresentacao/tipos-do-painel";
import { Modal } from "./modal";

export type { DadosDoNovoHorario } from "@/src/modulos/agendamentos/apresentacao/tipos-do-painel";

const MENSAGEM_FIM_DE_SEMANA =
  "A clínica atende somente de segunda a sexta-feira. Escolha um dia útil.";
const MENSAGEM_SEM_HORARIOS =
  "Nenhum horário está livre para a data escolhida. Selecione outra data.";
const PRIMEIRO_HORARIO_EM_MINUTOS = 8 * 60;
const FIM_DO_EXPEDIENTE_EM_MINUTOS = 18 * 60;
const INTERVALO_DA_GRADE_EM_MINUTOS = 30;

interface PropriedadesDoModal {
  agendamento: AgendamentoParaPainel | null;
  agendamentos: AgendamentoParaPainel[];
  recursos: RecursoDaClinicaParaSelecao[];
  aoFechar(): void;
  aoSalvar(dados: DadosDoNovoHorario): Promise<string | null> | string | null;
}

export function ModalAgendarExame({
  agendamento,
  agendamentos,
  recursos,
  aoFechar,
  aoSalvar,
}: PropriedadesDoModal) {
  const hoje = obterDataLocal(new Date());
  const ehReagendamento = Boolean(
    agendamento &&
      (agendamento.status === STATUS_DO_AGENDAMENTO.AGENDADO ||
        agendamento.status === STATUS_DO_AGENDAMENTO.NAO_COMPARECEU),
  );
  const horarioInicial = obterHorarioInicial(
    agendamento,
    hoje,
    ehReagendamento,
  );
  const [recursoDaClinicaId, definirRecursoDaClinicaId] = useState(
    obterRecursoInicialId(agendamento, recursos),
  );
  const [dataSelecionada, definirDataSelecionada] = useState(
    horarioInicial.data,
  );
  const [horarioSelecionado, definirHorarioSelecionado] = useState(
    horarioInicial.hora,
  );
  const [erro, definirErro] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);
  const prazoEncerrado = Boolean(
    agendamento && agendamento.dataLimite < hoje,
  );
  const prazoBloqueiaAgendamento = prazoEncerrado && !ehReagendamento;
  const recursoSelecionado = recursos.find(
    (agenda) => agenda.id === recursoDaClinicaId,
  );
  const horariosDisponiveis = obterHorariosDisponiveis({
    agendamentoAtualId: agendamento?.id ?? null,
    agendamentos,
    agora: new Date(),
    data: dataSelecionada,
    dataLimite: agendamento?.dataLimite ?? "",
    podeUltrapassarPrazo: ehReagendamento,
    recurso: recursoSelecionado,
  });
  const horarioContinuaDisponivel = horariosDisponiveis.includes(
    horarioSelecionado,
  );

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (!recursoSelecionado) {
      definirErro("A agenda de Medicina do Trabalho não está disponível.");
      return;
    }

    if (!agendamento) {
      definirErro("A solicitação não está mais disponível.");
      return;
    }

    if (!dataSelecionada) {
      definirErro("Escolha a data do atendimento.");
      return;
    }

    if (dataSelecionada < hoje) {
      definirErro("Não é possível agendar um atendimento no passado.");
      return;
    }

    if (ehFimDeSemana(dataSelecionada)) {
      definirErro(MENSAGEM_FIM_DE_SEMANA);
      return;
    }

    if (!ehReagendamento && dataSelecionada > agendamento.dataLimite) {
      definirErro(
        "O atendimento não pode ser agendado depois do prazo ocupacional.",
      );
      return;
    }

    if (!horarioSelecionado || !horarioContinuaDisponivel) {
      definirErro("Selecione um dos horários livres exibidos.");
      return;
    }

    const inicio = `${dataSelecionada}T${horarioSelecionado}:00-03:00`;
    const inicioComoData = new Date(inicio);

    if (Number.isNaN(inicioComoData.getTime()) || inicioComoData < new Date()) {
      definirErro("Escolha uma data e um horário futuros.");
      return;
    }

    const fim = new Date(
      inicioComoData.getTime() +
        recursoSelecionado.duracaoEmMinutos * 60 * 1000,
    ).toISOString();

    definirSalvando(true);
    const mensagem = await aoSalvar({
      recursoDaClinicaId,
      recursoDaClinicaNome: recursoSelecionado.nome,
      inicio,
      fim,
    });
    definirSalvando(false);

    definirErro(mensagem);
    if (!mensagem) aoFechar();
  }

  function selecionarAgenda(evento: ChangeEvent<HTMLSelectElement>) {
    definirRecursoDaClinicaId(evento.currentTarget.value);
    definirHorarioSelecionado("");
    definirErro(null);
  }

  function selecionarData(evento: ChangeEvent<HTMLInputElement>) {
    const campo = evento.currentTarget;
    definirDataSelecionada(campo.value);
    definirHorarioSelecionado("");

    if (campo.value && ehFimDeSemana(campo.value)) {
      campo.setCustomValidity(MENSAGEM_FIM_DE_SEMANA);
      definirErro(null);
      return;
    }

    campo.setCustomValidity("");
    definirErro(null);
  }

  const mensagemDaGrade = obterMensagemDaGrade({
    data: dataSelecionada,
    dataLimite: agendamento?.dataLimite ?? "",
    horariosDisponiveis,
    podeUltrapassarPrazo: ehReagendamento,
    recursoSelecionado: Boolean(recursoSelecionado),
    hoje,
  });

  return (
    <Modal
      aberto={Boolean(agendamento)}
      titulo={ehReagendamento ? "Reagendar exame" : "Confirmar horário"}
      descricao={
        agendamento
          ? `${agendamento.colaborador.nome} · ${agendamento.colaborador.cargo}`
          : undefined
      }
      aoFechar={aoFechar}
    >
      <form className="formulario" onSubmit={salvar}>
        <div
          className={`aviso-contextual ${
            prazoBloqueiaAgendamento
              ? "aviso-contextual--perigo"
              : "aviso-contextual--neutro"
          }`}
        >
          <Clock3 size={20} aria-hidden="true" />
          <p>
            {prazoBloqueiaAgendamento
              ? "O prazo ocupacional encerrou. Cancele este fluxo ou peça ao RH uma nova solicitação."
              : prazoEncerrado && ehReagendamento
                ? "O prazo original encerrou, mas este atendimento pode ser reagendado. Escolha uma nova data futura em dia útil."
              : `Escolha um dia útil entre hoje e ${formatarData(agendamento?.dataLimite)}. O expediente é das 08:00 às 18:00.`}
          </p>
        </div>

        {agendamento && (
          <p className="preferencia-de-agendamento">
            <strong>Preferência informada pelo RH:</strong>{" "}
            {ROTULOS_DOS_PERIODOS_PREFERIDOS[agendamento.periodoPreferido]}
            {agendamento.diasDeAfastamento !== null
              ? ` · ${agendamento.diasDeAfastamento} dias de afastamento`
              : ""}
          </p>
        )}

        <div className="grade-formulario grade-formulario--duas-colunas">
          {recursos.length === 1 && recursoSelecionado ? (
            <div
              aria-label="Agenda responsável"
              className="agenda-unica campo--largo"
            >
              <div>
                <small>Agenda responsável</small>
                <strong>{recursoSelecionado.nome}</strong>
              </div>
              <span>{recursoSelecionado.duracaoEmMinutos} min</span>
            </div>
          ) : (
            <label className="campo campo--largo">
              <span>Agenda responsável</span>
              <select
                aria-label="Agenda responsável"
                name="recursoDaClinicaId"
                required
                value={recursoDaClinicaId}
                onChange={selecionarAgenda}
              >
                <option value="" disabled>
                  Selecione uma agenda
                </option>
                {recursos.map((agenda) => (
                  <option key={agenda.id} value={agenda.id}>
                    {agenda.nome} · {agenda.duracaoEmMinutos} min
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="campo campo--largo">
            <span>Data</span>
            <input
              aria-label="Data"
              max={ehReagendamento ? undefined : agendamento?.dataLimite}
              min={hoje}
              name="data"
              onChange={selecionarData}
              type="date"
              required
              value={dataSelecionada}
            />
            <small className="campo__ajuda">
              Agendamentos disponíveis de segunda a sexta-feira.
            </small>
          </label>

          <fieldset className="seletor-de-horarios campo--largo">
            <legend>Horários disponíveis</legend>
            <p className="seletor-de-horarios__ajuda">
              Mostramos somente os horários livres. Cada atendimento dura 30
              minutos.
            </p>

            {mensagemDaGrade ? (
              <p className="estado-dos-horarios" role="status">
                {mensagemDaGrade}
              </p>
            ) : (
              <div
                aria-label="Horários livres"
                className="grade-de-horarios"
                role="group"
              >
                {horariosDisponiveis.map((horario) => (
                  <button
                    aria-pressed={horarioSelecionado === horario}
                    className={`botao-de-horario ${
                      horarioSelecionado === horario
                        ? "botao-de-horario--selecionado"
                        : ""
                    }`}
                    key={horario}
                    onClick={() => {
                      definirHorarioSelecionado(horario);
                      definirErro(null);
                    }}
                    type="button"
                  >
                    {horario}
                  </button>
                ))}
              </div>
            )}
          </fieldset>
        </div>

        {erro && (
          <p className="mensagem-de-erro" role="alert">
            {erro}
          </p>
        )}

        <footer className="acoes-do-modal">
          <button
            className="botao botao--secundario"
            disabled={salvando}
            type="button"
            onClick={aoFechar}
          >
            Voltar
          </button>
          <button
            className="botao botao--primario"
            disabled={
              salvando ||
              recursos.length === 0 ||
              prazoBloqueiaAgendamento ||
              !horarioContinuaDisponivel
            }
            type="submit"
          >
            {salvando
              ? "Salvando..."
              : ehReagendamento
                ? "Confirmar reagendamento"
                : "Confirmar horário"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

interface DadosParaCalcularHorarios {
  agendamentoAtualId: string | null;
  agendamentos: AgendamentoParaPainel[];
  agora: Date;
  data: string;
  dataLimite: string;
  podeUltrapassarPrazo: boolean;
  recurso?: RecursoDaClinicaParaSelecao;
}

function obterHorariosDisponiveis({
  agendamentoAtualId,
  agendamentos,
  agora,
  data,
  dataLimite,
  podeUltrapassarPrazo,
  recurso,
}: DadosParaCalcularHorarios): string[] {
  if (
    !recurso ||
    !data ||
    (!podeUltrapassarPrazo && data > dataLimite) ||
    ehFimDeSemana(data)
  ) {
    return [];
  }

  const horarios: string[] = [];

  for (
    let minutos = PRIMEIRO_HORARIO_EM_MINUTOS;
    minutos + recurso.duracaoEmMinutos <= FIM_DO_EXPEDIENTE_EM_MINUTOS;
    minutos += INTERVALO_DA_GRADE_EM_MINUTOS
  ) {
    const horario = formatarMinutosComoHorario(minutos);
    const inicio = new Date(`${data}T${horario}:00-03:00`);
    const fim = new Date(
      inicio.getTime() + recurso.duracaoEmMinutos * 60 * 1000,
    );

    if (Number.isNaN(inicio.getTime()) || inicio < agora) continue;

    const estaOcupado = agendamentos.some((item) => {
      if (
        item.id === agendamentoAtualId ||
        item.status !== STATUS_DO_AGENDAMENTO.AGENDADO ||
        item.recursoDaClinicaId !== recurso.id ||
        !item.inicioAgendado ||
        !item.fimAgendado
      ) {
        return false;
      }

      const inicioExistente = Date.parse(item.inicioAgendado);
      const fimExistente = Date.parse(item.fimAgendado);

      return inicio.getTime() < fimExistente && fim.getTime() > inicioExistente;
    });

    if (!estaOcupado) horarios.push(horario);
  }

  return horarios;
}

interface DadosParaMensagemDaGrade {
  data: string;
  dataLimite: string;
  horariosDisponiveis: string[];
  hoje: string;
  podeUltrapassarPrazo: boolean;
  recursoSelecionado: boolean;
}

function obterMensagemDaGrade({
  data,
  dataLimite,
  horariosDisponiveis,
  hoje,
  podeUltrapassarPrazo,
  recursoSelecionado,
}: DadosParaMensagemDaGrade): string | null {
  if (!recursoSelecionado) {
    return "A agenda de Medicina do Trabalho não está disponível.";
  }

  if (!data) return "Escolha uma data para consultar os horários livres.";
  if (data < hoje) return "Escolha uma data futura.";
  if (ehFimDeSemana(data)) return MENSAGEM_FIM_DE_SEMANA;

  if (!podeUltrapassarPrazo && data > dataLimite) {
    return "A data escolhida está depois do prazo ocupacional.";
  }

  if (horariosDisponiveis.length === 0) return MENSAGEM_SEM_HORARIOS;
  return null;
}

function formatarMinutosComoHorario(minutos: number): string {
  const hora = Math.floor(minutos / 60).toString().padStart(2, "0");
  const minuto = (minutos % 60).toString().padStart(2, "0");
  return `${hora}:${minuto}`;
}

function obterRecursoInicialId(
  agendamento: AgendamentoParaPainel | null,
  recursos: RecursoDaClinicaParaSelecao[],
): string {
  const recursoDoAgendamento = recursos.find(
    (recurso) => recurso.id === agendamento?.recursoDaClinicaId,
  );

  if (recursoDoAgendamento) return recursoDoAgendamento.id;
  if (recursos.length === 1) return recursos[0].id;
  return "";
}

function obterDataLocal(data: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(data);
}

function ehFimDeSemana(data: string): boolean {
  const diaDaSemana = new Date(`${data}T12:00:00Z`).getUTCDay();
  return diaDaSemana === 0 || diaDaSemana === 6;
}

function obterHorarioInicial(
  agendamento: AgendamentoParaPainel | null,
  hoje: string,
  podeUltrapassarPrazo: boolean,
): { data: string; hora: string } {
  if (!agendamento?.inicioAgendado) return { data: "", hora: "" };

  const inicio = new Date(agendamento.inicioAgendado);
  const data = obterDataLocal(inicio);

  if (
    data < hoje ||
    (!podeUltrapassarPrazo && data > agendamento.dataLimite)
  ) {
    return { data: "", hora: "" };
  }

  const hora = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Sao_Paulo",
  }).format(inicio);

  return { data, hora };
}

function formatarData(data?: string): string {
  if (!data) return "o prazo informado";

  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${data}T12:00:00Z`),
  );
}
