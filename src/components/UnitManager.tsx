import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";
import { Unit, UserProfile } from "../types";
import DeleteConfirmationModal from "./DeleteConfirmationModal";
import { UnitThemeProvider } from "./UnitThemeProvider";
import { 
  Plus, 
  MapPin, 
  Settings, 
  Palette, 
  Globe, 
  Layers, 
  Loader2, 
  AlertCircle, 
  Edit2, 
  Check, 
  Trash2,
  Sliders,
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

export default function UnitManager({ currentUser }: { currentUser: UserProfile }) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modals / Modes
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [region, setRegion] = useState<string>("Estados Unidos");
  const [unitSystem, setUnitSystem] = useState<"imperial" | "metric">("imperial");
  const [primaryColor, setPrimaryColor] = useState("#4f46e5");
  const [accentColor, setAccentColor] = useState("#06b6d4");

  // Deletion Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);

  useEffect(() => {
    loadUnits();
  }, []);

  const loadUnits = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiService.getUnits();
      setUnits(data);
    } catch (err: any) {
      setError("Erro ao carregar as unidades.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingUnit(null);
    setName("");
    setRegion("América");
    setUnitSystem("imperial");
    setPrimaryColor("#4f46e5");
    setAccentColor("#06b6d4");
    setError("");
    setSuccess("");
    setIsOpenModal(true);
  };

  const handleOpenEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setName(unit.name);
    setRegion(unit.region || "América");
    setUnitSystem(unit.unitSystem || "imperial");
    setPrimaryColor(unit.theme.primary);
    setAccentColor(unit.theme.accent);
    setError("");
    setSuccess("");
    setIsOpenModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("O nome da unidade é obrigatório.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const payload = {
        name: name.trim(),
        region: region.trim(),
        unitSystem,
        theme: {
          primary: primaryColor,
          accent: accentColor,
        },
      };

      if (editingUnit) {
        await apiService.updateUnit(editingUnit.id, payload as any);
        setSuccess("Unidade atualizada com sucesso!");
      } else {
        await apiService.addUnit(payload as any);
        setSuccess("Unidade cadastrada com sucesso!");
      }

      await loadUnits();
      setTimeout(() => setIsOpenModal(false), 800);
    } catch (err: any) {
      setError(err.message || "Erro ao salvar a unidade.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = (unit: Unit) => {
    setUnitToDelete(unit);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!unitToDelete) return;
    try {
      setError("");
      await apiService.deleteUnit(unitToDelete.id);
      await loadUnits();
      setIsDeleteModalOpen(false);
      setUnitToDelete(null);
    } catch (err: any) {
      setError(err.message || "Erro ao excluir a unidade.");
    }
  };

  const selectPreset = (preset: typeof THEME_PRESETS[0]) => {
    setPrimaryColor(preset.primary);
    setAccentColor(preset.accent);
  };

  if (currentUser.tenantRole !== "owner") {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center" id="owner-only-warning">
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-6 text-amber-800 dark:text-amber-200 inline-block">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
          <h2 className="text-lg font-bold font-display mb-1">Acesso Restrito</h2>
          <p className="text-sm">Apenas usuários administradores com perfil <strong>Owner (Proprietário)</strong> podem gerenciar as filiais self-service.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6" id="unit-manager-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-display flex items-center gap-2">
            <Layers className="h-6 w-6 text-indigo-500" />
            Minhas Unidades (Self-Service)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Cadastre e customize filiais/warehouses para o seu tenant, definindo o sistema métrico e identidade visual.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="cursor-pointer inline-flex items-center justify-center py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-indigo-600/15 hover:shadow-indigo-600/25 active:scale-98"
          id="btn-add-unit"
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Unidade
        </button>
      </div>

      {/* Main Panel Error */}
      {error && !isOpenModal && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid of existing units */}
      {loading ? (
        <div className="flex items-center justify-center py-16" id="units-loading">
          <Loader2 className="animate-spin h-8 w-8 text-indigo-500" />
        </div>
      ) : units.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl" id="units-empty">
          <Layers className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Nenhuma unidade cadastrada</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Sua conta de proprietário não possui filiais registradas. Clique em "Adicionar Unidade" para criar a primeira!
          </p>
          <button
            onClick={handleOpenCreate}
            className="cursor-pointer mt-4 py-2 px-4 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white font-semibold rounded-xl text-xs hover:bg-slate-800 transition-colors"
          >
            Começar Agora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="units-grid">
          {units.map((unit) => (
            <motion.div
              key={unit.id}
              layout
              className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between"
              id={`unit-card-${unit.id}`}
            >
              {/* Dynamic Top Theme Bar */}
              <div 
                className="absolute top-0 left-0 right-0 h-1.5" 
                style={{ background: `linear-gradient(90deg, ${unit.theme.primary}, ${unit.theme.accent})` }}
              />

              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2 mt-2">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white font-display text-lg">
                      {unit.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                      <Globe className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      <span>{unit.region}</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-md bg-slate-50 dark:bg-slate-700/50 px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700">
                    {unit.unitSystem === "imperial" ? "Imperial (Lbs/In)" : "Métrico (Kgs/Cm)"}
                  </span>
                </div>

                {/* Theme Palette Indicator */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl space-y-2">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                    <Palette className="h-3 w-3 text-indigo-400" />
                    Identidade Visual
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-xs" style={{ backgroundColor: unit.theme.primary }} />
                      <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{unit.theme.primary}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-xs" style={{ backgroundColor: unit.theme.accent }} />
                      <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{unit.theme.accent}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-700/50 pt-4 mt-5">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  ID: {unit.id}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(unit)}
                    className="cursor-pointer p-2 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors"
                    title="Editar Unidade"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleConfirmDelete(unit)}
                    className="cursor-pointer p-2 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    title="Remover Unidade"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {isOpenModal && (
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
                style={{ background: `linear-gradient(90deg, ${primaryColor}, ${accentColor})` }}
              />

              <div className="flex items-center justify-between mb-4 mt-2">
                <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-indigo-500" />
                  {editingUnit ? "Editar Unidade" : "Cadastrar Nova Unidade"}
                </h2>
                <button
                  onClick={() => setIsOpenModal(false)}
                  className="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-semibold p-1"
                >
                  ✕
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl text-xs text-red-600 dark:text-red-450 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Nome da Filial / Warehouse *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
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
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
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
                        onClick={() => selectPreset(preset)}
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
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent shrink-0"
                        />
                        <input
                          type="text"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
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
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent shrink-0"
                        />
                        <input
                          type="text"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          maxLength={7}
                          className="w-full bg-transparent text-xs font-mono text-slate-800 dark:text-white uppercase focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Theme Preview Card */}
                <UnitThemeProvider unit={{
                  id: "temp-preview",
                  tenantId: "",
                  name: name || "Minha Filial",
                  region,
                  unitSystem,
                  theme: {
                    primary: primaryColor,
                    accent: accentColor
                  },
                  createdAt: "",
                  isActive: true
                }}>
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-3">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-accent" />
                      Preview em Tempo Real
                    </div>
                    
                    {/* Mock UI elements styled with picked colors */}
                    <div className="bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl p-3 shadow-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-white">
                          {name || "Minha Filial"}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white bg-accent">
                          {unitSystem === "imperial" ? "Lbs/Inches" : "Kgs/Cms"}
                        </span>
                      </div>
                      
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          className="px-3 py-1.5 text-[11px] font-semibold text-white rounded-lg transition-opacity flex-1 bg-primary hover:opacity-90"
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
                </UnitThemeProvider>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOpenModal(false)}
                    className="cursor-pointer flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-sm transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="cursor-pointer flex-1 py-2.5 px-4 text-white font-bold rounded-xl text-sm transition-all shadow-md active:scale-98 disabled:opacity-50 flex items-center justify-center gap-1.5"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4" />
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

      {/* Delete Confirmation */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        title="Delete Unit"
        itemName={unitToDelete?.name || ""}
        onConfirm={handleDelete}
        onClose={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}
