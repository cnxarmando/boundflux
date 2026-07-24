import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import { authMiddleware, aiRateLimiter, AuthenticatedRequest } from "../middleware";

export const aiRouter = Router();

// Gemini advanced full-receipt parsing
aiRouter.post("/gemini/extract-receipt-fields", authMiddleware, aiRateLimiter, async (req: AuthenticatedRequest, res) => {
  const { photoBase64 } = req.body;
  if (!photoBase64) {
    res.status(400).json({ error: "Nenhuma foto fornecida." });
    return;
  }
  
  let rawBase64 = photoBase64;
  let mimeType = "image/jpeg";
  if (photoBase64.startsWith("data:")) {
    const matches = photoBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      mimeType = matches[1];
      rawBase64 = matches[2];
    }
  }
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    console.warn("GEMINI_API_KEY environment variable is not configured. Simulating extraction...");
    setTimeout(() => {
      res.json({
        shipperName: "GRAINGER TX",
        shipperAddress: "201 FREEDOM DRIVE\nROANOKE, TX 76262",
        shipperPhone: "",
        consigneeName: "OOS-INTERNATIONAL BV",
        consigneeAddress: "OOSTKAPELSEWEG 4\nSEROOSKERE 4353 EH",
        consigneePhone: "31118726200",
        handling: ["Commercial Invoice", "Pkg List", "Pallets"],
        via: "AIR",
        origin: "MIA",
        dest: "OOSTKAPELLE",
        carrier: "DHL EXPRESS",
        poInvoices: [
          { poNumber: "LAM-2026-00383/1", invoiceNumber: "", amount: "" }
        ],
        proNumbers: "517766633412, 517766633423",
        items: [
          { qty: 1, type: "BOX", len: 12, wid: 10, hgt: 5, weight: 2.0, unit: "Lbs" },
          { qty: 1, type: "BOX", len: 12, wid: 10, hgt: 5, weight: 1.0, unit: "Lbs" }
        ],
        comments: "Mercadoria recebida em perfeito estado e analisada por IA."
      });
    }, 1500);
    return;
  }
  
  try {
    const ai = new GoogleGenAI({ apiKey });
    
    console.log(`Sending image/file content to Gemini 3.5 Flash for Receipt Parsing. MIME: ${mimeType}`);
    
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        "Você é um especialista em OCR e logística de cargas. Analise esta imagem ou arquivo PDF que é um documento de recebimento (Warehouse Receipt), Packing List, Packing Slip, ou uma fatura/etiqueta de envio. Extraia o máximo possível de dados estruturados em formato JSON conforme o seguinte esquema:\n" +
        "{\n" +
        "  \"shipperName\": \"string (nome do remetente/shipper)\",\n" +
        "  \"shipperAddress\": \"string (endereço do shipper)\",\n" +
        "  \"shipperPhone\": \"string (telefone do shipper)\",\n" +
        "  \"consigneeName\": \"string (nome do destinatário/consignee)\",\n" +
        "  \"consigneeAddress\": \"string (endereço do consignee)\",\n" +
        "  \"consigneePhone\": \"string (telefone do consignee)\",\n" +
        "  \"handling\": [\"Commercial Invoice\", \"Pkg List\", \"Heat Treated\", \"Hazardous\", \"Haz Documents\", \"Fragile\", \"Pallets\", \"Extra Length\", \"Extra Width\", \"Extra Height\", \"Extra Heavy\", \"Haz Labels\", \"Improper Doc\", \"Inbond\"], (apenas termos que estiverem explicitamente assinalados no documento),\n" +
        "  \"via\": \"AIR | OCEAN | TRUCK | etc.\",\n" +
        "  \"origin\": \"string (origem, e.g. MIA)\",\n" +
        "  \"dest\": \"string (destino)\",\n" +
        "  \"carrier\": \"string (transportadora, e.g. DHL, FedEx, etc.)\",\n" +
        "  \"poInvoices\": [ {\n" +
        "    \"poNumber\": \"string (PO Number)\",\n" +
        "    \"invoiceNumber\": \"string (Invoice #)\",\n" +
        "    \"amount\": \"string (Amount)\"\n" +
        "  } ],\n" +
        "  \"proNumbers\": \"string (números de PRO/tracking numbers encontrados, separados por vírgula)\",\n" +
        "  \"items\": [ {\n" +
        "    \"qty\": 1,\n" +
        "    \"type\": \"BOX\",\n" +
        "    \"len\": 12,\n" +
        "    \"wid\": 10,\n" +
        "    \"hgt\": 5,\n" +
        "    \"weight\": 2.0,\n" +
        "    \"unit\": \"Lbs\"\n" +
        "  } ],\n" +
        "  \"comments\": \"string (comentários ou anotações adicionais)\"\n" +
        "}\n\n" +
        "Retorne APENAS o JSON puro no formato especificado, sem blocos markdown ```json.",
        {
          inlineData: {
            data: rawBase64,
            mimeType: mimeType
          }
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });
    
    let resultText = response.text ? response.text.trim() : "";
    console.log(`Gemini raw extraction result: "${resultText}"`);
    
    res.json(JSON.parse(resultText));
  } catch (err: any) {
    console.error("Gemini API Error:", err);
    res.status(500).json({ error: "Falha na análise inteligente da imagem por IA.", details: err.message });
  }
});

// Gemini image tracking number extraction API
aiRouter.post("/gemini/extract-tracking", authMiddleware, aiRateLimiter, async (req: AuthenticatedRequest, res) => {
  const { photoBase64 } = req.body;
  if (!photoBase64) {
    res.status(400).json({ error: "Nenhuma foto fornecida." });
    return;
  }
  
  let rawBase64 = photoBase64;
  let mimeType = "image/jpeg";
  if (photoBase64.startsWith("data:image")) {
    const matches = photoBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      mimeType = matches[1];
      rawBase64 = matches[2];
    }
  }
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    console.warn("GEMINI_API_KEY environment variable is not configured. Simulating extraction...");
    setTimeout(() => {
      const simulatedTrackings = [
        "1Z999AA10123456784",
        "781234567890",
        "9400111899562539124578",
        "CE123456789PT",
        "WR-TRACK-XYZ-99"
      ];
      const randomTracking = simulatedTrackings[Math.floor(Math.random() * simulatedTrackings.length)];
      res.json({ trackingNumber: randomTracking, simulated: true });
    }, 1200);
    return;
  }
  
  try {
    const ai = new GoogleGenAI({ apiKey });
    
    console.log(`Sending image content to Gemini 2.5 Flash for tracking extraction. MIME: ${mimeType}`);
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        "Você é um especialista em logística e OCR de etiquetas de carga. Analise esta imagem tirada de uma mercadoria recebida no pátio do armazém. Localize o código de rastreamento principal (Tracking Number, código de barras, etiqueta da transportadora como UPS, FedEx, DHL, USPS, Correios, ou etiqueta de envio). Retorne APENAS o código de rastreamento puro, sem espaços extras, e sem nenhuma explicação ou texto de introdução. Se não for possível identificar nenhum número de rastreamento com clareza, responda apenas a palavra 'NENHUM'.",
        {
          inlineData: {
            data: rawBase64,
            mimeType: mimeType
          }
        }
      ]
    });
    
    let resultText = response.text ? response.text.trim() : "";
    console.log(`Gemini raw extraction result: "${resultText}"`);
    
    if (resultText.toUpperCase() === "NENHUM" || resultText.length < 3) {
      resultText = "";
    }
    
    res.json({ trackingNumber: resultText });
  } catch (err: any) {
    console.error("Gemini API Error:", err);
    res.status(500).json({ error: "Falha na análise da imagem por IA.", details: err.message });
  }
});
