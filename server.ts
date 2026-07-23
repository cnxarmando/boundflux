import express from "express";
import path from "path";
import fs from "fs";
import zlib from "zlib";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { TenantRole, PlatformRole } from "./src/types";

// Load environment variables
dotenv.config();

// Fixes for ESM path resolution
const __filename = typeof import.meta !== "undefined" && import.meta.url ? fileURLToPath(import.meta.url) : "";
const __dirname = __filename ? path.dirname(__filename) : "";

const app = express();
const PORT = 3000;

// Set up larger payload limits for receiving base64 photo uploads
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Ensure data and uploads directories exist
const DATA_DIR = path.join(process.cwd(), "data");
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Database initial state structure
interface DBStructure {
  shippers: any[];
  consignees: any[];
  receipts: any[];
  users: any[];
  billsOfLading?: any[];
  tenants?: any[];
  invitations?: any[];
  pendingDeletions?: { collection: string; id: string }[];
  auditLog?: any[];
  units?: any[];
}

// Load Applet Config for Firestore
const appletConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf-8"));

// Initialize Firebase Admin
try {
  admin.initializeApp({
    projectId: appletConfig.projectId,
  });
  console.log(`[FIREBASE] Firebase Admin initialized for project ${appletConfig.projectId}`);
} catch (error: any) {
  if (!error.message?.includes("already exists")) {
    console.error("[FIREBASE] Error initializing Firebase Admin:", error);
  }
}

const firestoreDb = getFirestore(appletConfig.firestoreDatabaseId);
console.log(`[FIREBASE] Using Firestore Database: ${appletConfig.firestoreDatabaseId}`);

// In-Memory DB cache to keep responses fast and preserve synchronous handlers
const dbInMemory: DBStructure = { shippers: [], consignees: [], receipts: [], users: [], billsOfLading: [], tenants: [], invitations: [], pendingDeletions: [], auditLog: [], units: [] };
let lastDbInMemory: DBStructure = { shippers: [], consignees: [], receipts: [], users: [], billsOfLading: [], tenants: [], invitations: [], pendingDeletions: [], auditLog: [], units: [] };

function loadDB(): DBStructure {
  return dbInMemory;
}

let isSyncing = false;

async function persistToFirestore(newDb: DBStructure) {
  if (isSyncing) return;
  isSyncing = true;

  const collections = [
    { key: "tenants", idKey: "tenantId" },
    { key: "users", idKey: "uid" },
    { key: "shippers", idKey: "id" },
    { key: "consignees", idKey: "id" },
    { key: "receipts", idKey: "id" },
    { key: "billsOfLading", idKey: "id" },
    { key: "invitations", idKey: "id" },
    { key: "units", idKey: "id" },
    { key: "auditLog", idKey: "id" }
  ] as const;

  let localDbModified = false;

  try {
    // Ensure pendingDeletions is initialized
    if (!dbInMemory.pendingDeletions) {
      dbInMemory.pendingDeletions = [];
    }

    // 1. Process existing pendingDeletions first (attempt retry)
    if (dbInMemory.pendingDeletions.length > 0) {
      const activeDeletions = [...dbInMemory.pendingDeletions];
      for (const del of activeDeletions) {
        try {
          await firestoreDb.collection(del.collection).doc(del.id).delete();
          console.log(`[FIRESTORE SYNC] Successfully processed queued deletion of ${del.id} from ${del.collection}`);
          dbInMemory.pendingDeletions = dbInMemory.pendingDeletions.filter(
            d => !(d.collection === del.collection && d.id === del.id)
          );
          localDbModified = true;
        } catch (err: any) {
          console.warn(`[FIRESTORE SYNC WARN] Failed deleting queued ${del.id} from ${del.collection} (will retry later):`, err.message || err);
        }
      }
    }

    // 2. Perform incremental updates & find new deletions
    for (const col of collections) {
      const listName = col.key;
      const idKey = col.idKey;
      
      const newItems = (newDb[listName] || []) as any[];
      const lastItems = (lastDbInMemory[listName] || []) as any[];
      
      const newMap = new Map(newItems.map(item => [item[idKey], item]));
      const lastMap = new Map(lastItems.map(item => [item[idKey], item]));
      
      const collectionRef = firestoreDb.collection(listName);
      
      // 2a. Write/Update additions and modifications
      for (const [id, item] of newMap.entries()) {
        if (!id) continue;
        
        const lastItem = lastMap.get(id);
        const isNewOrModified = !lastItem || JSON.stringify(item) !== JSON.stringify(lastItem) || item.synced === false;
        
        if (isNewOrModified) {
          try {
            // Omit synced tag before saving to Firestore to prevent bloat
            const { synced, ...itemToSave } = item;
            await collectionRef.doc(id).set(itemToSave);
            
            console.log(`[FIRESTORE SYNC] Saved doc ${id} to collection ${listName} successfully.`);
            
            if (item.synced !== undefined) {
              delete item.synced;
              localDbModified = true;
            }
            
            // Update item in lastDbInMemory
            const indexInLast = lastItems.findIndex((x: any) => x[idKey] === id);
            if (indexInLast !== -1) {
              lastItems[indexInLast] = JSON.parse(JSON.stringify(item));
            } else {
              lastItems.push(JSON.parse(JSON.stringify(item)));
            }
          } catch (err: any) {
            const isPermissionError = err.message?.includes("PERMISSION_DENIED") || err.code === 7 || String(err).includes("permission");
            if (isPermissionError) {
              console.warn(`[FIRESTORE SYNC WARNING] Development sandbox credentials limit direct-write to Firestore for doc ${id} in ${listName}. Local-fallback db.json remains fully active.`);
            } else {
              console.error(`[FIRESTORE SYNC ERROR] Failed saving doc ${id} to collection ${listName}:`, err.message || err);
            }
            
            // Mark as unsynced
            if (item.synced !== false) {
              item.synced = false;
              localDbModified = true;
            }
          }
        }
      }
      
      // 2b. Handle deletions
      for (const id of lastMap.keys()) {
        if (!id) continue;
        if (!newMap.has(id)) {
          try {
            await collectionRef.doc(id).delete();
            console.log(`[FIRESTORE SYNC] Deleted doc ${id} from collection ${listName}`);
            
            // Success: remove from lastDbInMemory
            lastDbInMemory[listName] = (lastDbInMemory[listName] || []).filter((x: any) => x[idKey] !== id);
          } catch (err: any) {
            const isPermissionError = err.message?.includes("PERMISSION_DENIED") || err.code === 7 || String(err).includes("permission");
            if (isPermissionError) {
              console.warn(`[FIRESTORE SYNC WARNING] Development sandbox credentials limit direct-delete to Firestore for doc ${id} in ${listName}. Local-fallback db.json remains fully active.`);
            } else {
              console.error(`[FIRESTORE SYNC ERROR] Failed deleting doc ${id} from collection ${listName}:`, err.message || err);
            }
            
            // Queue this deletion
            const alreadyQueued = dbInMemory.pendingDeletions.some(
              d => d.collection === listName && d.id === id
            );
            if (!alreadyQueued) {
              dbInMemory.pendingDeletions.push({ collection: listName, id });
              localDbModified = true;
            }
            
            // Remove from lastDbInMemory anyway since we track it in pendingDeletions queue
            lastDbInMemory[listName] = (lastDbInMemory[listName] || []).filter((x: any) => x[idKey] !== id);
          }
        }
      }
    }

    if (localDbModified) {
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(dbInMemory, null, 2), "utf-8");
      } catch (e) {
        console.error("[FIRESTORE SYNC ERROR] Failed saving sync markers to local file:", e);
      }
    }
  } finally {
    isSyncing = false;
  }
}

function saveDB(newDb: DBStructure) {
  // Update in-memory copy (preserving reference)
  Object.assign(dbInMemory, newDb);
  
  // Save locally as a fallback
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(newDb, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving to local database file:", e);
  }

  // Sync to Firestore in background (non-blocking)
  persistToFirestore(newDb).catch(err => {
    const isPermissionError = err.message?.includes("PERMISSION_DENIED") || err.code === 7 || String(err).includes("permission");
    if (isPermissionError) {
      console.warn("[FIRESTORE SYNC WARNING] Direct background sync limited by development sandbox credentials. Local database active.");
    } else {
      console.error("[FIRESTORE SYNC ERROR] Failed syncing with Firestore:", err);
    }
  });
}

async function loadFromFirestore(): Promise<DBStructure> {
  const result: DBStructure = {
    shippers: [],
    consignees: [],
    receipts: [],
    users: [],
    billsOfLading: [],
    tenants: [],
    invitations: [],
    auditLog: [],
    units: []
  };

  const collections = ["tenants", "users", "shippers", "consignees", "receipts", "billsOfLading", "invitations", "auditLog", "units"];
  
  for (const col of collections) {
    try {
      const snapshot = await firestoreDb.collection(col).get();
      const items: any[] = [];
      snapshot.forEach((doc) => {
        items.push(doc.data());
      });
      (result as any)[col] = items;
      console.log(`[FIRESTORE LOAD] Loaded ${items.length} items from collection ${col}`);
    } catch (e: any) {
      const isPermissionError = e.message?.includes("PERMISSION_DENIED") || e.code === 7 || String(e).includes("permission");
      if (isPermissionError) {
        console.warn(`[FIRESTORE LOAD WARNING] Development sandbox credentials limit direct-load of collection ${col} from Firestore. Local-fallback db.json active.`);
      } else {
        console.error(`[FIRESTORE LOAD ERROR] Failed loading collection ${col}:`, e);
      }
    }
  }

  return result;
}

function getModifiedTime(item: any): number {
  if (!item) return 0;
  const timeStr = item.updatedAt || item.createdAt || item.acceptedAt || item.timestamp;
  if (!timeStr) return 0;
  const parsed = Date.parse(timeStr);
  return isNaN(parsed) ? 0 : parsed;
}

async function initDatabase() {
  try {
    // 1. Read local cache first to preserve any unsynced items or pendingDeletions
    let localDb: DBStructure = { shippers: [], consignees: [], receipts: [], users: [], billsOfLading: [], tenants: [], invitations: [], pendingDeletions: [], auditLog: [], units: [] };
    if (fs.existsSync(DB_FILE)) {
      try {
        const fileContent = fs.readFileSync(DB_FILE, "utf-8");
        localDb = JSON.parse(fileContent);
      } catch (e) {
        console.error("[FIREBASE] Error reading local DB file on startup:", e);
      }
    }

    console.log("[FIREBASE] Initializing database from Firestore...");
    const loadedDb = await loadFromFirestore();

    // 2. Merge unsynced items and apply pendingDeletions on top of loadedDb
    const collections = [
      { key: "tenants", idKey: "tenantId" },
      { key: "users", idKey: "uid" },
      { key: "shippers", idKey: "id" },
      { key: "consignees", idKey: "id" },
      { key: "receipts", idKey: "id" },
      { key: "billsOfLading", idKey: "id" },
      { key: "invitations", idKey: "id" },
      { key: "units", idKey: "id" },
      { key: "auditLog", idKey: "id" }
    ] as const;

    let mergedSomethingLocal = false;

    for (const col of collections) {
      const listName = col.key;
      const idKey = col.idKey;
      
      const localItems = (localDb[listName] || []) as any[];
      const firestoreItems = (loadedDb[listName] || []) as any[];
      
      const firestoreMap = new Map<string, any>();
      for (const item of firestoreItems) {
        if (item && item[idKey]) {
          firestoreMap.set(String(item[idKey]), item);
        }
      }

      const mergedMap = new Map<string, any>();

      // 1. Load Firestore items as default baseline
      for (const item of firestoreItems) {
        if (item && item[idKey]) {
          mergedMap.set(String(item[idKey]), { ...item });
        }
      }

      // 2. Perform bi-directional Last-Write-Wins (LWW) with local items
      for (const localItem of localItems) {
        if (!localItem || !localItem[idKey]) continue;
        const id = String(localItem[idKey]);
        const firestoreItem = firestoreMap.get(id);

        if (firestoreItem) {
          // Item exists in both local and Firestore. Compare modification times
          const localTime = getModifiedTime(localItem);
          const firestoreTime = getModifiedTime(firestoreItem);

          if (localTime > firestoreTime) {
            // Local is strictly newer. Local wins!
            mergedMap.set(id, { ...localItem });
            mergedSomethingLocal = true;
            console.log(`[FIREBASE MERGE - LWW WIN] Local is newer: Overriding Firestore with local item ${id} in ${listName} (${localTime} > ${firestoreTime})`);
          } else if (localTime === firestoreTime) {
            // Timestamps are identical. Choose the canonical Firestore copy.
            // If the local item had an unsynced tag, we can clear it because the contents are in sync
            if (localItem.synced === false) {
              const updatedLocal = { ...localItem };
              delete updatedLocal.synced;
            }
            mergedMap.set(id, { ...firestoreItem });
          } else {
            // Firestore is newer. Firestore wins!
            console.log(`[FIREBASE MERGE - LWW LOSE] Firestore is newer: Keeping Firestore item ${id} in ${listName} (${localTime} < ${firestoreTime})`);
            if (localItem.synced === false) {
              delete localItem.synced; // clear stale unsynced state
            }
            mergedMap.set(id, { ...firestoreItem });
          }
        } else {
          // Item exists only locally (e.g. offline-created item)
          // Keep it and ensure it is marked to sync to Firestore
          const newItem = { ...localItem };
          if (newItem.synced !== false) {
            newItem.synced = false;
          }
          mergedMap.set(id, newItem);
          mergedSomethingLocal = true;
          console.log(`[FIREBASE MERGE] Restoring local-only item (offline creation): ${id} in ${listName}`);
        }
      }

      const mergedList = Array.from(mergedMap.values());

      // Filter out any pending offline deletions
      if (localDb.pendingDeletions && localDb.pendingDeletions.length > 0) {
        const idsToRemove = localDb.pendingDeletions
          .filter(d => d.collection === listName)
          .map(d => d.id);
        
        if (idsToRemove.length > 0) {
          (loadedDb as any)[listName] = mergedList.filter((item: any) => !idsToRemove.includes(item[idKey]));
          console.log(`[FIREBASE MERGE] Filtered out ${idsToRemove.length} pending offline deletions from ${listName}`);
        } else {
          (loadedDb as any)[listName] = mergedList;
        }
      } else {
        (loadedDb as any)[listName] = mergedList;
      }
    }

    // Preserve the pendingDeletions queue
    loadedDb.pendingDeletions = localDb.pendingDeletions || [];
    
    let isNew = mergedSomethingLocal;
    
    // Seed default tenants if they don't exist
    if (!loadedDb.tenants || loadedDb.tenants.length === 0) {
      loadedDb.tenants = [
        {
          tenantId: "t-1",
          name: "Quality Logistics",
          domain: "qualitylogistics.com",
          planTier: "Enterprise",
          status: "active",
          retentionDays: 30
        },
        {
          tenantId: "t-2",
          name: "Logistic US",
          domain: "logistic.com",
          planTier: "Pro",
          status: "active",
          retentionDays: 15
        },
        {
          tenantId: "t-3",
          name: "Quality Logistics US Branch",
          domain: "qualitylogistics.us",
          planTier: "Enterprise",
          status: "active",
          retentionDays: 30
        },
        {
          tenantId: "t-4",
          name: "Starter Logistics Corp",
          domain: "starterlog.com",
          planTier: "Starter",
          status: "active",
          retentionDays: 30
        }
      ];
      isNew = true;
    }

    // Seed default shippers if empty
    if (!loadedDb.shippers || loadedDb.shippers.length === 0) {
      loadedDb.shippers = [
        { 
          id: "s-1", 
          tenantId: "t-2", 
          name: "Global Logistics Corp", 
          email: "shipping@global.com", 
          phone: "+1 (555) 019-2834", 
          address: "123 Port Side Dr, Miami, FL", 
          createdAt: new Date().toISOString(),
          plants: [
            { id: "sp-1-1", name: "Planta São Paulo - SP", address: "Av. Marginal Pinheiros, 4500, São Paulo, SP", phone: "+55 (11) 4004-1234", email: "sp-plant@global.com" },
            { id: "sp-1-2", name: "Planta Santos - SP", address: "Rua do Porto, 20, Porto de Santos, Santos, SP", phone: "+55 (13) 3211-5678", email: "santos-plant@global.com" }
          ]
        },
        { 
          id: "s-2", 
          tenantId: "t-2", 
          name: "Apex Manufacturing Solutions", 
          email: "logistics@apex.com", 
          phone: "+1 (555) 024-4481", 
          address: "404 Industrial Pkwy, Chicago, IL", 
          createdAt: new Date().toISOString(),
          plants: [
            { id: "sp-2-1", name: "Planta Extrema - MG", address: "Rodovia Fernão Dias, Km 940, Extrema, MG", phone: "+55 (35) 3435-9000", email: "extrema@apex.com" }
          ]
        },
        { 
          id: "s-3", 
          tenantId: "t-1", 
          name: "EuroCargo Spedition GmbH", 
          email: "dispo@eurocargo.de", 
          phone: "+49 89 201944", 
          address: "Flughafenallee 15, Munich, DE", 
          createdAt: new Date().toISOString(),
          plants: []
        }
      ];
      isNew = true;
    }

    // Seed default consignees if empty
    if (!loadedDb.consignees || loadedDb.consignees.length === 0) {
      loadedDb.consignees = [
        { 
          id: "c-1", 
          tenantId: "t-2", 
          name: "Northeast Distribution Hub", 
          email: "recepcao@northeast.com", 
          phone: "+1 (555) 011-9231", 
          address: "88 Interstate Hwy 95, Boston, MA", 
          createdAt: new Date().toISOString(),
          plants: []
        },
        { 
          id: "c-2", 
          tenantId: "t-2", 
          name: "Latin America Trade Center", 
          email: "import@latamtrade.com", 
          phone: "+1 (305) 555-0192", 
          address: "246 Importadora Way, Miami, FL", 
          createdAt: new Date().toISOString(),
          plants: []
        },
        { 
          id: "c-3", 
          tenantId: "t-1", 
          name: "Supermercados do Povo S.A.", 
          email: "logistica@superpovo.com.br", 
          phone: "+55 (11) 3456-7890", 
          address: "Av. do Armazém, 1200, São Paulo, BR", 
          createdAt: new Date().toISOString(),
          plants: [
            { id: "cp-3-1", name: "CD Guarulhos - SP", address: "Rodovia Presidente Dutra, Km 215, Guarulhos, SP", phone: "+55 (11) 2460-1100", email: "cd.guarulhos@superpovo.com.br" },
            { id: "cp-3-2", name: "Filial Rio - RJ", address: "Av. Brasil, 15000, Rio de Janeiro, RJ", phone: "+55 (21) 3978-4400", email: "rio@superpovo.com.br" }
          ]
        }
      ];
      isNew = true;
    }

    // Seed default receipts if empty
    if (!loadedDb.receipts || loadedDb.receipts.length === 0) {
      loadedDb.receipts = [
        {
          id: "wr-1",
          tenantId: "t-2",
          number: "WR-11986",
          shipperId: "s-1",
          shipperName: "GRAINGER TX",
          shipperAddress: "201 FREEDOM DRIVE, ROANOKE, TX 76262",
          shipperPhone: "",
          consigneeId: "c-2",
          consigneeName: "OOS-INTERNATIONAL BV",
          consigneeAddress: "OOSTKAPELSEWEG 4, SEROOSKERE 4353 EH",
          consigneePhone: "31118726200",
          handling: ["Commercial Invoice", "Pkg List", "Pallets"],
          dateIn: "2026-07-09",
          expires: "",
          location: "A-12",
          via: "AIR",
          service: "",
          carrier: "DHL",
          origin: "MIA",
          dest: "OOSTKAPELLE",
          poInvoices: [
            { poNumber: "LAM-2026-00383/1", invoiceNumber: "", amount: "" }
          ],
          proNumbers: "517766633412, 517766633423",
          items: [
            { qty: 1, type: "BOX", len: 12, wid: 10, hgt: 5, weight: 2.0, unit: "Lbs", cubic: 0.35, cubicUnit: "Cft", bin: "", location: "" },
            { qty: 1, type: "BOX", len: 12, wid: 10, hgt: 5, weight: 1.0, unit: "Lbs", cubic: 0.35, cubicUnit: "Cft", bin: "", location: "" }
          ],
          totalPieces: 2,
          totalWeightLbs: 3.0,
          totalWeightKgs: 1.36,
          totalVolWeightLbs: 7.23,
          totalVolWeightKgs: 3.28,
          totalCubicCft: 0.69,
          totalCubicCbm: 0.02,
          weight: 3.0,
          volumeCount: 2,
          trackingNumber: "517766633412, 517766633423",
          photoUrl: "/uploads/sample_label.jpg",
          createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          operatorEmail: "operator@logistic.com",
          unit: "US"
        },
        {
          id: "wr-2",
          tenantId: "t-2",
          number: "WR-10002",
          shipperId: "s-2",
          shipperName: "Apex Manufacturing Solutions",
          shipperAddress: "404 Industrial Pkwy, Chicago, IL",
          shipperPhone: "+1 (555) 024-4481",
          consigneeId: "c-1",
          consigneeName: "Northeast Distribution Hub",
          consigneeAddress: "88 Interstate Hwy 95, Boston, MA",
          consigneePhone: "+1 (555) 011-9231",
          handling: ["Pkg List"],
          dateIn: "2026-07-01",
          expires: "",
          location: "B-03",
          via: "TRUCK",
          service: "",
          carrier: "FedEx",
          origin: "CHI",
          dest: "BOS",
          poInvoices: [
            { poNumber: "PO-7781-B", invoiceNumber: "INV-990", amount: "$3,400.00" }
          ],
          proNumbers: "781234567890",
          items: [
            { qty: 1, type: "BOX", len: 24, wid: 24, hgt: 24, weight: 340.2, unit: "Lbs", cubic: 8.0, cubicUnit: "Cft", bin: "", location: "" }
          ],
          totalPieces: 1,
          totalWeightLbs: 340.2,
          totalWeightKgs: 154.31,
          totalVolWeightLbs: 83.13,
          totalVolWeightKgs: 37.71,
          totalCubicCft: 8.0,
          totalCubicCbm: 0.23,
          weight: 340.2,
          volumeCount: 1,
          trackingNumber: "781234567890",
          photoUrl: "CLEANED_UP",
          createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
          operatorEmail: "operator@logistic.com",
          unit: "US"
        }
      ];
      isNew = true;
    }

    // Seed default users if empty
    if (!loadedDb.users || loadedDb.users.length === 0) {
      loadedDb.users = [
        { uid: "u-1", tenantId: "t-1", email: "operator@logistic.com", tenantRole: "operator", platformRole: "user", name: "Carlos Silva (Operador)", password: "password123" },
        { uid: "u-2", tenantId: "t-1", email: "admin@logistic.com", tenantRole: "admin", platformRole: "user", name: "Marina Mendes (Gerente)", password: "password123" },
        { uid: "armando-admin", tenantId: "t-1", email: "armando.qualitylogistics@gmail.com", tenantRole: "owner", platformRole: "superadmin", name: "Armando (Administrador)", password: "" }
      ];
      isNew = true;
    }

    if (!loadedDb.billsOfLading || loadedDb.billsOfLading.length === 0) {
      const defaultUnit = (loadedDb.units && loadedDb.units.find(u => u.tenantId === "t-1"))?.id || "u-orlando-t-1";
      loadedDb.billsOfLading = [
        {
          id: "bl-ql-2848",
          tenantId: "t-1",
          blNumber: "QL-2848",
          documentNumber: "0000001601",
          exportReferences: "FILE #0000001601",
          date: "2026-07-10",
          exporter: "GRAINGER TX / APEX MFG\n201 FREEDOM DRIVE, ROANOKE, TX 76262",
          consignee: "OOS-INTERNATIONAL BV\nOOSTKAPELSEWEG 4, SEROOSKERE 4353 EH",
          notifyParty: "SAME AS CONSIGNEE",
          forwardingAgent: "QUALITY LOGISTICS LLC\nORLANDO WAREHOUSE, FL 32824",
          pointOfOrigin: "ORLANDO, FL",
          domesticRouting: "BOOKING #QL-9901",
          prepaidCollect: "PREPAID",
          marksAndNumbers: "CONTAINER #MSCU-8812901 / SEAL #99120",
          numberOfPackages: 3,
          grossWeightLbs: 343.2,
          grossWeightKgs: 155.67,
          measurementCft: 8.69,
          measurementCbm: 0.25,
          freightCharges: "FREIGHT PREPAID - DOOR TO DOOR",
          receiptIds: ["wr-1", "wr-2"],
          receiptNumbers: ["WR-11986", "WR-10002"],
          unit: defaultUnit,
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: "bl-ql-2849",
          tenantId: "t-1",
          blNumber: "QL-2849",
          documentNumber: "0000001602",
          exportReferences: "FILE #0000001602",
          date: "2026-07-12",
          exporter: "GLOBAL SUPPLY CORP\n1200 LOGISTICS WAY, MIAMI, FL 33122",
          consignee: "NORTHEAST DISTRIBUTION HUB\n88 INTERSTATE HWY 95, BOSTON, MA",
          notifyParty: "LOGISTICS DEPT - TEL +1 555-011-9231",
          forwardingAgent: "QUALITY LOGISTICS LLC\nORLANDO WAREHOUSE, FL 32824",
          pointOfOrigin: "ORLANDO, FL",
          domesticRouting: "FEDEX FREIGHT DIRECT",
          prepaidCollect: "PREPAID",
          marksAndNumbers: "PALLET #QL-PAL-04",
          numberOfPackages: 5,
          grossWeightLbs: 1250.0,
          grossWeightKgs: 566.99,
          measurementCft: 45.0,
          measurementCbm: 1.27,
          freightCharges: "PREPAID",
          receiptIds: [],
          receiptNumbers: ["WR-11988"],
          unit: defaultUnit,
          createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: "bl-ql-2850",
          tenantId: "t-1",
          blNumber: "QL-2850",
          documentNumber: "0000001603",
          exportReferences: "FILE #0000001603",
          date: "2026-07-15",
          exporter: "ORLANDO INDUSTRIAL EXPORTS\n404 INDUSTRIAL PKWY, ORLANDO, FL",
          consignee: "CARIBBEAN FREIGHT IMPORTS\nPORT OF SPAIN, TRINIDAD",
          notifyParty: "CARIBBEAN CUSTOMS CLEARANCE",
          forwardingAgent: "QUALITY LOGISTICS LLC\nORLANDO WAREHOUSE, FL 32824",
          pointOfOrigin: "ORLANDO, FL",
          domesticRouting: "OCEAN CARGO EXPRESS",
          prepaidCollect: "COLLECT",
          marksAndNumbers: "CRATE #1-2 / AES X2026071599",
          numberOfPackages: 2,
          grossWeightLbs: 890.5,
          grossWeightKgs: 403.92,
          measurementCft: 28.4,
          measurementCbm: 0.80,
          freightCharges: "OCEAN FREIGHT COLLECT",
          receiptIds: [],
          receiptNumbers: ["WR-11990"],
          unit: defaultUnit,
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];
      isNew = true;
    }

    // Ensure ALL items have tenantId: "t-1" (Migration to single tenant for Quality Logistics)
    let needsSync = false;
    loadedDb.shippers = loadedDb.shippers.map(s => {
      let changed = false;
      if (s.tenantId !== "t-1") { s.tenantId = "t-1"; changed = true; }
      if (!s.plants) { s.plants = []; changed = true; }
      if (changed) { needsSync = true; }
      return s;
    });
    loadedDb.consignees = loadedDb.consignees.map(c => {
      let changed = false;
      if (c.tenantId !== "t-1") { c.tenantId = "t-1"; changed = true; }
      if (!c.plants) { c.plants = []; changed = true; }
      if (changed) { needsSync = true; }
      return c;
    });
    loadedDb.receipts = loadedDb.receipts.map(r => {
      if (r.tenantId !== "t-1") { r.tenantId = "t-1"; needsSync = true; }
      return r;
    });
    // Migrate tenants retentionDays
    if (loadedDb.tenants) {
      loadedDb.tenants = loadedDb.tenants.map((t: any) => {
        let changed = false;
        const days = t.retentionDays ?? t.customRetentionDays ?? 30;
        if (t.retentionDays !== days) {
          t.retentionDays = days;
          changed = true;
        }
        if (t.customRetentionDays !== undefined) {
          delete t.customRetentionDays;
          changed = true;
        }
        if (changed) { needsSync = true; }
        return t;
      });
    }

    // Migrate invitations tenantRole
    if (loadedDb.invitations) {
      loadedDb.invitations = loadedDb.invitations.map((inv: any) => {
        let changed = false;
        const roleVal = inv.tenantRole || inv.role || "operator";
        if (inv.tenantRole !== roleVal) {
          inv.tenantRole = roleVal;
          changed = true;
        }
        if (inv.role !== undefined) {
          delete inv.role;
          changed = true;
        }
        if (changed) { needsSync = true; }
        return inv;
      });
    }

    // Make sure Mariana, Armando, and CnxArmando exist and have correct fields
    const hasMariana = loadedDb.users.some(u => u.email.toLowerCase() === "mariana.qualitylogistics@gmail.com");
    if (!hasMariana) {
      loadedDb.users.push({
        uid: "mariana-owner",
        tenantId: "t-1",
        email: "mariana.qualitylogistics@gmail.com",
        tenantRole: "owner",
        platformRole: "user",
        name: "Mariana (Dona da Quality)",
        password: ""
      });
      needsSync = true;
    }

    const hasCnxArmando = loadedDb.users.some(u => u.email.toLowerCase() === "cnxarmando@gmail.com");
    if (!hasCnxArmando) {
      loadedDb.users.push({
        uid: "cnxarmando-admin",
        tenantId: "t-1",
        email: "cnxarmando@gmail.com",
        tenantRole: "owner",
        platformRole: "superadmin",
        name: "CnxArmando",
        password: ""
      });
      needsSync = true;
    }

    loadedDb.users = loadedDb.users.map(u => {
      let changed = false;
      const emailLower = u.email.toLowerCase();
      const isSuper = emailLower === "armando.qualitylogistics@gmail.com" || emailLower === "cnxarmando@gmail.com";
      
      // Auto promote to owner if user's email matches the tenant's domain
      const userTenant = loadedDb.tenants?.find(t => t.tenantId === u.tenantId);
      if (userTenant && userTenant.domain && userTenant.domain.toLowerCase() === emailLower) {
        if (u.tenantRole !== "owner") {
          u.tenantRole = "owner";
          changed = true;
        }
      }

      if (isSuper) {
        if (u.tenantRole !== "owner") { u.tenantRole = "owner"; changed = true; }
        if (u.platformRole !== "superadmin") { u.platformRole = "superadmin"; changed = true; }
      } else if (emailLower === "mariana.qualitylogistics@gmail.com") {
        if (u.tenantRole !== "owner") { u.tenantRole = "owner"; changed = true; }
        if (u.platformRole !== "user") { u.platformRole = "user"; changed = true; }
        if (u.tenantId !== "t-1") { u.tenantId = "t-1"; changed = true; }
      } else {
        if (!u.tenantRole) {
          u.tenantRole = u.role === "admin" ? "admin" : "operator";
          changed = true;
        }
        if (u.platformRole !== "superadmin" && u.platformRole !== "user") {
          u.platformRole = "user";
          changed = true;
        }
      }
      
      if (u.role !== undefined) {
        delete u.role;
        changed = true;
      }
      
      if (changed) { needsSync = true; }
      return u;
    });
    if (loadedDb.billsOfLading) {
      loadedDb.billsOfLading = loadedDb.billsOfLading.map(b => {
        if (b.tenantId !== "t-1") { b.tenantId = "t-1"; needsSync = true; }
        return b;
      });
    }
    if (needsSync) {
      isNew = true;
    }

    // Populate the global in-memory DB (maintaining identical object reference)
    Object.assign(dbInMemory, loadedDb);
    lastDbInMemory = JSON.parse(JSON.stringify(loadedDb));

    // Write to local file fallback
    fs.writeFileSync(DB_FILE, JSON.stringify(dbInMemory, null, 2), "utf-8");

    if (isNew) {
      console.log("[FIREBASE] Database is new or empty. Seeding defaults to Firestore...");
      await persistToFirestore(dbInMemory);
    }
    console.log("[FIREBASE] Database loaded from Firestore and initialized successfully!");
  } catch (err) {
    console.error("[FIREBASE] Failed initializing database from Firestore, falling back to local file:", err);
    if (fs.existsSync(DB_FILE)) {
      try {
        const fileContent = fs.readFileSync(DB_FILE, "utf-8");
        const parsed = JSON.parse(fileContent);
        Object.assign(dbInMemory, parsed);
        lastDbInMemory = JSON.parse(JSON.stringify(dbInMemory));
      } catch (e) {
        console.error("[FIREBASE] Fallback local file read failed:", e);
      }
    }
  }
}

function verifyBufferMagicBytes(buffer: Buffer, claimedMime: string): boolean {
  if (buffer.length < 4) return false;
  
  if (claimedMime === "image/jpeg") {
    // JPEG signature: FF D8 FF
    return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }
  if (claimedMime === "image/png") {
    // PNG signature: 89 50 4E 47
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  }
  if (claimedMime === "image/webp") {
    // WebP signature: RIFF at 0, WEBP at 8
    if (buffer.length < 12) return false;
    const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46; // "RIFF"
    const isWebp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50; // "WEBP"
    return isRiff && isWebp;
  }
  if (claimedMime === "application/pdf") {
    // PDF signature: %PDF (25 50 44 46)
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }
  return false;
}

function saveBase64Image(base64Str: string): string {
  if (base64Str && (base64Str.startsWith("data:image") || base64Str.startsWith("data:application/pdf"))) {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const mimeType = matches[1];
      
      // Strict mime-type whitelist check
      const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!allowedMimeTypes.includes(mimeType)) {
        console.warn(`Rejected upload: MIME-type "${mimeType}" is not allowed.`);
        return "";
      }
      
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, "base64");
      
      // Strict size check: max 5MB (5 * 1024 * 1024 bytes) per photo
      const MAX_SIZE = 5 * 1024 * 1024;
      if (buffer.length > MAX_SIZE) {
        console.warn(`Rejected upload: file size ${buffer.length} bytes exceeds 5MB limit.`);
        return "";
      }

      // Verify real media type (MIME-Type) via magic bytes
      if (!verifyBufferMagicBytes(buffer, mimeType)) {
        console.warn(`Rejected upload: Real media type does not match claimed MIME-type "${mimeType}".`);
        return "";
      }

      // Save files using randomly generated names (using UUID v4) with safe mapping
      const uuid = crypto.randomUUID();
      let fileExtension = "jpg";
      if (mimeType === "image/png") fileExtension = "png";
      else if (mimeType === "image/webp") fileExtension = "webp";
      else if (mimeType === "application/pdf") fileExtension = "pdf";

      const filename = `receipt-${uuid}.${fileExtension}`;
      
      // Prevenir Path Traversal removendo quaisquer caracteres especiais ou sequências perigosas
      const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, "");
      const savePath = path.join(UPLOADS_DIR, safeFilename);
      
      try {
        fs.writeFileSync(savePath, buffer);
        return `/uploads/${safeFilename}`;
      } catch (err) {
        console.error("Failed to write cargo photo or document upload file:", err);
      }
    }
  } else if (base64Str) {
    if (typeof base64Str === "string") {
      // Prevent directory traversal if external string contains dots or backslashes attempting to read system files
      return base64Str.replace(/\.\./g, "");
    }
    return base64Str;
  }
  return "";
}

// Reference initialized synchronously (reference shared across components)
const db = loadDB();

// Copy mock asset files to uploads folder on start so sample items look realistic
const sampleLabelPath = path.join(UPLOADS_DIR, "sample_label.jpg");
const sampleBoxPath = path.join(UPLOADS_DIR, "sample_box.jpg");
if (!fs.existsSync(sampleLabelPath)) {
  fs.writeFileSync(sampleLabelPath, "MOCK_LABEL_IMAGE");
}
if (!fs.existsSync(sampleBoxPath)) {
  fs.writeFileSync(sampleBoxPath, "MOCK_BOX_IMAGE");
}

// Automatic dynamic retention cleanup routine for local storage with Cold Archiving
function runLocalCleanup() {
  const currentDB = loadDB();
  let modified = false;

  currentDB.receipts = currentDB.receipts.map(receipt => {
    const tenant = currentDB.tenants?.find(t => t.tenantId === receipt.tenantId);
    const retentionDays = tenant?.retentionDays ?? tenant?.customRetentionDays ?? 180;
    const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const createdTime = new Date(receipt.createdAt).getTime();
    
    if (createdTime < cutoffMs) {
      if (receipt.photoUrl && receipt.photoUrl !== "CLEANED_UP" && receipt.photoUrl !== "ARCHIVED" && receipt.photoUrl.startsWith("/uploads/")) {
        const fileName = receipt.photoUrl.replace("/uploads/", "");
        const filePath = path.join(UPLOADS_DIR, fileName);
        if (fs.existsSync(filePath) && fileName !== "sample_label.jpg" && fileName !== "sample_box.jpg") {
          try {
            // Arquivamento Frio: Cria diretório se não existir e comprime com Gzip
            const ARCHIVE_DIR = path.join(UPLOADS_DIR, "archive");
            if (!fs.existsSync(ARCHIVE_DIR)) {
              fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
            }
            const fileData = fs.readFileSync(filePath);
            const compressed = zlib.gzipSync(fileData);
            fs.writeFileSync(path.join(ARCHIVE_DIR, `${fileName}.gz`), compressed);
            
            // Exclui o arquivo original descomprimido
            fs.unlinkSync(filePath);
            console.log(`[CLEANUP] Archived (Gzip) and deleted original photo file: ${fileName} (Retention: ${retentionDays} days, Cold Archiving active)`);
          } catch (e) {
            console.error(`[CLEANUP] Failed to archive/delete file: ${filePath}`, e);
          }
        }
        receipt.photoUrl = "ARCHIVED";
        modified = true;
      }
      if (receipt.photoUrls && Array.isArray(receipt.photoUrls)) {
        let urlsModified = false;
        receipt.photoUrls = receipt.photoUrls.map((url: string) => {
          if (url && url !== "CLEANED_UP" && url !== "ARCHIVED" && url.startsWith("/uploads/")) {
            const fileName = url.replace("/uploads/", "");
            const filePath = path.join(UPLOADS_DIR, fileName);
            if (fs.existsSync(filePath) && fileName !== "sample_label.jpg" && fileName !== "sample_box.jpg") {
              try {
                // Arquivamento Frio: Cria diretório se não existir e comprime com Gzip
                const ARCHIVE_DIR = path.join(UPLOADS_DIR, "archive");
                if (!fs.existsSync(ARCHIVE_DIR)) {
                  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
                }
                const fileData = fs.readFileSync(filePath);
                const compressed = zlib.gzipSync(fileData);
                fs.writeFileSync(path.join(ARCHIVE_DIR, `${fileName}.gz`), compressed);

                fs.unlinkSync(filePath);
                console.log(`[CLEANUP] Archived (Gzip) and deleted original multiple photo file: ${fileName} (Retention: ${retentionDays} days, Cold Archiving active)`);
              } catch (e) {
                console.error(`[CLEANUP] Failed to archive/delete multiple photo file: ${filePath}`, e);
              }
            }
            urlsModified = true;
            return "ARCHIVED";
          }
          return url;
        });
        if (urlsModified) {
          modified = true;
        }
      }
    }
    return receipt;
  });

  // Auto-purge soft-deleted items older than 30 days
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const cutoffDeleteMs = Date.now() - thirtyDaysMs;

  const purgeOldSoftDeleted = (list: any[], resourceName: string) => {
    if (!list) return list;
    const initialLen = list.length;
    const filtered = list.filter(item => {
      if (item.deletedAt) {
        const deletedTime = new Date(item.deletedAt).getTime();
        if (deletedTime < cutoffDeleteMs) {
          console.log(`[CLEANUP] Autopurged soft-deleted ${resourceName} item with ID: ${item.id} (Deleted at: ${item.deletedAt})`);
          return false; // Purge!
        }
      }
      return true;
    });
    if (filtered.length !== initialLen) {
      modified = true;
    }
    return filtered;
  };

  currentDB.shippers = purgeOldSoftDeleted(currentDB.shippers, "shipper");
  currentDB.consignees = purgeOldSoftDeleted(currentDB.consignees, "consignee");
  currentDB.receipts = purgeOldSoftDeleted(currentDB.receipts, "receipt");
  if (currentDB.billsOfLading) {
    currentDB.billsOfLading = purgeOldSoftDeleted(currentDB.billsOfLading, "bl");
  }

  // Auto-purge soft-deleted tenants older than 30 days along with all their associated data
  if (currentDB.tenants) {
    const tenantsLen = currentDB.tenants.length;
    currentDB.tenants = currentDB.tenants.filter(t => {
      if (t.deletedAt) {
        const deletedTime = new Date(t.deletedAt).getTime();
        if (deletedTime < cutoffDeleteMs) {
          console.log(`[CLEANUP] Autopurged soft-deleted tenant with ID: ${t.tenantId} (Deleted at: ${t.deletedAt})`);
          
          // Purge all data associated with this tenantId
          currentDB.shippers = (currentDB.shippers || []).filter(s => s.tenantId !== t.tenantId);
          currentDB.consignees = (currentDB.consignees || []).filter(c => c.tenantId !== t.tenantId);
          currentDB.receipts = (currentDB.receipts || []).filter(r => r.tenantId !== t.tenantId);
          if (currentDB.billsOfLading) {
            currentDB.billsOfLading = currentDB.billsOfLading.filter(b => b.tenantId !== t.tenantId);
          }
          currentDB.users = (currentDB.users || []).filter(u => u.tenantId !== t.tenantId);
          if (currentDB.invitations) {
            currentDB.invitations = currentDB.invitations.filter(i => i.tenantId !== t.tenantId);
          }
          if (currentDB.units) {
            currentDB.units = currentDB.units.filter(un => un.tenantId !== t.tenantId);
          }
          return false; // Purge tenant
        }
      }
      return true;
    });
    if (currentDB.tenants.length !== tenantsLen) {
      modified = true;
    }
  }

  if (modified) {
    saveDB(currentDB);
  }
}

// Run cleanup immediately on start and then every 12 hours
runLocalCleanup();
setInterval(runLocalCleanup, 12 * 60 * 60 * 1000);

// Background queue to periodically retry unsynced items and deletions every 30 seconds
setInterval(() => {
  if (dbInMemory) {
    persistToFirestore(dbInMemory).catch(err => {
      console.error("[QUEUE RETRY ERROR] Failed running periodic background sync:", err);
    });
  }
}, 30 * 1000);


// Interface for Authenticated request
interface AuthenticatedRequest extends express.Request {
  user?: any;
  tenantId?: string;
  isGlobalAdmin?: boolean;
}

// Security Middleware: Quality Logistics Single Tenant check
const authMiddleware = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Não autorizado: Token ausente ou inválido." });
    return;
  }

  const token = authHeader.split(" ")[1];
  const uid = token.replace("mock-jwt-token-", "").replace("google-jwt-token-", "");
  
  const currentDB = loadDB();
  const user = currentDB.users.find((u: any) => u.uid === uid);
  
  if (!user) {
    res.status(401).json({ error: "Não autorizado: Usuário não cadastrado." });
    return;
  }

  req.user = user;
  req.isGlobalAdmin = user.platformRole === "superadmin";
  if (req.isGlobalAdmin && req.headers["x-selected-tenant-id"]) {
    req.tenantId = String(req.headers["x-selected-tenant-id"]);
  } else {
    req.tenantId = user.tenantId || "t-1";
  }

  next();
};

const requireTenantRole = (roles: TenantRole[]) => {
  return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Não autorizado." });
      return;
    }
    // superadmin bypasses tenantRole restriction
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

const requirePlatformRole = (role: PlatformRole) => {
  return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    const user = req.user;
    if (!user || user.platformRole !== role) {
      res.status(403).json({ error: "Acesso Proibido: Apenas Superadmin da plataforma." });
      return;
    }
    next();
  };
};

const requireSameTenant = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Não autorizado." });
    return;
  }
  // superadmin bypasses same tenant checks
  if (user.platformRole === "superadmin") {
    next();
    return;
  }
  req.tenantId = user.tenantId || "t-1";
  next();
};

// ==========================================
// STRICT RATE LIMITING FOR AI & UPLOADS
// ==========================================

const ipLimitStore = new Map<string, { count: number; resetTime: number }>();
const userLimitStore = new Map<string, { count: number; resetTime: number }>();

// Periodic memory leak prevention
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

function createRateLimiter(options: {
  windowMs: number;
  maxPerIp: number;
  maxPerUser: number;
  message: string;
}) {
  return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    const ip = getClientIp(req);
    const userEmail = req.user?.email || "anonymous";
    const now = Date.now();

    // 1. IP-Based Rate Limit
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

    // 2. User-Based Rate Limit (for authenticated actions)
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

// Strict AI Rate Limiter (Max 10 per IP / 5 per user email per minute)
const aiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxPerIp: 10,
  maxPerUser: 5,
  message: "Limite de requisições de Inteligência Artificial excedido (máximo 10 por IP ou 5 por usuário por minuto). Por favor, aguarde um minuto antes de tentar novamente."
});

// Strict Upload Rate Limiter (Max 15 per IP / 10 per user email per minute)
const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxPerIp: 15,
  maxPerUser: 10,
  message: "Limite de uploads e salvamento de fotos excedido (máximo 15 por IP ou 10 por usuário por minuto). Por favor, aguarde um minuto antes de tentar novamente."
});


// API ENDPOINTS

// 1. AUTHENTICATION
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    return;
  }
  
  const currentDB = loadDB();
  let user = currentDB.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (user && user.password === password) {
    const tenant = currentDB.tenants?.find(t => t.tenantId === user.tenantId);
    if (tenant && tenant.deletedAt && user.platformRole !== "superadmin") {
      res.status(403).json({ error: "Esta empresa foi excluída e seus dados estão programados para expurgo definitivo em 30 dias. Por favor, entre em contato com o administrador." });
      return;
    }
    if (!user.tenantId) {
      user.tenantId = "t-1";
    }
    saveDB(currentDB);

    // Audit Log
    if (!currentDB.auditLog) currentDB.auditLog = [];
    currentDB.auditLog.push({
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      action: "LOGIN",
      resource: "auth",
      resourceId: user.uid,
      tenantId: user.tenantId,
      performedBy: user.email,
      timestamp: new Date().toISOString(),
      details: `Login efetuado via e-mail/senha. Nome: ${user.name}`
    });
    saveDB(currentDB);

    const { password: _, ...profile } = user;
    res.json({ user: profile, token: `mock-jwt-token-${profile.uid}` });
  } else {
    // Auto-create/migrate operator@logistic.com and admin@logistic.com to t-1
    if ((email.toLowerCase() === "operator@logistic.com" || email.toLowerCase() === "admin@logistic.com") && password === "password123") {
      if (!user) {
        user = {
          uid: email.toLowerCase() === "admin@logistic.com" ? "u-2" : "u-1",
          tenantId: "t-1",
          email: email.toLowerCase(),
          name: email.toLowerCase() === "admin@logistic.com" ? "Marina Mendes (Gerente)" : "Carlos Silva (Operador)",
          tenantRole: email.toLowerCase() === "admin@logistic.com" ? "admin" : "operator",
          password: "password123",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        currentDB.users.push(user);
      } else {
        user.tenantId = "t-1";
        user.password = "password123";
        user.updatedAt = new Date().toISOString();
      }
      saveDB(currentDB);

      // Audit Log
      if (!currentDB.auditLog) currentDB.auditLog = [];
      currentDB.auditLog.push({
        id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        action: "LOGIN",
        resource: "auth",
        resourceId: user.uid,
        tenantId: user.tenantId,
        performedBy: user.email,
        timestamp: new Date().toISOString(),
        details: `Login efetuado via e-mail/senha (Auto-Criado). Nome: ${user.name}`
      });
      saveDB(currentDB);

      const { password: _, ...profile } = user;
      res.json({ user: profile, token: `mock-jwt-token-${profile.uid}` });
    } else {
      res.status(401).json({ error: "Credenciais inválidas. Use operator@logistic.com / password123 ou admin@logistic.com / password123" });
    }
  }
});

app.post("/api/auth/google", (req, res) => {
  const { email, name, uid, inviteCode } = req.body;
  if (!email || !uid) {
    res.status(400).json({ error: "E-mail e UID do Google são obrigatórios." });
    return;
  }

  const emailLower = email.toLowerCase();
  const currentDB = loadDB();

  // Encontrar usuário existente
  let user = currentDB.users.find(u => u.email.toLowerCase() === emailLower);

  if (!user) {
    // Se não existir, verificar se é superadmin, Mariana (owner) ou se possui convite pendente
    const isSuper = emailLower === "armando.qualitylogistics@gmail.com" || emailLower === "cnxarmando@gmail.com";
    const isMariana = emailLower === "mariana.qualitylogistics@gmail.com";
    
    let resolvedTenantId = "t-1";
    let resolvedTenantRole: TenantRole = "operator";
    let platformRole: PlatformRole = null;
    let invitationToUpdate: any = null;

    if (isSuper) {
      resolvedTenantId = "t-1";
      resolvedTenantRole = "owner";
      platformRole = "superadmin";
    } else if (isMariana) {
      resolvedTenantId = "t-1";
      resolvedTenantRole = "owner";
      platformRole = null;
    } else {
      // Procurar convites ativos
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
      
      // Fallback: buscar convite direto pelo email correspondente
      if (!invitation) {
        invitation = currentDB.invitations.find(i => i.email.toLowerCase() === emailLower && i.status === "pending");
      }

      if (invitation) {
        resolvedTenantId = invitation.tenantId;
        resolvedTenantRole = invitation.role;
        platformRole = null;
        invitationToUpdate = invitation;
      } else {
        // Fallback check: does this user's email match a tenant's domain/email exactly?
        const matchingTenant = currentDB.tenants?.find(t => t.domain && t.domain.toLowerCase() === emailLower);
        if (matchingTenant) {
          resolvedTenantId = matchingTenant.tenantId;
          resolvedTenantRole = "owner";
          platformRole = null;
        } else {
          res.status(403).json({
            error: "Acesso Proibido: Seu e-mail não está pré-autorizado ou convidado. Por favor, entre em contato com o proprietário do sistema ou com o dono da empresa para receber um convite por link."
          });
          return;
        }
      }
    }

    // Criar o usuário
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

    // Check for any pending invitations for this existing user
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
      if (user.tenantRole !== invitation.role) {
        user.tenantRole = invitation.role;
        changed = true;
      }
      invitation.status = "accepted";
      invitation.acceptedAt = new Date().toISOString();
      invitation.acceptedBy = emailLower;
      invitation.updatedAt = new Date().toISOString();
      changed = true;
    }
    
    // Auto promote to owner if user's email matches the tenant's domain
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
      if (user.tenantRole !== "owner") { user.tenantRole = "owner"; changed = true; }
    } else if (emailLower === "mariana.qualitylogistics@gmail.com") {
      if (user.tenantRole !== "owner") { user.tenantRole = "owner"; changed = true; }
      if (user.platformRole !== null) { user.platformRole = null; changed = true; }
    }

    if (changed) {
      user.updatedAt = new Date().toISOString();
      saveDB(currentDB);
    }
  }

  const tenant = currentDB.tenants?.find(t => t.tenantId === user.tenantId);
  if (tenant && tenant.deletedAt && user.platformRole !== "superadmin") {
    res.status(403).json({ error: "Esta empresa foi excluída e seus dados estão programados para expurgo definitivo em 30 dias. Por favor, entre em contato com o administrador." });
    return;
  }

  // Audit Log
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
  res.json({ user: profile, token: `google-jwt-token-${profile.uid}` });
});

// 2. SHIPPERS
app.get("/api/shippers", authMiddleware, (req: AuthenticatedRequest, res) => {
  const currentDB = loadDB();
  const filtered = currentDB.shippers.filter(s => s.tenantId === req.tenantId && !s.deletedAt);
  res.json(filtered);
});

app.post("/api/shippers", authMiddleware, (req: AuthenticatedRequest, res) => {
  const { name, email, phone, address, plants } = req.body;
  if (!name) {
    res.status(400).json({ error: "O nome do Shipper é obrigatório." });
    return;
  }
  
  const currentDB = loadDB();
  const newShipper = {
    id: `s-${Date.now()}`,
    tenantId: req.tenantId, // Auto-inject tenantId
    name,
    email: email || "",
    phone: phone || "",
    address: address || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    plants: plants || []
  };
  
  currentDB.shippers.unshift(newShipper);
  saveDB(currentDB);
  res.status(201).json(newShipper);
});

app.put("/api/shippers/:id", authMiddleware, (req: AuthenticatedRequest, res) => {
  const { name, email, phone, address, plants } = req.body;
  const currentDB = loadDB();
  const shipper = currentDB.shippers.find(s => s.id === req.params.id && s.tenantId === req.tenantId);
  
  if (!shipper) {
    res.status(404).json({ error: "Shipper não encontrado." });
    return;
  }
  
  if (name) shipper.name = name;
  if (email !== undefined) shipper.email = email;
  if (phone !== undefined) shipper.phone = phone;
  if (address !== undefined) shipper.address = address;
  if (plants !== undefined) shipper.plants = plants;
  shipper.updatedAt = new Date().toISOString();
  
  saveDB(currentDB);
  res.json(shipper);
});

// 2.5 UNITS
app.get("/api/units", authMiddleware, (req: AuthenticatedRequest, res) => {
  const currentDB = loadDB();
  if (!currentDB.units) currentDB.units = [];
  let filtered = currentDB.units.filter((u: any) => u.tenantId === req.tenantId && !u.deletedAt);

  if (filtered.length === 0) {
    const tenantId = req.tenantId || "t-1";
    const defaultUnit = {
      id: `u-orlando-${tenantId}`,
      tenantId: tenantId,
      name: "Orlando Warehouse",
      region: "US",
      unitSystem: "imperial",
      theme: {
        primary: "#4f46e5",
        accent: "#06b6d4"
      },
      createdAt: new Date().toISOString(),
      isActive: true
    };
    currentDB.units.unshift(defaultUnit);
    saveDB(currentDB);
    filtered = [defaultUnit];
  }

  res.json(filtered);
});

// Data Integrity & Audit Endpoint
app.get("/api/audit/data-integrity", authMiddleware, (req: AuthenticatedRequest, res) => {
  const currentDB = loadDB();
  const tenantId = req.tenantId || "t-1";

  const tenantReceipts = (currentDB.receipts || []).filter((r: any) => r.tenantId === tenantId);
  const tenantBLs = (currentDB.billsOfLading || []).filter((b: any) => b.tenantId === tenantId);
  const tenantShippers = (currentDB.shippers || []).filter((s: any) => s.tenantId === tenantId);
  const tenantConsignees = (currentDB.consignees || []).filter((c: any) => c.tenantId === tenantId);
  const tenantUnits = (currentDB.units || []).filter((u: any) => u.tenantId === tenantId);

  // Check key completeness
  let missingKeyCount = 0;
  tenantReceipts.forEach((r: any) => {
    if (!r.number || !r.tenantId || !r.status) missingKeyCount++;
  });

  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    tenantId,
    collectionsCount: 9,
    totalRecords: tenantReceipts.length + tenantBLs.length + tenantShippers.length + tenantConsignees.length,
    counts: {
      receipts: tenantReceipts.length,
      billsOfLading: tenantBLs.length,
      shippers: tenantShippers.length,
      consignees: tenantConsignees.length,
      units: tenantUnits.length
    },
    missingKeyCount,
    healthScore: missingKeyCount === 0 ? 100 : Math.max(70, 100 - missingKeyCount * 5)
  });
});

app.post("/api/units", authMiddleware, requireTenantRole(["owner"]), (req: AuthenticatedRequest, res) => {
  const { name, region, theme, unitSystem } = req.body;
  if (!name || !region || !theme || !theme.primary || !theme.accent) {
    res.status(400).json({ error: "Nome, região e tema com cores primária e de acento são obrigatórios." });
    return;
  }
  
  const currentDB = loadDB();
  if (!currentDB.units) currentDB.units = [];

  const newUnit = {
    id: `u-${Date.now()}`,
    tenantId: req.tenantId,
    name,
    region,
    unitSystem: unitSystem === "metric" ? "metric" : "imperial",
    theme: {
      primary: theme.primary,
      accent: theme.accent
    },
    createdAt: new Date().toISOString(),
    isActive: true
  };

  currentDB.units.unshift(newUnit);
  saveDB(currentDB);
  res.status(201).json(newUnit);
});

app.put("/api/units/:id", authMiddleware, requireTenantRole(["owner"]), (req: AuthenticatedRequest, res) => {
  const { name, region, theme, unitSystem, isActive } = req.body;
  const currentDB = loadDB();
  if (!currentDB.units) currentDB.units = [];
  
  const unit = currentDB.units.find((u: any) => u.id === req.params.id && u.tenantId === req.tenantId);
  if (!unit) {
    res.status(404).json({ error: "Unidade não encontrada." });
    return;
  }

  if (name !== undefined) unit.name = name;
  if (region !== undefined) unit.region = region;
  if (unitSystem !== undefined) {
    unit.unitSystem = unitSystem === "metric" ? "metric" : "imperial";
  } else if (region !== undefined) {
    // Fallback if region was changed but unitSystem wasn't explicitly provided
    const upperRegion = String(region).toUpperCase();
    if (upperRegion === "US" || upperRegion === "UNITED STATES" || upperRegion === "ESTADOS UNIDOS") {
      unit.unitSystem = "imperial";
    } else if (upperRegion === "EU" || upperRegion === "EUROPE" || upperRegion === "EUROPA") {
      unit.unitSystem = "metric";
    }
  }
  if (theme !== undefined) {
    unit.theme = {
      primary: theme.primary || unit.theme.primary,
      accent: theme.accent || unit.theme.accent
    };
  }
  if (isActive !== undefined) unit.isActive = Boolean(isActive);

  saveDB(currentDB);
  res.json(unit);
});

app.delete("/api/units/:id", authMiddleware, requireTenantRole(["owner"]), (req: AuthenticatedRequest, res) => {
  const currentDB = loadDB();
  if (!currentDB.units) currentDB.units = [];
  
  const unit = currentDB.units.find((u: any) => u.id === req.params.id && u.tenantId === req.tenantId);
  if (!unit) {
    res.status(404).json({ error: "Unidade não encontrada." });
    return;
  }

  // Soft delete
  unit.deletedAt = new Date().toISOString();
  saveDB(currentDB);
  res.json({ success: true });
});

// 3. CONSIGNEES
app.get("/api/consignees", authMiddleware, (req: AuthenticatedRequest, res) => {
  const currentDB = loadDB();
  const filtered = currentDB.consignees.filter(c => c.tenantId === req.tenantId && !c.deletedAt);
  res.json(filtered);
});

app.post("/api/consignees", authMiddleware, (req: AuthenticatedRequest, res) => {
  const { name, email, phone, address, plants } = req.body;
  if (!name) {
    res.status(400).json({ error: "O nome do Consignee é obrigatório." });
    return;
  }
  
  const currentDB = loadDB();
  const newConsignee = {
    id: `c-${Date.now()}`,
    tenantId: req.tenantId, // Auto-inject tenantId
    name,
    email: email || "",
    phone: phone || "",
    address: address || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    plants: plants || []
  };
  
  currentDB.consignees.unshift(newConsignee);
  saveDB(currentDB);
  res.status(201).json(newConsignee);
});

app.put("/api/consignees/:id", authMiddleware, (req: AuthenticatedRequest, res) => {
  const { name, email, phone, address, plants } = req.body;
  const currentDB = loadDB();
  const consignee = currentDB.consignees.find(c => c.id === req.params.id && c.tenantId === req.tenantId);
  
  if (!consignee) {
    res.status(404).json({ error: "Consignee não encontrado." });
    return;
  }
  
  if (name) consignee.name = name;
  if (email !== undefined) consignee.email = email;
  if (phone !== undefined) consignee.phone = phone;
  if (address !== undefined) consignee.address = address;
  if (plants !== undefined) consignee.plants = plants;
  consignee.updatedAt = new Date().toISOString();
  
  saveDB(currentDB);
  res.json(consignee);
});

app.get("/api/receipts", authMiddleware, (req: AuthenticatedRequest, res) => {
  const currentDB = loadDB();
  const isOperator = req.user?.tenantRole === "operator";
  const isSuper = req.user?.platformRole === "superadmin";
  const unitHeader = (req.headers["x-unit-id"] as string) || (req.query.unitId as string);
  
  let filtered = currentDB.receipts.filter(r => r.tenantId === req.tenantId && !r.deletedAt);
  
  if (unitHeader) {
    filtered = filtered.filter(r => r.unitId === unitHeader || r.unit === unitHeader);
  }
  
  if (isOperator && !isSuper) {
    // Filter strictly to receipts created by this operator or matching their operatorEmail
    filtered = filtered.filter(r => r.createdBy === req.user?.uid || r.operatorEmail?.toLowerCase() === req.user?.email?.toLowerCase());
  }
  
  res.json(filtered);
});

app.post("/api/receipts", authMiddleware, uploadRateLimiter, (req: AuthenticatedRequest, res) => {
  const { 
    shipperId, 
    consigneeId, 
    weight, 
    volumeCount, 
    trackingNumber, 
    photoBase64, 
    photoBase64s, // Added support for multiple photos
    operatorEmail,
    // New fields
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
  
  // Save uploaded photos (support multiple)
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
  
  // Calculate defaults for compatibility if not provided
  const calcPieces = totalPieces !== undefined ? totalPieces : (parsedItems.reduce((acc: number, item: any) => acc + (Number(item.qty) || 0), 0) || Number(volumeCount) || 1);
  const calcWeight = totalWeightLbs !== undefined ? totalWeightLbs : (Number(weight) || parsedItems.reduce((acc: number, item: any) => acc + (Number(item.weight) || 0), 0) || 0);
  
  const newReceipt = {
    id: `wr-${Date.now()}`,
    tenantId: req.tenantId, // Store current tenant identifier
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
    
    // Compatibility fields
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

  // Audit log for creation
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

app.put("/api/receipts/:id", authMiddleware, uploadRateLimiter, (req: AuthenticatedRequest, res) => {
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
    photoBase64s, // New multi-photo base64 uploads
    photoUrls: inputPhotoUrls // Filtered existing photo URLs kept by user
  } = req.body;

  const shipper = currentDB.shippers.find(s => s.id === shipperId && s.tenantId === req.tenantId) || { name: existing.shipperName };
  const consignee = currentDB.consignees.find(c => c.id === consigneeId && c.tenantId === req.tenantId) || { name: existing.consigneeName };

  // Determine current list of photos
  let photoUrls: string[] = [];
  
  if (inputPhotoUrls && Array.isArray(inputPhotoUrls)) {
    photoUrls = [...inputPhotoUrls];
  } else if (existing.photoUrls && Array.isArray(existing.photoUrls)) {
    photoUrls = [...existing.photoUrls];
  } else if (existing.photoUrl) {
    photoUrls = [existing.photoUrl];
  }

  // Handle new photo uploads
  if (photoBase64s && Array.isArray(photoBase64s)) {
    const newUrls = photoBase64s.map(b64 => saveBase64Image(b64)).filter(url => url !== "");
    photoUrls = [...photoUrls, ...newUrls];
  } else if (photoBase64) {
    const singleUrl = saveBase64Image(photoBase64);
    if (singleUrl) {
      photoUrls.push(singleUrl);
    }
  }

  // Clean empty values and set fallback if completely empty
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
    
    // Compatibility fields
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

  // Audit Log for receipt update
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

// ==========================================
// BILLS OF LADING (BL) CRUD ENDPOINTS
// ==========================================
app.get(["/api/bls", "/api/bills-of-lading"], authMiddleware, requireTenantRole(["owner", "admin", "operator"]), (req: AuthenticatedRequest, res) => {
  const currentDB = loadDB();
  const unitHeader = (req.headers["x-unit-id"] as string) || (req.query.unitId as string) || (req.query.originUnitId as string);
  
  let filtered = (currentDB.billsOfLading || []).filter(b => b.tenantId === req.tenantId && !b.deletedAt);
  
  if (unitHeader) {
    filtered = filtered.filter(b => b.originUnitId === unitHeader || b.unit === unitHeader);
  }
  
  res.json(filtered);
});

app.post("/api/bls", authMiddleware, requireTenantRole(["owner", "admin", "operator"]), (req: AuthenticatedRequest, res) => {
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
    tenantId: req.tenantId, // Auto-inject tenantId
    id: blId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  currentDB.billsOfLading.unshift(newBL);
  
  // Mark selected receipts as DESPACHADO and attach blId
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

app.put("/api/bls/:id", authMiddleware, requireTenantRole(["owner", "admin", "operator"]), (req: AuthenticatedRequest, res) => {
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
    tenantId: req.tenantId, // enforce tenant ownership lock
    updatedAt: new Date().toISOString()
  };
  
  currentDB.billsOfLading[blIndex] = updatedBL;
  
  // Revert previously associated receipts that are no longer in this BL
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

function getResourceArray(db: any, resource: string) {
  if (resource === "shippers") return db.shippers;
  if (resource === "consignees") return db.consignees;
  if (resource === "receipts") return db.receipts;
  if (resource === "bls") return db.billsOfLading;
  return null;
}

// Trash / Deleted Items List Endpoint (filtered by tenant retentionDays)
app.get("/api/trash", authMiddleware, requireTenantRole(["owner", "admin"]), (req: AuthenticatedRequest, res) => {
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

  const trashBLs = filterTrash(currentDB.billsOfLading || []);

  res.json({
    shippers: filterTrash(currentDB.shippers || []),
    consignees: filterTrash(currentDB.consignees || []),
    receipts: filterTrash(currentDB.receipts || []),
    billsOfLading: trashBLs,
  });
});

// Soft Delete Route
app.delete("/api/:resource/:id", authMiddleware, requireTenantRole(["owner"]), requireSameTenant, (req: AuthenticatedRequest, res) => {
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

  // Block deletion of receipt if linked to an active (non-deleted) BL
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
  
  // Custom logic for bls: if we soft delete a BL, we revert associated receipts to RECEBIDO
  if (resource === "bls") {
    const deletedReceiptIds = record.receiptIds || [];
    currentDB.receipts = currentDB.receipts.map((r: any) => {
      if (r.tenantId === req.tenantId && (r.blId === id || deletedReceiptIds.includes(r.id))) {
        return { ...r, status: "RECEBIDO", blId: null };
      }
      return r;
    });
  }

  // Audit Log
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
app.post("/api/:resource/:id/restore", authMiddleware, requireTenantRole(["owner"]), requireSameTenant, (req: AuthenticatedRequest, res) => {
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

  // Custom logic for receipts: if we restore a receipt, we set status back to RECEBIDO
  if (resource === "receipts") {
    record.status = "RECEBIDO";
  }

  // Audit Log
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

// Restore Route (Superadmin)
app.post("/api/admin/:resource/:id/restore", authMiddleware, requirePlatformRole("superadmin"), (req: AuthenticatedRequest, res) => {
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

  // Audit Log
  if (!currentDB.auditLog) currentDB.auditLog = [];
  currentDB.auditLog.push({
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    action: "RESTORE_SUPERADMIN",
    resource,
    resourceId: id,
    tenantId: record.tenantId || "t-1",
    performedBy: req.user.email,
    performedByUid: req.user.uid,
    timestamp: new Date().toISOString()
  });

  saveDB(currentDB);
  res.json({ success: true, message: "Registro restaurado pelo Superadmin." });
});

// Hard Delete / Purge Route (Superadmin)
app.delete("/api/admin/:resource/:id/purge", authMiddleware, requirePlatformRole("superadmin"), (req: AuthenticatedRequest, res) => {
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
  const itemTenantId = record.tenantId || "t-1";
  
  // Hard delete / purge
  arr.splice(index, 1);

  // If resource is BL, clean up references
  if (resource === "bls") {
    const deletedReceiptIds = record.receiptIds || [];
    currentDB.receipts = currentDB.receipts.map((r: any) => {
      if (r.blId === id || deletedReceiptIds.includes(r.id)) {
        return { ...r, status: "RECEBIDO", blId: null };
      }
      return r;
    });
  }

  // Audit Log
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


// Get Audit Logs (restricted to global admin or same tenant users)
app.get("/api/audit-logs", authMiddleware, (req: AuthenticatedRequest, res) => {
  const currentDB = loadDB();
  if (!currentDB.auditLog) currentDB.auditLog = [];
  
  if (req.isGlobalAdmin) {
    // Return all audit logs for superadmin
    res.json(currentDB.auditLog);
  } else {
    // Filter by tenantId for tenant admins/owners
    const filtered = currentDB.auditLog.filter((log: any) => log.tenantId === req.tenantId);
    res.json(filtered);
  }
});


// ==========================================
// TENANTS & SAAS ADMINISTRATION ENDPOINTS
// ==========================================

// Get current tenant info (accessible by authenticated tenant operators)
app.get("/api/tenant/current", authMiddleware, (req: AuthenticatedRequest, res) => {
  const currentDB = loadDB();
  const tenant = currentDB.tenants?.find(t => t.tenantId === req.tenantId);
  if (!tenant) {
    res.status(404).json({ error: "Tenant não encontrado." });
    return;
  }
  res.json(tenant);
});

// Admin endpoint to view all tenants (restricted to global administrators e.g. armando)
app.get("/api/admin/tenants", authMiddleware, (req: AuthenticatedRequest, res) => {
  if (!req.isGlobalAdmin) {
    res.status(403).json({ error: "Acesso proibido: Apenas o administrador global do sistema pode acessar esta rota." });
    return;
  }
  const currentDB = loadDB();
  res.json(currentDB.tenants || []);
});


// Admin endpoint to view all invitations
app.get("/api/admin/invitations", authMiddleware, (req: AuthenticatedRequest, res) => {
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
app.get("/api/admin/users", authMiddleware, (req: AuthenticatedRequest, res) => {
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


// Admin endpoint to view platform aggregate metrics (restricted to global administrators)
app.get("/api/admin/metrics", authMiddleware, (req: AuthenticatedRequest, res) => {
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
  
  // Calculate simulated storage based on receipts
  // Each receipt has some photos, let's say average of 1.45MB per receipt
  const simulatedStorageMB = Math.round(totalReceipts * 1.45 * 10) / 10;
  
  res.json({
    totalTenants,
    totalUsers,
    totalReceipts,
    totalBLs,
    totalInvitations,
    simulatedStorageMB,
    usersList: currentDB.users.map((u: any) => ({
      uid: u.uid,
      email: u.email,
      name: u.name,
      tenantId: u.tenantId,
      tenantName: currentDB.tenants?.find((t: any) => t.tenantId === u.tenantId)?.name || "Quality Logistics",
      tenantRole: u.tenantRole || "operator"
    }))
  });
});

// Admin endpoint to create new B2B Tenants
app.post("/api/admin/tenants", authMiddleware, (req: AuthenticatedRequest, res) => {
  if (!req.isGlobalAdmin) {
    res.status(403).json({ error: "Acesso proibido: Apenas o administrador global do sistema pode gerenciar empresas." });
    return;
  }
  
  const { name, domain, planTier, status, retentionDays, customRetentionDays } = req.body;
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

  const daysVal = retentionDays !== undefined ? Number(retentionDays) : (customRetentionDays !== undefined ? Number(customRetentionDays) : 30);

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

// Admin endpoint to update Tenant subscription plans, status or custom retention period
app.put("/api/admin/tenants/:tenantId", authMiddleware, (req: AuthenticatedRequest, res) => {
  if (!req.isGlobalAdmin) {
    res.status(403).json({ error: "Acesso proibido: Apenas o administrador global do sistema pode atualizar empresas." });
    return;
  }

  const { tenantId } = req.params;
  const { name, domain, planTier, status, retentionDays, customRetentionDays } = req.body;

  const currentDB = loadDB();
  if (!currentDB.tenants) currentDB.tenants = [];

  const tenantIndex = currentDB.tenants.findIndex(t => t.tenantId === tenantId);
  if (tenantIndex === -1) {
    res.status(404).json({ error: "Empresa parceira não encontrada." });
    return;
  }

  const tenant = currentDB.tenants[tenantIndex];
  const inputDays = retentionDays !== undefined ? retentionDays : customRetentionDays;
  const daysVal = inputDays !== undefined ? (inputDays === "" ? undefined : Number(inputDays)) : (tenant.retentionDays ?? 30);

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

  // Force trigger cleanup immediately if retention policies changed
  runLocalCleanup();

  res.json(updatedTenant);
});


// Admin endpoint to soft-delete a B2B Tenant (sets deletedAt)
app.delete("/api/admin/tenants/:tenantId", authMiddleware, (req: AuthenticatedRequest, res) => {
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
  tenant.status = "suspended"; // also mark suspended to block direct activity
  tenant.updatedAt = new Date().toISOString();
  
  // Add audit log
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


// Admin endpoint to restore a soft-deleted B2B Tenant
app.post("/api/admin/tenants/:tenantId/restore", authMiddleware, (req: AuthenticatedRequest, res) => {
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
  
  // Add audit log
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


// Admin endpoint to download backup of all tenant data (JSON format)
app.get("/api/admin/tenants/:tenantId/download-backup", authMiddleware, (req: AuthenticatedRequest, res) => {
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

  // Gather all data associated with this tenant
  const tenantBackup = {
    tenant,
    users: currentDB.users.filter(u => u.tenantId === tenantId),
    shippers: currentDB.shippers.filter(s => s.tenantId === tenantId),
    consignees: currentDB.consignees.filter(c => c.tenantId === tenantId),
    receipts: currentDB.receipts.filter(r => r.tenantId === tenantId),
    billsOfLading: (currentDB.billsOfLading || []).filter(b => b.tenantId === tenantId),
    invitations: (currentDB.invitations || []).filter(i => i.tenantId === tenantId),
    units: (currentDB.units || []).filter(un => un.tenantId === tenantId),
    auditLogs: (currentDB.auditLog || []).filter(log => log.tenantId === tenantId)
  };

  // Log audit
  if (!currentDB.auditLog) currentDB.auditLog = [];
  currentDB.auditLog.push({
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    action: "BACKUP_DOWNLOAD",
    resource: "tenants",
    resourceId: tenantId,
    tenantId: tenantId,
    performedBy: req.user.email,
    timestamp: new Date().toISOString(),
    details: `Backup completo de dados da empresa "${tenant.name}" baixado pelo superadmin.`
  });
  saveDB(currentDB);

  res.setHeader("Content-Disposition", `attachment; filename=backup-${tenant.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${tenantId}.json`);
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(tenantBackup, null, 2));
});


// ==========================================
// INVITATIONS & TEAM MANAGEMENT ENDPOINTS
// ==========================================

// Get public info of an invitation (used on login screen to show who invited them)
app.get("/api/invitations/public/:id", (req, res) => {
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
    tenantName: tenant ? tenant.name : "Quality Logistics",
    invitedBy: invite.invitedBy
  });
});

// Create invitation (Owner or Superadmin)
app.post("/api/invitations", authMiddleware, (req: AuthenticatedRequest, res) => {
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

  // Check if user already exists
  const userExists = currentDB.users.some(u => u.email.toLowerCase() === emailLower);
  if (userExists) {
    res.status(400).json({ error: "Este usuário já está cadastrado no sistema." });
    return;
  }

  // Remove existing pending invitations for this email to avoid duplicates
  currentDB.invitations = currentDB.invitations.filter(i => !(i.email.toLowerCase() === emailLower && i.status === "pending"));

  const targetTenantId = isSuper ? (req.body.tenantId || req.tenantId || "t-1") : req.tenantId;

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

  // Log in Audit Log
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
app.get("/api/invitations", authMiddleware, (req: AuthenticatedRequest, res) => {
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
app.delete("/api/invitations/:id", authMiddleware, (req: AuthenticatedRequest, res) => {
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
  
  // Double check tenant ownership boundary
  if (!isSuper && invite.tenantId !== req.tenantId) {
    res.status(403).json({ error: "Acesso proibido: Você não possui permissão para gerenciar este convite." });
    return;
  }

  // Remove invitation
  currentDB.invitations.splice(inviteIndex, 1);
  saveDB(currentDB);

  // Log in Audit Log
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
app.put("/api/invitations/:id", authMiddleware, (req: AuthenticatedRequest, res) => {
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

  // Log in Audit Log
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


// List active users of the current company (tenant)
app.get("/api/users", authMiddleware, (req: AuthenticatedRequest, res) => {
  const isOwner = req.user.tenantRole === "owner";
  const isSuper = req.user.platformRole === "superadmin";

  if (!isOwner && !isSuper) {
    res.status(403).json({ error: "Acesso proibido: Apenas proprietários da empresa ou administradores globais podem ver a lista de membros." });
    return;
  }

  const currentDB = loadDB();
  const companyUsers = currentDB.users.filter(u => u.tenantId === req.tenantId && u.platformRole !== "superadmin");
  
  // Return profiles without passwords
  const safeUsers = companyUsers.map(({ password, ...u }) => u);
  res.json(safeUsers);
});

// Remove a user from the company (tenant)
app.delete("/api/users/:uid", authMiddleware, (req: AuthenticatedRequest, res) => {
  const isOwner = req.user.tenantRole === "owner";
  const isSuper = req.user.platformRole === "superadmin";

  if (!isOwner && !isSuper) {
    res.status(403).json({ error: "Acesso proibido: Apenas proprietários da empresa ou administradores globais podem remover membros da equipe." });
    return;
  }

  const { uid } = req.params;
  
  // Prevent self-deletion
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

  // Validate tenant boundary
  if (!isSuper && userToRemove.tenantId !== req.tenantId) {
    res.status(403).json({ error: "Acesso proibido: Este usuário pertence a outra empresa." });
    return;
  }

  // Prevent removing owners unless superadmin
  if (userToRemove.tenantRole === "owner" && !isSuper) {
    res.status(403).json({ error: "Acesso proibido: Proprietários de conta só podem ser gerenciados ou removidos pelo suporte técnico (Superadmin)." });
    return;
  }

  // Remove the user
  currentDB.users.splice(userIndex, 1);
  saveDB(currentDB);

  // Log in Audit Log
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

// Update user details (email, role/function)
app.put("/api/users/:uid", authMiddleware, (req: AuthenticatedRequest, res) => {
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

  // Validate tenant boundaries
  if (!isSuper && user.tenantId !== req.tenantId) {
    res.status(403).json({ error: "Acesso proibido: Este usuário pertence a outra empresa." });
    return;
  }

  // Validate owner email cannot be empty
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
    // Only superadmin can change owner roles globally, but owners can promote or manage within tenant
    if (user.tenantRole === "owner" && tenantRole !== "owner" && !isSuper) {
      // Check if there are other owners
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

  // Log in Audit Log
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


// Added route for Gemini advanced full-receipt parsing
app.post("/api/gemini/extract-receipt-fields", authMiddleware, aiRateLimiter, async (req, res) => {
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


// 5. GEMINI IMAGE TRACKING NUMBER EXTRACTION API
app.post("/api/gemini/extract-tracking", authMiddleware, aiRateLimiter, async (req, res) => {
  const { photoBase64 } = req.body;
  if (!photoBase64) {
    res.status(400).json({ error: "Nenhuma foto fornecida." });
    return;
  }
  
  // Clean raw base64 data to extract the payload
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
    // Simulate smart cargo label extraction based on realistic mock patterns
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

// Start dev server middleware setup (only if not in production mode)
import { createServer as createViteServer } from "vite";

async function start() {
  // Synchronize and load the persistent database from Firestore on startup
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

start();
