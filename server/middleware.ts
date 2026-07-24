import express from "express";
import jwt from "jsonwebtoken";
import { TenantRole, PlatformRole } from "../src/types";
import { loadDB } from "./db";

// JWT Secret Key
// A hardcoded fallback is fine for local development, but must never be used in
// production — that string is committed to the repo history, so anyone who reads the
// source (which will happen, since this is a product meant to be sold to other tenants)
// could forge a valid signed token for any user, including a superadmin. Fail loudly at
// boot instead of silently running an insecure production deployment.
const DEV_ONLY_FALLBACK_SECRET = "boundflux-jwt-secret-key-2026-production-secure";
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error(
    "FATAL: JWT_SECRET environment variable is not set. Refusing to start in production " +
    "with the hardcoded fallback secret, which is public in the source code. Set a real " +
    "JWT_SECRET (e.g. a long random string) in the production environment before starting the server."
  );
}
export const JWT_SECRET = process.env.JWT_SECRET || DEV_ONLY_FALLBACK_SECRET;

export function generateAuthToken(user: any): string {
  return jwt.sign(
    {
      uid: user.uid,
      email: user.email,
      tenantId: user.tenantId,
      platformRole: user.platformRole
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export interface AuthenticatedRequest extends express.Request {
  user?: any;
  tenantId?: string;
  isGlobalAdmin?: boolean;
}

// Security Middleware: Multi-tenant & Active Tenant validation
export const authMiddleware = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Não autorizado: Token ausente ou inválido." });
    return;
  }

  const token = authHeader.split(" ")[1];
  let uid: string | null = null;

  // No fallback to the old "mock-jwt-token-<uid>" / "google-jwt-token-<uid>" format here.
  // That format has no signature at all — anyone who knows or guesses a uid could forge
  // one and authenticate as that user, including a superadmin. Accepting it "for backwards
  // compatibility" would keep that exact hole open forever. A token must verify as a real
  // signed JWT or the request is rejected; any session issued before this fix is invalid
  // and the user simply needs to log in again to get a real token.
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { uid: string };
    if (decoded && decoded.uid) {
      uid = decoded.uid;
    }
  } catch (err) {
    // fall through — uid stays null, request gets rejected below
  }

  if (!uid) {
    res.status(401).json({ error: "Não autorizado: Token assinado inválido ou expirado." });
    return;
  }
  
  const currentDB = loadDB();
  const user = currentDB.users.find((u: any) => u.uid === uid);
  
  if (!user) {
    res.status(401).json({ error: "Não autorizado: Usuário não cadastrado." });
    return;
  }

  req.user = user;
  req.isGlobalAdmin = user.platformRole === "superadmin";
  if (req.isGlobalAdmin) {
    req.tenantId = req.headers["x-selected-tenant-id"] ? String(req.headers["x-selected-tenant-id"]) : undefined;
  } else {
    if (!user.tenantId) {
      res.status(403).json({ error: "Acesso Proibido: Sua conta não está vinculada a nenhuma empresa." });
      return;
    }
    const tenant = (currentDB.tenants || []).find((t: any) => t.tenantId === user.tenantId);
    if (!tenant) {
      res.status(403).json({ error: "Acesso Proibido: A empresa associada a esta conta foi excluída ou purgada do sistema." });
      return;
    }
    if (tenant.deletedAt) {
      res.status(403).json({ error: "Acesso Proibido: Esta empresa foi desativada e está na lixeira." });
      return;
    }
    req.tenantId = user.tenantId;
  }

  next();
};

export const requireTenantRole = (roles: TenantRole[]) => {
  return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Não autorizado." });
      return;
    }
    if (user.platformRole === "superadmin") {
      next();
      return;
    }
    const userRole = user.tenantRole || "operator";
    if (!roles.includes(userRole as TenantRole)) {
      res.status(403).json({ error: "Acesso Proibido: Seu nível de acesso não permite esta ação." });
      return;
    }
    next();
  };
};

export const requirePlatformRole = (role: PlatformRole) => {
  return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    const user = req.user;
    if (!user || user.platformRole !== role) {
      res.status(403).json({ error: "Acesso Proibido: Apenas Superadmin da plataforma." });
      return;
    }
    next();
  };
};

export const requireSameTenant = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Não autorizado." });
    return;
  }
  if (user.platformRole === "superadmin") {
    next();
    return;
  }
  if (!user.tenantId) {
    res.status(403).json({ error: "Acesso proibido: sua conta não está vinculada a nenhuma empresa ativa." });
    return;
  }
  req.tenantId = user.tenantId;
  next();
};

// ==========================================
// STRICT RATE LIMITING FOR AI, UPLOADS & AUTH
// ==========================================

const ipLimitStore = new Map<string, { count: number; resetTime: number }>();
const userLimitStore = new Map<string, { count: number; resetTime: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of ipLimitStore.entries()) {
    if (now > record.resetTime) ipLimitStore.delete(key);
  }
  for (const [key, record] of userLimitStore.entries()) {
    if (now > record.resetTime) userLimitStore.delete(key);
  }
}, 5 * 60 * 1000);

function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    if (typeof forwarded === "string") {
      return forwarded.split(",")[0].trim();
    } else if (Array.isArray(forwarded)) {
      return forwarded[0].trim();
    }
  }
  return req.ip || req.socket?.remoteAddress || "unknown-ip";
}

export function createRateLimiter(options: {
  windowMs: number;
  maxPerIp: number;
  maxPerUser: number;
  message: string;
}) {
  return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    const ip = getClientIp(req);
    const userEmail = (req.user?.email || (typeof req.body?.email === "string" ? req.body.email : "") || "anonymous").toLowerCase().trim();
    const now = Date.now();

    const ipKey = `${req.path}:${ip}`;
    let ipRecord = ipLimitStore.get(ipKey);
    if (!ipRecord || now > ipRecord.resetTime) {
      ipRecord = { count: 0, resetTime: now + options.windowMs };
    }
    ipRecord.count++;
    ipLimitStore.set(ipKey, ipRecord);

    const ipRemaining = Math.max(0, options.maxPerIp - ipRecord.count);
    res.setHeader("X-RateLimit-Limit-IP", options.maxPerIp);
    res.setHeader("X-RateLimit-Remaining-IP", ipRemaining);
    res.setHeader("X-RateLimit-Reset-IP", Math.ceil(ipRecord.resetTime / 1000));

    if (ipRecord.count > options.maxPerIp) {
      console.warn(`[RATE LIMIT EXCEEDED] IP: ${ip} exceeded limit on ${req.method} ${req.path}`);
      res.status(429).json({
        error: options.message,
        retryAfter: Math.ceil((ipRecord.resetTime - now) / 1000)
      });
      return;
    }

    if (userEmail && userEmail !== "anonymous") {
      const userKey = `${req.path}:${userEmail}`;
      let userRecord = userLimitStore.get(userKey);
      if (!userRecord || now > userRecord.resetTime) {
        userRecord = { count: 0, resetTime: now + options.windowMs };
      }
      userRecord.count++;
      userLimitStore.set(userKey, userRecord);

      const userRemaining = Math.max(0, options.maxPerUser - userRecord.count);
      res.setHeader("X-RateLimit-Limit-User", options.maxPerUser);
      res.setHeader("X-RateLimit-Remaining-User", userRemaining);
      res.setHeader("X-RateLimit-Reset-User", Math.ceil(userRecord.resetTime / 1000));

      if (userRecord.count > options.maxPerUser) {
        console.warn(`[RATE LIMIT EXCEEDED] User: ${userEmail} exceeded limit on ${req.method} ${req.path}`);
        res.status(429).json({
          error: options.message,
          retryAfter: Math.ceil((userRecord.resetTime - now) / 1000)
        });
        return;
      }
    }

    next();
  };
}

export const aiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxPerIp: 10,
  maxPerUser: 5,
  message: "Limite de requisições de Inteligência Artificial excedido (máximo 10 por IP ou 5 por usuário por minuto). Por favor, aguarde um minuto antes de tentar novamente."
});

export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxPerIp: 15,
  maxPerUser: 10,
  message: "Limite de uploads e salvamento de fotos excedido (máximo 15 por IP ou 10 por usuário por minuto). Por favor, aguarde um minuto antes de tentar novamente."
});

export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxPerIp: 5,
  maxPerUser: 5,
  message: "Limite de tentativas de autenticação excedido (máximo 5 tentativas por minuto). Por favor, aguarde um minuto antes de tentar novamente."
});
