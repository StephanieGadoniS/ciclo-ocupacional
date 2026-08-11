begin;

create extension if not exists btree_gist with schema extensions;

create type public.tipo_organizacao as enum ('empresa', 'clinica');
create type public.papel_usuario as enum ('rh', 'clinica');
create type public.tipo_exame_ocupacional as enum (
  'admissional',
  'periodico',
  'retorno_ao_trabalho',
  'mudanca_de_risco',
  'demissional'
);
create type public.status_agendamento_ocupacional as enum (
  'solicitado',
  'agendado',
  'realizado',
  'cancelado',
  'nao_compareceu'
);
create type public.periodo_preferido as enum ('manha', 'tarde', 'qualquer');

create table public.organizacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(trim(nome)) between 2 and 120),
  tipo public.tipo_organizacao not null,
  cnpj text null unique check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  organizacao_id uuid not null references public.organizacoes(id) on delete restrict,
  nome_completo text not null check (char_length(trim(nome_completo)) between 2 and 100),
  papel public.papel_usuario not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.colaboradores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.organizacoes(id) on delete restrict,
  nome_completo text not null check (char_length(trim(nome_completo)) between 2 and 100),
  cpf text not null check (cpf ~ '^[0-9]{11}$'),
  matricula text not null check (char_length(trim(matricula)) between 1 and 30),
  cargo text not null check (char_length(trim(cargo)) between 2 and 100),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint colaboradores_empresa_cpf_unico unique (empresa_id, cpf),
  constraint colaboradores_empresa_matricula_unica unique (empresa_id, matricula),
  constraint colaboradores_id_empresa_unico unique (id, empresa_id)
);

create table public.recursos_clinica (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.organizacoes(id) on delete restrict,
  nome text not null check (char_length(trim(nome)) between 2 and 80),
  duracao_padrao_minutos integer not null default 30
    check (duracao_padrao_minutos between 10 and 240),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint recursos_clinica_nome_unico unique (clinica_id, nome),
  constraint recursos_clinica_id_clinica_unico unique (id, clinica_id)
);

create table public.agendamentos_ocupacionais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.organizacoes(id) on delete restrict,
  clinica_id uuid not null references public.organizacoes(id) on delete restrict,
  colaborador_id uuid not null,
  recurso_clinica_id uuid null,
  tipo_exame public.tipo_exame_ocupacional not null,
  status public.status_agendamento_ocupacional not null default 'solicitado',
  data_referencia date not null,
  data_limite date not null,
  periodo_preferido public.periodo_preferido not null default 'qualquer',
  dias_afastamento integer null,
  observacoes text null check (observacoes is null or char_length(observacoes) <= 280),
  inicio_agendado timestamptz null,
  fim_agendado timestamptz null,
  motivo_cancelamento text null,
  criado_por uuid not null references public.perfis(id) on delete restrict,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  realizado_em timestamptz null,
  constraint agendamento_colaborador_da_empresa
    foreign key (colaborador_id, empresa_id)
    references public.colaboradores(id, empresa_id) on delete restrict,
  constraint agendamento_recurso_da_clinica
    foreign key (recurso_clinica_id, clinica_id)
    references public.recursos_clinica(id, clinica_id) on delete restrict,
  constraint agendamento_organizacoes_distintas
    check (empresa_id <> clinica_id),
  constraint agendamento_retorno_com_afastamento_valido
    check (
      (tipo_exame = 'retorno_ao_trabalho' and dias_afastamento >= 30)
      or (tipo_exame <> 'retorno_ao_trabalho' and dias_afastamento is null)
    ),
  constraint agendamento_intervalo_valido
    check (
      (inicio_agendado is null and fim_agendado is null and recurso_clinica_id is null)
      or (
        inicio_agendado is not null
        and fim_agendado is not null
        and recurso_clinica_id is not null
        and fim_agendado > inicio_agendado
      )
    ),
  constraint agendamento_status_coerente
    check (
      (status = 'solicitado' and inicio_agendado is null)
      or (
        status in ('agendado', 'realizado', 'nao_compareceu')
        and inicio_agendado is not null
      )
      or status = 'cancelado'
    ),
  constraint agendamento_cancelamento_com_motivo
    check (
      (status = 'cancelado' and char_length(trim(motivo_cancelamento)) >= 5)
      or (status <> 'cancelado' and motivo_cancelamento is null)
    ),
  constraint agendamento_realizacao_coerente
    check (
      (status = 'realizado' and realizado_em is not null)
      or (status <> 'realizado' and realizado_em is null)
    ),
  constraint agendamentos_sem_sobreposicao
    exclude using gist (
      recurso_clinica_id with =,
      tstzrange(inicio_agendado, fim_agendado, '[)') with &&
    ) where (status = 'agendado')
);

create table public.eventos_agendamento (
  id uuid primary key default gen_random_uuid(),
  agendamento_id uuid not null references public.agendamentos_ocupacionais(id) on delete cascade,
  status_anterior public.status_agendamento_ocupacional null,
  status_atual public.status_agendamento_ocupacional not null,
  descricao text not null check (char_length(trim(descricao)) between 2 and 180),
  realizado_por uuid null references public.perfis(id) on delete set null,
  ocorrido_em timestamptz not null default now()
);

create unique index agendamento_solicitacao_aberta_unica
  on public.agendamentos_ocupacionais (
    colaborador_id,
    tipo_exame,
    data_referencia
  )
  where status in ('solicitado', 'agendado');

create index agendamentos_empresa_status_idx
  on public.agendamentos_ocupacionais (empresa_id, status, data_limite);
create index agendamentos_clinica_status_idx
  on public.agendamentos_ocupacionais (clinica_id, status, data_limite);
create index agendamentos_colaborador_idx
  on public.agendamentos_ocupacionais (colaborador_id, criado_em desc);
create index eventos_agendamento_timeline_idx
  on public.eventos_agendamento (agendamento_id, ocorrido_em desc);

create or replace function public.definir_atualizado_em()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger perfis_definir_atualizado_em
before update on public.perfis
for each row execute function public.definir_atualizado_em();

create trigger colaboradores_definir_atualizado_em
before update on public.colaboradores
for each row execute function public.definir_atualizado_em();

create trigger recursos_definir_atualizado_em
before update on public.recursos_clinica
for each row execute function public.definir_atualizado_em();

create trigger agendamentos_definir_atualizado_em
before update on public.agendamentos_ocupacionais
for each row execute function public.definir_atualizado_em();

create or replace function public.validar_perfil_da_organizacao()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  tipo_da_organizacao public.tipo_organizacao;
begin
  select tipo into tipo_da_organizacao
  from public.organizacoes
  where id = new.organizacao_id;

  if (new.papel = 'rh' and tipo_da_organizacao <> 'empresa')
    or (new.papel = 'clinica' and tipo_da_organizacao <> 'clinica') then
    raise exception 'O papel do usuário não corresponde ao tipo da organização.'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
    and (new.organizacao_id <> old.organizacao_id or new.papel <> old.papel) then
    raise exception 'Organização e papel não podem ser alterados pelo perfil.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger perfis_validar_organizacao
before insert or update on public.perfis
for each row execute function public.validar_perfil_da_organizacao();

create or replace function public.organizacao_do_usuario()
returns uuid
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select organizacao_id from public.perfis where id = auth.uid();
$$;

create or replace function public.papel_do_usuario()
returns public.papel_usuario
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select papel from public.perfis where id = auth.uid();
$$;

create or replace function public.validar_transicao_do_agendamento()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  transicao_permitida boolean;
begin
  if new.empresa_id <> old.empresa_id
    or new.clinica_id <> old.clinica_id
    or new.colaborador_id <> old.colaborador_id
    or new.tipo_exame <> old.tipo_exame
    or new.data_referencia <> old.data_referencia
    or new.data_limite <> old.data_limite
    or new.criado_por <> old.criado_por then
    raise exception 'Os dados de origem da solicitação são imutáveis.'
      using errcode = '42501';
  end if;

  if new.status = old.status then
    return new;
  end if;

  transicao_permitida := case old.status
    when 'solicitado' then new.status in ('agendado', 'cancelado')
    when 'agendado' then new.status in ('realizado', 'cancelado', 'nao_compareceu')
    when 'nao_compareceu' then new.status in ('agendado', 'cancelado')
    else false
  end;

  if not transicao_permitida then
    raise exception 'Transição de status não permitida: % -> %.', old.status, new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger agendamentos_validar_transicao
before update on public.agendamentos_ocupacionais
for each row execute function public.validar_transicao_do_agendamento();

create or replace function public.auditar_agendamento()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  descricao_do_evento text;
  status_anterior_do_evento public.status_agendamento_ocupacional;
begin
  if tg_op = 'INSERT' then
    descricao_do_evento := 'Solicitação de exame criada pelo RH.';
    status_anterior_do_evento := null;
  elsif new.status <> old.status then
    descricao_do_evento := case new.status
      when 'agendado' then 'Horário confirmado pela clínica.'
      when 'realizado' then 'Exame registrado como realizado.'
      when 'cancelado' then 'Agendamento cancelado.'
      when 'nao_compareceu' then 'Não comparecimento registrado pela clínica.'
      else 'Situação do agendamento atualizada.'
    end;
    status_anterior_do_evento := old.status;
  elsif new.inicio_agendado is distinct from old.inicio_agendado
    or new.recurso_clinica_id is distinct from old.recurso_clinica_id then
    descricao_do_evento := 'Atendimento reagendado pela clínica.';
    status_anterior_do_evento := old.status;
  else
    return new;
  end if;

  insert into public.eventos_agendamento (
    agendamento_id,
    status_anterior,
    status_atual,
    descricao,
    realizado_por
  ) values (
    new.id,
    status_anterior_do_evento,
    new.status,
    descricao_do_evento,
    coalesce(auth.uid(), new.criado_por)
  );

  return new;
end;
$$;

create trigger agendamentos_auditar_insercao
after insert on public.agendamentos_ocupacionais
for each row execute function public.auditar_agendamento();

create trigger agendamentos_auditar_alteracao
after update on public.agendamentos_ocupacionais
for each row execute function public.auditar_agendamento();

alter table public.organizacoes enable row level security;
alter table public.perfis enable row level security;
alter table public.colaboradores enable row level security;
alter table public.recursos_clinica enable row level security;
alter table public.agendamentos_ocupacionais enable row level security;
alter table public.eventos_agendamento enable row level security;

create policy "participantes_visualizam_organizacoes_relacionadas"
on public.organizacoes for select to authenticated
using (
  id = public.organizacao_do_usuario()
  or exists (
    select 1
    from public.agendamentos_ocupacionais agendamento
    where (
        agendamento.empresa_id = public.organizacao_do_usuario()
        or agendamento.clinica_id = public.organizacao_do_usuario()
      )
      and (
        agendamento.empresa_id = organizacoes.id
        or agendamento.clinica_id = organizacoes.id
      )
  )
);

create policy "usuario_visualiza_perfis_da_organizacao"
on public.perfis for select to authenticated
using (organizacao_id = public.organizacao_do_usuario());

create policy "participantes_visualizam_responsaveis_dos_eventos"
on public.perfis for select to authenticated
using (
  exists (
    select 1
    from public.agendamentos_ocupacionais agendamento
    left join public.eventos_agendamento evento
      on evento.agendamento_id = agendamento.id
    where (
        agendamento.empresa_id = public.organizacao_do_usuario()
        or agendamento.clinica_id = public.organizacao_do_usuario()
      )
      and (
        agendamento.criado_por = perfis.id
        or evento.realizado_por = perfis.id
      )
  )
);

create policy "usuario_atualiza_seu_nome"
on public.perfis for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and organizacao_id = public.organizacao_do_usuario());

create policy "rh_gerencia_colaboradores_da_empresa"
on public.colaboradores for all to authenticated
using (
  public.papel_do_usuario() = 'rh'
  and empresa_id = public.organizacao_do_usuario()
)
with check (
  public.papel_do_usuario() = 'rh'
  and empresa_id = public.organizacao_do_usuario()
);

create policy "clinica_visualiza_colaboradores_agendados"
on public.colaboradores for select to authenticated
using (
  public.papel_do_usuario() = 'clinica'
  and exists (
    select 1
    from public.agendamentos_ocupacionais agendamento
    where agendamento.colaborador_id = colaboradores.id
      and agendamento.clinica_id = public.organizacao_do_usuario()
  )
);

create policy "participantes_visualizam_recursos_relacionados"
on public.recursos_clinica for select to authenticated
using (
  clinica_id = public.organizacao_do_usuario()
  or exists (
    select 1
    from public.agendamentos_ocupacionais agendamento
    where agendamento.recurso_clinica_id = recursos_clinica.id
      and agendamento.empresa_id = public.organizacao_do_usuario()
  )
);

create policy "clinica_gerencia_seus_recursos"
on public.recursos_clinica for all to authenticated
using (
  public.papel_do_usuario() = 'clinica'
  and clinica_id = public.organizacao_do_usuario()
)
with check (
  public.papel_do_usuario() = 'clinica'
  and clinica_id = public.organizacao_do_usuario()
);

create policy "participantes_visualizam_agendamentos"
on public.agendamentos_ocupacionais for select to authenticated
using (
  empresa_id = public.organizacao_do_usuario()
  or clinica_id = public.organizacao_do_usuario()
);

create policy "rh_cria_solicitacao_da_empresa"
on public.agendamentos_ocupacionais for insert to authenticated
with check (
  public.papel_do_usuario() = 'rh'
  and empresa_id = public.organizacao_do_usuario()
  and criado_por = auth.uid()
  and status = 'solicitado'
);

create policy "participantes_visualizam_eventos"
on public.eventos_agendamento for select to authenticated
using (
  exists (
    select 1
    from public.agendamentos_ocupacionais agendamento
    where agendamento.id = eventos_agendamento.agendamento_id
      and (
        agendamento.empresa_id = public.organizacao_do_usuario()
        or agendamento.clinica_id = public.organizacao_do_usuario()
      )
  )
);

create or replace function public.confirmar_horario_agendamento(
  agendamento_id uuid,
  recurso_id uuid,
  inicio timestamptz,
  fim timestamptz
)
returns public.agendamentos_ocupacionais
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  agendamento public.agendamentos_ocupacionais;
begin
  if public.papel_do_usuario() <> 'clinica' then
    raise exception 'Somente a clínica pode confirmar um horário.'
      using errcode = '42501';
  end if;

  select * into agendamento
  from public.agendamentos_ocupacionais
  where id = agendamento_id
  for update;

  if agendamento.id is null
    or agendamento.clinica_id <> public.organizacao_do_usuario() then
    raise exception 'Agendamento não encontrado.' using errcode = 'P0002';
  end if;

  if agendamento.status not in ('solicitado', 'agendado', 'nao_compareceu') then
    raise exception 'O status atual não permite agendamento.' using errcode = '23514';
  end if;

  if fim <= inicio then
    raise exception 'O horário final deve ser posterior ao inicial.' using errcode = '22007';
  end if;

  if not exists (
    select 1
    from public.recursos_clinica recurso
    where recurso.id = recurso_id
      and recurso.clinica_id = agendamento.clinica_id
      and recurso.ativo
  ) then
    raise exception 'Agenda clínica inválida ou inativa.' using errcode = '23503';
  end if;

  update public.agendamentos_ocupacionais
  set status = 'agendado',
      recurso_clinica_id = recurso_id,
      inicio_agendado = inicio,
      fim_agendado = fim,
      motivo_cancelamento = null
  where id = agendamento_id
  returning * into agendamento;

  return agendamento;
end;
$$;

create or replace function public.concluir_agendamento(agendamento_id uuid)
returns public.agendamentos_ocupacionais
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  agendamento public.agendamentos_ocupacionais;
begin
  if public.papel_do_usuario() <> 'clinica' then
    raise exception 'Somente a clínica pode concluir o exame.' using errcode = '42501';
  end if;

  update public.agendamentos_ocupacionais
  set status = 'realizado', realizado_em = now()
  where id = agendamento_id
    and clinica_id = public.organizacao_do_usuario()
    and status = 'agendado'
  returning * into agendamento;

  if agendamento.id is null then
    raise exception 'Agendamento não encontrado ou não pode ser concluído.'
      using errcode = 'P0002';
  end if;

  return agendamento;
end;
$$;

create or replace function public.registrar_nao_comparecimento(agendamento_id uuid)
returns public.agendamentos_ocupacionais
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  agendamento public.agendamentos_ocupacionais;
begin
  if public.papel_do_usuario() <> 'clinica' then
    raise exception 'Somente a clínica pode registrar a falta.' using errcode = '42501';
  end if;

  update public.agendamentos_ocupacionais
  set status = 'nao_compareceu'
  where id = agendamento_id
    and clinica_id = public.organizacao_do_usuario()
    and status = 'agendado'
  returning * into agendamento;

  if agendamento.id is null then
    raise exception 'Agendamento não encontrado ou não permite registrar falta.'
      using errcode = 'P0002';
  end if;

  return agendamento;
end;
$$;

create or replace function public.cancelar_agendamento(
  agendamento_id uuid,
  motivo text
)
returns public.agendamentos_ocupacionais
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  agendamento public.agendamentos_ocupacionais;
begin
  if char_length(trim(motivo)) < 5 then
    raise exception 'Informe o motivo do cancelamento.' using errcode = '22023';
  end if;

  update public.agendamentos_ocupacionais
  set status = 'cancelado', motivo_cancelamento = trim(motivo)
  where id = agendamento_id
    and status in ('solicitado', 'agendado', 'nao_compareceu')
    and (
      empresa_id = public.organizacao_do_usuario()
      or clinica_id = public.organizacao_do_usuario()
    )
  returning * into agendamento;

  if agendamento.id is null then
    raise exception 'Agendamento não encontrado ou não pode ser cancelado.'
      using errcode = 'P0002';
  end if;

  return agendamento;
end;
$$;

revoke all on table public.organizacoes from anon;
revoke all on table public.perfis from anon;
revoke all on table public.colaboradores from anon;
revoke all on table public.recursos_clinica from anon;
revoke all on table public.agendamentos_ocupacionais from anon;
revoke all on table public.eventos_agendamento from anon;

grant usage on schema public to authenticated;
grant select on table public.organizacoes to authenticated;
grant select on table public.perfis to authenticated;
grant update (nome_completo) on table public.perfis to authenticated;
grant select, insert, update, delete on table public.colaboradores to authenticated;
grant select, insert, update, delete on table public.recursos_clinica to authenticated;
grant select, insert on table public.agendamentos_ocupacionais to authenticated;
grant select on table public.eventos_agendamento to authenticated;

revoke all on function public.organizacao_do_usuario() from public;
revoke all on function public.papel_do_usuario() from public;
revoke all on function public.confirmar_horario_agendamento(uuid, uuid, timestamptz, timestamptz) from public;
revoke all on function public.concluir_agendamento(uuid) from public;
revoke all on function public.registrar_nao_comparecimento(uuid) from public;
revoke all on function public.cancelar_agendamento(uuid, text) from public;

grant execute on function public.organizacao_do_usuario() to authenticated;
grant execute on function public.papel_do_usuario() to authenticated;
grant execute on function public.confirmar_horario_agendamento(uuid, uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.concluir_agendamento(uuid) to authenticated;
grant execute on function public.registrar_nao_comparecimento(uuid) to authenticated;
grant execute on function public.cancelar_agendamento(uuid, text) to authenticated;

commit;
