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
                        <div id="online-users-list" style="max-height: 300px; overflow-y: auto; margin-bottom: 10px;"></div>
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
                
                <!-- Friend Usernames Section -->
                <div style="margin-bottom: 24px;">
                    <h3 id="friend-usernames-toggle" style="color: white; margin: 0 0 12px 0; font-size: 16px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                        <span id="friend-usernames-arrow" style="font-size: 12px;">▶</span>
                        Friend Usernames
                        <span id="friend-usernames-count" style="
                            background: #3b82f6;
                            color: white;
                            font-size: 11px;
                            padding: 2px 8px;
                            border-radius: 10px;
                            font-weight: 600;
                        ">0</span>
                    </h3>
                    <div id="friend-usernames-content" style="display: none;">
                        <div id="friend-usernames-list" style="margin-bottom: 10px;"></div>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="friend-username-input" placeholder="Add username" style="
                                flex: 1;
                                background: #2a2a2a;
                                border: 1px solid #444;
                                border-radius: 6px;
                                padding: 8px 12px;
                                color: white;
                                font-size: 14px;
                                outline: none;
                            " />
                            <button id="add-friend-btn" style="
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
                
                <!-- My Settings Section -->
                <div style="margin-bottom: 24px;">
                    <h3 id="my-settings-toggle" style="color: white; margin: 0 0 12px 0; font-size: 16px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                        <span id="my-settings-arrow" style="font-size: 12px;">▶</span>
                        My Chat Style
                    </h3>
                    <div id="my-settings-content" style="display: none;">
                        <div id="my-settings-panel" style="
                            background: #333;
                            border-radius: 6px;
                            padding: 12px;
                            margin-bottom: 8px;
                        ">
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                <!-- Border settings -->
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" id="my-border-enabled" style="cursor: pointer;" />
                                    <label style="color: #ccc; font-size: 13px; width: 60px;">Border:</label>
                                    <input type="text" id="my-border-color1" placeholder="#hex" style="
                                        width: 70px;
                                        background: #2a2a2a;
                                        border: 1px solid #444;
                                        border-radius: 4px;
                                        padding: 4px 8px;
                                        color: white;
                                        font-size: 12px;
                                    " />
                                    <div id="my-border-preview1" style="
                                        width: 18px;
                                        height: 18px;
                                        border-radius: 4px;
                                        background: #333;
                                        border: 1px solid #555;
                                    "></div>
                                    <input type="text" id="my-border-color2" placeholder="#hex (optional)" style="
                                        width: 70px;
                                        background: #2a2a2a;
                                        border: 1px solid #444;
                                        border-radius: 4px;
                                        padding: 4px 8px;
                                        color: white;
                                        font-size: 12px;
                                    " />
                                    <div id="my-border-preview2" style="
                                        width: 18px;
                                        height: 18px;
                                        border-radius: 4px;
                                        background: #333;
                                        border: 1px solid #555;
                                    "></div>
                                </div>
                                <!-- Text color settings -->
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" id="my-text-enabled" style="cursor: pointer;" />
                                    <label style="color: #ccc; font-size: 13px; width: 60px;">Text:</label>
                                    <input type="text" id="my-text-color" placeholder="#hex" style="
                                        width: 70px;
                                        background: #2a2a2a;
                                        border: 1px solid #444;
                                        border-radius: 4px;
                                        padding: 4px 8px;
                                        color: white;
                                        font-size: 12px;
                                    " />
                                    <div id="my-text-preview" style="
                                        width: 18px;
                                        height: 18px;
                                        border-radius: 4px;
                                        background: #333;
                                        border: 1px solid #555;
                                    "></div>
                                </div>
                                <!-- Level badge settings -->
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" id="my-level-enabled" style="cursor: pointer;" />
                                    <label style="color: #ccc; font-size: 13px; width: 60px;">Level:</label>
                                    <input type="text" id="my-level-color1" placeholder="#hex" style="
                                        width: 70px;
                                        background: #2a2a2a;
                                        border: 1px solid #444;
                                        border-radius: 4px;
                                        padding: 4px 8px;
                                        color: white;
                                        font-size: 12px;
                                    " />
                                    <div id="my-level-preview1" style="
                                        width: 18px;
                                        height: 18px;
                                        border-radius: 4px;
                                        background: #333;
                                        border: 1px solid #555;
                                    "></div>
                                    <input type="text" id="my-level-color2" placeholder="#hex (optional)" style="
                                        width: 70px;
                                        background: #2a2a2a;
                                        border: 1px solid #444;
                                        border-radius: 4px;
                                        padding: 4px 8px;
                                        color: white;
                                        font-size: 12px;
                                    " />
                                    <div id="my-level-preview2" style="
                                        width: 18px;
                                        height: 18px;
                                        border-radius: 4px;
                                        background: #333;
                                        border: 1px solid #555;
                                    "></div>
                                </div>
                                <!-- Avatar frame settings -->
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" id="my-frame-enabled" style="cursor: pointer;" />
                                    <label style="color: #ccc; font-size: 13px; width: 60px;">Frame:</label>
                                    <input type="text" id="my-frame-url" placeholder="Paste image URL" style="
                                        flex: 1;
                                        background: #2a2a2a;
                                        border: 1px solid #444;
                                        border-radius: 4px;
                                        padding: 4px 8px;
                                        color: white;
                                        font-size: 12px;
                                    " />
                                    <div id="my-frame-preview" style="
                                        width: 32px;
                                        height: 32px;
                                        border-radius: 4px;
                                        background: #2a2a2a;
                                        border: 1px solid #555;
                                        display: none;
                                        align-items: center;
                                        justify-content: center;
                                        overflow: hidden;
                                        cursor: pointer;
                                    " title="Click to change">
                                        <img id="my-frame-preview-img" style="width: 100%; height: 100%; object-fit: contain;" />
                                    </div>
                                </div>
                                <button id="save-my-settings" style="
                                    background: #22c55e;
                                    border: none;
                                    border-radius: 4px;
                                    padding: 6px 12px;
                                    color: white;
                                    font-size: 12px;
                                    cursor: pointer;
                                    align-self: flex-end;
                                ">Save My Style</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- BetterNow User Style Section -->
                <div style="margin-bottom: 24px;">
                    <h3 id="betternow-style-toggle" style="color: white; margin: 0 0 12px 0; font-size: 16px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                        <span id="betternow-style-arrow" style="font-size: 12px;">▶</span>
                        BetterNow User Style
                    </h3>
                    <div id="betternow-style-content" style="display: none;">
                        <div id="betternow-style-panel" style="
                            background: #333;
                            border-radius: 6px;
                            padding: 12px;
                            margin-bottom: 8px;
                        ">
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                <!-- Badge icon URL -->
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <label style="color: #ccc; font-size: 13px; width: 70px;">Badge:</label>
                                    <input type="text" id="betternow-badge-url" placeholder="Badge image URL" style="
                                        flex: 1;
                                        background: #2a2a2a;
                                        border: 1px solid #444;
                                        border-radius: 4px;
                                        padding: 4px 8px;
                                        color: white;
                                        font-size: 12px;
                                    " />
                                    <div id="betternow-badge-preview" style="
                                        width: 24px;
                                        height: 24px;
                                        border-radius: 4px;
                                        background: #2a2a2a;
                                        border: 1px solid #555;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        overflow: hidden;
                                    ">
                                        <img id="betternow-badge-preview-img" style="width: 16px; height: 16px; object-fit: contain;" />
                                    </div>
                                </div>
                                <!-- Text color -->
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <label style="color: #ccc; font-size: 13px; width: 70px;">Text:</label>
                                    <input type="text" id="betternow-text-color" placeholder="#hex" style="
                                        width: 70px;
                                        background: #2a2a2a;
                                        border: 1px solid #444;
                                        border-radius: 4px;
                                        padding: 4px 8px;
                                        color: white;
                                        font-size: 12px;
                                    " />
                                    <div id="betternow-text-preview" style="
                                        width: 18px;
                                        height: 18px;
                                        border-radius: 4px;
                                        background: #333;
                                        border: 1px solid #555;
                                    "></div>
                                </div>
                                <!-- Glow color -->
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <label style="color: #ccc; font-size: 13px; width: 70px;">Glow:</label>
                                    <input type="text" id="betternow-glow-color" placeholder="#hex" style="
                                        width: 70px;
                                        background: #2a2a2a;
                                        border: 1px solid #444;
                                        border-radius: 4px;
                                        padding: 4px 8px;
                                        color: white;
                                        font-size: 12px;
                                    " />
                                    <div id="betternow-glow-preview" style="
                                        width: 18px;
                                        height: 18px;
                                        border-radius: 4px;
                                        background: #333;
                                        border: 1px solid #555;
                                    "></div>
                                </div>
                                <!-- Glow intensity -->
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <label style="color: #ccc; font-size: 13px; width: 70px;">Intensity:</label>
                                    <input type="range" id="betternow-glow-intensity" min="0" max="10" step="1" value="6" style="
                                        width: 100px;
                                        cursor: pointer;
                                    " />
                                    <span id="betternow-intensity-value" style="color: #ccc; font-size: 12px; width: 30px;">6px</span>
                                </div>
                                <!-- Glow opacity -->
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <label style="color: #ccc; font-size: 13px; width: 70px;">Opacity:</label>
                                    <input type="range" id="betternow-glow-opacity" min="0" max="100" step="1" value="100" style="
                                        width: 100px;
                                        cursor: pointer;
                                    " />
                                    <span id="betternow-opacity-value" style="color: #ccc; font-size: 12px; width: 35px;">100%</span>
                                </div>
                                <!-- Online indicator color -->
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <label style="color: #ccc; font-size: 13px; width: 70px;">Online:</label>
                                    <input type="text" id="betternow-online-color" placeholder="#hex" style="
                                        width: 70px;
                                        background: #2a2a2a;
                                        border: 1px solid #444;
                                        border-radius: 4px;
                                        padding: 4px 8px;
                                        color: white;
                                        font-size: 12px;
                                    " />
                                    <div id="betternow-online-preview" style="
                                        width: 18px;
                                        height: 18px;
                                        border-radius: 50%;
                                        background: #08d687;
                                        border: 1px solid #555;
                                    "></div>
                                    <span style="color: #666; font-size: 11px;">Chat online dot</span>
                                </div>
                                <!-- Live preview card -->
                                <div style="margin-top: 8px; padding: 12px; background: #212121; border-radius: 8px; border: 1px solid #444;">
                                    <p style="color: #888; font-size: 11px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">Preview</p>
                                    <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                                        <!-- Mock avatar with badge -->
                                        <div style="position: relative;">
                                            <div style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #444, #666); display: flex; align-items: center; justify-content: center;">
                                                <span style="font-size: 24px;">👤</span>
                                            </div>
                                            <img id="betternow-preview-badge-icon" style="position: absolute; bottom: -2px; right: -2px; width: 20px; height: 20px; background: #212121; border-radius: 4px; padding: 2px;" />
                                        </div>
                                        <!-- Mock username -->
                                        <div style="text-align: center;">
                                            <div style="color: white; font-size: 14px; font-weight: 600;">SampleUser</div>
                                            <div style="color: #888; font-size: 12px;">Level 42</div>
                                        </div>
                                        <!-- BetterNow User text -->
                                        <span id="betternow-live-preview" style="
                                            font-size: 14px;
                                            font-weight: 600;
                                        ">BetterNow User</span>
                                    </div>
                                </div>
                                <button id="save-betternow-style" style="
                                    background: #22c55e;
                                    border: none;
                                    border-radius: 4px;
                                    padding: 6px 12px;
                                    color: white;
                                    font-size: 12px;
                                    cursor: pointer;
                                    align-self: flex-end;
                                ">Save Style</button>
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