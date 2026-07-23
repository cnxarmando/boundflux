import React, { useState, useEffect } from "react";
import { AuditLog } from "../types";
import { apiService } from "../services/api";
import { 
  X, 
  History, 
  User, 
  Clock, 
  FileText, 
  PlusCircle, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  PackageCheck, 
  ShieldAlert,
  Sparkles,
  Info
} from "lucide-react";

interface AuditTrailModalProps {
  resource: "receipts" | "bls" | "shippers" | "consignees" | string;
  resourceId: string;
  resourceTitle: string; // e.g., "Recibo WR-11986" or "Bill of Lading QL2848"
  itemData?: {
    createdAt?: string;
    createdBy?: string;
    operatorEmail?: string;
    updatedAt?: string;
    deletedAt?: string | null;
    deletedBy?: string;
    status?: string;
    blId?: string | null;
  };
  onClose: () => void;
}

export default function AuditTrailModal({
  resource,
  resourceId,
  resourceTitle,
  itemData,
  onClose,
}: AuditTrailModalProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiService.getAuditLogs(resource, resourceId);
        
        // Merge with item synthetic fallback if audit database logs are empty or sparse
        const combined = [...data];

        // Ensure baseline creation log if missing
        const hasCreateLog = combined.some(l => l.action === "CREATE" || l.action.includes("CREATE"));
        if (!hasCreateLog && itemData?.createdAt) {
          combined.push({
            id: `synth-create-${resourceId}`,
            action: "CREATE",
            resource,
            resourceId,
            tenantId: "",
            performedBy: itemData.operatorEmail || itemData.createdBy || "Operador do Sistema",
            timestamp: itemData.createdAt,
            details: `Registro de ${resourceTitle} criado no sistema.`,
          });
        }

        // Ensure baseline update log if updated after creation
        const hasUpdateLog = combined.some(l => l.action === "UPDATE" || l.action.includes("UPDATE"));
        if (!hasUpdateLog && itemData?.updatedAt && itemData.updatedAt !== itemData.createdAt) {
          combined.push({
            id: `synth-update-${resourceId}`,
            action: "UPDATE",
            resource,
            resourceId,
            tenantId: "",
            performedBy: itemData.operatorEmail || "Operador do Sistema",
            timestamp: itemData.updatedAt,
            details: `Registro atualizado com dados recentes.`,
          });
        }

        // Ensure soft delete log if item is deleted
        const hasDeleteLog = combined.some(l => l.action === "SOFT_DELETE");
        if (!hasDeleteLog && itemData?.deletedAt) {
          combined.push({
            id: `synth-delete-${resourceId}`,
            action: "SOFT_DELETE",
            resource,
            resourceId,
            tenantId: "",
            performedBy: itemData.deletedBy || "Administrador",
            timestamp: itemData.deletedAt,
            details: `Registro movido para a Lixeira.`,
          });
        }

        // Sort descending by timestamp
        combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        setLogs(combined);
      } catch (err: any) {
        setError(err.message || "Não foi possível carregar os logs de auditoria.");
      } finally {
        setLoading(false);
      }
    }

    fetchLogs();
  }, [resource, resourceId, resourceTitle, itemData]);

  const getActionBadge = (action: string) => {
    switch (action.toUpperCase()) {
      case "CREATE":
        return {
          icon: PlusCircle,
          label: "Criação de Registro",
          color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
        };
      case "UPDATE":
        return {
          icon: Edit3,
          label: "Edição de Dados",
          color: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800",
        };
      case "SOFT_DELETE":
        return {
          icon: Trash2,
          label: "Movido p/ Lixeira",
          color: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800",
        };
      case "RESTORE":
      case "RESTORE_SUPERADMIN":
        return {
          icon: RotateCcw,
          label: "Restaurado da Lixeira",
          color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
        };
      case "ATTACHED_TO_BL":
      case "CONSOLIDATED":
        return {
          icon: PackageCheck,
          label: "Consolidado em BL",
          color: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800",
        };
      default:
        return {
          icon: History,
          label: action,
          color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
        };
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden my-8">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                Histórico de Alterações (Audit Trail)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {resourceTitle} • ID: <span className="font-mono">{resourceId}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[460px] overflow-y-auto">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="h-8 w-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold">Carregando trilha de auditoria do registro...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl text-rose-700 dark:text-rose-400 text-xs flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Info className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-semibold">Nenhum evento gravado no histórico de auditoria até o momento.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 pl-6 space-y-6">
              {logs.map((log, idx) => {
                const badge = getActionBadge(log.action);
                const BadgeIcon = badge.icon;

                return (
                  <div key={log.id || idx} className="relative group">
                    {/* Timeline Node Dot */}
                    <div className="absolute -left-[31px] top-1 h-5 w-5 rounded-full bg-white dark:bg-slate-900 border-2 border-indigo-600 flex items-center justify-center shadow-xs">
                      <div className="h-2 w-2 rounded-full bg-indigo-600" />
                    </div>

                    {/* Card Container */}
                    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-4 transition-all hover:border-slate-300 dark:hover:border-slate-600 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${badge.color}`}>
                          <BadgeIcon className="h-3 w-3" />
                          <span>{badge.label}</span>
                        </span>

                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {formatDate(log.timestamp)}
                        </span>
                      </div>

                      {/* Details / Text */}
                      {log.details && (
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                          {log.details}
                        </p>
                      )}

                      {/* Performed By User */}
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        <User className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <span>Realizado por: <strong className="text-slate-700 dark:text-slate-300 font-mono">{log.performedBy || "Sistema / Usuário Desconhecido"}</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
