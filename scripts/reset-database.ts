/**
 * scripts/reset-database.ts
 *
 * Apaga TODOS os dados do BoundFlux — Firestore de produção + cache local (data/db.json)
 * + fotos de teste enviadas (public/uploads). Isso é IRREVERSÍVEL.
 *
 * Uso (rode a partir da raiz do projeto, no ambiente onde as credenciais reais do
 * Firebase já funcionam — o mesmo ambiente onde `npm run dev` funciona):
 *
 *   npx tsx scripts/reset-database.ts --confirm
 *
 * Sem a flag --confirm, o script só mostra o que faria (dry-run) e não apaga nada.
 */

import fs from "fs";
import path from "path";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

const CONFIRMED = process.argv.includes("--confirm");

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

const COLLECTIONS = [
  "tenants",
  "users",
  "shippers",
  "consignees",
  "receipts",
  "billsOfLading",
  "invitations",
  "auditLog",
  "units",
];

async function main() {
  console.log("==============================================");
  console.log(" BoundFlux — RESET TOTAL DO BANCO DE DADOS");
  console.log("==============================================");
  console.log(CONFIRMED ? "Modo: EXECUÇÃO REAL (--confirm presente)" : "Modo: DRY-RUN (nada será apagado — rode com --confirm para executar de verdade)");
  console.log("");

  // 1. Firestore
  const appletConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf-8"));

  try {
    admin.initializeApp({ projectId: appletConfig.projectId });
  } catch (e: any) {
    if (!e.message?.includes("already exists")) throw e;
  }
  const firestoreDb = getFirestore(appletConfig.firestoreDatabaseId);
  console.log(`[FIRESTORE] Projeto: ${appletConfig.projectId} | Database: ${appletConfig.firestoreDatabaseId}`);
  console.log("");

  let totalDeleted = 0;

  for (const col of COLLECTIONS) {
    try {
      const snapshot = await firestoreDb.collection(col).get();
      const count = snapshot.size;
      console.log(`[FIRESTORE] Coleção "${col}": ${count} documento(s) encontrado(s).`);

      if (count === 0) continue;

      if (!CONFIRMED) {
        console.log(`  -> (dry-run) ${count} documento(s) seriam apagados de "${col}".`);
        continue;
      }

      // Apaga em lotes de até 450 (limite do Firestore é 500 operações por batch)
      const docs = snapshot.docs;
      for (let i = 0; i < docs.length; i += 450) {
        const batch = firestoreDb.batch();
        const slice = docs.slice(i, i + 450);
        slice.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        totalDeleted += slice.length;
        console.log(`  -> Apagados ${slice.length} documento(s) de "${col}" (lote ${Math.floor(i / 450) + 1}).`);
      }
    } catch (err: any) {
      console.warn(`[FIRESTORE AVISO] Não foi possível acessar coleção "${col}" (${err.message || err}). Continuando o reset local...`);
    }
  }

  console.log("");
  console.log(`[FIRESTORE] Total apagado: ${totalDeleted} documento(s).`);
  console.log("");

  // 2. Cache local (data/db.json)
  const emptyDb = {
    shippers: [],
    consignees: [],
    receipts: [],
    users: [],
    billsOfLading: [],
    tenants: [],
    invitations: [],
    pendingDeletions: [],
    auditLog: [],
    units: [],
  };

  if (CONFIRMED) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(emptyDb, null, 2), "utf-8");
    console.log(`[CACHE LOCAL] ${DB_FILE} resetado para estado vazio.`);
  } else {
    console.log(`[CACHE LOCAL] (dry-run) ${DB_FILE} seria resetado para estado vazio.`);
  }
  console.log("");

  // 3. Fotos de teste enviadas (public/uploads)
  if (fs.existsSync(UPLOADS_DIR)) {
    const files = fs.readdirSync(UPLOADS_DIR).filter(f => f !== ".gitkeep");
    console.log(`[UPLOADS] ${files.length} arquivo(s) encontrado(s) em ${UPLOADS_DIR}.`);
    if (CONFIRMED) {
      for (const f of files) {
        fs.unlinkSync(path.join(UPLOADS_DIR, f));
      }
      console.log(`[UPLOADS] ${files.length} arquivo(s) apagado(s).`);
    } else {
      console.log(`  -> (dry-run) ${files.length} arquivo(s) seriam apagados.`);
    }
  } else {
    console.log("[UPLOADS] Pasta de uploads não encontrada, nada a fazer.");
  }

  console.log("");
  console.log("==============================================");
  if (!CONFIRMED) {
    console.log("Nenhuma alteração foi feita (dry-run). Rode novamente com --confirm para executar de verdade:");
    console.log("  npx tsx scripts/reset-database.ts --confirm");
  } else {
    console.log("Reset concluído. Bancos de dados (Firestore + cache local) e uploads de teste foram apagados.");
    console.log("");
    console.log("IMPORTANTE: os e-mails armando.qualitylogistics@gmail.com e cnxarmando@gmail.com");
    console.log("continuam reconhecidos como Superadmin automaticamente no próximo login (isso está");
    console.log("no código, não depende de registro no banco). Ao logar de novo, um novo tenant");
    console.log("'t-1' vazio será referenciado até você criar um tenant real pelo Painel de Superadmin.");
  }
  console.log("==============================================");
}

main().catch(err => {
  console.error("[ERRO] Falha ao resetar o banco:", err);
  process.exit(1);
});
