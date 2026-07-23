import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";
import { UserProfile } from "../types";
import { 
  Trash2, 
  RotateCcw, 
  Users, 
  FileText, 
  FileCheck2, 
  Clock, 
  Calendar,
  User,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Search
} from "lucide-react";

interface TrashBinProps {
  currentUser: UserProfile;
}

export default function TrashBin({ currentUser }: TrashBinProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"shippers" | "consignees" | "receipts" | "bls">("receipts");
  const [trashData, setTrashData] = useState<{
    shippers: any[];
    consignees: any[];
    receipts: any[];
    billsOfLading: any[];
  }>({
    shippers: [],
    consignees: [],
    receipts: [],
    billsOfLading: []
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const isOwner = currentUser.tenantRole === "owner";
  const isSuperadmin = currentUser.platformRole === "superadmin";

  const fetchTrash = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getTrash();
      setTrashData({
        shippers: data.shippers || [],
        consignees: data.consignees || [],
        receipts: data.receipts || [],
        billsOfLading: data.billsOfLading || []
      });
    } catch (err: any) {
      console.error("Error loading trash data:", err);
      setError(err.message || "Não foi possível carregar os itens excluídos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrash();
  }, []);

  const handleRestore = async (resource: string, id: string, name: string) => {
    if (!window.confirm(`Deseja realmente restaurar o registro "${name}"?`)) {
      return;
    }

    setActionLoading(id);
    try {
      await apiService.restoreResource(resource, id);
      alert(`"${name}" foi restaurado com sucesso!`);
      await fetchTrash();
    } catch (err: any) {
      alert(err.message || "Erro ao restaurar o registro.");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePurge = async (resource: string, id: string, name: string) => {
    if (!window.confirm(`ALERTA DE SEGURANÇA: Deseja realmente PURGAR DEFINITIVAMENTE o registro "${name}"? Esta ação removerá os dados fisicamente e é irreversível.`)) {
      return;
    }

    setActionLoading(id);
    try {
      await apiService.purgeResource(resource, id);
      alert(`"${name}" foi purgado definitivamente.`);
      await fetchTrash();
    } catch (err: any) {
      alert(err.message || "Erro ao purgar o registro.");
    } finally {
      setActionLoading(null);
    }
  };

  // Map resources for search and render
  const getActiveList = () => {
    switch (activeSubTab) {
      case "shippers":
        return trashData.shippers;
      case "consignees":
        return trashData.consignees;
      case "receipts":
        return trashData.receipts;
      case "bls":
        return trashData.billsOfLading;
      default:
        return [];
    }
  };

  const filteredItems = getActiveList().filter((item: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    
    if (activeSubTab === "shippers" || activeSubTab === "consignees") {
      return item.name?.toLowerCase().includes(query) || item.email?.toLowerCase().includes(query);
    }
    if (activeSubTab === "receipts") {
      return item.number?.toLowerCase().includes(query) || item.shipperName?.toLowerCase().includes(query) || item.consigneeName?.toLowerCase().includes(query);
    }
    if (activeSubTab === "bls") {
      return item.blNumber?.toLowerCase().includes(query) || item.documentNumber?.toLowerCase().includes(query);
    }
    return true;
  });

  const getDaysRemaining = (deletedAtStr: string) => {
    if (!deletedAtStr) return 30;
    try {
      const deletedAt = new Date(deletedAtStr);
      const now = new Date();
      const diffTime = now.getTime() - deletedAt.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const remaining = 30 - diffDays;
      return remaining > 0 ? remaining : 0;
    } catch {
      return 30;
    }
  };

  if (!isOwner && !isSuperadmin) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm max-w-lg mx-auto text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Acesso Restrito</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Apenas Proprietários de Tenant (<strong className="font-semibold">Owner</strong>) ou Administradores de Plataforma (<strong className="font-semibold">Superadmin</strong>) possuem direitos de visualização e controle da lixeira.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Sync */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-indigo-500" />
            Itens Excluídos (Lixeira do Tenant)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Registros protegidos pela política de retenção temporária de 30 dias com rastreamento de auditoria.
          </p>
        </div>

        <button
          onClick={fetchTrash}
          disabled={loading}
          className="self-start px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Recarregar Lixeira
        </button>
      </div>

      {/* Info Notice Card */}
      <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl flex gap-3 text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
        <Clock className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold">Política de Retenção e Purga Automática de 30 Dias</h4>
          <p className="mt-0.5">
            Registros excluídos suavemente permanecem visíveis para restauração por até <strong>30 dias</strong> a partir do momento da exclusão. Um cronjob de segundo plano roda a cada 12 horas para purgar definitivamente os itens expirados.
          </p>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto bg-slate-50/50 dark:bg-slate-950/20">
          <button
            onClick={() => { setActiveSubTab("receipts"); setSearchQuery(""); }}
            className={`px-5 py-4 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border-b-2 shrink-0 ${
              activeSubTab === "receipts"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-850 dark:hover:text-slate-200"
            }`}
          >
            <FileText className="h-4 w-4" />
            Recibos de Armazém ({trashData.receipts.length})
          </button>
          <button
            onClick={() => { setActiveSubTab("bls"); setSearchQuery(""); }}
            className={`px-5 py-4 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border-b-2 shrink-0 ${
              activeSubTab === "bls"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-850 dark:hover:text-slate-200"
            }`}
          >
            <FileCheck2 className="h-4 w-4" />
            Bills of Lading ({trashData.billsOfLading.length})
          </button>
          <button
            onClick={() => { setActiveSubTab("shippers"); setSearchQuery(""); }}
            className={`px-5 py-4 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border-b-2 shrink-0 ${
              activeSubTab === "shippers"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-850 dark:hover:text-slate-200"
            }`}
          >
            <Users className="h-4 w-4" />
            Shippers ({trashData.shippers.length})
          </button>
          <button
            onClick={() => { setActiveSubTab("consignees"); setSearchQuery(""); }}
            className={`px-5 py-4 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border-b-2 shrink-0 ${
              activeSubTab === "consignees"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-850 dark:hover:text-slate-200"
            }`}
          >
            <Users className="h-4 w-4" />
            Consignees ({trashData.consignees.length})
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center bg-slate-50/20 dark:bg-slate-950/10">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar registros excluídos..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        {/* List Content */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3 text-slate-400" />
            Carregando itens excluídos...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Nenhum registro excluído encontrado para este filtro.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Registro</th>
                  <th className="py-3.5 px-4">Excluído Por</th>
                  <th className="py-3.5 px-4">Data de Exclusão</th>
                  <th className="py-3.5 px-4">Prazo Restante</th>
                  <th className="py-3.5 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-250/50 dark:divide-slate-800/50">
                {filteredItems.map((item: any) => {
                  const daysLeft = getDaysRemaining(item.deletedAt);
                  const isExpiringSoon = daysLeft <= 5;
                  
                  // Extract names based on active tab
                  let displayName = "";
                  let displaySub = "";
                  let resourceName = "";

                  if (activeSubTab === "shippers" || activeSubTab === "consignees") {
                    displayName = item.name;
                    displaySub = item.email || "Sem e-mail informado";
                    resourceName = activeSubTab;
                  } else if (activeSubTab === "receipts") {
                    displayName = item.number;
                    displaySub = `Shipper: ${item.shipperName} | Consignee: ${item.consigneeName}`;
                    resourceName = "receipts";
                  } else if (activeSubTab === "bls") {
                    displayName = item.blNumber;
                    displaySub = `Doc: ${item.documentNumber || "N/A"}`;
                    resourceName = "bls";
                  }

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/35 dark:hover:bg-slate-800/10 text-xs text-slate-700 dark:text-slate-300">
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900 dark:text-white text-sm">
                          {displayName}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-md">
                          {displaySub}
                        </div>
                      </td>
                      <td className="py-4 px-4 font-medium text-slate-650 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-xs">{item.deletedBy || "Desconhecido"}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{item.deletedAt ? new Date(item.deletedAt).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "N/A"}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold ${
                          isExpiringSoon 
                            ? "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 border border-rose-100 dark:border-rose-900/30" 
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-transparent"
                        }`}>
                          <Clock className="h-3 w-3 shrink-0" />
                          {daysLeft} {daysLeft === 1 ? "dia" : "dias"}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2.5">
                          {/* Restore Button */}
                          <button
                            disabled={actionLoading !== null}
                            onClick={() => handleRestore(resourceName, item.id, displayName)}
                            className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/25 border border-emerald-100 dark:border-emerald-900/30 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer text-[11px] font-bold disabled:opacity-50"
                            title="Restaurar registro para a listagem principal"
                          >
                            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                            Restaurar
                          </button>

                          {/* Purge (Hard Delete) - ONLY platform superadmin */}
                          {isSuperadmin && (
                            <button
                              disabled={actionLoading !== null}
                              onClick={() => handlePurge(resourceName, item.id, displayName)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/25 border border-rose-100 dark:border-rose-900/30 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer text-[11px] font-bold disabled:opacity-50"
                              title="Purgar do banco permanentemente"
                            >
                              <Trash2 className="h-3.5 w-3.5 shrink-0" />
                              Purgar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
