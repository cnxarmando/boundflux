import React, { useRef, useEffect } from "react";
import { WarehouseReceipt } from "../types";
import { Printer, X, CheckSquare, Square, Download, Share2, AlertCircle } from "lucide-react";

interface WarehouseReceiptPDFProps {
  receipt: WarehouseReceipt;
  onClose: () => void;
}

const ALL_HANDLING_OPTIONS = [
  "Commercial Invoice",
  "Pkg List",
  "Heat Treated",
  "Hazardous",
  "Haz Documents",
  "Fragile",
  "Pallets",
  "Extra Length",
  "Extra Width",
  "Extra Height",
  "Extra Heavy",
  "Haz Labels",
  "Improper Doc",
  "Inbond"
];

export default function WarehouseReceiptPDF({ receipt, onClose }: WarehouseReceiptPDFProps) {
  const printAreaRef = useRef<HTMLDivElement | null>(null);

  // Robustly calculate all totals on the fly to avoid any serialization or missing-field issues!
  const itemsList = receipt.items || [];
  
  // 1. Pieces total
  const calculatedPieces = itemsList.length > 0 
    ? itemsList.reduce((acc, item) => acc + (Number(item.qty) || 0), 0)
    : (receipt.totalPieces || receipt.volumeCount || 1);

  // 2. Weight total in Lbs and Kgs
  let calculatedWeightLbs = 0;
  let calculatedWeightKgs = 0;
  if (itemsList.length > 0) {
    itemsList.forEach(item => {
      const q = Number(item.qty) || 0;
      const w = Number(item.weight) || 0;
      if (item.unit === "Lbs") {
        calculatedWeightLbs += w * q;
        calculatedWeightKgs += (w * 0.453592) * q;
      } else {
        calculatedWeightLbs += (w * 2.20462) * q;
        calculatedWeightKgs += w * q;
      }
    });
  } else {
    calculatedWeightLbs = receipt.totalWeightLbs || receipt.weight || 0;
    calculatedWeightKgs = receipt.totalWeightKgs || (calculatedWeightLbs * 0.453592);
  }
  
  // 3. Dimensional Vol Weight in Lbs and Kgs
  let calculatedVolWeightLbs = 0;
  if (itemsList.length > 0) {
    itemsList.forEach(item => {
      const q = Number(item.qty) || 0;
      const l = Number(item.len) || 0;
      const wi = Number(item.wid) || 0;
      const h = Number(item.hgt) || 0;
      calculatedVolWeightLbs += (l * wi * h * q) / 166;
    });
  } else {
    calculatedVolWeightLbs = receipt.totalVolWeightLbs || 0;
  }
  const calculatedVolWeightKgs = receipt.totalVolWeightKgs || (calculatedVolWeightLbs * 0.453592);

  // 4. Cubic Volume in Cft and Cbm
  let calculatedCubicCft = 0;
  if (itemsList.length > 0) {
    itemsList.forEach(item => {
      const q = Number(item.qty) || 0;
      const l = Number(item.len) || 0;
      const wi = Number(item.wid) || 0;
      const h = Number(item.hgt) || 0;
      calculatedCubicCft += (l * wi * h * q) / 1728;
    });
  } else {
    calculatedCubicCft = receipt.totalCubicCft || 0;
  }
  const calculatedCubicCbm = receipt.totalCubicCbm || (calculatedCubicCft * 0.0283168);

  // Keyboard controls: Escape to close, Ctrl+P/Cmd+P to print
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handlePrint = () => {
    const printContent = printAreaRef.current;
    if (!printContent) return;

    // Create a hidden iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.border = "none";
    iframe.style.left = "-9999px";
    iframe.style.top = "-9999px";
    
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      window.print();
      return;
    }

    // Write a clean HTML structure
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Warehouse Receipt ${receipt.number}</title>
          <style>
            @page {
              margin: 0 !important;
              size: portrait !important;
            }
            body {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print-container {
              width: 100% !important;
              max-width: 100% !important;
              min-height: 275mm !important;
              height: 275mm !important;
              margin: 0 !important;
              padding: 8mm 12mm 8mm 12mm !important;
              box-sizing: border-box !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              background: white !important;
              color: black !important;
            }
            /* Ensure tailwind backgrounds are explicitly colored when printing */
            .bg-slate-100 {
              background-color: #f1f5f9 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .bg-slate-50 {
              background-color: #f8fafc !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print {
              display: none !important;
              visibility: hidden !important;
            }
            /* High contrast overrides for printed text */
            .text-slate-400 {
              color: #27272a !important; /* text-zinc-800 equivalent */
              font-weight: 500 !important;
            }
            .text-slate-500 {
              color: #18181b !important; /* text-zinc-900 equivalent */
            }
            .text-slate-600 {
              color: #09090b !important; /* text-zinc-950 equivalent */
            }
            .text-slate-700 {
              color: #000000 !important;
            }
            .text-slate-800 {
              color: #000000 !important;
            }
            .text-slate-900 {
              color: #000000 !important;
            }
            .text-slate-950 {
              color: #000000 !important;
            }
            .text-indigo-600 {
              color: #1e1b4b !important; /* indigo-950 equivalent */
            }
            .text-indigo-700 {
              color: #1e1b4b !important;
            }
            .text-indigo-900 {
              color: #000000 !important;
            }
            .text-indigo-950 {
              color: #000000 !important;
            }
            .text-slate-350 {
              color: #52525b !important; /* zinc-600 for unchecked boxes */
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);
    iframeDoc.close();

    // Copy all style tags and stylesheets from parent window
    const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
    styles.forEach((styleNode) => {
      iframeDoc.head.appendChild(styleNode.cloneNode(true));
    });

    const performPrint = () => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        
        // Clean up the iframe after a short delay
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1500);
      }
    };

    // Check if there are images, wait for them to load
    const images = iframeDoc.getElementsByTagName("img");
    if (images.length > 0) {
      let loadedImagesCount = 0;
      const handleImageLoad = () => {
        loadedImagesCount++;
        if (loadedImagesCount === images.length) {
          performPrint();
        }
      };
      for (let i = 0; i < images.length; i++) {
        if (images[i].complete) {
          handleImageLoad();
        } else {
          images[i].addEventListener("load", handleImageLoad);
          images[i].addEventListener("error", handleImageLoad);
        }
      }
    } else {
      setTimeout(performPrint, 300);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-start justify-center p-2 sm:p-4 z-50 overflow-y-auto pt-4 pb-12">
      <div className="bg-slate-100 dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col my-4 border border-slate-200 dark:border-slate-800">
        
        {/* Top Control Bar */}
        <div className="no-print bg-white dark:bg-slate-800 px-6 py-4 rounded-t-2xl border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-indigo-100 dark:bg-indigo-950/45 text-indigo-700 dark:text-indigo-450 font-mono text-xs font-bold rounded">
                MODO IMPRESSÃO
              </span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Documento de Recebimento #{receipt.number}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
              Se a impressão estiver bloqueada no iframe, clique em "Abrir em nova aba" no topo direito do app para imprimir.
            </span>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/10 transition-all"
            >
              <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all"
              title="Fechar Recibo"
            >
              <X className="h-4 w-4" /> Fechar (Sair)
            </button>
          </div>
        </div>

        {/* Paper Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 dark:bg-slate-900 flex justify-center">
          
          <div 
            ref={printAreaRef}
            className="print-container bg-white text-slate-900 p-6 sm:p-10 rounded-xs shadow-md border border-slate-200 w-full max-w-[800px] font-sans flex flex-col justify-between"
            style={{ minHeight: "1050px" }}
          >
            
            {/* Top Flowable Content */}
            <div className="flex-grow flex flex-col justify-start">
              
              {/* 1. Header Row */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-slate-900 pb-3">
                {/* Left Side: Corporate Logo Block */}
                <div className="space-y-0.5 text-left">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-indigo-950 rounded flex items-center justify-center shrink-0">
                      <div className="w-3.5 h-3.5 border-2 border-white"></div>
                    </div>
                    <h1 className="text-lg font-extrabold tracking-tight text-indigo-950 uppercase font-display">
                      Quality Logistics Solutions
                    </h1>
                  </div>
                  <div className="text-[10px] text-slate-700 leading-relaxed font-mono">
                    <p>8377 NW 68st, Miami, FL 33166</p>
                    <p>Tel: 954-7739908 | Fax: 954-7739909</p>
                    <p className="text-indigo-600 font-bold">www.qualitylogistics.us</p>
                  </div>
                </div>

                {/* Right Side: Title & WR code details */}
                <div className="text-right space-y-1 w-full sm:w-auto">
                  <h2 className="text-xl font-black text-slate-900 font-display tracking-tight leading-none uppercase">
                    WAREHOUSE RECEIPT
                  </h2>
                  
                  {/* Barcode Mock Rendering inside document */}
                  <div className="inline-block border border-slate-300 p-1 bg-slate-50 rounded-sm">
                    <div className="flex items-end justify-center h-8 gap-[1px] px-2 pt-1">
                      {[1,2,1,3,1,2,4,1,2,1,3,2,1,4,1,2,1,3,1,2,1,4,1,2,3,1].map((weight, i) => (
                        <div 
                          key={i} 
                          className="bg-black" 
                          style={{ width: `${weight}px`, height: "100%" }} 
                        />
                      ))}
                    </div>
                    <span className="text-[9px] font-mono tracking-widest text-center block mt-1 font-bold">
                      *{receipt.number}*
                    </span>
                  </div>

                  <div className="flex flex-row flex-wrap justify-end gap-x-3 gap-y-1 text-[9.5px] font-mono mt-1 border-t border-slate-200 pt-2 text-left">
                    <div className="flex gap-1">
                      <span className="text-slate-500 font-bold">DATE IN:</span>
                      <span className="font-extrabold">{receipt.dateIn || new Date(receipt.createdAt).toISOString().split("T")[0]}</span>
                    </div>
                    <div className="text-slate-300">|</div>
                    <div className="flex gap-1">
                      <span className="text-slate-500 font-bold">EXPIRES:</span>
                      <span className="font-extrabold">{receipt.expires || "N/A"}</span>
                    </div>
                    <div className="text-slate-300">|</div>
                    <div className="flex gap-1">
                      <span className="text-slate-500 font-bold">LOCATION:</span>
                      <span className="font-extrabold text-indigo-700">{receipt.location || "N/A"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Partners Address Blocks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-slate-900">
                {/* Shipper box */}
                <div className="p-2 border-r border-slate-900 text-left space-y-0.5">
                  <span className="text-[8.5px] font-bold text-slate-800 uppercase tracking-wider block bg-slate-100 px-2 py-0.5 border border-slate-300 rounded font-mono">
                    SHIPPER (Remetente)
                  </span>
                  <div className="px-1 pt-0.5 space-y-0.5">
                    <h3 className="font-black text-[11px] text-slate-950 uppercase leading-snug">{receipt.shipperName}</h3>
                    <p className="text-[9.5px] text-slate-800 font-mono whitespace-pre-line leading-relaxed">
                      {receipt.shipperAddress || "Sem endereço cadastrado"}
                    </p>
                    {receipt.shipperPhone && (
                      <p className="text-[9.5px] text-slate-800 font-mono">
                        TEL: {receipt.shipperPhone}
                      </p>
                    )}
                  </div>
                </div>

                {/* Consignee box */}
                <div className="p-2 text-left space-y-0.5">
                  <span className="text-[8.5px] font-bold text-slate-800 uppercase tracking-wider block bg-slate-100 px-2 py-0.5 border border-slate-300 rounded font-mono">
                    CONSIGNEE (Destinatário)
                  </span>
                  <div className="px-1 pt-0.5 space-y-0.5">
                    <h3 className="font-black text-[11px] text-slate-950 uppercase leading-snug">{receipt.consigneeName}</h3>
                    <p className="text-[9.5px] text-slate-800 font-mono whitespace-pre-line leading-relaxed">
                      {receipt.consigneeAddress || "Sem endereço cadastrado"}
                    </p>
                    {receipt.consigneePhone && (
                      <p className="text-[9.5px] text-slate-800 font-mono">
                        TEL: {receipt.consigneePhone}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 3 & 4. Combined Freight Details & Handling Checklist (Side-by-Side) */}
              <div className="grid grid-cols-12 border-b border-slate-900 divide-x divide-slate-900">
                {/* Column 1: Freight Details */}
                <div className="col-span-4 bg-slate-50/50 flex flex-col justify-start">
                  <div className="bg-slate-100 border-b border-slate-300 px-3 py-1 font-mono text-left">
                    <span className="text-[8px] font-bold text-slate-800 uppercase tracking-wider block">
                      FREIGHT DETAILS (Transporte)
                    </span>
                  </div>
                  <div className="p-1.5 grid grid-cols-2 gap-y-1 gap-x-2 text-[9px] font-mono text-left my-auto">
                    <div>
                      <span className="text-slate-500 block uppercase font-bold text-[7px] leading-none">VIA</span>
                      <span className="font-bold text-slate-900">{receipt.via || "AIR"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block uppercase font-bold text-[7px] leading-none">SERVICE</span>
                      <span className="font-bold text-slate-900">{receipt.service || "N/A"}</span>
                    </div>
                    <div className="col-span-2 border-t border-dashed border-slate-200 pt-1 mt-0.5">
                      <span className="text-slate-500 block uppercase font-bold text-[7px] leading-none">CARRIER</span>
                      <span className="font-bold text-slate-900 truncate block">{receipt.carrier || "N/A"}</span>
                    </div>
                    <div className="border-t border-dashed border-slate-200 pt-1 mt-0.5">
                      <span className="text-slate-500 block uppercase font-bold text-[7px] leading-none">ORIGIN</span>
                      <span className="font-bold text-slate-900">{receipt.origin || "MIA"}</span>
                    </div>
                    <div className="border-t border-dashed border-slate-200 pt-1 mt-0.5">
                      <span className="text-slate-500 block uppercase font-bold text-[7px] leading-none">DEST</span>
                      <span className="font-bold text-slate-900">{receipt.dest || "N/A"}</span>
                    </div>
                  </div>
                </div>

                {/* Column 2: Handling Checklist */}
                <div className="col-span-8 flex flex-col">
                  <div className="bg-slate-100 border-b border-slate-300 px-4 py-1 font-mono text-left">
                    <span className="text-[8px] font-bold text-slate-800 uppercase tracking-wider block">
                      HANDLING CHECKLIST (Instruções de Manuseio)
                    </span>
                  </div>
                  <div className="p-1.5 flex-1 flex items-center">
                    <div className="grid grid-cols-3 gap-y-1 gap-x-2 text-[8px] font-mono text-slate-900 w-full text-left">
                      {ALL_HANDLING_OPTIONS.map(option => {
                        const isChecked = receipt.handling && receipt.handling.includes(option);
                        return (
                          <div key={option} className="flex items-center gap-1">
                            {isChecked ? (
                              <span className="text-indigo-950 font-black font-sans shrink-0">[X]</span>
                            ) : (
                              <span className="text-slate-500 font-sans shrink-0">[ ]</span>
                            )}
                            <span className={isChecked ? "font-black text-slate-950 text-[8.5px]" : "text-slate-600"}>
                              {option}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. PO/Invoice References */}
              {receipt.poInvoices && receipt.poInvoices.length > 0 && (
                <div className="border-b border-slate-900 text-left">
                  <div className="grid grid-cols-3 text-[8px] font-black text-slate-700 uppercase tracking-wider bg-slate-50 border-b border-slate-300 py-0.25 px-3 font-mono">
                    <div>PO Number</div>
                    <div>Invoice #</div>
                    <div className="text-right">Amount</div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {receipt.poInvoices.map((po, i) => (
                      <div key={i} className="grid grid-cols-3 text-[9px] font-mono py-0.25 px-3 text-slate-800">
                        <div>{po.poNumber || "-"}</div>
                        <div>{po.invoiceNumber || "-"}</div>
                        <div className="text-right font-bold">{po.amount || "-"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PRO / Tracking numbers & Cargo Condition block if any */}
              <div className="py-1.5 px-3 border-b border-slate-900 text-left text-[9.5px] font-mono flex flex-col sm:flex-row sm:items-center justify-between bg-slate-100 gap-2">
                <div className="flex gap-2">
                  <span className="font-bold text-slate-800 uppercase">PRO/TRACKINGS:</span>
                  <span className="font-bold text-indigo-900">{receipt.proNumbers || receipt.trackingNumber || "N/A"}</span>
                </div>
                {receipt.cargoCondition && (
                  <div className="flex gap-2">
                    <span className="font-bold text-slate-800 uppercase">CARGO CONDITION:</span>
                    <span className="font-bold text-red-600 uppercase">⚠️ {receipt.cargoCondition}</span>
                  </div>
                )}
              </div>

              {/* 6. Cargo Items Breakdown Table */}
              <div className="text-left">
                <table className="w-full text-[9px] border-collapse font-mono">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 border-b border-slate-900 uppercase text-[7.5px] tracking-wider text-center font-bold">
                      <th className="py-0.5 px-2 text-left w-10 border-r border-slate-200">QTY</th>
                      <th className="py-0.5 px-2 text-left border-r border-slate-200">UNIT TYPE</th>
                      <th className="py-0.5 px-1 border-r border-slate-200">L (in)</th>
                      <th className="py-0.5 px-1 border-r border-slate-200">W (in)</th>
                      <th className="py-0.5 px-1 border-r border-slate-200">H (in)</th>
                      <th className="py-0.5 px-2 text-right border-r border-slate-200">WEIGHT</th>
                      <th className="py-0.5 px-2 text-right border-r border-slate-200">VOL. WEIGHT</th>
                      <th className="py-0.5 px-2 text-right border-r border-slate-200">VOLUME</th>
                      <th className="py-0.5 px-2 text-center">BIN / LOC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {receipt.items && receipt.items.length > 0 ? (
                      receipt.items.map((item, idx) => {
                        const calculatedCubic = item.cubic;
                        const calculatedVolWeight = ((item.len * item.wid * item.hgt * item.qty) / 166).toFixed(1);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 text-center text-slate-900">
                            <td className="py-0.5 px-2 text-left font-black">{item.qty}</td>
                            <td className="py-0.5 px-2 text-left font-bold">
                              <div>{item.type}</div>
                              {item.cargoCondition && (
                                <div className="text-[7.5px] text-red-600 font-extrabold mt-0.5 uppercase tracking-wide">
                                  ⚠️ {item.cargoCondition}
                                </div>
                              )}
                            </td>
                            <td className="py-0.5 px-1 text-slate-800 font-medium">{item.len}</td>
                            <td className="py-0.5 px-1 text-slate-800 font-medium">{item.wid}</td>
                            <td className="py-0.5 px-1 text-slate-800 font-medium">{item.hgt}</td>
                            <td className="py-0.5 px-2 text-right font-bold">
                              {item.weight} {item.unit}
                            </td>
                            <td className="py-0.5 px-2 text-right text-slate-950 font-black">
                              <div>{calculatedVolWeight} Lbs</div>
                              <div className="text-[7px] text-slate-800 font-bold leading-none">({(parseFloat(calculatedVolWeight) * 0.453592).toFixed(1)} Kgs)</div>
                            </td>
                            <td className="py-0.5 px-2 text-right text-indigo-900 font-bold">
                              {calculatedCubic} Cft
                            </td>
                            <td className="py-0.5 px-2 text-center">
                              <span className="bg-slate-100 px-1 py-0.25 rounded font-bold text-[8.5px]">
                                {item.bin || "-"}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr className="text-center">
                        <td className="py-1 px-2 font-bold">{receipt.volumeCount}</td>
                        <td className="py-1 px-2 text-left font-bold">CARGO PACKAGE</td>
                        <td className="py-1 px-1 text-slate-700">-</td>
                        <td className="py-1 px-1 text-slate-700">-</td>
                        <td className="py-1 px-1 text-slate-700">-</td>
                        <td className="py-1 px-2 text-right font-bold">{receipt.weight} Lbs</td>
                        <td className="py-1 px-2 text-right text-slate-700">-</td>
                        <td className="py-1 px-2 text-right text-slate-700">-</td>
                        <td className="py-1 px-2 text-center text-slate-700">-</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 7. Totals Block Row */}
              <div className="grid grid-cols-4 border-t-2 border-slate-900 text-center font-mono py-1 text-[9.5px] bg-slate-50 border-b-2">
                <div>
                  <span className="text-[7.5px] text-slate-700 uppercase font-black block">PIECES</span>
                  <span className="text-xs font-black text-slate-950">{calculatedPieces}</span>
                </div>
                <div>
                  <span className="text-[7.5px] text-slate-700 uppercase font-black block">WEIGHT TOTAL</span>
                  <span className="text-xs font-black text-slate-950">{calculatedWeightLbs.toFixed(1)} Lbs</span>
                  <span className="text-[7.5px] text-slate-800 block mt-0.5">({calculatedWeightKgs.toFixed(1)} Kgs)</span>
                </div>
                <div>
                  <span className="text-[7.5px] text-slate-700 uppercase font-black block">VOL. WEIGHT (DIM)</span>
                  <span className="text-xs font-black text-slate-950">{calculatedVolWeightLbs.toFixed(1)} Lbs</span>
                  <span className="text-[7.5px] text-slate-800 block mt-0.5">({calculatedVolWeightKgs.toFixed(1)} Kgs)</span>
                </div>
                <div>
                  <span className="text-[7.5px] text-slate-700 uppercase font-black block">TOTAL CUBIC</span>
                  <span className="text-xs font-black text-indigo-950">{calculatedCubicCft.toFixed(2)} Cft</span>
                  <span className="text-[7.5px] text-slate-800 block mt-0.5">({calculatedCubicCbm.toFixed(2)} Cbm)</span>
                </div>
              </div>

              {/* 8. Comments memo card */}
              <div className="border-b border-slate-900 text-left">
                <div className="bg-slate-100 border-b border-slate-300 px-3 py-0.5">
                  <span className="text-[8px] font-bold text-slate-800 uppercase tracking-wider block font-mono">
                    COMMENTS / SPECIAL INSTRUCTIONS:
                  </span>
                </div>
                <div className="p-1 px-3">
                  <p className="text-[9.5px] text-slate-800 italic min-h-[16px] whitespace-pre-line leading-relaxed">
                    {receipt.comments || "Cargo received in good conditions with no visible damage."}
                  </p>
                </div>
              </div>

            </div>

            {/* Pinned Bottom Footer Block */}
            <div className="mt-auto pt-2 border-t border-slate-300">
              
              {/* 9. Signatures Block */}
              <div className="grid grid-cols-2 pb-1 text-left font-mono text-[9px] text-slate-800 font-medium">
                <div className="space-y-2">
                  <p>RECEIVED BY (Assinado por): ___________________________</p>
                  <p>DATE (Data): ___________________________</p>
                </div>
                <div className="text-right flex flex-col justify-end">
                  <p className="font-extrabold text-[7.5px] text-slate-700">QUALITY SOLUTIONS WAREHOUSE DEPT.</p>
                  <p>OPERATOR ID: {receipt.operatorEmail || "SYSTEM"}</p>
                </div>
              </div>

              {/* 10. Disclaimer Lien Agreement Footer */}
              <div className="mt-2.5 pt-2.5 border-t border-slate-350 text-center text-[7.5px] text-slate-600 leading-normal font-medium uppercase">
                The customer agrees that the company shall have a general lien on any and all property (and documents relating thereto) of the customer, in its possession, custody or control, for all claims for charges, expenses, or advances incurred by the company in connection with any shipments, storage or services rendered. No liability is assumed for damage, temperature changes, weather or shrinkage of cargo unless caused by our direct gross negligence. All warehouse services are subject to the standard conditions of the american warehouse association.
              </div>

            </div>

          </div>

        </div>

        {/* Bottom Control Bar */}
        <div className="no-print bg-white dark:bg-slate-800 px-6 py-4 rounded-b-2xl border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Fim do documento. Use os controles para fechar ou imprimir.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/10 transition-all"
            >
              <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <X className="h-4 w-4" /> Fechar (Sair)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
