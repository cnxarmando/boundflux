import { Router } from "express";
import { loadDB, saveDB } from "../db";
import { authMiddleware, requireTenantRole, AuthenticatedRequest } from "../middleware";

export const blRouter = Router();

// GET bills of lading
blRouter.get(["/bls", "/bills-of-lading"], authMiddleware, requireTenantRole(["owner", "admin", "operator"]), (req: AuthenticatedRequest, res) => {
  const currentDB = loadDB();
  const unitHeader = (req.headers["x-unit-id"] as string) || (req.query.unitId as string) || (req.query.originUnitId as string);
  
  let filtered = (currentDB.billsOfLading || []).filter(b => b.tenantId === req.tenantId && !b.deletedAt);
  
  if (unitHeader) {
    filtered = filtered.filter(b => b.originUnitId === unitHeader || b.unit === unitHeader);
  }
  
  res.json(filtered);
});

// POST new bill of lading
blRouter.post("/bls", authMiddleware, requireTenantRole(["owner", "admin", "operator"]), (req: AuthenticatedRequest, res) => {
  const blData = req.body;
  if (!blData.blNumber) {
    res.status(400).json({ error: "O número do BL é obrigatório." });
    return;
  }
  
  const currentDB = loadDB();
  if (!currentDB.billsOfLading) {
    currentDB.billsOfLading = [];
  }
  
  const blId = `bl-${Date.now()}`;
  const newBL = {
    ...blData,
    tenantId: req.tenantId,
    id: blId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  currentDB.billsOfLading.unshift(newBL);
  
  const receiptIds = blData.receiptIds || [];
  currentDB.receipts = currentDB.receipts.map((r: any) => {
    if (r.tenantId === req.tenantId && receiptIds.includes(r.id)) {
      return { ...r, status: "DESPACHADO", blId: blId };
    }
    return r;
  });
  
  if (!currentDB.auditLog) currentDB.auditLog = [];
  currentDB.auditLog.push({
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    action: "CREATE",
    resource: "bls",
    resourceId: blId,
    tenantId: req.tenantId,
    performedBy: req.user?.email || "operador",
    performedByUid: req.user?.uid,
    timestamp: new Date().toISOString(),
    details: `Bill of Lading ${newBL.blNumber} criado com ${receiptIds.length} recibos consolidados.`
  });

  receiptIds.forEach((rId: string) => {
    currentDB.auditLog.push({
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      action: "ATTACHED_TO_BL",
      resource: "receipts",
      resourceId: rId,
      tenantId: req.tenantId,
      performedBy: req.user?.email || "operador",
      performedByUid: req.user?.uid,
      timestamp: new Date().toISOString(),
      details: `Recibo consolidado e vinculado ao Bill of Lading ${newBL.blNumber}.`
    });
  });

  saveDB(currentDB);
  res.status(201).json(newBL);
});

// PUT update bill of lading
blRouter.put("/bls/:id", authMiddleware, requireTenantRole(["owner", "admin", "operator"]), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const blData = req.body;
  
  const currentDB = loadDB();
  if (!currentDB.billsOfLading) {
    currentDB.billsOfLading = [];
  }
  
  const blIndex = currentDB.billsOfLading.findIndex(b => b.id === id && b.tenantId === req.tenantId);
  if (blIndex === -1) {
    res.status(404).json({ error: "Bill of Lading não encontrado neste Tenant." });
    return;
  }
  
  const oldBL = currentDB.billsOfLading[blIndex];
  const updatedBL = {
    ...oldBL,
    ...blData,
    tenantId: req.tenantId,
    updatedAt: new Date().toISOString()
  };
  
  currentDB.billsOfLading[blIndex] = updatedBL;
  
  const oldReceiptIds = oldBL.receiptIds || [];
  const newReceiptIds = blData.receiptIds || [];
  
  currentDB.receipts = currentDB.receipts.map((r: any) => {
    if (r.tenantId === req.tenantId) {
      if (newReceiptIds.includes(r.id)) {
        return { ...r, status: "DESPACHADO", blId: id };
      } else if (oldReceiptIds.includes(r.id)) {
        return { ...r, status: "RECEBIDO", blId: null };
      }
    }
    return r;
  });

  if (!currentDB.auditLog) currentDB.auditLog = [];
  currentDB.auditLog.push({
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    action: "UPDATE",
    resource: "bls",
    resourceId: id,
    tenantId: req.tenantId,
    performedBy: req.user?.email || "operador",
    performedByUid: req.user?.uid,
    timestamp: new Date().toISOString(),
    details: `Bill of Lading ${updatedBL.blNumber} atualizado.`
  });

  saveDB(currentDB);
  res.json(updatedBL);
});
