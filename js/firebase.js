// Firebase configuration and initialization

const firebaseConfig = {
    apiKey: "AIzaSyCJ6MF-GANoffIH7T3sdVSUcuQ9bP3BT1k",
    authDomain: "betternow-extension.firebaseapp.com",
    projectId: "betternow-extension",
    storageBucket: "betternow-extension.firebasestorage.app",
    messagingSenderId: "996954294250",
    appId: "1:996954294250:web:882829106bc4bad1859493"
};

// Firebase SDK loaded via importScripts won't work in content scripts
// We'll use the REST API instead for Firestore

const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

// Settings cache
let firebaseSettings = null;
let settingsLoaded = false;

async function loadSettingsFromFirebase() {
    try {
        const response = await fetch(`${FIRESTORE_BASE_URL}/config/settings`);

        if (!response.ok) {
            console.error('Failed to load Firebase settings:', response.status);
            return null;
        }

        const data = await response.json();
        firebaseSettings = parseFirestoreDocument(data.fields);
        settingsLoaded = true;

        // Update the global config variables
        applyFirebaseSettings();

        console.log('Firebase settings loaded:', firebaseSettings);
        return firebaseSettings;
    } catch (error) {
        console.error('Error loading Firebase settings:', error);
        return null;
    }
}

function parseFirestoreDocument(fields) {
    const result = {};

    for (const [key, value] of Object.entries(fields)) {
        result[key] = parseFirestoreValue(value);
    }

    return result;
}

function parseFirestoreValue(value) {
    if (value.stringValue !== undefined) {
        return value.stringValue;
    }
    if (value.integerValue !== undefined) {
        return parseInt(value.integerValue);
    }
    if (value.doubleValue !== undefined) {
        return value.doubleValue;
    }
    if (value.booleanValue !== undefined) {
        return value.booleanValue;
    }
    if (value.arrayValue !== undefined) {
        return (value.arrayValue.values || []).map(parseFirestoreValue);
    }
    if (value.mapValue !== undefined) {
        return parseFirestoreDocument(value.mapValue.fields || {});
    }
    return null;
}

function applyFirebaseSettings() {
    if (!firebaseSettings) return;

    // Update global variables from firebase settings
    if (firebaseSettings.myUsername) {
        myUsername = firebaseSettings.myUsername;
    }
    if (firebaseSettings.friendUsernames) {
        friendUsernames = firebaseSettings.friendUsernames;
    }
    if (firebaseSettings.hiddenBroadcasters) {
        hiddenBroadcasters = firebaseSettings.hiddenBroadcasters;
    }
    if (firebaseSettings.myGradient) {
        myGradient = firebaseSettings.myGradient;
    }
    if (firebaseSettings.friendGradient) {
        friendGradient = firebaseSettings.friendGradient;
    }
    if (firebaseSettings.myTextColor) {
        myTextColor = firebaseSettings.myTextColor;
    }
    if (firebaseSettings.friendTextColor) {
        friendTextColor = firebaseSettings.friendTextColor;
    }

    // Re-apply borders with new settings
    applyBorders();
}

// Load settings on startup
loadSettingsFromFirebase();