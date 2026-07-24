import { Router } from "express";
import { loadDB, saveDB } from "../db";
import { authMiddleware, requireTenantRole, requirePlatformRole, requireSameTenant, AuthenticatedRequest } from "../middleware";

export const auditRouter = Router();

function getResourceArray(db: any, resource: string) {
  if (resource === "shippers") return db.shippers;
  if (resource === "consignees") return db.consignees;
  if (resource === "receipts") return db.receipts;
  if (resource === "bls") return db.billsOfLading;
  return null;
}

// Data Integrity audit
auditRouter.get("/audit/data-integrity", authMiddleware, (req: AuthenticatedRequest, res) => {
  const currentDB = loadDB();
  const tenants = currentDB.tenants || [];
  const validTenantIds = new Set(tenants.map(t => t.tenantId));

  const countMissing = (list: any[]) => {
    return (list || []).filter((item: any) => !item.tenantId || !validTenantIds.has(item.tenantId)).length;
  };

  const anomalies = {
    shippersMissingTenant: countMissing(currentDB.shippers),
    consigneesMissingTenant: countMissing(currentDB.consignees),
    receiptsMissingTenant: countMissing(currentDB.receipts),
    blsMissingTenant: countMissing(currentDB.billsOfLading || []),
    usersMissingTenant: (currentDB.users || []).filter((u: any) => u.platformRole !== "superadmin" && (!u.tenantId || !validTenantIds.has(u.tenantId))).length,
  };

  const totalAnomalies = Object.values(anomalies).reduce((a, b) => a + b, 0);

  res.json({
    status: totalAnomalies === 0 ? "OK" : "ANOMALIES_DETECTED",
    totalAnomalies,
    anomalies,
    timestamp: new Date().toISOString()
  });
});

// Audit Logs
auditRouter.get("/audit-logs", authMiddleware, (req: AuthenticatedRequest, res) => {
  const currentDB = loadDB();
  if (!currentDB.auditLog) currentDB.auditLog = [];
  
  if (req.isGlobalAdmin) {
    res.json(currentDB.auditLog);
  } else {
    const filtered = currentDB.auditLog.filter((log: any) => log.tenantId === req.tenantId);
    res.json(filtered);
  }
});

// Trash list
auditRouter.get("/trash", authMiddleware, requireTenantRole(["owner", "admin"]), (req: AuthenticatedRequest, res) => {
  const currentDB = loadDB();
  
  const filterTrash = (list: any[]) => {
    return (list || []).filter((item: any) => {
      if (!item.deletedAt) return false;
      const tenantObj = (currentDB.tenants || []).find((t: any) => t.tenantId === item.tenantId);
      const retentionDays = tenantObj?.retentionDays ?? 30;
      const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      const isWithinRetention = new Date(item.deletedAt).getTime() > cutoffTime;
      if (!isWithinRetention) return false;
      
      if (req.user?.platformRole === "superadmin") {
        return true;
      }
      return item.tenantId === req.tenantId;
    });
  };

  res.json({
    shippers: filterTrash(currentDB.shippers || []),
    consignees: filterTrash(currentDB.consignees || []),
    receipts: filterTrash(currentDB.receipts || []),
    billsOfLading: filterTrash(currentDB.billsOfLading || []),
  });
});

// Restore Route (Superadmin)
auditRouter.post("/admin/:resource/:id/restore", authMiddleware, requirePlatformRole("superadmin"), (req: AuthenticatedRequest, res) => {
  const { resource, id } = req.params;
  const currentDB = loadDB();
  const arr = getResourceArray(currentDB, resource);
  
  if (!arr) {
    res.status(400).json({ error: "Recurso inválido." });
    return;
  }
  
  const index = arr.findIndex((item: any) => item.id === id);
  if (index === -1) {
    res.status(404).json({ error: "Registro não encontrado." });
    return;
  }
  
  const record = arr[index];
  record.deletedAt = null;
  record.deletedBy = undefined;
  record.updatedAt = new Date().toISOString();

  if (resource === "receipts") {
    record.status = "RECEBIDO";
  }

  if (!currentDB.auditLog) currentDB.auditLog = [];
  currentDB.auditLog.push({
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    action: "RESTORE_SUPERADMIN",
    resource,
    resourceId: id,
    tenantId: record.tenantId || null,
    performedBy: req.user.email,
    performedByUid: req.user.uid,
    timestamp: new Date().toISOString()
  });

  saveDB(currentDB);
  res.json({ success: true, message: "Registro restaurado pelo Superadmin." });
});

// Purge Route (Superadmin)
auditRouter.delete("/admin/:resource/:id/purge", authMiddleware, requirePlatformRole("superadmin"), (req: AuthenticatedRequest, res) => {
  const { resource, id } = req.params;
  const currentDB = loadDB();
  const arr = getResourceArray(currentDB, resource);
  
  if (!arr) {
    res.status(400).json({ error: "Recurso inválido." });
    return;
  }
  
  const index = arr.findIndex((item: any) => item.id === id);
  if (index === -1) {
    res.status(404).json({ error: "Registro não encontrado." });
    return;
  }
  
  const record = arr[index];
  const itemTenantId = record.tenantId || null;
  
  arr.splice(index, 1);

  if (resource === "bls") {
    const deletedReceiptIds = record.receiptIds || [];
    currentDB.receipts = currentDB.receipts.map((r: any) => {
      if (r.blId === id || deletedReceiptIds.includes(r.id)) {
        return { ...r, status: "RECEBIDO", blId: null };
      }
      return r;
    });
  }

  if (!currentDB.auditLog) currentDB.auditLog = [];
  currentDB.auditLog.push({
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    action: "PURGE_HARD_DELETE",
    resource,
    resourceId: id,
    tenantId: itemTenantId,
    performedBy: req.user.email,
    performedByUid: req.user.uid,
    timestamp: new Date().toISOString()
  });

  saveDB(currentDB);
  res.json({ success: true, message: "Registro purgado definitivamente do banco de dados." });
});

// Soft Delete Route (Tenant Owner)
auditRouter.delete("/:resource/:id", authMiddleware, requireTenantRole(["owner"]), requireSameTenant, (req: AuthenticatedRequest, res) => {
  const { resource, id } = req.params;
  const currentDB = loadDB();
  const arr = getResourceArray(currentDB, resource);
  
  if (!arr) {
    res.status(400).json({ error: "Recurso inválido." });
    return;
  }
  
  const index = arr.findIndex((item: any) => item.id === id && item.tenantId === req.tenantId);
  if (index === -1) {
    res.status(404).json({ error: "Registro não encontrado neste Tenant." });
    return;
  }
  
  const record = arr[index];

  if (resource === "receipts" || resource === "receipt") {
    const isLinkedToActiveBL = (currentDB.billsOfLading || []).find((b: any) => 
      b.tenantId === req.tenantId && 
      !b.deletedAt && 
      ((b.receiptIds || []).includes(id) || record.blId === b.id)
    );

    if (isLinkedToActiveBL) {
      res.status(400).json({ 
        error: `Bloqueio de Segurança: Não é possível mover o Recibo (${record.number || id}) para a Lixeira porque ele está consolidado no Bill of Lading ativo (${isLinkedToActiveBL.blNumber}). Por favor, desvincule ou remova o recibo do BL antes de excluí-lo.` 
      });
      return;
    }
  }

  record.deletedAt = new Date().toISOString();
  record.deletedBy = req.user.email;
  record.updatedAt = new Date().toISOString();
  
  if (resource === "bls") {
    const deletedReceiptIds = record.receiptIds || [];
    currentDB.receipts = currentDB.receipts.map((r: any) => {
      if (r.tenantId === req.tenantId && (r.blId === id || deletedReceiptIds.includes(r.id))) {
        return { ...r, status: "RECEBIDO", blId: null };
      }
      return r;
    });
  }

  if (!currentDB.auditLog) currentDB.auditLog = [];
  currentDB.auditLog.push({
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    action: "SOFT_DELETE",
    resource,
    resourceId: id,
    tenantId: req.tenantId,
    performedBy: req.user.email,
    performedByUid: req.user.uid,
    timestamp: new Date().toISOString()
  });

  saveDB(currentDB);
  res.json({ success: true, message: "Registro excluído (suave)." });
});

// Restore Route (Tenant Owner)
auditRouter.post("/:resource/:id/restore", authMiddleware, requireTenantRole(["owner"]), requireSameTenant, (req: AuthenticatedRequest, res) => {
  const { resource, id } = req.params;
  const currentDB = loadDB();
  const arr = getResourceArray(currentDB, resource);
  
  if (!arr) {
    res.status(400).json({ error: "Recurso inválido." });
    return;
  }
  
  const index = arr.findIndex((item: any) => item.id === id && item.tenantId === req.tenantId);
  if (index === -1) {
    res.status(404).json({ error: "Registro não encontrado neste Tenant." });
    return;
  }
  
  const record = arr[index];
  record.deletedAt = null;
  record.deletedBy = undefined;
  record.updatedAt = new Date().toISOString();

  if (resource === "receipts") {
    record.status = "RECEBIDO";
  }

  if (!currentDB.auditLog) currentDB.auditLog = [];
  currentDB.auditLog.push({
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    action: "RESTORE",
    resource,
    resourceId: id,
    tenantId: req.tenantId,
    performedBy: req.user.email,
    performedByUid: req.user.uid,
    timestamp: new Date().toISOString()
  });

  saveDB(currentDB);
  res.json({ success: true, message: "Registro restaurado com sucesso." });
});
