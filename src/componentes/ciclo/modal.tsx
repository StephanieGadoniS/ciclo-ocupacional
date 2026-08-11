"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";

interface PropriedadesDoModal {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  aoFechar(): void;
  children: ReactNode;
  largura?: "normal" | "ampla";
}

export function Modal({
  aberto,
  titulo,
  descricao,
  aoFechar,
  children,
  largura = "normal",
}: PropriedadesDoModal) {
  useEffect(() => {
    if (!aberto) return;

    const aoPressionarTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") aoFechar();
    };

    document.addEventListener("keydown", aoPressionarTecla);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", aoPressionarTecla);
      document.body.style.overflow = "";
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return (
    <div className="modal-fundo" role="presentation" onMouseDown={aoFechar}>
      <section
        className={`modal-conteudo modal-conteudo--${largura}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-do-modal"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <header className="modal-cabecalho">
          <div>
            <p className="sobrelinha">Ciclo ocupacional</p>
            <h2 id="titulo-do-modal">{titulo}</h2>
            {descricao && <p>{descricao}</p>}
          </div>
          <button
            className="botao-icone"
            type="button"
            onClick={aoFechar}
            aria-label="Fechar janela"
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
