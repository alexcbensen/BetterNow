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
    if (firebaseSettings.friendSettings) {
        friendSettings = firebaseSettings.friendSettings;
    }
    if (firebaseSettings.grantedFeatures) {
        grantedFeatures = firebaseSettings.grantedFeatures;
    }
    if (firebaseSettings.mySettings) {
        mySettings = firebaseSettings.mySettings;
    }

    // Re-apply chat styles with new settings
    applyChatStyles();
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

        // Convert friendSettings object to Firestore map format (keyed by odiskd)
        const friendSettingsMap = {};
        for (const [odiskd, settings] of Object.entries(friendSettings)) {
            friendSettingsMap[odiskd] = {
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
            `${FIRESTORE_BASE_URL}/config/settings?updateMask.fieldPaths=friendUserIds&updateMask.fieldPaths=hiddenUserIds&updateMask.fieldPaths=friendUsers&updateMask.fieldPaths=hiddenUsers&updateMask.fieldPaths=hiddenExceptions&updateMask.fieldPaths=friendSettings&updateMask.fieldPaths=grantedFeatures&updateMask.fieldPaths=mySettings`,
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
                        friendSettings: {
                            mapValue: {
                                fields: friendSettingsMap
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
