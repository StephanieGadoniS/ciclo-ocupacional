"use client";

import {
  AlertTriangle,
  Building2,
  CalendarCheck2,
  Clock3,
  FileText,
  History,
  IdCard,
  MapPin,
  SunMedium,
  UserRound,
} from "lucide-react";
import { PoliticaDePrazoOcupacional } from "@/src/modulos/agendamentos/dominio/politica-de-prazo-ocupacional";
import {
  ROTULOS_DOS_PERIODOS_PREFERIDOS,
  ROTULOS_DOS_STATUS,
  ROTULOS_DOS_TIPOS_DE_EXAME,
  STATUS_DO_AGENDAMENTO,
} from "@/src/modulos/agendamentos/dominio/tipos-do-agendamento";
import type {
  AgendamentoParaPainel,
  EventoDoAgendamentoParaPainel,
  PerfilDeAcesso,
} from "@/src/modulos/agendamentos/apresentacao/tipos-do-painel";
import { EtiquetaStatus } from "./etiqueta-status";
import { Modal } from "./modal";

interface PropriedadesDosDetalhes {
  agendamento: AgendamentoParaPainel | null;
  eventos: EventoDoAgendamentoParaPainel[];
  perfil: PerfilDeAcesso;
  instanteDeConsulta: number;
  processando?: boolean;
  aoFechar(): void;
  aoAgendar(): void;
  aoConcluir(): void;
  aoRegistrarFalta(): void;
  aoCancelar(): void;
}

export function DetalhesDoAgendamento({
  agendamento,
  eventos,
  perfil,
  instanteDeConsulta,
  processando = false,
  aoFechar,
  aoAgendar,
  aoConcluir,
  aoRegistrarFalta,
  aoCancelar,
}: PropriedadesDosDetalhes) {
  if (!agendamento) return null;

  const hoje = obterDataAtual();
  const prazoEncerrado = agendamento.dataLimite < hoje;
  const atendimentoIniciado = Boolean(
    agendamento.inicioAgendado &&
      new Date(agendamento.inicioAgendado).getTime() <= instanteDeConsulta,
  );
  const ehReagendamento =
    agendamento.status === STATUS_DO_AGENDAMENTO.AGENDADO ||
    agendamento.status === STATUS_DO_AGENDAMENTO.NAO_COMPARECEU;
  const podeAgendar =
    perfil === "clinica" &&
    (agendamento.status === STATUS_DO_AGENDAMENTO.SOLICITADO ||
      agendamento.status === STATUS_DO_AGENDAMENTO.AGENDADO ||
      agendamento.status === STATUS_DO_AGENDAMENTO.NAO_COMPARECEU) &&
    (!prazoEncerrado || ehReagendamento);
  const podeConcluir =
    perfil === "clinica" &&
    agendamento.status === STATUS_DO_AGENDAMENTO.AGENDADO;
  const podeCancelar =
    agendamento.status === STATUS_DO_AGENDAMENTO.SOLICITADO ||
    agendamento.status === STATUS_DO_AGENDAMENTO.AGENDADO ||
    agendamento.status === STATUS_DO_AGENDAMENTO.NAO_COMPARECEU;

  return (
    <Modal
      aberto
      titulo="Detalhes da solicitação"
      descricao={`Protocolo ${agendamento.id.slice(-8).toUpperCase()}`}
      aoFechar={aoFechar}
      largura="ampla"
    >
      <div className="detalhes-status">
        <EtiquetaStatus status={agendamento.status} />
        <span>
          Prazo: <strong>{formatarData(agendamento.dataLimite)}</strong>
        </span>
      </div>

      <div className="grade-detalhes">
        <article className="cartao-detalhe cartao-detalhe--destaque">
          <div className={`avatar avatar--${agendamento.colaborador.cor}`}>
            {agendamento.colaborador.iniciais}
          </div>
          <div>
            <small>Colaborador</small>
            <strong>{agendamento.colaborador.nome}</strong>
            <span>
              {agendamento.colaborador.cargo} · {agendamento.colaborador.matricula}
            </span>
          </div>
        </article>
        <Informacao
          icone={<FileText size={18} />}
          titulo="Exame"
          valor={ROTULOS_DOS_TIPOS_DE_EXAME[agendamento.tipoDeExame]}
        />
        <Informacao
          icone={<IdCard size={18} />}
          titulo="CPF"
          valor={agendamento.colaborador.cpfMascarado}
        />
        <Informacao
          icone={<Building2 size={18} />}
          titulo="Empresa"
          valor={agendamento.empresaNome}
        />
        <Informacao
          icone={<MapPin size={18} />}
          titulo="Clínica"
          valor={agendamento.clinicaNome}
        />
        <Informacao
          icone={<CalendarCheck2 size={18} />}
          titulo={PoliticaDePrazoOcupacional.descricaoDaDataDeReferencia(
            agendamento.tipoDeExame,
          )}
          valor={formatarData(agendamento.dataDeReferencia)}
        />
        <Informacao
          icone={<SunMedium size={18} />}
          titulo="Período preferido"
          valor={
            ROTULOS_DOS_PERIODOS_PREFERIDOS[agendamento.periodoPreferido]
          }
        />
        {agendamento.diasDeAfastamento !== null && (
          <Informacao
            icone={<CalendarCheck2 size={18} />}
            titulo="Afastamento informado"
            valor={`${agendamento.diasDeAfastamento} dias`}
          />
        )}
        <Informacao
          icone={<Clock3 size={18} />}
          titulo="Horário"
          valor={
            agendamento.inicioAgendado
              ? formatarDataHora(agendamento.inicioAgendado)
              : "Aguardando confirmação"
          }
        />
        <Informacao
          icone={<UserRound size={18} />}
          titulo="Agenda responsável"
          valor={agendamento.recursoDaClinicaNome ?? "Ainda não definida"}
        />
      </div>

      {agendamento.observacoes && (
        <div className="observacoes-do-agendamento">
          <small>Observações operacionais</small>
          <p>{agendamento.observacoes}</p>
        </div>
      )}

      {agendamento.status === STATUS_DO_AGENDAMENTO.CANCELADO &&
        agendamento.motivoDoCancelamento && (
          <div className="observacoes-do-agendamento observacoes-do-agendamento--cancelamento">
            <small>Motivo do cancelamento</small>
            <p>{agendamento.motivoDoCancelamento}</p>
          </div>
        )}

      <section className="historico-do-agendamento" aria-labelledby="titulo-historico">
        <header>
          <span className="historico-do-agendamento__icone" aria-hidden="true">
            <History size={18} />
          </span>
          <div>
            <h3 id="titulo-historico">Histórico operacional</h3>
            <p>Registro rastreável das alterações deste fluxo.</p>
          </div>
        </header>
        <ol>
          {eventos.map((evento) => (
            <li key={evento.id}>
              <span className="historico-do-agendamento__marcador" aria-hidden="true" />
              <div>
                <strong>{evento.descricao}</strong>
                <span>
                  {evento.realizadoPorNome} · {formatarDataHoraCompleta(evento.ocorridoEm)}
                </span>
                <small>{ROTULOS_DOS_STATUS[evento.statusAtual]}</small>
              </div>
            </li>
          ))}
        </ol>
        {eventos.length === 0 && (
          <p className="historico-do-agendamento__vazio">
            O histórico aparecerá aqui após a aplicação da migration de auditoria.
          </p>
        )}
      </section>

      {perfil === "clinica" &&
        agendamento.status === STATUS_DO_AGENDAMENTO.AGENDADO &&
        !atendimentoIniciado && (
          <div className="aviso-contextual aviso-contextual--neutro" role="status">
            <Clock3 size={19} aria-hidden="true" />
            <p>
              O resultado de comparecimento poderá ser registrado após o início
              do atendimento, em {formatarDataHora(agendamento.inicioAgendado!)}.
            </p>
          </div>
        )}

      {perfil === "rh" &&
        agendamento.status === STATUS_DO_AGENDAMENTO.AGENDADO && (
          <div className="aviso-contextual aviso-contextual--neutro">
            <Clock3 size={19} aria-hidden="true" />
            <p>
              A clínica é responsável por reagendar e registrar realizado ou não
              compareceu. O resultado aparecerá aqui automaticamente.
            </p>
          </div>
        )}

      {perfil === "rh" &&
        agendamento.status === STATUS_DO_AGENDAMENTO.NAO_COMPARECEU && (
          <div className="aviso-contextual aviso-contextual--neutro">
            <Clock3 size={19} aria-hidden="true" />
            <p>
              A clínica decide entre reagendar ou cancelar este atendimento. Uma
              solicitação duplicada fica bloqueada enquanto este fluxo estiver aberto.
            </p>
          </div>
        )}

      {perfil === "clinica" &&
        prazoEncerrado &&
        agendamento.status === STATUS_DO_AGENDAMENTO.SOLICITADO && (
          <div className="aviso-contextual aviso-contextual--perigo" role="alert">
            <AlertTriangle size={19} aria-hidden="true" />
            <p>
              O prazo ocupacional encerrou. Cancele este fluxo para que o RH
              possa abrir uma nova solicitação com datas válidas.
            </p>
          </div>
        )}

      {perfil === "clinica" && prazoEncerrado && ehReagendamento && (
        <div className="aviso-contextual aviso-contextual--neutro" role="status">
          <Clock3 size={19} aria-hidden="true" />
          <p>
            O prazo original encerrou, mas este atendimento já entrou no fluxo
            clínico. Você ainda pode reagendar para uma data futura ou cancelar.
          </p>
        </div>
      )}

      <footer className="acoes-do-modal acoes-do-modal--distribuidas">
        <div>
          {podeCancelar && (
            <button
              className="botao botao--texto-perigo"
              disabled={processando}
              type="button"
              onClick={aoCancelar}
            >
              {perfil === "rh" ? "Cancelar solicitação" : "Cancelar atendimento"}
            </button>
          )}
        </div>
        <div className="grupo-de-acoes">
          {podeConcluir && (
            <>
              <button
                className="botao botao--secundario"
                disabled={processando || !atendimentoIniciado}
                type="button"
                title={
                  atendimentoIniciado
                    ? "Registrar não comparecimento"
                    : "Disponível após o início do atendimento"
                }
                onClick={aoRegistrarFalta}
              >
                {processando ? "Salvando..." : "Não compareceu"}
              </button>
              <button
                className="botao botao--primario"
                disabled={processando || !atendimentoIniciado}
                type="button"
                title={
                  atendimentoIniciado
                    ? "Registrar atendimento realizado"
                    : "Disponível após o início do atendimento"
                }
                onClick={aoConcluir}
              >
                {processando ? "Salvando..." : "Marcar como realizado"}
              </button>
            </>
          )}
          {podeAgendar && (
            <button className="botao botao--primario" disabled={processando} type="button" onClick={aoAgendar}>
              {ehReagendamento ? "Reagendar" : "Definir horário"}
            </button>
          )}
        </div>
      </footer>
    </Modal>
  );
}

function Informacao({
  icone,
  titulo,
  valor,
}: {
  icone: React.ReactNode;
  titulo: string;
  valor: string;
}) {
  return (
    <article className="cartao-detalhe">
      <span className="cartao-detalhe__icone" aria-hidden="true">
        {icone}
      </span>
      <div>
        <small>{titulo}</small>
        <strong>{valor}</strong>
      </div>
    </article>
  );
}

function formatarData(data: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${data}T12:00:00Z`),
  );
}

function formatarDataHora(data: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(data));
}

function formatarDataHoraCompleta(data: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(data));
}

function obterDataAtual(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}
