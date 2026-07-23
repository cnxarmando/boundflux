import React, { useState, useEffect } from "react";
import { BillOfLading, WarehouseReceipt, UserProfile } from "../types";
import { apiService } from "../services/api";
import { 
  FileText, 
  Search, 
  Plus, 
  Printer, 
  Edit3, 
  Trash2, 
  Layers,
  Calendar,
  AlertCircle,
  Truck,
  History
} from "lucide-react";
import BillOfLadingForm from "./BillOfLadingForm";
import BillOfLadingPDF from "./BillOfLadingPDF";
import DataIntegrityInspector from "./DataIntegrityInspector";
import ToastContainer, { ToastItem } from "./ToastContainer";
import AuditTrailModal from "./AuditTrailModal";
import { normalizeUnitMatch } from "../utils/dataAuditor";
import { motion, AnimatePresence } from "motion/react";

interface BillOfLadingListProps {
  activeUnit: 'US' | 'Europe';
  currentUser?: UserProfile;
}

export default function BillOfLadingList({ activeUnit, currentUser }: BillOfLadingListProps) {
  const [blList, setBlList] = useState<BillOfLading[]>([]);
  const [receipts, setReceipts] = useState<WarehouseReceipt[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [expandedBls, setExpandedBls] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isForceShowAll, setIsForceShowAll] = useState(false);

  const toggleExpandBL = (id: string) => {
    setExpandedBls(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Views & Modals state
  const [activeView, setActiveView] = useState<"list" | "create" | "edit">("list");
  const [selectedBLForPDF, setSelectedBLForPDF] = useState<BillOfLading | null>(null);
  const [selectedBLForEdit, setSelectedBLForEdit] = useState<BillOfLading | null>(null);
  const [auditTarget, setAuditTarget] = useState<{
    resource: string;
    id: string;
    title: string;
    itemData?: any;
  } | null>(null);

  useEffect(() => {
    loadBLs();
  }, []);

  const loadBLs = async () => {
    setLoading(true);
    setError(null);
    try {
      const [blData, receiptData, unitData] = await Promise.all([
        apiService.getBLs(),
        apiService.getReceipts(),
        apiService.getUnits().catch(() => [])
      ]);
      setBlList(blData);
      setReceipts(receiptData);
      setUnits(unitData);
    } catch (err: any) {
      setError(err.message || "Failed to load Bills of Lading.");
    } finally {
      setLoading(false);
    }
  };

  // Toast Notification State
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (toast: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastItem = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    const duration = toast.duration || 10000;
    setTimeout(() => {
      removeToast(id);
    }, duration);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleDelete = async (id: string, blNumber: string) => {
    if (!window.confirm(`Deseja mover o Conhecimento de Embarque ${blNumber} para a Lixeira?`)) {
      return;
    }
    try {
      await apiService.deleteBL(id);
      await loadBLs();

      addToast({
        type: "info",
        title: "BL movido para a Lixeira",
        message: `O Conhecimento de Embarque ${blNumber} foi enviado para a Lixeira.`,
        undoLabel: "Desfazer",
        duration: 10000,
        undoAction: async () => {
          try {
            await apiService.restoreResource("bls", id);
            await loadBLs();
            addToast({
              type: "success",
              title: "Exclusão Desfeita",
              message: `O Conhecimento de Embarque ${blNumber} foi restaurado com sucesso.`,
              duration: 4000,
            });
          } catch (err: any) {
            setError(err.message || "Erro ao restaurar o BL.");
          }
        },
      });
    } catch (err: any) {
      alert(err.message || "Erro ao excluir o Conhecimento de Embarque.");
    }
  };

  const handleCreateSuccess = () => {
    setActiveView("list");
    loadBLs();
  };

  const handleEditClick = (bl: BillOfLading) => {
    setSelectedBLForEdit(bl);
    setActiveView("edit");
  };

  const listForUnit = blList.filter(bl => {
    return normalizeUnitMatch(bl.unit, activeUnit, units);
  });

  const filteredBLs = listForUnit.filter(bl => 
    bl.blNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bl.documentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bl.exporter.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bl.consignee.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const finalBLsToRender = isForceShowAll
    ? blList.filter(b => !b.deletedAt)
    : filteredBLs;

  return (
    <div className="space-y-6">
      
      {activeView === "list" && (
        <>
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="h-5.5 w-5.5 text-indigo-500" />
                Bill of Lading (BL) History
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Manage container consolidations and print official BLs for customs clearance.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <DataIntegrityInspector
                receipts={receipts}
                renderedReceipts={receipts}
                bls={blList}
                renderedBLs={finalBLsToRender}
                units={units}
                activeUnitId={activeUnit}
                searchQuery={searchTerm}
                onRefreshData={loadBLs}
                onForceShowAllToggle={(val) => setIsForceShowAll(val)}
                isForceShowAll={isForceShowAll}
              />

              <button
                onClick={() => setActiveView("create")}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-500/10 shrink-0"
              >
                <Plus className="h-4 w-4" /> Consolidate and Generate BL
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex flex-col md:flex-row gap-4 items-center bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by BL No., Document, Exporter or Consignee..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Main List content */}
          {loading ? (
            <div className="text-center py-24 font-mono text-xs text-slate-400">
              Loading Bills of Lading...
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> {error}
            </div>
          ) : finalBLsToRender.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-16 text-center border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Bills of Lading generated</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  You haven't made any consolidations yet. Select cargo in the warehouse to issue your first Bill of Lading!
                </p>
              </div>
              <button
                onClick={() => setActiveView("create")}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-md shadow-indigo-500/10"
              >
                Create First BL
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {finalBLsToRender.map(bl => (
                <div 
                  key={bl.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700"
                >
                  {/* Top line block */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Bill of Lading</span>
                        <h3 className="font-bold text-indigo-650 dark:text-indigo-400 text-sm tracking-tight font-mono flex items-center gap-2">
                          {bl.blNumber}
                        </h3>
                      </div>
                      
                      <div className="bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-150 dark:border-slate-850 text-right">
                        <span className="text-[8px] text-slate-400 block font-mono">Doc Number</span>
                        <strong className="text-[10px] text-slate-700 dark:text-slate-300 font-mono">{bl.documentNumber}</strong>
                      </div>
                    </div>

                    {/* Exporter (Shippers) & Consignee names */}
                    <div className="space-y-2 border-t border-b border-slate-100 dark:border-slate-800/80 py-3 text-xs">
                      <div className="flex gap-2">
                        <span className="text-slate-400 font-bold font-mono w-14 shrink-0 uppercase text-[9px] mt-0.5">Exporter:</span>
                        <span className="text-slate-800 dark:text-slate-200 font-bold truncate">
                          {bl.exporter.split("\n")[0]}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-slate-400 font-bold font-mono w-14 shrink-0 uppercase text-[9px] mt-0.5">Consignee:</span>
                        <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                          {bl.consignee.split("\n")[0]}
                        </span>
                      </div>
                    </div>

                    {/* Aggregated totals */}
                    <div className="grid grid-cols-3 gap-2 py-1">
                      <div className="bg-slate-50/50 dark:bg-slate-950/20 p-2 rounded-xl border border-slate-100 dark:border-slate-800/40">
                        <span className="text-[8px] text-slate-400 block font-mono">VOLUMES</span>
                        <strong className="text-slate-800 dark:text-slate-200 font-mono text-xs">{bl.numberOfPackages}</strong>
                      </div>
                      <div className="bg-slate-50/50 dark:bg-slate-950/20 p-2 rounded-xl border border-slate-100 dark:border-slate-800/40">
                        <span className="text-[8px] text-slate-400 block font-mono">PESO LBS</span>
                        <strong className="text-slate-800 dark:text-slate-200 font-mono text-xs">{bl.grossWeightLbs.toFixed(1)}</strong>
                      </div>
                      <div className="bg-slate-50/50 dark:bg-slate-950/20 p-2 rounded-xl border border-slate-100 dark:border-slate-800/40">
                        <span className="text-[8px] text-slate-400 block font-mono">CUBAGEM CFT</span>
                        <strong className="text-slate-800 dark:text-slate-200 font-mono text-xs">{bl.measurementCft.toFixed(1)}</strong>
                      </div>
                    </div>

                    {/* Included WRs */}
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl">
                      <Layers className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                      <span className="font-mono truncate">
                        WRs: {bl.receiptNumbers.join(", ")}
                      </span>
                    </div>

                    {/* Collapsible Associated Cargas */}
                    <div className="border-t border-slate-100 dark:border-slate-800/60 pt-3 mt-3">
                      <button
                        onClick={() => toggleExpandBL(bl.id)}
                        className="flex items-center justify-between w-full text-left text-xs font-semibold text-indigo-650 dark:text-indigo-400 hover:text-indigo-500 cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5" />
                          Consolidated Cargo ({bl.receiptIds?.length || 0})
                        </span>
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full text-slate-650 dark:text-slate-350">
                          {expandedBls[bl.id] ? "Hide" : "Show"}
                        </span>
                      </button>
                      
                      {expandedBls[bl.id] && (
                        <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                          {(!bl.receiptIds || bl.receiptIds.length === 0) ? (
                            <div className="text-center py-4 text-[10px] text-slate-400 font-mono italic">
                              No cargo associated with this B/L.
                            </div>
                          ) : (
                            bl.receiptIds.map(receiptId => {
                              const wr = receipts.find(r => r.id === receiptId);
                              if (!wr) return null;
                              return (
                                <div key={wr.id} className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-150 dark:border-slate-850/60 flex justify-between items-center text-[11px]">
                                  <div className="space-y-0.5 min-w-0 flex-1 mr-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-[11px]">{wr.number}</span>
                                      <span className="text-[9px] text-slate-400">({new Date(wr.createdAt).toLocaleDateString()})</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate" title={wr.shipperName}>
                                      <span className="font-semibold text-slate-400 font-mono mr-1">S:</span>{wr.shipperName}
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate" title={wr.consigneeName}>
                                      <span className="font-semibold text-slate-400 font-mono mr-1">C:</span>{wr.consigneeName}
                                    </div>
                                  </div>
                                  <div className="text-right font-mono text-[10px] text-slate-700 dark:text-slate-300 shrink-0">
                                    <div className="font-bold">{wr.volumeCount} {wr.volumeCount === 1 ? 'Vol' : 'Vols'}</div>
                                    <div className="text-[9px] text-slate-450">{wr.totalWeightLbs || wr.weight} Lbs</div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions line */}
                  <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-850 flex justify-between items-center text-xs">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {new Date(bl.date + "T12:00:00").toLocaleDateString("en-US")}
                    </span>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedBLForPDF(bl)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/10 hover:bg-indigo-100 text-indigo-650 dark:text-indigo-450 rounded-xl cursor-pointer font-bold font-mono text-[10px] transition-all"
                      >
                        <Printer className="h-3 w-3" /> View BL
                      </button>
                      <button
                        onClick={() => handleEditClick(bl)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-650 dark:text-slate-350 rounded-xl cursor-pointer font-bold text-[10px] transition-all"
                      >
                        <Edit3 className="h-3 w-3" /> Edit
                      </button>
                      <button
                        onClick={() => setAuditTarget({
                          resource: "bls",
                          id: bl.id,
                          title: `Bill of Lading ${bl.blNumber}`,
                          itemData: bl
                        })}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 text-amber-650 dark:text-amber-400 rounded-xl cursor-pointer font-bold text-[10px] transition-all"
                        title="Histórico de Alterações"
                      >
                        <History className="h-3 w-3" />
                      </button>
                      {(currentUser?.tenantRole === "owner" || currentUser?.platformRole === "superadmin") && (
                        <button
                          onClick={() => handleDelete(bl.id, bl.blNumber)}
                          className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl cursor-pointer transition-all"
                          title="Delete Bill of Lading"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Bill of Lading Form (Create Mode) */}
      {activeView === "create" && (
        <BillOfLadingForm 
          activeUnit={activeUnit}
          onSuccess={handleCreateSuccess}
          onCancel={() => setActiveView("list")}
        />
      )}

      {/* Bill of Lading Form (Edit Mode) */}
      {activeView === "edit" && (
        <BillOfLadingForm 
          activeUnit={activeUnit}
          editingBL={selectedBLForEdit}
          onSuccess={handleCreateSuccess}
          onCancel={() => {
            setSelectedBLForEdit(null);
            setActiveView("list");
          }}
        />
      )}

      {/* High Fidelity PDF Viewer overlay */}
      <AnimatePresence>
        {selectedBLForPDF && (
          <BillOfLadingPDF 
            bl={selectedBLForPDF}
            onClose={() => setSelectedBLForPDF(null)}
          />
        )}
      </AnimatePresence>

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Audit Trail Modal */}
      {auditTarget && (
        <AuditTrailModal
          resource={auditTarget.resource}
          resourceId={auditTarget.id}
          resourceTitle={auditTarget.title}
          itemData={auditTarget.itemData}
          onClose={() => setAuditTarget(null)}
        />
      )}
    </div>
  );
}
