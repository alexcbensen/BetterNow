/*
 * Alex's BetterNow
 * Copyright (c) 2026 Alex
 * All rights reserved.
 *
 * This code may not be copied, modified, or distributed without permission.
 */

// Debug functions - log to console immediately for now
console.log('BetterNow debug.js loaded');

// Store references on a global we can access
document.body.setAttribute('data-betternow-loaded', 'true');

// Create debug function that logs current state
function runDebugFriends() {
    console.log('friendUsernames:', friendUsernames);
    console.log('friendSettings:', friendSettings);
    console.log('firebaseSettings:', firebaseSettings);
}

function runDebugChest() {
    console.log('Auto enabled:', autoChestEnabled);
    console.log('Threshold:', autoChestThreshold);
    console.log('Last chest likes:', lastChestOpenLikes);
    console.log('Last checked:', lastCheckedLikes);
    console.log('Current likes:', getCurrentLikesFromToolbar());
    console.log('Is opening:', isOpeningChest);
    console.log('Is dropping:', isChestDropping());
    console.log('Is broadcasting:', isBroadcasting());
    console.log('Chest count:', getCurrentLikesFromToolbar() - lastChestOpenLikes);
}

// Listen for custom events from console
document.addEventListener('debugFriends', runDebugFriends);
document.addEventListener('debugChest', runDebugChest);