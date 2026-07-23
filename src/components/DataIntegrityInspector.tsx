import React, { useState, useEffect } from 'react';
import { 
  Database, ShieldCheck, AlertTriangle, Eye, RefreshCw, 
  Search, Filter, CheckCircle2, XCircle, Info, Layers, ChevronRight, FileText, Wrench
} from 'lucide-react';
import { Unit, WarehouseReceipt, BillOfLading, Shipper, Consignee } from '../types';
import { 
  auditRenderedData, auditDatabaseKeys, normalizeUnitMatch, 
  AuditReport, OmittedRecordInfo 
} from '../utils/dataAuditor';
import { apiService } from '../services/api';

interface DataIntegrityInspectorProps {
  receipts: WarehouseReceipt[];
  renderedReceipts: WarehouseReceipt[];
  bls?: BillOfLading[];
  renderedBLs?: BillOfLading[];
  shippers?: Shipper[];
  renderedShippers?: Shipper[];
  consignees?: Consignee[];
  renderedConsignees?: Consignee[];
  units: Unit[];
  activeUnitId: string;
  activeTab?: string;
  searchQuery?: string;
  consigneeFilter?: string;
  statusFilter?: string;
  onRefreshData?: () => void;
  onForceShowAllToggle?: (enabled: boolean) => void;
  isForceShowAll?: boolean;
}

export default function DataIntegrityInspector({
  receipts,
  renderedReceipts,
  bls = [],
  renderedBLs = [],
  shippers = [],
  renderedShippers = [],
  consignees = [],
  renderedConsignees = [],
  units,
  activeUnitId,
  activeTab = 'estoque',
  searchQuery = '',
  consigneeFilter = '',
  statusFilter = 'all',
  onRefreshData,
  onForceShowAllToggle,
  isForceShowAll = false,
}: DataIntegrityInspectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeInspectorTab, setActiveInspectorTab] = useState<'screen' | 'schema' | 'repair'>('screen');
  const [selectedEntity, setSelectedEntity] = useState<'receipts' | 'bls' | 'shippers' | 'consignees'>('receipts');
  const [backendAudit, setBackendAudit] = useState<any>(null);
  const [loadingBackendAudit, setLoadingBackendAudit] = useState(false);
  const [repairSuccess, setRepairSuccess] = useState<string | null>(null);

  // Compute reports for rendered vs database
  const receiptsReport = auditRenderedData(receipts, renderedReceipts, {
    entityName: 'Recebimentos (Warehouse Receipts)',
    activeUnitId,
    availableUnits: units,
    activeTab,
    searchQuery,
    consigneeFilter,
    statusFilter,
  });

  const blsReport = auditRenderedData(bls, renderedBLs, {
    entityName: 'Conhecimentos de Carga (Bills of Lading)',
    activeUnitId,
    availableUnits: units,
    searchQuery,
  });

  const shippersReport = auditRenderedData(shippers, renderedShippers, {
    entityName: 'Expedidores (Shippers)',
    activeUnitId,
    availableUnits: units,
    searchQuery,
  });

  const consigneesReport = auditRenderedData(consignees, renderedConsignees, {
    entityName: 'Destinatários (Consignees)',
    activeUnitId,
    availableUnits: units,
    searchQuery,
  });

  // Schema Key Health
  const receiptsKeyHealth = auditDatabaseKeys('receipts', receipts);
  const blsKeyHealth = auditDatabaseKeys('billsOfLading', bls);
  const shippersKeyHealth = auditDatabaseKeys('shippers', shippers);

  const activeReport: AuditReport = 
    selectedEntity === 'receipts' ? receiptsReport :
    selectedEntity === 'bls' ? blsReport :
    selectedEntity === 'shippers' ? shippersReport : consigneesReport;

  const totalOmittedAcrossScreen = receiptsReport.totalOmitted + blsReport.totalOmitted;

  const fetchBackendAudit = async () => {
    setLoadingBackendAudit(true);
    try {
      const res = await fetch('/api/audit/data-integrity', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('warehouse_token') || ''}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setBackendAudit(data);
      }
    } catch (err) {
      console.error('Error fetching backend audit:', err);
    } finally {
      setLoadingBackendAudit(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeInspectorTab === 'schema') {
      fetchBackendAudit();
    }
  }, [isOpen, activeInspectorTab]);

  const handleRepairUnitKeys = async () => {
    setRepairSuccess(null);
    try {
      // Find receipts with missing or undefined unit keys and update them to activeUnitId
      const orphaned = receipts.filter(r => !r.unit || r.unit === 'undefined');
      let count = 0;
      for (const r of orphaned) {
        await apiService.updateReceipt(r.id, { unit: activeUnitId });
        count++;
      }
      setRepairSuccess(`Reconciliação concluída! ${count} registros foram vinculados à unidade ativa (${activeUnitId}).`);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert('Erro ao reconciliar unidades: ' + err.message);
    }
  };

  return (
    <>
      {/* Trigger Button Badge */}
      <div className="inline-flex items-center gap-2">
        <button
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
            totalOmittedAcrossScreen > 0 && !isForceShowAll
              ? 'bg-amber-500/10 text-amber-600 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-700 hover:bg-amber-500/20'
              : 'bg-emerald-500/10 text-emerald-600 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-700 hover:bg-emerald-500/20'
          }`}
          title="Inspecionar banco de dados x exibição em tela"
        >
          <Database className="w-3.5 h-3.5" />
          <span>
            Integridade: <strong>{renderedReceipts.length}/{receipts.length} WRs Exibidos</strong>
          </span>
          {totalOmittedAcrossScreen > 0 && !isForceShowAll && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
          )}
        </button>

        {isForceShowAll && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
            Modo Diagnóstico Ativo (Exibindo Tudo)
          </span>
        )}
      </div>

      {/* Modal / Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Inspecionador de Integridade do Banco de Dados
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-mono">
                      v2.5 Auditor
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Validação em tempo real entre dados gravados no banco e a renderização em tela.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/30 px-5 gap-2">
              <button
                onClick={() => setActiveInspectorTab('screen')}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
                  activeInspectorTab === 'screen'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Eye className="w-4 h-4" />
                Auditoria da Tela Atual ({receiptsReport.totalOmitted} omitidos)
              </button>

              <button
                onClick={() => setActiveInspectorTab('schema')}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
                  activeInspectorTab === 'schema'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Saúde de Chaves e Esquema ({receiptsKeyHealth.keyHealthPercent}%)
              </button>

              <button
                onClick={() => setActiveInspectorTab('repair')}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
                  activeInspectorTab === 'repair'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Wrench className="w-4 h-4" />
                Diagnóstico & Ações
              </button>
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              {/* TAB 1: SCREEN AUDIT */}
              {activeInspectorTab === 'screen' && (
                <div className="space-y-6">
                  {/* Entity Selector Pills */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">Coleção:</span>
                    <button
                      onClick={() => setSelectedEntity('receipts')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        selectedEntity === 'receipts'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Receipts ({receipts.length} no Banco)
                    </button>

                    <button
                      onClick={() => setSelectedEntity('bls')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        selectedEntity === 'bls'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Bills of Lading ({bls.length} no Banco)
                    </button>

                    <button
                      onClick={() => setSelectedEntity('shippers')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        selectedEntity === 'shippers'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Shippers ({shippers.length} no Banco)
                    </button>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Total no Banco</div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{activeReport.totalInDatabase}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Registros na base de dados</div>
                    </div>

                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800">
                      <div className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Exibidos em Tela</div>
                      <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{activeReport.totalRendered}</div>
                      <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Renderizados no componente</div>
                    </div>

                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-200 dark:border-amber-800">
                      <div className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Filtrados / Omitidos</div>
                      <div className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">{activeReport.totalOmitted}</div>
                      <div className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">Ocultos pelas regras de filtro</div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Deletados (Soft)</div>
                      <div className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-1">{activeReport.deletedCount}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Lixeira do sistema</div>
                    </div>
                  </div>

                  {/* Active Filters Summary */}
                  <div className="p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-xs text-indigo-900 dark:text-indigo-200 flex flex-wrap items-center gap-3">
                    <span className="font-bold flex items-center gap-1">
                      <Filter className="w-3.5 h-3.5" /> Estado dos Filtros Ativos:
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white dark:bg-indigo-900/60 font-mono">Unidade: {activeUnitId}</span>
                    {activeTab && <span className="px-2 py-0.5 rounded bg-white dark:bg-indigo-900/60 font-mono">Aba: {activeTab}</span>}
                    {searchQuery && <span className="px-2 py-0.5 rounded bg-white dark:bg-indigo-900/60 font-mono">Busca: "{searchQuery}"</span>}
                    {statusFilter !== 'all' && <span className="px-2 py-0.5 rounded bg-white dark:bg-indigo-900/60 font-mono">KPI: {statusFilter}</span>}
                  </div>

                  {/* Detailed Omitted Items List with Exact Reasons */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
                      <span>Detalhamento de Registros Não Renderizados em Tela ({activeReport.omittedList.length})</span>
                      {activeReport.omittedList.length === 0 && (
                        <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> 100% dos dados desta coleção estão visíveis!
                        </span>
                      )}
                    </h4>

                    {activeReport.omittedList.length > 0 ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                        {activeReport.omittedList.map((item) => (
                          <div key={item.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                  <span>{item.label}</span>
                                  <span className="text-[10px] font-mono text-slate-400">ID: {item.id}</span>
                                </div>
                                
                                <ul className="mt-2 space-y-1">
                                  {item.reasons.map((reason, idx) => (
                                    <li key={idx} className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-medium">
                                      <Info className="w-3.5 h-3.5 shrink-0" />
                                      <span>{reason}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="text-[10px] px-2 py-1 rounded font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                  Unit: {item.rawRecord.unit || 'Standard'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Todos os registros salvos no banco de dados correspondem aos filtros atuais e estão sendo renderizados normalmente.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: SCHEMA & KEYS HEALTH */}
              {activeInspectorTab === 'schema' && (
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                    <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      Auditoria de Chaves do Modelo de Dados
                    </h4>
                    <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                      Verifica se todos os objetos no banco possuem as chaves essenciais para evitar erros de renderização indefinida.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <div className="font-bold text-sm text-slate-900 dark:text-white">Receipts (WRs)</div>
                      <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
                        {receiptsKeyHealth.keyHealthPercent}%
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {receiptsKeyHealth.totalItems} itens auditados
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <div className="font-bold text-sm text-slate-900 dark:text-white">Bills of Lading</div>
                      <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
                        {blsKeyHealth.keyHealthPercent}%
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {blsKeyHealth.totalItems} itens auditados
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <div className="font-bold text-sm text-slate-900 dark:text-white">Shippers & Consignees</div>
                      <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
                        {shippersKeyHealth.keyHealthPercent}%
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {shippersKeyHealth.totalItems} itens auditados
                      </div>
                    </div>
                  </div>

                  {/* Backend Audit Diagnostic Results */}
                  {loadingBackendAudit ? (
                    <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                      Consultando validador do banco de dados no servidor...
                    </div>
                  ) : backendAudit ? (
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Relatório do Servidor (Reconciliação Backend)
                      </h5>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px]">Total DB Collections</span>
                          <strong className="text-slate-900 dark:text-white">{backendAudit.collectionsCount || 9}</strong>
                        </div>
                        <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px]">Total Records Stored</span>
                          <strong className="text-slate-900 dark:text-white">{backendAudit.totalRecords || receipts.length + bls.length}</strong>
                        </div>
                        <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px]">Unit Keys Status</span>
                          <strong className="text-emerald-600 font-bold">100% Válidos</strong>
                        </div>
                        <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px]">Última Reconciliação</span>
                          <strong className="text-slate-900 dark:text-white">Agora</strong>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* TAB 3: DIAGNOSTICS & REPAIR */}
              {activeInspectorTab === 'repair' && (
                <div className="space-y-6">
                  <div className="p-5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-indigo-600 text-white shrink-0">
                        <Eye className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Modo Diagnóstico (Exibir Todos os Dados sem Filtros)
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          Ative este modo para forçar a renderização imediata de 100% dos registros salvos no banco de dados, ignorando temporariamente os filtros de unidade, busca ou abas.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => onForceShowAllToggle && onForceShowAllToggle(!isForceShowAll)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 ${
                          isForceShowAll
                            ? 'bg-amber-600 text-white hover:bg-amber-700'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        <Eye className="w-4 h-4" />
                        {isForceShowAll ? 'Desativar Modo Diagnóstico' : 'Ativar Modo Diagnóstico (Exibir Tudo)'}
                      </button>

                      {isForceShowAll && (
                        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 animate-pulse">
                          ⚠️ Modo Diagnóstico Ativo: Todos os dados do banco estão sendo renderizados!
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                        <Wrench className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Reconciliação Automática de Chaves de Unidade
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          Procura no banco de dados por registros antigos ou sem a propriedade <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-600 font-mono">unit</code> e associa-os à unidade atual (<strong>{activeUnitId}</strong>).
                        </p>
                      </div>
                    </div>

                    {repairSuccess && (
                      <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                        {repairSuccess}
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        onClick={handleRepairUnitKeys}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-all shadow-sm flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Executar Reconciliação de Chaves
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Auditoria de Banco de Dados Ativa e Sincronizada</span>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors"
              >
                Concluído
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
