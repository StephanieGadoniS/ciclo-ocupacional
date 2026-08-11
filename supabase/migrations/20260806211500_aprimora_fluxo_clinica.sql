-- Aprimora privacidade, sincronização e regras operacionais do fluxo clínica/RH.
-- Execute depois de 20260805190000_reforca_fluxo_operacional.sql.

begin;

create or replace function public.listar_colaboradores_autorizados()
returns table (
  id uuid,
  empresa_id uuid,
  nome_completo text,
  cpf_final text,
  matricula text,
  cargo text,
  ativo boolean
)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    colaborador.id,
    colaborador.empresa_id,
    colaborador.nome_completo,
    right(colaborador.cpf, 2) as cpf_final,
    colaborador.matricula,
    colaborador.cargo,
    colaborador.ativo
  from public.colaboradores colaborador
  where (
      public.papel_do_usuario() = 'rh'
      and colaborador.empresa_id = public.organizacao_do_usuario()
    )
    or (
      public.papel_do_usuario() = 'clinica'
      and exists (
        select 1
        from public.agendamentos_ocupacionais agendamento
        where agendamento.colaborador_id = colaborador.id
          and agendamento.clinica_id = public.organizacao_do_usuario()
      )
    )
  order by colaborador.nome_completo;
$$;

revoke all on function public.listar_colaboradores_autorizados() from public;
revoke all on function public.listar_colaboradores_autorizados() from anon;
grant execute on function public.listar_colaboradores_autorizados() to authenticated;

-- O navegador recebe somente os dois últimos dígitos via RPC.
revoke select on table public.colaboradores from authenticated;

drop index if exists public.agendamento_solicitacao_aberta_unica;

create unique index agendamento_solicitacao_aberta_unica
  on public.agendamentos_ocupacionais (
    colaborador_id,
    tipo_exame,
    data_referencia
  )
  where status in ('solicitado', 'agendado', 'nao_compareceu');

alter table public.agendamentos_ocupacionais
  drop constraint if exists agendamento_cancelamento_com_motivo;

alter table public.agendamentos_ocupacionais
  add constraint agendamento_cancelamento_com_motivo
  check (
    (
      status = 'cancelado'
      and char_length(trim(motivo_cancelamento)) between 5 and 180
    )
    or (status <> 'cancelado' and motivo_cancelamento is null)
  );

create or replace function public.validar_nova_solicitacao_ocupacional()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  data_limite_esperada date;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  data_limite_esperada := public.calcular_data_limite_ocupacional(
    new.tipo_exame,
    new.data_referencia
  );

  if new.data_limite <> data_limite_esperada then
    raise exception 'O prazo ocupacional não corresponde ao tipo de exame e à data de referência.'
      using errcode = '23514';
  end if;

  -- O service role continua autorizado a carregar dados históricos do seed.
  if auth.uid() is not null then
    if new.tipo_exame = 'demissional' and data_limite_esperada < hoje then
      raise exception 'O prazo de 10 dias do exame demissional já encerrou.'
        using errcode = '22007';
    end if;

    if new.tipo_exame <> 'demissional' and new.data_referencia < hoje then
      raise exception 'A data de referência não pode estar no passado.'
        using errcode = '22007';
    end if;
  end if;

  return new;
end;
$$;

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
    descricao_do_evento := case
      when old.status = 'nao_compareceu' and new.status = 'agendado'
        then 'Atendimento reagendado pela clínica.'
      when new.status = 'agendado'
        then 'Horário confirmado pela clínica.'
      when new.status = 'realizado'
        then 'Exame registrado como realizado.'
      when new.status = 'cancelado'
        then 'Agendamento cancelado.'
      when new.status = 'nao_compareceu'
        then 'Não comparecimento registrado pela clínica.'
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
  duracao_do_recurso integer;
  data_local_do_inicio date;
  data_local_do_fim date;
begin
  if public.papel_do_usuario() <> 'clinica' then
    raise exception 'Somente a clínica pode confirmar ou alterar um horário.'
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

  select recurso.duracao_padrao_minutos into duracao_do_recurso
  from public.recursos_clinica recurso
  where recurso.id = recurso_id
    and recurso.clinica_id = agendamento.clinica_id
    and recurso.ativo;

  if duracao_do_recurso is null then
    raise exception 'Agenda clínica inválida ou inativa.' using errcode = '23503';
  end if;

  if inicio is null or fim is null or fim <= inicio then
    raise exception 'O horário final deve ser posterior ao inicial.' using errcode = '22007';
  end if;

  if fim <> inicio + make_interval(mins => duracao_do_recurso) then
    raise exception 'A duração deve corresponder à agenda clínica selecionada.'
      using errcode = '22007';
  end if;

  if inicio < now() then
    raise exception 'Não é possível agendar um atendimento no passado.' using errcode = '22007';
  end if;

  data_local_do_inicio := (inicio at time zone 'America/Sao_Paulo')::date;
  data_local_do_fim := (fim at time zone 'America/Sao_Paulo')::date;
  if data_local_do_inicio > agendamento.data_limite
    or data_local_do_fim > agendamento.data_limite then
    raise exception 'O atendimento não pode terminar depois do prazo ocupacional.'
      using errcode = '22007';
  end if;

  update public.agendamentos_ocupacionais
  set status = 'agendado',
      recurso_clinica_id = recurso_id,
      inicio_agendado = inicio,
      fim_agendado = fim,
      realizado_em = null,
      motivo_cancelamento = null
  where id = agendamento_id
  returning * into agendamento;

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
  motivo_normalizado text := trim(coalesce(motivo, ''));
begin
  if char_length(motivo_normalizado) not between 5 and 180 then
    raise exception 'O motivo deve ter entre 5 e 180 caracteres.'
      using errcode = '22023';
  end if;

  update public.agendamentos_ocupacionais
  set status = 'cancelado', motivo_cancelamento = motivo_normalizado
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

drop policy if exists "clinica_gerencia_seus_recursos"
  on public.recursos_clinica;

revoke insert, update, delete on table public.recursos_clinica
  from authenticated;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'agendamentos_ocupacionais'
  ) then
    execute 'alter publication supabase_realtime add table public.agendamentos_ocupacionais';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
