import { Router } from "express";
import { loadDB, saveDB } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middleware";

export const userRouter = Router();

// List active users of the current company (tenant)
userRouter.get("/", authMiddleware, (req: AuthenticatedRequest, res) => {
  const isOwner = req.user.tenantRole === "owner";
  const isSuper = req.user.platformRole === "superadmin";

  if (!isOwner && !isSuper) {
    res.status(403).json({ error: "Acesso proibido: Apenas proprietários da empresa ou administradores globais podem ver a lista de membros." });
    return;
  }

  const currentDB = loadDB();
  const companyUsers = currentDB.users.filter(u => u.tenantId === req.tenantId && u.platformRole !== "superadmin");
  
  const safeUsers = companyUsers.map(({ password, ...u }) => u);
  res.json(safeUsers);
});

// Remove a user from the company
userRouter.delete("/:uid", authMiddleware, (req: AuthenticatedRequest, res) => {
  const isOwner = req.user.tenantRole === "owner";
  const isSuper = req.user.platformRole === "superadmin";

  if (!isOwner && !isSuper) {
    res.status(403).json({ error: "Acesso proibido: Apenas proprietários da empresa ou administradores globais podem remover membros da equipe." });
    return;
  }

  const { uid } = req.params;
  
  if (uid === req.user.uid) {
    res.status(400).json({ error: "Você não pode remover seu próprio acesso ao sistema." });
    return;
  }

  const currentDB = loadDB();
  const userIndex = currentDB.users.findIndex(u => u.uid === uid);
  
  if (userIndex === -1) {
    res.status(404).json({ error: "Usuário não encontrado." });
    return;
  }

  const userToRemove = currentDB.users[userIndex];

  if (!isSuper && userToRemove.tenantId !== req.tenantId) {
    res.status(403).json({ error: "Acesso proibido: Este usuário pertence a outra empresa." });
    return;
  }

  if (userToRemove.tenantRole === "owner" && !isSuper) {
    res.status(403).json({ error: "Acesso proibido: Proprietários de conta só podem ser gerenciados ou removidos pelo suporte técnico (Superadmin)." });
    return;
  }

  currentDB.users.splice(userIndex, 1);
  saveDB(currentDB);

  if (!currentDB.auditLog) currentDB.auditLog = [];
  currentDB.auditLog.push({
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    action: "REMOVE_USER",
    resource: "users",
    resourceId: uid,
    tenantId: userToRemove.tenantId || req.tenantId,
    performedBy: req.user.email,
    performedByUid: req.user.uid,
    timestamp: new Date().toISOString(),
    details: `Removeu o usuário ${userToRemove.email} (${userToRemove.name}) da empresa`
  });
  saveDB(currentDB);

  res.json({ success: true, message: "Membro da equipe removido com sucesso." });
});

// Update user details
userRouter.put("/:uid", authMiddleware, (req: AuthenticatedRequest, res) => {
  const isOwner = req.user.tenantRole === "owner";
  const isSuper = req.user.platformRole === "superadmin";

  if (!isOwner && !isSuper) {
    res.status(403).json({ error: "Acesso proibido: Apenas proprietários da empresa ou administradores globais podem editar dados da equipe." });
    return;
  }

  const { uid } = req.params;
  const { email, name, tenantRole, assignedUnitId } = req.body;

  const currentDB = loadDB();
  const user = currentDB.users.find(u => u.uid === uid);

  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado." });
    return;
  }

  if (!isSuper && user.tenantId !== req.tenantId) {
    res.status(403).json({ error: "Acesso proibido: Este usuário pertence a outra empresa." });
    return;
  }

  const isCurrentlyOwner = user.tenantRole === "owner";
  const isSettingToOwner = tenantRole === "owner";

  if (isCurrentlyOwner || isSettingToOwner) {
    if (email !== undefined && (!email || !email.trim())) {
      res.status(400).json({ error: "O e-mail do dono da empresa nunca pode ficar em branco, ele só pode ser trocado por outro e-mail válido." });
      return;
    }
  }

  if (email !== undefined) {
    const emailStr = email.trim();
    if (!emailStr) {
      res.status(400).json({ error: "O e-mail do usuário não pode ficar em branco." });
      return;
    }
    user.email = emailStr.toLowerCase();
  }

  if (name !== undefined) {
    user.name = name.trim();
  }

  if (tenantRole !== undefined) {
    if (user.tenantRole === "owner" && tenantRole !== "owner" && !isSuper) {
      const otherOwners = currentDB.users.filter(u => u.tenantId === user.tenantId && u.tenantRole === "owner" && u.uid !== uid);
      if (otherOwners.length === 0) {
        res.status(400).json({ error: "Não é permitido rebaixar a função do único dono da empresa. É necessário promover outro membro a dono primeiro." });
        return;
      }
    }
    user.tenantRole = tenantRole;
  }

  if (assignedUnitId !== undefined) {
    user.assignedUnitId = assignedUnitId || null;
  }

  user.updatedAt = new Date().toISOString();
  saveDB(currentDB);

  if (!currentDB.auditLog) currentDB.auditLog = [];
  currentDB.auditLog.push({
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    action: "EDIT_USER",
    resource: "users",
    resourceId: uid,
    tenantId: user.tenantId || req.tenantId,
    performedBy: req.user.email,
    performedByUid: req.user.uid,
    timestamp: new Date().toISOString(),
    details: `Editou o usuário ${user.email} (${user.name}) - Nova função: ${user.tenantRole}`
  });
  saveDB(currentDB);

  const { password: _, ...profile } = user;
  res.json({ success: true, user: profile });
});
