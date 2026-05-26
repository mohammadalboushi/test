// ================================================
// MALABOUSHI - Main JavaScript
// Premium Karaoke Social Platform
// ================================================

// ================================================
// Global State
// ================================================
const state = {
  currentUser: null,
  currentPage: 'home',
  currentRoom: null,
  currentChat: null,
  isRecording: false,
  mediaRecorder: null,
  audioChunks: [],
  onlineUsers: [],
  rooms: [],
  conversations: []
};

// ================================================
// DOM Elements
// ================================================
const elements = {
  // Pages
  loginPage: document.getElementById('login-page'),
  mainApp: document.getElementById('main-app'),
  loadingOverlay: document.getElementById('loading-overlay'),
  toastContainer: document.getElementById('toast-container'),

  // Auth
  googleLoginBtn: document.getElementById('google-login-btn'),
  logoutBtn: document.getElementById('logout-btn'),

  // Navigation
  navLinks: document.querySelectorAll('.nav-link'),
  bottomNavItems: document.querySelectorAll('.bottom-nav-item'),
  pageSections: document.querySelectorAll('.page-section'),

  // User
  navUserAvatar: document.getElementById('nav-user-avatar'),
  sidebarUserAvatar: document.getElementById('sidebar-user-avatar'),
  sidebarUserName: document.getElementById('sidebar-user-name'),
  sidebarUserStatus: document.getElementById('sidebar-user-status'),

  // Rooms
  liveRoomsGrid: document.getElementById('live-rooms-grid'),
  allRoomsGrid: document.getElementById('all-rooms-grid'),
  roomsPageGrid: document.getElementById('rooms-page-grid'),
  onlineUsersList: document.getElementById('online-users-list'),
  activeRoomsList: document.getElementById('active-rooms-list'),
  createRoomBtn: document.getElementById('create-room-btn'),
  createRoomBtn2: document.getElementById('create-room-btn-2'),

  // Modals
  createRoomModal: document.getElementById('create-room-modal'),
  roomDetailModal: document.getElementById('room-detail-modal'),
  closeCreateRoom: document.getElementById('close-create-room'),
  closeRoomDetail: document.getElementById('close-room-detail'),

  // Chat
  conversationsList: document.getElementById('conversations-list'),
  chatPlaceholder: document.getElementById('chat-placeholder'),
  chatActive: document.getElementById('chat-active'),

  // FAB
  fabBtn: document.getElementById('fab-btn')
};

// ================================================
// Initialization
// ================================================
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  initRealtimeListeners();
});

// ================================================
// Event Listeners
// ================================================
function initEventListeners() {
  // Auth events
  elements.googleLoginBtn?.addEventListener('click', signInWithGoogle);
  elements.logoutBtn?.addEventListener('click', signOutUser);

  // Navigation
  elements.navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(link.dataset.page);
    });
  });

  elements.bottomNavItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(item.dataset.page);
    });
  });

  // Create room
  elements.createRoomBtn?.addEventListener('click', () => openModal('create-room-modal'));
  elements.createRoomBtn2?.addEventListener('click', () => openModal('create-room-modal'));
  elements.closeCreateRoom?.addEventListener('click', () => closeModal('create-room-modal'));
  document.getElementById('confirm-create-room')?.addEventListener('click', createRoom);

  // Room detail
  elements.closeRoomDetail?.addEventListener('click', () => closeModal('room-detail-modal'));
  document.getElementById('join-room-btn')?.addEventListener('click', joinRoom);

  // FAB
  elements.fabBtn?.addEventListener('click', () => openModal('create-room-modal'));

  // Hero button
  document.getElementById('hero-join-btn')?.addEventListener('click', () => {
    navigateTo('rooms');
    openModal('create-room-modal');
  });

  // Search
  document.getElementById('room-search')?.addEventListener('input', (e) => {
    filterRooms(e.target.value);
  });

  // Filter tags
  document.querySelectorAll('[data-filter]').forEach(tag => {
    tag.addEventListener('click', () => {
      document.querySelectorAll('[data-filter]').forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
      filterRoomsByType(tag.dataset.filter);
    });
  });

  // Room type selection
  document.querySelectorAll('[data-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-type]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });

  // Window online/offline status
  window.addEventListener('online', () => updateUserStatus(true));
  window.addEventListener('offline', () => updateUserStatus(false));
}

// ================================================
// Realtime Listeners
// ================================================
function initRealtimeListeners() {
  // Set auth callbacks
  onUserLoggedIn = (user) => {
    state.currentUser = user;
    showMainApp(user);
    loadRealtimeData();
  };

  onUserLoggedOut = () => {
    state.currentUser = null;
    showLoginPage();
  };

  // Listen for online users
  db.ref('users').orderByChild('isOnline').equalTo(true).on('value', (snapshot) => {
    state.onlineUsers = [];
    snapshot.forEach(child => {
      const user = child.val();
      if (user.uid !== state.currentUser?.uid) {
        state.onlineUsers.push({ uid: child.key, ...user });
      }
    });
    renderOnlineUsers();
  });

  // Listen for rooms
  db.ref('rooms').orderByChild('isActive').equalTo(true).on('value', (snapshot) => {
    state.rooms = [];
    snapshot.forEach(child => {
      state.rooms.push({ id: child.key, ...child.val() });
    });
    renderRooms();
  });
}

// ================================================
// Realtime Data Loading
// ================================================
function loadRealtimeData() {
  // Load conversations
  loadConversations();

  // Load messages listener
  setupMessagesListener();
}

// ================================================
// Authentication Functions
// ================================================
function showLoginPage() {
  elements.loginPage?.classList.remove('hidden');
  elements.mainApp?.classList.add('hidden');
}

function showMainApp(user) {
  elements.loginPage?.classList.add('hidden');
  elements.mainApp?.classList.remove('hidden');

  // Update user info
  updateUserDisplay(user);

  // Show home page
  navigateTo('home');
}

function updateUserDisplay(user) {
  if (user?.photoURL) {
    elements.navUserAvatar.src = user.photoURL;
    elements.sidebarUserAvatar.src = user.photoURL;
    document.getElementById('profile-avatar-img')!.src = user.photoURL;
  }

  const displayName = user?.displayName || 'مستخدم';
  elements.sidebarUserName.textContent = displayName;
  document.getElementById('profile-name')!.textContent = displayName;
  document.getElementById('profile-bio')!.textContent = user?.email || '';
}

// ================================================
// Navigation
// ================================================
function navigateTo(page) {
  state.currentPage = page;

  // Update nav links
  elements.navLinks.forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });

  elements.bottomNavItems.forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Show/hide sections
  elements.pageSections.forEach(section => {
    const sectionId = section.id.replace('page-', '');
    section.classList.toggle('hidden', sectionId !== page);
  });

  // Load page data
  if (page === 'rooms') {
    renderRoomsGrid();
  }
}

// ================================================
// UI Functions
// ================================================
function showLoading(message = 'جاري التحميل...') {
  elements.loadingOverlay?.classList.remove('hidden');
}

function hideLoading() {
  elements.loadingOverlay?.classList.add('hidden');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${type === 'success' ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' : ''}
      ${type === 'error' ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>' : ''}
      ${type === 'info' ? '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>' : ''}
    </svg>
    <span>${message}</span>
  `;

  elements.toastContainer?.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function openModal(modalId) {
  document.getElementById(modalId)?.classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId)?.classList.remove('active');
}

// ================================================
// Room Functions
// ================================================
function renderRooms() {
  const liveRooms = state.rooms.filter(r => r.isLive);
  const allRooms = state.rooms;

  renderRoomsToGrid(liveRooms, elements.liveRoomsGrid);
  renderRoomsToGrid(allRooms, elements.allRoomsGrid);
  renderRoomsToGrid(allRooms, elements.roomsPageGrid);
  renderActiveRooms();
}

function renderRoomsToGrid(rooms, container) {
  if (!container) return;

  if (rooms.length === 0) {
    container.innerHTML = `
      <div class="text-center p-xl">
        <p class="text-muted">لا توجد غرف حالياً</p>
      </div>
    `;
    return;
  }

  container.innerHTML = rooms.map(room => createRoomCard(room)).join('');
}

function createRoomCard(room) {
  const participantCount = room.participants ? Object.keys(room.participants).length : 0;
  const participants = room.participants ? Object.values(room.participants).slice(0, 3) : [];

  return `
    <div class="room-card" data-room-id="${room.id}">
      <div class="room-card-header">
        <div class="room-card-icon">
          ${getRoomIcon(room.type)}
        </div>
        <div class="room-card-info">
          <h3 class="room-card-title">${room.name}</h3>
          <div class="room-card-meta">
            <span class="room-card-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
              </svg>
              ${participantCount}
            </span>
            ${room.isLive ? `
              <span class="room-live-badge">
                <span class="live-dot"></span>
                مباشر
              </span>
            ` : ''}
          </div>
        </div>
      </div>
      <p class="room-card-description">${room.description || 'غرفة نشطة الآن'}</p>
      <div class="room-card-footer">
        <div class="room-card-participants">
          ${participants.map(p => `
            <img src="${p.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(p.displayName)}" alt="" class="avatar avatar-sm">
          `).join('')}
          ${participantCount > 3 ? `<span class="badge badge-orange">+${participantCount - 3}</span>` : ''}
        </div>
        <button class="btn btn-primary btn-sm" onclick="openRoomDetail('${room.id}')">
          انضم
        </button>
      </div>
    </div>
  `;
}

function getRoomIcon(type) {
  switch(type) {
    case 'karaoke':
      return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
    case 'voice':
      return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>';
    case 'chat':
      return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    default:
      return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
  }
}

function renderActiveRooms() {
  if (!elements.activeRoomsList) return;

  const activeRooms = state.rooms.slice(0, 5);
  elements.activeRoomsList.innerHTML = activeRooms.map(room => `
    <div class="flex items-center gap-sm p-sm rounded-lg cursor-pointer hover:bg-[var(--secondary-bg)]" onclick="openRoomDetail('${room.id}')">
      <div class="w-8 h-8 rounded-md bg-[var(--gradient-primary)] flex items-center justify-center text-[var(--primary-bg)]">
        ${getRoomIcon(room.type)}
      </div>
      <div class="flex-1">
        <div class="text-sm font-semibold">${room.name}</div>
        <div class="text-xs text-muted">${room.participants ? Object.keys(room.participants).length : 0} مشترك</div>
      </div>
    </div>
  `).join('');
}

function renderOnlineUsers() {
  if (!elements.onlineUsersList) return;

  const users = state.onlineUsers.slice(0, 8);
  elements.onlineUsersList.innerHTML = users.map(user => `
    <div class="flex items-center gap-sm p-sm rounded-lg cursor-pointer hover:bg-[var(--secondary-bg)]">
      <div class="avatar-wrapper">
        <img src="${user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName)}" alt="" class="avatar avatar-sm">
        <div class="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-[var(--primary-bg)]"></div>
      </div>
      <div class="text-sm">${user.displayName}</div>
    </div>
  `).join('');
}

function renderRoomsGrid() {
  renderRoomsToGrid(state.rooms, elements.roomsPageGrid);
}

// ================================================
// Room Actions
// ================================================
async function createRoom() {
  const name = document.getElementById('room-name-input')?.value;
  const description = document.getElementById('room-description-input')?.value;
  const typeBtn = document.querySelector('[data-type].active');
  const isPrivate = document.getElementById('room-private-checkbox')?.checked;

  if (!name) {
    showToast('الرجاء إدخال اسم الغرفة', 'error');
    return;
  }

  const room = {
    name,
    description: description || '',
    type: typeBtn?.dataset.type || 'chat',
    isPrivate: isPrivate || false,
    isActive: true,
    isLive: true,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    createdBy: state.currentUser.uid,
    createdByName: state.currentUser.displayName,
    participants: {
      [state.currentUser.uid]: {
        displayName: state.currentUser.displayName,
        photoURL: state.currentUser.photoURL,
        role: 'admin',
        joinedAt: firebase.database.ServerValue.TIMESTAMP
      }
    }
  };

  try {
    const newRoomRef = db.ref('rooms').push();
    await newRoomRef.set(room);
    state.currentRoom = { id: newRoomRef.key, ...room };

    closeModal('create-room-modal');
    showToast('تم إنشاء الغرفة بنجاح!', 'success');
    openRoomDetail(newRoomRef.key);

    // Clear inputs
    document.getElementById('room-name-input').value = '';
    document.getElementById('room-description-input').value = '';
  } catch (error) {
    showToast('فشل إنشاء الغرفة', 'error');
    console.error(error);
  }
}

async function openRoomDetail(roomId) {
  const room = state.rooms.find(r => r.id === roomId);
  if (!room) return;

  state.currentRoom = room;

  // Update modal content
  document.getElementById('room-detail-title').textContent = room.name;
  document.getElementById('room-detail-description').textContent = room.description || '';

  const participants = room.participants || {};
  const participantCount = Object.keys(participants).length;
  document.getElementById('room-participant-count').textContent = participantCount;

  const participantsList = document.getElementById('room-participants-list');
  participantsList.innerHTML = Object.entries(participants).map(([uid, p]) => `
    <div class="participant-card">
      <div class="participant-avatar">
        <img src="${p.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(p.displayName)}" alt="">
      </div>
      <div class="participant-info">
        <div class="participant-name">${p.displayName}</div>
        <div class="participant-role">${p.role === 'admin' ? 'مدير الغرفة' : 'مشترك'}</div>
      </div>
    </div>
  `).join('');

  openModal('room-detail-modal');
}

async function joinRoom() {
  if (!state.currentRoom || !state.currentUser) return;

  const roomRef = db.ref('rooms/' + state.currentRoom.id + '/participants/' + state.currentUser.uid);

  await roomRef.set({
    displayName: state.currentUser.displayName,
    photoURL: state.currentUser.photoURL,
    role: 'member',
    joinedAt: firebase.database.ServerValue.TIMESTAMP
  });

  closeModal('room-detail-modal');
  showToast('تم الانضمام للغرفة!', 'success');

  // TODO: Navigate to live room view
}

// ================================================
// Chat Functions
// ================================================
async function loadConversations() {
  if (!state.currentUser) return;

  try {
    const conversationsRef = db.ref('conversations').orderByChild('participants/' + state.currentUser.uid).equalTo(true);
    conversationsRef.on('value', (snapshot) => {
      state.conversations = [];
      snapshot.forEach(child => {
        state.conversations.push({ id: child.key, ...child.val() });
      });
      renderConversations();
    });
  } catch (error) {
    console.error(error);
  }
}

function renderConversations() {
  if (!elements.conversationsList) return;

  if (state.conversations.length === 0) {
    elements.conversationsList.innerHTML = `
      <div class="text-center p-xl">
        <p class="text-muted">لا توجد محادثات</p>
        <button class="btn btn-secondary mt-md">بدء محادثة جديدة</button>
      </div>
    `;
    return;
  }

  elements.conversationsList.innerHTML = state.conversations.map(conv => {
    const otherUser = conv.participants ? Object.entries(conv.participants)
      .find(([uid]) => uid !== state.currentUser.uid) : null;

    return `
      <div class="conversation-item flex items-center gap-md p-md cursor-pointer hover:bg-[var(--secondary-bg)] transition" data-conv-id="${conv.id}">
        <div class="avatar-wrapper">
          <img src="${otherUser?.[1]?.photoURL || 'https://ui-avatars.com/api/?name=User'}" alt="" class="avatar">
          ${conv.isOnline ? '<div class="profile-status"></div>' : ''}
        </div>
        <div class="flex-1">
          <div class="font-semibold">${otherUser?.[1]?.displayName || 'مستخدم'}</div>
          <div class="text-sm text-muted truncate">${conv.lastMessage || 'لا توجد رسائل'}</div>
        </div>
        <div class="text-xs text-muted">
          ${conv.lastMessageTime ? formatTime(conv.lastMessageTime) : ''}
        </div>
      </div>
    `;
  });
}

function setupMessagesListener() {
  if (!state.currentChat) return;

  const messagesRef = db.ref('messages/' + state.currentChat.id);

  messagesRef.orderByChild('timestamp').limitToLast(50).on('child_added', (snapshot) => {
    const message = snapshot.val();
    appendMessage(message);
  });
}

function appendMessage(message) {
  const chatActive = document.getElementById('chat-active');
  if (!chatActive) return;

  chatActive.classList.remove('hidden');
  elements.chatPlaceholder?.classList.add('hidden');

  const messagesContainer = chatActive.querySelector('.chat-messages');
  if (!messagesContainer) return;

  const isOwn = message.senderId === state.currentUser?.uid;
  const messageEl = document.createElement('div');
  messageEl.className = `message ${isOwn ? 'message-sent' : 'message-received'}`;
  messageEl.innerHTML = `
    <div class="message-content">
      <div class="message-header">
        <span class="message-sender">${message.senderName}</span>
        <span class="message-time">${formatTime(message.timestamp)}</span>
      </div>
      <div class="message-text">${message.text}</div>
    </div>
  `;

  messagesContainer.appendChild(messageEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendMessage(text) {
  if (!state.currentChat || !text.trim() || !state.currentUser) return;

  const message = {
    text: text.trim(),
    senderId: state.currentUser.uid,
    senderName: state.currentUser.displayName,
    senderPhoto: state.currentUser.photoURL,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };

  await db.ref('messages/' + state.currentChat.id).push(message);

  // Update conversation
  await db.ref('conversations/' + state.currentChat.id).update({
    lastMessage: text.trim(),
    lastMessageTime: firebase.database.ServerValue.TIMESTAMP
  });
}

// ================================================
// Voice Recording
// ================================================
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.mediaRecorder = new MediaRecorder(stream);
    state.audioChunks = [];

    state.mediaRecorder.ondataavailable = (e) => {
      state.audioChunks.push(e.data);
    };

    state.mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(state.audioChunks, { type: 'audio/webm' });
      await uploadVoiceMessage(audioBlob);
      stream.getTracks().forEach(track => track.stop());
    };

    state.mediaRecorder.start();
    state.isRecording = true;
    showToast('جاري التسجيل...', 'info');

  } catch (error) {
    showToast('لا يمكن الوصول إلى الميكروفون', 'error');
    console.error(error);
  }
}

function stopRecording() {
  if (state.mediaRecorder && state.isRecording) {
    state.mediaRecorder.stop();
    state.isRecording = false;
    showToast('تم إيقاف التسجيل', 'info');
  }
}

async function uploadVoiceMessage(audioBlob) {
  if (!state.currentUser) return;

  try {
    const fileName = `voice_${Date.now()}.webm`;
    const storageRef = storage.ref('voiceMessages/' + state.currentUser.uid + '/' + fileName);
    const snapshot = await storageRef.put(audioBlob);
    const downloadURL = await snapshot.ref.getDownloadURL();

    // Send as message
    await sendMessage(`[رسالة صوتية] ${downloadURL}`);

  } catch (error) {
    showToast('فشل رفع الرسالة الصوتية', 'error');
    console.error(error);
  }
}

// ================================================
// Helper Functions
// ================================================
function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

function filterRooms(query) {
  const filtered = state.rooms.filter(room =>
    room.name.toLowerCase().includes(query.toLowerCase()) ||
    room.description?.toLowerCase().includes(query.toLowerCase())
  );
  renderRoomsToGrid(filtered, elements.roomsPageGrid);
}

function filterRoomsByType(type) {
  if (type === 'all') {
    renderRoomsToGrid(state.rooms, elements.roomsPageGrid);
    return;
  }

  const filtered = state.rooms.filter(room => room.type === type);
  renderRoomsToGrid(filtered, elements.roomsPageGrid);
}

// Make functions available globally
window.openRoomDetail = openRoomDetail;
window.joinRoom = joinRoom;
window.navigateTo = navigateTo;