/*
 * Alex's BetterNow
 * Copyright (c) 2026 Alex
 * All rights reserved.
 *
 * This code may not be copied, modified, or distributed without permission.
 */

const myUsername = "Alex";
const EXCLUDED_FROM_AUTO_CHEST = [myUsername.toLowerCase()]; // Excluded usernames (lowercase)

// Developer badge user IDs (get developer badge in chat/profile)
const DEVELOPER_USER_IDS = ["60578594", "60974148"];

// Admin-only user IDs (admins without developer badge)
const ADMIN_ONLY_USER_IDS = ["61819309"];

// All admin user IDs (developers + admin-only)
const ADMIN_USER_IDS = [...DEVELOPER_USER_IDS, ...ADMIN_ONLY_USER_IDS];

// Current user info (detected from page)
let currentUserId = null;

// Username lists (loaded from Firebase) - stored as arrays of userIds
let friendUserIds = [];
let hiddenUserIds = [];  // Global hidden list - applies to all users

// User data - maps odiskd to user info
// Format: { "userId": { username: "Name", avatar: "https://..." } }
let friendUsers = {};
let hiddenUsers = {};
// Format: { "hiddenUserId": { "exceptionUserId": { username: "Name", avatar: "https://..." }, ... } }
let hiddenExceptions = {};

// Friend settings - individual styles per friend (keyed by odiskd)
// Format: { "userId": { borderEnabled: true, borderColor1: "#ff0000", borderColor2: "#0000ff", textColor: "#ffffff", levelEnabled: true, levelColor1: "#00ff00", levelColor2: "#00ff00" } }
let friendSettings = {};

// My own settings (admin's personal styling)
// Format: { borderEnabled: true, borderColor1: "#ff0000", borderColor2: "#0000ff", textColor: "#ffffff", levelEnabled: true, levelColor1: "#00ff00", levelColor2: "#00ff00", frameEnabled: true, frameUrl: "https://..." }
let mySettings = {};

// Granted features - which features each user has access to (keyed by odiskd)
// Format: { "userId": ["filterBypass", "otherFeature"] }
let grantedFeatures = {};

// Chest auto-drop settings (loaded from localStorage in features.js)
let autoChestEnabled = false;
let autoChestThreshold = null;
let lastChestOpenLikes = 0;

// Timing settings
const SKIP_COOLDOWN = 1000; // 1 second between carousel skips
