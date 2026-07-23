import React, { useState, useEffect, useRef } from "react";
import { apiService } from "../services/api";
import { Shipper, Consignee, UserProfile, ReceiptItem, WarehouseReceipt, PoInvoiceRow } from "../types";
import { 
  Camera, 
  Trash2, 
  Barcode, 
  UserCheck, 
  CheckCircle2, 
  Sparkles, 
  Loader2, 
  AlertCircle,
  Video,
  VideoOff,
  Plus,
  Box,
  Sliders,
  CheckSquare,
  Square,
  ArrowLeft,
  FileText,
  Upload,
  ChevronDown,
  MapPin
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface WarehouseReceiptFormProps {
  currentUser: UserProfile | null;
  onSuccess: () => void;
  existingReceipt?: WarehouseReceipt;
  activeUnit: string;
}

const HANDLING_OPTIONS = [
  "Commercial Invoice",
  "Pkg List",
  "Heat Treated",
  "Hazardous",
  "Haz Documents",
  "Fragile",
  "Pallets",
  "Extra Length",
  "Extra Width",
  "Extra Height",
  "Extra Heavy",
  "Haz Labels",
  "Improper Doc",
  "Inbond"
];

const ITEM_TYPE_OPTIONS = [
  { value: "BOX", description: "Caixas em geral: insumos, peças menores, suprimentos" },
  { value: "PALLET", description: "Paletes padrão de madeira ou plástico" },
  { value: "SKID", description: "Plataformas pesadas para motores e geradores da OOS" },
  { value: "CRATE", description: "Engradados fechados de madeira para equipamentos caros" },
  { value: "STEEL PLATE", description: "Placas de aço - essencial para a manutenção naval" },
  { value: "STEEL ANGLE", description: "Cantoneiras de aço / Perfis estruturais" },
  { value: "PIPE / TUBE", description: "Tubulações, eixos e cilindros hidráulicos" },
  { value: "ENVELOPE", description: "Envelopes com documentos, packlists originais ou mailings" },
  { value: "PIECE", description: "Peças soltas ou componentes individuais" },
  { value: "DRUM / BARREL", description: "Tambores para óleos, tintas náuticas ou fluidos" },
  { value: "BUNDLE", description: "Amarrados/Feixes de cabos de aço, correntes ou barras" },
  { value: "MACHINERY / EQUIPMENT", description: "Maquinários completos, fritadeiras ou motores" },
  { value: "COIL / REEL", description: "Bobinas ou carretéis de cabos/mangueiras" },
  { value: "OTHER", description: "Outros" }
];

export default function WarehouseReceiptForm({ currentUser, onSuccess, existingReceipt, activeUnit }: WarehouseReceiptFormProps) {
  const [shippers, setShippers] = useState<Shipper[]>([]);
  const [consignees, setConsignees] = useState<Consignee[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  
  // REQUIRED FIELDS
  const [shipperId, setShipperId] = useState("");
  const [shipperAddress, setShipperAddress] = useState("");
  const [shipperPhone, setShipperPhone] = useState("");
  
  const [consigneeId, setConsigneeId] = useState("");
  const [consigneeAddress, setConsigneeAddress] = useState("");
  const [consigneePhone, setConsigneePhone] = useState("");

  // Plant selection states
  const [shipperPlantId, setShipperPlantId] = useState("");
  const [consigneePlantId, setConsigneePlantId] = useState("");

  // Entry date, Expires, Location States (Horizontal fields)
  const [dateIn, setDateIn] = useState(() => new Date().toISOString().split("T")[0]);
  const [expires, setExpires] = useState("N/A");
  const [location, setLocation] = useState("MAIN");
  
  const [proNumbers, setProNumbers] = useState("");
  const [poInvoices, setPoInvoices] = useState<PoInvoiceRow[]>([
    { poNumber: "", invoiceNumber: "", amount: "" }
  ]);
  
  // ITEMS (Default with 1 box of standard size)
  const [items, setItems] = useState<ReceiptItem[]>([
    { qty: 1, type: "BOX", len: 12, wid: 12, hgt: 12, weight: 1.0, unit: "Lbs", cubic: 1.0, cubicUnit: "Cft", bin: "", location: "", cargoCondition: "" }
  ]);
  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null);
  
  // HANDLING CHECKLIST (OPTIONAL)
  const [handling, setHandling] = useState<string[]>([]);
  
  // COMMENTS / OBSERVATIONS
  const [comments, setComments] = useState("");
  
  // MEDIA & WEBCAM
  const [photos, setPhotos] = useState<string[]>([]);
  const [showLiveWebcam, setShowLiveWebcam] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const packlistInputRef = useRef<HTMLInputElement | null>(null);
  
  // IA PARSING (OPTIONAL)
  const [geminiAnalyzing, setGeminiAnalyzing] = useState(false);
  const [geminiBanner, setGeminiBanner] = useState("");
  const [geminiError, setGeminiError] = useState(false);
  const [detectedPartnerInfo, setDetectedPartnerInfo] = useState<string | null>(null);
  
  // STATUSES
  const [submitting, setSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [error, setError] = useState("");

  // Load shippers and consignees
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingLists(true);
        const [shippersList, consigneesList] = await Promise.all([
          apiService.getShippers(),
          apiService.getConsignees()
        ]);
        setShippers(shippersList);
        setConsignees(consigneesList);
      } catch (err) {
        setError("Não foi possível carregar as listas de Shippers e Consignees.");
      } finally {
        setLoadingLists(false);
      }
    }
    loadData();
  }, []);

  // Prepopulate if editing
  useEffect(() => {
    if (existingReceipt) {
      setShipperId(existingReceipt.shipperId);
      setShipperAddress(existingReceipt.shipperAddress || "");
      setShipperPhone(existingReceipt.shipperPhone || "");
      setConsigneeId(existingReceipt.consigneeId);
      setConsigneeAddress(existingReceipt.consigneeAddress || "");
      setConsigneePhone(existingReceipt.consigneePhone || "");
      
      setDateIn(existingReceipt.dateIn || new Date(existingReceipt.createdAt || new Date()).toISOString().split("T")[0]);
      setExpires(existingReceipt.expires || "N/A");
      setLocation(existingReceipt.location || "MAIN");
      
      setProNumbers(existingReceipt.proNumbers || existingReceipt.trackingNumber || "");
      
      const loadedItems = (existingReceipt.items || []).map(item => ({
        ...item,
        cargoCondition: item.cargoCondition || ""
      }));
      setItems(loadedItems.length > 0 ? loadedItems : [{ qty: 1, type: "BOX", len: 12, wid: 12, hgt: 12, weight: 1.0, unit: "Lbs", cubic: 1.0, cubicUnit: "Cft", bin: "", location: "", cargoCondition: "" }]);
      setHandling(existingReceipt.handling || []);
      setComments(existingReceipt.comments || "");
      setPoInvoices(existingReceipt.poInvoices && existingReceipt.poInvoices.length > 0 ? existingReceipt.poInvoices : [{ poNumber: "", invoiceNumber: "", amount: "" }]);
      
      if (existingReceipt.photoUrls && Array.isArray(existingReceipt.photoUrls)) {
        setPhotos(existingReceipt.photoUrls.filter(url => url !== "CLEANED_UP" && url !== "ARCHIVED"));
      } else if (existingReceipt.photoUrl && existingReceipt.photoUrl !== "CLEANED_UP" && existingReceipt.photoUrl !== "ARCHIVED" && !existingReceipt.photoUrl.startsWith("/uploads/sample_box")) {
        setPhotos([existingReceipt.photoUrl]);
      } else {
        setPhotos([]);
      }
    }
  }, [existingReceipt]);

  // BARCODE / TRACKING SCANNER LISTENER (USB / BLUETOOTH SCANNER)
  const [scannedFeedback, setScannedFeedback] = useState<string | null>(null);
  const barcodeBufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if modifier keys are active
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Enter key marks end of scan sequence
      if (e.key === "Enter") {
        if (barcodeBufferRef.current.length >= 3 && timeSinceLastKey < 80) {
          const scannedText = barcodeBufferRef.current.trim();
          if (scannedText) {
            e.preventDefault();
            e.stopPropagation();

            setProNumbers((prev) => {
              if (!prev || !prev.trim()) return scannedText;
              if (prev.includes(scannedText)) return prev;
              return `${prev}, ${scannedText}`;
            });

            setScannedFeedback(scannedText);
            setTimeout(() => setScannedFeedback(null), 5000);
          }
        }
        barcodeBufferRef.current = "";
        return;
      }

      // Single printable character
      if (e.key.length === 1) {
        if (timeSinceLastKey > 120) {
          barcodeBufferRef.current = "";
        }
        barcodeBufferRef.current += e.key;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Reactive matching for Shipper and Consignee Plants when lists are loaded
  useEffect(() => {
    if (existingReceipt && shippers.length > 0) {
      const matchedShipper = shippers.find(s => s.id === existingReceipt.shipperId);
      if (matchedShipper && matchedShipper.plants && matchedShipper.plants.length > 0) {
        const foundPlant = matchedShipper.plants.find(p => 
          existingReceipt.shipperAddress?.includes(p.name) || 
          existingReceipt.shipperAddress?.includes(p.address)
        );
        if (foundPlant) {
          setShipperPlantId(foundPlant.id);
        } else {
          setShipperPlantId("main");
        }
      } else {
        setShipperPlantId("");
      }
    }
  }, [existingReceipt, shippers]);

  useEffect(() => {
    if (existingReceipt && consignees.length > 0) {
      const matchedConsignee = consignees.find(c => c.id === existingReceipt.consigneeId);
      if (matchedConsignee && matchedConsignee.plants && matchedConsignee.plants.length > 0) {
        const foundPlant = matchedConsignee.plants.find(p => 
          existingReceipt.consigneeAddress?.includes(p.name) || 
          existingReceipt.consigneeAddress?.includes(p.address)
        );
        if (foundPlant) {
          setConsigneePlantId(foundPlant.id);
        } else {
          setConsigneePlantId("main");
        }
      } else {
        setConsigneePlantId("");
      }
    }
  }, [existingReceipt, consignees]);

  // Handle dropdown selections
  const handleShipperChange = (id: string) => {
    setShipperId(id);
    setShipperPlantId("");
    const selected = shippers.find(s => s.id === id);
    if (selected) {
      setShipperAddress(selected.address || "");
      setShipperPhone(selected.phone || "");
      if (selected.plants && selected.plants.length > 0) {
        setShipperPlantId("main");
      }
    } else {
      setShipperAddress("");
      setShipperPhone("");
    }
  };

  const handleConsigneeChange = (id: string) => {
    setConsigneeId(id);
    setConsigneePlantId("");
    const selected = consignees.find(c => c.id === id);
    if (selected) {
      setConsigneeAddress(selected.address || "");
      setConsigneePhone(selected.phone || "");
      if (selected.plants && selected.plants.length > 0) {
        setConsigneePlantId("main");
      }
    } else {
      setConsigneeAddress("");
      setConsigneePhone("");
    }
  };

  const handleShipperPlantChange = (plantId: string) => {
    setShipperPlantId(plantId);
    const selectedShipper = shippers.find(s => s.id === shipperId);
    if (!selectedShipper) return;

    if (plantId === "main" || !plantId) {
      setShipperAddress(selectedShipper.address || "");
      setShipperPhone(selectedShipper.phone || "");
    } else {
      const plant = selectedShipper.plants?.find(p => p.id === plantId);
      if (plant) {
        setShipperAddress(`${plant.name}\n${plant.address}`);
        setShipperPhone(plant.phone || selectedShipper.phone || "");
      }
    }
  };

  const handleConsigneePlantChange = (plantId: string) => {
    setConsigneePlantId(plantId);
    const selectedConsignee = consignees.find(c => c.id === consigneeId);
    if (!selectedConsignee) return;

    if (plantId === "main" || !plantId) {
      setConsigneeAddress(selectedConsignee.address || "");
      setConsigneePhone(selectedConsignee.phone || "");
    } else {
      const plant = selectedConsignee.plants?.find(p => p.id === plantId);
      if (plant) {
        setConsigneeAddress(`${plant.name}\n${plant.address}`);
        setConsigneePhone(plant.phone || selectedConsignee.phone || "");
      }
    }
  };

  // Toggle handling options
  const toggleHandling = (option: string) => {
    if (handling.includes(option)) {
      setHandling(handling.filter(h => h !== option));
    } else {
      setHandling([...handling, option]);
    }
  };

  // Items dynamic CRUD
  const addItemRow = () => {
    setItems([
      ...items,
      { qty: 1, type: "BOX", len: 12, wid: 12, hgt: 12, weight: 1.0, unit: "Lbs", cubic: 1.0, cubicUnit: "Cft", bin: "", location: "", cargoCondition: "" }
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItemRow = (index: number, field: keyof ReceiptItem, value: any) => {
    const updated = items.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [field]: value };
        
        // Auto-calculate volume on dimension modifications
        const qty = Number(updatedItem.qty) || 0;
        const len = Number(updatedItem.len) || 0;
        const wid = Number(updatedItem.wid) || 0;
        const hgt = Number(updatedItem.hgt) || 0;
        
        const totalCubicInches = len * wid * hgt * qty;
        const cubicFt = Number((totalCubicInches / 1728).toFixed(2));
        
        updatedItem.cubic = cubicFt;
        updatedItem.cubicUnit = "Cft";
        return updatedItem;
      }
      return item;
    });
    setItems(updated);
  };

  // PO Invoices dynamic CRUD
  const addPoRow = () => {
    setPoInvoices([
      ...poInvoices,
      { poNumber: "", invoiceNumber: "", amount: "" }
    ]);
  };

  const removePoRow = (index: number) => {
    setPoInvoices(poInvoices.filter((_, i) => i !== index));
  };

  const updatePoRow = (index: number, field: keyof PoInvoiceRow, value: string) => {
    const updated = poInvoices.map((po, i) => {
      if (i === index) {
        return { ...po, [field]: value };
      }
      return po;
    });
    setPoInvoices(updated);
  };

  // Real-time calculations of totals
  const totals = React.useMemo(() => {
    let totalPieces = 0;
    let totalWeightLbs = 0;
    let totalCubicCft = 0;
    let totalVolWeightLbs = 0;

    items.forEach(item => {
      const q = Number(item.qty) || 0;
      const w = Number(item.weight) || 0;
      const l = Number(item.len) || 0;
      const wi = Number(item.wid) || 0;
      const h = Number(item.hgt) || 0;

      totalPieces += q;
      
      if (item.unit === "Lbs") {
        totalWeightLbs += w * q;
      } else {
        totalWeightLbs += (w * 2.20462) * q;
      }

      const cubicFt = (l * wi * h * q) / 1728;
      totalCubicCft += cubicFt;

      const volLbs = (l * wi * h * q) / 166;
      totalVolWeightLbs += volLbs;
    });

    const totalWeightKgs = totalWeightLbs * 0.453592;
    const totalCubicCbm = totalCubicCft * 0.0283168;
    const totalVolWeightKgs = totalVolWeightLbs * 0.453592;

    return {
      totalPieces,
      totalWeightLbs: Number(totalWeightLbs.toFixed(1)),
      totalWeightKgs: Number(totalWeightKgs.toFixed(1)),
      totalVolWeightLbs: Number(totalVolWeightLbs.toFixed(1)),
      totalVolWeightKgs: Number(totalVolWeightKgs.toFixed(1)),
      totalCubicCft: Number(totalCubicCft.toFixed(2)),
      totalCubicCbm: Number(totalCubicCbm.toFixed(2))
    };
  }, [items]);

  // Submit Simplified WR
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipperId) {
      setError("Por favor, selecione o Shipper (Remetente).");
      return;
    }
    if (!consigneeId) {
      setError("Por favor, selecione o Consignee (Destinatário).");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const newUploads = photos.filter(p => p.startsWith("data:image") || p.startsWith("data:application/pdf"));
      const keptUrls = photos.filter(p => !p.startsWith("data:image") && !p.startsWith("data:application/pdf"));

      const receiptPayload = {
        shipperId,
        shipperAddress,
        shipperPhone,
        consigneeId,
        consigneeAddress,
        consigneePhone,
        shipperPlantId: shipperPlantId || null,
        consigneePlantId: consigneePlantId || null,
        photoBase64s: newUploads,
        photoUrls: keptUrls,
        unit: existingReceipt ? (existingReceipt.unit || activeUnit) : activeUnit,
        unitId: existingReceipt ? (existingReceipt.unitId || localStorage.getItem("active_unit") || activeUnit) : (localStorage.getItem("active_unit") || activeUnit),
        
        dateIn,
        expires,
        location,
        via: existingReceipt ? existingReceipt.via : "AIR",
        service: existingReceipt ? existingReceipt.service : "CONSOLIDADO",
        carrier: existingReceipt ? existingReceipt.carrier : "N/A",
        origin: existingReceipt ? existingReceipt.origin : "MIA",
        dest: existingReceipt ? existingReceipt.dest : "SAO",
        
        handling,
        poInvoices: poInvoices.filter(po => po.poNumber.trim() !== "" || po.invoiceNumber.trim() !== "" || po.amount.trim() !== ""),
        proNumbers,
        
        items: items.map(item => ({
          ...item,
          qty: Number(item.qty) || 1,
          len: Number(item.len) || 0,
          wid: Number(item.wid) || 0,
          hgt: Number(item.hgt) || 0,
          weight: Number(item.weight) || 0,
          cubic: Number(item.cubic) || 0,
          cargoCondition: item.cargoCondition || ""
        })),
        
        ...totals,
        comments: comments.trim() || "Carga recebida.",
        operatorEmail: existingReceipt ? existingReceipt.operatorEmail : (currentUser?.email || "operator@logistic.com")
      };

      if (existingReceipt) {
        await apiService.updateReceipt(existingReceipt.id, receiptPayload);
      } else {
        await apiService.createReceipt(receiptPayload);
      }

      setFormSuccess(true);
      
      // Reset State
      setShipperId("");
      setShipperAddress("");
      setShipperPhone("");
      setConsigneeId("");
      setConsigneeAddress("");
      setConsigneePhone("");
      setShipperPlantId("");
      setConsigneePlantId("");
      setDateIn(new Date().toISOString().split("T")[0]);
      setExpires("N/A");
      setLocation("MAIN");
      setPhotos([]);
      setHandling([]);
      setComments("");
      setProNumbers("");
      setPoInvoices([{ poNumber: "", invoiceNumber: "", amount: "" }]);
      setItems([{ qty: 1, type: "BOX", len: 12, wid: 12, hgt: 12, weight: 1.0, unit: "Lbs", cubic: 1.0, cubicUnit: "Cft", bin: "", location: "", cargoCondition: "" }]);

      setTimeout(() => {
        setFormSuccess(false);
        onSuccess();
      }, 2000);

    } catch (err: any) {
      setError(err.message || "Erro ao registrar o Warehouse Receipt.");
    } finally {
      setSubmitting(false);
    }
  };

  // OCR scanning with Gemini API
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    (Array.from(files) as File[]).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          setPhotos(prev => [...prev, base64]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePacklistFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setPhotos(prev => [...prev, base64]);
        triggerGeminiAnalysis(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const startWebcam = async () => {
    setShowLiveWebcam(true);
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access failed:", err);
      setError("Não foi possível acessar a câmera do dispositivo. Use o botão de upload padrão.");
      setShowLiveWebcam(false);
    }
  };

  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowLiveWebcam(false);
  };

  const captureWebcamPhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL("image/jpeg");
      setPhotos(prev => [...prev, base64]);
      stopWebcam();
    }
  };

  const triggerGeminiAnalysis = async (base64: string) => {
    setGeminiAnalyzing(true);
    setGeminiError(false);
    const isFilePdf = base64.startsWith("data:application/pdf");
    setGeminiBanner(isFilePdf ? "Lendo arquivo PDF / Packing List com IA..." : "Analisando etiqueta com Inteligência Artificial...");
    setDetectedPartnerInfo(null);
    try {
      const extracted = await apiService.extractReceiptFields(base64);
      if (extracted) {
        if (extracted.proNumbers) setProNumbers(extracted.proNumbers);
        
        if (extracted.poInvoices && Array.isArray(extracted.poInvoices) && extracted.poInvoices.length > 0) {
          setPoInvoices(extracted.poInvoices.map((po: any) => ({
            poNumber: po.poNumber || "",
            invoiceNumber: po.invoiceNumber || "",
            amount: po.amount || ""
          })));
        }

        if (extracted.handling && Array.isArray(extracted.handling)) {
          const validHandling = extracted.handling.filter((h: string) => 
            HANDLING_OPTIONS.some(option => option.toLowerCase() === h.toLowerCase())
          );
          setHandling(validHandling);
        }

        if (extracted.items && Array.isArray(extracted.items) && extracted.items.length > 0) {
          setItems(extracted.items.map((item: any) => {
            const qty = Number(item.qty) || 1;
            const len = Number(item.len) || 12;
            const wid = Number(item.wid) || 12;
            const hgt = Number(item.hgt) || 12;
            const totalCubicInches = len * wid * hgt * qty;
            const cubicFt = Number((totalCubicInches / 1728).toFixed(2));
            
            return {
              qty,
              type: ITEM_TYPE_OPTIONS.some(opt => opt.value === item.type?.toUpperCase()) ? item.type.toUpperCase() : "BOX",
              len,
              wid,
              hgt,
              weight: Number(item.weight) || 1.0,
              unit: item.unit === "Kgs" ? "Kgs" : "Lbs",
              cubic: cubicFt,
              cubicUnit: "Cft",
              bin: "",
              location: ""
            };
          }));
        }

        let prefillDetails = [];
        if (extracted.shipperName) {
          prefillDetails.push(`Shipper detectado: "${extracted.shipperName}"`);
          const matchedShipper = shippers.find(s => 
            s.name.toLowerCase().includes(extracted.shipperName.toLowerCase()) || 
            extracted.shipperName.toLowerCase().includes(s.name.toLowerCase())
          );
          if (matchedShipper) {
            setShipperId(matchedShipper.id);
            setShipperAddress(extracted.shipperAddress || matchedShipper.address || "");
            setShipperPhone(extracted.shipperPhone || matchedShipper.phone || "");
            prefillDetails.push(`✅ Shipper selecionado automaticamente.`);
          } else {
            setShipperAddress(extracted.shipperAddress || "");
            setShipperPhone(extracted.shipperPhone || "");
            prefillDetails.push(`⚠️ Remetente novo ou não cadastrado.`);
          }
        }

        if (extracted.consigneeName) {
          prefillDetails.push(`Consignee detectado: "${extracted.consigneeName}"`);
          const matchedConsignee = consignees.find(c => 
            c.name.toLowerCase().includes(extracted.consigneeName.toLowerCase()) ||
            extracted.consigneeName.toLowerCase().includes(c.name.toLowerCase())
          );
          if (matchedConsignee) {
            setConsigneeId(matchedConsignee.id);
            setConsigneeAddress(extracted.consigneeAddress || matchedConsignee.address || "");
            setConsigneePhone(extracted.consigneePhone || matchedConsignee.phone || "");
            prefillDetails.push(`✅ Consignee selecionado automaticamente.`);
          } else {
            setConsigneeAddress(extracted.consigneeAddress || "");
            setConsigneePhone(extracted.consigneePhone || "");
            prefillDetails.push(`⚠️ Destinatário novo ou não cadastrado.`);
          }
        }

        setDetectedPartnerInfo(prefillDetails.join("\n"));
        setGeminiBanner("Dados lidos com sucesso pela IA!");
        setTimeout(() => setGeminiBanner(""), 4000);
      } else {
        setGeminiBanner("IA concluiu sem encontrar dados compatíveis.");
        setTimeout(() => setGeminiBanner(""), 4000);
      }
    } catch (err: any) {
      console.error("Gemini processing failed:", err);
      setGeminiError(true);
      setGeminiBanner("Processamento inteligente temporariamente indisponível - digite manualmente");
      setTimeout(() => {
        setGeminiBanner(prev => prev === "Processamento inteligente temporariamente indisponível - digite manualmente" ? "" : prev);
      }, 10000);
    } finally {
      setGeminiAnalyzing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* SUCCESS POPUP */}
      <AnimatePresence>
        {formSuccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-800 p-8 rounded-3xl text-center shadow-2xl max-w-sm w-full border border-slate-100 dark:border-slate-700"
            >
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 mb-4 animate-bounce">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-xl font-bold font-display text-slate-900 dark:text-white">
                {existingReceipt ? "Warehouse Receipt Atualizado!" : "Warehouse Receipt Criado!"}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                {existingReceipt ? "O recibo foi atualizado com sucesso no banco de dados." : "O recibo simplificado foi gravado e todos os cálculos automáticos foram gerados."}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight text-slate-900 dark:text-white">
            {existingReceipt ? `Edição de Warehouse Receipt (${existingReceipt.number})` : "Lançamento de Mercadoria (Warehouse Receipt)"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
            {existingReceipt ? "Atualize as informações do recibo abaixo. Os cálculos são recalculados automaticamente." : "Insira os dados de parceiros, notas e cubagem. O sistema calcula pesos dimensionais e cubagem de forma automática."}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-2xl text-xs font-semibold text-red-600 dark:text-red-450 flex items-center gap-2.5">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* MAIN SINGLE-SCREEN FORM */}
      <form onSubmit={handleFormSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* METADATA HORIZONTAL BAR - Full Width */}
        <div className="lg:col-span-12 bg-slate-900 text-slate-100 p-5 rounded-3xl shadow-lg border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <Sliders className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <span className="font-display font-extrabold text-sm text-white block">Metadados do Recebimento</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">Informações de Registro e Localização</span>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-5 w-full md:w-auto font-mono text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <span className="text-slate-400 font-extrabold text-[10px] uppercase tracking-wider shrink-0">DATE IN:</span>
              <input
                type="date"
                required
                value={dateIn}
                onChange={(e) => setDateIn(e.target.value)}
                className="bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <span className="text-slate-400 font-extrabold text-[10px] uppercase tracking-wider shrink-0">EXPIRES:</span>
              <input
                type="text"
                required
                placeholder="Ex: N/A ou Data"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
                className="bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 font-bold text-xs w-full sm:w-28"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <span className="text-slate-400 font-extrabold text-[10px] uppercase tracking-wider shrink-0">LOCATION:</span>
              <input
                type="text"
                required
                placeholder="Ex: MAIN"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 font-bold text-xs w-full sm:w-28"
              />
            </div>
          </div>
        </div>
        
        {/* LEFT COMPONENT COLUMN (Core Fields, POs, Cargo measurements) - Spans 8 of 12 columns */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* STEP 1: PARCEIROS E RASTREIO CARD */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xs border border-slate-150 dark:border-slate-700/50 space-y-5">
            <h3 className="text-sm font-extrabold font-display text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-3">
              <UserCheck className="h-5 w-5 text-indigo-500" />
              1. Informações de Envio & Parceiros
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Shipper selector */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-500">
                  Shipper (Remetente / Fornecedor) *
                </label>
                {loadingLists ? (
                  <div className="py-2.5 px-3 bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                    <span className="text-xs text-slate-400">Carregando shippers...</span>
                  </div>
                ) : (
                  <select
                    required
                    value={shipperId}
                    onChange={(e) => handleShipperChange(e.target.value)}
                    className="block w-full py-2.5 px-3 border border-slate-200 dark:border-slate-650 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-bold cursor-pointer"
                  >
                    <option value="">Selecione o Shipper...</option>
                    {shippers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
                {shipperId && shippers.find(s => s.id === shipperId)?.plants?.length ? (
                  <div className="space-y-1 mt-1">
                    <label className="block text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Planta / Filial do Shipper
                    </label>
                    <select
                      value={shipperPlantId}
                      onChange={(e) => handleShipperPlantChange(e.target.value)}
                      className="block w-full py-1.5 px-2.5 border border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20 text-slate-900 dark:text-white rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
                    >
                      <option value="">Matriz (Endereço Principal)</option>
                      {shippers.find(s => s.id === shipperId)?.plants?.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.city}, {p.state})</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {shipperId && (
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-750/30 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-700 leading-relaxed">
                    <span className="font-bold block text-slate-400 text-[8px] uppercase tracking-wider mb-0.5">Endereço do Remetente</span>
                    📍 {shipperAddress || "Sem endereço cadastrado"}
                    {shipperPhone && <span className="block mt-1">📞 {shipperPhone}</span>}
                  </div>
                )}
              </div>

              {/* Consignee selector */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-500">
                  Consignee (Destinatário Final) *
                </label>
                {loadingLists ? (
                  <div className="py-2.5 px-3 bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                    <span className="text-xs text-slate-400">Carregando consignees...</span>
                  </div>
                ) : (
                  <select
                    required
                    value={consigneeId}
                    onChange={(e) => handleConsigneeChange(e.target.value)}
                    className="block w-full py-2.5 px-3 border border-slate-200 dark:border-slate-650 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-bold cursor-pointer"
                  >
                    <option value="">Selecione o Consignee...</option>
                    {consignees.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
                {consigneeId && consignees.find(c => c.id === consigneeId)?.plants?.length ? (
                  <div className="space-y-1 mt-1">
                    <label className="block text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Planta / Filial do Consignee
                    </label>
                    <select
                      value={consigneePlantId}
                      onChange={(e) => handleConsigneePlantChange(e.target.value)}
                      className="block w-full py-1.5 px-2.5 border border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20 text-slate-900 dark:text-white rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
                    >
                      <option value="">Matriz (Endereço Principal)</option>
                      {consignees.find(c => c.id === consigneeId)?.plants?.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.city}, {p.state})</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {consigneeId && (
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-750/30 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-700 leading-relaxed">
                    <span className="font-bold block text-slate-400 text-[8px] uppercase tracking-wider mb-0.5">Endereço do Destinatário</span>
                    📍 {consigneeAddress || "Sem endereço cadastrado"}
                    {consigneePhone && <span className="block mt-1">📞 {consigneePhone}</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Tracking Identification Row */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-500 flex items-center gap-1">
                  <Barcode className="h-3.5 w-3.5 text-slate-400" /> PRO Number / Waybill (Rastreamento da Carga)
                </label>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Leitor USB/Bluetooth Ativo
                </span>
              </div>

              <input
                type="text"
                placeholder="Ex: 517766633412, FedEx, DHL, Cargo Truck ID... (Ou escaneie diretamente com o leitor)"
                value={proNumbers}
                onChange={(e) => setProNumbers(e.target.value)}
                className="block w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white text-xs font-mono font-bold tracking-wider focus:ring-2 focus:ring-indigo-500 transition-colors"
              />

              <AnimatePresence>
                {scannedFeedback && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="flex items-center gap-2 p-2.5 bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-white" />
                    <span>Código de Barras Escaneado: <strong className="font-mono underline">{scannedFeedback}</strong> (Adicionado aos PRO / Tracking Numbers)</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* STEP 2: ORDENS DE COMPRA (PO / INVOICE) CARD */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xs border border-slate-150 dark:border-slate-700/50 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
              <h3 className="text-sm font-extrabold font-display text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-500" />
                2. Ordens de Compra (PO / Invoice) associadas
              </h3>
              <button
                type="button"
                onClick={addPoRow}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-extrabold rounded-xl text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Adicionar PO
              </button>
            </div>

            {poInvoices.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-[11px] text-slate-400 dark:text-slate-500">Nenhuma PO ou Invoice cadastrada para este recebimento.</p>
                <button
                  type="button"
                  onClick={addPoRow}
                  className="mt-2 text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Vincular primeira PO/Invoice
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Desktop Header row */}
                <div className="hidden sm:grid grid-cols-12 gap-3 mb-1 px-1 text-[9px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500">
                  <div className="col-span-4">PO Number</div>
                  <div className="col-span-4">Invoice #</div>
                  <div className="col-span-3">Valor / Amount</div>
                  <div className="col-span-1"></div>
                </div>

                {/* Input lines */}
                <div className="space-y-2">
                  {poInvoices.map((po, index) => (
                    <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-slate-50 sm:bg-transparent dark:bg-slate-750/10 sm:dark:bg-transparent p-3 sm:p-0 rounded-2xl border border-slate-100 sm:border-0 dark:border-slate-700/50">
                      
                      {/* PO INPUT */}
                      <div className="col-span-12 sm:col-span-4">
                        <span className="block sm:hidden text-[9px] font-bold uppercase text-slate-400 tracking-wider mb-1">
                          PO Number
                        </span>
                        <input
                          type="text"
                          placeholder="Ex: LAM-2026-X"
                          value={po.poNumber}
                          onChange={(e) => updatePoRow(index, "poNumber", e.target.value)}
                          className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-750/30 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 font-mono"
                        />
                      </div>

                      {/* INVOICE INPUT */}
                      <div className="col-span-12 sm:col-span-4">
                        <span className="block sm:hidden text-[9px] font-bold uppercase text-slate-400 tracking-wider mb-1">
                          Invoice #
                        </span>
                        <input
                          type="text"
                          placeholder="Ex: INV-98772"
                          value={po.invoiceNumber}
                          onChange={(e) => updatePoRow(index, "invoiceNumber", e.target.value)}
                          className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-750/30 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 font-mono"
                        />
                      </div>

                      {/* AMOUNT INPUT */}
                      <div className="col-span-12 sm:col-span-3">
                        <span className="block sm:hidden text-[9px] font-bold uppercase text-slate-400 tracking-wider mb-1">
                          Valor/Amount
                        </span>
                        <input
                          type="text"
                          placeholder="Ex: $150.00"
                          value={po.amount}
                          onChange={(e) => updatePoRow(index, "amount", e.target.value)}
                          className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-750/30 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 font-mono"
                        />
                      </div>

                      {/* ACTIONS */}
                      <div className="col-span-12 sm:col-span-1 flex justify-end pt-2 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => removePoRow(index)}
                          className="p-2 border border-slate-200 dark:border-slate-650 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors cursor-pointer w-full sm:w-auto flex justify-center items-center"
                          title="Remove PO"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="inline sm:hidden text-xs font-bold ml-1.5 text-red-500">Delete PO</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* STEP 3: CARGO ITEMS DETAILED MEASUREMENTS AND TABULAR REFLECTION */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xs border border-slate-150 dark:border-slate-700/50 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
              <h3 className="text-sm font-extrabold font-display text-slate-900 dark:text-white flex items-center gap-2">
                <Box className="h-5 w-5 text-indigo-500" />
                3. Medidas e Pesos dos Itens Recebidos
              </h3>
              <button
                type="button"
                onClick={addItemRow}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-extrabold rounded-xl text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Adicionar Item Row
              </button>
            </div>

            <div className="space-y-4">
              {/* TABLE HEADERS - HIDDEN ON MOBILE, VISIBLE ON DESKTOP */}
              <div className="hidden sm:grid grid-cols-12 gap-3 px-3 py-2 bg-slate-100/75 dark:bg-slate-800/80 rounded-xl text-[9px] font-extrabold text-slate-600 dark:text-slate-350 uppercase tracking-wider text-center border border-slate-150 dark:border-slate-750">
                <div className="col-span-1">Qtd</div>
                <div className="col-span-2 text-left pl-2">Tipo de Pacote</div>
                <div className="col-span-1">Compr. in</div>
                <div className="col-span-1">Larg. in</div>
                <div className="col-span-1">Alt. in</div>
                <div className="col-span-2">Peso (Wgt)</div>
                <div className="col-span-3">Condição da Carga</div>
                <div className="col-span-1"></div>
              </div>

              {/* DYNAMIC LIST */}
              <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                {items.map((item, index) => (
                  <div 
                    key={index} 
                    className="p-3 bg-slate-50/50 dark:bg-slate-750/20 rounded-2xl border border-slate-150 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600 transition-all flex flex-col gap-2.5 relative group"
                  >
                    
                    {/* Item row layout: reflows from vertical stacked inputs on mobile to a sleek table row on desktop */}
                    <div className="grid grid-cols-2 sm:grid-cols-12 gap-3 items-center">
                      
                      {/* QTY FIELD */}
                      <div className="col-span-1 sm:col-span-1">
                        <span className="block sm:hidden text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                          Qtd
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={item.qty === 0 ? "" : item.qty}
                          onFocus={() => updateItemRow(index, "qty", "")}
                          onClick={() => updateItemRow(index, "qty", "")}
                          onChange={(e) => {
                            const val = e.target.value === "" ? "" : (parseInt(e.target.value) || 0);
                            updateItemRow(index, "qty", val);
                          }}
                          className="block w-full px-1.5 py-2 border border-slate-200 dark:border-slate-650 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-extrabold focus:ring-2 focus:ring-indigo-500 text-center font-mono"
                        />
                      </div>

                      {/* ITEM TYPE DROPDOWN FIELD */}
                      <div className="col-span-2 sm:col-span-2 relative">
                        <span className="block sm:hidden text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                          Tipo de Pacote
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveDropdownIndex(activeDropdownIndex === index ? null : index)}
                          className="flex items-center justify-between w-full px-2.5 py-2 border border-slate-200 dark:border-slate-650 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-indigo-500 text-left cursor-pointer transition-all truncate"
                        >
                          <span className="truncate">{item.type || "BOX"}</span>
                          <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0 ml-1" />
                        </button>

                        {activeDropdownIndex === index && (
                          <>
                            {/* Invisible backdrop to dismiss when clicking anywhere else */}
                            <div 
                              className="fixed inset-0 z-40" 
                              onClick={() => setActiveDropdownIndex(null)}
                            />
                            <div className="absolute left-0 mt-1.5 w-72 md:w-80 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl p-1 max-h-64 overflow-y-auto z-50">
                              {ITEM_TYPE_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    updateItemRow(index, "type", opt.value);
                                    setActiveDropdownIndex(null);
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex flex-col gap-0.5 hover:bg-slate-50 dark:hover:bg-slate-750/50 cursor-pointer ${
                                    (item.type || "BOX") === opt.value
                                      ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold"
                                      : "text-slate-700 dark:text-slate-300"
                                  }`}
                                >
                                  <span className="font-bold">{opt.value}</span>
                                  <span className="text-[10px] text-slate-450 dark:text-slate-500 line-clamp-1">
                                    {opt.description}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* LENGTH FIELD */}
                      <div className="col-span-1 sm:col-span-1">
                        <span className="block sm:hidden text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                          Comprimento (in)
                        </span>
                        <input
                          type="number"
                          min={0.1}
                          step="any"
                          value={item.len === 0 ? "" : item.len}
                          onFocus={() => updateItemRow(index, "len", "")}
                          onClick={() => updateItemRow(index, "len", "")}
                          onChange={(e) => {
                            const val = e.target.value === "" ? "" : (parseFloat(e.target.value) || 0);
                            updateItemRow(index, "len", val);
                          }}
                          className="block w-full px-2 py-2 border border-slate-200 dark:border-slate-650 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-indigo-500 text-center"
                        />
                      </div>

                      {/* WIDTH FIELD */}
                      <div className="col-span-1 sm:col-span-1">
                        <span className="block sm:hidden text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                          Largura (in)
                        </span>
                        <input
                          type="number"
                          min={0.1}
                          step="any"
                          value={item.wid === 0 ? "" : item.wid}
                          onFocus={() => updateItemRow(index, "wid", "")}
                          onClick={() => updateItemRow(index, "wid", "")}
                          onChange={(e) => {
                            const val = e.target.value === "" ? "" : (parseFloat(e.target.value) || 0);
                            updateItemRow(index, "wid", val);
                          }}
                          className="block w-full px-2 py-2 border border-slate-200 dark:border-slate-650 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-indigo-500 text-center"
                        />
                      </div>

                      {/* HEIGHT FIELD */}
                      <div className="col-span-1 sm:col-span-1">
                        <span className="block sm:hidden text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                          Altura (in)
                        </span>
                        <input
                          type="number"
                          min={0.1}
                          step="any"
                          value={item.hgt === 0 ? "" : item.hgt}
                          onFocus={() => updateItemRow(index, "hgt", "")}
                          onClick={() => updateItemRow(index, "hgt", "")}
                          onChange={(e) => {
                            const val = e.target.value === "" ? "" : (parseFloat(e.target.value) || 0);
                            updateItemRow(index, "hgt", val);
                          }}
                          className="block w-full px-2 py-2 border border-slate-200 dark:border-slate-650 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-indigo-500 text-center"
                        />
                      </div>

                      {/* WEIGHT FIELD */}
                      <div className="col-span-2 sm:col-span-2">
                        <span className="block sm:hidden text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                          Peso unitário
                        </span>
                        <div className="flex">
                          <input
                            type="number"
                            min={0.1}
                            step="any"
                            value={item.weight === 0 ? "" : item.weight}
                            onFocus={() => updateItemRow(index, "weight", "")}
                            onClick={() => updateItemRow(index, "weight", "")}
                            onChange={(e) => {
                              const val = e.target.value === "" ? "" : (parseFloat(e.target.value) || 0);
                              updateItemRow(index, "weight", val);
                            }}
                            className="block w-3/5 px-2 py-2 border-y border-l border-slate-200 dark:border-slate-650 rounded-l-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-indigo-500 text-center font-bold"
                          />
                          <select
                            value={item.unit}
                            onChange={(e) => updateItemRow(index, "unit", e.target.value)}
                            className="block w-2/5 px-0.5 border border-slate-200 dark:border-slate-650 rounded-r-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white text-[9px] font-extrabold text-center cursor-pointer focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="Lbs">Lbs</option>
                            <option value="Kgs font-bold">Kgs</option>
                          </select>
                        </div>
                      </div>

                      {/* CARGO CONDITION FIELD */}
                      <div className="col-span-2 sm:col-span-3">
                        <span className="block sm:hidden text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                          Condição da Carga
                        </span>
                        <select
                          value={item.cargoCondition || ""}
                          onChange={(e) => updateItemRow(index, "cargoCondition", e.target.value)}
                          className="block w-full px-2 py-2 border border-slate-200 dark:border-slate-650 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value="">— (Nenhuma)</option>
                          <option value="No seal">No seal</option>
                          <option value="No seal on side">No seal on side</option>
                          <option value="blurry seal">blurry seal</option>
                          <option value="blurry seal on side">blurry seal on side</option>
                          <option value="broken pallet">broken pallet</option>
                          <option value="broken seal">broken seal</option>
                          <option value="plastic">plastic</option>
                          <option value="fumigated">fumigated</option>
                        </select>
                      </div>

                      {/* DELETE ITEM ROW ACTION */}
                      <div className="col-span-2 sm:col-span-1 flex justify-end">
                        {items.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeItemRow(index)}
                            className="p-2 border border-slate-250 dark:border-slate-650 text-slate-400 hover:text-red-500 dark:hover:text-red-450 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors cursor-pointer w-full sm:w-auto flex justify-center items-center"
                            title="Remove Package"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="inline sm:hidden text-xs font-bold ml-1.5 text-red-500">Delete Package</span>
                          </button>
                        ) : (
                          <div className="h-4 w-4 sm:block hidden"></div>
                        )}
                      </div>
                    </div>

                    {/* ITEM ROW SPECIFIC AUTO-CALCULATED BAR (CLEAN INTEGRATION) */}
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center text-[10px] text-slate-450 dark:text-slate-550 px-1 font-mono pt-1.5 border-t border-slate-100 dark:border-slate-800/80 mt-0.5 gap-1.5">
                      <div className="flex gap-1.5 items-center">
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold px-1.5 py-0.5 rounded-md text-[8px] uppercase tracking-wider">Volume #{index+1}</span>
                        <span>Comp. Total: <strong className="text-slate-700 dark:text-slate-300">{(item.qty * (item.len || 0) * (item.wid || 0) * (item.hgt || 0)).toLocaleString()} in³</strong></span>
                      </div>
                      <div className="flex gap-3 sm:text-right">
                        <span>Cubicagem: <strong className="text-slate-800 dark:text-slate-200 font-bold">{(item.cubic || 0).toFixed(2)} Cft</strong></span>
                        <span className="text-indigo-600 dark:text-indigo-400">
                          Peso Cubado (Dim): <strong className="font-extrabold">
                            {((item.len * item.wid * item.hgt * item.qty) / 166).toFixed(1)} Lbs
                          </strong> ({(((item.len * item.wid * item.hgt * item.qty) / 166) * 0.453592).toFixed(1)} Kgs)
                        </span>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* STEP 4: INSTRUÇÕES DE MANUSEIO (3 COLUMNS CHECKLIST) */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xs border border-slate-150 dark:border-slate-700/50 space-y-4">
            <div>
              <h3 className="text-sm font-extrabold font-display text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-3">
                <Sliders className="h-5 w-5 text-indigo-500" />
                4. Instruções de Manuseio (Checklist)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-snug">
                Marque especificações de segurança, embalagem, avaria ou documentos para constar no comprovante oficial.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {HANDLING_OPTIONS.map(option => {
                const checked = handling.includes(option);
                return (
                  <button
                    type="button"
                    key={option}
                    onClick={() => toggleHandling(option)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      checked
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-700 dark:text-indigo-350 font-black shadow-xs"
                        : "border-slate-150 dark:border-slate-750 bg-slate-50/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-450 hover:bg-slate-100/50"
                    }`}
                  >
                    {checked ? (
                      <CheckSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
                    )}
                    <span className="text-xs truncate font-medium">{option}</span>
                  </button>
                );
              })}
            </div>

            {/* Campo de Comentários / Observações */}
            <div className="pt-5 border-t border-slate-100 dark:border-slate-700/60 space-y-2">
              <label htmlFor="comments" className="block text-xs font-bold text-slate-700 dark:text-slate-350 flex items-center gap-1.5">
                <span className="text-indigo-500">✍️</span> Comentários / Observações Adicionais (Comments)
              </label>
              <textarea
                id="comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Insira observações específicas, instruções de entrega ou outras informações sobre a carga..."
                rows={3}
                className="w-full text-xs p-3.5 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-850 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all"
              />
            </div>
          </div>



        </div>

        {/* RIGHT SIDEBAR COLUMN (AI assistant, photos, checklist & sticky calculated totals with controls) - Spans 4 of 12 columns */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6">
          
          {/* ASSISTENTE DE CARGA: IA PACKLIST SCANNER CARD */}
          <div className="bg-gradient-to-br from-indigo-50/50 to-amber-50/30 dark:from-indigo-950/20 dark:to-slate-800 p-5 rounded-3xl border border-indigo-100 dark:border-indigo-900/40 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-indigo-100/50 dark:border-indigo-900/20 pb-2">
              <h3 className="text-xs font-extrabold font-display text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
                Assistente de Entrada IA Gemini
              </h3>
            </div>
            
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Arraste ou carregue um <strong>PDF de Packing List, Fatura Comercial</strong> ou imagem. O assistente preencherá os dados dos parceiros e itens automaticamente.
            </p>

            <input
              type="file"
              accept="application/pdf,image/*"
              ref={packlistInputRef}
              onChange={handlePacklistFileChange}
              className="hidden"
            />

            <button
              type="button"
              disabled={geminiAnalyzing}
              onClick={() => packlistInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-2xl shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-xs"
            >
              <Upload className="h-4 w-4" />
              {geminiAnalyzing ? "IA Analisando Documento..." : "Upload Packing List / PDF"}
            </button>

            {/* Attached PDFs lists */}
            {(() => {
              const pdfPhotos = photos.filter(p => p.toLowerCase().endsWith(".pdf") || p.startsWith("data:application/pdf"));
              if (pdfPhotos.length === 0) return null;
              return (
                <div className="space-y-2 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-500">
                    PDFs Anexados ({pdfPhotos.length})
                  </span>
                  <div className="space-y-1.5">
                    {photos.map((photo, index) => {
                      if (!photo.toLowerCase().endsWith(".pdf") && !photo.startsWith("data:application/pdf")) return null;
                      const isNew = photo.startsWith("data:application/pdf");
                      return (
                        <div key={index} className="flex items-center justify-between p-2 rounded-xl border border-slate-150 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/40 text-xs">
                          <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold truncate">
                            <FileText className="h-4 w-4 shrink-0 text-indigo-500" />
                            <span className="truncate max-w-[150px] font-mono text-[9.5px]">
                              {isNew ? "novo-documento.pdf" : photo.split("/").pop()}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPhotos(prev => prev.filter((_, i) => i !== index))}
                            className="p-1 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                            title="Remover documento"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* FOTOS DA CARGA BLOCK */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-150 dark:border-slate-700/50 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2.5">
              <h3 className="text-xs font-extrabold font-display text-slate-900 dark:text-white flex items-center gap-1.5">
                <Camera className="h-4 w-4 text-indigo-500" />
                Evidências e Fotos da Carga
              </h3>
              {photos.filter(p => !p.toLowerCase().endsWith(".pdf") && !p.startsWith("data:application/pdf")).length > 0 && (
                <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 font-mono px-2 py-0.5 rounded-full font-bold">
                  {photos.filter(p => !p.toLowerCase().endsWith(".pdf") && !p.startsWith("data:application/pdf")).length} fotos
                </span>
              )}
            </div>

            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Live webcam streaming */}
            {showLiveWebcam && (
              <div className="relative border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-black w-full">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-40 object-cover"
                />
                <div className="p-2 bg-slate-900 flex justify-between gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={stopWebcam}
                    className="px-3 py-1.5 bg-slate-700 text-white font-semibold rounded-lg cursor-pointer hover:bg-slate-600 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={captureWebcamPhoto}
                    className="px-3 py-1.5 bg-emerald-500 text-white font-bold rounded-lg shadow-sm cursor-pointer hover:bg-emerald-600 transition-colors"
                  >
                    Capturar Foto
                  </button>
                </div>
              </div>
            )}

            {/* Photos Display grid */}
            {photos.filter(p => !p.toLowerCase().endsWith(".pdf") && !p.startsWith("data:application/pdf")).length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {photos.map((photo, index) => {
                  if (photo.toLowerCase().endsWith(".pdf") || photo.startsWith("data:application/pdf")) return null;
                  const isNew = photo.startsWith("data:image");
                  return (
                    <div 
                      key={index} 
                      className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex flex-col justify-between"
                    >
                      {/* Image Preview */}
                      <div className="relative h-20 w-full bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
                        <img 
                          src={photo} 
                          alt={`Anexo ${index + 1}`} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        
                        {/* Badges */}
                        <div className="absolute top-1 left-1">
                          <span className={`text-[7px] font-extrabold px-1 py-0.25 rounded-md font-mono shadow-xs ${
                            isNew 
                              ? "bg-indigo-600 text-white" 
                              : "bg-emerald-600 text-white"
                          }`}>
                            {isNew ? "NOVA" : "SALVA"}
                          </span>
                        </div>

                        {/* Delete action */}
                        <button
                          type="button"
                          onClick={() => {
                            setPhotos(prev => prev.filter((_, i) => i !== index));
                            if (detectedPartnerInfo && index === 0) setDetectedPartnerInfo(null);
                          }}
                          className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm cursor-pointer opacity-100 md:opacity-0 group-hover:opacity-100"
                          title="Remover Foto"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Info & Actions */}
                      <div className="p-1.5 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700/60 flex flex-col gap-1">
                        {!geminiAnalyzing && (
                          <button
                            type="button"
                            onClick={() => triggerGeminiAnalysis(photo)}
                            className="w-full py-1 px-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-lg text-[8px] font-extrabold text-amber-800 dark:text-amber-400 flex items-center justify-center gap-0.5 transition-all cursor-pointer"
                          >
                            <Sparkles className="h-2.5 w-2.5 text-amber-500 animate-pulse" />
                            Rastreio IA
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Empty State */
              !showLiveWebcam && (
                <div className="py-4 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center text-center p-3">
                  <Camera className="h-6 w-6 text-slate-350 dark:text-slate-600 mb-1.5" />
                  <p className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400">
                    Nenhuma foto anexada
                  </p>
                  <p className="text-[8px] text-slate-400 mt-0.5">
                    Anexe fotos ou use a webcam para registro físico da carga.
                  </p>
                </div>
              )
            )}

            {/* Quick buttons to add more files */}
            {!showLiveWebcam && (
              <div className="flex gap-2 pt-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-1 py-2 px-2 border border-slate-250 dark:border-slate-700 hover:border-indigo-500 hover:bg-indigo-50/5 dark:hover:bg-slate-750 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer transition-all text-[10px] font-bold text-slate-600 dark:text-slate-300"
                >
                  <Plus className="h-3.5 w-3.5 text-indigo-500" />
                  Upload Fotos
                </button>

                <button
                  type="button"
                  onClick={startWebcam}
                  className="flex items-center justify-center gap-1 py-2 px-3 border border-slate-250 dark:border-slate-700 hover:border-emerald-500 hover:bg-emerald-50/5 dark:hover:bg-slate-750 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer transition-all text-[10px] font-bold text-slate-600 dark:text-slate-300"
                >
                  <Video className="h-3.5 w-3.5 text-emerald-500" />
                  Webcam
                </button>
              </div>
            )}

            {/* AI analysis states & detection banner */}
            {geminiAnalyzing && (
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500 shrink-0" />
                <span className="text-[9.5px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 leading-tight">
                  {geminiBanner}
                </span>
              </div>
            )}

            {geminiBanner && !geminiAnalyzing && (
              <div className={`p-2 border rounded-xl text-[9.5px] flex items-center gap-1.5 font-semibold leading-tight ${
                geminiError
                  ? "bg-rose-50 dark:bg-rose-950/20 border-rose-250 dark:border-rose-900/30 text-rose-650 dark:text-rose-400"
                  : "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400"
              }`}>
                {geminiError ? (
                  <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                ) : (
                  <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
                )}
                <span>{geminiBanner}</span>
              </div>
            )}

            {detectedPartnerInfo && (
              <div className="p-2 bg-slate-50 dark:bg-slate-750/35 border border-slate-100 dark:border-slate-700/50 rounded-xl text-[8.5px] text-slate-500 dark:text-slate-400 font-mono whitespace-pre-line leading-relaxed max-h-24 overflow-y-auto">
                {detectedPartnerInfo}
              </div>
            )}
          </div>

          {/* STICKY TOTALS & EMISSÃO SUBMIT CARD */}
          <div className="bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-150 p-5 rounded-3xl shadow-xs dark:shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h4 className="text-[10px] uppercase font-black tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2">
              Resumo Consolidado do Recebimento
            </h4>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-white dark:bg-slate-850 p-2 rounded-xl border border-slate-200/60 dark:border-slate-800/40">
                <span className="text-[8px] text-slate-400 uppercase font-bold block">Total Peças</span>
                <span className="text-xs font-black text-slate-800 dark:text-white mt-0.5 block">
                  {totals.totalPieces} <span className="text-[8px] text-slate-400 font-normal">Pcs</span>
                </span>
              </div>

              <div className="bg-white dark:bg-slate-850 p-2 rounded-xl border border-slate-200/60 dark:border-slate-800/40">
                <span className="text-[8px] text-slate-400 uppercase font-bold block">Peso Real</span>
                <span className="text-xs font-black text-slate-800 dark:text-white mt-0.5 block">
                  {totals.totalWeightLbs} <span className="text-[8px] text-slate-400 font-normal">Lbs</span>
                </span>
              </div>

              <div className="bg-white dark:bg-slate-850 p-2 rounded-xl border border-slate-200/60 dark:border-slate-800/40">
                <span className="text-[8px] text-slate-400 uppercase font-bold block">Dim. Weight</span>
                <span className="text-xs font-black text-slate-800 dark:text-white mt-0.5 block">
                  {totals.totalVolWeightLbs} <span className="text-[8px] text-slate-400 font-normal">Lbs</span>
                </span>
                <span className="text-[8px] text-slate-400 block mt-0.5">
                  ({totals.totalVolWeightKgs} Kgs)
                </span>
              </div>

              <div className="bg-white dark:bg-slate-850 p-2 rounded-xl border border-slate-200/60 dark:border-slate-800/40">
                <span className="text-[8px] text-slate-400 uppercase font-bold block">Cubagem</span>
                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 mt-0.5 block">
                  {totals.totalCubicCft} <span className="text-[8px] text-slate-400 font-normal">Cft</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="submit"
                disabled={submitting || geminiAnalyzing}
                className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50 transition-all"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin h-3.5 w-3.5" /> {existingReceipt ? "Gravando alterações..." : "Emitindo..."}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> {existingReceipt ? "Salvar Alterações" : "Emitir Recebimento (WR)"}
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onSuccess}
                className="w-full py-2 px-3 border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold rounded-xl text-[11px] flex items-center justify-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar Lançamento
              </button>
            </div>
          </div>

        </div>

      </form>
    </div>
  );
}