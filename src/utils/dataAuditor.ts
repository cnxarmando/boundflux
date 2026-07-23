import { Unit, WarehouseReceipt, BillOfLading, Shipper, Consignee } from "../types";

export interface OmittedRecordInfo {
  id: string;
  label: string; // e.g. "WR-10002" or "Shipper Acme Corp"
  reasons: string[]; // List of human-readable Portuguese explanations
  rawRecord: any;
}

export interface AuditReport {
  entityName: string;
  totalInDatabase: number;
  totalRendered: number;
  totalOmitted: number;
  omittedList: OmittedRecordInfo[];
  unitMatchCount: number;
  deletedCount: number;
  tabFilteredCount: number;
  searchFilteredCount: number;
  otherFilteredCount: number;
}

/**
 * Standardized Unit Matching logic across the entire platform.
 * Guarantees no record is falsely hidden due to legacy or custom unit key formats.
 */
export function normalizeUnitMatch(
  entityUnit: string | undefined | null,
  activeUnitId: string,
  availableUnits: Unit[]
): boolean {
  // If activeUnit is empty or 'all', match everything
  if (!activeUnitId || activeUnitId === 'all') return true;

  // Normalize string comparisons
  const eUnit = (entityUnit || "US").trim();
  const currentUnitObj = availableUnits.find(u => u.id === activeUnitId);

  // Exact ID match
  if (eUnit === activeUnitId) return true;

  // If matched by unit object name or region
  if (currentUnitObj) {
    if (eUnit === currentUnitObj.name) return true;
    if (eUnit === currentUnitObj.region) return true;
    
    // US / Imperial fallback alignment
    if ((eUnit === "US" || eUnit === "Orlando") && (currentUnitObj.region === "US" || currentUnitObj.unitSystem === "imperial" || currentUnitObj.name.toLowerCase().includes("orlando"))) {
      return true;
    }

    // EU / Europe / Metric fallback alignment
    if ((eUnit === "Europe" || eUnit === "EU") && (currentUnitObj.region === "EU" || currentUnitObj.unitSystem === "metric")) {
      return true;
    }
  }

  // Default fallback if activeUnit is US/Orlando default key
  if (activeUnitId === "US" || activeUnitId.startsWith("u-orlando")) {
    if (eUnit === "US" || eUnit === "Orlando" || eUnit.startsWith("u-orlando")) return true;
  }

  // If there's only 1 active unit configured in the tenant, show all receipts for this tenant
  const activeUnitsInTenant = availableUnits.filter(u => u.isActive && !u.deletedAt);
  if (activeUnitsInTenant.length <= 1) {
    return true;
  }

  return false;
}

export interface AuditContext {
  entityName: string;
  activeUnitId: string;
  availableUnits: Unit[];
  activeTab?: string; // e.g. 'estoque', 'historico', 'reciclados', 'active', 'shipped'
  searchQuery?: string;
  consigneeFilter?: string;
  statusFilter?: string;
}

/**
 * Audits why records existing in the DB are or are not rendered on the current screen.
 */
export function auditRenderedData<T extends { id: string; deletedAt?: string | null }>(
  allDbRecords: T[],
  renderedRecords: T[],
  context: AuditContext
): AuditReport {
  const renderedSet = new Set(renderedRecords.map(r => r.id));
  const omittedList: OmittedRecordInfo[] = [];

  let unitMatchCount = 0;
  let deletedCount = 0;
  let tabFilteredCount = 0;
  let searchFilteredCount = 0;
  let otherFilteredCount = 0;

  for (const record of allDbRecords) {
    const isRendered = renderedSet.has(record.id);

    // Extract label
    const rec = record as any;
    const label = rec.number || rec.blNumber || rec.name || rec.id || "Registro sem nome";

    if (isRendered) {
      unitMatchCount++;
      continue;
    }

    // If not rendered, analyze exact reasons
    const reasons: string[] = [];

    // 1. Soft deleted
    if (record.deletedAt) {
      reasons.push("Item marcado como excluído (soft-delete)");
      deletedCount++;
    }

    // 2. Unit mismatch
    const recordUnit = rec.unit || "US";
    const matchesUnit = normalizeUnitMatch(recordUnit, context.activeUnitId, context.availableUnits);
    if (!matchesUnit) {
      const activeUnitObj = context.availableUnits.find(u => u.id === context.activeUnitId);
      const activeUnitName = activeUnitObj ? activeUnitObj.name : context.activeUnitId;
      reasons.push(`Cadastrado na unidade '${recordUnit}', mas a unidade ativa selecionada no topo é '${activeUnitName}'`);
    }

    // 3. Tab / Status mismatch
    if (context.activeTab && rec.status) {
      const status = rec.status;
      if (context.activeTab === "estoque" && status !== "RECEBIDO" && status !== undefined) {
        reasons.push(`Status é '${status}' — exibido na aba '${status === "DESPACHADO" ? "Histórico de Despachos" : status === "RECICLADO" ? "Reciclados" : "Estoque"}'`);
        tabFilteredCount++;
      } else if (context.activeTab === "historico" && status !== "DESPACHADO") {
        reasons.push(`Status é '${status}' (só exibe 'DESPACHADO' nesta aba de Histórico)`);
        tabFilteredCount++;
      } else if (context.activeTab === "reciclados" && status !== "RECICLADO") {
        reasons.push(`Status é '${status}' (só exibe 'RECICLADO' nesta aba)`);
        tabFilteredCount++;
      }
    }

    // 4. Search query mismatch
    if (context.searchQuery && context.searchQuery.trim() !== "") {
      const q = context.searchQuery.toLowerCase();
      const matchText = [
        rec.number, rec.blNumber, rec.shipperName, rec.consigneeName,
        rec.trackingNumber, rec.proNumbers, rec.name, rec.email
      ].filter(Boolean).join(" ").toLowerCase();

      if (!matchText.includes(q)) {
        reasons.push(`Oculto pelo termo de busca atual '${context.searchQuery}'`);
        searchFilteredCount++;
      }
    }

    // 5. Consignee Filter mismatch
    if (context.consigneeFilter && context.consigneeFilter !== "" && rec.consigneeId && rec.consigneeId !== context.consigneeFilter) {
      reasons.push("Oculto pelo filtro de Consignatário específico ativado");
      otherFilteredCount++;
    }

    // 6. Status/KPI filter mismatch
    if (context.statusFilter && context.statusFilter !== "all" && context.statusFilter !== "in_stock") {
      if (context.statusFilter === "pending_inspection") {
        const hasNoPhoto = !rec.photoUrl && (!rec.photoUrls || rec.photoUrls.length === 0);
        const hasNoItems = !rec.items || rec.items.length === 0;
        if (!hasNoPhoto && !hasNoItems) {
          reasons.push("Oculto pelo filtro KPI 'Pendente de Inspeção' (este item já possui fotos/itens cadastrados)");
          otherFilteredCount++;
        }
      } else if (context.statusFilter === "missing_tracking") {
        if (rec.trackingNumber || rec.proNumbers) {
          reasons.push("Oculto pelo filtro KPI 'Sem Tracking' (este item já possui número de rastreio)");
          otherFilteredCount++;
        }
      }
    }

    if (reasons.length === 0) {
      reasons.push("Oculto por divergência de chaves de modelo ou regra de filtro secundária");
      otherFilteredCount++;
    }

    omittedList.push({
      id: record.id,
      label,
      reasons,
      rawRecord: record
    });
  }

  return {
    entityName: context.entityName,
    totalInDatabase: allDbRecords.length,
    totalRendered: renderedRecords.length,
    totalOmitted: omittedList.length,
    omittedList,
    unitMatchCount,
    deletedCount,
    tabFilteredCount,
    searchFilteredCount,
    otherFilteredCount
  };
}

/**
 * Checks key structure health of a dataset from the database.
 */
export function auditDatabaseKeys(collectionName: string, items: any[]): {
  totalItems: number;
  keyHealthPercent: number;
  missingKeysSummary: Record<string, number>;
  issues: string[];
} {
  if (!items || items.length === 0) {
    return { totalItems: 0, keyHealthPercent: 100, missingKeysSummary: {}, issues: [] };
  }

  const issues: string[] = [];
  const missingKeysSummary: Record<string, number> = {};

  const expectedKeysMap: Record<string, string[]> = {
    receipts: ['id', 'number', 'shipperName', 'consigneeName', 'dateIn', 'items', 'status'],
    billsOfLading: ['id', 'blNumber', 'date', 'exporter', 'consignee', 'freightCharges'],
    shippers: ['id', 'name', 'createdAt'],
    consignees: ['id', 'name', 'createdAt'],
    units: ['id', 'name', 'region', 'unitSystem', 'isActive']
  };

  const expected = expectedKeysMap[collectionName] || ['id'];
  let validKeysCount = 0;
  let totalKeysChecked = 0;

  items.forEach((item, idx) => {
    expected.forEach(key => {
      totalKeysChecked++;
      if (item[key] !== undefined && item[key] !== null && item[key] !== "") {
        validKeysCount++;
      } else {
        missingKeysSummary[key] = (missingKeysSummary[key] || 0) + 1;
        if (issues.length < 5) {
          issues.push(`Item #${idx + 1} (${item.id || item.number || 'sem id'}) sem a chave '${key}'`);
        }
      }
    });
  });

  const keyHealthPercent = Math.round((validKeysCount / Math.max(1, totalKeysChecked)) * 100);

  return {
    totalItems: items.length,
    keyHealthPercent,
    missingKeysSummary,
    issues
  };
}
