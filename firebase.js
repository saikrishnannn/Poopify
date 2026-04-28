// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAse5pBqveouIkSKopnA6q5fdmnzrOPVkI",
  authDomain: "poopify-0.firebaseapp.com",
  projectId: "poopify-0",
  storageBucket: "poopify-0.firebasestorage.app",
  messagingSenderId: "127473054633",
  appId: "1:127473054633:web:045a8ddddb68ecb8f2cab8",
  measurementId: "G-P5G5D2X7WE"
};

const app = initializeApp(firebaseConfig);

// Export 'db' so you can use it in App.jsx
export const db = getFirestore(app);