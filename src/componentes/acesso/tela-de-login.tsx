"use client";

import {
  Activity,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { LogotipoCiclo } from "../ciclo/logotipo-ciclo";

interface CredencialDeAvaliacao {
  perfil: "RH" | "Clínica";
  descricao: string;
  email: string;
  senha: string;
  icone: React.ReactNode;
}

const CREDENCIAIS_DE_AVALIACAO: CredencialDeAvaliacao[] = [
  {
    perfil: "RH",
    descricao: "Solicita e acompanha exames",
    email: "rh@ciclo.test",
    senha: "CicloRH#2026!",
    icone: <Building2 size={18} />,
  },
  {
    perfil: "Clínica",
    descricao: "Agenda e conclui atendimentos",
    email: "clinica@ciclo.test",
    senha: "CicloClinica#2026!",
    icone: <Stethoscope size={18} />,
  },
];

interface PropriedadesDaTelaDeLogin {
  aoEntrar(email: string, senha: string): Promise<string | null>;
}

export function TelaDeLogin({ aoEntrar }: PropriedadesDaTelaDeLogin) {
  const [email, definirEmail] = useState("");
  const [senha, definirSenha] = useState("");
  const [senhaVisivel, definirSenhaVisivel] = useState(false);
  const [enviando, definirEnviando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirErro(null);

    const mensagem = await aoEntrar(email, senha);
    definirErro(mensagem);
    definirEnviando(false);
  }

  function preencherCredencial(credencial: CredencialDeAvaliacao) {
    definirEmail(credencial.email);
    definirSenha(credencial.senha);
    definirErro(null);
  }

  return (
    <main className="pagina-de-login">
      <section className="login-apresentacao" aria-label="Apresentação do Ciclo">
        <div className="login-apresentacao__cabecalho">
          <LogotipoCiclo />
        </div>

        <div className="login-marca-visual" aria-hidden="true">
          <span className="login-marca-visual__eixo login-marca-visual__eixo--horizontal" />
          <span className="login-marca-visual__eixo login-marca-visual__eixo--vertical" />
          <span className="login-marca-visual__orbita login-marca-visual__orbita--externa" />
          <span className="login-marca-visual__orbita login-marca-visual__orbita--media" />
          <span className="login-marca-visual__orbita login-marca-visual__orbita--interna" />
          <span className="login-marca-visual__ponto login-marca-visual__ponto--superior" />
          <span className="login-marca-visual__ponto login-marca-visual__ponto--direito" />
          <span className="login-marca-visual__ponto login-marca-visual__ponto--inferior" />
          <span className="login-marca-visual__nucleo">
            <Activity size={52} strokeWidth={1.7} />
          </span>
        </div>

        <div className="login-apresentacao__rodape">
          <ShieldCheck size={17} /> Autorização por Supabase Auth e Row Level Security
        </div>
      </section>

      <section className="login-acesso">
        <div className="cartao-de-login">
          <header>
            <span className="login-icone-de-acesso">
              <LockKeyhole size={22} />
            </span>
            <div>
              <small>Acesso seguro</small>
              <h2>Entre na sua conta</h2>
            </div>
          </header>
          <p className="login-introducao">
            O seu e-mail identifica automaticamente se o acesso pertence ao RH
            ou à clínica.
          </p>

          <form className="formulario-de-login" onSubmit={entrar}>
            <label className="campo campo--login">
              <span>E-mail</span>
              <input
                autoComplete="email"
                inputMode="email"
                name="email"
                placeholder="voce@empresa.com.br"
                required
                type="email"
                value={email}
                onChange={(evento) => definirEmail(evento.target.value)}
              />
            </label>

            <label className="campo campo--login">
              <span>Senha</span>
              <div className="campo-de-senha">
                <input
                  autoComplete="current-password"
                  minLength={8}
                  name="senha"
                  placeholder="Digite sua senha"
                  required
                  type={senhaVisivel ? "text" : "password"}
                  value={senha}
                  onChange={(evento) => definirSenha(evento.target.value)}
                />
                <button
                  type="button"
                  aria-label={senhaVisivel ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => definirSenhaVisivel((visivel) => !visivel)}
                >
                  {senhaVisivel ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {erro && (
              <p className="mensagem-de-erro mensagem-de-erro--login" role="alert">
                {erro}
              </p>
            )}

            <button
              className="botao botao--primario botao--entrar"
              disabled={enviando}
              type="submit"
            >
              {enviando ? "Validando acesso..." : "Entrar no Ciclo"}
              {!enviando && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="acessos-de-avaliacao">
            <div className="acessos-de-avaliacao__titulo">
              <span>Acessos para avaliação</span>
              <small>Clique para preencher</small>
            </div>
            <div className="grade-de-acessos">
              {CREDENCIAIS_DE_AVALIACAO.map((credencial) => (
                <button
                  key={credencial.perfil}
                  className="acesso-de-avaliacao"
                  type="button"
                  onClick={() => preencherCredencial(credencial)}
                >
                  <span>{credencial.icone}</span>
                  <div>
                    <strong>{credencial.perfil}</strong>
                    <small>{credencial.descricao}</small>
                    <code>{credencial.email}</code>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
