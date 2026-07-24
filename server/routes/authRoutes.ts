import { Router } from "express";
import bcrypt from "bcryptjs";
import { loadDB, saveDB } from "../db";
import { generateAuthToken, authRateLimiter } from "../middleware";
import { TenantRole, PlatformRole } from "../../src/types";

export const authRouter = Router();

authRouter.post("/login", authRateLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    return;
  }
  
  const currentDB = loadDB();
  const user = currentDB.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (user && user.password && user.password.trim() !== "") {
    let passwordValid = false;
    
    if (user.password.startsWith("$2a$") || user.password.startsWith("$2b$")) {
      passwordValid = bcrypt.compareSync(password, user.password);
    } else {
      if (user.password === password) {
        passwordValid = true;
        user.password = bcrypt.hashSync(password, 10);
        user.updatedAt = new Date().toISOString();
        saveDB(currentDB);
      }
    }

    if (passwordValid) {
      if (user.platformRole !== "superadmin") {
        if (!user.tenantId) {
          res.status(403).json({ error: "Acesso Proibido: Sua conta não está vinculada a nenhuma empresa." });
          return;
        }
        const tenant = currentDB.tenants?.find(t => t.tenantId === user.tenantId);
        if (!tenant) {
          res.status(403).json({ error: "Acesso Proibido: A empresa associada a esta conta não existe ou foi excluída." });
          return;
        }
        if (tenant.deletedAt) {
          res.status(403).json({ error: "Esta empresa foi excluída e seus dados estão na lixeira. Por favor, entre em contato com o administrador." });
          return;
        }
      }

      if (!currentDB.auditLog) currentDB.auditLog = [];
      currentDB.auditLog.push({
        id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        action: "LOGIN",
        resource: "auth",
        resourceId: user.uid,
        tenantId: user.tenantId || null,
        performedBy: user.email,
        timestamp: new Date().toISOString(),
        details: `Login efetuado via e-mail/senha. Nome: ${user.name}`
      });
      saveDB(currentDB);

      const { password: _, ...profile } = user;
      const token = generateAuthToken(user);
      res.json({ user: profile, token });
      return;
    }
  }

  res.status(401).json({ error: "E-mail ou senha incorretos." });
});

authRouter.post("/google", authRateLimiter, (req, res) => {
  const { email, name, uid, inviteCode } = req.body;
  if (!email || !uid) {
    res.status(400).json({ error: "E-mail e UID do Google são obrigatórios." });
    return;
  }

  const emailLower = email.toLowerCase();
  const currentDB = loadDB();

  let user = currentDB.users.find(u => u.email.toLowerCase() === emailLower);

  if (!user) {
    const isSuper = emailLower === "armando.qualitylogistics@gmail.com" || emailLower === "cnxarmando@gmail.com";
    
    let resolvedTenantId: string | null = null;
    let resolvedTenantRole: TenantRole | null = "operator";
    let platformRole: PlatformRole = null;
    let invitationToUpdate: any = null;

    if (isSuper) {
      resolvedTenantId = null;
      resolvedTenantRole = null;
      platformRole = "superadmin";
    } else {
      if (!currentDB.invitations) currentDB.invitations = [];
      
      let invitation = null;
      if (inviteCode) {
        const foundInvite = currentDB.invitations.find(i => i.id === inviteCode && i.status === "pending");
        if (foundInvite) {
          if (foundInvite.email.toLowerCase() === emailLower) {
            invitation = foundInvite;
          } else {
            res.status(403).json({
              error: `Acesso Negado: Este link de convite foi enviado para o e-mail ${foundInvite.email}, mas você está tentando entrar com ${emailLower}. Por favor, faça login com a conta do Google correta.`
            });
            return;
          }
        }
      }
      
      if (!invitation) {
        invitation = currentDB.invitations.find(i => i.email.toLowerCase() === emailLower && i.status === "pending");
      }

      if (invitation) {
        resolvedTenantId = invitation.tenantId;
        resolvedTenantRole = invitation.tenantRole;
        platformRole = null;
        invitationToUpdate = invitation;
      } else {
        const matchingTenant = currentDB.tenants?.find(t => t.domain && t.domain.toLowerCase() === emailLower && !t.deletedAt);
        if (matchingTenant) {
          resolvedTenantId = matchingTenant.tenantId;
          resolvedTenantRole = "owner";
          platformRole = null;
        } else {
          res.status(403).json({
            error: "Acesso Proibido: Seu e-mail não está cadastrado nem possui convite ativo. Se sua empresa foi excluída, o acesso é negado."
          });
          return;
        }
      }
    }

    user = {
      uid: uid,
      tenantId: resolvedTenantId,
      email: emailLower,
      name: name || email.split("@")[0],
      tenantRole: resolvedTenantRole,
      platformRole: platformRole,
      password: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    currentDB.users.push(user);
    
    if (invitationToUpdate) {
      invitationToUpdate.status = "accepted";
      invitationToUpdate.acceptedAt = new Date().toISOString();
      invitationToUpdate.acceptedBy = emailLower;
      invitationToUpdate.updatedAt = new Date().toISOString();
    }

    saveDB(currentDB);
  } else {
    let changed = false;
    if (user.uid !== uid) {
      user.uid = uid;
      changed = true;
    }
    
    const emailLower = user.email.toLowerCase();

    if (!currentDB.invitations) currentDB.invitations = [];
    let invitation = null;
    if (inviteCode) {
      const foundInvite = currentDB.invitations.find(i => i.id === inviteCode && i.status === "pending");
      if (foundInvite && foundInvite.email.toLowerCase() === emailLower) {
        invitation = foundInvite;
      }
    }
    if (!invitation) {
      invitation = currentDB.invitations.find(i => i.email.toLowerCase() === emailLower && i.status === "pending");
    }

    if (invitation) {
      if (user.tenantId !== invitation.tenantId) {
        user.tenantId = invitation.tenantId;
        changed = true;
      }
      if (user.tenantRole !== invitation.tenantRole) {
        user.tenantRole = invitation.tenantRole;
        changed = true;
      }
      invitation.status = "accepted";
      invitation.acceptedAt = new Date().toISOString();
      invitation.acceptedBy = emailLower;
      invitation.updatedAt = new Date().toISOString();
      changed = true;
    }
    
    const loginTenant = currentDB.tenants?.find(t => t.tenantId === user.tenantId);
    if (loginTenant && loginTenant.domain && loginTenant.domain.toLowerCase() === emailLower) {
      if (user.tenantRole !== "owner") {
        user.tenantRole = "owner";
        changed = true;
      }
    }
    
    const isSuper = emailLower === "armando.qualitylogistics@gmail.com" || emailLower === "cnxarmando@gmail.com";
    
    if (isSuper) {
      if (user.platformRole !== "superadmin") { user.platformRole = "superadmin"; changed = true; }
      if (user.tenantRole !== null) { user.tenantRole = null; changed = true; }
      if (user.tenantId !== null) { user.tenantId = null; changed = true; }
    }

    if (changed) {
      user.updatedAt = new Date().toISOString();
      saveDB(currentDB);
    }
  }

  if (user.platformRole !== "superadmin") {
    if (!user.tenantId) {
      res.status(403).json({ error: "Acesso Proibido: Sua conta não está vinculada a nenhuma empresa ativa." });
      return;
    }
    const tenant = currentDB.tenants?.find(t => t.tenantId === user.tenantId);
    if (!tenant) {
      res.status(403).json({ error: "Acesso Proibido: A empresa associada a esta conta foi excluída ou purgada do sistema." });
      return;
    }
    if (tenant.deletedAt) {
      res.status(403).json({ error: "Esta empresa foi excluída e seus dados estão na lixeira. Por favor, entre em contato com o administrador." });
      return;
    }
  }

  if (!currentDB.auditLog) currentDB.auditLog = [];
  currentDB.auditLog.push({
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    action: "LOGIN",
    resource: "auth",
    resourceId: user.uid,
    tenantId: user.tenantId,
    performedBy: user.email,
    performedByUid: user.uid,
    timestamp: new Date().toISOString(),
    details: `Login efetuado via Google OAuth. Nome: ${user.name}`
  });
  saveDB(currentDB);

  const { password: _, ...profile } = user;
  const token = generateAuthToken(user);
  res.json({ user: profile, token });
});
