let allDiscordUsers = [];
let allSteamFriends = [];
let selectedDiscordUser = null;
let selectedSteamFriend = null;
let userMappings = {}; // Object to store mappings: { nickname: [discordId, steamId] }

// --- DOM Elements ---
let discordListDiv, steamListDiv, discordSearchInput, steamSearchInput;
let selectedDiscordDiv, selectedSteamDiv, nicknameInput, addMappingButton;
let currentMappingsDiv, outputJsonTextarea, steamLoginStatusDiv;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Assign DOM elements
    discordListDiv = document.getElementById('discord-list');
    steamListDiv = document.getElementById('steam-list');
    discordSearchInput = document.getElementById('discord-search');
    steamSearchInput = document.getElementById('steam-search');
    selectedDiscordDiv = document.getElementById('selected-discord');
    selectedSteamDiv = document.getElementById('selected-steam');
    nicknameInput = document.getElementById('nickname');
    addMappingButton = document.getElementById('add-mapping');
    currentMappingsDiv = document.getElementById('current-mappings');
    outputJsonTextarea = document.getElementById('output-json');
    steamLoginStatusDiv = document.getElementById('steam-login-status');

    // Add event listeners
    discordSearchInput.addEventListener('input', () => renderDiscordList(filterUsers(allDiscordUsers, discordSearchInput.value)));
    steamSearchInput.addEventListener('input', () => renderSteamList(filterUsers(allSteamFriends, steamSearchInput.value)));
    addMappingButton.addEventListener('click', addMapping);

    // Load initial data
    loadDiscordUsers();
    loadSteamFriends();
});

// --- Data Loading ---
async function loadDiscordUsers() {
    try {
        const response = await fetch('/api/discord/users');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        allDiscordUsers = await response.json();
        renderDiscordList(allDiscordUsers);
    } catch (error) {
        console.error('Error fetching Discord users:', error);
        discordListDiv.innerHTML = 'Error loading Discord users.';
    }
}

async function loadSteamFriends() {
    try {
        const response = await fetch('/api/steam/friends');
        if (response.status === 401) {
            steamLoginStatusDiv.style.display = 'block';
            steamListDiv.innerHTML = 'Please log in to Steam first.';
            return;
        }
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        steamLoginStatusDiv.style.display = 'none';
        allSteamFriends = await response.json();
        renderSteamList(allSteamFriends);
    } catch (error) {
        console.error('Error fetching Steam friends:', error);
        steamListDiv.innerHTML = 'Error loading Steam friends.';
    }
}

// --- List Rendering & Filtering ---
function filterUsers(users, searchTerm) {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return users.filter(user => user.username.toLowerCase().includes(lowerCaseSearchTerm));
}

function renderDiscordList(usersToRender) {
    renderList(usersToRender, discordListDiv, 'discord-item', 'discordUserId', selectDiscordUser);
}

function renderSteamList(usersToRender) {
    renderList(usersToRender, steamListDiv, 'steam-item', 'steamFriendId', selectSteamFriend);
}

function renderList(items, listElement, itemClass, dataAttribute, selectFunction) {
    listElement.innerHTML = ''; // Clear previous list
    items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = itemClass + ' list-item'; // Add generic list-item class
        itemDiv.dataset[dataAttribute] = item.id;

        // Highlight if selected
        const isSelected = (itemClass === 'discord-item' && selectedDiscordUser?.id === item.id) ||
                           (itemClass === 'steam-item' && selectedSteamFriend?.id === item.id);
        if (isSelected) {
            itemDiv.classList.add('selected');
        }

        itemDiv.addEventListener('click', () => selectFunction(item));

        const img = document.createElement('img');
        img.src = item.avatar || 'default-avatar.png';
        img.alt = `${item.username}'s avatar`;

        const nameSpan = document.createElement('span');
        nameSpan.textContent = item.username;

        itemDiv.appendChild(img);
        itemDiv.appendChild(nameSpan);
        listElement.appendChild(itemDiv);
    });
}

// --- Selection Handling ---
function selectDiscordUser(user) {
    selectedDiscordUser = user;
    selectedDiscordDiv.textContent = `Selected: ${user.username}`;
    // Re-render to update selection highlight
    renderDiscordList(filterUsers(allDiscordUsers, discordSearchInput.value));
}

function selectSteamFriend(friend) {
    selectedSteamFriend = friend;
    selectedSteamDiv.textContent = `Selected: ${friend.username}`;
    // Re-render to update selection highlight
    renderSteamList(filterUsers(allSteamFriends, steamSearchInput.value));
}

// --- Mapping Logic ---
function addMapping() {
    const nickname = nicknameInput.value.trim();

    if (!nickname) {
        alert('Please enter a nickname.');
        return;
    }
    if (!selectedDiscordUser && !selectedSteamFriend) {
        alert('Please select at least one Discord user or Steam friend.');
        return;
    }

    const discordId = selectedDiscordUser ? `discord:${selectedDiscordUser.id}` : null;
    const steamId = selectedSteamFriend ? `steam:${selectedSteamFriend.id}` : null;

    // Store the mapping - allowing overwrite for simplicity
    userMappings[nickname] = [discordId, steamId].filter(id => id !== null); // Filter out nulls

    // Clear inputs and selections
    nicknameInput.value = '';
    selectedDiscordUser = null;
    selectedSteamFriend = null;
    selectedDiscordDiv.textContent = 'Selected: None';
    selectedSteamDiv.textContent = 'Selected: None';

    // Re-render lists to remove selection highlights
    renderDiscordList(filterUsers(allDiscordUsers, discordSearchInput.value));
    renderSteamList(filterUsers(allSteamFriends, steamSearchInput.value));

    // Update display
    renderCurrentMappings();
    updateOutputJson();
}

function renderCurrentMappings() {
    currentMappingsDiv.innerHTML = ''; // Clear previous mappings
    if (Object.keys(userMappings).length === 0) {
        currentMappingsDiv.innerHTML = 'No mappings created yet.';
        return;
    }

    const ul = document.createElement('ul');
    for (const nickname in userMappings) {
        const li = document.createElement('li');
        const ids = userMappings[nickname].join(', ');
        li.textContent = `${nickname}: ${ids}`;

        // Add a delete button
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.style.marginLeft = '10px';
        deleteButton.onclick = () => deleteMapping(nickname);
        li.appendChild(deleteButton);

        ul.appendChild(li);
    }
    currentMappingsDiv.appendChild(ul);
}

function deleteMapping(nickname) {
    delete userMappings[nickname];
    renderCurrentMappings();
    updateOutputJson();
}

// --- Output Generation ---
function updateOutputJson() {
    const outputObject = {
        userMapping: userMappings
    };
    // Pretty print the JSON
    outputJsonTextarea.value = JSON.stringify(outputObject, null, 2);
}
