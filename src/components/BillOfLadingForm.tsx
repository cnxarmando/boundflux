import React, { useState, useEffect } from "react";
import { WarehouseReceipt, Shipper, Consignee, BillOfLading } from "../types";
import { apiService } from "../services/api";
import { normalizeUnitMatch } from "../utils/dataAuditor";
import { 
  FileText, 
  Search, 
  Plus, 
  Scale, 
  Grid, 
  Layers, 
  CheckCircle, 
  ChevronRight, 
  Sparkles,
  Info
} from "lucide-react";

interface BillOfLadingFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  editingBL?: BillOfLading | null;
  activeUnit: string;
}

export default function BillOfLadingForm({ onSuccess, onCancel, editingBL, activeUnit }: BillOfLadingFormProps) {
  const [receipts, setReceipts] = useState<WarehouseReceipt[]>([]);
  const [shippers, setShippers] = useState<Shipper[]>([]);
  const [consignees, setConsignees] = useState<Consignee[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Select WRs State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<string[]>([]);

  // BL Form fields
  const [blNumber, setBlNumber] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [exportReferences, setExportReferences] = useState("");
  const [date, setDate] = useState("");
  const [exporter, setExporter] = useState("");
  const [consigneeText, setConsigneeText] = useState("");
  const [notifyParty, setNotifyParty] = useState("");
  const [forwardingAgent, setForwardingAgent] = useState("");
  const [pointOfOrigin, setPointOfOrigin] = useState("");
  const [domesticRouting, setDomesticRouting] = useState("");
  
  const [preCarriageBy, setPreCarriageBy] = useState("TRUCK");
  const [placeOfReceipt, setPlaceOfReceipt] = useState("");
  const [exportingCarrier, setExportingCarrier] = useState("");
  const [portOfLoading, setPortOfLoading] = useState("");
  const [foreignPortOfUnloading, setForeignPortOfUnloading] = useState("");
  const [placeOfDelivery, setPlaceOfDelivery] = useState("");
  const [loadingPier, setLoadingPier] = useState("");
  const [typeOfMove, setTypeOfMove] = useState("FCL/FCL");
  const [prepaidCollect, setPrepaidCollect] = useState<"PREPAID" | "COLLECT">("COLLECT");
  
  // Commodity description helpers
  const [marksAndNumbers, setMarksAndNumbers] = useState("CAAU6106025\nSEAL: 0000739");
  const [commodityType, setCommodityType] = useState("KITCHEN EQUIPMENT");
  const [aesItn, setAesItn] = useState("");
  const [capatazia, setCapatazia] = useState("725,00 BRL");
  const [ncmCodes, setNcmCodes] = useState("");
  const [woodPacking, setWoodPacking] = useState("TREATED AND CERTIFIED");
  const [freightCharges, setFreightCharges] = useState("FREIGHT COLLECT");
  const [descriptionOfCommodities, setDescriptionOfCommodities] = useState("");

  // Calculated totals
  const [numberOfPackages, setNumberOfPackages] = useState(0);
  const [grossWeightLbs, setGrossWeightLbs] = useState(0);
  const [grossWeightKgs, setGrossWeightKgs] = useState(0);
  const [measurementCft, setMeasurementCft] = useState(0);
  const [measurementCbm, setMeasurementCbm] = useState(0);

  // Load dependency data
  useEffect(() => {
    async function loadData() {
      try {
        const [loadedReceipts, loadedShippers, loadedConsignees, loadedUnits] = await Promise.all([
          apiService.getReceipts(activeUnit),
          apiService.getShippers(),
          apiService.getConsignees(),
          apiService.getUnits().catch(() => [])
        ]);
        setReceipts(loadedReceipts);
        setShippers(loadedShippers);
        setConsignees(loadedConsignees);
        setUnits(loadedUnits);

        if (editingBL) {
          // Fill form with editing BL values
          setBlNumber(editingBL.blNumber);
          setDocumentNumber(editingBL.documentNumber);
          setExportReferences(editingBL.exportReferences);
          setDate(editingBL.date);
          setExporter(editingBL.exporter);
          setConsigneeText(editingBL.consignee);
          setNotifyParty(editingBL.notifyParty);
          setForwardingAgent(editingBL.forwardingAgent);
          setPointOfOrigin(editingBL.pointOfOrigin);
          setDomesticRouting(editingBL.domesticRouting);
          setPreCarriageBy(editingBL.preCarriageBy || "");
          setPlaceOfReceipt(editingBL.placeOfReceipt || "");
          setExportingCarrier(editingBL.exportingCarrier || "");
          setPortOfLoading(editingBL.portOfLoading || "");
          setForeignPortOfUnloading(editingBL.foreignPortOfUnloading || "");
          setPlaceOfDelivery(editingBL.placeOfDelivery || "");
          setLoadingPier(editingBL.loadingPier || "");
          setTypeOfMove(editingBL.typeOfMove || "");
          setPrepaidCollect(editingBL.prepaidCollect);
          setMarksAndNumbers(editingBL.marksAndNumbers);
          setDescriptionOfCommodities(editingBL.descriptionOfCommodities);
          setSelectedReceiptIds(editingBL.receiptIds);
          setNumberOfPackages(editingBL.numberOfPackages);
          setGrossWeightLbs(editingBL.grossWeightLbs);
          setGrossWeightKgs(editingBL.grossWeightKgs);
          setMeasurementCft(editingBL.measurementCft);
          setMeasurementCbm(editingBL.measurementCbm);
          setFreightCharges(editingBL.freightCharges);
        } else {
          // Initialize fresh numbers, pulling operational identity from the active Unit's configuration
          const matchedUnit = loadedUnits.find((u: any) => u.id === activeUnit);
          const randomBLNum = matchedUnit?.blNumberPrefix
            ? `${matchedUnit.blNumberPrefix}${Math.floor(1000 + Math.random() * 9000)}`
            : `BL${Math.floor(1000 + Math.random() * 9000)}`;
          const randomDocNum = `000000${Math.floor(1000 + Math.random() * 9000)}`;
          setBlNumber(randomBLNum);
          setDocumentNumber(randomDocNum);
          setExportReferences(`FILE #` + randomDocNum);
          setDate(new Date().toISOString().split("T")[0]);
          setDomesticRouting(`FILE# ${randomDocNum}\nBOOKING: FE${Math.floor(100000 + Math.random() * 900000)}HOURIO`);

          setForwardingAgent(
            matchedUnit?.forwardingAgentName || matchedUnit?.forwardingAgentAddress
              ? `${matchedUnit.forwardingAgentName || ""}${matchedUnit.forwardingAgentName && matchedUnit.forwardingAgentAddress ? "\n" : ""}${matchedUnit.forwardingAgentAddress || ""}`
              : ""
          );
          setPointOfOrigin(matchedUnit?.defaultPointOfOrigin || "");
          setPlaceOfReceipt(matchedUnit?.defaultPlaceOfReceipt || "");
          setPortOfLoading(matchedUnit?.defaultPortOfLoading || "");
          setExportingCarrier(matchedUnit?.defaultExportingCarrier || "");
          setForeignPortOfUnloading(matchedUnit?.defaultForeignPortOfUnloading || "");
          setPlaceOfDelivery(matchedUnit?.defaultPlaceOfDelivery || "");
          setLoadingPier(matchedUnit?.defaultLoadingPier || "");
        }
      } catch (err: any) {
        setError(err.message || "Error loading form data.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [editingBL]);

  // Handle selected receipts consolidation calculations
  useEffect(() => {
    if (editingBL && selectedReceiptIds.length === editingBL.receiptIds.length && selectedReceiptIds.every(id => editingBL.receiptIds.includes(id))) {
      // If editing and selection hasn't changed, retain original values so manually edited values aren't overwritten
      return;
    }

    if (selectedReceiptIds.length === 0) {
      setNumberOfPackages(0);
      setGrossWeightLbs(0);
      setGrossWeightKgs(0);
      setMeasurementCft(0);
      setMeasurementCbm(0);
      if (!editingBL) {
        setExporter("");
        setConsigneeText("");
        setNotifyParty("");
      }
      return;
    }

    const selectedReceipts = receipts.filter(r => selectedReceiptIds.includes(r.id));
    
    // 1. Calculate Sums
    let sumPackages = 0;
    let sumWeightLbs = 0;
    let sumWeightKgs = 0;
    let sumCubicCft = 0;
    let sumCubicCbm = 0;

    selectedReceipts.forEach(r => {
      // Ensure we count items details robustly on the fly or fall back to the totals on the receipt
      const itemsList = r.items || [];
      if (itemsList.length > 0) {
        itemsList.forEach(item => {
          const qty = Number(item.qty) || 0;
          const w = Number(item.weight) || 0;
          const l = Number(item.len) || 0;
          const wi = Number(item.wid) || 0;
          const h = Number(item.hgt) || 0;

          sumPackages += qty;
          
          if (item.unit === "Lbs") {
            sumWeightLbs += w * qty;
            sumWeightKgs += (w * 0.453592) * qty;
          } else {
            sumWeightLbs += (w * 2.20462) * qty;
            sumWeightKgs += w * qty;
          }

          sumCubicCft += (l * wi * h * qty) / 1728;
          sumCubicCbm += (l * wi * h * qty) / 1728 * 0.0283168;
        });
      } else {
        sumPackages += r.totalPieces || r.volumeCount || 1;
        sumWeightLbs += r.totalWeightLbs || r.weight || 0;
        sumWeightKgs += r.totalWeightKgs || ((r.totalWeightLbs || r.weight || 0) * 0.453592);
        sumCubicCft += r.totalCubicCft || 0;
        sumCubicCbm += r.totalCubicCbm || ((r.totalCubicCft || 0) * 0.0283168);
      }
    });

    setNumberOfPackages(sumPackages);
    setGrossWeightLbs(sumWeightLbs);
    setGrossWeightKgs(sumWeightKgs);
    setMeasurementCft(sumCubicCft);
    setMeasurementCbm(sumCubicCbm);

    // 2. Consolidate Exporter (Shippers) - CRITICAL USER REQUEST
    // Note: If 1 shipper, show single address block. If multiple shippers, showjoined list.
    const uniqueShippersMap = new Map<string, {name: string, address?: string}>();
    selectedReceipts.forEach(r => {
      uniqueShippersMap.set(r.shipperId, { name: r.shipperName, address: r.shipperAddress });
    });

    const uniqueShippers = Array.from(uniqueShippersMap.values());
    if (uniqueShippers.length === 1) {
      const s = uniqueShippers[0];
      setExporter(`${s.name.toUpperCase()}\n${s.address?.toUpperCase() || ""}`);
    } else if (uniqueShippers.length > 1) {
      const jointNames = uniqueShippers.map(s => s.name.toUpperCase()).join(", ");
      setExporter(`${jointNames}\nCFS CONSOLIDATION`);
    }

    // 3. Consolidate Consignee
    const uniqueConsignees = Array.from(new Set(selectedReceipts.map(r => r.consigneeId)));
    if (uniqueConsignees.length > 0) {
      const firstId = uniqueConsignees[0];
      const selectedC = consignees.find(c => c.id === firstId) || { name: selectedReceipts[0].consigneeName, address: selectedReceipts[0].consigneeAddress };
      const formattedC = `${selectedC.name.toUpperCase()}\n${selectedC.address?.toUpperCase() || ""}`;
      setConsigneeText(formattedC);
      setNotifyParty(formattedC);
    }

    // 4. Generate Commodities description text area template based on items summary
    const itemTypeCounts: Record<string, number> = {};
    selectedReceipts.forEach(r => {
      (r.items || []).forEach(item => {
        const type = (item.type || "BOX").toUpperCase();
        itemTypeCounts[type] = (itemTypeCounts[type] || 0) + (Number(item.qty) || 0);
      });
    });

    const typeStrings = Object.entries(itemTypeCounts).map(([type, qty]) => {
      const pluralType = qty > 1 ? `${type}S` : type;
      return `${qty} ${pluralType}`;
    });
    let packageSummary = typeStrings.join(", ");
    if (typeStrings.length > 1) {
      const lastIndex = typeStrings.length - 1;
      packageSummary = typeStrings.slice(0, lastIndex).join(", ") + " AND " + typeStrings[lastIndex];
    }

    // Capture AES / PO / tracking numbers
    const allAesModuleInvoices = selectedReceipts.flatMap(r => r.poInvoices || []).map(po => po.poNumber).filter(Boolean);
    const mockAes = allAesModuleInvoices.length > 0 ? `AES ITN: ${allAesModuleInvoices.map(p => `X2026${p.replace(/[^0-9]/g, "").slice(0, 8)}`).join(", ")}` : "AES ITN: ";
    if (mockAes && !aesItn) {
      setAesItn(mockAes);
    }

    const ncms = ["3926", "3924", "7323", "9603", "8210", "8501", "4805", "8421"];
    const randomNcms = ncms.slice(0, Math.min(selectedReceipts.length + 1, ncms.length)).join(", ");
    if (!ncmCodes) {
      setNcmCodes(randomNcms);
    }

  }, [selectedReceiptIds, receipts, consignees]);

  // Regenerate commodity description whenever sub-values are modified
  useEffect(() => {
    if (selectedReceiptIds.length === 0) return;
    
    const selectedReceipts = receipts.filter(r => selectedReceiptIds.includes(r.id));
    const itemTypeCounts: Record<string, number> = {};
    selectedReceipts.forEach(r => {
      (r.items || []).forEach(item => {
        const type = (item.type || "BOX").toUpperCase();
        itemTypeCounts[type] = (itemTypeCounts[type] || 0) + (Number(item.qty) || 0);
      });
    });

    const typeStrings = Object.entries(itemTypeCounts).map(([type, qty]) => {
      const pluralType = qty > 1 ? `${type}S` : type;
      return `${qty} ${pluralType}`;
    });
    
    let packageSummary = typeStrings.join(", ") || "1 PALLET";
    if (typeStrings.length > 1) {
      const lastIndex = typeStrings.length - 1;
      packageSummary = typeStrings.slice(0, lastIndex).join(", ") + " AND " + typeStrings[lastIndex];
    }

    const desc = `X 40 WITH ${packageSummary} WITH ${commodityType.toUpperCase()}.\n${aesItn || "AES ITN: "}\nWOODEN PACKING: ${woodPacking.toUpperCase()}\n${freightCharges.toUpperCase()}\nCAPATAZIA: ${capatazia}\nNCM: ${ncmCodes}`;
    
    setDescriptionOfCommodities(desc);
  }, [selectedReceiptIds, commodityType, aesItn, woodPacking, freightCharges, capatazia, ncmCodes]);

  const toggleReceiptSelection = (id: string) => {
    setSelectedReceiptIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedReceiptIds.length === 0) {
      setError("Please select at least one Warehouse Receipt to consolidate.");
      return;
    }
    if (!blNumber) {
      setError("The B/L number is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      blNumber,
      unit: editingBL ? (editingBL.unit || activeUnit) : activeUnit,
      documentNumber,
      exportReferences,
      date,
      exporter,
      consignee: consigneeText,
      notifyParty,
      forwardingAgent,
      pointOfOrigin,
      domesticRouting,
      preCarriageBy,
      placeOfReceipt,
      exportingCarrier,
      portOfLoading,
      foreignPortOfUnloading,
      placeOfDelivery,
      loadingPier,
      typeOfMove,
      prepaidCollect,
      marksAndNumbers,
      numberOfPackages,
      descriptionOfCommodities,
      grossWeightLbs,
      grossWeightKgs,
      measurementCft,
      measurementCbm,
      receiptIds: selectedReceiptIds,
      receiptNumbers: receipts.filter(r => selectedReceiptIds.includes(r.id)).map(r => r.number),
      freightCharges: prepaidCollect === "COLLECT" ? "FREIGHT COLLECT" : "FREIGHT PREPAID"
    };

    try {
      if (editingBL) {
        await apiService.updateBL(editingBL.id, payload);
      } else {
        await apiService.createBL(payload);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Error saving Bill of Lading.");
    } finally {
      setSaving(false);
    }
  };

  const receiptsOfUnit = receipts.filter(r => {
    if (!normalizeUnitMatch(r.unit, activeUnit, units)) return false;
    
    // If we're editing a BL, we must show receipts that are already part of this BL
    if (editingBL) {
      const isAlreadyInThisBl = r.blId === editingBL.id || editingBL.receiptIds.includes(r.id);
      const isUndispatched = !r.blId && r.status !== "DESPACHADO";
      return isAlreadyInThisBl || isUndispatched;
    }
    
    // If creating a new BL, show only undispatched/received receipts
    return !r.blId && r.status !== "DESPACHADO";
  });

  const filteredReceipts = receiptsOfUnit.filter(r => 
    r.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.shipperName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.consigneeName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 font-mono text-slate-500">
        Loading form and records...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-500" />
            {editingBL ? "Edit Bill of Lading (BL)" : "Generate New Bill of Lading (BL)"}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Select multiple receipts and consolidate them into a single container and official Bill of Lading document.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Receipt Selector Checklist (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col h-[650px]">
          <div className="space-y-4 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              1. Select Warehouse Receipts (WRs)
            </h3>
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by WR, Shipper, Consignee..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* List scroll wrapper */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredReceipts.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400 font-mono">
                No receipts found.
              </div>
            ) : (
              filteredReceipts.map(r => {
                const isSelected = selectedReceiptIds.includes(r.id);
                return (
                  <div
                    key={r.id}
                    onClick={() => toggleReceiptSelection(r.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-3 ${
                      isSelected
                        ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 text-slate-950 dark:text-white"
                        : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850/40 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // toggled by parent div click
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer h-3.5 w-3.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">{r.number}</span>
                        <span className="text-[9px] text-slate-450 dark:text-slate-500 font-medium font-mono">{r.dateIn}</span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate mt-1">
                        S: {r.shipperName}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">
                        C: {r.consigneeName}
                      </p>
                      
                      {/* WR Cargo Summary */}
                      <div className="mt-2.5 flex flex-wrap gap-1.5 text-[9px] font-mono">
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-sm">
                          {r.volumeCount} {r.volumeCount === 1 ? 'Vol' : 'Vols'}
                        </span>
                        <span className="bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-sm">
                          {r.totalWeightLbs || r.weight} Lbs
                        </span>
                        {r.totalCubicCft && (
                          <span className="bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-sm">
                            {r.totalCubicCft.toFixed(1)} Cft
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Consolidation Calculations Display */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3 shrink-0 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-150 dark:border-slate-800/40">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Accumulated Consolidation</span>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-mono">Total Receipts</span>
                <p className="font-bold text-slate-800 dark:text-white font-mono">{selectedReceiptIds.length}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-mono">Total Packages</span>
                <p className="font-bold text-slate-800 dark:text-white font-mono">{numberOfPackages} packages</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-mono">Consolidated Weight</span>
                <p className="font-bold text-slate-800 dark:text-white font-mono">{grossWeightLbs.toFixed(1)} Lbs</p>
                <p className="text-[10px] text-slate-400 font-mono">({grossWeightKgs.toFixed(1)} Kgs)</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-mono">Consolidated Cubage</span>
                <p className="font-bold text-slate-800 dark:text-white font-mono">{measurementCft.toFixed(2)} Cft</p>
                <p className="text-[10px] text-slate-400 font-mono">({measurementCbm.toFixed(2)} Cbm)</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Edit BL form details (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
            2. Bill of Lading Document Details
          </h3>

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl text-xs text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          {/* Section: Identifiers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1 font-mono">B/L Number</label>
              <input
                type="text"
                required
                value={blNumber}
                onChange={e => setBlNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1 font-mono">Document No.</label>
              <input
                type="text"
                required
                value={documentNumber}
                onChange={e => setDocumentNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1 font-mono">Date of Issue</label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1 font-mono">Export References</label>
              <input
                type="text"
                value={exportReferences}
                onChange={e => setExportReferences(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1 font-mono">Routing Instructions / Booking</label>
              <input
                type="text"
                value={domesticRouting}
                onChange={e => setDomesticRouting(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Exporter Block */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[10px] font-bold text-slate-450 uppercase font-mono">Exporter (Shipper)</label>
              {selectedReceiptIds.length > 1 && (
                <span className="text-[9px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-650 px-1.5 py-0.2 rounded-full font-mono flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" /> Multiple shippers joined for consolidation!
                </span>
              )}
            </div>
            <textarea
              rows={3}
              required
              value={exporter}
              onChange={e => setExporter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono whitespace-pre-wrap leading-normal"
              placeholder="Name and address of shipper(s)..."
            />
          </div>

          {/* Consignee and Notify Party Blocks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1 font-mono">Consignee (Consigned To)</label>
              <textarea
                rows={3}
                required
                value={consigneeText}
                onChange={e => setConsigneeText(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                placeholder="Name and address of primary consignee..."
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1 font-mono">Notify Party / Notify To</label>
              <textarea
                rows={3}
                required
                value={notifyParty}
                onChange={e => setNotifyParty(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                placeholder="Notify party (or same as consignee)..."
              />
            </div>
          </div>

          {/* Router Ports & Transport details */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
            <span className="text-[10px] font-bold uppercase text-slate-400 font-mono block">Logistics & Vessel</span>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1 font-mono">Pre-Carriage by</label>
                <input
                  type="text"
                  value={preCarriageBy}
                  onChange={e => setPreCarriageBy(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1 font-mono">Place of Receipt</label>
                <input
                  type="text"
                  value={placeOfReceipt}
                  onChange={e => setPlaceOfReceipt(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1 font-mono">Exporting Carrier (Vessel)</label>
                <input
                  type="text"
                  value={exportingCarrier}
                  onChange={e => setExportingCarrier(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1 font-mono">Port of Loading</label>
                <input
                  type="text"
                  value={portOfLoading}
                  onChange={e => setPortOfLoading(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1 font-mono">Port of Discharge</label>
                <input
                  type="text"
                  value={foreignPortOfUnloading}
                  onChange={e => setForeignPortOfUnloading(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1 font-mono">Loading Pier</label>
                <input
                  type="text"
                  value={loadingPier}
                  onChange={e => setLoadingPier(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1 font-mono">Type of Move</label>
                <input
                  type="text"
                  value={typeOfMove}
                  onChange={e => setTypeOfMove(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section: Cargo specific elements */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
            <span className="text-[10px] font-bold uppercase text-slate-400 font-mono block">Cargo, Seal & NCMs</span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1 font-mono">Marks and Numbers (Container & Seal)</label>
                <textarea
                  rows={2}
                  required
                  value={marksAndNumbers}
                  onChange={e => setMarksAndNumbers(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono whitespace-pre-wrap leading-normal"
                  placeholder="E.g., CAAU6106025&#10;SEAL: 0000739"
                />
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1 font-mono">Prepaid / Collect</label>
                  <div className="flex gap-4">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="prepaidCollect"
                        value="COLLECT"
                        checked={prepaidCollect === "COLLECT"}
                        onChange={() => {
                          setPrepaidCollect("COLLECT");
                          setFreightCharges("FREIGHT COLLECT");
                        }}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>COLLECT (Collect at Destination)</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="prepaidCollect"
                        value="PREPAID"
                        checked={prepaidCollect === "PREPAID"}
                        onChange={() => {
                          setPrepaidCollect("PREPAID");
                          setFreightCharges("FREIGHT PREPAID");
                        }}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>PREPAID (Prepaid at Origin)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Smart generation helpers */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-150 dark:border-slate-850 space-y-4">
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Auto Description Assistant
              </span>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1 font-mono">Commodity Type</label>
                  <input
                    type="text"
                    value={commodityType}
                    onChange={e => setCommodityType(e.target.value)}
                    placeholder="E.g., KITCHEN EQUIPMENT"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1 font-mono">AES / ITN Code</label>
                  <input
                    type="text"
                    value={aesItn}
                    onChange={e => setAesItn(e.target.value)}
                    placeholder="E.g., AES ITN: X2026..."
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1 font-mono">NCMs / NMCs</label>
                  <input
                    type="text"
                    value={ncmCodes}
                    onChange={e => setNcmCodes(e.target.value)}
                    placeholder="E.g., 3926, 3924, 7323"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1 font-mono">Wooden Packing</label>
                  <input
                    type="text"
                    value={woodPacking}
                    onChange={e => setWoodPacking(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1 font-mono">Terminal Handling (Capatazia)</label>
                  <input
                    type="text"
                    value={capatazia}
                    onChange={e => setCapatazia(e.target.value)}
                    placeholder="E.g., 725,00 BRL"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Combined Commodities Description Text Area */}
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1 font-mono">Description of Commodities (Schedule B / Box 20)</label>
              <textarea
                rows={6}
                required
                value={descriptionOfCommodities}
                onChange={e => setDescriptionOfCommodities(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono leading-relaxed"
                placeholder="Full text that will appear in the commodity description field..."
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 border border-slate-250 dark:border-slate-800 text-xs font-bold rounded-xl cursor-pointer hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || selectedReceiptIds.length === 0}
              className={`px-6 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl cursor-pointer hover:bg-indigo-700 transition-all shadow-md shadow-indigo-500/10 flex items-center gap-1.5 ${
                (saving || selectedReceiptIds.length === 0) ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {saving ? "Saving..." : editingBL ? "Save Changes" : "Save and Generate BL"}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}