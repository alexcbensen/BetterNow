/*
 * Alex's BetterNow
 * Copyright (c) 2026 Alex
 * All rights reserved.
 *
 * This code may not be copied, modified, or distributed without permission.
 */

const EXCLUDED_FROM_AUTO_CHEST = ["alex"]; // Excluded usernames (lowercase)

// Admin settings
const ADMIN_USER_IDS = ["60578594", "60974148", "61819309"];

// Username lists (loaded from Firebase) - stored as arrays of userIds
let myUsername = "";
let friendUserIds = [];
let hiddenUserIds = [];

// User data - maps odiskd to user info
// Format: { "userId": { username: "Name", avatar: "https://..." } }
let friendUsers = {};
let hiddenUsers = {};

// Friend settings - individual styles per friend (keyed by odiskd)
// Format: { "userId": { borderEnabled: true, borderColor1: "#ff0000", borderColor2: "#0000ff", textColor: "#ffffff", levelEnabled: true, levelColor1: "#00ff00", levelColor2: "#00ff00" } }
let friendSettings = {};

// Gradient definitions (loaded from Firebase)
let myGradient = "";
let myTextColor = "";

// Chest auto-drop settings (loaded from localStorage in features.js)
let autoChestEnabled = false;
let autoChestThreshold = null;
let lastChestOpenLikes = 0;

// Timing settings
const SKIP_COOLDOWN = 1000; // 1 second between carousel skips