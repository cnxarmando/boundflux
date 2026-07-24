import { Router } from "express";
import { loadDB, saveDB } from "../db";
import { authMiddleware, requireTenantRole, AuthenticatedRequest } from "../middleware";

export const shippingRouter = Router();

// 1. SHIPPERS
shippingRouter.get("/shippers", authMiddleware, (req: AuthenticatedRequest, res) => {
  const currentDB = loadDB();
  const filtered = currentDB.shippers.filter(s => s.tenantId === req.tenantId && !s.deletedAt);
  res.json(filtered);
});

shippingRouter.post("/shippers", authMiddleware, (req: AuthenticatedRequest, res) => {
  const { name, email, phone, address, plants } = req.body;
  if (!name) {
    res.status(400).json({ error: "O nome do Shipper é obrigatório." });
    return;
  }
  
  const currentDB = loadDB();
  const newShipper = {
    id: `s-${Date.now()}`,
    tenantId: req.tenantId,
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

shippingRouter.put("/shippers/:id", authMiddleware, (req: AuthenticatedRequest, res) => {
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

// 2. CONSIGNEES
shippingRouter.get("/consignees", authMiddleware, (req: AuthenticatedRequest, res) => {
  const currentDB = loadDB();
  const filtered = currentDB.consignees.filter(c => c.tenantId === req.tenantId && !c.deletedAt);
  res.json(filtered);
});

shippingRouter.post("/consignees", authMiddleware, (req: AuthenticatedRequest, res) => {
  const { name, email, phone, address, plants } = req.body;
  if (!name) {
    res.status(400).json({ error: "O nome do Consignee é obrigatório." });
    return;
  }
  
  const currentDB = loadDB();
  const newConsignee = {
    id: `c-${Date.now()}`,
    tenantId: req.tenantId,
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

shippingRouter.put("/consignees/:id", authMiddleware, (req: AuthenticatedRequest, res) => {
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

// 3. UNITS
shippingRouter.get("/units", authMiddleware, (req: AuthenticatedRequest, res) => {
  const currentDB = loadDB();
  if (!currentDB.units) currentDB.units = [];
  const filtered = currentDB.units.filter((u: any) => u.tenantId === req.tenantId && !u.deletedAt);
  res.json(filtered);
});

shippingRouter.post("/units", authMiddleware, requireTenantRole(["owner"]), (req: AuthenticatedRequest, res) => {
  const {
    name, region, theme, unitSystem,
    forwardingAgentName, forwardingAgentAddress, defaultPointOfOrigin,
    defaultPlaceOfReceipt, defaultPortOfLoading, defaultForeignPortOfUnloading,
    defaultPlaceOfDelivery, defaultLoadingPier, defaultExportingCarrier, blNumberPrefix
  } = req.body;
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
    forwardingAgentName: forwardingAgentName || undefined,
    forwardingAgentAddress: forwardingAgentAddress || undefined,
    defaultPointOfOrigin: defaultPointOfOrigin || undefined,
    defaultPlaceOfReceipt: defaultPlaceOfReceipt || undefined,
    defaultPortOfLoading: defaultPortOfLoading || undefined,
    defaultForeignPortOfUnloading: defaultForeignPortOfUnloading || undefined,
    defaultPlaceOfDelivery: defaultPlaceOfDelivery || undefined,
    defaultLoadingPier: defaultLoadingPier || undefined,
    defaultExportingCarrier: defaultExportingCarrier || undefined,
    blNumberPrefix: blNumberPrefix || undefined,
    createdAt: new Date().toISOString(),
    isActive: true
  };

  currentDB.units.unshift(newUnit);
  saveDB(currentDB);
  res.status(201).json(newUnit);
});

shippingRouter.put("/units/:id", authMiddleware, requireTenantRole(["owner"]), (req: AuthenticatedRequest, res) => {
  const {
    name, region, theme, unitSystem, isActive,
    forwardingAgentName, forwardingAgentAddress, defaultPointOfOrigin,
    defaultPlaceOfReceipt, defaultPortOfLoading, defaultForeignPortOfUnloading,
    defaultPlaceOfDelivery, defaultLoadingPier, defaultExportingCarrier, blNumberPrefix
  } = req.body;
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
  if (forwardingAgentName !== undefined) unit.forwardingAgentName = forwardingAgentName;
  if (forwardingAgentAddress !== undefined) unit.forwardingAgentAddress = forwardingAgentAddress;
  if (defaultPointOfOrigin !== undefined) unit.defaultPointOfOrigin = defaultPointOfOrigin;
  if (defaultPlaceOfReceipt !== undefined) unit.defaultPlaceOfReceipt = defaultPlaceOfReceipt;
  if (defaultPortOfLoading !== undefined) unit.defaultPortOfLoading = defaultPortOfLoading;
  if (defaultForeignPortOfUnloading !== undefined) unit.defaultForeignPortOfUnloading = defaultForeignPortOfUnloading;
  if (defaultPlaceOfDelivery !== undefined) unit.defaultPlaceOfDelivery = defaultPlaceOfDelivery;
  if (defaultLoadingPier !== undefined) unit.defaultLoadingPier = defaultLoadingPier;
  if (defaultExportingCarrier !== undefined) unit.defaultExportingCarrier = defaultExportingCarrier;
  if (blNumberPrefix !== undefined) unit.blNumberPrefix = blNumberPrefix;

  saveDB(currentDB);
  res.json(unit);
});

shippingRouter.delete("/units/:id", authMiddleware, requireTenantRole(["owner"]), (req: AuthenticatedRequest, res) => {
  const currentDB = loadDB();
  if (!currentDB.units) currentDB.units = [];
  
  const unit = currentDB.units.find((u: any) => u.id === req.params.id && u.tenantId === req.tenantId);
  if (!unit) {
    res.status(404).json({ error: "Unidade não encontrada." });
    return;
  }

  unit.deletedAt = new Date().toISOString();
  saveDB(currentDB);
  res.json({ success: true });
});
