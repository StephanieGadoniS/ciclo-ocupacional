"use client";

import { AlertTriangle } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { PerfilDeAcesso } from "@/src/modulos/acesso/dominio/perfil-de-acesso";
import type { AgendamentoParaPainel } from "@/src/modulos/agendamentos/apresentacao/tipos-do-painel";
import { Modal } from "./modal";

interface PropriedadesDoModal {
  agendamento: AgendamentoParaPainel | null;
  perfil: PerfilDeAcesso;
  aoFechar(): void;
  aoConfirmar(motivo: string): Promise<string | null> | string | null;
}

export function ModalCancelarAgendamento({
  agendamento,
  perfil,
  aoFechar,
  aoConfirmar,
}: PropriedadesDoModal) {
  const [erro, definirErro] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);
  const ehRh = perfil === "rh";

  async function confirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    const motivo = formulario.get("motivo")?.toString().trim() ?? "";

    if (motivo.length < 5) {
      definirErro("Explique brevemente o motivo do cancelamento.");
      return;
    }

    definirSalvando(true);
    const mensagem = await aoConfirmar(motivo);
    definirSalvando(false);
    definirErro(mensagem);

    if (!mensagem) aoFechar();
  }

  return (
    <Modal
      aberto={Boolean(agendamento)}
      titulo={ehRh ? "Cancelar solicitação" : "Cancelar atendimento"}
      descricao={
        agendamento
          ? `${agendamento.colaborador.nome} · o motivo ficará visível para as duas organizações`
          : undefined
      }
      aoFechar={aoFechar}
    >
      <form className="formulario" onSubmit={confirmar}>
        <div className="aviso-contextual aviso-contextual--perigo">
          <AlertTriangle size={20} aria-hidden="true" />
          <p>
            Esta ação encerra o fluxo atual. Um novo atendimento exigirá uma
            nova solicitação do RH.
          </p>
        </div>

        <label className="campo">
          <span>Motivo do cancelamento</span>
          <textarea
            name="motivo"
            rows={3}
            minLength={5}
            maxLength={180}
            placeholder={
              ehRh
                ? "Ex.: admissão adiada pela empresa."
                : "Ex.: indisponibilidade operacional da clínica."
            }
            required
          />
          <small className="campo__ajuda">
            Registre somente uma justificativa operacional, sem informações médicas.
          </small>
        </label>

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
            className="botao botao--perigo"
            disabled={salvando}
            type="submit"
          >
            {salvando ? "Cancelando..." : "Confirmar cancelamento"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
