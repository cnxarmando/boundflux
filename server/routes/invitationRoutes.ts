import { Router } from "express";
import { loadDB, saveDB } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middleware";

export const invitationRouter = Router();

// Get public info of an invitation
invitationRouter.get("/public/:id", (req, res) => {
  const currentDB = loadDB();
  if (!currentDB.invitations) currentDB.invitations = [];
  
  const invite = currentDB.invitations.find(i => i.id === req.params.id);
  if (!invite) {
    res.status(404).json({ error: "Convite não encontrado ou já expirado." });
    return;
  }
  
  const tenant = currentDB.tenants?.find(t => t.tenantId === invite.tenantId);
  res.json({
    email: invite.email,
    tenantRole: invite.tenantRole,
    status: invite.status,
    tenantName: tenant ? tenant.name : "BoundFlux",
    invitedBy: invite.invitedBy
  });
});

// Create invitation
invitationRouter.post("/", authMiddleware, (req: AuthenticatedRequest, res) => {
  const isOwner = req.user.tenantRole === "owner";
  const isSuper = req.user.platformRole === "superadmin";
  
  if (!isOwner && !isSuper) {
    res.status(403).json({ error: "Acesso proibido: Apenas proprietários da empresa ou administradores globais podem enviar convites." });
    return;
  }

  const { email, tenantRole, role, assignedUnitId } = req.body;
  if (!email) {
    res.status(400).json({ error: "O e-mail do convidado é obrigatório." });
    return;
  }

  const emailLower = email.toLowerCase();
  const currentDB = loadDB();
  if (!currentDB.invitations) currentDB.invitations = [];

  const userExists = currentDB.users.some(u => u.email.toLowerCase() === emailLower);
  if (userExists) {
    res.status(400).json({ error: "Este usuário já está cadastrado no sistema." });
    return;
  }

  currentDB.invitations = currentDB.invitations.filter(i => !(i.email.toLowerCase() === emailLower && i.status === "pending"));

  const targetTenantId = isSuper ? (req.body.tenantId || req.tenantId || null) : req.tenantId;
  if (!targetTenantId) {
    res.status(400).json({ error: "Selecione a empresa (tenant) de destino para este convite." });
    return;
  }

  const targetRole = tenantRole || role;
  const resolvedRole = targetRole === "owner" ? "owner" : (targetRole === "admin" ? "admin" : "operator");

  const newInvite = {
    id: `invite-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    email: emailLower,
    tenantId: targetTenantId,
    tenantRole: resolvedRole,
    assignedUnitId: assignedUnitId || null,
    invitedBy: req.user.email,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "pending"
  };

  currentDB.invitations.push(newInvite);
  saveDB(currentDB);

  if (!currentDB.auditLog) currentDB.auditLog = [];
  currentDB.auditLog.push({
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    action: "INVITE_USER",
    resource: "invitations",
    resourceId: newInvite.id,
    tenantId: targetTenantId,
    performedBy: req.user.email,
    performedByUid: req.user.uid,
    timestamp: new Date().toISOString(),
    details: `Convidou ${emailLower} como ${newInvite.tenantRole}`
  });
  saveDB(currentDB);

  res.status(201).json(newInvite);
});

// List invitations
invitationRouter.get("/", authMiddleware, (req: AuthenticatedRequest, res) => {
  const isOwner = req.user.tenantRole === "owner";
  const isSuper = req.user.platformRole === "superadmin";

  if (!isOwner && !isSuper) {
    res.status(403).json({ error: "Acesso proibido: Apenas proprietários da empresa ou administradores globais podem ver convites." });
    return;
  }

  const currentDB = loadDB();
  if (!currentDB.invitations) currentDB.invitations = [];

  if (isSuper) {
    res.json(currentDB.invitations);
  } else {
    const tenantInvites = currentDB.invitations.filter(i => i.tenantId === req.tenantId);
    res.json(tenantInvites);
  }
});

// Revoke/cancel invitation
invitationRouter.delete("/:id", authMiddleware, (req: AuthenticatedRequest, res) => {
  const isOwner = req.user.tenantRole === "owner";
  const isSuper = req.user.platformRole === "superadmin";

  if (!isOwner && !isSuper) {
    res.status(403).json({ error: "Acesso proibido: Apenas proprietários da empresa ou administradores globais podem cancelar convites." });
    return;
  }

  const { id } = req.params;
  const currentDB = loadDB();
  if (!currentDB.invitations) currentDB.invitations = [];

  const inviteIndex = currentDB.invitations.findIndex(i => i.id === id);
  if (inviteIndex === -1) {
    res.status(404).json({ error: "Convite não encontrado." });
    return;
  }

  const invite = currentDB.invitations[inviteIndex];
  
  if (!isSuper && invite.tenantId !== req.tenantId) {
    res.status(403).json({ error: "Acesso proibido: Você não possui permissão para gerenciar este convite." });
    return;
  }

  currentDB.invitations.splice(inviteIndex, 1);
  saveDB(currentDB);

  if (!currentDB.auditLog) currentDB.auditLog = [];
  currentDB.auditLog.push({
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    action: "REVOKE_INVITE",
    resource: "invitations",
    resourceId: id,
    tenantId: invite.tenantId,
    performedBy: req.user.email,
    timestamp: new Date().toISOString(),
    details: `Cancelou convite de ${invite.email}`
  });
  saveDB(currentDB);

  res.json({ success: true, message: "Convite cancelado com sucesso." });
});

// Update invitation email or role
invitationRouter.put("/:id", authMiddleware, (req: AuthenticatedRequest, res) => {
  const isOwner = req.user.tenantRole === "owner";
  const isSuper = req.user.platformRole === "superadmin";

  if (!isOwner && !isSuper) {
    res.status(403).json({ error: "Acesso proibido: Apenas proprietários da empresa ou administradores globais podem editar convites." });
    return;
  }

  const { id } = req.params;
  const { email, tenantRole, role, assignedUnitId } = req.body;

  if (email !== undefined && (!email || !email.trim())) {
    res.status(400).json({ error: "O e-mail do convidado nunca pode ficar em branco, ele só pode ser alterado por outro e-mail válido." });
    return;
  }

  const currentDB = loadDB();
  if (!currentDB.invitations) currentDB.invitations = [];

  const invite = currentDB.invitations.find(i => i.id === id);
  if (!invite) {
    res.status(404).json({ error: "Convite não encontrado." });
    return;
  }

  if (!isSuper && invite.tenantId !== req.tenantId) {
    res.status(403).json({ error: "Acesso proibido: Você não tem permissão para gerenciar este convite." });
    return;
  }

  if (email) {
    invite.email = email.trim().toLowerCase();
  }
  const targetRole = tenantRole || role;
  if (targetRole) {
    const resolvedRole = targetRole === "owner" ? "owner" : (targetRole === "admin" ? "admin" : "operator");
    invite.tenantRole = resolvedRole;
    delete (invite as any).role;
  }
  if (assignedUnitId !== undefined) {
    invite.assignedUnitId = assignedUnitId || null;
  }
  invite.updatedAt = new Date().toISOString();
  saveDB(currentDB);

  if (!currentDB.auditLog) currentDB.auditLog = [];
  currentDB.auditLog.push({
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    action: "EDIT_INVITE",
    resource: "invitations",
    resourceId: id,
    tenantId: invite.tenantId,
    performedBy: req.user.email,
    performedByUid: req.user.uid,
    timestamp: new Date().toISOString(),
    details: `Editou convite de ${invite.email} para função ${invite.tenantRole}`
  });
  saveDB(currentDB);

  res.json({ success: true, invite });
});
