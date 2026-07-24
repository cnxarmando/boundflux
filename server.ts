import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initDatabase, runLocalCleanup, persistToFirestore, dbInMemory, UPLOADS_DIR } from "./server/db";

import { authRouter } from "./server/routes/authRoutes";
import { tenantRouter } from "./server/routes/tenantRoutes";
import { auditRouter } from "./server/routes/auditRoutes";
import { invitationRouter } from "./server/routes/invitationRoutes";
import { userRouter } from "./server/routes/userRoutes";
import { shippingRouter } from "./server/routes/shippingRoutes";
import { receiptRouter } from "./server/routes/receiptRoutes";
import { blRouter } from "./server/routes/blRoutes";
import { aiRouter } from "./server/routes/aiRoutes";

const app = express();
const PORT = 3000;

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-unit-id, x-selected-tenant-id");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Serve static uploaded media files
app.use("/uploads", express.static(UPLOADS_DIR));

// Start background cleanup & persistence synchronization timers
runLocalCleanup();
setInterval(runLocalCleanup, 12 * 60 * 60 * 1000);

setInterval(() => {
  if (dbInMemory) {
    persistToFirestore(dbInMemory).catch(err => {
      console.error("[QUEUE RETRY ERROR] Failed running periodic background sync:", err);
    });
  }
}, 30 * 1000);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Mount Domain Routes
app.use("/api/auth", authRouter);
app.use("/api/invitations", invitationRouter);
app.use("/api/users", userRouter);
app.use("/api", tenantRouter);
app.use("/api", auditRouter);
app.use("/api", shippingRouter);
app.use("/api", receiptRouter);
app.use("/api", blRouter);
app.use("/api", aiRouter);

async function startServer() {
  await initDatabase();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Warehouse Cargo Server listening at http://0.0.0.0:${PORT}`);
  });
}

startServer();
