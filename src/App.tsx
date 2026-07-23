import React, { useState, useEffect } from "react";
import { UserProfile, Unit } from "./types";
import { apiService } from "./services/api";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import OperatorDashboard from "./components/OperatorDashboard";
import WarehouseReceiptForm from "./components/WarehouseReceiptForm";
import ShipperManager from "./components/ShipperManager";
import ConsigneeManager from "./components/ConsigneeManager";
import BillOfLadingList from "./components/BillOfLadingList";
import TrashBin from "./components/TrashBin";
import TeamManagement from "./components/TeamManagement";
import SuperadminPanel from "./components/SuperadminPanel";
import UnitManager from "./components/UnitManager";
import { UnitThemeProvider } from "./components/UnitThemeProvider";
import { 
  Truck, 
  BarChart3, 
  PlusSquare, 
  Users, 
  FolderLock, 
  LogOut, 
  Menu, 
  X, 
  User, 
  ShieldAlert, 
  Info, 
  Code, 
  FileCheck2,
  Moon,
  Sun,
  FileText,
  Trash2,
  Layers,
  ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState("receive"); // default
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved === "true";
  });
  const [activeUnit, setActiveUnit] = useState<string>(() => {
    return localStorage.getItem("active_unit") || "US";
  });
  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);

  // Superadmin tenant selection state
  const [superadminSelectedTenantId, setSuperadminSelectedTenantId] = useState<string>(() => {
    return localStorage.getItem("superadmin_selected_tenant_id") || "";
  });
  const [tenants, setTenants] = useState<any[]>([]);

  const handleUnitChange = (unit: string) => {
    setActiveUnit(unit);
    localStorage.setItem("active_unit", unit);
  };

  useEffect(() => {
    if (user) {
      setLoadingUnits(true);
      apiService.getUnits()
        .then((data) => {
          setUnits(data);
          const activeUnits = data.filter(u => u.isActive);
          const saved = localStorage.getItem("active_unit");
          if (activeUnits.length > 0) {
            const stillValid = activeUnits.some(u => u.id === saved);
            if (!stillValid || saved === "Europe") {
              setActiveUnit(activeUnits[0].id);
              localStorage.setItem("active_unit", activeUnits[0].id);
            } else if (activeUnit !== saved) {
              setActiveUnit(saved!);
            }
          } else {
            setActiveUnit("US");
            localStorage.setItem("active_unit", "US");
          }
        })
        .catch((err) => console.error("Erro ao carregar unidades no App.tsx:", err))
        .finally(() => setLoadingUnits(false));
    }
  }, [user, activeTab, superadminSelectedTenantId]); // Reload units when navigating back or when user changes

  const handleTenantChange = (tenantId: string) => {
    if (tenantId) {
      localStorage.setItem("superadmin_selected_tenant_id", tenantId);
    } else {
      localStorage.removeItem("superadmin_selected_tenant_id");
    }
    setSuperadminSelectedTenantId(tenantId);
    window.location.reload();
  };

  const getInitialTab = (profile: UserProfile): string => {
    if (profile.platformRole === "superadmin") {
      return "superadmin";
    }
    const tenantRole = profile.tenantRole || "operator";
    if (tenantRole === "operator") {
      return "receive";
    }
    return "dashboard";
  };

  useEffect(() => {
    // Check if user is logged in
    const currentUser = apiService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      setActiveTab(getInitialTab(currentUser));
    }
  }, []);

  useEffect(() => {
    if (user && user.platformRole === "superadmin") {
      apiService.getTenants()
        .then(setTenants)
        .catch(err => console.error("Erro ao carregar tenants no App.tsx:", err));
    }
  }, [user]);

  const handleLogin = (profile: UserProfile) => {
    setUser(profile);
    setActiveTab(getInitialTab(profile));
  };

  const handleLogout = () => {
    apiService.logout();
    localStorage.removeItem("superadmin_selected_tenant_id");
    setUser(null);
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("darkMode", "true");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("darkMode", "false");
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  if (!user) {
    return <Login onLoginSuccess={handleLogin} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />;
  }

  // Get dynamic tab list with role validation
  const getTabList = () => {
    const isSuper = user.platformRole === "superadmin";
    const isOwner = user.tenantRole === "owner";
    const isAdmin = user.tenantRole === "admin";
    
    if (isSuper) {
      if (!superadminSelectedTenantId) {
        return [
          { id: "superadmin", label: "Superadmin Panel", icon: ShieldAlert },
        ];
      }
      return [
        { id: "superadmin", label: "Superadmin Panel", icon: ShieldAlert },
        { id: "dashboard", label: "Dashboard", icon: BarChart3 },
        { id: "receive", label: "Receive Cargo", icon: PlusSquare },
        { id: "billoflading", label: "Bills of Lading (BL)", icon: FileText },
        { id: "shippers", label: "Shippers", icon: Users },
        { id: "consignees", label: "Consignees", icon: FileCheck2 },
        { id: "retention", label: "Retention Rules", icon: FolderLock },
        { id: "team", label: "Manage Team", icon: Users },
        { id: "trash", label: "Deleted Items", icon: Trash2 },
      ];
    }

    if (isOwner) {
      return [
        { id: "dashboard", label: "Dashboard", icon: BarChart3 },
        { id: "receive", label: "Receive Cargo", icon: PlusSquare },
        { id: "billoflading", label: "Bills of Lading (BL)", icon: FileText },
        { id: "shippers", label: "Shippers", icon: Users },
        { id: "consignees", label: "Consignees", icon: FileCheck2 },
        { id: "units", label: "Manage Units", icon: Layers },
        { id: "retention", label: "Retention Rules", icon: FolderLock },
        { id: "team", label: "Manage Team", icon: Users },
        { id: "trash", label: "Deleted Items", icon: Trash2 },
      ];
    }

    if (isAdmin) {
      return [
        { id: "dashboard", label: "Dashboard", icon: BarChart3 },
        { id: "receive", label: "Receive Cargo", icon: PlusSquare },
        { id: "billoflading", label: "Bills of Lading (BL)", icon: FileText },
        { id: "shippers", label: "Shippers", icon: Users },
        { id: "consignees", label: "Consignees", icon: FileCheck2 },
        { id: "retention", label: "Retention Rules", icon: FolderLock },
      ];
    }

    // Default: Operator (enxuta)
    return [
      { id: "receive", label: "Receive Cargo", icon: PlusSquare },
      { id: "dashboard", label: "Warehouse Receipts", icon: FileCheck2 },
      { id: "shippers", label: "Shippers (Register)", icon: Users },
      { id: "consignees", label: "Consignees (Register)", icon: FileCheck2 },
    ];
  };

  const tabs = getTabList();

  const getRegionFlag = (region?: string) => {
    if (!region) return "🌍";
    const clean = region.trim();
    // If it already contains an emoji, return it
    const emojiRegex = /[\u1F600-\u1F64F\u1F300-\u1F5FF\u1F680-\u1F6FF\u2600-\u26FF\u2700-\u27BF\u1F1E6-\u1F1FF]/g;
    if (emojiRegex.test(clean)) {
      return "";
    }
    
    const upper = clean.toUpperCase();
    if (upper === "US" || upper === "UNITED STATES" || upper === "ESTADOS UNIDOS" || upper === "ORLANDO" || upper === "MIAMI") return "🇺🇸";
    if (upper === "EU" || upper === "EUROPE" || upper === "EUROPA") return "🇪🇺";
    if (upper === "BR" || upper === "BRAZIL" || upper === "BRASIL") return "🇧🇷";
    if (upper === "CN" || upper === "CHINA") return "🇨🇳";
    if (upper === "JP" || upper === "JAPAN" || upper === "JAPÃO") return "🇯🇵";
    if (upper === "PT" || upper === "PORTUGAL") return "🇵🇹";
    if (upper === "AO" || upper === "ANGOLA") return "🇦🇴";
    if (upper === "MZ" || upper === "MOZAMBIQUE" || upper === "MOÇAMBIQUE") return "🇲🇿";
    if (upper === "IN" || upper === "INDIA" || upper === "ÍNDIA") return "🇮🇳";
    if (upper === "GB" || upper === "UK" || upper === "UNITED KINGDOM" || upper === "REINO UNIDO") return "🇬🇧";
    if (upper === "CA" || upper === "CANADA" || upper === "CANADÁ") return "🇨🇦";
    
    return "🌍";
  };

  const currentUnitObj = units.find(u => u.id === activeUnit) || null;
  const isUS = currentUnitObj ? currentUnitObj.region === "US" : activeUnit === "US";
  const primaryBg = currentUnitObj ? "bg-primary" : (isUS ? "bg-indigo-600" : "bg-emerald-600");
  const primaryHoverBg = currentUnitObj ? "hover:opacity-90" : (isUS ? "hover:bg-indigo-700" : "hover:bg-emerald-700");
  const primaryText = currentUnitObj ? "text-primary" : (isUS ? "text-indigo-400" : "text-emerald-400");
  const primaryTextDark = currentUnitObj ? "text-primary font-bold" : (isUS ? "text-indigo-600 dark:text-indigo-400" : "text-emerald-600 dark:text-emerald-400");
  const primaryBorder = currentUnitObj ? "border-primary/40" : (isUS ? "border-indigo-600/35" : "border-emerald-600/35");
  const activeTabClass = currentUnitObj
    ? "bg-primary/10 text-primary border border-primary/30 font-semibold shadow-xs"
    : (isUS 
        ? "bg-indigo-600/10 dark:bg-indigo-600/15 text-indigo-700 dark:text-indigo-400 border border-indigo-650/20 dark:border-indigo-600/35 font-semibold shadow-xs" 
        : "bg-emerald-600/10 dark:bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border border-emerald-650/20 dark:border-emerald-600/35 font-semibold shadow-xs");
  const mobileActiveTabClass = currentUnitObj
    ? "bg-primary/15 text-primary border border-primary/25 font-bold"
    : (isUS 
        ? "bg-indigo-600/10 dark:bg-indigo-600/25 text-indigo-700 dark:text-indigo-400 border border-indigo-600/20 dark:border-indigo-600/30" 
        : "bg-emerald-600/10 dark:bg-emerald-600/25 text-emerald-700 dark:text-emerald-400 border border-emerald-600/20 dark:border-emerald-600/30");
  const logoBg = currentUnitObj ? "bg-primary" : (isUS ? "bg-indigo-500" : "bg-emerald-500");
  const avatarBg = currentUnitObj ? "bg-primary" : (isUS ? "bg-indigo-450" : "bg-emerald-500");
  const unitBadgeClass = currentUnitObj
    ? "bg-primary/10 text-primary border border-primary/20 font-bold"
    : (isUS 
        ? "bg-indigo-100 dark:bg-indigo-950/45 text-indigo-750 dark:text-indigo-400" 
        : "bg-emerald-100 dark:bg-emerald-950/45 text-emerald-750 dark:text-emerald-400");
  const topBarBorder = currentUnitObj
    ? "border-t-4 border-t-primary"
    : (isUS ? "border-t-4 border-t-indigo-600" : "border-t-4 border-t-emerald-600");

  return (
    <div className={`min-h-screen flex flex-col md:flex-row bg-[#F1F5F9] dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-300 ${darkMode ? 'dark' : ''}`}>
      
      {/* Desktop Left Sidebar */}
      <aside className={`hidden md:flex md:flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-850 shadow-sm dark:shadow-xl shrink-0 transition-all duration-300 ${topBarBorder}`}>
        {/* Logo / Header */}
        <div className="p-6 border-b border-slate-150 dark:border-slate-800 flex items-center gap-3">
          <div className={`w-8 h-8 ${logoBg} rounded flex items-center justify-center shrink-0 transition-colors duration-300`}>
            <div className="w-4 h-4 border-2 border-white"></div>
          </div>
          <span className="text-slate-800 dark:text-white font-bold tracking-tight text-lg font-display">BoundFlux</span>
        </div>

        {/* Global Unit Switcher */}
        {(user.platformRole !== "superadmin" || superadminSelectedTenantId) && (
          <div className="px-4 py-3 border-b border-slate-150 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-950/20">
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5 px-1">
              Units
            </span>
            {units.filter(u => u.isActive).length > 0 ? (
              <div className="relative">
                <select
                  value={activeUnit}
                  onChange={(e) => handleUnitChange(e.target.value)}
                  className="w-full py-2 pl-3 pr-8 text-xs font-bold rounded-xl bg-slate-200/50 dark:bg-slate-950/50 text-slate-800 dark:text-slate-200 border border-slate-300/40 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer appearance-none"
                  style={{
                    borderLeft: `4px solid ${units.find(u => u.id === activeUnit)?.theme?.primary || 'var(--color-primary, #4f46e5)'}`
                  }}
                >
                  {units.filter(u => u.isActive).map((u) => (
                    <option key={u.id} value={u.id} className="dark:bg-slate-900 dark:text-white">
                      {getRegionFlag(u.region)} {u.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1 bg-slate-200/50 dark:bg-slate-950/50 p-1 rounded-xl border border-slate-300/40 dark:border-slate-800">
                <button
                  onClick={() => handleUnitChange("US")}
                  className={`py-1.5 px-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    activeUnit === "US"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-850 hover:dark:text-white hover:bg-white/40 dark:hover:bg-slate-850/20"
                  }`}
                >
                  📏 Imperial
                </button>
                <button
                  onClick={() => handleUnitChange("Europe")}
                  className={`py-1.5 px-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    activeUnit === "Europe"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-850 hover:dark:text-white hover:bg-white/40 dark:hover:bg-slate-850/20"
                  }`}
                >
                  🧪 Metric
                </button>
              </div>
            )}
          </div>
        )}

        {/* Navigation List */}
        <nav className="flex-1 p-4 space-y-4">
          {/* Geral Group */}
          <div>
            <div className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest px-3 mb-2">General</div>
            <div className="space-y-1">
              {tabs.filter(t => ["dashboard", "shippers", "consignees"].includes(t.id)).map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all text-left cursor-pointer ${
                      active 
                        ? activeTabClass 
                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-800 dark:hover:text-slate-250 border border-transparent font-medium"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="text-sm">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Operacional Group */}
          <div>
            <div className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest px-3 mb-2">Operational</div>
            <div className="space-y-1">
              {tabs.filter(t => ["receive", "billoflading", "retention", "trash"].includes(t.id)).map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all text-left cursor-pointer ${
                      active 
                        ? activeTabClass 
                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-800 dark:hover:text-slate-250 border border-transparent font-medium"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="text-sm">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Administração Group */}
          {(user.tenantRole === "owner" || user.platformRole === "superadmin") && (
            <div>
              <div className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest px-3 mb-2">Administration</div>
              <div className="space-y-1">
                {tabs.filter(t => ["team", "superadmin"].includes(t.id)).map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all text-left cursor-pointer ${
                        active 
                          ? activeTabClass 
                          : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-800 dark:hover:text-slate-250 border border-transparent font-medium"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="text-sm">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        {/* User Card at bottom of Desktop Sidebar */}
        <div className="p-4 border-t border-slate-150 dark:border-slate-800">
          <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200/60 dark:border-slate-700/40">
            <div className={`w-8 h-8 rounded-full ${avatarBg} flex items-center justify-center font-bold text-slate-900 text-xs shrink-0 transition-colors duration-300`}>
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-850 dark:text-white truncate">{user.name}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {user.platformRole === "superadmin" 
                  ? "Platform Superadmin" 
                  : user.tenantRole === "owner" 
                    ? "Account Owner" 
                    : user.tenantRole === "admin" 
                      ? "Manager" 
                      : "Yard Operator"}
              </p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full mt-3 py-2 text-[11px] font-bold text-rose-500 dark:text-rose-450 hover:bg-rose-500/10 rounded border border-rose-500/20 transition-all cursor-pointer"
          >
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Content Area (Header + Main scroll container) */}
      <div className={`flex-1 flex flex-col min-h-screen overflow-hidden transition-all duration-300 ${topBarBorder}`}>
        
        {/* Desktop Header */}
        <header className="hidden md:flex h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 items-center justify-between shadow-xs shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-bold text-slate-900 dark:text-white font-display">
              BoundFlux Operations Center
            </h1>
            {(user.platformRole !== "superadmin" || superadminSelectedTenantId) && (
              <span className={`px-2.5 py-0.5 ${unitBadgeClass} text-[10px] font-bold rounded-full uppercase tracking-wider font-semibold transition-colors duration-300`}>
                {currentUnitObj 
                  ? `${getRegionFlag(currentUnitObj.region)} ${currentUnitObj.name}`
                  : `🏢 ${user.platformRole === "superadmin" ? (tenants.find((t: any) => t.tenantId === superadminSelectedTenantId)?.name || "Active") : (user.tenantName || "Main Unit")}`
                }
              </span>
            )}
            
            {user.platformRole === "superadmin" ? (
              <div className="flex items-center gap-1.5 bg-indigo-50 dark:bg-slate-900 rounded-full pl-2.5 pr-1 py-0.5 border border-indigo-150 dark:border-slate-750">
                <span className="text-[9px] font-bold text-indigo-650 dark:text-slate-450 uppercase tracking-widest">Company:</span>
                <select
                  value={superadminSelectedTenantId}
                  onChange={(e) => handleTenantChange(e.target.value)}
                  className="bg-transparent text-slate-800 dark:text-slate-200 text-[10px] font-bold border-none focus:outline-hidden py-0 pr-6"
                >
                  <option value="">-- Platform View --</option>
                  {tenants.map((t: any) => (
                    <option key={t.tenantId} value={t.tenantId} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                      🏢 {t.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold rounded-full uppercase tracking-wider border border-indigo-150 dark:border-indigo-900/30">
                🏢 {user.tenantName || "Quality Logistics"}
              </span>
            )}

            <span className="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/45 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold rounded-full uppercase tracking-wider animate-pulse">
              Online
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 border-r border-slate-200 dark:border-slate-700 pr-6">
              <button
                type="button"
                onClick={toggleDarkMode}
                className="p-2 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-100 rounded-full cursor-pointer shadow-md border border-slate-200 dark:border-slate-700 transition-all active:scale-95"
                title={darkMode ? "Enable Light Mode" : "Enable Dark Mode"}
              >
                {darkMode ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-slate-500" />}
              </button>
            </div>
            
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Storage TTL</span>
              <span className={`font-mono font-bold text-xs ${primaryTextDark} transition-colors duration-300`}>
                180 Days Compliance
              </span>
            </div>
          </div>
        </header>

        {/* Mobile Header navbar */}
        <header className={`md:hidden sticky top-0 z-30 bg-white dark:bg-slate-900 text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-800 h-16 shrink-0 transition-all duration-300 ${topBarBorder}`}>
          <div className="px-4 h-full flex justify-between items-center">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className={`w-7 h-7 ${logoBg} rounded flex items-center justify-center shrink-0 transition-colors duration-300`}>
                <div className="w-3.5 h-3.5 border-2 border-white"></div>
              </div>
              <span className="font-display font-bold text-base tracking-tight text-slate-800 dark:text-white">BoundFlux</span>
            </div>

            {/* Right Side Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleDarkMode}
                className="p-2 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-100 rounded-full cursor-pointer shadow-md border border-slate-200 dark:border-slate-700 transition-all active:scale-95"
                title={darkMode ? "Enable Light Mode" : "Enable Dark Mode"}
              >
                {darkMode ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-xl cursor-pointer"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Dropdown menu */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="md:hidden border-t border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xl"
              >
                <div className="px-3 pt-3 pb-4 space-y-1">
                  {/* Mobile Unit Switcher */}
                  {(user.platformRole !== "superadmin" || superadminSelectedTenantId) && (
                    <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950/35 border border-slate-200 dark:border-slate-800/85 rounded-xl mb-3 space-y-2">
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                        Units
                      </span>
                      {units.filter(u => u.isActive).length > 0 ? (
                        <div className="relative">
                          <select
                            value={activeUnit}
                            onChange={(e) => handleUnitChange(e.target.value)}
                            className="w-full py-2 pl-3 pr-8 text-xs font-bold rounded-xl bg-slate-200/50 dark:bg-slate-950/50 text-slate-800 dark:text-slate-200 border border-slate-300/40 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer appearance-none"
                            style={{
                              borderLeft: `4px solid ${units.find(u => u.id === activeUnit)?.theme?.primary || 'var(--color-primary, #4f46e5)'}`
                            }}
                          >
                            {units.filter(u => u.isActive).map((u) => (
                              <option key={u.id} value={u.id} className="dark:bg-slate-900 dark:text-white">
                                {getRegionFlag(u.region)} {u.name}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                            <ChevronDown className="h-4 w-4" />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-1 bg-slate-200/50 dark:bg-slate-950/50 p-1 rounded-lg border border-slate-300/40 dark:border-slate-800">
                          <button
                            onClick={() => handleUnitChange("US")}
                            className={`py-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer text-center ${
                              activeUnit === "US"
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-850 hover:dark:text-white"
                            }`}
                          >
                            📏 Imperial
                          </button>
                          <button
                            onClick={() => handleUnitChange("Europe")}
                            className={`py-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer text-center ${
                              activeUnit === "Europe"
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-850 hover:dark:text-white"
                            }`}
                          >
                            🧪 Métrico
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center px-4 py-3 text-xs font-semibold rounded-xl cursor-pointer transition-all ${
                          active 
                            ? mobileActiveTabClass 
                            : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                      >
                        <Icon className="h-4 w-4 mr-3 shrink-0" />
                        {tab.label}
                      </button>
                    );
                  })}
                  
                  <div className="border-t border-slate-150 dark:border-slate-800 pt-3 mt-3 px-4 pb-1 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-white block">
                        {user.name}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-450">{user.email}</span>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 dark:text-rose-450 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                    >
                      <LogOut className="h-3 w-3" /> Log Out
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* Scrollable container */}
        <div className="flex-1 overflow-y-auto bg-[#F1F5F9] dark:bg-slate-950 p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            
            {/* Impersonation Warning Banner */}
            {user.platformRole === "superadmin" && superadminSelectedTenantId && (
              <div className="mb-6 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs text-amber-700 dark:text-amber-450 font-medium">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <span>
                    You are in <strong>Impersonation Mode</strong>. Viewing data for company:{" "}
                    <strong>{tenants.find((t: any) => t.tenantId === superadminSelectedTenantId)?.name || "Loading..."}</strong> (ID: {superadminSelectedTenantId}).
                  </span>
                </div>
                <button
                  onClick={() => handleTenantChange("")}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold rounded-lg cursor-pointer transition-all shrink-0"
                >
                  Back to Aggregated View
                </button>
              </div>
            )}

            {/* Render Active View tab with standard geometric cards/layouts */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <UnitThemeProvider unit={currentUnitObj}>
                  {activeTab === "dashboard" && (
                    user.tenantRole === "operator" ? (
                      <OperatorDashboard 
                        activeUnit={activeUnit} 
                        currentUser={user} 
                        onReceiveClick={() => setActiveTab("receive")} 
                      />
                    ) : (
                      <Dashboard 
                        activeUnit={activeUnit} 
                        currentUser={user} 
                        onReceiveClick={() => setActiveTab("receive")} 
                      />
                    )
                  )}
                  {activeTab === "receive" && (
                    <WarehouseReceiptForm 
                      currentUser={user} 
                      activeUnit={activeUnit}
                      onSuccess={() => setActiveTab("dashboard")} 
                    />
                  )}
                  {activeTab === "billoflading" && <BillOfLadingList activeUnit={activeUnit} currentUser={user} />}
                  {activeTab === "shippers" && <ShipperManager currentUser={user} />}
                  {activeTab === "consignees" && <ConsigneeManager currentUser={user} />}
                  {activeTab === "units" && <UnitManager currentUser={user} />}
                  {activeTab === "team" && <TeamManagement currentUser={user} />}
                  {activeTab === "superadmin" && <SuperadminPanel />}
                  {activeTab === "trash" && <TrashBin currentUser={user} />}

                {activeTab === "retention" && (
                  <div className="space-y-6">
                    <div>
                      <h1 className="text-xl font-bold font-display text-slate-900 dark:text-white">
                        Extended Media Retention Rules (180-Day Compliance)
                      </h1>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Technical specifications, industry compliance, and cold compression logic (180 days).
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Explanation card */}
                      <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
                        <h2 className="text-sm font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
                          <Info className="h-4.5 w-4.5 text-indigo-500" />
                          How does automatic Cold Archiving work?
                        </h2>
                        
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          For strict compliance with logistics industry and insurance cargo dispute deadlines, we have extended the photo retention period from 10 to <strong>180 days</strong>. For cost and disk space optimization without losing traceability, we have implemented a **Cold Archiving** routine.
                        </p>

                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl space-y-3 border border-slate-100 dark:border-slate-850">
                          <div className="flex gap-3 text-xs">
                            <span className="font-bold text-indigo-600 font-mono">01.</span>
                            <div>
                              <h4 className="font-bold text-slate-800 dark:text-white">Scan and Gzip Compression</h4>
                              <p className="text-slate-500 dark:text-slate-400 mt-0.5">Every 12 hours, cleanup routines on the backend server identify receipt media older than 180 days, securely compress them in Gzip (.gz) format, and move the compressed file to the cold directory (<code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">/uploads/archive</code>).</p>
                            </div>
                          </div>

                          <div className="flex gap-3 text-xs">
                            <span className="font-bold text-indigo-600 font-mono">02.</span>
                            <div>
                              <h4 className="font-bold text-slate-800 dark:text-white">Preservation of Intact Records</h4>
                              <p className="text-slate-500 dark:text-slate-400 mt-0.5">The textual records and receipt weight/volume history remain completely intact. The photo status property is marked as <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">ARCHIVED</code> in the database.</p>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl flex gap-3 text-xs text-indigo-700 dark:text-indigo-400">
                          <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-bold">180-Day Logistics Compliance</h4>
                            <p className="mt-0.5 leading-relaxed">In real logistics scenarios, cargo damage claims and disputes with insurance companies often occur months after delivery. Our local compression policy keeps evidence history protected for auditing without burdening the production server.</p>
                          </div>
                        </div>
                      </div>

                      {/* Technical Script Card */}
                      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
                        <h2 className="text-sm font-bold font-display text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Code className="h-4 w-4 text-indigo-500" />
                          Cloud Function Script (JS)
                        </h2>
                        
                        <p className="text-[10px] text-slate-400">
                          This script deploys to Firebase Cloud Functions to schedule compression and transfer of old media to the cold storage tier (Archive) of Firebase Storage:
                        </p>

                        <div className="p-3 bg-slate-950 text-slate-300 font-mono text-[9px] rounded-xl overflow-x-auto max-h-[220px]">
                          <pre>{`const functions = require("firebase-functions");
const admin = require("firebase-admin");
const zlib = require("zlib");
admin.initializeApp();

// Schedules daily execution at midnight (UTC)
exports.archiveOldCargoPhotos = functions.pubsub
  .schedule("0 0 * * *")
  .onRun(async (context) => {
    const bucket = admin.storage().bucket();
    const db = admin.firestore();
    
    const archiveDays = 180;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - archiveDays);
    
    console.log("Starting cold archiving...");
    
    // 1. Locate receipts created more than 180 days ago
    const snapshot = await db.collection("receipts")
      .where("createdAt", "<", cutoffDate.toISOString())
      .get();
      
    if (snapshot.empty) {
      console.log("No files to archive.");
      return null;
    }
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data.photoUrl && data.photoUrl !== "ARCHIVED" && data.photoUrl.startsWith("http")) {
        try {
          const filePath = extractFilePath(data.photoUrl);
          const file = bucket.file(filePath);
          
          // Download photo, compress with Gzip and send to folder "archive/"
          const [fileContent] = await file.download();
          const compressed = zlib.gzipSync(fileContent);
          
          const archiveFile = bucket.file("archive/" + filePath + ".gz");
          await archiveFile.save(compressed, {
            metadata: { storageClass: "ARCHIVE", contentType: "application/gzip" }
          });
          
          // Remove high-availability original file
          await file.delete();
          console.log("Photo migrated to GCS Archive:", filePath);
          
          // Update db document to ARCHIVED
          await doc.ref.update({
            photoUrl: "ARCHIVED"
          });
        } catch (err) {
          console.error("Failed to archive photo:", doc.id, err);
        }
      }
    }
    return null;
  });`}</pre>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                </UnitThemeProvider>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer copyright */}
          <footer className="mt-16 border-t border-slate-200 dark:border-slate-800 py-6 text-center md:text-left md:flex md:items-center md:justify-between text-[11px] text-slate-400 dark:text-slate-500">
            <span>&copy; 2026 BoundFlux. All rights reserved.</span>
            <div className="flex justify-center md:justify-end gap-4 mt-2 md:mt-0">
              <span className="flex items-center justify-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Synchronized with Firestore & Gemini AI
              </span>
            </div>
          </footer>
        </div>

      </div>

    </div>
  );
}