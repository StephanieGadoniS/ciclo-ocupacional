-- Consolida os dois recursos de demonstração em uma única agenda operacional.
-- Execute depois de 20260807170000_disponibiliza_horarios_da_clinica.sql.

begin;

do $$
begin
  if exists (
    select 1
    from public.recursos_clinica
    where id = '30000000-0000-4000-8000-000000000002'
  ) and not exists (
    select 1
    from public.recursos_clinica
    where id = '30000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'A agenda principal não foi encontrada. Execute a carga de demonstração antes de consolidar as agendas.'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.agendamentos_ocupacionais agenda_principal
    join public.agendamentos_ocupacionais agenda_secundaria
      on agenda_principal.id <> agenda_secundaria.id
      and agenda_principal.status = 'agendado'
      and agenda_secundaria.status = 'agendado'
      and agenda_principal.recurso_clinica_id = '30000000-0000-4000-8000-000000000001'
      and agenda_secundaria.recurso_clinica_id = '30000000-0000-4000-8000-000000000002'
      and tstzrange(
        agenda_principal.inicio_agendado,
        agenda_principal.fim_agendado,
        '[)'
      ) && tstzrange(
        agenda_secundaria.inicio_agendado,
        agenda_secundaria.fim_agendado,
        '[)'
      )
  ) then
    raise exception 'Existem horários simultâneos nas duas agendas. Reagende um dos atendimentos antes de consolidá-las.'
      using errcode = '23P01';
  end if;
end;
$$;

update public.recursos_clinica
set nome = 'Medicina do Trabalho',
    duracao_padrao_minutos = 30,
    ativo = true
where id = '30000000-0000-4000-8000-000000000001';

-- A consolidação administrativa não representa um reagendamento feito pela clínica.
-- Por isso, preserva os horários de auditoria e não cria eventos operacionais falsos.
alter table public.agendamentos_ocupacionais
  disable trigger agendamentos_definir_atualizado_em;
alter table public.agendamentos_ocupacionais
  disable trigger agendamentos_auditar_alteracao;

update public.agendamentos_ocupacionais
set recurso_clinica_id = '30000000-0000-4000-8000-000000000001'
where recurso_clinica_id = '30000000-0000-4000-8000-000000000002';

alter table public.agendamentos_ocupacionais
  enable trigger agendamentos_auditar_alteracao;
alter table public.agendamentos_ocupacionais
  enable trigger agendamentos_definir_atualizado_em;

update public.recursos_clinica
set ativo = false
where id = '30000000-0000-4000-8000-000000000002';

comment on table public.recursos_clinica is
  'Recursos de agenda da clínica. O MVP utiliza apenas a agenda ativa Medicina do Trabalho.';

commit;
