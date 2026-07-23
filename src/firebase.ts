import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import appletConfig from "../firebase-applet-config.json";

// Configuração do Firebase carregada a partir do arquivo firebase-applet-config.json
const firebaseConfig = {
  apiKey: appletConfig.apiKey || "dummy-api-key",
  authDomain: appletConfig.authDomain || "dummy-auth.firebaseapp.com",
  projectId: appletConfig.projectId || "dummy-project-id",
  storageBucket: appletConfig.storageBucket || "dummy-bucket.appspot.com",
  messagingSenderId: appletConfig.messagingSenderId || "dummy-sender",
  appId: appletConfig.appId || "dummy-app-id",
};

export const isRealFirebaseConfigured = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "dummy-api-key";

let firebaseApp;
let firebaseAuth: any = null;
let firebaseDb: any = null;
let firebaseStorage: any = null;
let googleProvider: GoogleAuthProvider | null = null;

if (isRealFirebaseConfigured) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    firebaseAuth = getAuth(firebaseApp);
    firebaseDb = getFirestore(firebaseApp);
    firebaseStorage = getStorage(firebaseApp);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({
      prompt: "select_account"
    });
    console.log("Firebase initialized successfully with config from applet-config.");
  } catch (error) {
    console.error("Failed to initialize Firebase with configured keys:", error);
  }
}

export { firebaseApp, firebaseAuth, firebaseDb, firebaseStorage, googleProvider };
