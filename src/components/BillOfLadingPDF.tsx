import React, { useRef, useEffect } from "react";
import { BillOfLading } from "../types";
import { Printer, X } from "lucide-react";

interface BillOfLadingPDFProps {
  bl: BillOfLading;
  onClose: () => void;
}

export default function BillOfLadingPDF({ bl, onClose }: BillOfLadingPDFProps) {
  const printAreaRef = useRef<HTMLDivElement | null>(null);

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

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bill of Lading ${bl.blNumber}</title>
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
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
            }
            .print-container {
              width: 100% !important;
              max-width: 100% !important;
              min-height: 275mm !important;
              height: 275mm !important;
              margin: 0 !important;
              padding: 6mm 10mm 6mm 10mm !important;
              box-sizing: border-box !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              background: white !important;
              color: black !important;
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
            .text-slate-500 {
              color: #1f2937 !important;
            }
            .text-slate-700 {
              color: #000000 !important;
            }
            .text-slate-900 {
              color: #000000 !important;
            }
            .border-slate-900 {
              border-color: #000000 !important;
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
        }, 1000);
      }
    };

    // Give stylesheets time to load
    setTimeout(performPrint, 600);
  };

  const formatNumber = (num: number, decimals: number = 3) => {
    return num.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
        
        {/* Controls header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white font-display text-sm flex items-center gap-2">
              Official Document Preview
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
              Bill of Lading: {bl.blNumber} • Created on {new Date(bl.createdAt).toLocaleDateString("en-US")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-500/10"
            >
              <Printer className="h-3.5 w-3.5" /> Print / PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-all"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Wrapper */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-100 dark:bg-slate-950 flex justify-center">
          <div 
            ref={printAreaRef}
            className="w-[210mm] min-h-[297mm] bg-white text-slate-950 p-6 md:p-8 font-mono text-[9px] leading-tight border border-slate-200 shadow-lg flex flex-col justify-between"
            style={{ color: "black", background: "white" }}
          >
            {/* Top Logo and Header */}
            <div className="flex justify-between items-end border-b-2 border-slate-900 pb-3 mb-2">
              <div className="flex flex-col items-center">
                {/* Logo matches uploaded model */}
                <div className="w-12 h-12 rounded-full border-4 border-[#F47F12] flex items-center justify-center font-black text-2xl text-[#F47F12] select-none">
                  Q
                </div>
                <div className="text-[6px] font-black leading-none tracking-tight text-slate-900 text-center mt-1">
                  QUALITY LOGISTICS SOLUTIONS
                </div>
              </div>
              <div className="text-right">
                <h1 className="text-2xl font-black tracking-tighter text-slate-900 font-sans">BILL OF LADING</h1>
              </div>
            </div>

            {/* Grid Box Layout - matches EXACT divisions from models */}
            <div className="grid grid-cols-12 border-t border-l border-slate-900">
              
              {/* Row 1: Exporter (8 cols) & Document/BL details (4 cols) */}
              <div className="col-span-7 border-r border-b border-slate-900 p-2 min-h-[70px] flex flex-col justify-between">
                <span className="text-[7px] text-slate-700 font-bold block leading-none">2. EXPORTER (Principal or seller-licensee and address including ZIP Code)</span>
                <span className="text-[9px] font-bold text-slate-900 mt-1 whitespace-pre-wrap leading-tight">{bl.exporter}</span>
              </div>
              <div className="col-span-5 grid grid-rows-2">
                <div className="border-r border-b border-slate-900 p-2 flex flex-col justify-between">
                  <span className="text-[7px] text-slate-700 font-bold block leading-none">5. DOCUMENT NUMBER</span>
                  <span className="text-[9px] font-bold text-slate-900 mt-1">{bl.documentNumber}</span>
                </div>
                <div className="border-r border-b border-slate-900 p-2 flex justify-between items-center bg-slate-50/50">
                  <span className="text-[7px] text-slate-700 font-bold leading-none">5a. B/L NUMBER</span>
                  <span className="text-sm font-black text-slate-900 tracking-tight">{bl.blNumber}</span>
                </div>
              </div>

              {/* Row 2: Consigned To & Export references */}
              <div className="col-span-7 border-r border-b border-slate-900 p-2 min-h-[70px] flex flex-col justify-between">
                <span className="text-[7px] text-slate-700 font-bold block leading-none">3. CONSIGNED TO</span>
                <span className="text-[9px] font-bold text-slate-900 mt-1 whitespace-pre-wrap leading-tight">{bl.consignee}</span>
              </div>
              <div className="col-span-5 grid grid-rows-2">
                <div className="border-r border-b border-slate-900 p-2 flex flex-col justify-between">
                  <span className="text-[7px] text-slate-700 font-bold block leading-none">6. EXPORT REFERENCES</span>
                  <span className="text-[9px] font-bold text-slate-900 mt-1">{bl.exportReferences}</span>
                </div>
                <div className="border-r border-b border-slate-900 p-2 flex flex-col justify-between">
                  <span className="text-[7px] text-slate-700 font-bold block leading-none">DATE</span>
                  <span className="text-[9px] font-bold text-slate-900 mt-1">{new Date(bl.date + "T12:00:00").toLocaleDateString("en-US")}</span>
                </div>
              </div>

              {/* Row 3: Notify Party & Forwarding Agent */}
              <div className="col-span-7 border-r border-b border-slate-900 p-2 min-h-[70px] flex flex-col justify-between">
                <span className="text-[7px] text-slate-700 font-bold block leading-none">4. NOTIFY PARTY / INTERMEDIATE CONSIGNEE (Name and address)</span>
                <span className="text-[9px] font-bold text-slate-900 mt-1 whitespace-pre-wrap leading-tight">{bl.notifyParty}</span>
              </div>
              <div className="col-span-5 grid grid-rows-2">
                <div className="border-r border-b border-slate-900 p-2 flex flex-col justify-between">
                  <span className="text-[7px] text-slate-700 font-bold block leading-none">7. FORWARDING AGENT (Name and address - references)</span>
                  <span className="text-[8px] font-bold text-slate-900 leading-tight whitespace-pre-wrap">{bl.forwardingAgent}</span>
                </div>
                <div className="border-r border-b border-slate-900 p-2 flex flex-col justify-between">
                  <span className="text-[7px] text-slate-700 font-bold block leading-none">8. POINT (STATE) OF ORIGIN OR FTZ NUMBER</span>
                  <span className="text-[9px] font-bold text-slate-900 mt-1">{bl.pointOfOrigin}</span>
                </div>
              </div>

              {/* Row 4: Pre-Carriage, Place of Receipt & Domestic Routing */}
              <div className="col-span-4 border-r border-b border-slate-900 p-2 flex flex-col justify-between">
                <span className="text-[7px] text-slate-700 font-bold block leading-none">12. PRE-CARRIAGE BY</span>
                <span className="text-[9px] font-bold text-slate-900 mt-1">{bl.preCarriageBy || "N/A"}</span>
              </div>
              <div className="col-span-3 border-r border-b border-slate-900 p-2 flex flex-col justify-between">
                <span className="text-[7px] text-slate-700 font-bold block leading-none">13. PLACE OF RECEIPT BY PRE-CARRIER</span>
                <span className="text-[9px] font-bold text-slate-900 mt-1">{bl.placeOfReceipt || "N/A"}</span>
              </div>
              <div className="col-span-5 border-r border-b border-slate-900 p-2 flex flex-col justify-between">
                <span className="text-[7px] text-slate-700 font-bold block leading-none">9. DOMESTIC ROUTING / EXPORT INSTRUCTION</span>
                <span className="text-[8px] font-bold text-slate-900 whitespace-pre-wrap leading-tight">{bl.domesticRouting}</span>
              </div>

              {/* Row 5: Exporting Carrier, Loading Port, Pier, Move & Prepaid/Collect */}
              <div className="col-span-4 border-r border-b border-slate-900 p-2 flex flex-col justify-between">
                <span className="text-[7px] text-slate-700 font-bold block leading-none">14. EXPORTING CARRIER</span>
                <span className="text-[9px] font-bold text-slate-900 mt-1">{bl.exportingCarrier || "N/A"}</span>
              </div>
              <div className="col-span-3 border-r border-b border-slate-900 p-2 flex flex-col justify-between">
                <span className="text-[7px] text-slate-700 font-bold block leading-none">15. PORT OF LOADING / EXPORT</span>
                <span className="text-[9px] font-bold text-slate-900 mt-1">{bl.portOfLoading || "N/A"}</span>
              </div>
              <div className="col-span-3 grid grid-cols-2">
                <div className="border-r border-b border-slate-900 p-1 flex flex-col justify-between">
                  <span className="text-[6px] text-slate-700 font-bold block leading-none">10. LOADING PIER</span>
                  <span className="text-[8px] font-bold text-slate-900">{bl.loadingPier || "N/A"}</span>
                </div>
                <div className="border-r border-b border-slate-900 p-1 flex flex-col justify-between">
                  <span className="text-[6px] text-slate-700 font-bold block leading-none">11. TYPE OF MOVE</span>
                  <span className="text-[8px] font-bold text-slate-900">{bl.typeOfMove || "N/A"}</span>
                </div>
              </div>
              <div className="col-span-2 border-r border-b border-slate-900 p-2 flex flex-col items-center justify-center bg-slate-50">
                <span className="text-[6px] text-slate-700 font-bold block leading-none mb-1">PREPAID/COLLECT</span>
                <span className="text-xs font-black text-slate-900 tracking-tight">{bl.prepaidCollect}</span>
              </div>

              {/* Row 6: Foreign Port, Place of delivery */}
              <div className="col-span-4 border-r border-b border-slate-900 p-2 flex flex-col justify-between">
                <span className="text-[7px] text-slate-700 font-bold block leading-none">16. FOREIGN PORT OF UNLOADING</span>
                <span className="text-[9px] font-bold text-slate-900 mt-1">{bl.foreignPortOfUnloading || "N/A"}</span>
              </div>
              <div className="col-span-3 border-r border-b border-slate-900 p-2 flex flex-col justify-between">
                <span className="text-[7px] text-slate-700 font-bold block leading-none">17. PLACE OF DELIVERY BY PRE-CARRIER</span>
                <span className="text-[9px] font-bold text-slate-900 mt-1">{bl.placeOfDelivery || "N/A"}</span>
              </div>
              <div className="col-span-5 border-r border-b border-slate-900 p-2 bg-slate-50/20 flex flex-col justify-between">
                <span className="text-[7px] text-slate-700 font-bold block leading-none">CONSOLIDATED RECEIPTS (WRs)</span>
                <span className="text-[8px] font-bold text-indigo-900 truncate mt-1">
                  {bl.receiptNumbers.join(", ")}
                </span>
              </div>

            </div>

            {/* Cargo Table Section */}
            <div className="border-l border-r border-b border-slate-900 flex-1 flex flex-col mt-3">
              {/* Headers */}
              <div className="grid grid-cols-[15%_10%_55%_12%_8%] border-b-2 border-slate-900 text-[7px] font-black text-center bg-slate-100/50 uppercase divide-x divide-slate-900 leading-none">
                <div className="py-1.5 px-1">MARKS AND NUMBERS<br/>(18)</div>
                <div className="py-1.5 px-0.5">NUMBER OF<br/>PACKAGES (19)</div>
                <div className="py-1.5 px-1 text-left pl-3">DESCRIPTION OF COMMODITIES in Schedule B detail<br/>(20)</div>
                <div className="py-1.5 px-0.5 text-right pr-2">GROSS WEIGHT<br/>(Kilos) (21)</div>
                <div className="py-1.5 px-0.5 text-right pr-2">MEASUREMENTS<br/>(22)</div>
              </div>

              {/* Cargo Rows */}
              <div className="grid grid-cols-[15%_10%_55%_12%_8%] text-[8px] divide-x divide-slate-900 border-b border-slate-900 min-h-[80px]">
                {/* Marks & Numbers */}
                <div className="p-2 font-mono font-bold whitespace-pre-wrap leading-normal text-slate-900 break-all">
                  {bl.marksAndNumbers}
                </div>

                {/* Number of packages */}
                <div className="p-2 text-center font-bold text-slate-900 text-[10px]">
                  {bl.numberOfPackages}
                </div>

                {/* Description of Commodities */}
                <div className="p-2 text-slate-900 leading-normal font-bold whitespace-pre-wrap font-mono">
                  {bl.descriptionOfCommodities}
                </div>

                {/* Gross Weight */}
                <div className="p-2 text-right font-mono font-bold text-slate-900 pr-2 space-y-1">
                  <div>{formatNumber(bl.grossWeightKgs, 3)} Kgs</div>
                  <div className="text-[7px] text-slate-600">({formatNumber(bl.grossWeightLbs, 3)} Lbs)</div>
                </div>

                {/* Measurements */}
                <div className="p-2 text-right font-mono font-bold text-slate-900 pr-2 space-y-1">
                  <div>{formatNumber(bl.measurementCbm, 3)} Cbm</div>
                  <div className="text-[7px] text-slate-600">({formatNumber(bl.measurementCft, 3)} Cft)</div>
                </div>
              </div>

              {/* Vertical columns spacer to push totals to the bottom of the table block */}
              <div className="grid grid-cols-[15%_10%_55%_12%_8%] divide-x divide-slate-900 flex-1 border-b border-slate-900 bg-white min-h-[30px]">
                <div></div>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
              </div>

              {/* Totals Row */}
              <div className="grid grid-cols-[15%_10%_55%_12%_8%] text-[10px] font-black bg-slate-50 uppercase divide-x divide-slate-900 py-3 border-b-2 border-slate-900">
                <div className="text-right pr-4 tracking-wider">TOTALS:</div>
                <div className="text-center">{bl.numberOfPackages}</div>
                <div></div>
                <div className="text-right pr-2 font-mono">
                  <div>{formatNumber(bl.grossWeightKgs, 3)} Kgs</div>
                  <div className="text-[7.5px] text-slate-800 font-bold mt-0.5">({formatNumber(bl.grossWeightLbs, 3)} Lbs)</div>
                </div>
                <div className="text-right pr-2 font-mono">
                  <div>{formatNumber(bl.measurementCbm, 3)} Cbm</div>
                  <div className="text-[7.5px] text-slate-800 font-bold mt-0.5">({formatNumber(bl.measurementCft, 3)} Cft)</div>
                </div>
              </div>
            </div>

            {/* Disclaimer Clause */}
            <div className="text-[6.5px] text-slate-700 leading-relaxed py-1.5 px-1 text-justify">
              Carrier has a policy payment, solicitation, or receipt of any rebate, directly or indirectly, which would be unlawful under the United State Shipping Act: 1984 as amended. DECLARED VALUE: {bl.declaredValue || "READ CLAUSE 29 HEREOF CONCERNING EXTRA FREIGHT AND CARRIER'S LIMITATIONS OF LIABILITY."}
            </div>

            {/* Bottom Section */}
            <div className="grid grid-cols-12 border-t-2 border-slate-900 pt-2">
              
              {/* Left Column: Freight Rates / Charges table */}
              <div className="col-span-7 pr-3">
                <span className="text-[7px] font-black text-slate-800 block uppercase mb-1">FREIGHT RATES, CHARGES, WEIGHT AND / OR MEASUREMENTS</span>
                
                <table className="w-full border border-slate-900 text-[8px] text-center divide-y divide-slate-900 font-mono">
                  <thead className="bg-slate-100 text-[6.5px] font-black divide-x divide-slate-900">
                    <tr>
                      <th className="py-1 px-1 text-left pl-2 w-1/2">SUBJECT TO CORRECTION</th>
                      <th className="py-1 px-1">PREPAID</th>
                      <th className="py-1 px-1">COLLECT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900">
                    <tr className="divide-x divide-slate-900">
                      <td className="py-1.5 px-2 text-left font-bold text-slate-800">OCEAN FREIGHT</td>
                      <td className="py-1.5 text-slate-900 font-bold">{bl.prepaidCollect === "PREPAID" ? bl.freightCharges || "COLLECT" : ""}</td>
                      <td className="py-1.5 text-slate-900 font-bold">{bl.prepaidCollect === "COLLECT" ? bl.freightCharges || "COLLECT" : ""}</td>
                    </tr>
                    <tr className="divide-x divide-slate-900 bg-slate-50/50 font-black">
                      <td className="py-1.5 px-2 text-left">GRAND TOTAL</td>
                      <td className="py-1.5"></td>
                      <td className="py-1.5"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Right Column: Signatures & Dates */}
              <div className="col-span-5 border-l border-slate-900 pl-3 pt-1 flex flex-col justify-between min-h-[90px]">
                <div className="text-[6.5px] text-slate-700 leading-normal">
                  RECEIVED, by the Carrier as described on the reverse hereof (hereinafter called the Carrier) from the above named shipper, the goods, or packages said to contain goods, hereinabove described, in apparent good order and condition unless otherwise noted hereon, to be held and transported subject to all written, typed, printed or stamped provisions of this bill of lading, on this and on the reverse side hereof...
                </div>
                
                <div className="mt-2 grid grid-cols-2 gap-2 text-[7.5px] leading-tight pt-1">
                  <div>
                    <span className="text-slate-600 block text-[6px]">DATED AT:</span>
                    <strong className="text-slate-900">{bl.pointOfOrigin}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-600 block text-[6px] text-right">ORIGINAL / COPY:</span>
                    <strong className="text-rose-600 font-black tracking-wider text-[10px]">ORIGINAL</strong>
                  </div>
                </div>

                <div className="border-t border-slate-400 mt-2 pt-1.5 text-[8px]">
                  <span className="text-[6px] text-slate-500 block">SIGNED ON BEHALF OF CARRIER:</span>
                  <div className="flex justify-between items-end mt-1">
                    <span>By: <strong className="font-bold text-slate-900">QUALITY LOGISTICS SOLUTIONS</strong></span>
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom footer bar */}
            <div className="flex justify-between items-center text-[7.5px] border-t border-slate-300 pt-2 mt-2">
              <span className="font-bold text-slate-500">Page 1 of 1</span>
              <span className="font-mono font-black text-slate-900">B/L No. {bl.blNumber}</span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
