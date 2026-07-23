import React, { useState } from "react";
import { createPortal } from "react-dom";
import { WarehouseReceipt, BillOfLading, Consignee } from "../types";
import { X, Download, CheckSquare, Square, Calendar, User, Layers, Info } from "lucide-react";
import { motion } from "motion/react";
import * as XLSX from "xlsx";

interface ExportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipts: WarehouseReceipt[];
  bls: BillOfLading[];
  activeUnit: string;
  units?: any[];
}

type ExportScope = "PERIOD" | "CONSIGNEE" | "CONSOLIDATION";
type DetailMode = "SUMMARY" | "DETAILED";

interface ColumnOption {
  id: string;
  label: string;
  group: "General" | "Dimensions & Weight" | "Logistics" | "Comments & Details" | "Detailed Items";
}

export default function ExportExcelModal({
  isOpen,
  onClose,
  receipts,
  bls,
  activeUnit,
  units = [],
}: ExportExcelModalProps) {
  // 1. Export Scope
  const [scope, setScope] = useState<ExportScope>("PERIOD");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedConsigneeId, setSelectedConsigneeId] = useState("");
  const [selectedBlId, setSelectedBlId] = useState("");
  const [detailMode, setDetailMode] = useState<DetailMode>("SUMMARY");

  // 2. Column Checklist Options
  const columnOptions: ColumnOption[] = [
    { id: "number", label: "WR Number", group: "General" },
    { id: "createdAt", label: "Registration Date", group: "General" },
    { id: "dateIn", label: "Date In", group: "General" },
    { id: "status", label: "Cargo Status", group: "General" },
    
    { id: "shipperName", label: "Shipper Name", group: "Logistics" },
    { id: "consigneeName", label: "Consignee Name", group: "Logistics" },
    { id: "blNumber", label: "BL Number (Consolidation)", group: "Logistics" },
    { id: "trackingNumber", label: "Tracking / PRO Number", group: "Logistics" },
    { id: "location", label: "Warehouse Location", group: "Logistics" },
    { id: "via", label: "Transport Method", group: "Logistics" },
    
    { id: "totalPieces", label: "Total Pieces", group: "Dimensions & Weight" },
    { id: "totalWeightLbs", label: "Total Weight (Lbs)", group: "Dimensions & Weight" },
    { id: "totalWeightKgs", label: "Total Weight (Kgs)", group: "Dimensions & Weight" },
    { id: "totalCubicCft", label: "Total Volume (Cft)", group: "Dimensions & Weight" },
    { id: "totalCubicCbm", label: "Total Volume (Cbm)", group: "Dimensions & Weight" },

    { id: "itemQty", label: "Item Qty (Detailed)", group: "Detailed Items" },
    { id: "itemType", label: "Item Type (Detailed)", group: "Detailed Items" },
    { id: "itemDims", label: "Item Dims LxWxH (Detailed)", group: "Detailed Items" },
    { id: "itemWeight", label: "Item Weight (Detailed)", group: "Detailed Items" },
    { id: "itemCubic", label: "Item Volume (Detailed)", group: "Detailed Items" },
    { id: "itemCondition", label: "Item Condition (Detailed)", group: "Detailed Items" },
    
    { id: "itemConsolidated", label: "Consolidated Items (Summary LxWxH)", group: "Comments & Details" },
    { id: "comments", label: "Comments", group: "Comments & Details" },
    { id: "operatorEmail", label: "Operator Email", group: "Comments & Details" },
  ];

  // Selected columns state (all checked by default for complete export)
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    columnOptions.map((col) => col.id)
  );

  if (!isOpen) return null;

  const isMatch = (itemUnit: string | undefined) => {
    const u = itemUnit || "US";
    if (u === activeUnit) return true;
    const currentUnit = units.find((un) => un.id === activeUnit);
    if (currentUnit) {
      if (u === "US" && (currentUnit.region === "US" || currentUnit.unitSystem === "imperial" || currentUnit.name.toLowerCase().includes("orlando"))) return true;
      if (u === "Europe" && (currentUnit.region === "EU" || currentUnit.unitSystem === "metric")) return true;
      if (u === currentUnit.name || u === currentUnit.id || u === currentUnit.region) return true;
    }
    if (activeUnit === "US" || activeUnit.startsWith("u-orlando")) {
      if (u === "US" || !u || u === "Orlando") return true;
    }
    return false;
  };

  // Extract unique consignees from receipts of current unit for the select dropdown
  const uniqueConsigneesMap = new Map<string, string>();
  receipts
    .filter((r) => isMatch(r.unit) && r.status !== "RECICLADO")
    .forEach((r) => {
      if (r.consigneeId && r.consigneeName) {
        uniqueConsigneesMap.set(r.consigneeId, r.consigneeName);
      }
    });
  const uniqueConsignees = Array.from(uniqueConsigneesMap.entries()).map(([id, name]) => ({
    id,
    name,
  }));

  // Filter BLs to only include active unit's BLs
  const filteredBls = bls.filter((bl) => isMatch(bl.unit));

  // Toggle selection for all columns
  const handleSelectAll = () => {
    setSelectedColumns(columnOptions.map((col) => col.id));
  };

  const handleSelectNone = () => {
    setSelectedColumns([]);
  };

  const handleToggleColumn = (id: string) => {
    if (selectedColumns.includes(id)) {
      setSelectedColumns(selectedColumns.filter((colId) => colId !== id));
    } else {
      setSelectedColumns([...selectedColumns, id]);
    }
  };

  // Perform Excel file generation
  const handleExport = () => {
    // 1. Filter receipts based on selected scope
    let exportData = receipts.filter(
      (r) => isMatch(r.unit) && r.status !== "RECICLADO"
    );

    if (scope === "PERIOD") {
      if (startDate) {
        const start = new Date(startDate);
        exportData = exportData.filter((r) => new Date(r.createdAt) >= start);
      }
      if (endDate) {
        // Set to end of the day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        exportData = exportData.filter((r) => new Date(r.createdAt) <= end);
      }
    } else if (scope === "CONSIGNEE") {
      if (selectedConsigneeId) {
        exportData = exportData.filter((r) => r.consigneeId === selectedConsigneeId);
      }
      if (startDate) {
        const start = new Date(startDate);
        exportData = exportData.filter((r) => new Date(r.createdAt) >= start);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        exportData = exportData.filter((r) => new Date(r.createdAt) <= end);
      }
    } else if (scope === "CONSOLIDATION") {
      if (selectedBlId) {
        exportData = exportData.filter((r) => r.blId === selectedBlId);
      }
    }

    if (exportData.length === 0) {
      alert("No records found for the selected filters.");
      return;
    }

    // 2. Build rows for Excel
    const rows: any[] = [];

    exportData.forEach((receipt) => {
      // Find matching BL number for this receipt
      let blNumVal = "";
      if (receipt.blId) {
        const matchingBl = bls.find((b) => b.id === receipt.blId);
        blNumVal = matchingBl ? matchingBl.blNumber : "";
      }

      // Map values for requested columns
      const getBaseData = () => {
        const obj: any = {};
        
        if (selectedColumns.includes("number")) obj["WR Number"] = receipt.number;
        if (selectedColumns.includes("createdAt")) {
          obj["Registration Date"] = new Date(receipt.createdAt).toLocaleDateString("en-US", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        }
        if (selectedColumns.includes("dateIn")) {
          obj["Date In"] = receipt.dateIn
            ? new Date(receipt.dateIn).toLocaleDateString("en-US")
            : "";
        }
        if (selectedColumns.includes("status")) obj["Status"] = receipt.status || "RECEIVED";
        if (selectedColumns.includes("shipperName")) obj["Shipper Name"] = receipt.shipperName;
        if (selectedColumns.includes("consigneeName")) obj["Consignee Name"] = receipt.consigneeName;
        if (selectedColumns.includes("blNumber")) obj["BL Number"] = blNumVal;
        if (selectedColumns.includes("trackingNumber")) {
          obj["Tracking / PRO"] = receipt.trackingNumber || receipt.proNumbers || "";
        }
        if (selectedColumns.includes("location")) obj["Location"] = receipt.location || "";
        if (selectedColumns.includes("via")) obj["Transport Method"] = receipt.via || "";
        if (selectedColumns.includes("totalPieces")) obj["Total Pieces"] = receipt.totalPieces || receipt.volumeCount || 0;
        if (selectedColumns.includes("totalWeightLbs")) obj["Total Weight (Lbs)"] = receipt.totalWeightLbs || receipt.weight || 0;
        if (selectedColumns.includes("totalWeightKgs")) obj["Total Weight (Kgs)"] = receipt.totalWeightKgs || 0;
        if (selectedColumns.includes("totalCubicCft")) obj["Total Volume (Cft)"] = receipt.totalCubicCft || 0;
        if (selectedColumns.includes("totalCubicCbm")) obj["Total Volume (Cbm)"] = receipt.totalCubicCbm || 0;
        if (selectedColumns.includes("itemConsolidated")) {
          const dimUnit = (receipt.unit || activeUnit) === "US" ? "in" : "cm";
          obj["Consolidated Items (LxWxH)"] = receipt.items && receipt.items.length > 0
            ? receipt.items.map(item => {
                const qty = item.qty || 1;
                const type = item.type || "BOX";
                const len = item.len !== undefined && item.len !== null ? item.len : "0";
                const wid = item.wid !== undefined && item.wid !== null ? item.wid : "0";
                const hgt = item.hgt !== undefined && item.hgt !== null ? item.hgt : "0";
                const weight = item.weight !== undefined && item.weight !== null ? item.weight : "0";
                const unit = item.unit || "Lbs";
                return `${qty}x ${type} (${len}x${wid}x${hgt} ${dimUnit}, ${weight} ${unit})`;
              }).join("; ")
            : "";
        }
        if (selectedColumns.includes("comments")) obj["Comments"] = receipt.comments || "";
        if (selectedColumns.includes("operatorEmail")) obj["Yard Operator"] = receipt.operatorEmail || "";

        return obj;
      };

      if (detailMode === "SUMMARY" || !receipt.items || receipt.items.length === 0) {
        // Summary row: 1 row per receipt
        rows.push(getBaseData());
      } else {
        // Detailed row: 1 row per item within receipt, repeating basic info
        receipt.items.forEach((item, idx) => {
          const rowData = getBaseData();
          rowData["Item No."] = idx + 1;
          if (selectedColumns.includes("itemQty")) rowData["Item Qty"] = item.qty;
          if (selectedColumns.includes("itemType")) rowData["Item Type"] = item.type || "BOX";
          if (selectedColumns.includes("itemDims")) rowData["Dimensions (LxWxH)"] = `${item.len} x ${item.wid} x ${item.hgt}`;
          if (selectedColumns.includes("itemWeight")) rowData["Item Weight"] = `${item.weight} ${item.unit}`;
          if (selectedColumns.includes("itemCubic")) rowData["Calculated Volume"] = `${item.cubic} ${item.cubicUnit}`;
          if (selectedColumns.includes("itemCondition")) rowData["Item Condition"] = item.cargoCondition || "Excellent";
          rows.push(rowData);
        });
      }
    });

    // 3. Construct SheetJS workbook
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cargo Report");

    // Stylize headers & auto-fit column widths
    const maxLens: Record<string, number> = {};
    rows.forEach((row) => {
      Object.keys(row).forEach((key) => {
        const valStr = row[key] ? String(row[key]) : "";
        maxLens[key] = Math.max(maxLens[key] || 10, valStr.length, key.length);
      });
    });

    ws["!cols"] = Object.keys(maxLens).map((key) => ({
      wch: maxLens[key] + 3,
    }));

    // Save File
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const fileName = `Cargo_Export_${activeUnit}_${scope}_${timestamp}.xlsx`;
    XLSX.writeFile(wb, fileName);
    onClose();
  };

  const isUS = activeUnit === "US";
  const primaryColorClass = isUS ? "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500" : "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500";
  const ringColorClass = isUS ? "focus:ring-indigo-500 border-indigo-100" : "focus:ring-emerald-500 border-emerald-100";
  const selectAccentClass = isUS ? "border-indigo-500 bg-indigo-50/10" : "border-emerald-500 bg-emerald-50/10";
  const activeScopeBorderClass = isUS 
    ? "border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/10 ring-2 ring-indigo-500/20" 
    : "border-emerald-500 bg-emerald-50/10 dark:bg-emerald-950/10 ring-2 ring-emerald-500/20";
  const activeScopeTextClass = isUS ? "text-indigo-600 dark:text-indigo-400" : "text-emerald-600 dark:text-emerald-400";
  const activeScopeIconClass = isUS ? "text-indigo-500" : "text-emerald-500";

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700/60 w-full max-w-2xl overflow-hidden relative z-10 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${isUS ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400" : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"}`}>
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">
                Export Cargo to Excel
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate professional XLSX files with customized filters and tabular structures.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-xl transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* STEP 1: SELECT EXPORT SCOPE */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-slate-500" /> 1. Choose Export Scope
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setScope("PERIOD")}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  scope === "PERIOD"
                    ? activeScopeBorderClass
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-xs font-bold ${scope === "PERIOD" ? activeScopeTextClass : "text-slate-700 dark:text-slate-300"}`}>
                    By Period
                  </span>
                  <Calendar className={`h-4 w-4 ${scope === "PERIOD" ? activeScopeIconClass : "text-slate-400"}`} />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-2">
                  Exports all cargo registered within a date range.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setScope("CONSIGNEE")}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  scope === "CONSIGNEE"
                    ? activeScopeBorderClass
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-xs font-bold ${scope === "CONSIGNEE" ? activeScopeTextClass : "text-slate-700 dark:text-slate-300"}`}>
                    By Consignee
                  </span>
                  <User className={`h-4 w-4 ${scope === "CONSIGNEE" ? activeScopeIconClass : "text-slate-400"}`} />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-2">
                  Filters cargo of a specific importer within a period.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setScope("CONSOLIDATION")}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  scope === "CONSOLIDATION"
                    ? activeScopeBorderClass
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-xs font-bold ${scope === "CONSOLIDATION" ? activeScopeTextClass : "text-slate-700 dark:text-slate-300"}`}>
                    By Batch / Consolidation
                  </span>
                  <Layers className={`h-4 w-4 ${scope === "CONSOLIDATION" ? activeScopeIconClass : "text-slate-400"}`} />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-2">
                  Selects a container / Bill of Lading without date filters.
                </span>
              </button>
            </div>
          </div>

          {/* STEP 2: CONDITIONAL FILTERS */}
          <div className="bg-slate-50 dark:bg-slate-900/35 p-5 rounded-2xl border border-slate-150 dark:border-slate-700/60 space-y-4">
            {scope === "PERIOD" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="startDate" className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                    Start Date (Created)
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-xs p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                    End Date (Created)
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full text-xs p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-white"
                  />
                </div>
              </div>
            )}

            {scope === "CONSIGNEE" && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="consigneeSelect" className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                    Select Consignee (Importer)
                  </label>
                  <select
                    id="consigneeSelect"
                    value={selectedConsigneeId}
                    onChange={(e) => setSelectedConsigneeId(e.target.value)}
                    className="w-full text-xs p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-white font-medium"
                  >
                    <option value="">Select an importer from the list...</option>
                    {uniqueConsignees.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <label htmlFor="startConsDate" className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                      Start Date (Optional)
                    </label>
                    <input
                      type="date"
                      id="startConsDate"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-xs p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="endConsDate" className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                      End Date (Optional)
                    </label>
                    <input
                      type="date"
                      id="endConsDate"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full text-xs p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {scope === "CONSOLIDATION" && (
              <div className="space-y-3">
                <div>
                  <label htmlFor="blSelect" className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                    Select Container Batch / Bill of Lading (BL)
                  </label>
                  <select
                    id="blSelect"
                    value={selectedBlId}
                    onChange={(e) => setSelectedBlId(e.target.value)}
                    className="w-full text-xs p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-white font-medium"
                  >
                    <option value="">Select a Bill of Lading...</option>
                    {filteredBls.map((bl) => (
                      <option key={bl.id} value={bl.id}>
                        {bl.blNumber} - Exporter: {bl.exporter.split("\n")[0]} | Doc: {bl.documentNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-start gap-2.5 bg-indigo-50/50 dark:bg-slate-900/50 border border-indigo-100/40 dark:border-slate-750 p-3 rounded-xl">
                  <Info className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    <strong>Date filters bypassed:</strong> When exporting by container batch (BL), the system ignores and disables date ranges to strictly focus on that batch's consolidation manifest.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: DETAIL MODE */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-2">
              📂 2. Format and Detail Level
            </h3>
            <div className="flex gap-4 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDetailMode("SUMMARY")}
                className={`flex-1 py-3 text-center text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  detailMode === "SUMMARY"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs border border-slate-100 dark:border-slate-700/40"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                Summary View (1 row per Receipt)
              </button>
              <button
                type="button"
                onClick={() => setDetailMode("DETAILED")}
                className={`flex-1 py-3 text-center text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  detailMode === "DETAILED"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs border border-slate-100 dark:border-slate-700/40"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                Detailed View (1 row per Item)
              </button>
            </div>
            {detailMode === "DETAILED" && (
              <p className="text-[10px] text-amber-500 dark:text-amber-400 flex items-center gap-1.5 font-semibold px-1">
                ⚠️ In Detailed View, receipts with multiple items will be expanded to multiple rows in Excel, allowing analysis of individualized dimensions and weights of each piece.
              </p>
            )}
          </div>

          {/* STEP 3: COLUMN CHECKLIST */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                📋 3. Select Columns to Export
              </h3>
              <div className="flex gap-2 text-[10px]">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                >
                  Select All
                </button>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <button
                  type="button"
                  onClick={handleSelectNone}
                  className="text-slate-500 dark:text-slate-400 hover:underline font-bold"
                >
                  Clear Selection
                </button>
              </div>
            </div>

            <div className="space-y-4 max-h-[220px] overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900/20 border border-slate-150 dark:border-slate-700/60 rounded-2xl">
              {["General", "Logistics", "Dimensions & Weight", "Detailed Items", "Comments & Details"].map((groupName) => {
                const groupCols = columnOptions.filter((col) => col.group === groupName);
                if (groupCols.length === 0) return null;

                return (
                  <div key={groupName} className="space-y-2">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block border-b border-slate-100 dark:border-slate-800/60 pb-1">
                      {groupName}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {groupCols.map((col) => {
                        const isChecked = selectedColumns.includes(col.id);
                        return (
                          <button
                            type="button"
                            key={col.id}
                            onClick={() => handleToggleColumn(col.id)}
                            className="flex items-center gap-2 text-xs text-left text-slate-700 dark:text-slate-350 hover:text-slate-900 dark:hover:text-white cursor-pointer py-1 select-none"
                          >
                            {isChecked ? (
                              <CheckSquare className="h-4.5 w-4.5 text-indigo-500 shrink-0" />
                            ) : (
                              <Square className="h-4.5 w-4.5 text-slate-300 dark:text-slate-600 shrink-0" />
                            )}
                            <span className="truncate">{col.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-150 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/25 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={
              selectedColumns.length === 0 ||
              (scope === "CONSIGNEE" && !selectedConsigneeId) ||
              (scope === "CONSOLIDATION" && !selectedBlId)
            }
            className={`px-5 py-2.5 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
              selectedColumns.length === 0 ||
              (scope === "CONSIGNEE" && !selectedConsigneeId) ||
              (scope === "CONSOLIDATION" && !selectedBlId)
                ? "bg-slate-300 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none"
                : `${primaryColorClass} cursor-pointer active:scale-98`
            }`}
          >
            <Download className="h-4 w-4" /> Export Excel Sheet
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
