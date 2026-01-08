// Admin settings
const ADMIN_USER_IDS = ["60578594", "60974148"];

// Username lists (loaded from Firebase)
let myUsername = "";
let friendUsernames = [];
let hiddenBroadcasters = [];

// Gradient definitions (loaded from Firebase)
let myGradient = "";
let friendGradient = "";
let myTextColor = "";
let friendTextColor = "";

// Chest auto-drop settings (loaded from localStorage in features.js)
let autoChestEnabled = false;
let autoChestThreshold = null;
let lastChestOpenLikes = 0;

// Timing settings
const SKIP_COOLDOWN = 1000; // 1 second between carousel skips