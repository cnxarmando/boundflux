import { Shipper, Consignee, WarehouseReceipt, UserProfile, Unit } from "../types";

const API_BASE = "";

// Helper to get headers
function getHeaders(unitId?: string): HeadersInit {
  const token = localStorage.getItem("warehouse_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const selectedTenant = localStorage.getItem("superadmin_selected_tenant_id");
  if (selectedTenant) {
    headers["X-Selected-Tenant-Id"] = selectedTenant;
  }
  if (unitId) {
    headers["x-unit-id"] = unitId;
  }
  return headers as HeadersInit;
}

export const apiService = {
  // 1. Auth
  async login(email: string, password: string): Promise<UserProfile> {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Erro de login.");
    }

    const { user, token } = await res.json();
    localStorage.setItem("warehouse_token", token);
    localStorage.setItem("warehouse_user", JSON.stringify(user));
    return user;
  },

  async loginWithGoogle(email: string, name: string | null, uid: string, inviteCode?: string): Promise<UserProfile> {
    const res = await fetch(`${API_BASE}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, uid, inviteCode }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Erro ao autenticar com Google.");
    }

    const { user, token } = await res.json();
    localStorage.setItem("warehouse_token", token);
    localStorage.setItem("warehouse_user", JSON.stringify(user));
    return user;
  },

  getCurrentUser(): UserProfile | null {
    const userStr = localStorage.getItem("warehouse_user");
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  logout(): void {
    localStorage.removeItem("warehouse_token");
    localStorage.removeItem("warehouse_user");
  },

  // 2. Shippers
  async getShippers(): Promise<Shipper[]> {
    const res = await fetch(`${API_BASE}/api/shippers`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Falha ao carregar Shippers");
    return res.json();
  },

  async addShipper(name: string, email?: string, phone?: string, address?: string, plants?: any[]): Promise<Shipper> {
    const res = await fetch(`${API_BASE}/api/shippers`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ name, email, phone, address, plants }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Falha ao adicionar Shipper");
    }
    return res.json();
  },

  async updateShipper(id: string, data: Partial<Shipper>): Promise<Shipper> {
    const res = await fetch(`${API_BASE}/api/shippers/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Falha ao atualizar Shipper");
    }
    return res.json();
  },

  async deleteShipper(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/shippers/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Falha ao excluir Shipper");
    }
    return res.json();
  },

  // 3. Consignees
  async getConsignees(): Promise<Consignee[]> {
    const res = await fetch(`${API_BASE}/api/consignees`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Falha ao carregar Consignees");
    return res.json();
  },

  async addConsignee(name: string, email?: string, phone?: string, address?: string, plants?: any[]): Promise<Consignee> {
    const res = await fetch(`${API_BASE}/api/consignees`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ name, email, phone, address, plants }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Falha ao adicionar Consignee");
    }
    return res.json();
  },

  async updateConsignee(id: string, data: Partial<Consignee>): Promise<Consignee> {
    const res = await fetch(`${API_BASE}/api/consignees/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Falha ao atualizar Consignee");
    }
    return res.json();
  },

  async deleteConsignee(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/consignees/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Falha ao excluir Consignee");
    }
    return res.json();
  },

  // 4. Warehouse Receipts
  async getReceipts(unitId?: string): Promise<WarehouseReceipt[]> {
    const res = await fetch(`${API_BASE}/api/receipts`, {
      headers: getHeaders(unitId),
    });
    if (!res.ok) throw new Error("Falha ao carregar Warehouse Receipts");
    return res.json();
  },

  async createReceipt(data: any): Promise<WarehouseReceipt> {
    const res = await fetch(`${API_BASE}/api/receipts`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Falha ao registrar recebimento");
    }
    return res.json();
  },

  async updateReceipt(id: string, data: any): Promise<WarehouseReceipt> {
    const res = await fetch(`${API_BASE}/api/receipts/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Falha ao atualizar recebimento");
    }
    return res.json();
  },

  async deleteReceipt(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/receipts/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Falha ao excluir recebimento");
    }
    return res.json();
  },

  async restoreReceipt(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/receipts/${id}/restore`, {
      method: "POST",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Falha ao restaurar recebimento");
    }
    return res.json();
  },

  // 5. Gemini OCR Tracking Extraction
  async extractTrackingNumber(photoBase64: string): Promise<string> {
    const res = await fetch(`${API_BASE}/api/gemini/extract-tracking`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ photoBase64 }),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Falha ao analisar a imagem por IA");
    }
    const data = await res.json();
    return data.trackingNumber || "";
  },

  // 6. Gemini Smart Receipt Parsing OCR
  async extractReceiptFields(photoBase64: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/gemini/extract-receipt-fields`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ photoBase64 }),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Falha ao analisar inteligente por IA");
    }
    return res.json();
  },

  // 7. Bills of Lading (BL)
  async getBLs(unitId?: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/api/bls`, {
      headers: getHeaders(unitId),
    });
    if (!res.ok) throw new Error("Falha ao carregar Bills of Lading (BL)");
    return res.json();
  },

  async createBL(data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/api/bls`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Falha ao criar Bill of Lading (BL)");
    }
    return res.json();
  },

  async updateBL(id: string, data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/api/bls/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Falha ao atualizar Bill of Lading (BL)");
    }
    return res.json();
  },

  async deleteBL(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/bls/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Falha ao excluir Bill of Lading (BL)");
    }
    return res.json();
  },

  // 8. B2B Multi-tenancy & SaaS Administration
  async getTenants(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/api/admin/tenants`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Falha ao carregar empresas parceiras");
    return res.json();
  },

  async getAuditLogs(resource?: string, resourceId?: string): Promise<any[]> {
    let url = `${API_BASE}/api/audit-logs`;
    const params = new URLSearchParams();
    if (resource) params.append("resource", resource);
    if (resourceId) params.append("resourceId", resourceId);
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetch(url, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Falha ao carregar logs de auditoria");
    return res.json();
  },

  async getMetrics(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/admin/metrics`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Falha ao carregar métricas globais");
    return res.json();
  },

  async createTenant(data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/api/admin/tenants`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Falha ao cadastrar nova empresa");
    }
    return res.json();
  },

  async updateTenant(tenantId: string, data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/api/admin/tenants/${tenantId}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Falha ao atualizar dados da empresa");
    }
    return res.json();
  },

  async deleteTenant(tenantId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/admin/tenants/${tenantId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Falha ao excluir empresa");
    }
    return res.json();
  },

  async restoreTenant(tenantId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/admin/tenants/${tenantId}/restore`, {
      method: "POST",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Falha ao restaurar empresa");
    }
    return res.json();
  },

  async downloadTenantBackup(tenantId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/admin/tenants/${tenantId}/download-backup`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Falha ao baixar backup da empresa");
    }
    return res.json();
  },

  async getCurrentTenant(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/tenant/current`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Falha ao carregar dados da empresa atual");
    return res.json();
  },

  // 9. Invitations & Team Management
  async getInvitations(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/api/invitations`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Falha ao carregar convites de equipe");
    return res.json();
  },

  async createInvitation(email: string, role: string, tenantId?: string, assignedUnitId?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/invitations`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ email, tenantRole: role, tenantId, assignedUnitId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Falha ao gerar convite");
    }
    return res.json();
  },

  async deleteInvitation(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/invitations/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Falha ao cancelar convite");
    }
    return res.json();
  },

  async updateInvitation(id: string, data: { email?: string; tenantRole?: string; role?: string; assignedUnitId?: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/api/invitations/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify({
        email: data.email,
        tenantRole: data.tenantRole || data.role,
        assignedUnitId: data.assignedUnitId
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Falha ao editar convite");
    }
    return res.json();
  },

  async getCompanyUsers(): Promise<UserProfile[]> {
    const res = await fetch(`${API_BASE}/api/users`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Falha ao carregar usuários da empresa");
    return res.json();
  },

  async deleteCompanyUser(uid: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/users/${uid}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Falha ao remover usuário");
    }
    return res.json();
  },

  async updateCompanyUser(uid: string, data: { email?: string; name?: string; tenantRole?: string; assignedUnitId?: string | null }): Promise<any> {
    const res = await fetch(`${API_BASE}/api/users/${uid}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Falha ao atualizar dados do usuário");
    }
    return res.json();
  },

  async getPublicInvitation(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/invitations/public/${id}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Convite inválido ou expirado");
    }
    return res.json();
  },

  // Trash & Restore Operations
  async getTrash(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/trash`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Falha ao carregar itens excluídos (lixeira)");
    return res.json();
  },

  async restoreResource(resource: string, id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/${resource}/${id}/restore`, {
      method: "POST",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || `Falha ao restaurar ${resource}`);
    }
    return res.json();
  },

  async purgeResource(resource: string, id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/admin/${resource}/${id}/purge`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || `Falha ao purgar ${resource}`);
    }
    return res.json();
  },

  // 10. Units Management
  async getUnits(): Promise<Unit[]> {
    const res = await fetch(`${API_BASE}/api/units`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Falha ao carregar unidades");
    return res.json();
  },

  async addUnit(data: { name: string; region: "US" | "EU"; theme: { primary: string; accent: string } }): Promise<Unit> {
    const res = await fetch(`${API_BASE}/api/units`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Falha ao adicionar unidade");
    }
    return res.json();
  },

  async updateUnit(id: string, data: Partial<Unit>): Promise<Unit> {
    const res = await fetch(`${API_BASE}/api/units/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Falha ao atualizar unidade");
    }
    return res.json();
  },

  async deleteUnit(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/units/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Falha ao excluir unidade");
    }
    return res.json();
  },

  async getAdminInvitations(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/api/admin/invitations`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Falha ao carregar convites do sistema");
    return res.json();
  },

  async getAdminUsers(): Promise<UserProfile[]> {
    const res = await fetch(`${API_BASE}/api/admin/users`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Falha ao carregar usuários do sistema");
    return res.json();
  },
};