const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDePLDR_5jn1qM2Mm-qDBb5l9xxQKfhVEM",
    authDomain: "chinhloto.firebaseapp.com",
    projectId: "chinhloto",
    storageBucket: "chinhloto.firebasestorage.app",
    messagingSenderId: "919604565070",
    appId: "1:919604565070:web:020bfda7cad03478685f1f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

module.exports = { db };
