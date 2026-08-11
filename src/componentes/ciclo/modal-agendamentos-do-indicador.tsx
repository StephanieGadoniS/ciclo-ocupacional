"use client";

import { ChevronRight, ClipboardList, Clock3 } from "lucide-react";
import { PoliticaDePrazoOcupacional } from "@/src/modulos/agendamentos/dominio/politica-de-prazo-ocupacional";
import { ROTULOS_DOS_TIPOS_DE_EXAME } from "@/src/modulos/agendamentos/dominio/tipos-do-agendamento";
import type { AgendamentoParaPainel } from "@/src/modulos/agendamentos/apresentacao/tipos-do-painel";
import { EtiquetaStatus } from "./etiqueta-status";
import { Modal } from "./modal";

interface PropriedadesDoModalAgendamentosDoIndicador {
  aberto: boolean;
  titulo: string;
  descricao: string;
  agendamentos: AgendamentoParaPainel[];
  hoje: string;
  aoFechar(): void;
  aoSelecionar(agendamentoId: string): void;
}

export function ModalAgendamentosDoIndicador({
  aberto,
  titulo,
  descricao,
  agendamentos,
  hoje,
  aoFechar,
  aoSelecionar,
}: PropriedadesDoModalAgendamentosDoIndicador) {
  return (
    <Modal
      aberto={aberto}
      titulo={titulo}
      descricao={descricao}
      aoFechar={aoFechar}
      largura="ampla"
    >
      <div className="resumo-do-indicador">
        <ClipboardList size={18} aria-hidden="true" />
        <span>
          <strong>{formatarQuantidade(agendamentos.length)}</strong>
          <small>A lista abaixo corresponde exatamente ao total do indicador.</small>
        </span>
      </div>

      {agendamentos.length > 0 ? (
        <div className="lista-do-indicador">
          {agendamentos.map((agendamento) => {
            const situacao = PoliticaDePrazoOcupacional.classificar(
              agendamento,
              hoje,
            );

            return (
              <button
                className="item-do-indicador"
                key={agendamento.id}
                type="button"
                aria-label={`Ver detalhes de ${agendamento.colaborador.nome}`}
                onClick={() => aoSelecionar(agendamento.id)}
              >
                <span
                  className={`avatar avatar--${agendamento.colaborador.cor}`}
                  aria-hidden="true"
                >
                  {agendamento.colaborador.iniciais}
                </span>
                <span className="item-do-indicador__dados">
                  <strong>{agendamento.colaborador.nome}</strong>
                  <small>
                    {ROTULOS_DOS_TIPOS_DE_EXAME[agendamento.tipoDeExame]} ·{" "}
                    {agendamento.empresaNome}
                  </small>
                  <em className={`prazo prazo--${situacao}`}>
                    <Clock3 size={13} aria-hidden="true" />
                    {obterResumoDoPrazo(agendamento, situacao)}
                  </em>
                </span>
                <span className="item-do-indicador__acao">
                  <EtiquetaStatus status={agendamento.status} />
                  <span>
                    Ver detalhes <ChevronRight size={15} aria-hidden="true" />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="estado-vazio estado-vazio--indicador">
          <ClipboardList size={26} aria-hidden="true" />
          <strong>Nenhum agendamento neste indicador</strong>
          <p>Quando houver registros correspondentes, eles aparecerão aqui.</p>
        </div>
      )}
    </Modal>
  );
}

function obterResumoDoPrazo(
  agendamento: AgendamentoParaPainel,
  situacao: ReturnType<typeof PoliticaDePrazoOcupacional.classificar>,
): string {
  if (agendamento.inicioAgendado) {
    return formatarDataHora(agendamento.inicioAgendado);
  }

  if (situacao === "atrasado") {
    return `Prazo encerrado em ${formatarData(agendamento.dataLimite)}`;
  }

  return `Prazo até ${formatarData(agendamento.dataLimite)}`;
}

function formatarQuantidade(quantidade: number): string {
  return `${quantidade.toString().padStart(2, "0")} ${
    quantidade === 1 ? "agendamento" : "agendamentos"
  }`;
}

function formatarData(data: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${data}T12:00:00Z`));
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
