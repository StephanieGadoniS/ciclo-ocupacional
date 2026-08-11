"use client";

import { AlertTriangle, CalendarDays, ShieldCheck } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { PoliticaDePrazoOcupacional } from "@/src/modulos/agendamentos/dominio/politica-de-prazo-ocupacional";
import {
  PERIODOS_PREFERIDOS,
  ROTULOS_DOS_TIPOS_DE_EXAME,
  TIPOS_DE_EXAME,
  type PeriodoPreferido,
  type TipoDeExame,
} from "@/src/modulos/agendamentos/dominio/tipos-do-agendamento";
import type {
  ColaboradorParaSelecao,
  DadosDaNovaSolicitacao,
} from "@/src/modulos/agendamentos/apresentacao/tipos-do-painel";
import { Modal } from "./modal";

export type { DadosDaNovaSolicitacao } from "@/src/modulos/agendamentos/apresentacao/tipos-do-painel";

interface PropriedadesDoModal {
  aberto: boolean;
  colaboradores: ColaboradorParaSelecao[];
  colaboradorInicialId?: string | null;
  aoFechar(): void;
  aoSalvar(dados: DadosDaNovaSolicitacao): Promise<string | null> | string | null;
}

export function ModalNovaSolicitacao({
  aberto,
  colaboradores,
  colaboradorInicialId,
  aoFechar,
  aoSalvar,
}: PropriedadesDoModal) {
  const [tipoDeExame, definirTipoDeExame] = useState<TipoDeExame>(
    TIPOS_DE_EXAME.ADMISSIONAL,
  );
  const [erro, definirErro] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);

  const descricaoDaData = useMemo(
    () => PoliticaDePrazoOcupacional.descricaoDaDataDeReferencia(tipoDeExame),
    [tipoDeExame],
  );
  const orientacaoDaData = useMemo(
    () => PoliticaDePrazoOcupacional.orientacaoDaDataDeReferencia(tipoDeExame),
    [tipoDeExame],
  );
  const hoje = obterDataAtual();
  const dataMinima =
    tipoDeExame === TIPOS_DE_EXAME.DEMISSIONAL
      ? deslocarData(hoje, -10)
      : hoje;

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const elementoDoFormulario = evento.currentTarget;
    const formulario = new FormData(elementoDoFormulario);
    const diasInformados = formulario.get("diasDeAfastamento")?.toString();
    const dataDeReferencia =
      formulario.get("dataDeReferencia")?.toString() ?? "";

    if (
      tipoDeExame === TIPOS_DE_EXAME.DEMISSIONAL &&
      PoliticaDePrazoOcupacional.calcularDataLimite(
        tipoDeExame,
        dataDeReferencia,
      ) < hoje
    ) {
      definirErro("O prazo de 10 dias do exame demissional já encerrou.");
      return;
    }

    if (
      tipoDeExame !== TIPOS_DE_EXAME.DEMISSIONAL &&
      dataDeReferencia < hoje
    ) {
      definirErro("A data de referência não pode estar no passado.");
      return;
    }

    definirSalvando(true);
    const mensagem = await aoSalvar({
      colaboradorId: formulario.get("colaboradorId")?.toString() ?? "",
      tipoDeExame,
      dataDeReferencia,
      periodoPreferido: (formulario.get("periodoPreferido")?.toString() ??
        PERIODOS_PREFERIDOS.QUALQUER) as PeriodoPreferido,
      diasDeAfastamento: diasInformados ? Number(diasInformados) : null,
      observacoes: formulario.get("observacoes")?.toString() ?? "",
    });
    definirSalvando(false);

    definirErro(mensagem);
    if (!mensagem) {
      elementoDoFormulario.reset();
      definirTipoDeExame(TIPOS_DE_EXAME.ADMISSIONAL);
      aoFechar();
    }
  }

  return (
    <Modal
      aberto={aberto}
      titulo="Nova solicitação"
      descricao="Registre a necessidade. A clínica definirá o melhor horário."
      aoFechar={aoFechar}
      largura="ampla"
    >
      <form
        className="formulario"
        key={colaboradorInicialId ?? "sem-colaborador-inicial"}
        onSubmit={salvar}
      >
        <div className="aviso-contextual">
          <ShieldCheck size={20} aria-hidden="true" />
          <p>
            Aqui entram apenas informações operacionais. Resultados médicos e
            prontuários não fazem parte deste fluxo.
          </p>
        </div>

        <div className="grade-formulario grade-formulario--duas-colunas">
          <label className="campo campo--largo">
            <span>Colaborador</span>
            <select
              name="colaboradorId"
              required
              defaultValue={colaboradorInicialId ?? ""}
            >
              <option value="" disabled>
                Selecione um colaborador
              </option>
              {colaboradores.map((colaborador) => (
                <option key={colaborador.id} value={colaborador.id}>
                  {colaborador.nome} · {colaborador.cargo}
                </option>
              ))}
            </select>
          </label>

          <label className="campo">
            <span>Tipo de exame</span>
            <select
              name="tipoDeExame"
              value={tipoDeExame}
              onChange={(evento) =>
                definirTipoDeExame(evento.target.value as TipoDeExame)
              }
            >
              {Object.values(TIPOS_DE_EXAME).map((tipo) => (
                <option key={tipo} value={tipo}>
                  {ROTULOS_DOS_TIPOS_DE_EXAME[tipo]}
                </option>
              ))}
            </select>
          </label>

          <label className="campo">
            <span>{descricaoDaData}</span>
            <div className="campo-com-icone">
              <CalendarDays size={17} aria-hidden="true" />
              <input
                aria-describedby="orientacao-data-referencia"
                min={dataMinima}
                name="dataDeReferencia"
                type="date"
                required
              />
            </div>
            <small className="campo__ajuda" id="orientacao-data-referencia">
              {orientacaoDaData}
            </small>
          </label>

          {tipoDeExame === TIPOS_DE_EXAME.DEMISSIONAL && (
            <div className="aviso-contextual aviso-contextual--neutro campo--largo">
              <AlertTriangle size={19} aria-hidden="true" />
              <p>
                Este recorte não avalia dispensa do exame por exame ocupacional
                recente ou grau de risco. Confirme previamente que a solicitação
                demissional é necessária.
              </p>
            </div>
          )}

          <label className="campo">
            <span>Período preferido</span>
            <select name="periodoPreferido" defaultValue="qualquer">
              <option value="qualquer">Qualquer período</option>
              <option value="manha">Manhã</option>
              <option value="tarde">Tarde</option>
            </select>
          </label>

          {tipoDeExame === TIPOS_DE_EXAME.RETORNO_AO_TRABALHO && (
            <label className="campo">
              <span>Dias de afastamento</span>
              <input
                name="diasDeAfastamento"
                type="number"
                min="30"
                inputMode="numeric"
                placeholder="Ex.: 35"
                required
              />
            </label>
          )}

          <label className="campo campo--largo">
            <span>Observações operacionais</span>
            <textarea
              name="observacoes"
              rows={3}
              maxLength={280}
              placeholder="Inclua somente informações necessárias para organizar o atendimento."
            />
          </label>
        </div>

        {erro && (
          <p className="mensagem-de-erro" role="alert">
            {erro}
          </p>
        )}

        <footer className="acoes-do-modal">
          <button className="botao botao--secundario" disabled={salvando} type="button" onClick={aoFechar}>
            Cancelar
          </button>
          <button className="botao botao--primario" disabled={salvando} type="submit">
            {salvando ? "Criando..." : "Criar solicitação"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

function obterDataAtual(): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function deslocarData(data: string, quantidadeDeDias: number): string {
  const resultado = new Date(`${data}T12:00:00Z`);
  resultado.setUTCDate(resultado.getUTCDate() + quantidadeDeDias);
  return resultado.toISOString().slice(0, 10);
}
