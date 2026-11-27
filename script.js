/* ==========================================
   0. ZERO-FLASH THEME BOOTSTRAP
========================================== */
(function() {
  try {
    var pref = localStorage.getItem('theme_preference') || 'dark';
    var effective = pref;
    if (pref === 'system') {
      effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', effective);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = effective === 'dark' ? '#0b0d12' : '#f4f5f7';
  } catch (e) {}
})();

import {
  Client
} from "https://esm.sh/@gradio/client";

/* ==========================================
   1. THEME SYSTEM
========================================== */
let systemMediaQuery = null;

function applyTheme(pref) {
  const html = document.documentElement;
  const meta = document.querySelector('meta[name="theme-color"]');

  if (systemMediaQuery) {
    systemMediaQuery.removeEventListener('change', handleSystemThemeChange);
    systemMediaQuery = null;
  }

  if (pref === 'system') {
    systemMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const isDark = systemMediaQuery.matches;
    html.setAttribute('data-theme', isDark ? 'dark' : 'light');
    if (meta) meta.content = isDark ? '#0b0d12' : '#f4f5f7';
    systemMediaQuery.addEventListener('change', handleSystemThemeChange);
  } else {
    html.setAttribute('data-theme', pref);
    if (meta) meta.content = pref === 'dark' ? '#0b0d12' : '#f4f5f7';
  }
}

function handleSystemThemeChange(e) {
  const html = document.documentElement;
  const meta = document.querySelector('meta[name="theme-color"]');
  html.setAttribute('data-theme', e.matches ? 'dark' : 'light');
  if (meta) meta.content = e.matches ? '#0b0d12' : '#f4f5f7';
}

window.setTheme = function(pref) {
  localStorage.setItem('theme_preference', pref);
  applyTheme(pref);
  updateThemeUI(pref);
  updateThemeQuickIcon(pref);
};

window.cycleTheme = function() {
  const current = localStorage.getItem('theme_preference') || 'dark';
  const order = ['light', 'dark', 'system'];
  const next = order[(order.indexOf(current) + 1) % order.length];
  window.setTheme(next);
  const labels = {
    light: 'الوضع الفاتح',
    dark: 'الوضع الداكن',
    system: 'وضع النظام'
  };
  window.showToast('تم التبديل إلى ' + labels[next], 'success');
};

function updateThemeUI(pref) {
  document.querySelectorAll('.theme-option').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === pref);
  });
}

function updateThemeQuickIcon(pref) {
  const icons = {
    light: 'ri-sun-line',
    dark: 'ri-moon-line',
    system: 'ri-contrast-line'
  };
  const labels = {
    light: 'المظهر: فاتح',
    dark: 'المظهر: داكن',
    system: 'المظهر: النظام'
  };

  const mobileIcon = document.querySelector('#themeQuickBtn i');
  if (mobileIcon) mobileIcon.className = icons[pref];

  const sideIcon = document.querySelector('#sidebarThemeBtn i');
  if (sideIcon) sideIcon.className = icons[pref];

  const sideLabel = document.getElementById('sidebarThemeLabel');
  if (sideLabel) sideLabel.innerText = labels[pref];
}

const initThemePref = localStorage.getItem('theme_preference') || 'dark';
applyTheme(initThemePref);
updateThemeUI(initThemePref);
updateThemeQuickIcon(initThemePref);

/* ==========================================
   2. FIREBASE + AUTH + SESSION GUARD
========================================== */
const firebaseConfig = {
  apiKey: "AIzaSyBB_U4C880PW4GxZd8FALv8yBSiP2mNeBY",
  authDomain: "malaboushi.firebaseapp.com",
  databaseURL: "https://malaboushi-default-rtdb.firebaseio.com/",
  projectId: "malaboushi",
  storageBucket: "malaboushi.firebasestorage.app",
  messagingSenderId: "110336819350",
  appId: "1:110336819350:web:2b1b0488e72b811f0602b7"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

let isProcessingActive = false;
let sessionRef = null;

window.addEventListener('beforeunload', function(e) {
  if (isProcessingActive) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// Legacy IndexedDB handle (used only for full cleanup on clearHistory)
const dbPromise = new Promise((resolve, reject) => {
  const request = indexedDB.open("VoiceStudioDB", 1);
  request.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains("audioFiles")) {
      db.createObjectStore("audioFiles", { keyPath: "id" });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

// Lock state check
if (localStorage.getItem('site_unlocked') !== 'true') {
  document.body.classList.add('locked');
} else {
  const lockScreen = document.getElementById('telegramLockScreen');
  if (lockScreen) lockScreen.style.display = 'none';
}

function detachSessionMonitor() {
  if (sessionRef) {
    sessionRef.off();
    sessionRef = null;
  }
}

function updateAccountDisplay(user) {
  const email = user && user.email ? user.email : '—';
  const accountEl = document.getElementById('accountEmailDisplay');
  const sideEmailEl = document.getElementById('sidebarUserEmail');
  if (accountEl) accountEl.innerText = email;
  if (sideEmailEl) sideEmailEl.innerText = user && user.email ? user.email : 'حساب نشط';
}

function resetLoginButton() {
  const loginBtn = document.getElementById('loginSubmitBtn');
  if (loginBtn) {
    loginBtn.disabled = false;
    loginBtn.innerHTML = '<i class="ri-shield-keyhole-line"></i><span>دخول آمن</span>';
  }
}

function stopAllPlayback() {
  ['vocalAudio', 'instAudio'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (el.fadeInterval) clearInterval(el.fadeInterval);
      el.pause();
      el.volume = 1;
    }
  });
}

function monitorSession(uid) {
  detachSessionMonitor();
  sessionRef = firebase.database().ref('users/' + uid + '/currentSession');
  sessionRef.on('value', (snapshot) => {
    const dbSession = snapshot.val();
    const mySession = localStorage.getItem("my_active_session");

    if (dbSession && dbSession !== mySession) {
      detachSessionMonitor();
      executeForceLogout('تم تسجيل الدخول إلى حسابك من جهاز آخر، لذلك تم إنهاء جلستك الحالية.');
    }
  });
}

function executeForceLogout(customAlertMessage = null) {
  detachSessionMonitor();
  stopAllPlayback();
  auth.signOut().catch(() => {});
  localStorage.removeItem('site_unlocked');
  localStorage.removeItem('my_active_session');
  resetLoginButton();
  updateAccountDisplay(null);

  const playerModal = document.getElementById('playerModal');
  if (playerModal) playerModal.classList.remove('open');

  document.body.classList.add('locked');
  const lockScreen = document.getElementById('telegramLockScreen');
  if (lockScreen) {
    lockScreen.style.display = 'flex';
    lockScreen.style.opacity = '1';
  }

  if (customAlertMessage) {
    showAlertModal('تم إنهاء الجلسة', customAlertMessage);
  } else {
    showToast('تم تسجيل الخروج بنجاح', 'success');
  }
}

auth.onAuthStateChanged(async (user) => {
  if (user) {
    updateAccountDisplay(user);

    if (localStorage.getItem('site_unlocked') === 'true') {
      monitorSession(user.uid);
    }

    try {
      await user.reload();
    } catch (error) {
      if (error.code === 'auth/user-disabled' || error.code === 'auth/user-not-found') {
        executeForceLogout('تم إيقاف هذا الحساب من قبل الإدارة.');
      } else {
        console.warn('تم تجاهل خطأ مؤقت للحفاظ على الجلسة:', error.code);
      }
    }
  } else if (localStorage.getItem('site_unlocked') === 'true') {
    setTimeout(() => {
      if (!auth.currentUser && localStorage.getItem('site_unlocked') === 'true') {
        executeForceLogout('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً.');
      }
    }, 5000);
  }
});

window.authWithFirebase = async function() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  if (!email || !password) {
    return showToast('يرجى إدخال البريد وكلمة المرور', 'warning');
  }

  const loginBtn = document.getElementById('loginSubmitBtn');
  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="ri-loader-4-line spin"></i><span>جاري التحقق...</span>';
  }

  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;

    localStorage.setItem('site_unlocked', 'true');
    const sessionId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    localStorage.setItem('my_active_session', sessionId);
    await firebase.database().ref('users/' + user.uid).update({ currentSession: sessionId });

    updateAccountDisplay(user);
    monitorSession(user.uid);

    document.body.classList.remove('locked');
    const lockScreen = document.getElementById('telegramLockScreen');
    if (lockScreen) {
      lockScreen.style.opacity = '0';
      setTimeout(() => {
        lockScreen.style.display = 'none';
        resetLoginButton();
      }, 350);
    }
    showToast('تم تسجيل الدخول بنجاح، أهلاً بك', 'success');
  } catch (error) {
    resetLoginButton();
    let msg = 'حدث خطأ: ' + (error.code || error.message);
    if (['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/user-not-found'].includes(error.code)) {
      msg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    } else if (error.code === 'auth/user-disabled') {
      msg = 'تم إيقاف هذا الحساب من قبل الإدارة.';
    } else if (error.code === 'auth/invalid-email') {
      msg = 'صيغة البريد الإلكتروني غير صحيحة.';
    } else if (error.code === 'auth/too-many-requests') {
      msg = 'محاولات كثيرة، انتظر قليلاً ثم أعد المحاولة.';
    } else if (error.code === 'auth/network-request-failed') {
      msg = 'تأكد من اتصالك بالإنترنت.';
    }
    showToast(msg, 'error');
  }
};

window.requestLogout = function() {
  openConfirmDialog({
    title: 'تسجيل الخروج',
    message: 'هل تريد تسجيل الخروج من حسابك على هذا الجهاز؟',
    confirmText: 'تسجيل الخروج',
    iconClass: 'ri-logout-box-r-line',
    onConfirm: () => {
      executeForceLogout(null);
    }
  });
};

/* ==========================================
   3. STATE & PREFERENCES
========================================== */
let currentFile = null;
let currentOutputFormat = localStorage.getItem('pref_out_format') || 'mp3';
let activeAudio = null;
let activeType = null;
let progressInterval = null;
let pendingConfirmAction = null;

function restoreProcessingPrefs() {
  const savedModel = localStorage.getItem('pref_model') || 'karaoke';
  const savedFormat = localStorage.getItem('pref_out_format') || 'mp3';
  const savedOverlap = localStorage.getItem('pref_overlap') || '2';

  const modelEl = document.querySelector(`input[name="model_choice"][value="${savedModel}"]`);
  const formatEl = document.querySelector(`input[name="out_format"][value="${savedFormat}"]`);
  const overlapEl = document.querySelector(`input[name="overlap_mode"][value="${savedOverlap}"]`);

  if (modelEl) modelEl.checked = true;
  if (formatEl) formatEl.checked = true;
  if (overlapEl) overlapEl.checked = true;

  document.querySelectorAll('input[name="model_choice"]').forEach(el => {
    el.addEventListener('change', () => localStorage.setItem('pref_model', el.value));
  });
  document.querySelectorAll('input[name="out_format"]').forEach(el => {
    el.addEventListener('change', () => localStorage.setItem('pref_out_format', el.value));
  });
  document.querySelectorAll('input[name="overlap_mode"]').forEach(el => {
    el.addEventListener('change', () => localStorage.setItem('pref_overlap', el.value));
  });
}

/* ==========================================
   4. TOASTS, DIALOGS & NAVIGATION
========================================== */
window.showToast = function(message, type = 'success') {
  const icons = {
    success: 'ri-checkbox-circle-line',
    error: 'ri-close-circle-line',
    warning: 'ri-error-warning-line'
  };
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="${icons[type] || icons.success}"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3600);
};

function openConfirmDialog({ title, message, confirmText, iconClass, onConfirm }) {
  document.getElementById('confirmTitle').innerText = title;
  document.getElementById('confirmMessage').innerText = message;
  document.getElementById('confirmActionBtn').innerText = confirmText || 'تأكيد';
  const iconEl = document.querySelector('#confirmIcon i');
  if (iconEl && iconClass) iconEl.className = iconClass;

  pendingConfirmAction = onConfirm;
  document.getElementById('confirmModal').classList.add('open');
  history.pushState({ confirmOpen: true }, '', '#confirm');
}

document.getElementById('confirmActionBtn').addEventListener('click', () => {
  const action = pendingConfirmAction;
  pendingConfirmAction = null;
  window.closeConfirmModal();
  if (typeof action === 'function') action();
});

window.closeConfirmModal = function() {
  if (window.location.hash === '#confirm') {
    history.back();
  } else {
    document.getElementById('confirmModal').classList.remove('open');
  }
};

function showAlertModal(title, message) {
  document.getElementById('alertTitle').innerText = title;
  document.getElementById('alertMessage').innerText = message;
  document.getElementById('alertModal').classList.add('open');
}

window.closeAlertModal = function() {
  document.getElementById('alertModal').classList.remove('open');
};

window.navigateTo = function(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(page);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item, .side-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  window.scrollTo({ top: 0, behavior: 'instant' });
};

window.showPage = window.navigateTo;

/* ==========================================
   5. FILE UPLOAD & WAVEFORM
========================================== */
window.handleDragOver = function(e) {
  e.preventDefault();
  document.getElementById('uploadArea').classList.add('dragover');
};

window.handleDragLeave = function() {
  document.getElementById('uploadArea').classList.remove('dragover');
};

window.handleDrop = function(e) {
  e.preventDefault();
  document.getElementById('uploadArea').classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) {
    currentFile = e.dataTransfer.files[0];
    showFileInfo();
  }
};

window.handleFileSelect = function(e) {
  if (e.target.files.length > 0) {
    currentFile = e.target.files[0];
    showFileInfo();
  }
};

async function drawWaveform(file) {
  const canvas = document.getElementById('waveformCanvas');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.offsetWidth || 300;
  const h = canvas.offsetHeight || 76;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const styles = getComputedStyle(document.documentElement);
  const primaryColor = styles.getPropertyValue('--primary').trim();
  const instColor = styles.getPropertyValue('--inst').trim();
  const textColor = styles.getPropertyValue('--text-secondary').trim();

  ctx.fillStyle = textColor;
  ctx.font = '700 12px Tajawal, sans-serif';
  ctx.fillText('جاري تحليل موجة الصوت...', 14, h / 2 + 4);

  let actx = null;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    actx = new AudioCtx();
    const audioBuffer = await actx.decodeAudioData(arrayBuffer);
    const rawData = audioBuffer.getChannelData(0);

    const samples = 96;
    const blockSize = Math.max(1, Math.floor(rawData.length / samples));
    const filteredData = [];
    for (let i = 0; i < samples; i++) {
      const blockStart = blockSize * i;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[blockStart + j] || 0);
      }
      filteredData.push(sum / blockSize);
    }

    const peak = Math.max(...filteredData) || 1;
    const normalizedData = filteredData.map(n => n / peak);

    ctx.clearRect(0, 0, w, h);
    const barGap = 2;
    const barWidth = Math.max(1.5, (w - barGap * samples) / samples);

    normalizedData.forEach((val, i) => {
      const barHeight = Math.max(val * (h - 16), 4);
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, primaryColor);
      gradient.addColorStop(1, instColor);
      ctx.fillStyle = gradient;

      const x = i * (barWidth + barGap);
      const y = (h - barHeight) / 2;
      const r = Math.min(2.5, barWidth / 2);

      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + barWidth - r, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + r);
      ctx.lineTo(x + barWidth, y + barHeight - r);
      ctx.quadraticCurveTo(x + barWidth, y + barHeight, x + barWidth - r, y + barHeight);
      ctx.lineTo(x + r, y + barHeight);
      ctx.quadraticCurveTo(x, y + barHeight, x, y + barHeight - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.fill();
    });
  } catch (e) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = textColor;
    ctx.fillText('الملف جاهز للمعالجة', 14, h / 2 + 4);
  } finally {
    if (actx && typeof actx.close === 'function') {
      actx.close().catch(() => {});
    }
  }
}

function showFileInfo() {
  if (!currentFile) return;

  document.getElementById('fileName').innerText = currentFile.name;
  document.getElementById('fileSize').innerText = (currentFile.size / 1048576).toFixed(1) + ' MB';
  document.getElementById('fileDuration').innerText = '—';
  document.getElementById('fileInfo').classList.add('show');
  document.getElementById('waveformSection').classList.add('show');
  document.getElementById('changeFileBtn').classList.remove('hidden');

  const tempUrl = URL.createObjectURL(currentFile);
  const tempAudio = new Audio();
  tempAudio.preload = 'metadata';
  tempAudio.src = tempUrl;

  const cleanup = () => {
    URL.revokeObjectURL(tempUrl);
    tempAudio.src = '';
  };

  tempAudio.onloadedmetadata = () => {
    const minutes = Math.floor(tempAudio.duration / 60);
    const seconds = Math.floor(tempAudio.duration % 60);
    document.getElementById('fileDuration').innerText =
      `${minutes}:${seconds.toString().padStart(2, '0')}`;
    cleanup();
  };
  tempAudio.onerror = cleanup;

  drawWaveform(currentFile);
}

/* ==========================================
   6. PLAYER MODAL + A/B SWITCH + MEDIA SESSION
========================================== */
function hasValidSrc(el) {
  return Boolean(el && el.src && el.src !== window.location.href && !el.src.endsWith('#player'));
}

function updateSwitchBarUI() {
  const vocalAudio = document.getElementById('vocalAudio');
  const instAudio = document.getElementById('instAudio');
  const bar = document.getElementById('playerSwitchBar');
  const vocalBtn = document.getElementById('switchVocalBtn');
  const instBtn = document.getElementById('switchInstBtn');

  const bothReady = hasValidSrc(vocalAudio) && hasValidSrc(instAudio);
  if (bar) bar.classList.toggle('hidden', !bothReady);

  if (vocalBtn) vocalBtn.className = 'ab-btn' + (activeType === 'vocal' ? ' active-vocal' : '');
  if (instBtn) instBtn.className = 'ab-btn' + (activeType === 'inst' ? ' active-inst' : '');
}

function applyPlayerTrackUI(type) {
  const isVocal = type === 'vocal';
  document.getElementById('playerTitle').innerText = isVocal ? 'صوت المطرب' : 'الموسيقى الخلفية';
  document.getElementById('trackName').innerText = isVocal ? 'المسار الصوتي (Vocals)' : 'المسار الموسيقي (Instrumental)';
  document.getElementById('trackFileName').innerText = currentFile ? currentFile.name : 'Audio Track';

  const artwork = document.getElementById('playerArtwork');
  const icon = document.getElementById('playerArtworkIcon');
  artwork.classList.remove('vocal-theme', 'inst-theme');
  artwork.classList.add(isVocal ? 'vocal-theme' : 'inst-theme');
  icon.className = isVocal ? 'ri-mic-2-line' : 'ri-music-2-line';

  updateSwitchBarUI();
  updateMediaSession();
}

function updateMediaSession() {
  if (!('mediaSession' in navigator) || !activeAudio) return;

  const isVocal = activeType === 'vocal';
  const baseName = currentFile ? currentFile.name : 'Voice Studio Pro';
  const trackLabel = isVocal ? 'صوت المطرب' : 'الموسيقى الخلفية';

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${baseName}`,
      artist: trackLabel,
      album: 'Voice Studio Pro',
      artwork: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
      ]
    });

    navigator.mediaSession.playbackState = activeAudio.paused ? 'paused' : 'playing';

    navigator.mediaSession.setActionHandler('play', () => {
      if (activeAudio && activeAudio.paused) window.toggleModalPlay();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      if (activeAudio && !activeAudio.paused) window.toggleModalPlay();
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      window.seekRelative(-(details && details.seekOffset ? details.seekOffset : 10));
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      window.seekRelative(details && details.seekOffset ? details.seekOffset : 10);
    });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (activeAudio && details && typeof details.seekTime === 'number' && isFinite(activeAudio.duration)) {
        activeAudio.currentTime = Math.max(0, Math.min(details.seekTime, activeAudio.duration));
        updateMediaPositionState();
      }
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      const next = activeType === 'vocal' ? 'inst' : 'vocal';
      window.switchPlayerTrack(next);
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      const prev = activeType === 'vocal' ? 'inst' : 'vocal';
      window.switchPlayerTrack(prev);
    });
  } catch (e) {}
}

function updateMediaPositionState() {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState || !activeAudio) return;
  if (isFinite(activeAudio.duration) && activeAudio.duration > 0) {
    try {
      navigator.mediaSession.setPositionState({
        duration: activeAudio.duration,
        playbackRate: activeAudio.playbackRate || 1,
        position: Math.min(activeAudio.currentTime || 0, activeAudio.duration)
      });
    } catch (e) {}
  }
}

window.openPlayer = function(type) {
  const audioId = type === 'vocal' ? 'vocalAudio' : 'instAudio';
  const targetAudio = document.getElementById(audioId);

  if (!hasValidSrc(targetAudio)) {
    showToast('الصوت غير متوفر أو لم يتم معالجته بعد', 'warning');
    return;
  }

  // Pause the other track cleanly if switching via cards
  const otherAudio = document.getElementById(type === 'vocal' ? 'instAudio' : 'vocalAudio');
  if (otherAudio && !otherAudio.paused) {
    if (otherAudio.fadeInterval) clearInterval(otherAudio.fadeInterval);
    otherAudio.pause();
    otherAudio.volume = 1;
  }

  activeType = type;
  activeAudio = targetAudio;
  applyPlayerTrackUI(type);

  const dur = isFinite(activeAudio.duration) && activeAudio.duration > 0 ? activeAudio.duration : 0;
  document.getElementById('modalSeek').value = dur ? (activeAudio.currentTime / dur) * 100 : 0;
  document.getElementById('modalCurrentTime').innerText = window.formatTime(activeAudio.currentTime || 0);
  document.getElementById('modalTotalTime').innerText = window.formatTime(dur);

  syncPlayPauseIcon();

  document.getElementById('playerModal').classList.add('open');
  if (window.location.hash !== '#player') {
    history.pushState({ modalOpen: true }, '', '#player');
  }

  if (progressInterval) clearInterval(progressInterval);
  progressInterval = setInterval(updateModalProgress, 120);
};

window.switchPlayerTrack = function(targetType) {
  if (!targetType || targetType === activeType) return;

  const targetId = targetType === 'vocal' ? 'vocalAudio' : 'instAudio';
  const targetAudio = document.getElementById(targetId);
  if (!hasValidSrc(targetAudio)) return;

  const prevAudio = activeAudio;
  const wasPlaying = prevAudio ? !prevAudio.paused : false;
  const syncTime = prevAudio ? (prevAudio.currentTime || 0) : 0;

  if (prevAudio) {
    if (prevAudio.fadeInterval) clearInterval(prevAudio.fadeInterval);
    prevAudio.pause();
    prevAudio.volume = 1;
  }

  activeType = targetType;
  activeAudio = targetAudio;
  applyPlayerTrackUI(targetType);

  const applySyncAndPlay = () => {
    const dur = isFinite(targetAudio.duration) ? targetAudio.duration : 0;
    if (dur > 0) {
      targetAudio.currentTime = Math.min(syncTime, Math.max(0, dur - 0.1));
    }
    if (wasPlaying) {
      targetAudio.volume = 1;
      targetAudio.play().catch(() => {});
    }
    syncPlayPauseIcon();
    updateMediaPositionState();
  };

  if (targetAudio.readyState >= 1) {
    applySyncAndPlay();
  } else {
    targetAudio.addEventListener('loadedmetadata', applySyncAndPlay, { once: true });
    targetAudio.load();
  }
};

window.closePlayer = function() {
  if (window.location.hash === '#player') {
    history.back();
  } else {
    document.getElementById('playerModal').classList.remove('open');
    if (progressInterval) clearInterval(progressInterval);
  }
};

window.addEventListener('popstate', function() {
  const playerModal = document.getElementById('playerModal');
  if (playerModal && playerModal.classList.contains('open')) {
    playerModal.classList.remove('open');
    if (progressInterval) clearInterval(progressInterval);
  }
  const confirmModal = document.getElementById('confirmModal');
  if (confirmModal && confirmModal.classList.contains('open')) {
    confirmModal.classList.remove('open');
  }
});

// Keyboard shortcuts on Desktop when player is open
window.addEventListener('keydown', function(e) {
  const playerModal = document.getElementById('playerModal');
  if (!playerModal || !playerModal.classList.contains('open')) return;
  if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName) && e.target.type !== 'range') return;

  if (e.code === 'Space') {
    e.preventDefault();
    window.toggleModalPlay();
  } else if (e.code === 'ArrowRight') {
    e.preventDefault();
    window.seekRelative(10);
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault();
    window.seekRelative(-10);
  } else if (e.code === 'Escape') {
    window.closePlayer();
  }
});

window.toggleModalPlay = function() {
  if (!activeAudio) return;

  const otherAudioId = activeAudio.id === 'vocalAudio' ? 'instAudio' : 'vocalAudio';
  const otherAudio = document.getElementById(otherAudioId);

  if (activeAudio.paused) {
    if (otherAudio && !otherAudio.paused) {
      if (otherAudio.fadeInterval) clearInterval(otherAudio.fadeInterval);
      otherAudio.pause();
      otherAudio.volume = 1;
    }

    if (activeAudio.fadeInterval) clearInterval(activeAudio.fadeInterval);
    activeAudio.volume = 0.2;
    activeAudio.play().then(() => {
      let vol = 0.2;
      activeAudio.fadeInterval = setInterval(() => {
        vol += 0.15;
        if (vol < 0.98) activeAudio.volume = vol;
        else {
          clearInterval(activeAudio.fadeInterval);
          activeAudio.volume = 1;
        }
      }, 30);
      syncPlayPauseIcon();
      updateMediaSession();
      updateMediaPositionState();
    }).catch(() => {
      activeAudio.volume = 1;
      syncPlayPauseIcon();
    });
  } else {
    if (activeAudio.fadeInterval) clearInterval(activeAudio.fadeInterval);
    activeAudio.pause();
    activeAudio.volume = 1;
    syncPlayPauseIcon();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
  }
};

function syncPlayPauseIcon() {
  if (!activeAudio) return;
  const icon = document.querySelector('#modalPlayBtn i');
  const artwork = document.getElementById('playerArtwork');
  if (activeAudio.paused) {
    if (icon) icon.className = 'ri-play-fill';
    if (artwork) artwork.classList.remove('playing');
  } else {
    if (icon) icon.className = 'ri-pause-fill';
    if (artwork) artwork.classList.add('playing');
  }
}

window.seekModalAudio = function(val) {
  if (activeAudio && isFinite(activeAudio.duration) && activeAudio.duration > 0) {
    activeAudio.currentTime = (val / 100) * activeAudio.duration;
    document.getElementById('modalCurrentTime').innerText = window.formatTime(activeAudio.currentTime);
    updateMediaPositionState();
  }
};

window.seekRelative = function(seconds) {
  if (activeAudio && isFinite(activeAudio.duration) && activeAudio.duration > 0) {
    let newTime = activeAudio.currentTime + seconds;
    if (newTime < 0) newTime = 0;
    if (newTime > activeAudio.duration) newTime = activeAudio.duration;
    activeAudio.currentTime = newTime;
    updateMediaPositionState();
  }
};

function updateModalProgress() {
  if (activeAudio && isFinite(activeAudio.duration) && activeAudio.duration > 0) {
    document.getElementById('modalSeek').value = (activeAudio.currentTime / activeAudio.duration) * 100;
    document.getElementById('modalCurrentTime').innerText = window.formatTime(activeAudio.currentTime);
    document.getElementById('modalTotalTime').innerText = window.formatTime(activeAudio.duration);
    if (activeAudio.ended) {
      syncPlayPauseIcon();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    }
  }
}

function buildDownloadName(type) {
  const rawName = (currentFile && currentFile.name) ? currentFile.name : 'VoiceStudio';
  const baseName = rawName
    .replace(/\.[^/.]+$/, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim() || 'VoiceStudio';
  const suffix = type === 'vocal' ? 'Vocals' : 'Instrumental';
  const ext = (currentOutputFormat || 'mp3').toLowerCase();
  return `${baseName} - ${suffix}.${ext}`;
}

window.downloadCurrentAudio = function() {
  if (!activeType) return;
  const audioId = activeType === 'vocal' ? 'vocalAudio' : 'instAudio';
  const fileName = buildDownloadName(activeType);
  window.downloadAudio(audioId, fileName);
};

window.formatTime = function(sec) {
  if (!sec || isNaN(sec) || !isFinite(sec)) return '0:00';
  return Math.floor(sec / 60) + ':' + Math.floor(sec % 60).toString().padStart(2, '0');
};

function formatElapsedTimer(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

window.downloadAudio = async function(id, name) {
  const url = document.getElementById(id).src;
  if (!url || url === window.location.href) return showToast('لا يوجد ملف متاح', 'error');

  const btn = document.getElementById('modalDownloadBtn');
  if (btn && btn.disabled) return;

  const originalIcon = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span style="font-family:JetBrains Mono,monospace;font-size:0.7rem;font-weight:700;">0%</span>';
  }

  showToast('جاري تنزيل الملف داخل الصفحة...', 'warning');

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      mode: 'cors'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    let blob;
    if (res.body && res.body.getReader) {
      const contentLength = Number(res.headers.get('content-length')) || 0;
      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;

        if (btn) {
          if (contentLength > 0) {
            const percent = Math.min(99, Math.round((received / contentLength) * 100));
            btn.innerHTML = `<span style="font-family:JetBrains Mono,monospace;font-size:0.7rem;font-weight:700;">${percent}%</span>`;
          } else {
            const mb = (received / 1048576).toFixed(1);
            btn.innerHTML = `<span style="font-family:JetBrains Mono,monospace;font-size:0.62rem;font-weight:700;">${mb}M</span>`;
          }
        }
      }

      const contentType = res.headers.get('content-type') || 'audio/mpeg';
      blob = new Blob(chunks, { type: contentType });
    } else {
      blob = await res.blob();
    }

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    showToast('تم تجهيز الملف وحفظه بنجاح', 'success');
  } catch (e) {
    console.error('Download error:', e);
    showToast('تعذّر التنزيل: ' + (e.message || 'خطأ بالاتصال'), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalIcon;
    }
  }
};

/* ==========================================
   7. PROCESSING (REAL UPLOAD + LIVE PROGRESS)
========================================== */
function setProgressPercent(percent) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const percentEl = document.getElementById('progressPercent');
  const fillEl = document.getElementById('progressFill');
  if (percentEl) percentEl.innerText = clamped + '%';
  if (fillEl) {
    fillEl.classList.remove('indeterminate');
    fillEl.style.width = clamped + '%';
  }
}

function setStage(stageIndex, statusText) {
  const statusEl = document.getElementById('progressStatus');
  if (statusEl && statusText) statusEl.innerText = statusText;

  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById('step' + i);
    if (!el) continue;
    el.classList.remove('active', 'done');
    if (i < stageIndex) el.classList.add('done');
    else if (i === stageIndex) el.classList.add(stageIndex === 4 ? 'done' : 'active');
  }
}

function uploadFileWithProgress(file, apiBase, token, onUploadPercent) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${apiBase}/upload`, true);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        const pct = Math.min(100, Math.round((e.loaded / e.total) * 100));
        if (typeof onUploadPercent === 'function') onUploadPercent(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const paths = JSON.parse(xhr.responseText);
          if (Array.isArray(paths) && paths.length > 0 && typeof paths[0] === 'string') {
            resolve({
              path: paths[0],
              url: `${apiBase}/file=${paths[0]}`,
              orig_name: file.name,
              size: file.size,
              mime_type: file.type || 'audio/mpeg',
              meta: { _type: 'gradio.FileData' }
            });
            return;
          }
        } catch (e) {}
      }
      reject(new Error('Upload fallback'));
    };

    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.onabort = () => reject(new Error('Upload aborted'));

    const formData = new FormData();
    formData.append('files', file, file.name);
    xhr.send(formData);
  });
}

window.startProcessing = async function() {
  if (!currentFile || !(currentFile instanceof File)) {
    return showToast('اختر ملفاً صوتياً من جهازك أولاً', 'warning');
  }

  isProcessingActive = true;

  const isTokenActive = localStorage.getItem('hf_token_active') !== 'false';
  const rawToken = localStorage.getItem('hf_token');
  const savedToken = (isTokenActive && rawToken) ? rawToken : null;

  const selectedModel = document.querySelector('input[name="model_choice"]:checked')?.value || 'karaoke';
  const selectedFormat = document.querySelector('input[name="out_format"]:checked')?.value || 'mp3';
  const selectedOverlap = Number(document.querySelector('input[name="overlap_mode"]:checked')?.value || 2);

  currentOutputFormat = selectedFormat;

  const processBtn = document.getElementById('processBtn');
  processBtn.disabled = true;
  processBtn.innerHTML = '<i class="ri-loader-4-line spin"></i><span>جاري المعالجة...</span>';

  if (savedToken) {
    showToast('بدأت المعالجة باستخدام التوكن النشط', 'success');
  } else {
    showToast('بدأت المعالجة على السيرفر السريع', 'success');
  }

  document.getElementById('progressSection').classList.add('show');
  document.getElementById('resultsSection').classList.remove('show');

  let elapsedSeconds = 0;
  let currentPct = 0;
  let aiTickInterval = null;

  const timerEl = document.getElementById('progressTimer');
  if (timerEl) timerEl.innerText = '00:00';

  const elapsedInterval = setInterval(() => {
    elapsedSeconds += 1;
    if (timerEl) timerEl.innerText = formatElapsedTimer(elapsedSeconds);
  }, 1000);

  const updatePct = (val) => {
    const next = Math.max(currentPct, Math.min(100, Math.round(val)));
    currentPct = next;
    setProgressPercent(currentPct);
  };

  setStage(1, 'جاري الاتصال بالسيرفر...');
  setProgressPercent(2);
  currentPct = 2;

  try {
    const isKaraoke = selectedModel === 'karaoke';
    const apiEndpoint = isKaraoke ? '/roformer_separator' : '/mdxc_separator';

    const connectOptions = savedToken ? {
      token: savedToken,
      hf_token: savedToken
    } : {};

    const client = await Client.connect('TheStinger/UVR5_UI', connectOptions);
    updatePct(5);

    const root = (client.config && client.config.root ? client.config.root : 'https://thestinger-uvr5-ui.hf.space').replace(/\/$/, '');
    const rawPrefix = (client.config && client.config.api_prefix) ? client.config.api_prefix : '';
    const prefix = rawPrefix ? (rawPrefix.startsWith('/') ? rawPrefix : '/' + rawPrefix) : '';
    const apiBase = root + prefix;

    // المرحلة 2: رفع فعلي مع تتبع النسبة الحقيقية للرفع
    setStage(2, 'جاري رفع الملف إلى السيرفر (0%)...');
    let audioPayload = currentFile;
    let uploadCompletedExplicitly = false;

    try {
      audioPayload = await uploadFileWithProgress(currentFile, apiBase, savedToken, (uploadPct) => {
        const overallPct = 5 + Math.round(uploadPct * 0.30);
        updatePct(overallPct);
        const statusEl = document.getElementById('progressStatus');
        if (statusEl) statusEl.innerText = `جاري رفع الملف إلى السيرفر (${uploadPct}%)...`;
      });
      uploadCompletedExplicitly = true;
      updatePct(35);
      setStage(3, 'اكتمل الرفع — جاري العزل بالذكاء الاصطناعي...');
    } catch (uploadErr) {
      // في حال تعذّر الرفع المباشر، نمرر الملف ليرفعه العميل تلقائياً
      audioPayload = currentFile;
      setStage(2, 'جاري رفع الملف إلى المحرك...');
    }

    const predictParams = isKaraoke
      ? {
          audio: audioPayload,
          model_key: 'MelBand Roformer | Karaoke by Gabox',
          out_format: selectedFormat,
          segment_size: 256,
          override_seg_size: false,
          overlap: selectedOverlap,
          batch_size: 1,
          norm_thresh: 0.9,
          amp_thresh: 1.0,
          single_stem: ''
        }
      : {
          audio: audioPayload,
          model: 'MDX23C-8KFFT-InstVoc_HQ_2.ckpt',
          out_format: selectedFormat,
          segment_size: 256,
          override_seg_size: false,
          overlap: selectedOverlap,
          batch_size: 1,
          norm_thresh: 0.9,
          amp_thresh: 1.0,
          single_stem: ''
        };

    let result = null;
    let hasServerProgress = false;
    let aiStarted = uploadCompletedExplicitly;
    let aiStartSec = elapsedSeconds;

    const startAiFallbackTicker = () => {
      if (aiTickInterval) return;
      aiTickInterval = setInterval(() => {
        if (aiStarted && !hasServerProgress && currentPct < 94) {
          const step = currentPct < 70 ? 2 : 1;
          updatePct(Math.min(94, currentPct + step));
        }
      }, 1400);
    };

    if (uploadCompletedExplicitly) {
      startAiFallbackTicker();
    }

    if (typeof client.submit === 'function') {
      const job = client.submit(apiEndpoint, predictParams);

      for await (const msg of job) {
        if (msg.type === 'status') {
          if (msg.stage === 'error') {
            throw new Error(msg.message || 'خطأ أثناء المعالجة على السيرفر');
          }

          // فور استلام أي حالة من السيرفر يعني الرفع اكتمل فعلياً
          if (!aiStarted) {
            aiStarted = true;
            aiStartSec = elapsedSeconds;
            updatePct(35);
            setStage(3, 'اكتمل الرفع — جاري العزل بالذكاء الاصطناعي...');
            startAiFallbackTicker();
          }

          if (msg.stage === 'pending') {
            if (typeof msg.position === 'number') {
              setStage(3, `اكتمل الرفع — في طابور الانتظار (الدور ${msg.position + 1})...`);
            } else {
              setStage(3, 'اكتمل الرفع — بانتظار بدء المعالجة...');
            }
          } else if (msg.stage === 'generating') {
            setStage(3, 'جاري العزل بالذكاء الاصطناعي...');

            if (Array.isArray(msg.progress_data) && msg.progress_data.length > 0) {
              const latest = msg.progress_data[msg.progress_data.length - 1];
              let ratio = null;
              if (typeof latest.progress === 'number' && isFinite(latest.progress)) {
                ratio = latest.progress;
              } else if (typeof latest.index === 'number' && typeof latest.length === 'number' && latest.length > 0) {
                ratio = latest.index / latest.length;
              }

              if (ratio !== null) {
                hasServerProgress = true;
                const clampedRatio = Math.max(0, Math.min(1, ratio));
                updatePct(35 + Math.round(clampedRatio * 64));
              }
            } else if (typeof msg.eta === 'number' && msg.eta > 0 && !hasServerProgress) {
              const aiElapsed = Math.max(1, elapsedSeconds - aiStartSec);
              const etaRatio = aiElapsed / (aiElapsed + msg.eta);
              updatePct(Math.min(96, 35 + Math.round(etaRatio * 61)));
            }
          }
        } else if (msg.type === 'data') {
          result = msg;
          break;
        }
      }
    } else {
      result = await client.predict(apiEndpoint, predictParams);
    }

    if (aiTickInterval) clearInterval(aiTickInterval);
    clearInterval(elapsedInterval);

    if (!result || !Array.isArray(result.data)) {
      throw new Error('لم يرجع السيرفر ملفات النتيجة');
    }

    const getUrl = (item) => {
      const baseUrl = 'https://thestinger-uvr5-ui.hf.space';
      if (!item) return '';
      return typeof item === 'string' ? item : (item.url || (item.path ? baseUrl + '/file=' + item.path : ''));
    };

    const rawInstUrl = getUrl(result.data[0]);
    const rawVocalUrl = getUrl(result.data[1]);

    const instAudio = document.getElementById('instAudio');
    const vocalAudio = document.getElementById('vocalAudio');

    stopAllPlayback();
    instAudio.src = rawInstUrl;
    vocalAudio.src = rawVocalUrl;
    instAudio.load();
    if (rawVocalUrl) vocalAudio.load();

    const vocalCard = document.getElementById('vocalCard');
    vocalCard.style.display = rawVocalUrl ? 'flex' : 'none';

    const metaBadge = document.getElementById('resultMetaBadge');
    if (metaBadge) metaBadge.innerText = `${selectedFormat.toUpperCase()} · ${formatElapsedTimer(elapsedSeconds)}`;

    updatePct(100);
    setStage(4, `تم الفصل بنجاح خلال ${formatElapsedTimer(elapsedSeconds)}`);

    saveToHistory(currentFile.name, rawInstUrl, rawVocalUrl, selectedFormat);

    setTimeout(() => {
      isProcessingActive = false;
      document.getElementById('progressSection').classList.remove('show');
      document.getElementById('resultsSection').classList.add('show');
      processBtn.disabled = false;
      processBtn.innerHTML = '<i class="ri-magic-line"></i><span>بدء الفصل الآن</span>';
      showToast(`تم الفصل خلال ${formatElapsedTimer(elapsedSeconds)} — جاهز للاستماع`, 'success');
    }, 650);

  } catch (err) {
    if (aiTickInterval) clearInterval(aiTickInterval);
    clearInterval(elapsedInterval);
    console.error(err);

    const msg = err.message || '';
    const lowerMsg = msg.toLowerCase();
    if (lowerMsg.includes('quota') || lowerMsg.includes('exceeded') || lowerMsg.includes('limit')) {
      if (savedToken) {
        showToast('انتهت حصة التوكن، شغّل VPN أو بدّل التوكن.', 'error');
      } else {
        showToast('خلصت المحاولات المجانية، شغّل VPN أو أضف توكن بالإعدادات.', 'error');
      }
    } else if (lowerMsg.includes('queue')) {
      showToast('السيرفر مزدحم حالياً، أعد المحاولة بعد لحظات.', 'warning');
    } else {
      showToast('خطأ من السيرفر: ' + (msg.substring(0, 60) || 'تأكد من الاتصال'), 'error');
    }

    isProcessingActive = false;
    processBtn.disabled = false;
    processBtn.innerHTML = '<i class="ri-magic-line"></i><span>بدء الفصل الآن</span>';
    document.getElementById('progressSection').classList.remove('show');
  }
};

/* ==========================================
   8. HISTORY (LIGHTWEIGHT STREAMING LINKS)
========================================== */
function formatHistoryDate(ts) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(ts));
  } catch (e) {
    return '';
  }
}

window.saveToHistory = function(name, instUrl, vocalUrl, format = 'mp3') {
  const id = Date.now().toString();
  const timestamp = Date.now();

  let history = JSON.parse(localStorage.getItem('voiceHistory') || '[]');
  history.unshift({
    id: id,
    name: name,
    instUrl: instUrl || '',
    vocalUrl: vocalUrl || '',
    format: format || 'mp3',
    date: formatHistoryDate(timestamp),
    timestamp: timestamp
  });

  localStorage.setItem('voiceHistory', JSON.stringify(history.slice(0, 20)));
  loadHistory();
};

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.loadHistory = function() {
  const history = JSON.parse(localStorage.getItem('voiceHistory') || '[]');
  const list = document.getElementById('historyList');
  if (!list) return;

  if (history.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <i class="ri-disc-line"></i>
        <p>لا توجد معالجات سابقة حتى الآن</p>
      </div>
    `;
    return;
  }

  list.innerHTML = history.map((h, index) => {
    const fmt = (h.format || 'mp3').toUpperCase();
    const displayDate = h.timestamp ? formatHistoryDate(h.timestamp) : (h.date || '');
    return `
      <div class="history-item" onclick="restoreFromHistory(${index})">
        <div class="history-meta">
          <strong dir="ltr">${escapeHtml(h.name)}</strong>
          <div class="history-sub">
            <span dir="ltr">${escapeHtml(displayDate)}</span>
            <span class="history-format-tag">${escapeHtml(fmt)}</span>
          </div>
        </div>
        <div class="history-play-btn">
          <i class="ri-play-fill"></i>
        </div>
      </div>
    `;
  }).join('');
};

window.clearHistory = function() {
  openConfirmDialog({
    title: 'مسح السجل بالكامل',
    message: 'هل أنت متأكد من حذف جميع سجلات المعالجات وتفريغ الذاكرة القديمة؟',
    confirmText: 'نعم، امسح السجل',
    iconClass: 'ri-delete-bin-line',
    onConfirm: async () => {
      localStorage.removeItem('voiceHistory');
      loadHistory();
      try {
        const db = await dbPromise;
        const tx = db.transaction('audioFiles', 'readwrite');
        tx.objectStore('audioFiles').clear();
      } catch (e) {}
      showToast('تم مسح السجل وتفريغ الذاكرة بنجاح', 'success');
    }
  });
};

window.restoreFromHistory = function(index) {
  const history = JSON.parse(localStorage.getItem('voiceHistory') || '[]');
  const item = history[index];
  if (!item || !item.instUrl) {
    showToast('رابط المقطع غير متاح، يرجى إعادة المعالجة.', 'warning');
    return;
  }

  stopAllPlayback();

  const instAudio = document.getElementById('instAudio');
  const vocalAudio = document.getElementById('vocalAudio');

  instAudio.src = item.instUrl;
  instAudio.load();

  if (item.vocalUrl) {
    vocalAudio.src = item.vocalUrl;
    vocalAudio.load();
    document.getElementById('vocalCard').style.display = 'flex';
  } else {
    vocalAudio.src = '';
    document.getElementById('vocalCard').style.display = 'none';
  }

  currentFile = { name: item.name };
  currentOutputFormat = item.format || 'mp3';

  const metaBadge = document.getElementById('resultMetaBadge');
  if (metaBadge) metaBadge.innerText = currentOutputFormat.toUpperCase();

  navigateTo('home');
  document.getElementById('fileName').innerText = item.name;
  document.getElementById('fileSize').innerText = 'بث مباشر';
  document.getElementById('fileDuration').innerText = '—';
  document.getElementById('fileInfo').classList.add('show');
  document.getElementById('waveformSection').classList.remove('show');
  document.getElementById('resultsSection').classList.add('show');
  document.getElementById('changeFileBtn').classList.remove('hidden');

  showToast('تم تجهيز المسارات للبث المباشر', 'success');
};

/* ==========================================
   9. SETTINGS (HF TOKEN)
========================================== */
window.saveSettings = async function() {
  const token = document.getElementById('hf_token_input').value.trim();

  if (!token) {
    localStorage.removeItem('hf_token');
    updateTokenLockUI(localStorage.getItem('hf_token_active') !== 'false');
    showToast('تم مسح التوكن — سيعمل التطبيق بحصة الزائر المجانية', 'success');
    return;
  }

  if (!token.startsWith('hf_')) {
    showToast('التوكن يجب أن يبدأ بـ hf_', 'error');
    return;
  }

  showToast('جاري التحقق من صلاحية التوكن...', 'warning');

  try {
    const res = await fetch('https://huggingface.co/api/whoami-v2', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
      localStorage.setItem('hf_token', token);
      updateTokenLockUI(localStorage.getItem('hf_token_active') !== 'false');
      showToast('التوكن صالح وتم حفظه بنجاح', 'success');
    } else {
      showToast('التوكن غير صالح أو منتهي الصلاحية', 'error');
    }
  } catch (e) {
    showToast('تعذّر التحقق، تأكد من اتصالك بالإنترنت', 'error');
  }
};

window.toggleTokenStatus = function() {
  const isCurrentActive = localStorage.getItem('hf_token_active') !== 'false';
  const newActiveState = !isCurrentActive;
  localStorage.setItem('hf_token_active', newActiveState ? 'true' : 'false');
  updateTokenLockUI(newActiveState);

  if (newActiveState) showToast('تم تفعيل التوكن (محاولات إضافية)', 'success');
  else showToast('تم تجميد التوكن (حصة الزائر المجانية)', 'warning');
};

function updateTokenLockUI(isActive) {
  const btn = document.getElementById('tokenToggleBtn');
  const icon = document.getElementById('tokenLockIcon');
  const input = document.getElementById('hf_token_input');
  const statusText = document.getElementById('tokenStatusText');
  const sideLabel = document.getElementById('sidebarTokenLabel');
  const hasSavedToken = Boolean(localStorage.getItem('hf_token'));

  if (!btn || !icon) return;

  if (isActive && hasSavedToken) {
    icon.className = 'ri-lock-unlock-line';
    icon.style.color = 'var(--success)';
    btn.style.borderColor = 'var(--success)';
    btn.style.background = 'var(--success-soft)';
    if (input) input.style.opacity = '1';
    if (statusText) {
      statusText.style.color = 'var(--success)';
      statusText.innerText = 'التوكن نشط — محاولات يومية إضافية على السيرفر السريع';
    }
    if (sideLabel) sideLabel.innerText = 'التوكن نشط (محاولات إضافية)';
  } else if (!isActive) {
    icon.className = 'ri-lock-2-line';
    icon.style.color = 'var(--text-tertiary)';
    btn.style.borderColor = 'var(--border)';
    btn.style.background = 'var(--bg-input)';
    if (input) input.style.opacity = '0.6';
    if (statusText) {
      statusText.style.color = 'var(--text-secondary)';
      statusText.innerText = 'التوكن مجمد — يعمل بحصة الزائر المجانية';
    }
    if (sideLabel) sideLabel.innerText = 'الوضع المجاني (حصة الزائر)';
  } else {
    icon.className = 'ri-lock-unlock-line';
    icon.style.color = 'var(--text-secondary)';
    btn.style.borderColor = 'var(--border)';
    btn.style.background = 'var(--bg-input)';
    if (input) input.style.opacity = '1';
    if (statusText) {
      statusText.style.color = 'var(--text-secondary)';
      statusText.innerText = 'لا يوجد توكن محفوظ — يعمل بحصة الزائر المجانية';
    }
    if (sideLabel) sideLabel.innerText = 'الوضع المجاني (حصة الزائر)';
  }
}

/* ==========================================
   10. INIT & SINGLE SERVICE WORKER REGISTER
========================================== */
document.getElementById('hf_token_input').value = localStorage.getItem('hf_token') || '';
updateTokenLockUI(localStorage.getItem('hf_token_active') !== 'false');
restoreProcessingPrefs();
loadHistory();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
