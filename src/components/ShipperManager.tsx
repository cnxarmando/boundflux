import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";
import { Shipper, Plant, UserProfile } from "../types";
import DeleteConfirmationModal from "./DeleteConfirmationModal";
import { 
  Plus, 
  Search, 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Loader2, 
  AlertCircle, 
  Edit2, 
  Building, 
  ArrowLeft, 
  Trash2 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const COUNTRY_CODES = [
  { code: "US", name: "United States", prefix: "+1", flag: "🇺🇸" },
  { code: "BR", name: "Brazil", prefix: "+55", flag: "🇧🇷" },
  { code: "CA", name: "Canada", prefix: "+1", flag: "🇨🇦" },
  { code: "MX", name: "Mexico", prefix: "+52", flag: "🇲🇽" },
  { code: "GB", name: "United Kingdom", prefix: "+44", flag: "🇬🇧" },
  { code: "DE", name: "Germany", prefix: "+49", flag: "🇩🇪" },
  { code: "FR", name: "France", prefix: "+33", flag: "🇫🇷" },
  { code: "IT", name: "Italy", prefix: "+39", flag: "🇮🇹" },
  { code: "ES", name: "Spain", prefix: "+34", flag: "🇪🇸" },
  { code: "CN", name: "China", prefix: "+86", flag: "🇨🇳" },
  { code: "JP", name: "Japan", prefix: "+81", flag: "🇯🇵" },
  { code: "IN", name: "India", prefix: "+91", flag: "🇮🇳" },
  { code: "AR", name: "Argentina", prefix: "+54", flag: "🇦🇷" },
  { code: "CO", name: "Colombia", prefix: "+57", flag: "🇨🇴" },
  { code: "CL", name: "Chile", prefix: "+56", flag: "🇨🇱" },
  { code: "PE", name: "Peru", prefix: "+51", flag: "🇵🇪" },
  { code: "UY", name: "Uruguay", prefix: "+598", flag: "🇺🇾" },
  { code: "PY", name: "Paraguay", prefix: "+595", flag: "🇵🇾" },
  { code: "VE", name: "Venezuela", prefix: "+58", flag: "🇻🇪" },
  { code: "PA", name: "Panama", prefix: "+507", flag: "🇵🇦" },
  { code: "PT", name: "Portugal", prefix: "+351", flag: "🇵🇹" },
  { code: "NL", name: "Netherlands", prefix: "+31", flag: "🇳🇱" },
  { code: "BE", name: "Belgium", prefix: "+32", flag: "🇧🇪" },
  { code: "CH", name: "Switzerland", prefix: "+41", flag: "🇨🇭" },
  { code: "SE", name: "Sweden", prefix: "+46", flag: "🇸🇪" },
  { code: "NO", name: "Norway", prefix: "+47", flag: "🇳🇴" },
  { code: "AU", name: "Australia", prefix: "+61", flag: "🇦🇺" },
  { code: "NZ", name: "New Zealand", prefix: "+64", flag: "🇳🇿" },
  { code: "ZA", name: "South Africa", prefix: "+27", flag: "🇿🇦" },
];

function parsePhone(phoneStr: string) {
  if (!phoneStr) return { prefix: "+1", rest: "" };
  const sortedCodes = [...COUNTRY_CODES].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const c of sortedCodes) {
    if (phoneStr.startsWith(c.prefix)) {
      const rest = phoneStr.slice(c.prefix.length).trim();
      return { prefix: c.prefix, rest };
    }
  }
  return { prefix: "+1", rest: phoneStr };
}

export default function ShipperManager({ currentUser }: { currentUser: UserProfile }) {
  const [shippers, setShippers] = useState<Shipper[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  // Deletion state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [shipperToDelete, setShipperToDelete] = useState<Shipper | null>(null);
  
  // Modes: 'create' | 'edit' | 'plants'
  const [mode, setMode] = useState<'create' | 'edit' | 'plants'>('create');
  const [selectedShipper, setSelectedShipper] = useState<Shipper | null>(null);

  // Form fields (Shipper info)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phonePrefix, setPhonePrefix] = useState("+1");
  const [phoneRest, setPhoneRest] = useState("");
  const [address, setAddress] = useState("");

  // Form fields (Plant info)
  const [plantName, setPlantName] = useState("");
  const [plantAddress, setPlantAddress] = useState("");
  const [plantPhone, setPlantPhone] = useState("");
  const [plantEmail, setPlantEmail] = useState("");

  const loadShippers = async () => {
    try {
      setLoading(true);
      const data = await apiService.getShippers();
      setShippers(data);
    } catch (err: any) {
      setError("Erro ao carregar Shippers.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (shipper: Shipper) => {
    setShipperToDelete(shipper);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!shipperToDelete) return;
    try {
      setError("");
      await apiService.deleteShipper(shipperToDelete.id);
      setShipperToDelete(null);
      setIsDeleteModalOpen(false);
      await loadShippers();
    } catch (err: any) {
      setError(err.message || "Erro ao excluir Shipper.");
    }
  };

  useEffect(() => {
    loadShippers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setSubmitting(true);
    setError("");
    try {
      const combinedPhone = phoneRest.trim() ? `${phonePrefix} ${phoneRest.trim()}` : "";
      await apiService.addShipper(name, email, combinedPhone, address, []);
      // Reset form
      setName("");
      setEmail("");
      setPhonePrefix("+1");
      setPhoneRest("");
      setAddress("");
      // Refresh list
      await loadShippers();
    } catch (err: any) {
      setError(err.message || "Erro ao adicionar Shipper.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipper || !name.trim()) return;

    setSubmitting(true);
    setError("");
    try {
      const combinedPhone = phoneRest.trim() ? `${phonePrefix} ${phoneRest.trim()}` : "";
      await apiService.updateShipper(selectedShipper.id, {
        name,
        email,
        phone: combinedPhone,
        address
      });
      setMode('create');
      setSelectedShipper(null);
      setName("");
      setEmail("");
      setPhonePrefix("+1");
      setPhoneRest("");
      setAddress("");
      await loadShippers();
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar Shipper.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddPlant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipper || !plantName.trim() || !plantAddress.trim()) return;

    setSubmitting(true);
    setError("");
    try {
      const currentPlants = selectedShipper.plants || [];
      const newPlant: Plant = {
        id: `p-${Date.now()}`,
        name: plantName.trim(),
        address: plantAddress.trim(),
        phone: plantPhone.trim() || undefined,
        email: plantEmail.trim() || undefined
      };

      const updatedPlants = [...currentPlants, newPlant];
      const updatedShipper = await apiService.updateShipper(selectedShipper.id, {
        plants: updatedPlants
      });

      // Update selected state and forms
      setSelectedShipper(updatedShipper);
      setPlantName("");
      setPlantAddress("");
      setPlantPhone("");
      setPlantEmail("");
      await loadShippers();
    } catch (err: any) {
      setError(err.message || "Erro ao cadastrar planta.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemovePlant = async (plantId: string) => {
    if (!selectedShipper) return;

    setError("");
    try {
      const currentPlants = selectedShipper.plants || [];
      const updatedPlants = currentPlants.filter(p => p.id !== plantId);
      const updatedShipper = await apiService.updateShipper(selectedShipper.id, {
        plants: updatedPlants
      });

      setSelectedShipper(updatedShipper);
      await loadShippers();
    } catch (err: any) {
      setError(err.message || "Erro ao remover planta.");
    }
  };

  const startEdit = (shipper: Shipper) => {
    setSelectedShipper(shipper);
    setName(shipper.name);
    setEmail(shipper.email || "");
    const parsed = parsePhone(shipper.phone || "");
    setPhonePrefix(parsed.prefix);
    setPhoneRest(parsed.rest);
    setAddress(shipper.address || "");
    setMode('edit');
    setError("");
  };

  const startPlants = (shipper: Shipper) => {
    setSelectedShipper(shipper);
    setPlantName("");
    setPlantAddress("");
    setPlantPhone("");
    setPlantEmail("");
    setMode('plants');
    setError("");
  };

  const handleCancel = () => {
    setMode('create');
    setSelectedShipper(null);
    setName("");
    setEmail("");
    setPhonePrefix("+1");
    setPhoneRest("");
    setAddress("");
    setError("");
  };

  const filteredShippers = shippers.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (s.address && s.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (s.plants && s.plants.some(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.address.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold font-display text-slate-950 dark:text-white">
              Shipper Registration
            </h1>
            {currentUser?.tenantRole === "operator" && (
              <span className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-750 dark:text-indigo-400 font-bold px-2.5 py-1 rounded-full text-[10px] border border-indigo-100 dark:border-indigo-900/20 shadow-3xs">
                ✓ Operator Access (Active Registration)
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Suppliers and dispatchers responsible for shipping cargo, with support for multiple plants and branches
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Context-aware interactive Form */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xs border border-slate-200 dark:border-slate-700 h-fit">
          <AnimatePresence mode="wait">
            {mode === 'create' && (
              <motion.div
                key="create"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
              >
                <h2 className="text-sm font-bold uppercase tracking-wider font-display text-slate-900 dark:text-white mb-4 flex items-center">
                  <Building2 className="mr-2 h-4 w-4 text-emerald-500" />
                  New Shipper
                </h2>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl text-xs text-red-600 dark:text-red-450 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Global Logistics Corp"
                      className="mt-1.5 block w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="logistics@company.com"
                      className="mt-1.5 block w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Phone Number
                    </label>
                    <div className="mt-1.5 flex rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                      <div className="relative flex items-center border-r border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800">
                        <select
                          value={phonePrefix}
                          onChange={(e) => setPhonePrefix(e.target.value)}
                          className="h-full pl-3 pr-7 py-2.5 bg-transparent text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden cursor-pointer appearance-none"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={`create-${c.code}-${c.prefix}`} value={c.prefix}>
                              {c.flag} {c.prefix}
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-2 pointer-events-none text-slate-400 text-[9px]">
                          ▼
                        </div>
                      </div>
                      <input
                        type="text"
                        value={phoneRest}
                        onChange={(e) => setPhoneRest(e.target.value)}
                        placeholder="e.g., (555) 000-0000"
                        className="block w-full px-3 py-2.5 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Operational Address (Headquarters)
                    </label>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Street, Number, City, State"
                      rows={2}
                      className="mt-1.5 block w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-950 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex justify-center items-center py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm cursor-pointer disabled:opacity-50 shadow-lg hover:shadow-emerald-500/20 active:scale-98 transition-all mt-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                        Registering...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4 font-bold" />
                        Save Shipper
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {mode === 'edit' && (
              <motion.div
                key="edit"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold uppercase tracking-wider font-display text-slate-900 dark:text-white flex items-center">
                    <Edit2 className="mr-2 h-4 w-4 text-amber-500" />
                    Edit Shipper
                  </h2>
                  <button 
                    onClick={handleCancel}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="h-3 w-3" /> Back
                  </button>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl text-xs text-red-600 dark:text-red-450 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleUpdate} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Global Logistics Corp"
                      className="mt-1.5 block w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="logistics@company.com"
                      className="mt-1.5 block w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Phone Number
                    </label>
                    <div className="mt-1.5 flex rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-amber-500">
                      <div className="relative flex items-center border-r border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800">
                        <select
                          value={phonePrefix}
                          onChange={(e) => setPhonePrefix(e.target.value)}
                          className="h-full pl-3 pr-7 py-2.5 bg-transparent text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden cursor-pointer appearance-none"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={`edit-${c.code}-${c.prefix}`} value={c.prefix}>
                              {c.flag} {c.prefix}
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-2 pointer-events-none text-slate-400 text-[9px]">
                          ▼
                        </div>
                      </div>
                      <input
                        type="text"
                        value={phoneRest}
                        onChange={(e) => setPhoneRest(e.target.value)}
                        placeholder="e.g., (555) 000-0000"
                        className="block w-full px-3 py-2.5 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Operational Address (Headquarters)
                    </label>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Street, Number, City, State"
                      rows={2}
                      className="mt-1.5 block w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-sm resize-none"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-bold rounded-xl text-sm cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 flex justify-center items-center py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm cursor-pointer disabled:opacity-50 shadow-lg hover:shadow-amber-500/20 transition-all"
                    >
                      {submitting ? (
                        <Loader2 className="animate-spin h-4 w-4" />
                      ) : (
                        "Save"
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {mode === 'plants' && selectedShipper && (
              <motion.div
                key="plants"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <h2 className="text-sm font-bold uppercase tracking-wider font-display text-slate-900 dark:text-white flex items-center">
                      <Building className="mr-2 h-4 w-4 text-indigo-500" />
                      Plants / Branches
                    </h2>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium truncate max-w-[150px]">{selectedShipper.name}</span>
                  </div>
                  <button 
                    onClick={handleCancel}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="h-3 w-3" /> Back
                  </button>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl text-xs text-red-600 dark:text-red-450 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Sub-form for adding plant */}
                <form onSubmit={handleAddPlant} className="p-3 border border-indigo-100 dark:border-indigo-950/50 rounded-2xl bg-indigo-50/20 dark:bg-indigo-950/5 space-y-2.5">
                  <span className="block text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">New Plant / Branch</span>
                  
                  <div>
                    <input
                      type="text"
                      required
                      value={plantName}
                      onChange={(e) => setPlantName(e.target.value)}
                      placeholder="Identifier (e.g., Extrema-MG Plant)"
                      className="block w-full px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-xs"
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      required
                      value={plantAddress}
                      onChange={(e) => setPlantAddress(e.target.value)}
                      placeholder="Full Address"
                      className="block w-full px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={plantPhone}
                      onChange={(e) => setPlantPhone(e.target.value)}
                      placeholder="Phone (Optional)"
                      className="block w-full px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-xs"
                    />
                    <input
                      type="email"
                      value={plantEmail}
                      onChange={(e) => setPlantEmail(e.target.value)}
                      placeholder="Email (Optional)"
                      className="block w-full px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs cursor-pointer flex justify-center items-center gap-1 transition-colors disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="animate-spin h-3.5 w-3.5" />
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" /> Add Plant
                      </>
                    )}
                  </button>
                </form>

                {/* List of current plants */}
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Registered Plants ({selectedShipper.plants?.length || 0})</span>
                  
                  {!selectedShipper.plants || selectedShipper.plants.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-400 dark:text-slate-500">
                      No secondary plants registered. This company only has its main HQ address.
                    </div>
                  ) : (
                    selectedShipper.plants.map((p) => (
                      <div 
                        key={p.id}
                        className="p-2.5 border border-slate-100 dark:border-slate-700/50 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-start gap-2"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <span className="block font-semibold text-xs text-slate-900 dark:text-white truncate">{p.name}</span>
                          <span className="block text-[10px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-2">{p.address}</span>
                          {(p.phone || p.email) && (
                            <span className="block text-[9px] text-slate-400 dark:text-slate-500 truncate">
                              {p.phone && `📞 ${p.phone}`} {p.phone && p.email && " | "} {p.email && `✉️ ${p.email}`}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePlant(p.id)}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Remove plant"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Listing */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xs border border-slate-200 dark:border-slate-700 flex flex-col h-[580px]">
          {/* Search bar */}
          <div className="relative rounded-xl shadow-xs mb-4">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Shipper by name, plants, email or address..."
              className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm transition-colors"
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-indigo-500 animate-spin mb-2" />
                <span className="text-sm text-slate-400">Loading shippers...</span>
              </div>
            ) : filteredShippers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Building2 className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-2" />
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">No Shipper found</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">Register a new shipper using the form on the left.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredShippers.map((s) => (
                  <motion.div
                    key={s.id}
                    layoutId={`shipper-card-${s.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 border rounded-2xl flex flex-col justify-between transition-colors ${
                      selectedShipper?.id === s.id 
                        ? "border-indigo-400 dark:border-indigo-600 bg-indigo-50/10 dark:bg-indigo-950/10 shadow-xs" 
                        : "border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-700/30"
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1 flex-1">
                          {s.name}
                        </h3>
                        {s.plants && s.plants.length > 0 && (
                          <span className="shrink-0 text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            {s.plants.length} {s.plants.length === 1 ? "plant" : "plants"}
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-2 space-y-1">
                        {s.email && (
                          <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                            <Mail className="h-3.5 w-3.5 mr-1.5 text-slate-400 shrink-0" />
                            <span className="truncate">{s.email}</span>
                          </div>
                        )}
                        {s.phone && (
                          <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                            <Phone className="h-3.5 w-3.5 mr-1.5 text-slate-400 shrink-0" />
                            <span>{s.phone}</span>
                          </div>
                        )}
                        {s.address && (
                          <div className="flex items-start text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <MapPin className="h-3.5 w-3.5 mr-1.5 text-slate-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-2 leading-relaxed">{s.address}</span>
                          </div>
                        )}
                      </div>

                      {/* Small visual render of plants tags */}
                      {s.plants && s.plants.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {s.plants.slice(0, 3).map(p => (
                            <span key={p.id} className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-md truncate max-w-[120px]">
                              🏢 {p.name}
                            </span>
                          ))}
                          {s.plants.length > 3 && (
                            <span className="text-[9px] text-indigo-500 px-1 py-0.5 rounded-md font-semibold">
                              +{s.plants.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/50 flex flex-col gap-2">
                      <div className="flex gap-2">
                        {currentUser?.tenantRole !== "operator" && (
                          <>
                            <button
                              onClick={() => startEdit(s)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                            >
                              <Edit2 className="h-3.5 w-3.5 text-slate-400" />
                              Edit
                            </button>
                            <button
                              onClick={() => startPlants(s)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-450 transition-colors cursor-pointer"
                            >
                              <Building className="h-3.5 w-3.5 text-indigo-400" />
                              Plants ({s.plants?.length || 0})
                            </button>
                          </>
                        )}
                        {(currentUser?.tenantRole === "owner" || currentUser?.platformRole === "superadmin") && (
                          <button
                            onClick={() => handleDeleteClick(s)}
                            className="p-2 border border-rose-250 hover:bg-rose-50 dark:border-rose-900/30 dark:hover:bg-rose-950/20 text-rose-650 dark:text-rose-400 rounded-xl transition-colors cursor-pointer"
                            title="Delete Shipper"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-slate-400 uppercase mt-1 font-mono">
                        <span>ID: {s.id}</span>
                        <span>
                          {new Date(s.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setShipperToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Shipper"
        itemName={shipperToDelete ? shipperToDelete.name : ""}
        expectedConfirmation="DELETE"
      />
    </div>
  );
}
