import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Configuration Firebase de votre projet
const firebaseConfig = {
  apiKey: "AIzaSyDVr2T38rqO3sRGOOfkN-rMj4hE5nkEX14",
  authDomain: "mlanine-print.firebaseapp.com",
  projectId: "mlanine-print",
  storageBucket: "mlanine-print.firebasestorage.app",
  messagingSenderId: "1052480153140",
  appId: "1:1052480153140:web:bd63a1d353700a074ccc61",
  measurementId: "G-NERCL7WQKM"
};

// Initialisation de Firebase
const app = initializeApp(firebaseConfig);

// Export des services pour les utiliser dans l'application
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
