export interface Plant {
  id: string;
  name: string;      // E.g. "Filial Itajaí-SC", "Planta Extrema-MG"
  address: string;
  phone?: string;
  email?: string;
}

export interface Shipper {
  id: string;
  tenantId?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: string;
  plants?: Plant[];
  deletedAt?: string | null;
  deletedBy?: string;
}

export interface Consignee {
  id: string;
  tenantId?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: string;
  plants?: Plant[];
  deletedAt?: string | null;
  deletedBy?: string;
}

export interface ReceiptItem {
  qty: number;
  type: string; // e.g. BOX, PALLET, CRATE
  len: number; // inches
  wid: number; // inches
  hgt: number; // inches
  weight: number;
  unit: 'Lbs' | 'Kgs';
  cubic: number; // calculated volume
  cubicUnit: 'Cft' | 'Cbm';
  bin?: string;
  location?: string;
  cargoCondition?: string;
}

export interface PoInvoiceRow {
  poNumber: string;
  invoiceNumber: string;
  amount: string;
}

export interface WarehouseReceipt {
  id: string;
  number: string; // e.g. WR-11986
  shipperId: string;
  shipperName: string;
  shipperAddress?: string;
  shipperPhone?: string;
  consigneeId: string;
  consigneeName: string;
  consigneeAddress?: string;
  consigneePhone?: string;
  
  // Handling Checklist
  handling: string[]; // e.g. ["Commercial Invoice", "Pkg List", "Fragile"]
  
  // Additional Information
  dateIn: string;
  expires?: string;
  location?: string;
  via?: string; // e.g. AIR, OCEAN, TRUCK
  service?: string;
  carrier?: string;
  origin?: string; // e.g. MIA
  dest?: string;
  
  // References
  poInvoices: PoInvoiceRow[];
  proNumbers: string; // Comma or space separated tracking/pro numbers
  
  // Items details
  items: ReceiptItem[];
  
  // Totals
  totalPieces: number;
  totalWeightLbs: number;
  totalWeightKgs: number;
  totalVolWeightLbs: number;
  totalVolWeightKgs: number;
  totalCubicCft: number;
  totalCubicCbm: number;
  
  // Form compatibility fallback (maintains compatibility with existing list UI)
  weight: number; // equals totalWeightLbs
  volumeCount: number; // equals totalPieces
  trackingNumber: string; // equals proNumbers

  photoUrl: string; // Firebase Storage URL or local upload URL or "CLEANED_UP"
  photoUrls?: string[]; // Array of associated photos (multiple upload support)
  comments?: string;
  cargoCondition?: string;
  createdAt: string;
  operatorEmail: string;
  unit?: string;
  unitId?: string;
  tenantId?: string;
  status?: 'RECEBIDO' | 'DESPACHADO' | 'RECICLADO';
  blId?: string | null;
  createdBy?: string;
  deletedAt?: string | null;
  deletedBy?: string;
}

export type TenantRole = 'operator' | 'admin' | 'owner';
export type PlatformRole = 'superadmin' | 'user';

export interface User {
  uid: string;
  email: string;
  tenantRole: TenantRole;
  platformRole: PlatformRole;
  name: string;
  tenantId?: string;
  assignedUnitId?: string | null;
}

export interface UserProfile extends User {}

export interface Tenant {
  tenantId: string;
  name: string;
  domain: string;
  planTier: 'Starter' | 'Pro' | 'Enterprise';
  status: 'active' | 'suspended';
  retentionDays?: number;
  deletedAt?: string | null;
  deletedBy?: string;
}

export interface BillOfLading {
  id: string;
  tenantId?: string;
  blNumber: string; // e.g., QL2848
  documentNumber: string; // e.g., 0000001601
  exportReferences: string; // e.g., FILE #0000001601
  date: string; // YYYY-MM-DD
  exporter: string; // Shipper(s) address and names block, can have multiple
  consignee: string; // Consigned to name & address block
  notifyParty: string; // Notify party name & address block
  forwardingAgent: string; // Quality Logistics address block
  pointOfOrigin: string; // Point of origin / state or FTZ number
  domesticRouting: string; // Booking etc.
  preCarriageBy?: string;
  placeOfReceipt?: string;
  exportingCarrier?: string;
  portOfLoading?: string;
  foreignPortOfUnloading?: string;
  placeOfDelivery?: string;
  loadingPier?: string;
  typeOfMove?: string;
  prepaidCollect: 'PREPAID' | 'COLLECT';
  
  // Cargo items & description
  marksAndNumbers: string; // Container & Seal No.
  numberOfPackages: number; // Sum of volumes/pieces
  descriptionOfCommodities: string; // Schedule B details, AES, etc.
  grossWeightLbs: number;
  grossWeightKgs: number;
  measurementCft: number;
  measurementCbm: number;

  // Selected receipts
  receiptIds: string[];
  receiptNumbers: string[]; // e.g. ["WR-11986", "WR-10002"]

  // Freight rates/charges
  freightCharges: string; // e.g., "OCEAN FREIGHT COLLECT" or a simplified rates description
  declaredValue?: string;
  
  createdAt: string;
  updatedAt?: string;
  unit?: string;
  originUnitId?: string;
  deletedAt?: string | null;
  deletedBy?: string;
}

export interface Invitation {
  id: string; // Token code
  email: string;
  tenantId: string;
  tenantRole: TenantRole;
  assignedUnitId?: string | null;
  invitedBy: string;
  createdAt: string;
  status: "pending" | "accepted";
  acceptedAt?: string;
  acceptedBy?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  tenantId: string;
  performedBy: string; // Email for human readability
  performedByUid?: string; // UID for immutable user traceability
  timestamp: string;
  details?: string;
}

export interface Unit {
  id: string;
  tenantId: string;
  name: string;
  region: string;
  unitSystem: 'imperial' | 'metric';
  theme: {
    primary: string;
    accent: string;
  };
  createdAt: string;
  isActive: boolean;
  deletedAt?: string | null;
  // Operational identity used to populate Bill of Lading forms and shipping labels.
  // Optional so existing units keep working without requiring immediate backfill.
  forwardingAgentName?: string;
  forwardingAgentAddress?: string;
  defaultPointOfOrigin?: string;
  defaultPlaceOfReceipt?: string;
  defaultPortOfLoading?: string;
  defaultForeignPortOfUnloading?: string;
  defaultPlaceOfDelivery?: string;
  defaultLoadingPier?: string;
  defaultExportingCarrier?: string;
  blNumberPrefix?: string;
}