import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";
import { WarehouseReceipt, BillOfLading, UserProfile, Unit } from "../types";
import WarehouseReceiptPDF from "./WarehouseReceiptPDF";
import WarehouseReceiptForm from "./WarehouseReceiptForm";
import DeleteConfirmationModal from "./DeleteConfirmationModal";
import ExportExcelModal from "./ExportExcelModal";
import DataIntegrityInspector from "./DataIntegrityInspector";
import ImageWithFallback from "./ImageWithFallback";
import ToastContainer, { ToastItem } from "./ToastContainer";
import ItemLabelPrintModal from "./ItemLabelPrintModal";
import AuditTrailModal from "./AuditTrailModal";
import { 
  Search, 
  Filter, 
  FileText, 
  Calendar, 
  Scale, 
  Layers, 
  Eye, 
  Download, 
  Clock, 
  Trash2, 
  CheckCircle2, 
  HelpCircle,
  TrendingUp,
  AlertTriangle,
  ExternalLink,
  Printer,
  Pencil,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Tag,
  History,
  Archive,
  PlusSquare,
  RefreshCw,
  ShieldCheck,
  UserCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DashboardProps {
  activeUnit: 'US' | 'Europe' | string;
  currentUser: UserProfile;
  onReceiveClick?: () => void;
}

export default function Dashboard({ activeUnit, currentUser, onReceiveClick }: DashboardProps) {
  if (currentUser?.tenantRole === "operator") {
    return (
      <div className="p-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-2xl text-amber-700 dark:text-amber-450 text-xs font-medium">
        ⚠️ Restricted Access: As a Yard Operator, please use the simplified Recent Receipts tab to manage your receipts.
      </div>
    );
  }

  const [receipts, setReceipts] = useState<WarehouseReceipt[]>([]);
  const [bls, setBls] = useState<BillOfLading[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'estoque' | 'historico' | 'reciclados'>('estoque');
  const [statusFilter, setStatusFilter] = useState<"all" | "pending_inspection" | "missing_tracking" | "in_stock" | "shipped">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [shipperFilter, setShipperFilter] = useState("");
  const [consigneeFilter, setConsigneeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentTenant, setCurrentTenant] = useState<any>(null);
  
  // State for DeleteConfirmationModal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<WarehouseReceipt | null>(null);

  // State for Volume Label Print Modal
  const [labelReceipt, setLabelReceipt] = useState<WarehouseReceipt | null>(null);

  // State for Audit Trail Modal
  const [auditTarget, setAuditTarget] = useState<{
    resource: string;
    id: string;
    title: string;
    itemData?: any;
  } | null>(null);

  // State for ExportExcelModal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Diagnostic Mode: force render all DB records
  const [isForceShowAll, setIsForceShowAll] = useState(false);

  const isUS = activeUnit === "US";
  const accentText = isUS ? "text-indigo-500" : "text-emerald-500";
  const accentBg = isUS ? "bg-indigo-50 dark:bg-indigo-950/40" : "bg-emerald-50 dark:bg-emerald-950/45";
  const accentBorder = isUS ? "border-indigo-100 dark:border-indigo-900/30" : "border-emerald-100 dark:border-emerald-900/35";
  const accentIconText = isUS ? "text-indigo-600 dark:text-indigo-400" : "text-emerald-600 dark:text-emerald-400";
  const ringColor = isUS ? "focus:ring-indigo-500" : "focus:ring-emerald-500";

  
  // Selected receipt for detailed modal view
  const [selectedReceipt, setSelectedReceipt] = useState<WarehouseReceipt | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);
  const [pdfReceipt, setPdfReceipt] = useState<WarehouseReceipt | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<WarehouseReceipt | null>(null);

  const openReceiptModal = (receipt: WarehouseReceipt) => {
    setSelectedReceipt(receipt);
    setActivePhotoIndex(0);
  };

  const loadReceipts = async () => {
    try {
      setLoading(true);
      const [receiptData, blData, tenantData, unitData] = await Promise.all([
        apiService.getReceipts(),
        apiService.getBLs(),
        apiService.getCurrentTenant().catch(() => null),
        apiService.getUnits().catch(() => [])
      ]);
      setReceipts(receiptData);
      setBls(blData);
      if (tenantData) {
        setCurrentTenant(tenantData);
      }
      if (unitData) {
        setUnits(unitData);
      }
    } catch (err) {
      setError("Error loading receipts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceipts();
  }, [activeUnit]);

  const handleRestoreClick = async (receipt: WarehouseReceipt) => {
    try {
      await apiService.restoreReceipt(receipt.id);
      await loadReceipts();
    } catch (err: any) {
      setError(err.message || "Error restoring receipt.");
    }
  };

  const handleDeleteClick = (receipt: WarehouseReceipt) => {
    // Check if receipt is linked to an active BL
    const activeBLNumber = getBLNumberForReceipt(receipt);
    if (activeBLNumber) {
      alert(`Bloqueio de Segurança:\n\nO Recibo de Armazém ${receipt.number} está atualmente consolidado no Bill of Lading ativo (${activeBLNumber}).\n\nPor favor, desvincule o recibo do formulário do BL antes de movê-lo para a Lixeira.`);
      return;
    }

    if (currentUser?.email === "armando.qualitylogistics@gmail.com") {
      setReceiptToDelete(receipt);
      setIsDeleteModalOpen(true);
    } else {
      if (receipt.status === "RECICLADO") {
        alert("Acesso Negado: Apenas administradores do sistema podem excluir informações permanentemente do banco de dados.");
        return;
      }
      const confirmSoft = window.confirm(`Deseja enviar o recibo ${receipt.number} para a Lixeira? Ele poderá ser restaurado dentro do período de retenção.`);
      if (confirmSoft) {
        handleConfirmSoftDelete(receipt.id);
      }
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

  const handleConfirmSoftDelete = async (id: string) => {
    const targetReceipt = receipts.find(r => r.id === id);
    const receiptNum = targetReceipt ? targetReceipt.number : id;

    try {
      await apiService.deleteReceipt(id);
      await loadReceipts();

      addToast({
        type: "info",
        title: "Recibo Movidó para a Lixeira",
        message: `O recibo ${receiptNum} foi enviado para a Lixeira.`,
        undoLabel: "Desfazer",
        duration: 10000,
        undoAction: async () => {
          try {
            await apiService.restoreReceipt(id);
            await loadReceipts();
            addToast({
              type: "success",
              title: "Exclusão Desfeita",
              message: `O recibo ${receiptNum} foi restaurado com sucesso.`,
              duration: 4000,
            });
          } catch (err: any) {
            setError(err.message || "Erro ao restaurar o recibo.");
          }
        },
      });
    } catch (err: any) {
      setError(err.message || "Error moving receipt to trash bin.");
    }
  };

  const handleConfirmHardDelete = async () => {
    if (!receiptToDelete) return;
    try {
      await apiService.deleteReceipt(receiptToDelete.id);
      setReceiptToDelete(null);
      setIsDeleteModalOpen(false);
      await loadReceipts();
    } catch (err: any) {
      setError(err.message || "Error deleting receipt from the database.");
    }
  };

  const getBLNumberForReceipt = (r: WarehouseReceipt) => {
    if (r.blId) {
      const matchingBl = bls.find(b => b.id === r.blId);
      if (matchingBl) return matchingBl.blNumber;
    }
    const matchingBlByArray = bls.find(b => 
      (b.receiptIds && b.receiptIds.includes(r.id)) ||
      (b.receiptNumbers && b.receiptNumbers.includes(r.number))
    );
    if (matchingBlByArray) return matchingBlByArray.blNumber;
    return null;
  };

  const isReceiptShipped = (r: WarehouseReceipt) => {
    return r.status === "DESPACHADO";
  };

  const receiptsOfUnit = receipts.filter(r => {
    if (r.unitId && r.unitId === activeUnit) return true;
    const rUnit = r.unit || "US";
    if (rUnit === activeUnit) return true;
    const currentUnit = units.find(u => u.id === activeUnit);
    if (currentUnit) {
      if (rUnit === "US" && (currentUnit.region === "US" || currentUnit.unitSystem === "imperial" || currentUnit.name.toLowerCase().includes("orlando"))) return true;
      if (rUnit === "Europe" && (currentUnit.region === "EU" || currentUnit.unitSystem === "metric")) return true;
      if (rUnit === currentUnit.name || rUnit === currentUnit.id || rUnit === currentUnit.region) return true;
    }
    if (activeUnit === "US" || activeUnit.startsWith("u-orlando")) {
      if (rUnit === "US" || !rUnit || rUnit === "Orlando") return true;
    }
    return false;
  });

  // Calculate Operational KPI Stats for active unit
  const activeStockCount = receiptsOfUnit.filter(r => 
    !isReceiptShipped(r) && r.status !== "RECICLADO"
  ).length;

  const pendingInspectionCount = receiptsOfUnit.filter(r => 
    !isReceiptShipped(r) && r.status !== "RECICLADO" && (
      (!r.items || r.items.length === 0) || 
      (!r.photoUrl && (!r.photoUrls || r.photoUrls.length === 0))
    )
  ).length;

  const missingTrackingCount = receiptsOfUnit.filter(r => 
    !isReceiptShipped(r) && r.status !== "RECICLADO" &&
    !r.trackingNumber && !r.proNumbers
  ).length;

  const shippedCount = receiptsOfUnit.filter(r => 
    isReceiptShipped(r)
  ).length;

  const totalUnitWeight = receiptsOfUnit.reduce((sum, r) => sum + (r.totalWeightLbs || r.weight || 0), 0);
  const totalUnitVolumes = receiptsOfUnit.reduce((sum, r) => sum + (r.volumeCount || 0), 0);

  // Divide receipts into stock ("RECEBIDO") or history ("DESPACHADO")
  const estoqueReceipts = receiptsOfUnit.filter(r => !isReceiptShipped(r) && r.status !== "RECICLADO");
  const historicoReceipts = receiptsOfUnit.filter(r => isReceiptShipped(r));
  const recicladosReceipts = receiptsOfUnit.filter(r => r.status === "RECICLADO");

  const receiptsOfTab = activeTab === 'estoque' 
    ? estoqueReceipts 
    : activeTab === 'historico' 
      ? historicoReceipts 
      : recicladosReceipts;

  const filteredReceipts = receiptsOfTab.filter(r => {
    const blNumber = getBLNumberForReceipt(r);
    const matchesSearch = 
      r.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (blNumber && blNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.trackingNumber && r.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      r.shipperName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.consigneeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.poInvoices && r.poInvoices.some(po => 
        (po.poNumber && po.poNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (po.invoiceNumber && po.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()))
      ));
      
    const matchesShipper = shipperFilter ? r.shipperId === shipperFilter : true;
    const matchesConsignee = consigneeFilter ? r.consigneeId === consigneeFilter : true;

    let matchesStatus = true;
    if (statusFilter === "pending_inspection") {
      const hasNoPhoto = !r.photoUrl && (!r.photoUrls || r.photoUrls.length === 0);
      const hasNoItems = !r.items || r.items.length === 0;
      matchesStatus = (hasNoPhoto || hasNoItems) && !isReceiptShipped(r) && r.status !== "RECICLADO";
    } else if (statusFilter === "missing_tracking") {
      matchesStatus = (!r.trackingNumber && !r.proNumbers) && !isReceiptShipped(r) && r.status !== "RECICLADO";
    } else if (statusFilter === "in_stock") {
      matchesStatus = !isReceiptShipped(r) && r.status !== "RECICLADO";
    } else if (statusFilter === "shipped") {
      matchesStatus = isReceiptShipped(r);
    }
    
    return matchesSearch && matchesShipper && matchesConsignee && matchesStatus;
  });

  // Final Receipts to render (supports Diagnostic Mode override)
  const finalReceiptsToRender = isForceShowAll 
    ? receipts.filter(r => !r.deletedAt) 
    : filteredReceipts;

  // Extract unique lists of shippers/consignees present in records for filter dropdowns
  const uniqueShippers = Array.from(new Set(receiptsOfUnit.map(r => JSON.stringify({ id: r.shipperId, name: r.shipperName }))))
    .map((str: string) => JSON.parse(str));
  const uniqueConsignees = Array.from(new Set(receiptsOfUnit.map(r => JSON.stringify({ id: r.consigneeId, name: r.consigneeName }))))
    .map((str: string) => JSON.parse(str));

  const isOld = (dateStr: string) => {
    const createdTime = new Date(dateStr).getTime();
    const planDays = currentTenant?.customRetentionDays !== undefined ? currentTenant.customRetentionDays : 180;
    const limitMs = Date.now() - planDays * 24 * 60 * 60 * 1000;
    return createdTime < limitMs;
  };

  const isOwner = currentUser?.tenantRole === "owner" || currentUser?.platformRole === "superadmin";

  if (editingReceipt) {
    return (
      <WarehouseReceiptForm 
        currentUser={apiService.getCurrentUser()}
        existingReceipt={editingReceipt}
        activeUnit={activeUnit === "Europe" ? "Europe" : "US"}
        onSuccess={() => {
          setEditingReceipt(null);
          loadReceipts();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Title & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-slate-950 dark:text-white">
              Executive Dashboard
            </h1>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono ${
              isOwner 
                ? "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800" 
                : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
            }`}>
              {isOwner ? "Owner View" : "Manager View"}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time monitoring of all cargo receipts, status metrics, and yard inventory flow.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 self-start">
          <DataIntegrityInspector
            receipts={receipts}
            renderedReceipts={finalReceiptsToRender}
            bls={bls}
            units={units}
            activeUnitId={activeUnit}
            activeTab={activeTab}
            searchQuery={searchQuery}
            consigneeFilter={consigneeFilter}
            onRefreshData={loadReceipts}
            onForceShowAllToggle={(val) => setIsForceShowAll(val)}
            isForceShowAll={isForceShowAll}
          />

          <button 
            onClick={() => setIsExportModalOpen(true)}
            className={`px-3.5 py-2 text-white ${isUS ? "bg-indigo-600 hover:bg-indigo-700" : "bg-emerald-600 hover:bg-emerald-700"} active:scale-95 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-xs`}
          >
            <Download className="h-3.5 w-3.5" /> Export Excel
          </button>

          {onReceiveClick && (
            <button
              onClick={onReceiveClick}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 active:scale-95 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-xs"
            >
              <PlusSquare className="h-3.5 w-3.5" />
              + Receive Cargo
            </button>
          )}

          <button 
            onClick={loadReceipts}
            disabled={loading}
            className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 active:scale-95 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Dynamic Operational KPI Cards Grid (Aligned with Operator Dashboard) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Active Inventory */}
        <button
          onClick={() => { setStatusFilter("all"); setActiveTab("estoque"); }}
          className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between cursor-pointer ${
            statusFilter === "all" && activeTab === "estoque"
              ? "bg-slate-900 border-slate-900 dark:bg-white dark:border-white text-white dark:text-slate-950 shadow-xs"
              : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-900 dark:text-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">In Stock</span>
            <Layers className="h-4 w-4 opacity-70" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-display leading-none">{activeStockCount}</span>
            <span className="block text-[10px] opacity-75 mt-1">Active Receipts</span>
          </div>
        </button>

        {/* Card 2: Pending Inspection */}
        <button
          onClick={() => { setStatusFilter("pending_inspection"); setActiveTab("estoque"); }}
          className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between cursor-pointer ${
            statusFilter === "pending_inspection"
              ? "bg-amber-500 border-amber-500 text-white shadow-xs"
              : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700/50 hover:bg-amber-50/20 dark:hover:bg-amber-500/5 text-slate-900 dark:text-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Pending Inspection</span>
            <Eye className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-3">
            <span className={`text-2xl font-black font-display leading-none ${statusFilter === "pending_inspection" ? "text-white" : "text-amber-600 dark:text-amber-400"}`}>{pendingInspectionCount}</span>
            <span className="block text-[10px] opacity-80 mt-1">Missing photos/items</span>
          </div>
        </button>

        {/* Card 3: Missing Tracking */}
        <button
          onClick={() => { setStatusFilter("missing_tracking"); setActiveTab("estoque"); }}
          className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between cursor-pointer ${
            statusFilter === "missing_tracking"
              ? "bg-rose-500 border-rose-500 text-white shadow-xs"
              : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700/50 hover:bg-rose-50/20 dark:hover:bg-rose-500/5 text-slate-900 dark:text-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">No Tracking</span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-3">
            <span className={`text-2xl font-black font-display leading-none ${statusFilter === "missing_tracking" ? "text-white" : "text-rose-600 dark:text-rose-400"}`}>{missingTrackingCount}</span>
            <span className="block text-[10px] opacity-80 mt-1">Needs tracking code</span>
          </div>
        </button>

        {/* Card 4: Dispatched Cargo */}
        <button
          onClick={() => { setStatusFilter("shipped"); setActiveTab("historico"); }}
          className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between cursor-pointer ${
            statusFilter === "shipped" || activeTab === "historico"
              ? "bg-blue-500 border-blue-500 text-white shadow-xs"
              : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700/50 hover:bg-blue-50/20 dark:hover:bg-blue-500/5 text-slate-900 dark:text-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Dispatched Cargo</span>
            <FileText className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-3">
            <span className={`text-2xl font-black font-display leading-none ${statusFilter === "shipped" || activeTab === "historico" ? "text-white" : "text-blue-600 dark:text-blue-400"}`}>{shippedCount}</span>
            <span className="block text-[10px] opacity-80 mt-1">Shipped / History</span>
          </div>
        </button>

        {/* Card 5: Scale Weight & Volume */}
        <div className="p-4 rounded-2xl border bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700/50 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Scale Weight</span>
            <Scale className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-display text-slate-900 dark:text-white leading-none">
              {totalUnitWeight.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })} <span className="text-xs font-normal text-slate-400">lbs</span>
            </span>
            <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
              {(totalUnitWeight * 0.453592).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })} kg | {totalUnitVolumes} pkgs
            </span>
          </div>
        </div>
      </div>

      {/* Prominent Quick CTA Banner (Matching Operator Dashboard) */}
      <div className="bg-gradient-to-r from-indigo-500/10 to-indigo-600/5 dark:from-indigo-950/40 dark:to-indigo-900/10 border border-indigo-150 dark:border-indigo-900/30 p-5 rounded-3xl shadow-3xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <PlusSquare className="h-4.5 w-4.5 text-indigo-500" />
            Receive & Register Cargo (Inbound Yard)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Register new incoming freight, record scale weights, upload photo documentation, and issue warehouse receipts.
          </p>
        </div>
        {onReceiveClick && (
          <button
            onClick={onReceiveClick}
            className={`px-4 py-2.5 ${isUS ? "bg-indigo-600 hover:bg-indigo-700" : "bg-emerald-600 hover:bg-emerald-700"} active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0`}
          >
            <PlusSquare className="h-4 w-4" />
            + Receive New Cargo
          </button>
        )}
      </div>

      {/* Main Filterable Table Container */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xs border border-slate-100 dark:border-slate-700/50">
        
        {/* Tabs Bar */}
        <div className="flex border-b border-slate-100 dark:border-slate-700 mb-6 overflow-x-auto">
          <button
            onClick={() => { setActiveTab('estoque'); setStatusFilter('all'); }}
            className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'estoque'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Current Inventory (Received Cargo)
            <span className="ml-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-350 px-2 py-0.5 rounded-full text-xs font-mono">
              {estoqueReceipts.length}
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('historico'); setStatusFilter('all'); }}
            className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'historico'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Dispatched Cargo History
            <span className="ml-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-350 px-2 py-0.5 rounded-full text-xs font-mono">
              {historicoReceipts.length}
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('reciclados'); setStatusFilter('all'); }}
            className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'reciclados'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Trash Bin (Recycled Cargo)
            <span className="ml-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-350 px-2 py-0.5 rounded-full text-xs font-mono">
              {recicladosReceipts.length}
            </span>
          </button>
        </div>
        
        {/* Search, Filter row with Status Filter Dropdown */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by WR, Tracking, Shipper, or Consignee..."
              className={`block w-full pl-10 pr-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 ${ringColor} text-sm`}
            />
          </div>

          <div className="grid grid-cols-2 sm:flex gap-3">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className={`block w-full py-2.5 pl-3 pr-8 border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl text-xs focus:outline-hidden focus:ring-2 ${ringColor}`}
              >
                <option value="all">All Statuses</option>
                <option value="pending_inspection">⚠️ Pending Inspection</option>
                <option value="missing_tracking">🚨 No Tracking Code</option>
                <option value="in_stock">📦 In Stock</option>
                <option value="shipped">🚢 Dispatched / Shipped</option>
              </select>
            </div>

            <div className="relative">
              <select
                value={shipperFilter}
                onChange={(e) => setShipperFilter(e.target.value)}
                className={`block w-full py-2.5 pl-3 pr-8 border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl text-xs focus:outline-hidden focus:ring-2 ${ringColor}`}
              >
                <option value="">Filter Shipper...</option>
                {uniqueShippers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <select
                value={consigneeFilter}
                onChange={(e) => setConsigneeFilter(e.target.value)}
                className={`block w-full py-2.5 pl-3 pr-8 border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl text-xs focus:outline-hidden focus:ring-2 ${ringColor}`}
              >
                <option value="">Filter Consignee...</option>
                {uniqueConsignees.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {(searchQuery || shipperFilter || consigneeFilter || statusFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setShipperFilter("");
                  setConsigneeFilter("");
                  setStatusFilter("all");
                }}
                className="px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-400 text-xs uppercase font-bold tracking-wider">
                <th className="py-4 px-4 font-display">Receipt (WR)</th>
                <th className="py-4 px-4 font-display">Date / Operator</th>
                <th className="py-4 px-4 font-display">Shipper</th>
                <th className="py-4 px-4 font-display">Consignee</th>
                <th className="py-4 px-4 font-display">Weight / Pcs</th>
                <th className="py-4 px-4 font-display">Tracking Number</th>
                <th className="py-4 px-4 font-display">Photo / Status</th>
                <th className="py-4 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm text-slate-400">
                    <div className="flex justify-center items-center gap-2">
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full" />
                      Loading warehouse receipts...
                    </div>
                  </td>
                </tr>
              ) : finalReceiptsToRender.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm text-slate-500 dark:text-slate-400">
                    No cargo receipts found for the search criteria.
                  </td>
                </tr>
              ) : (
                finalReceiptsToRender.map((r) => {
                  const cleanedUp = r.photoUrl === "CLEANED_UP" || r.photoUrl === "ARCHIVED" || isOld(r.createdAt);
                  const isMissingPhotoOrItems = (!r.items || r.items.length === 0) || (!r.photoUrl && (!r.photoUrls || r.photoUrls.length === 0));
                  return (
                    <tr key={r.id} className="text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                      <td className="py-4 px-4 font-bold font-mono text-indigo-600 dark:text-indigo-400">
                        {r.number}
                        {(getBLNumberForReceipt(r) || r.blId) && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold px-1.5 py-0.5 rounded text-[9px] border border-blue-100 dark:border-blue-900/30">
                              <FileText className="h-2.5 w-2.5" /> BL: {getBLNumberForReceipt(r) || r.blId}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {new Date(r.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          {r.operatorEmail ? ` • ${r.operatorEmail.split('@')[0]}` : ''}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-medium max-w-[120px] truncate" title={r.shipperName}>
                        {r.shipperName}
                      </td>
                      <td className="py-4 px-4 font-medium max-w-[120px] truncate" title={r.consigneeName}>
                        {r.consigneeName}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-semibold">{r.totalPieces ? `${r.totalPieces} Pcs` : `${r.volumeCount} Pkgs`}</div>
                        <div className="font-semibold">{r.totalWeightLbs || r.weight} Lbs</div>
                        <div className="text-[10px] text-slate-400">({(r.totalWeightKgs || (r.totalWeightLbs || r.weight) * 0.453592).toFixed(1)} Kgs)</div>
                      </td>
                      <td className="py-4 px-4 font-mono font-medium tracking-wide">
                        {r.trackingNumber ? (
                          <span className="bg-indigo-50/70 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 px-2 py-1 rounded text-[10px] select-all">
                            {r.trackingNumber}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-450 font-bold px-2 py-0.5 rounded-md text-[9px] border border-rose-100 dark:border-rose-900/10 shadow-3xs" title="Missing tracking number.">
                            ⚠️ No Tracking
                          </span>
                        )}
                        {r.poInvoices && r.poInvoices.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5 max-w-[150px]">
                            {r.poInvoices.map((po, idx) => (
                              <span 
                                key={idx} 
                                className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 font-bold px-1.5 py-0.5 rounded-sm"
                                title={`Invoice: ${po.invoiceNumber || '-'}, Amount: ${po.amount || '-'}`}
                              >
                                PO: {po.poNumber}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-1.5">
                          {cleanedUp ? (
                            <div className="flex items-center gap-1 text-slate-400" title={`Photo compressed and archived after the retention limit of ${currentTenant?.customRetentionDays !== undefined ? currentTenant.customRetentionDays : 180} days.`}>
                              <Clock className="h-3.5 w-3.5 text-amber-500" />
                              <span className="text-[10px]">Archived</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <ImageWithFallback
                                src={r.photoUrls && r.photoUrls.length > 0 ? r.photoUrls[0] : r.photoUrl}
                                alt={`Foto do recibo ${r.number}`}
                                onClick={() => openReceiptModal(r)}
                                badgeCount={r.photoUrls?.length}
                                fallbackLabel="Sem foto"
                              />
                            </div>
                          )}
                          
                          {/* Status Badge */}
                          <div className="flex flex-wrap gap-1 items-center">
                            {r.status === "DESPACHADO" ? (
                              <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-350 font-bold px-2 py-0.5 rounded-full text-[9px] font-mono border border-blue-100 dark:border-blue-900/30">
                                Dispatched {getBLNumberForReceipt(r) ? `(${getBLNumberForReceipt(r)})` : ''}
                              </span>
                            ) : r.status === "RECICLADO" ? (
                              <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold px-2 py-0.5 rounded-full text-[9px] font-mono border border-slate-200 dark:border-slate-700">
                                Recycled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-350 font-bold px-2 py-0.5 rounded-full text-[9px] font-mono border border-emerald-100 dark:border-emerald-900/30">
                                In Stock
                              </span>
                            )}

                            {isMissingPhotoOrItems && r.status !== "DESPACHADO" && r.status !== "RECICLADO" && (
                              <span className="inline-flex items-center gap-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-bold px-1.5 py-0.5 rounded-md text-[8px] font-mono border border-amber-200 dark:border-amber-900/30" title="Pending Inspection: photo or items detail missing">
                                ⚠️ Needs Inspection
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right flex justify-end gap-1.5">
                        {r.status !== "RECICLADO" ? (
                          <button
                            onClick={() => setEditingReceipt(r)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-450 rounded-lg cursor-pointer transition-colors"
                            title="Edit Warehouse Receipt"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRestoreClick(r)}
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-lg cursor-pointer transition-colors"
                            title="Restore Warehouse Receipt"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openReceiptModal(r)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer transition-colors"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setPdfReceipt(r)}
                          className="p-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg cursor-pointer transition-colors"
                          title="View Receipt Template (PDF)"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setLabelReceipt(r)}
                          className="p-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-lg cursor-pointer transition-colors"
                          title="Imprimir Etiquetas por Volume (QR Code / Código de Barras)"
                        >
                          <Tag className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setAuditTarget({
                            resource: "receipts",
                            id: r.id,
                            title: `Recibo de Armazém ${r.number}`,
                            itemData: r
                          })}
                          className="p-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-lg cursor-pointer transition-colors"
                          title="Histórico de Alterações (Audit Trail)"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        {(currentUser?.tenantRole === "owner" || currentUser?.platformRole === "superadmin") && (
                          <button
                            onClick={() => handleDeleteClick(r)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-lg cursor-pointer transition-colors"
                            title={r.status === "RECICLADO" ? "Delete permanently" : "Move to trash"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Inspector Modal */}
      <AnimatePresence>
        {selectedReceipt && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedReceipt(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Left Side: Photo panel */}
              <div className="md:w-1/2 bg-slate-100 dark:bg-slate-900 min-h-[260px] md:min-h-[380px] relative flex flex-col justify-between overflow-hidden">
                {selectedReceipt.photoUrl === "CLEANED_UP" || selectedReceipt.photoUrl === "ARCHIVED" || isOld(selectedReceipt.createdAt) ? (
                  <div className="p-6 text-center max-w-xs m-auto">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 mb-3 animate-pulse">
                      <Archive className="h-6 w-6" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">Compressed & Archived Photo</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      In compliance with the extended retention of {currentTenant?.customRetentionDays !== undefined ? currentTenant.customRetentionDays : 180} days for cargo claims, this photo has been compressed (Gzip) and moved to secure cold-storage to save space.
                    </p>
                  </div>
                ) : (
                  (() => {
                    const modalPhotos = selectedReceipt.photoUrls && selectedReceipt.photoUrls.length > 0
                      ? selectedReceipt.photoUrls.filter(url => url !== "CLEANED_UP" && url !== "ARCHIVED")
                      : selectedReceipt.photoUrl && selectedReceipt.photoUrl !== "CLEANED_UP" && selectedReceipt.photoUrl !== "ARCHIVED"
                        ? [selectedReceipt.photoUrl]
                        : [];

                    const isPdf = (url: string) => {
                      return url.toLowerCase().endsWith(".pdf") || url.startsWith("data:application/pdf");
                    };

                    if (modalPhotos.length > 0) {
                      const currentItem = modalPhotos[activePhotoIndex];
                      const itemIsPdf = isPdf(currentItem);

                      return (
                        <div className="relative w-full h-full flex-1 flex flex-col justify-center bg-black">
                          {itemIsPdf ? (
                            <div className="w-full h-full min-h-[250px] flex flex-col justify-center items-center text-white p-6 bg-slate-900">
                              <div className="p-4 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30 mb-4">
                                <FileText className="h-10 w-10 animate-pulse" />
                              </div>
                              <h4 className="text-xs font-bold text-slate-100">PDF Document / Packing List</h4>
                              <p className="text-[10px] text-slate-400 mt-1 mb-4 text-center max-w-xs">
                                This attachment is an original PDF document uploaded with this cargo.
                              </p>
                              <a 
                                href={currentItem}
                                download={`documento-${selectedReceipt.number}.pdf`}
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                View / Download PDF
                              </a>
                            </div>
                          ) : (
                            <img 
                              src={currentItem} 
                              alt={`Foto da Carga ${activePhotoIndex + 1}`} 
                              className="w-full h-full object-contain max-h-[300px] md:max-h-[380px]"
                              referrerPolicy="no-referrer"
                            />
                          )}

                          {/* Arrow Navigation for multiple photos */}
                          {modalPhotos.length > 1 && (
                            <>
                              <button
                                type="button"
                                onClick={() => setActivePhotoIndex(prev => (prev - 1 + modalPhotos.length) % modalPhotos.length)}
                                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer"
                                title="Previous"
                              >
                                <ChevronLeft className="h-5 w-5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setActivePhotoIndex(prev => (prev + 1) % modalPhotos.length)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer"
                                title="Next"
                              >
                                <ChevronRight className="h-5 w-5" />
                              </button>
                            </>
                          )}

                          {/* Index badge */}
                          <div className="absolute top-2 left-2 bg-slate-900/80 px-2 py-1 rounded-md text-[9px] font-bold text-white flex items-center gap-1 backdrop-blur-xs shadow-sm">
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" /> 
                            Attachment {activePhotoIndex + 1} of {modalPhotos.length}
                          </div>

                          {/* Thumbnail navigation list for multiple photos */}
                          {modalPhotos.length > 1 && (
                            <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5 px-3 overflow-x-auto max-w-full">
                              {modalPhotos.map((p, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setActivePhotoIndex(idx)}
                                  className={`h-8 w-12 rounded border overflow-hidden shrink-0 transition-all ${
                                    idx === activePhotoIndex 
                                      ? "border-indigo-500 ring-1 ring-indigo-500 scale-105" 
                                      : "border-slate-600 opacity-60 hover:opacity-100"
                                  }`}
                                >
                                  {isPdf(p) ? (
                                    <div className="w-full h-full bg-slate-850 flex items-center justify-center text-indigo-400">
                                      <FileText className="h-4 w-4" />
                                    </div>
                                  ) : (
                                    <img src={p} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    } else {
                      return <div className="text-slate-400 italic text-xs m-auto">No photo available</div>;
                    }
                  })()
                )}
              </div>

              {/* Right Side: Details list */}
              <div className="p-6 md:w-1/2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                      {selectedReceipt.number}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(selectedReceipt.createdAt).toLocaleDateString()} {new Date(selectedReceipt.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold font-display text-slate-900 dark:text-white mb-4">
                    Receipt Details
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Shipper</span>
                      <span className="text-slate-800 dark:text-slate-200 font-medium">{selectedReceipt.shipperName}</span>
                    </div>

                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Consignee</span>
                      <span className="text-slate-800 dark:text-slate-200 font-medium">{selectedReceipt.consigneeName}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">Total Weight</span>
                        <span className="text-slate-800 dark:text-slate-200 font-medium font-mono">
                          {selectedReceipt.totalWeightLbs || selectedReceipt.weight} Lbs ({(selectedReceipt.totalWeightKgs || (selectedReceipt.totalWeightLbs || selectedReceipt.weight) * 0.453592).toFixed(1)} Kgs)
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Packages</span>
                        <span className="text-slate-800 dark:text-slate-200 font-medium">{selectedReceipt.volumeCount} packages</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">Vol. Weight (DIM)</span>
                        <span className="text-slate-800 dark:text-slate-200 font-medium font-mono">
                          {selectedReceipt.totalVolWeightLbs !== undefined ? selectedReceipt.totalVolWeightLbs : 0} Lbs ({(selectedReceipt.totalVolWeightKgs || (selectedReceipt.totalVolWeightLbs || 0) * 0.453592).toFixed(1)} Kgs)
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">Total Cubage</span>
                        <span className="text-slate-800 dark:text-slate-200 font-medium font-mono">
                          {selectedReceipt.totalCubicCft || 0} Cft ({selectedReceipt.totalCubicCbm || 0} Cbm)
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tracking</span>
                      <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded-sm inline-block mt-0.5">
                        {selectedReceipt.trackingNumber || "NOT PROVIDED"}
                      </span>
                    </div>

                    {selectedReceipt.poInvoices && selectedReceipt.poInvoices.length > 0 && (
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                          Purchase Orders (PO / Invoice)
                        </span>
                        <div className="space-y-1 bg-slate-50 dark:bg-slate-900/40 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                          {selectedReceipt.poInvoices.map((po, index) => (
                            <div key={index} className="flex justify-between items-center text-[11px] border-b border-slate-100 dark:border-slate-800/50 last:border-0 pb-1 last:pb-0">
                              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                PO: {po.poNumber || "-"}
                              </span>
                              <span className="text-slate-500 dark:text-slate-400">
                                Inv: {po.invoiceNumber || "-"}
                              </span>
                              {po.amount && (
                                <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                                  {po.amount}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedReceipt.items && selectedReceipt.items.length > 0 && (
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                          Received Items & Conditions
                        </span>
                        <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 max-h-[160px] overflow-y-auto">
                          {selectedReceipt.items.map((item, index) => (
                            <div key={index} className="flex flex-col gap-0.5 text-[11px] border-b border-slate-100 dark:border-slate-800/50 last:border-0 pb-1.5 last:pb-0 mb-1 last:mb-0">
                              <div className="flex justify-between items-center font-bold">
                                <span className="text-slate-800 dark:text-slate-200">
                                  {item.qty}x {item.type || "BOX"}
                                </span>
                                <span className="font-mono text-[10px] text-slate-500">
                                  {item.len}x{item.wid}x{item.hgt} in | {item.weight} {item.unit}
                                </span>
                              </div>
                              {item.cargoCondition && (
                                <div className="mt-1 flex items-center">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 text-[9px] font-black uppercase font-mono shadow-3xs">
                                    ⚠️ {item.cargoCondition}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Yard Operator</span>
                      <span className="text-slate-500 dark:text-slate-400">{selectedReceipt.operatorEmail}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setEditingReceipt(selectedReceipt);
                      setSelectedReceipt(null);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1 shadow-xs"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => {
                      setPdfReceipt(selectedReceipt);
                      setSelectedReceipt(null);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1 shadow-xs"
                  >
                    <Printer className="h-3.5 w-3.5" /> Full Receipt (PDF)
                  </button>
                  <button
                    onClick={() => setSelectedReceipt(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-250 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full printable document view */}
      {pdfReceipt && (
        <WarehouseReceiptPDF 
          receipt={pdfReceipt} 
          onClose={() => setPdfReceipt(null)} 
        />
      )}

      {/* Individual Volume Label Print Modal (QR Code / Thermal) */}
      {labelReceipt && (
        <ItemLabelPrintModal
          receipt={labelReceipt}
          onClose={() => setLabelReceipt(null)}
        />
      )}

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

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setReceiptToDelete(null);
        }}
        onConfirm={handleConfirmHardDelete}
        title="Delete Cargo from Stock"
        itemName={receiptToDelete ? receiptToDelete.number : ""}
        expectedConfirmation="DELETE"
      />

      {/* Excel Export Modal */}
      <AnimatePresence>
        {isExportModalOpen && (
          <ExportExcelModal
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            receipts={receipts}
            bls={bls}
            activeUnit={activeUnit}
            units={units}
          />
        )}
      </AnimatePresence>

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
