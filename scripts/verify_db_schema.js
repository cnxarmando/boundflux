import fs from "fs";
import path from "path";

const DB_FILE = path.join(process.cwd(), "data", "db.json");

console.log("\x1b[35m%s\x1b[0m", "==================================================================");
console.log("\x1b[35m%s\x1b[0m", "🔍   LOGISTIC.IO — DIAGNÓSTICO E AUDITORIA DE ESQUEMA DO BANCO   🔍");
console.log("\x1b[35m%s\x1b[0m", "==================================================================");

// 1. Verificar existência do arquivo de banco de dados local
if (!fs.existsSync(DB_FILE)) {
  console.error("\x1b[31m%s\x1b[0m", `❌ Erro Crítico: Arquivo cache ${DB_FILE} não existe.`);
  process.exit(1);
}

// 2. Tentar decodificar o arquivo de banco
let db;
try {
  const fileContent = fs.readFileSync(DB_FILE, "utf-8");
  db = JSON.parse(fileContent);
  console.log("\x1b[32m%s\x1b[0m", `✔️ Arquivo 'data/db.json' lido e decodificado com sucesso.`);
} catch (e) {
  console.error("\x1b[31m%s\x1b[0m", `❌ Erro Crítico: Falha ao parsear 'data/db.json'. O arquivo está corrompido.`);
  console.error(e);
  process.exit(1);
}

// 3. Definição do esquema das coleções e das chaves obrigatórias
const SCHEMAS = {
  tenants: {
    name: "Empresas (Tenants)",
    fields: {
      tenantId: { type: "string", required: true },
      name: { type: "string", required: true },
      domain: { type: "string", required: true },
      planTier: { type: "string", required: true, enum: ["Starter", "Pro", "Enterprise"] },
      status: { type: "string", required: true, enum: ["active", "suspended"] }
    }
  },
  users: {
    name: "Usuários",
    fields: {
      uid: { type: "string", required: true },
      email: { type: "string", required: true },
      name: { type: "string", required: true },
      tenantId: { type: "string", required: true },
      tenantRole: { type: "string", required: true, enum: ["operator", "admin", "owner"] }
    }
  },
  shippers: {
    name: "Exportadores (Shippers)",
    fields: {
      id: { type: "string", required: true },
      name: { type: "string", required: true },
      tenantId: { type: "string", required: true },
      createdAt: { type: "string", required: true }
    }
  },
  consignees: {
    name: "Destinatários (Consignees)",
    fields: {
      id: { type: "string", required: true },
      name: { type: "string", required: true },
      tenantId: { type: "string", required: true },
      createdAt: { type: "string", required: true }
    }
  },
  receipts: {
    name: "Recibos de Carga (Warehouse Receipts)",
    fields: {
      id: { type: "string", required: true },
      number: { type: "string", required: true },
      shipperId: { type: "string", required: true },
      shipperName: { type: "string", required: true },
      consigneeId: { type: "string", required: true },
      consigneeName: { type: "string", required: true },
      totalPieces: { type: "number", required: true },
      totalWeightLbs: { type: "number", required: true },
      totalWeightKgs: { type: "number", required: true },
      totalCubicCft: { type: "number", required: true },
      totalCubicCbm: { type: "number", required: true },
      photoUrl: { type: "string", required: true },
      status: { type: "string", required: true, enum: ["RECEBIDO", "DESPACHADO", "RECICLADO"] },
      tenantId: { type: "string", required: true },
      createdAt: { type: "string", required: true }
    }
  },
  billsOfLading: {
    name: "Conhecimentos de Embarque (Bills of Lading)",
    fields: {
      id: { type: "string", required: true },
      blNumber: { type: "string", required: true },
      documentNumber: { type: "string", required: true },
      exporter: { type: "string", required: true },
      consignee: { type: "string", required: true },
      receiptIds: { type: "array", required: true },
      receiptNumbers: { type: "array", required: true },
      tenantId: { type: "string", required: true },
      createdAt: { type: "string", required: true }
    }
  },
  invitations: {
    name: "Convites de Onboarding",
    fields: {
      id: { type: "string", required: true },
      email: { type: "string", required: true },
      tenantId: { type: "string", required: true },
      tenantRole: { type: "string", required: true, enum: ["owner", "admin", "operator"] },
      status: { type: "string", required: true, enum: ["pending", "accepted"] },
      createdAt: { type: "string", required: true }
    }
  },
  units: {
    name: "Unidades Físicas / Filiais",
    fields: {
      id: { type: "string", required: true },
      tenantId: { type: "string", required: true },
      name: { type: "string", required: true },
      unitSystem: { type: "string", required: true, enum: ["imperial", "metric"] },
      createdAt: { type: "string", required: true },
      isActive: { type: "boolean", required: true }
    }
  },
  auditLog: {
    name: "Logs de Auditoria",
    fields: {
      id: { type: "string", required: true },
      action: { type: "string", required: true },
      resource: { type: "string", required: true },
      resourceId: { type: "string", required: true },
      tenantId: { type: "string", required: true },
      performedBy: { type: "string", required: true },
      timestamp: { type: "string", required: true }
    }
  }
};

let hasErrors = false;
let warningCount = 0;

console.log("\n--------------------------------------------------");
console.log("🛠️   VALIDANDO ESTRUTURA GLOBAL DAS COLEÇÕES");
console.log("--------------------------------------------------");

// Validar se todas as coleções esperadas existem na raiz do JSON
const rootCollections = Object.keys(SCHEMAS);
for (const colName of rootCollections) {
  if (!db[colName]) {
    console.error(`\x1b[31m❌ Erro: Coleção obrigatória '${colName}' não está definida na raiz do banco de dados.\x1b[0m`);
    hasErrors = true;
  } else if (!Array.isArray(db[colName])) {
    console.error(`\x1b[31m❌ Erro: Coleção '${colName}' deve ser uma Array, mas foi detectado tipo: ${typeof db[colName]}.\x1b[0m`);
    hasErrors = true;
  } else {
    console.log(`\x1b[32m✔️ Coleção raiz '${colName}' encontrada (Tamanho: ${db[colName].length} registros).\x1b[0m`);
  }
}

console.log("\n--------------------------------------------------");
console.log("📋   AUDITORIA DETALHADA DE REGISTROS POR COLEÇÃO");
console.log("--------------------------------------------------");

for (const [colName, schema] of Object.entries(SCHEMAS)) {
  const list = db[colName];
  if (!list || !Array.isArray(list)) continue;

  console.log(`\n📂 Analisando '${schema.name}' (Coleção: '${colName}')...`);
  
  if (list.length === 0) {
    console.log(`   ⚠️  Nenhum registro cadastrado nesta coleção para validar.`);
    warningCount++;
    continue;
  }

  let colErrors = 0;
  let validatedCount = 0;

  for (const [index, item] of list.entries()) {
    const itemLabel = item.id || item.tenantId || item.uid || `#${index}`;
    
    for (const [fieldName, rules] of Object.entries(schema.fields)) {
      const value = item[fieldName];
      
      // Verificar obrigatoriedade
      if (value === undefined || value === null) {
        if (rules.required) {
          console.error(`   \x1b[31m❌ Erro no registro '${itemLabel}': Campo obrigatório '${fieldName}' está faltando.\x1b[0m`);
          colErrors++;
          hasErrors = true;
        }
        continue;
      }

      // Verificar tipos de dados
      if (rules.type === "array") {
        if (!Array.isArray(value)) {
          console.error(`   \x1b[31m❌ Erro no registro '${itemLabel}': Campo '${fieldName}' deve ser Array, mas é ${typeof value}.\x1b[0m`);
          colErrors++;
          hasErrors = true;
        }
      } else if (typeof value !== rules.type) {
        console.error(`   \x1b[31m❌ Erro no registro '${itemLabel}': Campo '${fieldName}' esperava tipo '${rules.type}', mas encontrou '${typeof value}'.\x1b[0m`);
        colErrors++;
        hasErrors = true;
      }

      // Verificar valores enumerados
      if (rules.enum && !rules.enum.includes(value)) {
        console.error(`   \x1b[31m❌ Erro no registro '${itemLabel}': Campo '${fieldName}' possui valor inválido '${value}'. Valores permitidos: [${rules.enum.join(", ")}].\x1b[0m`);
        colErrors++;
        hasErrors = true;
      }
    }
    validatedCount++;
  }

  if (colErrors === 0) {
    console.log(`   \x1b[32m✔️ Todos os ${validatedCount} registros estão 100% em conformidade com o esquema de chaves.\x1b[0m`);
  } else {
    console.log(`   \x1b[31m❌ Encontrados ${colErrors} problemas de validação nesta coleção.\x1b[0m`);
  }
}

// 4. Diagnóstico de Integridade de Relacionamentos (Multi-tenant checks)
console.log("\n--------------------------------------------------");
console.log("🔗   VALIDAÇÃO DE RELACIONAMENTOS (INTEGRIDADE REFERENCIAL)");
console.log("--------------------------------------------------");

const tenantIds = new Set(db.tenants?.map(t => t.tenantId) || []);

if (tenantIds.size === 0) {
  console.log("⚠️  Aviso: Nenhum tenant ativo cadastrado. Integridade referencial limitada.");
  warningCount++;
} else {
  console.log(`ℹ️  Tenants ativos cadastrados na base: [${Array.from(tenantIds).join(", ")}]`);
  
  // Verificar se usuários possuem tenants válidos
  let userTenantErrors = 0;
  for (const user of (db.users || [])) {
    if (user.tenantId && !tenantIds.has(user.tenantId)) {
      console.error(`   \x1b[31m❌ Erro de Integridade: Usuário '${user.name}' (${user.email}) aponta para o Tenant inválido/inexistente '${user.tenantId}'.\x1b[0m`);
      userTenantErrors++;
      hasErrors = true;
    }
  }
  if (userTenantErrors === 0 && db.users?.length > 0) {
    console.log("   \x1b[32m✔️ Todos os usuários estão associados a Tenants válidos.\x1b[0m");
  }

  // Verificar se recibos apontam para shippers e consignees existentes
  const shipperIds = new Set(db.shippers?.map(s => s.id) || []);
  const consigneeIds = new Set(db.consignees?.map(c => c.id) || []);
  let receiptRefErrors = 0;

  for (const receipt of (db.receipts || [])) {
    if (receipt.shipperId && !shipperIds.has(receipt.shipperId)) {
      console.warn(`   \x1b[33m⚠️  Aviso de Referência: Recibo '${receipt.number}' possui Shipper ID '${receipt.shipperId}' que não consta na lista de Shippers ativos.\x1b[0m`);
      warningCount++;
      receiptRefErrors++;
    }
    if (receipt.consigneeId && !consigneeIds.has(receipt.consigneeId)) {
      console.warn(`   \x1b[33m⚠️  Aviso de Referência: Recibo '${receipt.number}' possui Consignee ID '${receipt.consigneeId}' que não consta na lista de Consignees ativos.\x1b[0m`);
      warningCount++;
      receiptRefErrors++;
    }
  }

  if (receiptRefErrors === 0 && db.receipts?.length > 0) {
    console.log("   \x1b[32m✔️ Todos os recibos de carga possuem referências operacionais válidas.\x1b[0m");
  }
}

console.log("\n==================================================================");
console.log("📊   RELATÓRIO FINAL DO PROCESSO DE AUDITORIA");
console.log("==================================================================");

if (hasErrors) {
  console.error("\x1b[41m\x1b[37m%s\x1b[0m", " 🔴 DIAGNÓSTICO: FALHA. Foram identificados desvios ou quebras de regras de esquema no banco. ");
  console.error("\x1b[31m%s\x1b[0m", " Revise os erros acima listados. Atualizações da plataforma podem quebrar se as chaves exigidas estiverem vazias ou com tipos inválidos.");
  process.exit(1);
} else {
  console.log("\x1b[42m\x1b[37m%s\x1b[0m", " 🟢 DIAGNÓSTICO: SUCESSO! A base de dados local está 100% íntegra e em conformidade. ");
  console.log(` 🎉 Verificação finalizada com 0 erros e ${warningCount} avisos.`);
  process.exit(0);
}
