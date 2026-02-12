/*
 * Alex's BetterNow
 * Copyright (c) 2026 Alex
 * All rights reserved.
 *
 * This code may not be copied, modified, or distributed without permission.
 */

// Firebase configuration and initialization

const firebaseConfig = {
    apiKey: "AIzaSyCJ6MF-GANoffIH7T3sdVSUcuQ9bP3BT1k",
    authDomain: "betternow-extension.firebaseapp.com",
    projectId: "betternow-extension",
    storageBucket: "betternow-extension.firebasestorage.app",
    messagingSenderId: "996954294250",
    appId: "1:996954294250:web:882829106bc4bad1859493"
};

const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

// Settings cache
let firebaseSettings = null;
let settingsLoaded = false;

// Auth state
let firebaseIdToken = sessionStorage.getItem('firebaseIdToken') || null;

// Validate Firebase token by making a lightweight authenticated request
async function validateFirebaseToken() {
    if (!firebaseIdToken) return false;

    try {
        // Try to read a document that requires auth - use config/settings as it's small
        const response = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: firebaseIdToken })
            }
        );

        if (!response.ok) {
            // Token is invalid or expired
            firebaseIdToken = null;
            sessionStorage.removeItem('firebaseIdToken');
            return false;
        }

        return true;
    } catch (e) {
        // Network error - assume token might still be valid
        return true;
    }
}

// Check token validity and update admin icon (called when profile popover opens)
async function checkAuthAndUpdateIcon() {
    const isValid = await validateFirebaseToken();

    // Update the admin icon if it exists
    const icon = document.getElementById('admin-lock-icon');
    if (icon) {
        icon.className = isValid ? 'bi bi-unlock-fill' : 'bi bi-lock-fill';
    }

    return isValid;
}

// Firebase SDK state (loaded via manifest)
let firebaseApp = null;
let firestoreDb = null;
let firebaseSDKLoaded = false;

// Active listeners (to clean up on navigation)
let chestEnabledUnsubscribe = null;

// Global feature kill switches (disabled by admin = feature off for ALL users)
let globalAutoChestEnabled = true;
let globalAutoMissionsEnabled = true;

// Initialize Firebase SDK (bundled files loaded via manifest)
function initFirebaseSDK() {
    if (firebaseSDKLoaded) return true;

    try {
        // Check if Firebase was loaded via manifest
        if (typeof firebase === 'undefined' || !firebase.initializeApp) {
            console.warn('[BetterNow] Firebase SDK not loaded');
            return false;
        }

        // Initialize Firebase
        firebaseApp = firebase.initializeApp(firebaseConfig);
        firestoreDb = firebase.firestore();

        firebaseSDKLoaded = true;
        return true;
    } catch (error) {
        console.error('[BetterNow] Failed to initialize Firebase SDK:', error);
        return false;
    }
}

// Subscribe to chestEnabled document for a broadcaster (viewers only)
// Returns unsubscribe function
function subscribeToChestEnabled(broadcasterId, onUpdate) {
    if (!broadcasterId) return null;

    // Initialize SDK if not already done
    if (!initFirebaseSDK()) {
        console.warn('[BetterNow] Cannot subscribe to chestEnabled - SDK not initialized');
        return null;
    }

    try {
        const docRef = firestoreDb.collection('chestEnabled').doc(broadcasterId);

        const unsubscribe = docRef.onSnapshot((docSnap) => {
            if (docSnap.exists) {
                const data = docSnap.data();
                onUpdate({
                    enabled: data.enabled || false,
                    threshold: data.threshold || 0,
                    awaitingConfirmation: data.awaitingConfirmation || false,
                    chestDropStartTime: data.chestDropStartTime || 0,
                    likesBeingDropped: data.likesBeingDropped || 0
                });
            } else {
                // Document doesn't exist - broadcaster hasn't enabled chest
                onUpdate(null);
            }
        }, (error) => {
            console.error('[BetterNow] chestEnabled listener error:', error);
            onUpdate(null);
        });

        return unsubscribe;
    } catch (error) {
        console.error('[BetterNow] Failed to subscribe to chestEnabled:', error);
        return null;
    }
}

// Unsubscribe from current chest enabled listener
function unsubscribeFromChestEnabled() {
    if (chestEnabledUnsubscribe) {
        chestEnabledUnsubscribe();
        chestEnabledUnsubscribe = null;
        console.log('[BetterNow] Unsubscribed from chestEnabled');
    }
}

// Save chest enabled state (broadcaster only) - writes to chestEnabled collection
async function saveChestEnabledToFirebase(enabled, threshold, awaitingConfirmation = false, chestDropStartTime = 0, likesBeingDropped = 0) {
    if (!currentUserId) {
        console.warn('[BetterNow] saveChestEnabledToFirebase: currentUserId not set');
        return false;
    }

    try {
        const response = await fetch(
            `${FIRESTORE_BASE_URL}/chestEnabled/${currentUserId}`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fields: {
                        enabled: { booleanValue: enabled },
                        threshold: { integerValue: threshold },
                        awaitingConfirmation: { booleanValue: awaitingConfirmation },
                        chestDropStartTime: { integerValue: chestDropStartTime },
                        likesBeingDropped: { integerValue: likesBeingDropped }
                    }
                })
            }
        );

        if (!response.ok) {
            console.error('[BetterNow] saveChestEnabledToFirebase: HTTP error', response.status);
            return false;
        }

        return true;
    } catch (error) {
        console.error('[BetterNow] saveChestEnabledToFirebase: Error', error);
        return false;
    }
}

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
    if (firebaseSettings.friendUserIds) {
        friendUserIds = firebaseSettings.friendUserIds;
    }
    if (firebaseSettings.hiddenUserIds) {
        hiddenUserIds = firebaseSettings.hiddenUserIds;
    }
    if (firebaseSettings.friendUsers) {
        friendUsers = firebaseSettings.friendUsers;
    }
    if (firebaseSettings.hiddenUsers) {
        hiddenUsers = firebaseSettings.hiddenUsers;
    }
    if (firebaseSettings.hiddenExceptions) {
        hiddenExceptions = firebaseSettings.hiddenExceptions;
    }
    if (firebaseSettings.userSettings) {
        userSettings = firebaseSettings.userSettings;
    }
    if (firebaseSettings.grantedFeatures) {
        grantedFeatures = firebaseSettings.grantedFeatures;
    }
    if (firebaseSettings.mySettings) {
        mySettings = firebaseSettings.mySettings;
    }
    if (firebaseSettings.betternowUserStyle) {
        betternowUserStyle = {
            ...betternowUserStyle,
            ...firebaseSettings.betternowUserStyle
        };
        // Ensure glowIntensity is a number
        if (typeof betternowUserStyle.glowIntensity !== 'number') {
            betternowUserStyle.glowIntensity = 6;
        }
        // Ensure glowOpacity is a number
        if (typeof betternowUserStyle.glowOpacity !== 'number') {
            betternowUserStyle.glowOpacity = 100;
        }
    }
    if (firebaseSettings.developerUserIds && Array.isArray(firebaseSettings.developerUserIds)) {
        DEVELOPER_USER_IDS = firebaseSettings.developerUserIds;
    }
    if (firebaseSettings.adminOnlyUserIds && Array.isArray(firebaseSettings.adminOnlyUserIds)) {
        ADMIN_ONLY_USER_IDS = firebaseSettings.adminOnlyUserIds;
    }
    // ADMIN_USER_IDS only includes adminOnlyUserIds (developers get badge only, not admin)
    ADMIN_USER_IDS = [...ADMIN_ONLY_USER_IDS];

    // Load global feature kill switches (default to true if not set)
    if (typeof firebaseSettings.globalAutoChestEnabled === 'boolean') {
        globalAutoChestEnabled = firebaseSettings.globalAutoChestEnabled;
    }
    if (typeof firebaseSettings.globalAutoMissionsEnabled === 'boolean') {
        globalAutoMissionsEnabled = firebaseSettings.globalAutoMissionsEnabled;
    }

    // Re-apply chat styles with new settings
    if (typeof applyChatStyles === 'function') {
        applyChatStyles();
    }

    // Update online indicator style with new settings
    if (typeof initOnlineIndicatorStyle === 'function') {
        initOnlineIndicatorStyle();
    }
}

// Load settings on startup
loadSettingsFromFirebase();

// Sign in with email/password
async function signInWithEmailPassword(email, password) {
    const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                password: password,
                returnSecureToken: true
            })
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Auth failed');
    }

    const data = await response.json();
    return data.idToken;
}

function showAuthPrompt() {
    return new Promise((resolve, reject) => {
        const overlay = createOverlay('auth-overlay', `
            <div style="
                background: #1a1a1a;
                border-radius: 12px;
                padding: 30px;
                text-align: center;
                border: 1px solid #333;
            ">
                <h2 style="color: white; margin: 0 0 20px 0; font-family: proxima-nova, sans-serif;">Sign In to Save</h2>
                <input type="email" id="auth-email" placeholder="Email" style="
                    background: #2a2a2a;
                    border: 1px solid #444;
                    border-radius: 8px;
                    padding: 12px 20px;
                    color: white;
                    font-size: 16px;
                    width: 250px;
                    outline: none;
                    display: block;
                    margin: 0 auto 10px auto;
                " />
                <input type="password" id="auth-password" placeholder="Password" style="
                    background: #2a2a2a;
                    border: 1px solid #444;
                    border-radius: 8px;
                    padding: 12px 20px;
                    color: white;
                    font-size: 16px;
                    width: 250px;
                    outline: none;
                    display: block;
                    margin: 0 auto;
                " />
                <div style="margin-top: 20px;">
                    <button id="auth-submit" style="
                        background: #22c55e;
                        border: none;
                        border-radius: 8px;
                        padding: 10px 30px;
                        color: white;
                        font-size: 16px;
                        cursor: pointer;
                        margin-right: 10px;
                    ">Sign In</button>
                    <button id="auth-cancel" style="
                        background: #444;
                        border: none;
                        border-radius: 8px;
                        padding: 10px 30px;
                        color: white;
                        font-size: 16px;
                        cursor: pointer;
                    ">Cancel</button>
                </div>
                <p id="auth-error" style="color: #ef4444; margin: 15px 0 0 0; display: none;"></p>
            </div>
        `);
        document.body.appendChild(overlay);

        const emailInput = document.getElementById('auth-email');
        const passwordInput = document.getElementById('auth-password');
        const submitBtn = document.getElementById('auth-submit');
        const cancelBtn = document.getElementById('auth-cancel');
        const errorMsg = document.getElementById('auth-error');

        emailInput.focus();

        const trySignIn = async () => {
            const email = emailInput.value.trim();
            const password = passwordInput.value;

            if (!email || !password) {
                errorMsg.textContent = 'Please enter email and password';
                errorMsg.style.display = 'block';
                return;
            }

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Signing in...';
                const token = await signInWithEmailPassword(email, password);
                sessionStorage.setItem('firebaseIdToken', token);
                overlay.remove();
                resolve(token);
            } catch (error) {
                errorMsg.textContent = error.message;
                errorMsg.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign In';
            }
        };

        submitBtn.addEventListener('click', trySignIn);
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') trySignIn();
        });
        cancelBtn.addEventListener('click', () => {
            overlay.remove();
            reject(new Error('Sign-in cancelled'));
        });
    });
}

async function saveSettingsToFirebase() {
    const statusEl = document.getElementById('admin-save-status');

    try {
        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.style.color = '#888';
            statusEl.textContent = 'Saving...';
        }

        // Convert userSettings object to Firestore map format (keyed by odiskd)
        const userSettingsMap = {};
        for (const [odiskd, settings] of Object.entries(userSettings)) {
            userSettingsMap[odiskd] = {
                mapValue: {
                    fields: {
                        borderEnabled: { booleanValue: settings.borderEnabled || false },
                        borderColor1: { stringValue: settings.borderColor1 || '' },
                        borderColor2: { stringValue: settings.borderColor2 || '' },
                        textColor: { stringValue: settings.textColor || '' },
                        levelEnabled: { booleanValue: settings.levelEnabled || false },
                        levelColor1: { stringValue: settings.levelColor1 || '' },
                        levelColor2: { stringValue: settings.levelColor2 || '' }
                    }
                }
            };
        }

        // Convert friendUsers object to Firestore map format
        const friendUsersMap = {};
        for (const [odiskd, data] of Object.entries(friendUsers)) {
            friendUsersMap[odiskd] = {
                mapValue: {
                    fields: {
                        username: { stringValue: data.username || '' },
                        avatar: { stringValue: data.avatar || '' }
                    }
                }
            };
        }

        // Convert hiddenUsers object to Firestore map format
        const hiddenUsersMap = {};
        for (const [odiskd, data] of Object.entries(hiddenUsers)) {
            hiddenUsersMap[odiskd] = {
                mapValue: {
                    fields: {
                        username: { stringValue: data.username || '' },
                        avatar: { stringValue: data.avatar || '' }
                    }
                }
            };
        }

        // Convert hiddenExceptions object to Firestore map format (nested maps)
        // Structure: { hiddenUserId: { exceptionUserId: { username, avatar } } }
        const hiddenExceptionsMap = {};
        for (const [hiddenId, exceptions] of Object.entries(hiddenExceptions)) {
            const exceptionsInner = {};
            for (const [exceptionId, userData] of Object.entries(exceptions)) {
                exceptionsInner[exceptionId] = {
                    mapValue: {
                        fields: {
                            username: { stringValue: userData.username || '' },
                            avatar: { stringValue: userData.avatar || '' }
                        }
                    }
                };
            }
            hiddenExceptionsMap[hiddenId] = {
                mapValue: {
                    fields: exceptionsInner
                }
            };
        }

        // Convert grantedFeatures object to Firestore map format
        // Format: { "userId": ["filterBypass", "otherFeature"] }
        const grantedFeaturesMap = {};
        for (const [odiskd, features] of Object.entries(grantedFeatures)) {
            grantedFeaturesMap[odiskd] = {
                arrayValue: {
                    values: (features || []).map(f => ({ stringValue: f }))
                }
            };
        }

        const response = await fetch(
            `${FIRESTORE_BASE_URL}/config/settings?updateMask.fieldPaths=friendUserIds&updateMask.fieldPaths=hiddenUserIds&updateMask.fieldPaths=friendUsers&updateMask.fieldPaths=hiddenUsers&updateMask.fieldPaths=hiddenExceptions&updateMask.fieldPaths=userSettings&updateMask.fieldPaths=grantedFeatures&updateMask.fieldPaths=mySettings&updateMask.fieldPaths=betternowUserStyle&updateMask.fieldPaths=developerUserIds&updateMask.fieldPaths=adminOnlyUserIds&updateMask.fieldPaths=globalAutoChestEnabled&updateMask.fieldPaths=globalAutoMissionsEnabled`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${firebaseIdToken}`
                },
                body: JSON.stringify({
                    fields: {
                        friendUserIds: {
                            arrayValue: {
                                values: friendUserIds.map(id => ({ stringValue: String(id) }))
                            }
                        },
                        hiddenUserIds: {
                            arrayValue: {
                                values: hiddenUserIds.map(id => ({ stringValue: String(id) }))
                            }
                        },
                        friendUsers: {
                            mapValue: {
                                fields: friendUsersMap
                            }
                        },
                        hiddenUsers: {
                            mapValue: {
                                fields: hiddenUsersMap
                            }
                        },
                        hiddenExceptions: {
                            mapValue: {
                                fields: hiddenExceptionsMap
                            }
                        },
                        userSettings: {
                            mapValue: {
                                fields: userSettingsMap
                            }
                        },
                        grantedFeatures: {
                            mapValue: {
                                fields: grantedFeaturesMap
                            }
                        },
                        mySettings: {
                            mapValue: {
                                fields: {
                                    borderEnabled: { booleanValue: mySettings.borderEnabled || false },
                                    borderColor1: { stringValue: mySettings.borderColor1 || '' },
                                    borderColor2: { stringValue: mySettings.borderColor2 || '' },
                                    textColor: { stringValue: mySettings.textColor || '' },
                                    levelEnabled: { booleanValue: mySettings.levelEnabled || false },
                                    levelColor1: { stringValue: mySettings.levelColor1 || '' },
                                    levelColor2: { stringValue: mySettings.levelColor2 || '' },
                                    frameEnabled: { booleanValue: mySettings.frameEnabled || false },
                                    frameUrl: { stringValue: mySettings.frameUrl || '' }
                                }
                            }
                        },
                        betternowUserStyle: {
                            mapValue: {
                                fields: {
                                    badgeUrl: { stringValue: betternowUserStyle.badgeUrl || '' },
                                    textColor: { stringValue: betternowUserStyle.textColor || '#e0c2f3' },
                                    glowColor: { stringValue: betternowUserStyle.glowColor || '#820ad0' },
                                    glowIntensity: { integerValue: betternowUserStyle.glowIntensity || 6 },
                                    glowOpacity: { integerValue: betternowUserStyle.glowOpacity || 100 },
                                    onlineColor: { stringValue: betternowUserStyle.onlineColor || '#820ad0' }
                                }
                            }
                        },
                        developerUserIds: {
                            arrayValue: {
                                values: DEVELOPER_USER_IDS.map(id => ({ stringValue: String(id) }))
                            }
                        },
                        adminOnlyUserIds: {
                            arrayValue: {
                                values: ADMIN_ONLY_USER_IDS.map(id => ({ stringValue: String(id) }))
                            }
                        },
                        globalAutoChestEnabled: {
                            booleanValue: globalAutoChestEnabled
                        },
                        globalAutoMissionsEnabled: {
                            booleanValue: globalAutoMissionsEnabled
                        }
                    }
                })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            if (response.status === 401 || response.status === 403) {
                firebaseIdToken = null;
                sessionStorage.removeItem('firebaseIdToken');
                throw new Error('Auth expired. Please sign in again.');
            }
            throw new Error(error.error?.message || 'Failed to save');
        }

        if (statusEl) {
            statusEl.style.color = '#22c55e';
            statusEl.textContent = 'Saved!';

            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 1500);
        }

    } catch (error) {
        console.error('Error saving to Firebase:', error);
        if (statusEl) {
            statusEl.style.color = '#ef4444';
            statusEl.textContent = 'Error: ' + error.message;
        }
    }
}