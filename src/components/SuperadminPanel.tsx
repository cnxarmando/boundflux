import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";
import { Tenant } from "../types";
import { 
  ShieldCheck, 
  Plus, 
  Globe, 
  Building2, 
  UserCheck, 
  RefreshCw, 
  Key, 
  Trash2, 
  History, 
  Layers, 
  Settings, 
  Activity, 
  Database, 
  Users, 
  CheckCircle, 
  XCircle, 
  RotateCcw,
  Sliders,
  Sparkles,
  AlertTriangle,
  Download,
  Edit2,
  Clock,
  Check,
  Copy,
  DollarSign,
  AlertCircle
} from "lucide-react";

export default function SuperadminPanel() {
  const [activeSubTab, setActiveSubTab] = useState<"tenants" | "logins" | "audit" | "trash" | "owners">("tenants");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [trashItems, setTrashItems] = useState<any>({ shippers: [], consignees: [], receipts: [], bls: [] });
  
  const [loading, setLoading] = useState(false);
  const [submittingTenant, setSubmittingTenant] = useState(false);
  const [submittingOwner, setSubmittingOwner] = useState(false);
  const [updatingTenantId, setUpdatingTenantId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create Tenant form states
  const [tenantName, setTenantName] = useState("");
  const [tenantDomain, setTenantDomain] = useState("");
  const [tenantPlan, setTenantPlan] = useState<"Starter" | "Pro" | "Enterprise">("Starter");
  const [retentionDays, setRetentionDays] = useState<string>("30");

  // Owner form states
  const [ownerEmail, setOwnerEmail] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");

  // Edit Tenant inline states
  const [editingTenant, setEditingTenant] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDomain, setEditDomain] = useState("");
  const [editPlan, setEditPlan] = useState<"Starter" | "Pro" | "Enterprise">("Starter");
  const [editStatus, setEditStatus] = useState<"active" | "suspended">("active");
  const [editRetention, setEditRetention] = useState<string>("30");

  // Owners Tab lists & inline edit states
  const [adminInvitations, setAdminInvitations] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [loadingOwners, setLoadingOwners] = useState(false);

  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserRole, setEditUserRole] = useState<string>("operator");

  const [editingInvite, setEditingInvite] = useState<any | null>(null);
  const [editInviteEmail, setEditInviteEmail] = useState("");
  const [editInviteRole, setEditInviteRole] = useState<string>("operator");
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      // 1. Tenants list
      const tenantData = await apiService.getTenants();
      setTenants(tenantData);
      if (tenantData.length > 0 && !selectedTenantId) {
        setSelectedTenantId(tenantData[0].tenantId);
      }

      // 2. Platform Metrics
      const metricData = await apiService.getMetrics();
      setMetrics(metricData);

      // 3. Global Audit Logs
      const logs = await apiService.getAuditLogs();
      // Sort logs by timestamp descending
      const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAuditLogs(sortedLogs);

      // 4. Global Trash Items
      const trash = await apiService.getTrash();
      setTrashItems(trash);

      // 5. Admin Invitations and Users
      const [invitesData, usersData] = await Promise.all([
        apiService.getAdminInvitations().catch(() => []),
        apiService.getAdminUsers().catch(() => [])
      ]);
      setAdminInvitations(invitesData);
      setAdminUsers(usersData);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar dados do painel superadmin.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName || !tenantDomain) return;

    setSubmittingTenant(true);
    setError("");
    setSuccess("");

    try {
      const newTenant = await apiService.createTenant({
        name: tenantName,
        domain: tenantDomain.toLowerCase(),
        planTier: tenantPlan,
        status: "active",
        retentionDays: retentionDays ? Number(retentionDays) : 30
      });
      
      setSuccess(`Empresa "${newTenant.name}" cadastrada com sucesso!`);
      setTenantName("");
      setTenantDomain("");
      setTenantPlan("Starter");
      setRetentionDays("30");
      fetchData();
    } catch (err: any) {
      setError(err.message || "Erro ao criar empresa.");
    } finally {
      setSubmittingTenant(false);
    }
  };

  const handleUpdateTenant = async (tenantId: string) => {
    setUpdatingTenantId(tenantId);
    setError("");
    setSuccess("");
    try {
      await apiService.updateTenant(tenantId, {
        name: editName,
        domain: editDomain,
        planTier: editPlan,
        status: editStatus,
        retentionDays: editRetention ? Number(editRetention) : 30
      });
      setSuccess("Configurações da empresa atualizadas com sucesso!");
      setEditingTenant(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar dados do tenant.");
    } finally {
      setUpdatingTenantId(null);
    }
  };

  const handleDeleteTenant = async (tenantId: string, tenantName: string) => {
    if (!window.confirm(`ATENÇÃO: Você está prestes a excluir a empresa "${tenantName}".\n\nIsso suspenderá todos os acessos dos funcionários dela imediatamente. No entanto, as informações do banco de dados (Shippers, Consignees, Recibos, etc.) serão mantidas por 30 dias para segurança e compliance caso queira restaurar.\n\nDeseja prosseguir com a exclusão suave?`)) {
      return;
    }
    setError("");
    setSuccess("");
    try {
      const res = await apiService.deleteTenant(tenantId);
      setSuccess(res.message || `Empresa "${tenantName}" excluída suavemente com sucesso!`);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Erro ao excluir empresa.");
    }
  };

  const handleRestoreTenant = async (tenantId: string, tenantName: string) => {
    if (!window.confirm(`Deseja restaurar a empresa "${tenantName}" e reativar todos os acessos e informações de banco de dados dela?`)) {
      return;
    }
    setError("");
    setSuccess("");
    try {
      const res = await apiService.restoreTenant(tenantId);
      setSuccess(res.message || `Empresa "${tenantName}" restaurada com sucesso!`);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Erro ao restaurar empresa.");
    }
  };

  const handlePurgeTenant = async (tenantId: string, tenantName: string) => {
    const typed = window.prompt(
      `PURGA DEFINITIVA — esta ação NÃO PODE SER DESFEITA.\n\nTodos os dados de "${tenantName}" (recibos, BLs, shippers, consignees, unidades, usuários) serão apagados permanentemente do banco de dados.\n\nDigite o nome exato da empresa para confirmar: ${tenantName}`
    );
    if (typed !== tenantName) {
      if (typed !== null) {
        setError("Nome digitado não confere. Purga cancelada por segurança.");
      }
      return;
    }
    setError("");
    setSuccess("");
    try {
      const res = await apiService.purgeTenant(tenantId);
      setSuccess(res.message || `Empresa "${tenantName}" purgada definitivamente.`);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Erro ao purgar empresa.");
    }
  };

  const handleResetAllTenants = async () => {
    const typed = window.prompt(
      `RESET TOTAL DA PLATAFORMA — esta ação NÃO PODE SER DESFEITA.\n\nTODAS as empresas (${tenants.length}), usuários, recibos, BLs, unidades, convites e logs de auditoria serão apagados permanentemente.\n\nDigite exatamente a frase abaixo para confirmar:\nRESETAR TUDO`
    );
    if (typed !== "RESETAR TUDO") {
      if (typed !== null) {
        setError("Frase digitada não confere. Reset cancelado por segurança.");
      }
      return;
    }
    setError("");
    setSuccess("");
    try {
      const res = await apiService.resetAllTenants("RESETAR TUDO");
      setSuccess(res.message || "Reset total da plataforma concluído.");
      fetchData();
    } catch (err: any) {
      setError(err.message || "Erro ao resetar a plataforma.");
    }
  };

  const handleDownloadBackup = async (tenantId: string, tenantName: string) => {
    setError("");
    setSuccess("");
    try {
      const backupData = await apiService.downloadTenantBackup(tenantId);
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${tenantName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${tenantId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccess(`Download do backup completo de "${tenantName}" concluído com sucesso!`);
    } catch (err: any) {
      setError(err.message || "Erro ao baixar backup.");
    }
  };

  const handleInviteOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerEmail || !selectedTenantId) return;

    setSubmittingOwner(true);
    setError("");
    setSuccess("");

    try {
      const invite = await apiService.createInvitation(ownerEmail, "owner", selectedTenantId);
      const inviteUrl = `${window.location.origin}/?invite=${invite.id}`;
      setOwnerEmail("");
      
      navigator.clipboard.writeText(inviteUrl);
      setSuccess(`Convite gerado e copiado para a área de transferência!\nE-mail proprietário: ${ownerEmail}\nLink de onboarding: ${inviteUrl}`);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Erro ao gerar convite de proprietário.");
    } finally {
      setSubmittingOwner(false);
    }
  };

  const handleUpdateAdminUser = async (uid: string, currentRole: string) => {
    const isCurrentlyOwner = currentRole === "owner";
    const isSettingToOwner = editUserRole === "owner";

    if (isCurrentlyOwner || isSettingToOwner) {
      if (!editUserEmail || !editUserEmail.trim()) {
        setError("O e-mail do dono da empresa nunca pode ficar em branco, ele só pode ser trocado.");
        return;
      }
    }

    if (!editUserEmail.trim()) {
      setError("O e-mail do usuário não pode ficar em branco.");
      return;
    }

    try {
      setError("");
      setSuccess("");
      await apiService.updateCompanyUser(uid, {
        email: editUserEmail.trim(),
        name: editUserName.trim(),
        tenantRole: editUserRole,
      });
      setSuccess("Dados do membro atualizados com sucesso!");
      setEditingUser(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar usuário.");
    }
  };

  const handleDeleteAdminUser = async (uid: string, userEmail: string) => {
    if (!confirm(`Tem certeza que deseja revogar o acesso e remover o usuário "${userEmail}" do sistema? Esta ação é imediata.`)) {
      return;
    }

    try {
      setError("");
      setSuccess("");
      await apiService.deleteCompanyUser(uid);
      setSuccess(`Acesso de ${userEmail} removido com sucesso!`);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Erro ao remover usuário.");
    }
  };

  const handleUpdateAdminInvite = async (id: string) => {
    if (!editInviteEmail || !editInviteEmail.trim()) {
      setError("O e-mail do convidado nunca pode ficar em branco, ele só pode ser alterado por outro e-mail válido.");
      return;
    }

    try {
      setError("");
      setSuccess("");
      await apiService.updateInvitation(id, {
        email: editInviteEmail.trim(),
        role: editInviteRole,
      });
      setSuccess("Convite atualizado com sucesso!");
      setEditingInvite(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar convite.");
    }
  };

  const handleDeleteAdminInvite = async (id: string, userEmail: string) => {
    if (!confirm(`Tem certeza que deseja cancelar e revogar o convite para "${userEmail}"?`)) return;

    try {
      setError("");
      setSuccess("");
      await apiService.deleteInvitation(id);
      setSuccess("Convite revogado com sucesso!");
      fetchData();
    } catch (err: any) {
      setError(err.message || "Erro ao revogar convite.");
    }
  };

  const handleRestoreResource = async (resource: string, id: string) => {
    setError("");
    setSuccess("");
    try {
      await apiService.restoreResource(resource, id);
      setSuccess("Item restaurado com sucesso para seu tenant original!");
      fetchData();
    } catch (err: any) {
      setError(err.message || "Erro ao restaurar item.");
    }
  };

  const handlePurgeResource = async (resource: string, id: string) => {
    if (!window.confirm("ATENÇÃO: Esta ação é irreversível e apagará o registro e todos os arquivos associados definitivamente da nuvem. Confirmar purga?")) {
      return;
    }
    setError("");
    setSuccess("");
    try {
      await apiService.purgeResource(resource, id);
      setSuccess("Item purgado definitivamente do banco de dados!");
      fetchData();
    } catch (err: any) {
      setError(err.message || "Erro ao purgar item.");
    }
  };

  const getTrashCount = () => {
    return (
      (trashItems.shippers?.length || 0) +
      (trashItems.consignees?.length || 0) +
      (trashItems.receipts?.length || 0) +
      (trashItems.billsOfLading?.length || 0)
    );
  };

  return (
    <div className="space-y-6">
      {/* Superadmin Header Panel */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-2xl text-white shadow-lg border border-indigo-900/30">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase tracking-widest rounded border border-emerald-500/30">
                Plataforma SaaS (Modo Deus)
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <h2 className="text-2xl font-bold font-display tracking-tight mt-1 flex items-center gap-2.5">
              <ShieldCheck className="h-6.5 w-6.5 text-indigo-400" />
              Painel de Controle Global (Superadmin)
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Inspecione qualquer empresa cliente, gerencie lixeira multi-tenant, audite logs de segurança e configure planos de faturamento de forma centralizada.
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-bold text-white rounded-xl border border-white/10 transition-all cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Sincronizar Dados Globais
          </button>
        </div>

        {/* Global Multi-Tenant Metrics Ribbon */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-6 pt-6 border-t border-white/10 text-xs">
            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
              <span className="text-slate-400 font-medium block">Total de Tenants</span>
              <span className="text-xl font-bold font-mono mt-0.5 block flex items-center gap-2 text-indigo-300">
                <Building2 className="h-4 w-4 shrink-0 text-indigo-400" />
                {metrics.totalTenants}
              </span>
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
              <span className="text-slate-400 font-medium block">Usuários Ativos</span>
              <span className="text-xl font-bold font-mono mt-0.5 block flex items-center gap-2 text-indigo-300">
                <Users className="h-4 w-4 shrink-0 text-indigo-400" />
                {metrics.totalUsers}
              </span>
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/5" title="Estimativa baseada no preço de tabela do plano de cada tenant ativo. Não reflete cobrança real (sem integração de faturamento).">
              <span className="text-slate-400 font-medium block">MRR Estimado</span>
              <span className="text-xl font-bold font-mono mt-0.5 block flex items-center gap-2 text-emerald-400">
                <DollarSign className="h-4 w-4 shrink-0 text-emerald-400" />
                ${metrics.estimatedMRR?.toLocaleString("en-US") ?? 0}
              </span>
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
              <span className="text-slate-400 font-medium block">Recibos Emitidos</span>
              <span className="text-xl font-bold font-mono mt-0.5 block flex items-center gap-2 text-indigo-300">
                <Layers className="h-4 w-4 shrink-0 text-indigo-400" />
                {metrics.totalReceipts}
              </span>
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
              <span className="text-slate-400 font-medium block">Uso de Storage (GCS)</span>
              <span className="text-xl font-bold font-mono mt-0.5 block flex items-center gap-2 text-indigo-300">
                <Database className="h-4 w-4 shrink-0 text-indigo-400" />
                {metrics.simulatedStorageMB} MB
              </span>
            </div>
            <div className="col-span-2 md:col-span-1 bg-white/5 p-3 rounded-xl border border-white/5">
              <span className="text-slate-400 font-medium block">Ações Auditadas</span>
              <span className="text-xl font-bold font-mono mt-0.5 block flex items-center gap-2 text-indigo-300">
                <Activity className="h-4 w-4 shrink-0 text-indigo-400" />
                {auditLogs.length} logs
              </span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-2xl text-xs text-red-600 dark:text-red-400 font-medium flex items-start gap-2.5">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
          <span className="whitespace-pre-wrap">{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-2xl text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-start gap-2.5">
          <CheckCircle className="h-4.5 w-4.5 shrink-0" />
          <span className="whitespace-pre-wrap">{success}</span>
        </div>
      )}

      {/* Sub Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveSubTab("tenants")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "tenants"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Building2 className="h-4 w-4" />
          Gestão de Clientes (Tenants)
        </button>
        <button
          onClick={() => setActiveSubTab("logins")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "logins"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Activity className="h-4 w-4" />
          Monitoramento de Acessos (Logins)
        </button>
        <button
          onClick={() => setActiveSubTab("audit")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "audit"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <History className="h-4 w-4" />
          Auditoria Global ({auditLogs.length})
        </button>
        <button
          onClick={() => setActiveSubTab("trash")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "trash"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Trash2 className="h-4 w-4" />
          Lixeira Global ({getTrashCount()})
        </button>
        <button
          onClick={() => setActiveSubTab("owners")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "owners"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Onboard Proprietários (Owners)
        </button>
      </div>

      {/* Tab Contents */}
      {activeSubTab === "tenants" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Create Tenant Card */}
          <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="h-4.5 w-4.5 text-emerald-500" />
              Novo Cliente SaaS (Tenant)
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Cadastre uma nova transportadora ou filial corporativa isolada. O domínio corporativo serve para validar logins.
            </p>

            <form onSubmit={handleCreateTenant} className="space-y-4 pt-1">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Nome Fantasia
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Acme Logistics"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Domínio Corporativo (E-mail)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Globe className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Ex: acme.com"
                    value={tenantDomain}
                    onChange={(e) => setTenantDomain(e.target.value)}
                    className="w-full text-xs pl-9 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Plano de Faturamento
                  </label>
                  <select
                    value={tenantPlan}
                    onChange={(e: any) => setTenantPlan(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-hidden"
                  >
                    <option value="Starter">Starter (SaaS)</option>
                    <option value="Pro">Pro (Growth)</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Retenção de Fotos (Dias)
                  </label>
                  <select
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-hidden"
                  >
                    <option value="15">15 Dias Trial</option>
                    <option value="30">30 Dias Padrão</option>
                    <option value="90">90 Dias Estendido</option>
                    <option value="180">180 Dias Compliance</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingTenant}
                className="w-full flex items-center justify-center py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {submittingTenant ? "Cadastrando..." : "Cadastrar Nova Empresa"}
              </button>
            </form>
          </div>

          {/* Tenants List Table */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Key className="h-4.5 w-4.5 text-indigo-500" />
              Empresas Clientes Cadastradas ({tenants.length})
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-2">Empresa / Domínio</th>
                    <th className="py-2.5 px-2">ID</th>
                    <th className="py-2.5 px-2">Plano / Retenção</th>
                    <th className="py-2.5 px-2">Status</th>
                    <th className="py-2.5 px-2">Uso / Saúde</th>
                    <th className="py-2.5 px-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tenants.map((t) => {
                    const isEditing = editingTenant === t.tenantId;
                    const usage = metrics?.tenantBreakdown?.find((tb: any) => tb.tenantId === t.tenantId);
                    return (
                      <tr key={t.tenantId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="py-3 px-2">
                          {isEditing ? (
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-1 text-slate-900 dark:text-white"
                                placeholder="Nome Fantasia"
                              />
                              <input
                                type="text"
                                value={editDomain}
                                onChange={(e) => setEditDomain(e.target.value)}
                                className="w-full text-[10px] font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-1 text-slate-900 dark:text-white"
                                placeholder="Domínio / E-mail"
                              />
                            </div>
                          ) : (
                            <>
                              <span className="font-bold text-slate-900 dark:text-white block">{t.name}</span>
                              <span className="text-[10px] font-mono text-slate-400 block mt-0.5">{t.domain}</span>
                            </>
                          )}
                        </td>
                        <td className="py-3 px-2 font-mono text-slate-500 text-[10px]">{t.tenantId}</td>
                        <td className="py-3 px-2">
                          {isEditing ? (
                            <div className="space-y-1">
                              <select
                                value={editPlan}
                                onChange={(e: any) => setEditPlan(e.target.value)}
                                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm text-[10px] p-0.5"
                              >
                                <option value="Starter">Starter</option>
                                <option value="Pro">Pro</option>
                                <option value="Enterprise">Enterprise</option>
                              </select>
                              <select
                                value={editRetention}
                                onChange={(e) => setEditRetention(e.target.value)}
                                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm text-[10px] p-0.5 block"
                              >
                                <option value="15">15 d</option>
                                <option value="30">30 d</option>
                                <option value="90">90 d</option>
                                <option value="180">180 d</option>
                              </select>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200/10 font-semibold uppercase">
                                {t.planTier}
                              </span>
                              <span className="block text-[9px] text-slate-400 font-medium">
                                TTL: {t.retentionDays || 30} dias
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          {isEditing ? (
                            <select
                              value={editStatus}
                              onChange={(e: any) => setEditStatus(e.target.value)}
                              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm text-[10px] p-0.5"
                            >
                              <option value="active">Ativo</option>
                              <option value="suspended">Suspenso</option>
                            </select>
                          ) : t.deletedAt ? (
                            <span className="inline-flex flex-col items-start gap-0.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/10">
                                <span className="h-1 w-1 rounded-full bg-rose-500" />
                                Excluída (Retido)
                              </span>
                              <span className="text-[8px] text-rose-500/70 block whitespace-nowrap font-bold">
                                Expurgo: {new Date(new Date(t.deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR")}
                              </span>
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                              t.status === "active"
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                                : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400"
                            }`}>
                              <span className={`h-1 w-1 rounded-full ${t.status === "active" ? "bg-emerald-500" : "bg-red-500"}`} />
                              {t.status === "active" ? "Ativo" : "Suspenso"}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          {usage ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                <span title="Usuários"><Users className="h-3 w-3 inline mr-0.5 -mt-0.5" />{usage.userCount}</span>
                                <span title="Conhecimentos de Embarque (BLs)"><Layers className="h-3 w-3 inline mr-0.5 -mt-0.5" />{usage.blCount}</span>
                                <span title="Estimativa de receita mensal"><DollarSign className="h-3 w-3 inline mr-0.5 -mt-0.5" />{usage.estimatedMonthlyValue}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {usage.health === "healthy" && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                                    <span className="h-1 w-1 rounded-full bg-emerald-500" /> Ativa
                                  </span>
                                )}
                                {usage.health === "quiet" && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
                                    <AlertCircle className="h-2.5 w-2.5" /> Baixa atividade
                                  </span>
                                )}
                                {usage.health === "inactive" && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                    <AlertCircle className="h-2.5 w-2.5" /> Sem atividade
                                  </span>
                                )}
                                <span className="text-[9px] text-slate-400 font-medium">
                                  {usage.daysSinceLastActivity === null
                                    ? "nunca"
                                    : usage.daysSinceLastActivity === 0
                                    ? "hoje"
                                    : `há ${usage.daysSinceLastActivity}d`}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[9px] text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex justify-end items-center gap-2">
                            {/* Always allow download backup */}
                            <button
                              onClick={() => handleDownloadBackup(t.tenantId, t.name)}
                              className="p-1.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg cursor-pointer transition-colors"
                              title="Baixar todas as informações do banco de dados (Backup JSON)"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>

                            {isEditing ? (
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => handleUpdateTenant(t.tenantId)}
                                  disabled={updatingTenantId === t.tenantId}
                                  className="px-2 py-1 bg-indigo-600 text-white font-bold rounded-md hover:bg-indigo-700 text-[10px] cursor-pointer"
                                >
                                  {updatingTenantId === t.tenantId ? "Ok..." : "Salvar"}
                                </button>
                                <button
                                  onClick={() => setEditingTenant(null)}
                                  className="px-2 py-1 bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-medium rounded-md text-[10px] cursor-pointer"
                                >
                                  Sair
                                </button>
                              </div>
                            ) : t.deletedAt ? (
                              <>
                                <button
                                  onClick={() => handleRestoreTenant(t.tenantId, t.name)}
                                  className="px-2.5 py-1 text-[10px] font-bold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 cursor-pointer flex items-center gap-1 transition-all"
                                  title="Restaurar Empresa"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                  Restaurar
                                </button>
                                <button
                                  onClick={() => handlePurgeTenant(t.tenantId, t.name)}
                                  className="px-2.5 py-1 text-[10px] font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 cursor-pointer flex items-center gap-1 transition-all"
                                  title="Purgar Definitivamente Agora (não espera 30 dias)"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Purgar Agora
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingTenant(t.tenantId);
                                    setEditName(t.name);
                                    setEditDomain(t.domain);
                                    setEditPlan(t.planTier);
                                    setEditStatus(t.status);
                                    setEditRetention(String(t.retentionDays || 30));
                                  }}
                                  className="p-1.5 text-slate-700 dark:text-slate-200 border border-slate-250 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                                  title="Configurar Plano/Retenção"
                                >
                                  <Sliders className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTenant(t.tenantId, t.name)}
                                  className="p-1.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-lg cursor-pointer transition-colors"
                                  title="Excluir Empresa (Manter banco de dados por 30 dias)"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* DANGER ZONE — full platform reset, for wiping fictitious/test data */}
          <div className="lg:col-span-3 bg-rose-50 dark:bg-rose-950/10 p-5 rounded-2xl border-2 border-dashed border-rose-300 dark:border-rose-900/40 space-y-3">
            <h3 className="text-sm font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle className="h-4.5 w-4.5" />
              Zona de Perigo — Reset Total da Plataforma
            </h3>
            <p className="text-[11px] text-rose-600/80 dark:text-rose-400/70">
              Apaga TODAS as empresas cadastradas ({tenants.length}) e todos os dados associados
              (recibos, BLs, shippers, consignees, unidades, usuários, convites e logs de auditoria)
              permanentemente. Use apenas para limpar dados fictícios/de teste antes de começar a
              operação real. Esta ação não pode ser desfeita.
            </p>
            <button
              onClick={handleResetAllTenants}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-2"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Resetar Toda a Plataforma
            </button>
          </div>

        </div>
      )}

      {activeSubTab === "logins" && (
        <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 animate-fade-in">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="h-4.5 w-4.5 text-indigo-500" />
                Monitoramento de Acessos ao Sistema
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Auditoria de controle em tempo real dos logins realizados na plataforma, exibindo nome, e-mail, empresa vinculada e detalhes do acesso.
              </p>
            </div>
            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/20 px-2.5 py-0.5 rounded-full text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider font-mono">
              {auditLogs.filter((log: any) => log.action === "LOGIN").length} Acessos
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-2">Data / Hora</th>
                  <th className="py-2.5 px-2">Usuário (Nome)</th>
                  <th className="py-2.5 px-2">E-mail</th>
                  <th className="py-2.5 px-2">Empresa Vinculada</th>
                  <th className="py-2.5 px-2">ID Empresa</th>
                  <th className="py-2.5 px-2">Método de Acesso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {auditLogs
                  .filter((log: any) => log.action === "LOGIN")
                  .map((log: any) => {
                    // Try to resolve tenant name
                    const tenant = tenants.find((t) => t.tenantId === log.tenantId);
                    const tenantName = tenant ? tenant.name : "BoundFlux";
                    
                    // Parse name from details: e.g. "Login efetuado via Google OAuth. Nome: John Doe"
                    let userName = "N/A";
                    if (log.details && log.details.includes("Nome: ")) {
                      userName = log.details.split("Nome: ")[1];
                    }

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="py-3 px-2 font-mono text-[10px] text-slate-500">
                          {new Date(log.timestamp).toLocaleString("pt-BR")}
                        </td>
                        <td className="py-3 px-2 font-bold text-slate-900 dark:text-white">
                          {userName}
                        </td>
                        <td className="py-3 px-2 text-slate-600 dark:text-slate-300">
                          {log.performedBy}
                        </td>
                        <td className="py-3 px-2">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/10 uppercase">
                            {tenantName}
                          </span>
                        </td>
                        <td className="py-3 px-2 font-mono text-[10px] text-slate-400">
                          {log.tenantId}
                        </td>
                        <td className="py-3 px-2 text-slate-500 font-medium">
                          {log.details.split(". Nome:")[0] || log.details}
                        </td>
                      </tr>
                    );
                  })}
                {auditLogs.filter((log: any) => log.action === "LOGIN").length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                      Nenhum registro de login encontrado até o momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === "audit" && (
        <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="h-4.5 w-4.5 text-indigo-500" />
                Painel de Auditoria Global (Modo Deus)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Rastreamento centralizado em tempo real de exclusões, restaurações e convites críticos efetuados em todas as contas.
              </p>
            </div>
            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/20 px-2.5 py-0.5 rounded-full text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider font-mono">
              {auditLogs.length} Entradas
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-2">Data/Hora</th>
                  <th className="py-2.5 px-2">Empresa ID</th>
                  <th className="py-2.5 px-2">Operador</th>
                  <th className="py-2.5 px-2">Ação</th>
                  <th className="py-2.5 px-2">Módulo / ID</th>
                  <th className="py-2.5 px-2">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                      Nenhum log de auditoria disponível no momento.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => {
                    let actionBadge = "bg-slate-100 text-slate-700";
                    if (log.action === "SOFT_DELETE") actionBadge = "bg-red-50 text-red-700 border border-red-200/20";
                    if (log.action === "RESTORE" || log.action === "RESTORE_SUPERADMIN") actionBadge = "bg-emerald-50 text-emerald-700 border border-emerald-200/20";
                    if (log.action === "INVITE_USER") actionBadge = "bg-blue-50 text-blue-700 border border-blue-200/20";
                    if (log.action === "PURGE_HARD_DELETE") actionBadge = "bg-rose-950/20 text-rose-400 border border-rose-900/30";

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors font-mono text-[10px]">
                        <td className="py-2.5 px-2 text-slate-500 text-[9px] font-sans">
                          {new Date(log.timestamp).toLocaleString("pt-BR")}
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="font-bold text-slate-650 dark:text-slate-350">{log.tenantId}</span>
                        </td>
                        <td className="py-2.5 px-2 font-sans truncate max-w-[150px]" title={log.performedBy}>
                          {log.performedBy}
                        </td>
                        <td className="py-2.5 px-2">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold ${actionBadge}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="text-slate-800 dark:text-slate-300 font-sans block">{log.resource}</span>
                          <span className="text-[9px] text-slate-450 block truncate max-w-[120px]">{log.resourceId}</span>
                        </td>
                        <td className="py-2.5 px-2 font-sans text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={log.details || `Ação ${log.action} no ID ${log.resourceId}`}>
                          {log.details || "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === "trash" && (
        <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Trash2 className="h-4.5 w-4.5 text-rose-500" />
              Gestão de Lixeira Global (Soft-Deletes Multi-tenant)
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Administre itens removidos de todas as empresas. Registros expiram e são expurgados permanentemente do Firestore após 30 dias de exclusão.
            </p>
          </div>

          <div className="space-y-4">
            {/* Shippers Section */}
            {trashItems.shippers?.length > 0 && (
              <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3.5 bg-slate-50/20">
                <h4 className="text-xs font-bold text-slate-850 dark:text-slate-200 mb-2.5 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Shippers Excluídos ({trashItems.shippers.length})
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase text-[9px]">
                        <th className="py-2 px-1">Nome / Email</th>
                        <th className="py-2 px-1">Excluído Por</th>
                        <th className="py-2 px-1">Tenant ID</th>
                        <th className="py-2 px-1 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {trashItems.shippers.map((item: any) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                          <td className="py-2 px-1">
                            <span className="font-semibold text-slate-900 dark:text-white block">{item.name}</span>
                            <span className="text-[10px] text-slate-450 block">{item.email || "Sem email"}</span>
                          </td>
                          <td className="py-2 px-1 font-mono text-[10px] text-slate-500">{item.deletedBy || "N/A"}</td>
                          <td className="py-2 px-1 font-mono text-[10px] text-indigo-500">{item.tenantId}</td>
                          <td className="py-2 px-1 text-right flex justify-end gap-1">
                            <button
                              onClick={() => handleRestoreResource("shippers", item.id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-md cursor-pointer flex items-center gap-0.5 font-bold"
                              title="Restaurar"
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                            </button>
                            <button
                              onClick={() => handlePurgeResource("shippers", item.id)}
                              className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md cursor-pointer flex items-center gap-0.5 font-bold"
                              title="Purgar"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Purgar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Consignees Section */}
            {trashItems.consignees?.length > 0 && (
              <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3.5 bg-slate-50/20">
                <h4 className="text-xs font-bold text-slate-850 dark:text-slate-200 mb-2.5 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Consignees Excluídos ({trashItems.consignees.length})
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase text-[9px]">
                        <th className="py-2 px-1">Nome / Email</th>
                        <th className="py-2 px-1">Excluído Por</th>
                        <th className="py-2 px-1">Tenant ID</th>
                        <th className="py-2 px-1 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {trashItems.consignees.map((item: any) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                          <td className="py-2 px-1">
                            <span className="font-semibold text-slate-900 dark:text-white block">{item.name}</span>
                            <span className="text-[10px] text-slate-450 block">{item.email || "Sem email"}</span>
                          </td>
                          <td className="py-2 px-1 font-mono text-[10px] text-slate-500">{item.deletedBy || "N/A"}</td>
                          <td className="py-2 px-1 font-mono text-[10px] text-indigo-500">{item.tenantId}</td>
                          <td className="py-2 px-1 text-right flex justify-end gap-1">
                            <button
                              onClick={() => handleRestoreResource("consignees", item.id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-md cursor-pointer flex items-center gap-0.5 font-bold"
                              title="Restaurar"
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                            </button>
                            <button
                              onClick={() => handlePurgeResource("consignees", item.id)}
                              className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md cursor-pointer flex items-center gap-0.5 font-bold"
                              title="Purgar"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Purgar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Warehouse Receipts Section */}
            {trashItems.receipts?.length > 0 && (
              <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3.5 bg-slate-50/20">
                <h4 className="text-xs font-bold text-slate-850 dark:text-slate-200 mb-2.5 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Warehouse Receipts (WR) Excluídos ({trashItems.receipts.length})
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase text-[9px]">
                        <th className="py-2 px-1">Número WR / Cliente</th>
                        <th className="py-2 px-1">Peças / Peso</th>
                        <th className="py-2 px-1">Excluído Por</th>
                        <th className="py-2 px-1">Tenant ID</th>
                        <th className="py-2 px-1 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {trashItems.receipts.map((item: any) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                          <td className="py-2 px-1">
                            <span className="font-bold text-slate-900 dark:text-white block">{item.number}</span>
                            <span className="text-[10px] text-slate-450 block">Dest: {item.consigneeName}</span>
                          </td>
                          <td className="py-2 px-1">
                            <span className="font-mono text-slate-700 dark:text-slate-300 block">{item.totalPieces} pcs</span>
                            <span className="text-[10px] text-slate-450 block font-mono">{item.totalWeightLbs} Lbs</span>
                          </td>
                          <td className="py-2 px-1 font-mono text-[10px] text-slate-500">{item.deletedBy || "N/A"}</td>
                          <td className="py-2 px-1 font-mono text-[10px] text-indigo-500">{item.tenantId}</td>
                          <td className="py-2 px-1 text-right flex justify-end gap-1">
                            <button
                              onClick={() => handleRestoreResource("receipts", item.id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-md cursor-pointer flex items-center gap-0.5 font-bold"
                              title="Restaurar"
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                            </button>
                            <button
                              onClick={() => handlePurgeResource("receipts", item.id)}
                              className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md cursor-pointer flex items-center gap-0.5 font-bold"
                              title="Purgar"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Purgar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Bills of Lading Section */}
            {trashItems.billsOfLading?.length > 0 && (
              <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3.5 bg-slate-50/20">
                <h4 className="text-xs font-bold text-slate-850 dark:text-slate-200 mb-2.5 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Bills of Lading (BL) Excluídos ({trashItems.billsOfLading.length})
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase text-[9px]">
                        <th className="py-2 px-1">Número BL</th>
                        <th className="py-2 px-1">Destinatário (Consignee)</th>
                        <th className="py-2 px-1">Excluído Por</th>
                        <th className="py-2 px-1">Tenant ID</th>
                        <th className="py-2 px-1 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {trashItems.billsOfLading.map((item: any) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                          <td className="py-2 px-1">
                            <span className="font-bold text-slate-900 dark:text-white block">{item.blNumber}</span>
                            <span className="text-[10px] text-slate-450 block">Doc: {item.documentNumber}</span>
                          </td>
                          <td className="py-2 px-1 truncate max-w-[150px]" title={item.consignee}>
                            {item.consignee}
                          </td>
                          <td className="py-2 px-1 font-mono text-[10px] text-slate-500">{item.deletedBy || "N/A"}</td>
                          <td className="py-2 px-1 font-mono text-[10px] text-indigo-500">{item.tenantId}</td>
                          <td className="py-2 px-1 text-right flex justify-end gap-1">
                            <button
                              onClick={() => handleRestoreResource("bls", item.id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-md cursor-pointer flex items-center gap-0.5 font-bold"
                              title="Restaurar"
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                            </button>
                            <button
                              onClick={() => handlePurgeResource("bls", item.id)}
                              className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md cursor-pointer flex items-center gap-0.5 font-bold"
                              title="Purgar"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Purgar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {getTrashCount() === 0 && (
              <div className="py-12 border border-dashed border-slate-200 dark:border-slate-800 text-center rounded-2xl">
                <Trash2 className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <span className="text-xs text-slate-400 block font-medium">Lixeira vazia de ponta a ponta</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Nenhum registro com soft-delete foi encontrado em nenhum dos tenants cadastrados.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === "owners" && (
        <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-indigo-500" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Credenciar Proprietários de Empresas (Tenant Owner)
              </h3>
              <p className="text-[11px] text-slate-500">
                Gere um link especial de onboarding de proprietários. Quando acessarem o link usando sua conta Google (ou efetuando cadastro), eles serão vinculados como administradores proprietários do tenant correspondente.
              </p>
            </div>
          </div>

          <form onSubmit={handleInviteOwner} className="space-y-4 max-w-xl pt-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                E-mail Google do Proprietário (Owner)
              </label>
              <input
                type="email"
                required
                placeholder="Ex: owner@empresa.com"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Empresa Vinculada (Tenant)
              </label>
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Selecione uma empresa...</option>
                {tenants.map(t => (
                  <option key={t.tenantId} value={t.tenantId}>
                    {t.name} ({t.domain})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={submittingOwner || !selectedTenantId || !ownerEmail}
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              {submittingOwner ? "Processando..." : "Gerar Acesso Owner"}
            </button>
          </form>

          {/* Quick instructions */}
          <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-150/20 rounded-xl p-4 text-[11px] text-indigo-700 dark:text-indigo-400 leading-relaxed space-y-2 mt-4 max-w-2xl">
            <h4 className="font-bold flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 shrink-0" /> Como proceder com o credenciamento:
            </h4>
            <ol className="list-decimal pl-4 space-y-1 font-medium">
              <li>Adicione o e-mail Google do proprietário acima e selecione sua respectiva empresa.</li>
              <li>O sistema copiará automaticamente o link de onboarding gerado (que contém um token seguro).</li>
              <li>Envie esse link para o proprietário por e-mail ou chat.</li>
              <li>Quando ele clicar e realizar o login com seu Google, o sistema reconhecerá o token, criará o perfil dele no banco de dados e atribuirá a ele a permissão total de <strong>Owner</strong> do tenant dele.</li>
            </ol>
          </div>

          {/* Active Users Table */}
          <div className="pt-6 border-t border-slate-150 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Membros e Proprietários Ativos ({adminUsers.filter(u => u.platformRole !== "superadmin").length})
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2 px-2">Nome / E-mail</th>
                    <th className="py-2 px-2">Empresa</th>
                    <th className="py-2 px-2">Função / Permissão</th>
                    <th className="py-2 px-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {adminUsers.filter(u => u.platformRole !== "superadmin").map((member) => {
                    const isEditing = editingUser?.uid === member.uid;
                    if (isEditing) {
                      return (
                        <tr key={member.uid} className="bg-slate-50/50 dark:bg-slate-800/40">
                          <td className="py-3 px-2">
                            <div className="space-y-1.5 max-w-xs">
                              <input
                                type="text"
                                value={editUserName}
                                onChange={(e) => setEditUserName(e.target.value)}
                                placeholder="Nome"
                                className="w-full text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-950 dark:text-white"
                              />
                              <input
                                type="email"
                                value={editUserEmail}
                                onChange={(e) => setEditUserEmail(e.target.value)}
                                placeholder="E-mail"
                                className="w-full text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-950 dark:text-white font-mono"
                              />
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <span className="font-semibold text-slate-600 dark:text-slate-350">{member.tenantName || "BoundFlux"}</span>
                          </td>
                          <td className="py-3 px-2">
                            <select
                              value={editUserRole}
                              onChange={(e) => setEditUserRole(e.target.value)}
                              className="text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-950 dark:text-white focus:outline-hidden"
                            >
                              <option value="operator">Operador</option>
                              <option value="admin">Gerente</option>
                              <option value="owner">Proprietário (Owner)</option>
                            </select>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleUpdateAdminUser(member.uid, member.tenantRole)}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[10px] cursor-pointer"
                              >
                                Salvar
                              </button>
                              <button
                                onClick={() => setEditingUser(null)}
                                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-medium rounded-lg text-[10px] cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={member.uid} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-2 font-medium">
                          <div className="flex flex-col">
                            <span className="text-slate-900 dark:text-white font-bold">{member.name || "Sem Nome"}</span>
                            <span className="text-[10px] text-slate-450 font-mono mt-0.5">{member.email}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-slate-600 dark:text-slate-350 font-semibold">
                          {member.tenantName || "BoundFlux"}
                        </td>
                        <td className="py-3 px-2">
                          {member.tenantRole === "owner" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 text-[10px] font-bold uppercase border border-emerald-200/10">
                              Proprietário (Owner)
                            </span>
                          ) : member.tenantRole === "admin" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 text-[10px] font-bold uppercase border border-blue-200/10">
                              Gerente
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-bold uppercase border border-slate-200/10">
                              Operador
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex justify-end gap-1.5 items-center">
                            <button
                              onClick={() => {
                                setEditingUser(member);
                                setEditUserName(member.name || "");
                                setEditUserEmail(member.email || "");
                                setEditUserRole(member.tenantRole || "operator");
                              }}
                              className="p-1.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg cursor-pointer transition-colors"
                              title="Editar dados e permissões do usuário"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAdminUser(member.uid, member.email)}
                              className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/25 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-[10px] font-bold rounded-xl border border-rose-250/20 dark:border-rose-900/30 cursor-pointer transition-all inline-flex items-center gap-1"
                              title="Excluir usuário do sistema"
                            >
                              <Trash2 className="h-3 w-3 shrink-0" />
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Invitations Table */}
          <div className="pt-6 border-t border-slate-150 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Convites de Owners e Membros Pendentes ({adminInvitations.length})
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2 px-2">E-mail Convidado</th>
                    <th className="py-2 px-2">Empresa (Tenant)</th>
                    <th className="py-2 px-2">Permissão</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {adminInvitations.map((invite) => {
                    const inviteUrl = `${window.location.origin}/?invite=${invite.id}`;
                    const isEditing = editingInvite?.id === invite.id;
                    if (isEditing) {
                      return (
                        <tr key={invite.id} className="bg-slate-50/50 dark:bg-slate-800/40">
                          <td className="py-3 px-2">
                            <input
                              type="email"
                              value={editInviteEmail}
                              onChange={(e) => setEditInviteEmail(e.target.value)}
                              placeholder="E-mail"
                              className="w-full max-w-xs text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-950 dark:text-white font-mono"
                            />
                          </td>
                          <td className="py-3 px-2">
                            <span className="font-semibold text-slate-600 dark:text-slate-350">{invite.tenantName || "BoundFlux"}</span>
                          </td>
                          <td className="py-3 px-2">
                            <select
                              value={editInviteRole}
                              onChange={(e) => setEditInviteRole(e.target.value)}
                              className="text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-950 dark:text-white focus:outline-hidden"
                            >
                              <option value="operator">Operador</option>
                              <option value="admin">Gerente</option>
                              <option value="owner">Proprietário (Owner)</option>
                            </select>
                          </td>
                          <td className="py-3 px-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-450 text-[10px] font-bold uppercase border border-amber-200/10">
                              {invite.status || "pendente"}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleUpdateAdminInvite(invite.id)}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[10px] cursor-pointer"
                              >
                                Salvar
                              </button>
                              <button
                                onClick={() => setEditingInvite(null)}
                                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-medium rounded-lg text-[10px] cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={invite.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-2 font-medium text-slate-900 dark:text-white">
                          <div>
                            <p className="font-bold">{invite.email}</p>
                            <span className="block text-[9px] text-slate-400 mt-0.5">
                              Criado em {new Date(invite.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-slate-600 dark:text-slate-350 font-semibold">
                          {invite.tenantName || "BoundFlux"}
                        </td>
                        <td className="py-3 px-2 font-mono">
                          {invite.tenantRole === "owner" ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px] uppercase">
                              Proprietário (Owner)
                            </span>
                          ) : invite.tenantRole === "admin" ? (
                            <span className="text-blue-600 dark:text-blue-400 font-bold text-[10px] uppercase">
                              Gerente
                            </span>
                          ) : (
                            <span className="text-indigo-600 dark:text-indigo-400 text-[10px] uppercase">
                              Operador
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            invite.status === "accepted"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/10"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-450 border border-amber-200/10"
                          }`}>
                            {invite.status === "accepted" ? <Check className="h-3 w-3 shrink-0" /> : <Clock className="h-3 w-3 shrink-0" />}
                            {invite.status === "accepted" ? "Aceito" : "Pendente"}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex justify-end gap-1.5 items-center">
                            {invite.status !== "accepted" && (
                              <>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(inviteUrl);
                                    setCopiedInviteId(invite.id);
                                    setTimeout(() => setCopiedInviteId(null), 2000);
                                  }}
                                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                                  title="Copiar Link de Convite"
                                >
                                  {copiedInviteId === invite.id ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingInvite(invite);
                                    setEditInviteEmail(invite.email);
                                    setEditInviteRole(invite.tenantRole || "operator");
                                  }}
                                  className="p-1.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg cursor-pointer transition-colors"
                                  title="Editar convite"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDeleteAdminInvite(invite.id, invite.email)}
                              className="px-2 py-1 bg-rose-50 dark:bg-rose-950/25 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-[10px] font-bold rounded-xl border border-rose-250/20 dark:border-rose-900/30 cursor-pointer transition-all inline-flex items-center gap-1"
                              title="Excluir convite do sistema"
                            >
                              <Trash2 className="h-3 w-3 shrink-0" />
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}