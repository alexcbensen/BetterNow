/*
 * Alex's BetterNow
 * Copyright (c) 2026 Alex
 * All rights reserved.
 *
 * This code may not be copied, modified, or distributed without permission.
 */

const templates = {
    adminPanel: `
        <div style="
            background: #1a1a1a;
            border-radius: 12px;
            padding: 30px;
            min-width: 500px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            border: 1px solid #333;
            position: relative;
        ">
            <button id="admin-panel-close" style="
                position: absolute;
                top: 15px;
                right: 15px;
                background: none;
                border: none;
                color: #888;
                font-size: 24px;
                cursor: pointer;
            ">&times;</button>
            <h2 style="color: white; margin: 0 0 20px 0; font-family: proxima-nova, sans-serif;">Admin Panel</h2>
            
            <div id="admin-panel-content" style="color: #888; font-family: proxima-nova, sans-serif;">
                <!-- Online Users Section -->
                <div style="margin-bottom: 24px;">
                    <h3 id="online-users-toggle" style="color: white; margin: 0 0 12px 0; font-size: 16px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                        <span id="online-users-arrow" style="font-size: 12px;">▶</span>
                        Online Users
                        <span id="online-users-count" style="
                            background: var(--color-primary-green, #08d687);
                            color: white;
                            font-size: 11px;
                            padding: 2px 8px;
                            border-radius: 10px;
                            font-weight: 600;
                        ">0</span>
                    </h3>
                    <div id="online-users-content" style="display: none;">
                        <div id="online-users-list" style="max-height: 300px; overflow-y: auto; margin-bottom: 10px; scrollbar-width: none; -ms-overflow-style: none;"></div>
                        <style>#online-users-list::-webkit-scrollbar { display: none; }</style>
                        <button id="refresh-online-users" style="
                            background: #444;
                            border: none;
                            border-radius: 6px;
                            padding: 6px 12px;
                            color: white;
                            font-size: 12px;
                            cursor: pointer;
                        ">Refresh</button>
                    </div>
                </div>
                
                <!-- BetterNow Users Section -->
                <div style="margin-bottom: 24px;">
                    <h3 id="betternow-users-toggle" style="color: white; margin: 0 0 12px 0; font-size: 16px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                        <span id="betternow-users-arrow" style="font-size: 12px;">▶</span>
                        BetterNow Users
                        <span id="betternow-users-count" style="
                            background: #3b82f6;
                            color: white;
                            font-size: 11px;
                            padding: 2px 8px;
                            border-radius: 10px;
                            font-weight: 600;
                        ">0</span>
                    </h3>
                    <div id="betternow-users-content" style="display: none;">
                        <div id="betternow-users-list" style="margin-bottom: 10px;"></div>
                        <p style="color: #888; font-size: 12px; margin: 0;">Users who have used BetterNow appear here automatically.</p>
                    </div>
                </div>
                
                <!-- Feature Toggles Section (Kill Switches) -->
                <div style="margin-bottom: 24px;">
                    <h3 id="feature-toggles-toggle" style="color: white; margin: 0 0 12px 0; font-size: 16px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                        <span id="feature-toggles-arrow" style="font-size: 12px;">▶</span>
                        Feature Toggles
                        <span style="
                            background: #ef4444;
                            color: white;
                            font-size: 10px;
                            padding: 2px 6px;
                            border-radius: 4px;
                            font-weight: 600;
                        ">KILL SWITCH</span>
                    </h3>
                    <div id="feature-toggles-content" style="display: none;">
                        <p style="color: #888; font-size: 12px; margin: 0 0 12px 0;">
                            Disable features for ALL users instantly. Use this if you discover a bug after deployment.
                        </p>
                        <div style="
                            background: #333;
                            border-radius: 6px;
                            padding: 12px;
                        ">
                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                <!-- Auto Chest Toggle -->
                                <div style="display: flex; align-items: center; justify-content: space-between;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span style="font-size: 18px;">📦</span>
                                        <div>
                                            <div style="color: #fff; font-size: 14px; font-weight: 500;">Auto Chest</div>
                                            <div style="color: #888; font-size: 11px;">Automatic chest drops for broadcasters</div>
                                        </div>
                                    </div>
                                    <label style="position: relative; display: inline-block; width: 48px; height: 26px; cursor: pointer;">
                                        <input type="checkbox" id="killswitch-auto-chest" style="opacity: 0; width: 0; height: 0;">
                                        <span id="killswitch-auto-chest-slider" style="
                                            position: absolute;
                                            cursor: pointer;
                                            top: 0;
                                            left: 0;
                                            right: 0;
                                            bottom: 0;
                                            background-color: #ef4444;
                                            transition: .3s;
                                            border-radius: 26px;
                                        "></span>
                                        <span id="killswitch-auto-chest-dot" style="
                                            position: absolute;
                                            content: '';
                                            height: 20px;
                                            width: 20px;
                                            left: 3px;
                                            bottom: 3px;
                                            background-color: white;
                                            transition: .3s;
                                            border-radius: 50%;
                                        "></span>
                                    </label>
                                </div>
                                <!-- Auto Missions Toggle -->
                                <div style="display: flex; align-items: center; justify-content: space-between;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span style="font-size: 18px;">🎯</span>
                                        <div>
                                            <div style="color: #fff; font-size: 14px; font-weight: 500;">Auto Missions</div>
                                            <div style="color: #888; font-size: 11px;">Automatic mission claiming</div>
                                        </div>
                                    </div>
                                    <label style="position: relative; display: inline-block; width: 48px; height: 26px; cursor: pointer;">
                                        <input type="checkbox" id="killswitch-auto-missions" style="opacity: 0; width: 0; height: 0;">
                                        <span id="killswitch-auto-missions-slider" style="
                                            position: absolute;
                                            cursor: pointer;
                                            top: 0;
                                            left: 0;
                                            right: 0;
                                            bottom: 0;
                                            background-color: #ef4444;
                                            transition: .3s;
                                            border-radius: 26px;
                                        "></span>
                                        <span id="killswitch-auto-missions-dot" style="
                                            position: absolute;
                                            content: '';
                                            height: 20px;
                                            width: 20px;
                                            left: 3px;
                                            bottom: 3px;
                                            background-color: white;
                                            transition: .3s;
                                            border-radius: 50%;
                                        "></span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Hidden Broadcasters Section -->
                <div style="margin-bottom: 24px;">
                    <h3 id="hidden-broadcasters-toggle" style="color: white; margin: 0 0 12px 0; font-size: 16px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                        <span id="hidden-broadcasters-arrow" style="font-size: 12px;">▶</span>
                        Hidden Broadcasters
                    </h3>
                    <div id="hidden-broadcasters-content" style="display: none;">
                        <div id="hidden-broadcasters-list" style="margin-bottom: 10px;"></div>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="hidden-broadcaster-input" placeholder="Add broadcaster" style="
                                flex: 1;
                                background: #2a2a2a;
                                border: 1px solid #444;
                                border-radius: 6px;
                                padding: 8px 12px;
                                color: white;
                                font-size: 14px;
                                outline: none;
                            " />
                            <button id="add-hidden-btn" style="
                                background: #22c55e;
                                border: none;
                                border-radius: 6px;
                                padding: 8px 16px;
                                color: white;
                                font-size: 14px;
                                cursor: pointer;
                            ">Add</button>
                        </div>
                    </div>
                </div>
                
                <!-- Status Message -->
                <p id="admin-save-status" style="color: #888; margin: 10px 0 0 0; text-align: center; display: none;"></p>
            </div>
            
            <div style="padding-top: 16px; border-top: 1px solid #333;">
                <button id="admin-panel-lock" style="
                    background: #444;
                    border: none;
                    border-radius: 8px;
                    padding: 8px 16px;
                    color: white;
                    font-size: 14px;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                "><i class="bi bi-box-arrow-right"></i> Lock Panel</button>
            </div>
        </div>
    `
};