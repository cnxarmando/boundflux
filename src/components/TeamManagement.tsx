import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";
import { Invitation, UserProfile, Unit } from "../types";
import { 
  MailPlus, 
  Trash2, 
  Copy, 
  Check, 
  Users, 
  Clock, 
  Shield, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Send, 
  XCircle, 
  Building2, 
  MapPin,
  ShieldCheck,
  Plus,
  Edit2,
  Globe,
  Palette,
  Layers,
  Power,
  Sliders,
  AlertCircle,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const THEME_PRESETS = [
  { name: "Ocean Indigo", primary: "#4f46e5", accent: "#06b6d4" },
  { name: "Forest Emerald", primary: "#059669", accent: "#10b981" },
  { name: "Charcoal Slate", primary: "#1e293b", accent: "#ec4899" },
  { name: "Sunset Orange", primary: "#ea580c", accent: "#eab308" },
  { name: "Royal Purple", primary: "#7c3aed", accent: "#f43f5e" },
];

interface TeamManagementProps {
  currentUser: UserProfile;
}

export default function TeamManagement({ currentUser }: TeamManagementProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [activeUsers, setActiveUsers] = useState<UserProfile[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "operator">("operator");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [lastGeneratedLink, setLastGeneratedLink] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Active Context State (Tenant & Unit)
  const [activeUnitName, setActiveUnitName] = useState<string>("US East Hub");
  const [activeUnitRegion, setActiveUnitRegion] = useState<string>("US");

  const isOwner = currentUser.tenantRole === "owner" || currentUser.platformRole === "superadmin";

  // Unit Management State
  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [unitError, setUnitError] = useState("");
  const [unitSuccess, setUnitSuccess] = useState("");
  const [isOpenUnitModal, setIsOpenUnitModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitSubmitting, setUnitSubmitting] = useState(false);

  // Form Fields
  const [unitName, setUnitName] = useState("");
  const [unitRegion, setUnitRegion] = useState("América");
  const [unitSystem, setUnitSystem] = useState<"imperial" | "metric">("imperial");
  const [unitPrimaryColor, setUnitPrimaryColor] = useState("#4f46e5");
  const [unitAccentColor, setUnitAccentColor] = useState("#06b6d4");
  const [unitIsActive, setUnitIsActive] = useState(true);

  // Edit User & Invite Inline States
  const [assignedUnitId, setAssignedUnitId] = useState<string>("");
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserName, setEditUserName] = useState("");
  const [editUserRole, setEditUserRole] = useState<string>("operator");
  const [editUserAssignedUnitId, setEditUserAssignedUnitId] = useState<string>("");

  const [editingInvite, setEditingInvite] = useState<Invitation | null>(null);
  const [editInviteEmail, setEditInviteEmail] = useState("");
  const [editInviteRole, setEditInviteRole] = useState<string>("operator");
  const [editInviteAssignedUnitId, setEditInviteAssignedUnitId] = useState<string>("");

  const fetchUnits = async () => {
    setLoadingUnits(true);
    setUnitError("");
    try {
      const data = await apiService.getUnits();
      setUnits(data);
    } catch (err: any) {
      setUnitError("Erro ao carregar as unidades.");
    } finally {
      setLoadingUnits(false);
    }
  };

  const handleOpenCreateUnit = () => {
    setEditingUnit(null);
    setUnitName("");
    setUnitRegion("América");
    setUnitSystem("imperial");
    setUnitPrimaryColor("#4f46e5");
    setUnitAccentColor("#06b6d4");
    setUnitIsActive(true);
    setUnitError("");
    setUnitSuccess("");
    setIsOpenUnitModal(true);
  };

  const handleOpenEditUnit = (unit: Unit) => {
    setEditingUnit(unit);
    setUnitName(unit.name);
    setUnitRegion(unit.region || "América");
    setUnitSystem(unit.unitSystem || "imperial");
    setUnitPrimaryColor(unit.theme.primary);
    setUnitAccentColor(unit.theme.accent);
    setUnitIsActive(unit.isActive !== false);
    setUnitError("");
    setUnitSuccess("");
    setIsOpenUnitModal(true);
  };

  const handleUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitName.trim()) {
      setUnitError("O nome da unidade é obrigatório.");
      return;
    }

    try {
      setUnitSubmitting(true);
      setUnitError("");
      setUnitSuccess("");

      const payload = {
        name: unitName.trim(),
        region: unitRegion.trim(),
        unitSystem,
        theme: {
          primary: unitPrimaryColor,
          accent: unitAccentColor,
        },
        isActive: unitIsActive,
      };

      if (editingUnit) {
        await apiService.updateUnit(editingUnit.id, payload as any);
        setUnitSuccess("Unidade atualizada com sucesso!");
      } else {
        await apiService.addUnit(payload as any);
        setUnitSuccess("Unidade cadastrada com sucesso!");
      }

      await fetchUnits();
      setTimeout(() => setIsOpenUnitModal(false), 800);
    } catch (err: any) {
      setUnitError(err.message || "Erro ao salvar a unidade.");
    } finally {
      setUnitSubmitting(false);
    }
  };

  const handleToggleUnitActive = async (unit: Unit) => {
    try {
      setUnitError("");
      const newStatus = !unit.isActive;
      await apiService.updateUnit(unit.id, { isActive: newStatus });
      setUnitSuccess(`Unidade ${unit.name} foi ${newStatus ? "ativada" : "desativada"} com sucesso!`);
      await fetchUnits();
      setTimeout(() => setUnitSuccess(""), 3000);
    } catch (err: any) {
      setUnitError(err.message || "Erro ao alterar status da unidade.");
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [invitesData, usersData] = await Promise.all([
        apiService.getInvitations(),
        apiService.getCompanyUsers()
      ]);
      
      setInvitations(invitesData);

      // Deduplicate active users list by UID and Email
      const uniqueUsers: UserProfile[] = [];
      const seenUids = new Set<string>();
      const seenEmails = new Set<string>();

      for (const u of usersData) {
        if (!u.uid || !u.email) continue;
        const emailLower = u.email.toLowerCase();
        if (!seenUids.has(u.uid) && !seenEmails.has(emailLower)) {
          seenUids.add(u.uid);
          seenEmails.add(emailLower);
          uniqueUsers.push(u);
        }
      }
      setActiveUsers(uniqueUsers);
      if (isOwner) {
        fetchUnits();
      }
    } catch (err: any) {
      setError(err.message || "Erro ao carregar dados da equipe.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Load active unit from database and localStorage
    const savedUnitId = localStorage.getItem("active_unit") || "US";
    apiService.getUnits()
      .then(units => {
        const found = units.find(u => u.id === savedUnitId) || units[0];
        if (found) {
          setActiveUnitName(found.name);
          setActiveUnitRegion(found.region);
        } else {
          setActiveUnitName("Orlando Warehouse");
          setActiveUnitRegion("US");
        }
      })
      .catch(() => {
        setActiveUnitName("Orlando Warehouse");
        setActiveUnitRegion("US");
      });
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;
    if (!email) return;

    setSubmitting(true);
    setError("");
    setSuccessMsg("");
    setLastGeneratedLink("");

    try {
      const newInvite = await apiService.createInvitation(email.trim(), role, undefined, assignedUnitId || undefined);
      setSuccessMsg(`Convite gerado com sucesso para ${email.trim()}!`);
      
      const inviteUrl = `${window.location.origin}/?invite=${newInvite.id}`;
      setLastGeneratedLink(inviteUrl);
      
      setEmail("");
      setRole("operator");
      setAssignedUnitId("");
      fetchData();
    } catch (err: any) {
      setError(err.message || "Erro ao criar convite.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!isOwner) return;
    if (!confirm("Tem certeza que deseja cancelar e revogar este convite?")) return;

    try {
      await apiService.deleteInvitation(id);
      setInvitations(prev => prev.filter(i => i.id !== id));
      setSuccessMsg("Convite revogado com sucesso!");
    } catch (err: any) {
      setError(err.message || "Erro ao revogar convite.");
    }
  };

  const handleRemoveUser = async (uid: string, userEmail: string) => {
    if (!isOwner) return;
    if (!confirm(`Tem certeza que deseja revogar o acesso e remover o usuário "${userEmail}" da empresa? Esta ação é imediata.`)) {
      return;
    }

    try {
      await apiService.deleteCompanyUser(uid);
      setSuccessMsg(`Acesso de ${userEmail} revogado com sucesso!`);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Erro ao remover usuário.");
    }
  };

  const handleUpdateUser = async (uid: string, currentRole: string) => {
    if (!isOwner) return;
    const isCurrentlyOwner = currentRole === "owner";
    const isSettingToOwner = editUserRole === "owner";

    if (isCurrentlyOwner || isSettingToOwner) {
      if (!editUserEmail || !editUserEmail.trim()) {
        setError("O e-mail do dono da empresa nunca pode ficar em branco, ele só pode ser trocado.");
        return;
      }
    }

    if (!editUserEmail.trim()) {
      setError("O e-mail do usuário não pode ficar em branco.");
      return;
    }

    try {
      setError("");
      setSuccessMsg("");
      await apiService.updateCompanyUser(uid, {
        email: editUserEmail.trim(),
        name: editUserName.trim(),
        tenantRole: editUserRole,
        assignedUnitId: editUserAssignedUnitId || null,
      });
      setSuccessMsg("Dados do membro atualizados com sucesso!");
      setEditingUser(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar usuário.");
    }
  };

  const handleUpdateInvite = async (id: string) => {
    if (!isOwner) return;

    if (!editInviteEmail || !editInviteEmail.trim()) {
      setError("O e-mail do convidado nunca pode ficar em branco, ele só pode ser alterado por outro e-mail válido.");
      return;
    }

    try {
      setError("");
      setSuccessMsg("");
      await apiService.updateInvitation(id, {
        email: editInviteEmail.trim(),
        tenantRole: editInviteRole,
        assignedUnitId: editInviteAssignedUnitId || undefined,
      });
      setSuccessMsg("Convite atualizado com sucesso!");
      setEditingInvite(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar convite.");
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Logic to determine invitation status (sent, pending, accepted, expired)
  const getInviteStatusDetails = (invite: Invitation) => {
    if (invite.status === "accepted") {
      return {
        key: "accepted",
        label: "Aceito",
        className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-250/20",
        icon: CheckCircle2
      };
    }

    const createdTime = new Date(invite.createdAt).getTime();
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const tenMinutesMs = 10 * 60 * 1000;

    if (now - createdTime > sevenDaysMs) {
      return {
        key: "expired",
        label: "Expirado",
        className: "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-250/20",
        icon: XCircle
      };
    }

    if (now - createdTime < tenMinutesMs) {
      return {
        key: "sent",
        label: "Enviado",
        className: "bg-sky-50 text-sky-700 dark:bg-sky-950/20 dark:text-sky-450 border border-sky-250/20",
        icon: Send
      };
    }

    return {
      key: "pending",
      label: "Pendente",
      className: "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-450 border border-amber-250/20",
      icon: Clock
    };
  };

  const getRegionFlag = (region?: string) => {
    if (!region) return "🌍";
    const upper = region.toUpperCase();
    if (upper === "US" || upper === "UNITED STATES") return "🇺🇸";
    if (upper === "EU" || upper === "EUROPE") return "🇪🇺";
    return "🌍";
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Context Header (Active Tenant and Active Unit) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Empresa (Tenant)</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {(currentUser as any).tenantName || "Quality Logistics"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l md:border-r border-slate-100 dark:border-slate-850 py-3 md:py-0 md:px-5">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Unidade Operativa Ativa</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span>{getRegionFlag(activeUnitRegion)}</span>
              <span>{activeUnitName}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-3">
          <div className="text-left md:text-right">
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Seu Cargo de Acesso</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <Shield className="h-3.5 w-3.5 shrink-0" />
              {currentUser.tenantRole === "owner" ? "Proprietário (Owner)" : currentUser.tenantRole === "admin" ? "Gerente" : "Operador"}
            </span>
          </div>
          <div className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-150/10 rounded-lg text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 shrink-0">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span>Compliance 180D</span>
          </div>
        </div>
      </div>

      {/* Main Title and Header Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="h-6 w-6 text-indigo-500" />
            Gerenciar Equipe
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Convide funcionários, gere links de onboarding e controle permissões de acesso ao sistema.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 transition-all cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar Lista
        </button>
      </div>

      {/* Read-only feedback banner if not Owner */}
      {!isOwner && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-2xl flex gap-3 text-xs text-amber-800 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <h4 className="font-bold">Modo de Acesso Restrito (Leitura)</h4>
            <p className="mt-0.5 leading-relaxed">
              Apenas proprietários da conta (<strong>Owner</strong>) possuem permissão corporativa para convidar novos funcionários, revogar convites pendentes ou remover acessos ativos do sistema.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl text-xs text-red-600 font-medium">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-2xl">
          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{successMsg}</p>
          {lastGeneratedLink && (
            <div className="mt-3">
              <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">
                Link de Convite para Copiar (Compartilhe com o funcionário)
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={lastGeneratedLink}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 rounded-lg px-3 py-2 w-full select-all focus:outline-hidden"
                />
                <button
                  onClick={() => copyToClipboard(lastGeneratedLink, "last-gen")}
                  className="p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                  title="Copiar Link"
                >
                  {copiedId === "last-gen" ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invite Form (only enabled for owners) */}
        <div className={`bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4 ${!isOwner ? "opacity-60 select-none pointer-events-none" : ""}`}>
          <h3 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
            <MailPlus className="h-4 w-4 text-indigo-500" />
            Novo Convite
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Digite o e-mail Google da pessoa. Ela será vinculada automaticamente à sua conta de cliente (tenant) <strong>somente após aceitar o convite e realizar o login com o e-mail correspondente</strong>.
          </p>

          <form onSubmit={handleInvite} className="space-y-4 pt-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                E-mail Corporativo (Google)
              </label>
              <input
                type="email"
                required
                disabled={!isOwner}
                placeholder="exemplo@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                Filial Atribuída (Unidade)
              </label>
              <select
                value={assignedUnitId}
                disabled={!isOwner}
                onChange={(e) => setAssignedUnitId(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Todas as Filiais / Global</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.region || "US"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                Função de Permissão (Role)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${
                  role === "operator" 
                    ? "border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/10 text-indigo-700 dark:text-indigo-400 font-semibold"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                }`}>
                  <input
                    type="radio"
                    name="role"
                    value="operator"
                    disabled={!isOwner}
                    checked={role === "operator"}
                    onChange={() => setRole("operator")}
                    className="sr-only"
                  />
                  <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center">
                    {role === "operator" && <div className="w-2 h-2 bg-indigo-500 rounded-full" />}
                  </div>
                  <div className="text-left">
                    <span className="block text-xs">Operador</span>
                    <span className="block text-[9px] text-slate-400 font-normal">Lançamentos</span>
                  </div>
                </label>

                <label className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${
                  role === "admin" 
                    ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10 text-emerald-700 dark:text-emerald-400 font-semibold"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                }`}>
                  <input
                    type="radio"
                    name="role"
                    value="admin"
                    disabled={!isOwner}
                    checked={role === "admin"}
                    onChange={() => setRole("admin")}
                    className="sr-only"
                  />
                  <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center">
                    {role === "admin" && <div className="w-2 h-2 bg-emerald-500 rounded-full" />}
                  </div>
                  <div className="text-left">
                    <span className="block text-xs">Gerente</span>
                    <span className="block text-[9px] text-slate-400 font-normal">Controle total</span>
                  </div>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !isOwner}
              className="w-full flex items-center justify-center py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold active:scale-98 transition-all cursor-pointer disabled:opacity-50 mt-2"
            >
              {submitting ? "Gerando..." : "Gerar Link de Convite"}
            </button>
          </form>
        </div>

        {/* Team Members and Invitations lists */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Members Card */}
          <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
              <Users className="h-4.5 w-4.5 text-indigo-500" />
              Membros Ativos da Equipe ({activeUsers.length})
            </h3>

            {loading && activeUsers.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Carregando membros da equipe...
              </div>
            ) : activeUsers.length === 0 ? (
              <div className="py-8 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-center text-xs text-slate-400">
                Nenhum membro ativo cadastrado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-2">Nome / E-mail</th>
                      <th className="py-2.5 px-2">Permissão (Role)</th>
                      <th className="py-2.5 px-2">Filial</th>
                      <th className="py-2.5 px-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {activeUsers.map((member) => {
                      const isSelf = member.uid === currentUser.uid;
                      const isMemberOwner = member.tenantRole === "owner";
                      const isEditing = editingUser?.uid === member.uid;

                      if (isEditing) {
                        return (
                          <tr key={member.uid} className="bg-slate-50/50 dark:bg-slate-800/40">
                            <td className="py-3 px-2">
                              <div className="space-y-1.5 max-w-xs">
                                <input
                                  type="text"
                                  value={editUserName}
                                  onChange={(e) => setEditUserName(e.target.value)}
                                  placeholder="Nome do Membro"
                                  className="w-full text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-950 dark:text-white"
                                />
                                <input
                                  type="email"
                                  value={editUserEmail}
                                  onChange={(e) => setEditUserEmail(e.target.value)}
                                  placeholder="E-mail (Não pode ficar em branco)"
                                  className="w-full text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-950 dark:text-white font-mono"
                                />
                              </div>
                            </td>
                            <td className="py-3 px-2">
                              <select
                                value={editUserRole}
                                onChange={(e) => setEditUserRole(e.target.value)}
                                className="text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-950 dark:text-white focus:outline-hidden"
                              >
                                <option value="operator">Operador</option>
                                <option value="admin">Gerente</option>
                                <option value="owner">Dono da Conta</option>
                              </select>
                            </td>
                            <td className="py-3 px-2">
                              <select
                                value={editUserAssignedUnitId}
                                onChange={(e) => setEditUserAssignedUnitId(e.target.value)}
                                className="text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-950 dark:text-white focus:outline-hidden"
                              >
                                <option value="">Todas as Filiais</option>
                                {units.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-2 text-right">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => handleUpdateUser(member.uid, member.tenantRole)}
                                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[10px] cursor-pointer"
                                >
                                  Salvar
                                </button>
                                <button
                                  onClick={() => setEditingUser(null)}
                                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-medium rounded-lg text-[10px] cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      const assignedUnitObj = units.find((u) => u.id === member.assignedUnitId);

                      return (
                        <tr key={member.uid} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-2 font-medium">
                            <div className="flex flex-col">
                              <span className="text-slate-900 dark:text-white font-bold flex items-center gap-1.5">
                                {member.name || "Sem Nome"}
                                {isSelf && (
                                  <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 text-[9px] font-bold rounded uppercase">
                                    Você
                                  </span>
                                )}
                              </span>
                              <span className="text-[10px] text-slate-450 font-mono mt-0.5">{member.email}</span>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            {isMemberOwner ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 text-[10px] font-bold uppercase border border-emerald-200/10 animate-pulse" title="Dono da Conta">
                                <Shield className="h-3 w-3 shrink-0" />
                                Dono da Conta
                              </span>
                            ) : member.tenantRole === "admin" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 text-[10px] font-bold uppercase border border-blue-200/10" title="Gerente">
                                Gerente
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-bold uppercase border border-slate-200/10" title="Operador de Pátio">
                                Operador
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-slate-600 dark:text-slate-300 font-medium">
                            {assignedUnitObj ? assignedUnitObj.name : "Todas as Filiais"}
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div className="flex justify-end items-center gap-2">
                              {isOwner && (
                                <button
                                  onClick={() => {
                                    setEditingUser(member);
                                    setEditUserName(member.name || "");
                                    setEditUserEmail(member.email || "");
                                    setEditUserRole(member.tenantRole || "operator");
                                    setEditUserAssignedUnitId(member.assignedUnitId || "");
                                  }}
                                  className="p-1.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg cursor-pointer transition-colors"
                                  title="Editar membro da equipe"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {isOwner && !isSelf && !isMemberOwner && (
                                <button
                                  onClick={() => handleRemoveUser(member.uid, member.email)}
                                  className="px-2 py-1 bg-rose-50 dark:bg-rose-950/25 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-[10px] font-bold rounded-xl border border-rose-250/20 dark:border-rose-900/30 cursor-pointer transition-all inline-flex items-center gap-1"
                                  title="Delete email and revoke permission"
                                >
                                  <Trash2 className="h-3 w-3 shrink-0" />
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Invitations List Card with four statuses */}
          <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
              <Clock className="h-4.5 w-4.5 text-amber-500" />
              Gestão de Convites ({invitations.length})
            </h3>

            {loading && invitations.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Carregando convites...
              </div>
            ) : invitations.length === 0 ? (
              <div className="py-8 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-center text-xs text-slate-400">
                Nenhum convite gerado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-2">E-mail Convidado</th>
                      <th className="py-2.5 px-2">Permissão</th>
                      <th className="py-2.5 px-2">Filial</th>
                      <th className="py-2.5 px-2">Rastreamento</th>
                      <th className="py-2.5 px-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {invitations.map((invite) => {
                      const inviteUrl = `${window.location.origin}/?invite=${invite.id}`;
                      const statusInfo = getInviteStatusDetails(invite);
                      const StatusIcon = statusInfo.icon;
                      const isEditing = editingInvite?.id === invite.id;

                      if (isEditing) {
                        return (
                          <tr key={invite.id} className="bg-slate-50/50 dark:bg-slate-800/40">
                            <td className="py-3 px-2">
                              <input
                                type="email"
                                value={editInviteEmail}
                                onChange={(e) => setEditInviteEmail(e.target.value)}
                                placeholder="E-mail do Convidado"
                                className="w-full max-w-xs text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-950 dark:text-white font-mono"
                              />
                            </td>
                            <td className="py-3 px-2">
                              <select
                                value={editInviteRole}
                                onChange={(e) => setEditInviteRole(e.target.value)}
                                className="text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-950 dark:text-white focus:outline-hidden"
                              >
                                <option value="operator">Operador</option>
                                <option value="admin">Gerente</option>
                                <option value="owner">Dono da Conta</option>
                              </select>
                            </td>
                            <td className="py-3 px-2">
                              <select
                                value={editInviteAssignedUnitId}
                                onChange={(e) => setEditInviteAssignedUnitId(e.target.value)}
                                className="text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-950 dark:text-white focus:outline-hidden"
                              >
                                <option value="">Todas as Filiais</option>
                                {units.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-2">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.className}`}>
                                <StatusIcon className="h-3 w-3 shrink-0" />
                                {statusInfo.label}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-right">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => handleUpdateInvite(invite.id)}
                                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[10px] cursor-pointer"
                                >
                                  Salvar
                                </button>
                                <button
                                  onClick={() => setEditingInvite(null)}
                                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-medium rounded-lg text-[10px] cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      const assignedUnitObj = units.find((u) => u.id === invite.assignedUnitId);

                      return (
                        <tr key={invite.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-2 font-medium text-slate-900 dark:text-white">
                            <div>
                              <p className="font-bold">{invite.email}</p>
                              <span className="block text-[9px] text-slate-400 mt-0.5">
                                Por {invite.invitedBy} em {new Date(invite.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-2 font-mono">
                            {invite.tenantRole === "owner" ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                Dono da Conta
                              </span>
                            ) : invite.tenantRole === "admin" ? (
                              <span className="text-blue-600 dark:text-blue-400 font-bold">
                                Gerente
                              </span>
                            ) : (
                              <span className="text-indigo-600 dark:text-indigo-400">
                                Operador
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-slate-600 dark:text-slate-300 font-medium">
                            {assignedUnitObj ? assignedUnitObj.name : "Todas as Filiais"}
                          </td>
                          <td className="py-3 px-2">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.className}`}>
                              <StatusIcon className="h-3 w-3 shrink-0" />
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div className="flex justify-end gap-1.5 items-center">
                              {statusInfo.key !== "accepted" && isOwner && (
                                <>
                                  <button
                                    onClick={() => copyToClipboard(inviteUrl, invite.id)}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                                    title="Copiar Link de Convite"
                                  >
                                    {copiedId === invite.id ? (
                                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingInvite(invite);
                                      setEditInviteEmail(invite.email);
                                      setEditInviteRole(invite.tenantRole || "operator");
                                      setEditInviteAssignedUnitId(invite.assignedUnitId || "");
                                    }}
                                    className="p-1.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg cursor-pointer transition-colors"
                                    title="Editar convite"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleRevoke(invite.id)}
                                    className="px-2 py-1 bg-rose-50 dark:bg-rose-950/25 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-[10px] font-bold rounded-xl border border-rose-250/20 dark:border-rose-900/30 cursor-pointer transition-all inline-flex items-center gap-1"
                                    title="Delete invite and revoke permission"
                                  >
                                    <Trash2 className="h-3 w-3 shrink-0" />
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Units Management Card (Only for Owner) */}
      {isOwner && (
        <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4 mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <Layers className="h-4.5 w-4.5 text-indigo-500" />
                Unidades e Filiais ({units.length})
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Configure filiais/warehouses para o seu tenant, definindo o sistema de medidas e visual.
              </p>
            </div>
            <button
              onClick={handleOpenCreateUnit}
              className="cursor-pointer inline-flex items-center justify-center py-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition-all shadow-md shadow-indigo-600/15 hover:shadow-indigo-600/25 active:scale-98"
              id="btn-add-unit"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Adicionar Unidade
            </button>
          </div>

          {unitSuccess && !isOpenUnitModal && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-xl text-xs text-emerald-600 dark:text-emerald-400">
              {unitSuccess}
            </div>
          )}

          {unitError && !isOpenUnitModal && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl text-xs text-red-600 dark:text-red-400">
              {unitError}
            </div>
          )}

          {loadingUnits ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Carregando unidades...
            </div>
          ) : units.length === 0 ? (
            <div className="py-8 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-center text-xs text-slate-400">
              Nenhuma unidade cadastrada. Clique em "Adicionar Unidade" para cadastrar a primeira!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-2">Nome da Unidade</th>
                    <th className="py-2.5 px-2">Região</th>
                    <th className="py-2.5 px-2">Sistema</th>
                    <th className="py-2.5 px-2">Identidade Visual</th>
                    <th className="py-2.5 px-2">Status</th>
                    <th className="py-2.5 px-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {units.map((unit) => (
                    <tr key={unit.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-2 font-bold text-slate-900 dark:text-white">
                        {unit.name}
                      </td>
                      <td className="py-3 px-2 text-slate-600 dark:text-slate-350">
                        <div className="flex items-center gap-1.5">
                          <Globe className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                          <span>{unit.region}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 font-medium">
                        <span className="inline-flex items-center rounded-md bg-slate-50 dark:bg-slate-700/50 px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700">
                          {unit.unitSystem === "imperial" ? "Imperial (Lbs/In)" : "Métrico (Kgs/Cm)"}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-xs animate-pulse" style={{ backgroundColor: unit.theme.primary }} />
                          <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{unit.theme.primary}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        {unit.isActive !== false ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 text-[10px] font-bold uppercase border border-emerald-200/10">
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-450 text-[10px] font-bold uppercase border border-slate-200/10">
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditUnit(unit)}
                            className="p-1.5 hover:bg-slate-150 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer transition-colors inline-flex items-center justify-center"
                            title="Editar Unidade"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleUnitActive(unit)}
                            className={`p-1.5 rounded-lg cursor-pointer transition-colors inline-flex items-center justify-center ${
                              unit.isActive !== false
                                ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                                : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                            }`}
                            title={unit.isActive !== false ? "Desativar" : "Ativar"}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Unit Modal */}
      <AnimatePresence>
        {isOpenUnitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs overflow-y-auto" id="unit-modal">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden flex flex-col my-8"
            >
              {/* Top Dynamic Bar in Modal */}
              <div 
                className="absolute top-0 left-0 right-0 h-1.5" 
                style={{ background: `linear-gradient(90deg, ${unitPrimaryColor}, ${unitAccentColor})` }}
              />

              <div className="flex items-center justify-between mb-4 mt-2">
                <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-indigo-500" />
                  {editingUnit ? "Editar Unidade" : "Cadastrar Nova Unidade"}
                </h2>
                <button
                  onClick={() => setIsOpenUnitModal(false)}
                  className="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-semibold p-1"
                >
                  ✕
                </button>
              </div>

              {unitError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl text-xs text-red-600 dark:text-red-450 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{unitError}</span>
                </div>
              )}

              {unitSuccess && (
                <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{unitSuccess}</span>
                </div>
              )}

              <form onSubmit={handleUnitSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Nome da Filial / Warehouse *
                  </label>
                  <input
                    type="text"
                    required
                    value={unitName}
                    onChange={(e) => setUnitName(e.target.value)}
                    placeholder="Ex: Orlando Warehouse"
                    className="mt-1.5 block w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                {/* Region & Unit System */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                      Região ou País
                    </label>
                    <input
                      type="text"
                      required
                      value={unitRegion}
                      onChange={(e) => setUnitRegion(e.target.value)}
                      placeholder="Ex: América, Europa, Brasil, Ásia..."
                      className="block w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                      Sistema de Unidades
                    </label>
                    <select
                      value={unitSystem}
                      onChange={(e) => setUnitSystem(e.target.value as "imperial" | "metric")}
                      className="block w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm cursor-pointer"
                    >
                      <option value="imperial">Imperial (Lbs / Inches / Cft)</option>
                      <option value="metric">Métrico (Kgs / Centimeters / Cbm)</option>
                    </select>
                  </div>
                </div>

                {/* Theme Customization */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Identidade Visual da Filial
                  </label>

                  {/* Presets */}
                  <div className="flex flex-wrap gap-2">
                    {THEME_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setUnitPrimaryColor(preset.primary);
                          setUnitAccentColor(preset.accent);
                        }}
                        className="cursor-pointer px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/60 dark:hover:bg-slate-700 text-[11px] rounded-lg border border-slate-150 dark:border-slate-600 text-slate-600 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.primary }} />
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>

                  {/* Custom Pickers */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-[11px] text-slate-500 mb-1">Cor Primária</span>
                      <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-600 rounded-xl p-1.5 bg-slate-50 dark:bg-slate-700">
                        <input
                          type="color"
                          value={unitPrimaryColor}
                          onChange={(e) => setUnitPrimaryColor(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent shrink-0"
                        />
                        <input
                          type="text"
                          value={unitPrimaryColor}
                          onChange={(e) => setUnitPrimaryColor(e.target.value)}
                          maxLength={7}
                          className="w-full bg-transparent text-xs font-mono text-slate-800 dark:text-white uppercase focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div>
                      <span className="block text-[11px] text-slate-500 mb-1">Cor de Destaque</span>
                      <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-600 rounded-xl p-1.5 bg-slate-50 dark:bg-slate-700">
                        <input
                          type="color"
                          value={unitAccentColor}
                          onChange={(e) => setUnitAccentColor(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent shrink-0"
                        />
                        <input
                          type="text"
                          value={unitAccentColor}
                          onChange={(e) => setUnitAccentColor(e.target.value)}
                          maxLength={7}
                          className="w-full bg-transparent text-xs font-mono text-slate-800 dark:text-white uppercase focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Active / Inactive Toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-150 dark:border-slate-750">
                  <div>
                    <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">Unidade Ativa</span>
                    <span className="block text-[10px] text-slate-450">Se inativa, a unidade ficará indisponível para seleção.</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={unitIsActive}
                      onChange={(e) => setUnitIsActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* Theme Preview Card */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-3">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" style={{ color: unitAccentColor }} />
                    Preview em Tempo Real
                  </div>
                  
                  {/* Mock UI elements styled with picked colors */}
                  <div className="bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl p-3 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-white">
                        {unitName || "Minha Filial"}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: unitAccentColor }}>
                        {unitSystem === "imperial" ? "Lbs/Inches" : "Kgs/Cms"}
                      </span>
                    </div>
                    
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        className="px-3 py-1.5 text-[11px] font-semibold text-white rounded-lg transition-opacity flex-1 hover:opacity-90"
                        style={{ backgroundColor: unitPrimaryColor }}
                      >
                        Botão Principal
                      </button>
                      <button 
                        type="button"
                        className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex-1"
                      >
                        Secundário
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOpenUnitModal(false)}
                    className="cursor-pointer flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-sm transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={unitSubmitting}
                    className="cursor-pointer flex-1 py-2.5 px-4 text-white font-bold rounded-xl text-sm transition-all shadow-md active:scale-98 disabled:opacity-50 flex items-center justify-center gap-1.5"
                    style={{ backgroundColor: unitPrimaryColor }}
                  >
                    {unitSubmitting ? (
                      <>
                        <RefreshCw className="animate-spin h-4 w-4" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Salvar Unidade
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
