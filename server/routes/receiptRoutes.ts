import { Router } from "express";
import { loadDB, saveDB } from "../db";
import { authMiddleware, uploadRateLimiter, AuthenticatedRequest } from "../middleware";
import { saveBase64Image } from "../uploadUtils";

export const receiptRouter = Router();

// GET receipts
receiptRouter.get("/receipts", authMiddleware, (req: AuthenticatedRequest, res) => {
  const currentDB = loadDB();
  const isOperator = req.user?.tenantRole === "operator";
  const isSuper = req.user?.platformRole === "superadmin";
  const unitHeader = (req.headers["x-unit-id"] as string) || (req.query.unitId as string);
  
  let filtered = currentDB.receipts.filter(r => r.tenantId === req.tenantId && !r.deletedAt);
  
  if (unitHeader) {
    filtered = filtered.filter(r => r.unitId === unitHeader || r.unit === unitHeader);
  }
  
  if (isOperator && !isSuper) {
    filtered = filtered.filter(r => r.createdBy === req.user?.uid || r.operatorEmail?.toLowerCase() === req.user?.email?.toLowerCase());
  }
  
  res.json(filtered);
});

// POST new receipt
receiptRouter.post("/receipts", authMiddleware, uploadRateLimiter, (req: AuthenticatedRequest, res) => {
  const { 
    shipperId, 
    consigneeId, 
    weight, 
    volumeCount, 
    trackingNumber, 
    photoBase64, 
    photoBase64s,
    operatorEmail,
    unit,
    shipperAddress,
    shipperPhone,
    consigneeAddress,
    consigneePhone,
    handling,
    dateIn,
    expires,
    location,
    via,
    service,
    carrier,
    origin,
    dest,
    poInvoices,
    proNumbers,
    items,
    totalPieces,
    totalWeightLbs,
    totalWeightKgs,
    totalVolWeightLbs,
    totalVolWeightKgs,
    totalCubicCft,
    totalCubicCbm,
    comments
  } = req.body;
  
  if (!shipperId || !consigneeId) {
    res.status(400).json({ error: "Campos obrigatórios ausentes: Shipper e Consignee." });
    return;
  }
  
  const currentDB = loadDB();
  
  const shipper = currentDB.shippers.find(s => s.id === shipperId && s.tenantId === req.tenantId);
  const consignee = currentDB.consignees.find(c => c.id === consigneeId && c.tenantId === req.tenantId);
  
  if (!shipper || !consignee) {
    res.status(404).json({ error: "Shipper ou Consignee não encontrado para o seu Tenant." });
    return;
  }
  
  let photoUrls: string[] = [];
  if (photoBase64s && Array.isArray(photoBase64s)) {
    photoUrls = photoBase64s.map(b64 => saveBase64Image(b64)).filter(url => url !== "");
  } else if (photoBase64) {
    const singleUrl = saveBase64Image(photoBase64);
    if (singleUrl) {
      photoUrls = [singleUrl];
    }
  }
  
  if (photoUrls.length === 0) {
    photoUrls = ["/uploads/sample_box.jpg"];
  }
  
  const photoUrl = photoUrls[0];
  
  const tenantReceipts = currentDB.receipts.filter(r => r.tenantId === req.tenantId);
  const receiptCount = tenantReceipts.length + 1;
  const wrNumber = `WR-${10000 + receiptCount}`;
  
  const parsedItems = items || [];
  const parsedPoInvoices = poInvoices || [];
  
  const calcPieces = totalPieces !== undefined ? totalPieces : (parsedItems.reduce((acc: number, item: any) => acc + (Number(item.qty) || 0), 0) || Number(volumeCount) || 1);
  const calcWeight = totalWeightLbs !== undefined ? totalWeightLbs : (Number(weight) || parsedItems.reduce((acc: number, item: any) => acc + (Number(item.weight) || 0), 0) || 0);
  
  const newReceipt = {
    id: `wr-${Date.now()}`,
    tenantId: req.tenantId,
    number: wrNumber,
    unit: unit || "US",
    shipperId,
    shipperName: shipper.name,
    shipperAddress: shipperAddress || shipper.address || "",
    shipperPhone: shipperPhone || shipper.phone || "",
    consigneeId,
    consigneeName: consignee.name,
    consigneeAddress: consigneeAddress || consignee.address || "",
    consigneePhone: consigneePhone || consignee.phone || "",
    
    handling: handling || [],
    dateIn: dateIn || new Date().toISOString().split("T")[0],
    expires: expires || "",
    location: location || "",
    via: via || "AIR",
    service: service || "",
    carrier: carrier || "",
    origin: origin || "MIA",
    dest: dest || "",
    
    poInvoices: parsedPoInvoices,
    proNumbers: proNumbers || trackingNumber || "",
    
    items: parsedItems,
    
    totalPieces: Number(calcPieces),
    totalWeightLbs: Number(calcWeight),
    totalWeightKgs: Number(totalWeightKgs) || Number((calcWeight * 0.453592).toFixed(2)),
    totalVolWeightLbs: Number(totalVolWeightLbs) || 0,
    totalVolWeightKgs: Number(totalVolWeightKgs) || 0,
    totalCubicCft: Number(totalCubicCft) || 0,
    totalCubicCbm: Number(totalCubicCbm) || 0,
    
    weight: Number(calcWeight),
    volumeCount: Number(calcPieces),
    trackingNumber: proNumbers || trackingNumber || "",
    
    photoUrl,
    photoUrls,
    comments: comments || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: req.user?.uid || null,
    operatorEmail: req.user?.email || operatorEmail || "operator@logistic.com",
    status: "RECEBIDO",
    blId: null
  };
  
  currentDB.receipts.unshift(newReceipt);

  if (!currentDB.auditLog) currentDB.auditLog = [];
  currentDB.auditLog.push({
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    action: "CREATE",
    resource: "receipts",
    resourceId: newReceipt.id,
    tenantId: req.tenantId,
    performedBy: req.user?.email || "operador",
    performedByUid: req.user?.uid,
    timestamp: new Date().toISOString(),
    details: `Recibo #${newReceipt.number} criado com sucesso (${newReceipt.totalPieces} vols / ${newReceipt.totalWeightLbs} lbs).`
  });

  saveDB(currentDB);
  res.status(201).json(newReceipt);
});

// PUT update receipt
receiptRouter.put("/receipts/:id", authMiddleware, uploadRateLimiter, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const currentDB = loadDB();
  const receiptIndex = currentDB.receipts.findIndex(r => r.id === id && r.tenantId === req.tenantId);
  if (receiptIndex === -1) {
    res.status(404).json({ error: "Warehouse Receipt não encontrado neste Tenant." });
    return;
  }

  const existing = currentDB.receipts[receiptIndex];
  
  const { 
    shipperId, 
    consigneeId, 
    unit,
    shipperAddress,
    shipperPhone,
    consigneeAddress,
    consigneePhone,
    handling,
    dateIn,
    expires,
    location,
    via,
    service,
    carrier,
    origin,
    dest,
    poInvoices,
    proNumbers,
    trackingNumber,
    items,
    totalPieces,
    totalWeightLbs,
    totalWeightKgs,
    totalVolWeightLbs,
    totalVolWeightKgs,
    totalCubicCft,
    totalCubicCbm,
    comments,
    photoBase64,
    photoBase64s,
    photoUrls: inputPhotoUrls
  } = req.body;

  const shipper = currentDB.shippers.find(s => s.id === shipperId && s.tenantId === req.tenantId) || { name: existing.shipperName };
  const consignee = currentDB.consignees.find(c => c.id === consigneeId && c.tenantId === req.tenantId) || { name: existing.consigneeName };

  let photoUrls: string[] = [];
  
  if (inputPhotoUrls && Array.isArray(inputPhotoUrls)) {
    photoUrls = [...inputPhotoUrls];
  } else if (existing.photoUrls && Array.isArray(existing.photoUrls)) {
    photoUrls = [...existing.photoUrls];
  } else if (existing.photoUrl) {
    photoUrls = [existing.photoUrl];
  }

  if (photoBase64s && Array.isArray(photoBase64s)) {
    const newUrls = photoBase64s.map(b64 => saveBase64Image(b64)).filter(url => url !== "");
    photoUrls = [...photoUrls, ...newUrls];
  } else if (photoBase64) {
    const singleUrl = saveBase64Image(photoBase64);
    if (singleUrl) {
      photoUrls.push(singleUrl);
    }
  }

  photoUrls = Array.from(new Set(photoUrls.filter(Boolean)));
  if (photoUrls.length === 0) {
    photoUrls = ["/uploads/sample_box.jpg"];
  }

  const photoUrl = photoUrls[0];

  const parsedItems = items || existing.items || [];
  const parsedPoInvoices = poInvoices || existing.poInvoices || [];

  const calcPieces = totalPieces !== undefined ? totalPieces : (parsedItems.reduce((acc: number, item: any) => acc + (Number(item.qty) || 0), 0) || Number(existing.volumeCount) || 1);
  const calcWeight = totalWeightLbs !== undefined ? totalWeightLbs : (parsedItems.reduce((acc: number, item: any) => acc + (Number(item.weight) * (Number(item.qty) || 1) || 0), 0) || Number(existing.weight) || 0);

  const updatedReceipt = {
    ...existing,
    unit: unit || existing.unit || "US",
    shipperId: shipperId || existing.shipperId,
    shipperName: shipper.name,
    shipperAddress: shipperAddress !== undefined ? shipperAddress : existing.shipperAddress,
    shipperPhone: shipperPhone !== undefined ? shipperPhone : existing.shipperPhone,
    consigneeId: consigneeId || existing.consigneeId,
    consigneeName: consignee.name,
    consigneeAddress: consigneeAddress !== undefined ? consigneeAddress : existing.consigneeAddress,
    consigneePhone: consigneePhone !== undefined ? consigneePhone : existing.consigneePhone,
    
    handling: handling || existing.handling || [],
    dateIn: dateIn || existing.dateIn,
    expires: expires !== undefined ? expires : existing.expires,
    location: location !== undefined ? location : existing.location,
    via: via || existing.via || "AIR",
    service: service !== undefined ? service : existing.service,
    carrier: carrier !== undefined ? carrier : existing.carrier,
    origin: origin || existing.origin || "MIA",
    dest: dest !== undefined ? dest : existing.dest,
    
    poInvoices: parsedPoInvoices,
    proNumbers: proNumbers !== undefined ? proNumbers : existing.proNumbers,
    
    items: parsedItems,
    
    totalPieces: Number(calcPieces),
    totalWeightLbs: Number(calcWeight),
    totalWeightKgs: Number(totalWeightKgs) || Number((calcWeight * 0.453592).toFixed(2)),
    totalVolWeightLbs: Number(totalVolWeightLbs) || existing.totalVolWeightLbs,
    totalVolWeightKgs: Number(totalVolWeightKgs) || existing.totalVolWeightKgs,
    totalCubicCft: Number(totalCubicCft) || existing.totalCubicCft,
    totalCubicCbm: Number(totalCubicCbm) || existing.totalCubicCbm,
    
    weight: Number(calcWeight),
    volumeCount: Number(calcPieces),
    trackingNumber: proNumbers || trackingNumber || existing.trackingNumber,
    
    photoUrl,
    photoUrls,
    comments: comments !== undefined ? comments : existing.comments,
    updatedAt: new Date().toISOString(),
    status: req.body.status !== undefined ? req.body.status : (existing.status || "RECEBIDO"),
    blId: req.body.blId !== undefined ? req.body.blId : (existing.blId || null)
  };

  currentDB.receipts[receiptIndex] = updatedReceipt;

  if (!currentDB.auditLog) currentDB.auditLog = [];
  currentDB.auditLog.push({
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    action: "UPDATE",
    resource: "receipts",
    resourceId: id,
    tenantId: req.tenantId,
    performedBy: req.user?.email || "operador",
    performedByUid: req.user?.uid,
    timestamp: new Date().toISOString(),
    details: `Recibo #${updatedReceipt.number} atualizado.`
  });

  saveDB(currentDB);
  res.json(updatedReceipt);
});
