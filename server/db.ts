import fs from "fs";
import path from "path";
import zlib from "zlib";
import crypto from "crypto";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// Ensure data and uploads directories exist
export const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
export const DB_FILE = path.join(DATA_DIR, "db.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Database initial state structure
export interface DBStructure {
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
  isInitialized?: boolean;
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

export const firestoreDb = getFirestore(appletConfig.firestoreDatabaseId);
console.log(`[FIREBASE] Using Firestore Database: ${appletConfig.firestoreDatabaseId}`);

// In-Memory DB cache to keep responses fast and preserve synchronous handlers
export const dbInMemory: DBStructure = { shippers: [], consignees: [], receipts: [], users: [], billsOfLading: [], tenants: [], invitations: [], pendingDeletions: [], auditLog: [], units: [] };
let lastDbInMemory: DBStructure = { shippers: [], consignees: [], receipts: [], users: [], billsOfLading: [], tenants: [], invitations: [], pendingDeletions: [], auditLog: [], units: [] };

export function loadDB(): DBStructure {
  return dbInMemory;
}

let isSyncing = false;

export async function persistToFirestore(newDb: DBStructure) {
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
    if (!dbInMemory.pendingDeletions) {
      dbInMemory.pendingDeletions = [];
    }

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
          const isPermissionError = err.message?.includes("PERMISSION_DENIED") || err.code === 7 || String(err).includes("permission");
          if (isPermissionError) {
            console.warn(`[FIRESTORE SYNC WARNING] Development sandbox credentials limit direct-delete to Firestore for queued ${del.id} in ${del.collection}. Removing from queue.`);
            dbInMemory.pendingDeletions = dbInMemory.pendingDeletions.filter(
              d => !(d.collection === del.collection && d.id === del.id)
            );
            localDbModified = true;
          } else {
            console.warn(`[FIRESTORE SYNC WARN] Failed deleting queued ${del.id} from ${del.collection} (will retry later):`, err.message || err);
          }
        }
      }
    }

    for (const col of collections) {
      const listName = col.key;
      const idKey = col.idKey;
      
      const newItems = (newDb[listName] || []) as any[];
      const lastItems = (lastDbInMemory[listName] || []) as any[];
      
      const newMap = new Map(newItems.map(item => [item[idKey], item]));
      const lastMap = new Map(lastItems.map(item => [item[idKey], item]));
      
      const collectionRef = firestoreDb.collection(listName);
      
      for (const [id, item] of newMap.entries()) {
        if (!id) continue;
        
        const lastItem = lastMap.get(id);
        const isNewOrModified = !lastItem || JSON.stringify(item) !== JSON.stringify(lastItem) || item.synced === false;
        
        if (isNewOrModified) {
          try {
            const { synced, ...itemToSave } = item;
            await collectionRef.doc(id).set(itemToSave);
            
            console.log(`[FIRESTORE SYNC] Saved doc ${id} to collection ${listName} successfully.`);
            
            if (item.synced !== undefined) {
              delete item.synced;
              localDbModified = true;
            }
            
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
            
            if (item.synced !== false) {
              item.synced = false;
              localDbModified = true;
            }
          }
        }
      }
      
      for (const id of lastMap.keys()) {
        if (!id) continue;
        if (!newMap.has(id)) {
          try {
            await collectionRef.doc(id).delete();
            console.log(`[FIRESTORE SYNC] Deleted doc ${id} from collection ${listName}`);
            
            lastDbInMemory[listName] = (lastDbInMemory[listName] || []).filter((x: any) => x[idKey] !== id);
          } catch (err: any) {
            const isPermissionError = err.message?.includes("PERMISSION_DENIED") || err.code === 7 || String(err).includes("permission");
            if (isPermissionError) {
              console.warn(`[FIRESTORE SYNC WARNING] Development sandbox credentials limit direct-delete to Firestore for doc ${id} in ${listName}. Local-fallback db.json remains fully active.`);
            } else {
              console.error(`[FIRESTORE SYNC ERROR] Failed deleting doc ${id} from collection ${listName}:`, err.message || err);
              const alreadyQueued = dbInMemory.pendingDeletions.some(
                d => d.collection === listName && d.id === id
              );
              if (!alreadyQueued) {
                dbInMemory.pendingDeletions.push({ collection: listName, id });
                localDbModified = true;
              }
            }
            
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

export function saveDB(newDb: DBStructure) {
  Object.assign(dbInMemory, newDb);
  
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(newDb, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving to local database file:", e);
  }

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

export async function initDatabase() {
  try {
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

      for (const item of firestoreItems) {
        if (item && item[idKey]) {
          mergedMap.set(String(item[idKey]), { ...item });
        }
      }

      for (const localItem of localItems) {
        if (!localItem || !localItem[idKey]) continue;
        const id = String(localItem[idKey]);
        const firestoreItem = firestoreMap.get(id);

        if (firestoreItem) {
          const localTime = getModifiedTime(localItem);
          const firestoreTime = getModifiedTime(firestoreItem);

          if (localTime > firestoreTime) {
            mergedMap.set(id, { ...localItem });
            mergedSomethingLocal = true;
            console.log(`[FIREBASE MERGE - LWW WIN] Local is newer: Overriding Firestore with local item ${id} in ${listName} (${localTime} > ${firestoreTime})`);
          } else if (localTime === firestoreTime) {
            if (localItem.synced === false) {
              const updatedLocal = { ...localItem };
              delete updatedLocal.synced;
            }
            mergedMap.set(id, { ...firestoreItem });
          } else {
            console.log(`[FIREBASE MERGE - LWW LOSE] Firestore is newer: Keeping Firestore item ${id} in ${listName} (${localTime} < ${firestoreTime})`);
            if (localItem.synced === false) {
              delete localItem.synced;
            }
            mergedMap.set(id, { ...firestoreItem });
          }
        } else {
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

    loadedDb.pendingDeletions = localDb.pendingDeletions || [];
    
    let isNew = mergedSomethingLocal;
    
    const wasAlreadyInitialized = localDb.isInitialized || fs.existsSync(DB_FILE);

    if (!wasAlreadyInitialized) {
      if (!loadedDb.tenants || loadedDb.tenants.length === 0) {
        loadedDb.tenants = [
          {
            tenantId: "t-1",
            name: "BoundFlux Operations",
            domain: "boundflux.com",
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
            name: "BoundFlux US Logistics",
            domain: "boundflux.us",
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

      if (!loadedDb.users || loadedDb.users.length === 0) {
        loadedDb.users = [
          { uid: "u-1", tenantId: "t-1", email: "operator@logistic.com", tenantRole: "operator", platformRole: "user", name: "Carlos Silva (Operador)", password: "" },
          { uid: "u-2", tenantId: "t-1", email: "admin@logistic.com", tenantRole: "admin", platformRole: "user", name: "Marina Mendes (Gerente)", password: "" },
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
            forwardingAgent: "BOUNDFLUX CARGO LLC\nMIAMI WAREHOUSE, FL 33166",
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
            forwardingAgent: "BOUNDFLUX CARGO LLC\nMIAMI WAREHOUSE, FL 33166",
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
            forwardingAgent: "BOUNDFLUX CARGO LLC\nMIAMI WAREHOUSE, FL 33166",
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
    }

    let needsSync = false;
    loadedDb.shippers = (loadedDb.shippers || []).map(s => {
      let changed = false;
      if (!s.plants) { s.plants = []; changed = true; }
      if (changed) { needsSync = true; }
      return s;
    });
    loadedDb.consignees = (loadedDb.consignees || []).map(c => {
      let changed = false;
      if (!c.plants) { c.plants = []; changed = true; }
      if (changed) { needsSync = true; }
      return c;
    });

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
        // Backfill enabledModules for tenants created before module-based licensing
        // existed. Core modules (freight_forwarding, warehouse) are what BoundFlux
        // already did for every tenant, so that's a safe default — it doesn't grant
        // any add-on module (three_pl, pickup_delivery, vehicle_inventory, accounting)
        // that the tenant hasn't actually licensed.
        if (!Array.isArray(t.enabledModules)) {
          t.enabledModules = ["freight_forwarding", "warehouse"];
          changed = true;
        }
        if (t.licenseExpiresAt === undefined) {
          t.licenseExpiresAt = null;
          changed = true;
        }
        if (changed) { needsSync = true; }
        return t;
      });
    }

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

    const hasCnxArmando = loadedDb.users.some(u => u.email.toLowerCase() === "cnxarmando@gmail.com");
    if (!hasCnxArmando) {
      loadedDb.users.push({
        uid: "cnxarmando-admin",
        tenantId: null,
        email: "cnxarmando@gmail.com",
        tenantRole: null,
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
      
      const userTenant = loadedDb.tenants?.find(t => t.tenantId === u.tenantId);
      if (userTenant && userTenant.domain && userTenant.domain.toLowerCase() === emailLower) {
        if (u.tenantRole !== "owner") {
          u.tenantRole = "owner";
          changed = true;
        }
      }

      if (isSuper) {
        if (u.tenantRole !== null) { u.tenantRole = null; changed = true; }
        if (u.tenantId !== null && u.tenantId !== undefined) { u.tenantId = null; changed = true; }
        if (u.platformRole !== "superadmin") { u.platformRole = "superadmin"; changed = true; }
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
      
      if (u.password === "password123") {
        u.password = "";
        changed = true;
      }

      if (u.role !== undefined) {
        delete u.role;
        changed = true;
      }
      
      if (changed) { needsSync = true; }
      return u;
    });

    const activeTenantIds = new Set((loadedDb.tenants || []).map((t: any) => t.tenantId));
    const userCountBefore = loadedDb.users.length;
    loadedDb.users = loadedDb.users.filter((u: any) => {
      if (u.platformRole === "superadmin") return true;
      return u.tenantId && activeTenantIds.has(u.tenantId);
    });
    if (loadedDb.users.length !== userCountBefore) {
      needsSync = true;
    }

    if (needsSync) {
      isNew = true;
    }

    loadedDb.isInitialized = true;

    Object.assign(dbInMemory, loadedDb);
    lastDbInMemory = JSON.parse(JSON.stringify(loadedDb));

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
    return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }
  if (claimedMime === "image/png") {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  }
  if (claimedMime === "image/webp") {
    if (buffer.length < 12) return false;
    const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
    const isWebp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    return isRiff && isWebp;
  }
  if (claimedMime === "application/pdf") {
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }
  return false;
}

export function saveBase64Image(base64Str: string): string {
  if (base64Str && (base64Str.startsWith("data:image") || base64Str.startsWith("data:application/pdf"))) {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const mimeType = matches[1];
      
      const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!allowedMimeTypes.includes(mimeType)) {
        console.warn(`Rejected upload: MIME-type "${mimeType}" is not allowed.`);
        return "";
      }
      
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, "base64");
      
      const MAX_SIZE = 5 * 1024 * 1024;
      if (buffer.length > MAX_SIZE) {
        console.warn(`Rejected upload: file size ${buffer.length} bytes exceeds 5MB limit.`);
        return "";
      }

      if (!verifyBufferMagicBytes(buffer, mimeType)) {
        console.warn(`Rejected upload: Real media type does not match claimed MIME-type "${mimeType}".`);
        return "";
      }

      const uuid = crypto.randomUUID();
      let fileExtension = "jpg";
      if (mimeType === "image/png") fileExtension = "png";
      else if (mimeType === "image/webp") fileExtension = "webp";
      else if (mimeType === "application/pdf") fileExtension = "pdf";

      const filename = `receipt-${uuid}.${fileExtension}`;
      
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
      return base64Str.replace(/\.\./g, "");
    }
    return base64Str;
  }
  return "";
}

// Copy mock asset files to uploads folder on start so sample items look realistic
const sampleLabelPath = path.join(UPLOADS_DIR, "sample_label.jpg");
const sampleBoxPath = path.join(UPLOADS_DIR, "sample_box.jpg");
if (!fs.existsSync(sampleLabelPath)) {
  fs.writeFileSync(sampleLabelPath, "MOCK_LABEL_IMAGE");
}
if (!fs.existsSync(sampleBoxPath)) {
  fs.writeFileSync(sampleBoxPath, "MOCK_BOX_IMAGE");
}

export function runLocalCleanup() {
  const currentDB = loadDB();
  let modified = false;

  currentDB.receipts = currentDB.receipts.map(receipt => {
    const tenant = currentDB.tenants?.find(t => t.tenantId === receipt.tenantId);
    const retentionDays = tenant?.retentionDays ?? 180;
    const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const createdTime = new Date(receipt.createdAt).getTime();
    
    if (createdTime < cutoffMs) {
      if (receipt.photoUrl && receipt.photoUrl !== "CLEANED_UP" && receipt.photoUrl !== "ARCHIVED" && receipt.photoUrl.startsWith("/uploads/")) {
        const fileName = receipt.photoUrl.replace("/uploads/", "");
        const filePath = path.join(UPLOADS_DIR, fileName);
        if (fs.existsSync(filePath) && fileName !== "sample_label.jpg" && fileName !== "sample_box.jpg") {
          try {
            const ARCHIVE_DIR = path.join(UPLOADS_DIR, "archive");
            if (!fs.existsSync(ARCHIVE_DIR)) {
              fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
            }
            const fileData = fs.readFileSync(filePath);
            const compressed = zlib.gzipSync(fileData);
            fs.writeFileSync(path.join(ARCHIVE_DIR, `${fileName}.gz`), compressed);
            
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
          return false;
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

  if (currentDB.tenants) {
    const tenantsLen = currentDB.tenants.length;
    currentDB.tenants = currentDB.tenants.filter(t => {
      if (t.deletedAt) {
        const deletedTime = new Date(t.deletedAt).getTime();
        if (deletedTime < cutoffDeleteMs) {
          console.log(`[CLEANUP] Autopurged soft-deleted tenant with ID: ${t.tenantId} (Deleted at: ${t.deletedAt})`);
          
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
          return false;
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
