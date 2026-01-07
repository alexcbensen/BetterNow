// Admin settings
const ADMIN_USER_ID = "60578594";

// Username lists (loaded from Firebase)
let myUsername = "";
let friendUsernames = [];
let hiddenBroadcasters = [];

// Gradient definitions (loaded from Firebase)
let myGradient = "";
let friendGradient = "";
let myTextColor = "";
let friendTextColor = "";

// Timing settings
const SKIP_COOLDOWN = 1000; // 1 second between carousel skips