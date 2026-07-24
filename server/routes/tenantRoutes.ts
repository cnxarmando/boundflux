import { Router } from "express";
import { loadDB, saveDB, runLocalCleanup, DBStructure } from "../db";
import { authMiddleware, requirePlatformRole, AuthenticatedRequest } from "../middleware";

export const tenantRouter = Router();

const PLAN_MONTHLY_PRICE_USD: Record<string, number> = {
  Starter: 199,
  Pro: 499,
  Enterprise: 1299
};

function purgeTenantCascade(currentDB: DBStructure, tenantId: string): Record<string, number> {
  const counts: Record<string, number> = {};

  const before = {
    shippers: (currentDB.shippers || []).length,
    consignees: (currentDB.consignees || []).length,
    receipts: (currentDB.receipts || []).length,
    billsOfLading: (currentDB.billsOfLading || []).length,
    users: (currentDB.users || []).length,
    invitations: (currentDB.invitations || []).length,
    units: (currentDB.units || []).length,
  };

  currentDB.shippers = (currentDB.shippers || []).filter(s => s.tenantId !== tenantId);
  currentDB.consignees = (currentDB.consignees || []).filter(c => c.tenantId !== tenantId);
  currentDB.receipts = (currentDB.receipts || []).filter(r => r.tenantId !== tenantId);
  if (currentDB.billsOfLading) {
    currentDB.billsOfLading = currentDB.billsOfLading.filter(b => b.tenantId !== tenantId);
  }
  currentDB.users = (currentDB.users || []).filter(u => u.tenantId !== tenantId);
  if (currentDB.invitations) {
    currentDB.invitations = currentDB.invitations.filter(i => i.tenantId !== tenantId);
  }
  if (currentDB.units) {
    currentDB.units = currentDB.units.filter(un => un.tenantId !== tenantId);
  }
  currentDB.tenants = (currentDB.tenants || []).filter(t => t.tenantId !== tenantId);

  counts.shippers = before.shippers - (currentDB.shippers || []).length;
  counts.consignees = before.consignees - (currentDB.consignees || []).length;
  counts.receipts = before.receipts - (currentDB.receipts || []).length;
  counts.billsOfLading = before.billsOfLading - (currentDB.billsOfLading || []).length;
  counts.users = before.users - (currentDB.users || []).length;
  counts.invitations = before.invitations - (currentDB.invitations || []).length;
  counts.units = before.units - (currentDB.units || []).length;

  return counts;
}

// Get current tenant info
tenantRouter.get("/tenant/current", authMiddleware, (req: AuthenticatedRequest, res) => {
  const currentDB = loadDB();
  const tenant = currentDB.tenants?.find(t => t.tenantId === req.tenantId);
  if (!tenant) {
    res.status(404).json({ error: "Tenant não encontrado." });
    return;
  }
  res.json(tenant);
});

// Admin endpoint to view all tenants
tenantRouter.get("/admin/tenants", authMiddleware, (req: AuthenticatedRequest, res) => {
  if (!req.isGlobalAdmin) {
    res.status(403).json({ error: "Acesso proibido: Apenas o administrador global do sistema pode acessar esta rota." });
    return;
  }
  const currentDB = loadDB();
  res.json(currentDB.tenants || []);
});

// Admin endpoint to view all invitations
tenantRouter.get("/admin/invitations", authMiddleware, (req: AuthenticatedRequest, res) => {
  if (!req.isGlobalAdmin) {
    res.status(403).json({ error: "Acesso proibido: Apenas o administrador global do sistema pode acessar esta rota." });
    return;
  }
  const currentDB = loadDB();
  const invitations = (currentDB.invitations || []).map((i: any) => {
    const tenant = currentDB.tenants?.find((t: any) => t.tenantId === i.tenantId);
    return {
      ...i,
      tenantName: tenant ? tenant.name : "Desconhecida"
    };
  });
  res.json(invitations);
});

// Admin endpoint to view all users
tenantRouter.get("/admin/users", authMiddleware, (req: AuthenticatedRequest, res) => {
  if (!req.isGlobalAdmin) {
    res.status(403).json({ error: "Acesso proibido: Apenas o administrador global do sistema pode acessar esta rota." });
    return;
  }
  const currentDB = loadDB();
  const users = currentDB.users.map((u: any) => {
    const tenant = currentDB.tenants?.find((t: any) => t.tenantId === u.tenantId);
    const { password, ...safeUser } = u;
    return {
      ...safeUser,
      tenantName: tenant ? tenant.name : "Desconhecida"
    };
  });
  res.json(users);
});

// Admin endpoint to view platform aggregate metrics
tenantRouter.get("/admin/metrics", authMiddleware, (req: AuthenticatedRequest, res) => {
  if (!req.isGlobalAdmin) {
    res.status(403).json({ error: "Acesso proibido: Apenas o administrador global do sistema pode acessar esta rota." });
    return;
  }
  const currentDB = loadDB();
  const totalTenants = currentDB.tenants?.length || 0;
  const totalUsers = currentDB.users?.length || 0;
  const totalReceipts = currentDB.receipts?.length || 0;
  const totalBLs = currentDB.billsOfLading?.length || 0;
  const totalInvitations = currentDB.invitations?.length || 0;
  
  const simulatedStorageMB = Math.round(totalReceipts * 1.45 * 10) / 10;
  
  const auditLogs = currentDB.auditLog || [];
  const tenantBreakdown = (currentDB.tenants || []).map((t: any) => {
    const tenantUsers = (currentDB.users || []).filter((u: any) => u.tenantId === t.tenantId);
    const tenantReceipts = (currentDB.receipts || []).filter((r: any) => r.tenantId === t.tenantId);
    const tenantBLs = (currentDB.billsOfLading || []).filter((b: any) => b.tenantId === t.tenantId);
    const tenantUnits = (currentDB.units || []).filter((u: any) => u.tenantId === t.tenantId);

    const tenantLogs = auditLogs
      .filter((l: any) => l.tenantId === t.tenantId)
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const lastActivityAt = tenantLogs.length > 0 ? tenantLogs[0].timestamp : null;
    const daysSinceLastActivity = lastActivityAt
      ? Math.floor((Date.now() - new Date(lastActivityAt).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    let health: "healthy" | "quiet" | "inactive" = "healthy";
    if (daysSinceLastActivity === null) health = "inactive";
    else if (daysSinceLastActivity > 30) health = "inactive";
    else if (daysSinceLastActivity > 7) health = "quiet";

    const tenantStorageMB = Math.round(tenantReceipts.length * 1.45 * 10) / 10;
    const estimatedMonthlyValue = t.status === "active" && !t.deletedAt
      ? (PLAN_MONTHLY_PRICE_USD[t.planTier] ?? 0)
      : 0;

    return {
      tenantId: t.tenantId,
      name: t.name,
      domain: t.domain,
      planTier: t.planTier,
      status: t.status,
      deletedAt: t.deletedAt || null,
      userCount: tenantUsers.length,
      receiptCount: tenantReceipts.length,
      blCount: tenantBLs.length,
      unitCount: tenantUnits.length,
      storageMB: tenantStorageMB,
      lastActivityAt,
      daysSinceLastActivity,
      health,
      estimatedMonthlyValue
    };
  });

  const estimatedMRR = tenantBreakdown.reduce((sum: number, t: any) => sum + t.estimatedMonthlyValue, 0);

  res.json({
    totalTenants,
    totalUsers,
    totalReceipts,
    totalBLs,
    totalInvitations,
    simulatedStorageMB,
    estimatedMRR,
    tenantBreakdown,
    usersList: currentDB.users.map((u: any) => ({
      uid: u.uid,
      email: u.email,
      name: u.name,
      tenantId: u.tenantId,
      tenantName: currentDB.tenants?.find((t: any) => t.tenantId === u.tenantId)?.name || "BoundFlux",
      tenantRole: u.tenantRole || "operator"
    }))
  });
});

// Admin endpoint to create new B2B Tenants
tenantRouter.post("/admin/tenants", authMiddleware, (req: AuthenticatedRequest, res) => {
  if (!req.isGlobalAdmin) {
    res.status(403).json({ error: "Acesso proibido: Apenas o administrador global do sistema pode gerenciar empresas." });
    return;
  }
  
  const { name, domain, planTier, status, retentionDays } = req.body;
  if (!name || !domain) {
    res.status(400).json({ error: "Nome e domínio são campos obrigatórios." });
    return;
  }

  const currentDB = loadDB();
  if (!currentDB.tenants) currentDB.tenants = [];

  const existing = currentDB.tenants.find(t => t.domain.toLowerCase() === domain.toLowerCase());
  if (existing) {
    res.status(400).json({ error: "Uma empresa com este domínio de e-mail corporativo já está cadastrada." });
    return;
  }

  const daysVal = retentionDays !== undefined ? Number(retentionDays) : 30;

  const newTenant = {
    tenantId: `t-${Date.now()}`,
    name,
    domain: domain.toLowerCase(),
    planTier: planTier || "Starter",
    status: status || "active",
    retentionDays: daysVal,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  currentDB.tenants.push(newTenant);
  saveDB(currentDB);
  res.status(201).json(newTenant);
});

// Admin endpoint to update Tenant
tenantRouter.put("/admin/tenants/:tenantId", authMiddleware, (req: AuthenticatedRequest, res) => {
  if (!req.isGlobalAdmin) {
    res.status(403).json({ error: "Acesso proibido: Apenas o administrador global do sistema pode atualizar empresas." });
    return;
  }

  const { tenantId } = req.params;
  const { name, domain, planTier, status, retentionDays } = req.body;

  const currentDB = loadDB();
  if (!currentDB.tenants) currentDB.tenants = [];

  const tenantIndex = currentDB.tenants.findIndex(t => t.tenantId === tenantId);
  if (tenantIndex === -1) {
    res.status(404).json({ error: "Empresa parceira não encontrada." });
    return;
  }

  const tenant = currentDB.tenants[tenantIndex];
  const daysVal = retentionDays !== undefined ? (retentionDays === "" ? undefined : Number(retentionDays)) : (tenant.retentionDays ?? 30);

  const updatedTenant = {
    ...tenant,
    name: name || tenant.name,
    domain: domain ? domain.toLowerCase() : tenant.domain,
    planTier: planTier || tenant.planTier,
    status: status || tenant.status,
    retentionDays: daysVal,
    updatedAt: new Date().toISOString()
  };
  delete (updatedTenant as any).customRetentionDays;

  currentDB.tenants[tenantIndex] = updatedTenant;
  saveDB(currentDB);

  runLocalCleanup();

  res.json(updatedTenant);
});

// Admin endpoint to soft-delete a B2B Tenant
tenantRouter.delete("/admin/tenants/:tenantId", authMiddleware, (req: AuthenticatedRequest, res) => {
  if (!req.isGlobalAdmin) {
    res.status(403).json({ error: "Acesso proibido: Apenas o administrador global do sistema pode excluir empresas." });
    return;
  }
  const { tenantId } = req.params;
  const currentDB = loadDB();
  const tenantIndex = currentDB.tenants.findIndex(t => t.tenantId === tenantId);
  if (tenantIndex === -1) {
    res.status(404).json({ error: "Empresa não encontrada." });
    return;
  }
  
  const tenant = currentDB.tenants[tenantIndex];
  tenant.deletedAt = new Date().toISOString();
  tenant.status = "suspended";
  tenant.updatedAt = new Date().toISOString();
  
  if (!currentDB.auditLog) currentDB.auditLog = [];
  currentDB.auditLog.push({
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    action: "TENANT_DELETE",
    resource: "tenants",
    resourceId: tenantId,
    tenantId: tenantId,
    performedBy: req.user.email,
    timestamp: new Date().toISOString(),
    details: `Empresa "${tenant.name}" excluída suavemente. Informações do banco de dados mantidas por 30 dias.`
  });

  saveDB(currentDB);
  res.json({ success: true, message: `Empresa "${tenant.name}" excluída suavemente. Informações mantidas por 30 dias.`, tenant });
});

// Admin endpoint to restore a soft-deleted Tenant
tenantRouter.post("/admin/tenants/:tenantId/restore", authMiddleware, (req: AuthenticatedRequest, res) => {
  if (!req.isGlobalAdmin) {
    res.status(403).json({ error: "Acesso proibido: Apenas o administrador global do sistema pode restaurar empresas." });
    return;
  }
  const { tenantId } = req.params;
  const currentDB = loadDB();
  const tenantIndex = currentDB.tenants.findIndex(t => t.tenantId === tenantId);
  if (tenantIndex === -1) {
    res.status(404).json({ error: "Empresa não encontrada." });
    return;
  }
  
  const tenant = currentDB.tenants[tenantIndex];
  delete tenant.deletedAt;
  tenant.status = "active";
  tenant.updatedAt = new Date().toISOString();
  
  if (!currentDB.auditLog) currentDB.auditLog = [];
  currentDB.auditLog.push({
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    action: "TENANT_RESTORE",
    resource: "tenants",
    resourceId: tenantId,
    tenantId: tenantId,
    performedBy: req.user.email,
    timestamp: new Date().toISOString(),
    details: `Empresa "${tenant.name}" restaurada com sucesso.`
  });

  saveDB(currentDB);
  res.json({ success: true, message: `Empresa "${tenant.name}" restaurada com sucesso.`, tenant });
});

// Purge single tenant
tenantRouter.post("/admin/tenants/:tenantId/purge", authMiddleware, requirePlatformRole("superadmin"), (req: AuthenticatedRequest, res) => {
  const { tenantId } = req.params;
  const currentDB = loadDB();
  const tenant = (currentDB.tenants || []).find(t => t.tenantId === tenantId);
  if (!tenant) {
    res.status(404).json({ error: "Empresa não encontrada." });
    return;
  }

  const tenantName = tenant.name;
  const counts = purgeTenantCascade(currentDB, tenantId);

  if (!currentDB.auditLog) currentDB.auditLog = [];
  currentDB.auditLog.push({
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    action: "TENANT_PURGE_HARD_DELETE",
    resource: "tenants",
    resourceId: tenantId,
    tenantId: tenantId,
    performedBy: req.user.email,
    performedByUid: req.user.uid,
    timestamp: new Date().toISOString(),
    details: `Empresa "${tenantName}" purgada definitivamente (${JSON.stringify(counts)}).`
  });

  saveDB(currentDB);
  res.json({ success: true, message: `Empresa "${tenantName}" e todos os seus dados foram purgados definitivamente.`, counts });
});

// Full platform reset
tenantRouter.post("/admin/platform/reset-all-tenants", authMiddleware, requirePlatformRole("superadmin"), (req: AuthenticatedRequest, res) => {
  const { confirmationPhrase } = req.body;
  if (confirmationPhrase !== "RESETAR TUDO") {
    res.status(400).json({ error: "Frase de confirmação incorreta. Digite exatamente: RESETAR TUDO" });
    return;
  }

  const currentDB = loadDB();
  const tenantIds = (currentDB.tenants || []).map(t => t.tenantId);
  const tenantCount = tenantIds.length;

  for (const tenantId of tenantIds) {
    purgeTenantCascade(currentDB, tenantId);
  }

  currentDB.shippers = [];
  currentDB.consignees = [];
  currentDB.receipts = [];
  currentDB.billsOfLading = [];
  currentDB.users = (currentDB.users || []).filter(u => u.platformRole === "superadmin");
  currentDB.invitations = [];
  currentDB.units = [];
  currentDB.tenants = [];
  currentDB.pendingDeletions = [];
  currentDB.auditLog = [{
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    action: "PLATFORM_FULL_RESET",
    resource: "platform",
    resourceId: "all",
    tenantId: "all",
    performedBy: req.user.email,
    performedByUid: req.user.uid,
    timestamp: new Date().toISOString(),
    details: `Reset total da plataforma executado (${tenantCount} tenant(s) removido(s)).`
  }];

  saveDB(currentDB);
  res.json({ success: true, message: `Reset total concluído. ${tenantCount} empresa(s) e todos os dados associados foram removidos.` });
});

// Backup download
tenantRouter.get("/admin/tenants/:tenantId/download-backup", authMiddleware, (req: AuthenticatedRequest, res) => {
  if (!req.isGlobalAdmin) {
    res.status(403).json({ error: "Acesso proibido: Apenas o administrador global do sistema pode baixar o backup." });
    return;
  }
  const { tenantId } = req.params;
  const currentDB = loadDB();
  const tenant = currentDB.tenants?.find(t => t.tenantId === tenantId);
  if (!tenant) {
    res.status(404).json({ error: "Empresa não encontrada." });
    return;
  }

  const backupData = {
    tenant,
    shippers: (currentDB.shippers || []).filter(s => s.tenantId === tenantId),
    consignees: (currentDB.consignees || []).filter(c => c.tenantId === tenantId),
    receipts: (currentDB.receipts || []).filter(r => r.tenantId === tenantId),
    billsOfLading: (currentDB.billsOfLading || []).filter(b => b.tenantId === tenantId),
    users: (currentDB.users || []).filter(u => u.tenantId === tenantId).map(({ password, ...u }) => u),
    invitations: (currentDB.invitations || []).filter(i => i.tenantId === tenantId),
    units: (currentDB.units || []).filter(un => un.tenantId === tenantId),
    exportedAt: new Date().toISOString()
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="backup-${tenant.domain}-${new Date().toISOString().split("T")[0]}.json"`);
  res.json(backupData);
});
