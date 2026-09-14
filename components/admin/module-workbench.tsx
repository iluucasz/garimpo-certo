'use client'

import { useState } from 'react'
import { CheckCircle2, Play, RefreshCw } from 'lucide-react'
import type { ModuleConfig } from '@/lib/admin-config'
import { platformServices } from '@/lib/platform'

type Notify = (message: string) => void
type Operation = { label: string; value: string; action: string; result: string }

const operations: Record<string, Operation[]> = {
  produtos: [{ label: 'Qualidade do catálogo', value: '96,2%', action: 'Recalcular score', result: '96,4%' }, { label: 'Pendências editoriais', value: '18', action: 'Priorizar revisão', result: '12' }],
  ofertas: [{ label: 'Ofertas normalizadas', value: '94,8%', action: 'Normalizar lote', result: '98,1%' }, { label: 'Conflitos de preço', value: '12', action: 'Abrir revisão', result: '7' }],
  providers: [{ label: 'Adapters saudáveis', value: '3 de 4', action: 'Testar conexões', result: '4 de 4' }, { label: 'Contrato', value: 'v1 estável', action: 'Ver capabilities', result: 'Validado' }],
  categorias: [{ label: 'Cobertura taxonômica', value: '92%', action: 'Classificar órfãos', result: '97%' }, { label: 'Nós sem SEO', value: '8', action: 'Gerar rascunhos', result: '0' }],
  marcas: [{ label: 'Aliases resolvidos', value: '97,4%', action: 'Conciliar aliases', result: '99,1%' }, { label: 'Duplicidades', value: '6', action: 'Sugerir merges', result: '2' }],
  tags: [{ label: 'Regras automáticas', value: '14', action: 'Reprocessar sinais', result: '18' }, { label: 'Tags sem uso', value: '9', action: 'Arquivar inativas', result: '0' }],
  colecoes: [{ label: 'Cobertura editorial', value: '68%', action: 'Atualizar vitrines', result: '76%' }, { label: 'Coleções vencidas', value: '3', action: 'Revisar validade', result: '0' }],
  'imports-jobs': [{ label: 'Fila pendente', value: '23', action: 'Drenar fila', result: '0' }, { label: 'Taxa de sucesso', value: '98,7%', action: 'Reexecutar falhas', result: '99,6%' }],
  'home-builder': [{ label: 'Blocos publicados', value: '7', action: 'Validar composição', result: 'Válida' }, { label: 'CLS estimado', value: '0,06', action: 'Otimizar ordem', result: '0,03' }],
  'recommendation-slots': [{ label: 'Slots cobertos', value: '8 de 9', action: 'Ativar fallback', result: '9 de 9' }, { label: 'Diversidade média', value: '74%', action: 'Rebalancear mix', result: '82%' }],
  ranking: [{ label: 'NDCG simulado', value: '0,81', action: 'Simular pesos', result: '0,86' }, { label: 'Regras conflitantes', value: '4', action: 'Resolver conflitos', result: '0' }],
  segmentos: [{ label: 'Audiências válidas', value: '12', action: 'Recalcular alcance', result: '14' }, { label: 'Sobreposição máxima', value: '38%', action: 'Deduplicar público', result: '21%' }],
  campanhas: [{ label: 'Audiência estimada', value: '42 mil', action: 'Simular alcance', result: '47 mil' }, { label: 'Regras ativas', value: '8', action: 'Validar conflitos', result: 'Sem conflitos' }],
  experimentos: [{ label: 'Tráfego alocado', value: '48%', action: 'Rebalancear', result: '50%' }, { label: 'Significância', value: '91%', action: 'Calcular amostra', result: '95%' }],
  cms: [{ label: 'Conteúdo atualizado', value: '88%', action: 'Verificar links', result: '96%' }, { label: 'Revisões pendentes', value: '7', action: 'Distribuir revisões', result: '3' }],
  paginas: [{ label: 'Páginas publicadas', value: '14', action: 'Validar publicação', result: '14 válidas' }, { label: 'Links quebrados', value: '3', action: 'Corrigir referências', result: '0' }],
  seo: [{ label: 'Saúde técnica', value: '93%', action: 'Executar auditoria', result: '97%' }, { label: 'Schemas válidos', value: '26 de 28', action: 'Revalidar schemas', result: '28 de 28' }],
  analytics: [{ label: 'Eventos processados', value: '128 mil', action: 'Atualizar rollups', result: '132 mil' }, { label: 'Latência do pipeline', value: '4,2 min', action: 'Processar backlog', result: '1,1 min' }],
  funil: [{ label: 'Conversão final', value: '4,82%', action: 'Recalcular funil', result: '5,04%' }, { label: 'Maior abandono', value: 'PDP', action: 'Criar segmento', result: 'Segmento salvo' }],
  eventos: [{ label: 'Schemas válidos', value: '99,98%', action: 'Validar taxonomia', result: '100%' }, { label: 'Fila de processamento', value: '23', action: 'Processar lote', result: '0' }],
  'usuarios-rbac': [{ label: 'Papéis configurados', value: '5', action: 'Ver matriz', result: 'Matriz válida' }, { label: 'Acessos em revisão', value: '2', action: 'Revisar escopos', result: '0' }],
  lgpd: [{ label: 'Solicitações abertas', value: '3', action: 'Processar solicitações', result: '0' }, { label: 'Consentimentos válidos', value: '99,4%', action: 'Revalidar versões', result: '99,9%' }],
  'audit-log': [{ label: 'Integridade da trilha', value: '100%', action: 'Verificar hashes', result: 'Verificada' }, { label: 'Eventos exportáveis', value: '1.842', action: 'Preparar exportação', result: 'Arquivo pronto' }],
  logs: [{ label: 'Erros abertos', value: '6', action: 'Agrupar incidentes', result: '2 grupos' }, { label: 'Sinais resolvidos', value: '94%', action: 'Reprocessar alertas', result: '98%' }],
  integracoes: [{ label: 'Adapters simulados', value: '6', action: 'Executar health check', result: '6 saudáveis' }, { label: 'Contratos prontos', value: '100%', action: 'Validar interfaces', result: 'Validados' }],
  tracking: [{ label: 'Cobertura de eventos', value: '96%', action: 'Validar instrumentação', result: '99%' }, { label: 'Duplicidade', value: '0,4%', action: 'Deduplicar eventos', result: '0,1%' }],
  ai: [{ label: 'Classificações revisadas', value: '84%', action: 'Reavaliar amostra', result: '92%' }, { label: 'Custo simulado', value: 'R$ 182', action: 'Otimizar prompts', result: 'R$ 146' }],
  seguranca: [{ label: 'Postura de segurança', value: 'A-', action: 'Executar checklist', result: 'A' }, { label: 'Sessões suspeitas', value: '2', action: 'Revogar sessões', result: '0' }],
  tema: [{ label: 'Tokens consistentes', value: '96%', action: 'Validar contraste', result: '100%' }, { label: 'Componentes auditados', value: '42', action: 'Atualizar preview', result: '48' }],
}

export function ModuleWorkbench({ config, notify, disabled = false }: { config: ModuleConfig; notify: Notify; disabled?: boolean }) {
  const [values, setValues] = useState<Record<number, string>>({})
  const [running, setRunning] = useState<number | null>(null)
  const items = operations[config.slug] ?? []

  function execute(operation: Operation, index: number) {
    setRunning(index)
    window.setTimeout(() => {
      setValues((current) => ({ ...current, [index]: operation.result }))
      setRunning(null)
      platformServices.tracker.track({ name: 'admin_operation_completed', resource: config.slug, resourceId: operation.action, actor: 'Marina' })
      notify(`${operation.action}: operação mock concluída e registrada na auditoria.`)
    }, 450)
  }

  if (!items.length) return null
  return <section className="workbench" aria-label={`Operações especializadas de ${config.title}`}>{items.map((item, index) => <article className="workbench-card" key={item.label}><small>{item.label}</small><strong aria-live="polite">{values[index] ?? item.value}</strong><button className="btn secondary" disabled={disabled || running === index} title={disabled ? 'Papel atual possui acesso somente leitura' : undefined} onClick={() => execute(item, index)}>{running === index ? <RefreshCw className="spin"/> : values[index] ? <CheckCircle2/> : <Play/>}{running === index ? 'Processando' : item.action}</button></article>)}</section>
}
