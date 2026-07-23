import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { WarehouseReceipt, ReceiptItem, Consignee, Shipper } from "../types";
import { Printer, X, Box, QrCode, Tag, Sparkles, Check, ChevronRight } from "lucide-react";

interface ItemLabelPrintModalProps {
  receipt: WarehouseReceipt;
  consignees?: Consignee[];
  shippers?: Shipper[];
  tenantName?: string;
  onClose: () => void;
}

export default function ItemLabelPrintModal({
  receipt,
  consignees = [],
  shippers = [],
  tenantName,
  onClose,
}: ItemLabelPrintModalProps) {
  const [selectedVolumeIndex, setSelectedVolumeIndex] = useState<number>(0); // 0 = Volume 1, or 'all'
  const [printAll, setPrintAll] = useState<boolean>(false);
  const [labelSize, setLabelSize] = useState<"4x3" | "4x6" | "compact">("4x3");
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});
  const printRef = useRef<HTMLDivElement>(null);

  const consigneeObj = consignees.find((c) => c.id === receipt.consigneeId);
  const consigneeName = consigneeObj ? consigneeObj.name : receipt.consigneeId || "N/A";
  
  const shipperObj = shippers.find((s) => s.id === receipt.shipperId);
  const shipperName = shipperObj ? shipperObj.name : receipt.shipperId || "N/A";

  // Flatten items into individual pieces or list of items
  const itemsList: ReceiptItem[] = receipt.items && receipt.items.length > 0
    ? receipt.items
    : [
        {
          qty: receipt.volumeCount || receipt.totalPieces || 1,
          type: "BOX",
          len: 12,
          wid: 12,
          hgt: 12,
          weight: receipt.weight || receipt.totalWeightLbs || 1,
          unit: "Lbs",
          cubic: receipt.totalCubicCft || 1,
          cubicUnit: "Cft",
          location: receipt.location || "MAIN",
        },
      ];

  // Calculate total individual packages across all items
  const totalPiecesCount = itemsList.reduce((acc, item) => acc + (Number(item.qty) || 1), 0);

  // Generate expanded list of piece labels
  const volumePieces = React.useMemo(() => {
    const pieces: {
      pieceNumber: number;
      totalPieces: number;
      item: ReceiptItem;
      itemType: string;
      dimensions: string;
      weightStr: string;
      barcodeText: string;
    }[] = [];

    let currentPieceCounter = 1;

    itemsList.forEach((item) => {
      const q = Math.max(1, Number(item.qty) || 1);
      const dims = `${item.len || 0}x${item.wid || 0}x${item.hgt || 0} in`;
      const weight = `${item.weight || 0} ${item.unit || "Lbs"}`;
      const typeStr = item.type || "BOX";

      for (let i = 0; i < q; i++) {
        const barcodeText = `${receipt.number}-VOL${currentPieceCounter.toString().padStart(2, "0")}`;
        pieces.push({
          pieceNumber: currentPieceCounter,
          totalPieces: totalPiecesCount,
          item,
          itemType: typeStr,
          dimensions: dims,
          weightStr: weight,
          barcodeText,
        });
        currentPieceCounter++;
      }
    });

    return pieces;
  }, [itemsList, receipt, totalPiecesCount]);

  // Generate QR codes for all pieces
  useEffect(() => {
    async function generateQRs() {
      const urls: Record<string, string> = {};

      for (const piece of volumePieces) {
        const qrPayload = JSON.stringify({
          wr: receipt.number,
          vol: `${piece.pieceNumber}/${piece.totalPieces}`,
          consignee: consigneeName,
          shipper: shipperName,
          tracking: receipt.proNumbers || "N/A",
          loc: piece.item.location || receipt.location || "MAIN",
        });

        try {
          const url = await QRCode.toDataURL(qrPayload, {
            margin: 1,
            width: 200,
            color: {
              dark: "#000000",
              light: "#ffffff",
            },
          });
          urls[piece.barcodeText] = url;
        } catch (err) {
          console.error("Error generating QR code:", err);
        }
      }

      setQrDataUrls(urls);
    }

    generateQRs();
  }, [volumePieces, receipt, consigneeName, shipperName]);

  const activePieces = printAll
    ? volumePieces
    : [volumePieces[selectedVolumeIndex] || volumePieces[0]];

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiqueta de Volume - ${receipt.number}</title>
          <style>
            @page {
              size: ${labelSize === "4x6" ? "4in 6in" : labelSize === "compact" ? "2in 1.5in" : "4in 3in"};
              margin: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
              -webkit-print-color-adjust: exact;
            }
            .page-break {
              page-break-after: always;
            }
            .label-card {
              box-sizing: border-box;
              width: ${labelSize === "4x6" ? "4in" : labelSize === "compact" ? "2in" : "4in"};
              height: ${labelSize === "4x6" ? "6in" : labelSize === "compact" ? "1.5in" : "3in"};
              padding: 10px;
              border: 1px dashed #ccc;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            @media print {
              .label-card {
                border: none;
              }
            }
          </style>
        </head>
        <body>
          ${content.innerHTML}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden my-8">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                Impressão de Etiqueta por Volume
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Recibo {receipt.number} • Total de {totalPiecesCount} volume(s)
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

        {/* Modal Controls */}
        <div className="p-5 space-y-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/40">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Volume Selection */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Seletor de Volume / Caixa
              </label>
              <div className="flex items-center gap-2">
                <select
                  disabled={printAll}
                  value={selectedVolumeIndex}
                  onChange={(e) => setSelectedVolumeIndex(Number(e.target.value))}
                  className="flex-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {volumePieces.map((p, idx) => (
                    <option key={idx} value={idx}>
                      Volume {p.pieceNumber} de {p.totalPieces} ({p.itemType})
                    </option>
                  ))}
                </select>

                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none shrink-0 bg-white dark:bg-slate-800 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <input
                    type="checkbox"
                    checked={printAll}
                    onChange={(e) => setPrintAll(e.target.checked)}
                    className="rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span>Todos ({totalPiecesCount})</span>
                </label>
              </div>
            </div>

            {/* Label Format */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Formato da Etiqueta Térmica
              </label>
              <select
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value as any)}
                className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="4x3">Padrão Térmico 4" x 3" (10cm x 7.5cm)</option>
                <option value="4x6">Térmico Grande 4" x 6" (10cm x 15cm)</option>
                <option value="compact">Compacto 2" x 1.5" (5cm x 3.8cm)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Live Preview Area */}
        <div className="p-6 bg-slate-100 dark:bg-slate-950/80 max-h-[380px] overflow-y-auto flex flex-col items-center gap-6">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-indigo-500" />
            <span>Pré-visualização da Impressão de Etiqueta Adesiva</span>
          </div>

          <div ref={printRef} className="flex flex-col items-center gap-6 w-full">
            {activePieces.map((p, idx) => {
              const qrSrc = qrDataUrls[p.barcodeText];

              return (
                <div
                  key={idx}
                  className={`label-card bg-white text-slate-900 border-2 border-slate-300 shadow-md rounded-2xl p-4 flex flex-col justify-between select-none ${
                    idx < activePieces.length - 1 ? "page-break" : ""
                  }`}
                  style={{
                    width: labelSize === "4x6" ? "320px" : labelSize === "compact" ? "220px" : "320px",
                    minHeight: labelSize === "4x6" ? "420px" : labelSize === "compact" ? "160px" : "240px",
                  }}
                >
                  {/* Label Header */}
                  <div className="border-b-2 border-slate-900 pb-2 mb-2 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-black tracking-widest uppercase text-slate-500">
                        {(tenantName || "WAREHOUSE").toUpperCase()} • {receipt.unit || "US"}
                      </div>
                      <div className="text-lg font-black tracking-tight text-slate-900 font-display">
                        WR #{receipt.number}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="bg-slate-900 text-white font-black text-xs px-2.5 py-1 rounded-md tracking-wider">
                        VOL {p.pieceNumber} / {p.totalPieces}
                      </div>
                      <div className="text-[9px] font-bold text-slate-600 mt-1 uppercase">
                        {p.itemType}
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="grid grid-cols-3 gap-2 items-center my-1">
                    <div className="col-span-2 space-y-1.5 text-left">
                      <div>
                        <span className="block text-[8px] font-extrabold uppercase text-slate-400">
                          DESTINATÁRIO (CONSIGNEE)
                        </span>
                        <span className="block text-xs font-black text-slate-900 leading-tight truncate">
                          {consigneeName}
                        </span>
                      </div>

                      <div>
                        <span className="block text-[8px] font-extrabold uppercase text-slate-400">
                          REMETENTE (SHIPPER)
                        </span>
                        <span className="block text-[11px] font-bold text-slate-800 leading-tight truncate">
                          {shipperName}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                        <div>
                          <span className="block text-[8px] font-extrabold uppercase text-slate-400">DIMENSÕES</span>
                          <span className="font-bold text-slate-900">{p.dimensions}</span>
                        </div>
                        <div>
                          <span className="block text-[8px] font-extrabold uppercase text-slate-400">PESO</span>
                          <span className="font-bold text-slate-900">{p.weightStr}</span>
                        </div>
                      </div>
                    </div>

                    {/* QR Code Container */}
                    <div className="col-span-1 flex flex-col items-center justify-center p-1 bg-slate-50 border border-slate-200 rounded-xl">
                      {qrSrc ? (
                        <img src={qrSrc} alt="QR Code" className="h-20 w-20 object-contain" />
                      ) : (
                        <div className="h-20 w-20 bg-slate-200 animate-pulse rounded-lg" />
                      )}
                      <span className="text-[7px] font-mono font-bold text-slate-600 mt-1 tracking-tighter">
                        {p.barcodeText}
                      </span>
                    </div>
                  </div>

                  {/* Label Footer */}
                  <div className="border-t-2 border-slate-900 pt-2 mt-2 flex items-center justify-between text-[10px] font-bold text-slate-700">
                    <div>
                      <span className="text-slate-400 text-[8px] block font-extrabold uppercase">LOCALIZAÇÃO</span>
                      <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-sm font-black">
                        {p.item.location || receipt.location || "MAIN"}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[8px] block font-extrabold uppercase">TRACKING / PRO</span>
                      <span className="truncate max-w-[110px] block font-mono">
                        {receipt.proNumbers || "N/A"}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[8px] block font-extrabold uppercase">ENTRADA</span>
                      <span>{receipt.dateIn || "HOJE"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
          >
            <Printer className="h-4 w-4" />
            <span>Imprimir {activePieces.length > 1 ? `${activePieces.length} Etiquetas` : "Etiqueta"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}