// ==========================================================================
// CONFIGURAÇÃO DO FIREBASE (FIRESTORE) - FUMÓDROMO DA RITA
// Substitua os campos abaixo pelos dados do seu projeto no Firebase Console:
// https://console.firebase.google.com/
// ==========================================================================

const firebaseConfig = {
  apiKey: "AIzaSyBlJn0V9nd1qdWqPZzDDlJvLJpqwfRHCzo",
  authDomain: "fumodromo-rita.firebaseapp.com",
  projectId: "fumodromo-rita",
  storageBucket: "fumodromo-rita.firebasestorage.app",
  messagingSenderId: "709842436144",
  appId: "1:709842436144:web:fb34dc438a50c72efaadf5",
  measurementId: "G-7T7704Y2FE"
};

// Verifica se as chaves reais foram inseridas
function isFirebaseConfigured() {
  return firebaseConfig.apiKey && firebaseConfig.apiKey !== "SUA_API_KEY_AQUI";
}
