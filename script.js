(function() {
  try {
    var pref = localStorage.getItem('theme_preference') || 'light';
    var effective = pref;
    if (pref === 'system') {
      effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', effective);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = effective === 'dark' ? '#0a0f1e' : '#f5f7fb';
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
    if (meta) meta.content = isDark ? '#0a0f1e' : '#f5f7fb';
    systemMediaQuery.addEventListener('change', handleSystemThemeChange);
  } else {
    html.setAttribute('data-theme', pref);
    if (meta) meta.content = pref === 'dark' ? '#0a0f1e' : '#f5f7fb';
  }
}

function handleSystemThemeChange(e) {
  const html = document.documentElement;
  const meta = document.querySelector('meta[name="theme-color"]');
  html.setAttribute('data-theme', e.matches ? 'dark' : 'light');
  if (meta) meta.content = e.matches ? '#0a0f1e' : '#f5f7fb';
}

window.setTheme = function(pref) {
  localStorage.setItem('theme_preference', pref);
  applyTheme(pref);
  updateThemeUI(pref);
  updateThemeQuickIcon(pref);
}

window.cycleTheme = function() {
  const current = localStorage.getItem('theme_preference') || 'light';
  const order = ['light', 'dark', 'system'];
  const next = order[(order.indexOf(current) + 1) % order.length];
  window.setTheme(next);
  const labels = {
    light: '☀️ الوضع الفاتح',
    dark: '🌙 الوضع الداكن',
    system: '🌓 وضع النظام'
  };
  window.showToast('تم التبديل إلى ' + labels[next], 'success');
}

function updateThemeUI(pref) {
  document.querySelectorAll('.theme-option').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === pref);
  });
}

function updateThemeQuickIcon(pref) {
  const icon = document.querySelector('#themeQuickBtn i');
  if (!icon) return;
  const icons = {
    light: 'fa-sun',
    dark: 'fa-moon',
    system: 'fa-circle-half-stroke'
  };
  icon.className = 'fas ' + icons[pref];
}

// Init theme
const initThemePref = localStorage.getItem('theme_preference') || 'light';
applyTheme(initThemePref);
updateThemeUI(initThemePref);
updateThemeQuickIcon(initThemePref);


/* ==========================================
   2. FIREBASE + LOCK SCREEN
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

// Warn on unload during processing
window.addEventListener('beforeunload', function(e) {
  if (isProcessingActive) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// IndexedDB for audio blobs
const dbPromise = new Promise((resolve, reject) => {
  const request = indexedDB.open("VoiceStudioDB", 1);
  request.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains("audioFiles")) {
      db.createObjectStore("audioFiles", {
        keyPath: "id"
      });
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

function monitorSession(uid) {
  firebase.database().ref('users/' + uid + '/currentSession').on('value', (snapshot) => {
    const dbSession = snapshot.val();
    const mySession = localStorage.getItem("my_active_session");

    if (dbSession && dbSession !== mySession) {
      firebase.database().ref('users/' + uid + '/currentSession').off();
      alert("تم تسجيل الدخول من جهاز آخر! سيتم إنهاء جلستك الآن.");
      executeForceLogout();
    }
  });
}
function executeForceLogout() {
  auth.signOut();
  localStorage.removeItem('site_unlocked');
  document.body.classList.add('locked');
  const lockScreen = document.getElementById('telegramLockScreen');
  if (lockScreen) {
    lockScreen.style.display = 'flex';
    lockScreen.style.opacity = '1';
  }
  setTimeout(() => showToast('انتهت الجلسة أو تم إيقاف الحساب!', 'error'), 800);
}

auth.onAuthStateChanged(async (user) => {
  if (user) {
    // 1. تشغيل مراقبة الجلسة (كراسي الموسيقى) فوراً
    if (localStorage.getItem('site_unlocked') === 'true' && typeof monitorSession === 'function') {
      monitorSession(user.uid);
    }
    
    try {
      await user.reload();
    } catch (error) {
      // 2. الطرد ممنوع نهائياً إلا بحالتين حصراً: الحساب انحذف أو انحظر من الإدارة
      if (error.code === 'auth/user-disabled' || error.code === 'auth/user-not-found') {
        alert("تم إيقاف حسابك من الإدارة.");
        executeForceLogout();
      } else {
        // تجاهل أي خطأ آخر للحفاظ على الجلسة
        console.warn("تم تجاهل خطأ فايربيس للحفاظ على تسجيل الدخول:", error.code);
      }
    }
  } else if (localStorage.getItem('site_unlocked') === 'true') {
    // إذا كاش المتصفح انمسح من النظام والفايربيس ضيع الدخول
    setTimeout(() => {
      if (!auth.currentUser) {
        executeForceLogout();
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

  const loginBtn = document.querySelector('#lockStep1 .btn-primary');
  const originalHtml = loginBtn ? loginBtn.innerHTML : '';

  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> انتظر...';
  }

  showToast('جاري تسجيل الدخول...', 'warning');

  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;
    
    // نجاح الدخول: إنشاء الجلسة فوراً وفتح القفل برمجياً
    localStorage.setItem('site_unlocked', 'true');
    const sessionId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    localStorage.setItem("my_active_session", sessionId);
    await firebase.database().ref('users/' + user.uid).update({ currentSession: sessionId });
    
    // بدء مراقبة الحساب لمنع الدخول المتعدد
    monitorSession(user.uid);

    document.body.classList.remove('locked');
    const lockScreen = document.getElementById('telegramLockScreen');
    if (lockScreen) {
      lockScreen.style.opacity = '0';
      setTimeout(() => lockScreen.style.display = 'none', 500);
    }
    showToast('تم تسجيل الدخول بنجاح! أهلاً بك.', 'success');

  } catch (error) {
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerHTML = originalHtml;
    }

    let msg = 'حدث خطأ: ' + (error.code || error.message);
    if (['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/user-not-found'].includes(error.code)) msg = 'البريد أو كلمة المرور غير صحيحة.';
    if (error.code === 'auth/user-disabled') msg = 'تم إيقاف هذا الحساب من قبل الإدارة.';
    if (error.code === 'auth/invalid-email') msg = 'صيغة البريد خاطئة.';
    if (error.code === 'auth/too-many-requests') msg = 'محاولات كثيرة، انتظر قليلاً.';
    if (error.code === 'auth/network-request-failed') msg = 'تأكد من اتصالك بالإنترنت.';

    showToast(msg, 'error');
  }
}


/* ==========================================
   3. STATE
========================================== */
let currentFile = null;
let activeAudio = null;
let activeType = null;
let progressInterval = null;

/* ==========================================
   4. TOAST + PAGE NAV
========================================== */
window.showToast = function(message, type = 'success') {
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-times-circle',
    warning: 'fa-exclamation-circle'
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
  toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

window.showPage = function(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(page).classList.add('active');
  window.scrollTo(0, 0);
}


/* ==========================================
   5. FILE UPLOAD
========================================== */
window.handleDragOver = function(e) {
  e.preventDefault();
  document.getElementById('uploadArea').classList.add('dragover');
}
window.handleDragLeave = function(e) {
  document.getElementById('uploadArea').classList.remove('dragover');
}
window.handleDrop = function(e) {
  e.preventDefault();
  document.getElementById('uploadArea').classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) {
    currentFile = e.dataTransfer.files[0];
    showFileInfo();
  }
}
window.handleFileSelect = function(e) {
  if (e.target.files.length > 0) {
    currentFile = e.target.files[0];
    showFileInfo();
  }
}

async function drawWaveform(file) {
  const canvas = document.getElementById('waveformCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
  canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
  canvas.style.width = canvas.offsetWidth + 'px';
  canvas.style.height = canvas.offsetHeight + 'px';
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;
  ctx.clearRect(0, 0, w, h);

  const styles = getComputedStyle(document.documentElement);
  const primaryColor = styles.getPropertyValue('--primary').trim();
  const secondaryColor = styles.getPropertyValue('--secondary').trim();
  const textColor = styles.getPropertyValue('--text-secondary').trim();

  ctx.fillStyle = textColor;
  ctx.font = 'bold 12px Cairo';
  ctx.fillText('جاري تحليل موجة الصوت...', 15, h / 2);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const actx = new(window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await actx.decodeAudioData(arrayBuffer);
    const rawData = audioBuffer.getChannelData(0);

    const samples = 100;
    const blockSize = Math.floor(rawData.length / samples);
    const filteredData = [];
    for (let i = 0; i < samples; i++) {
      let blockStart = blockSize * i;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) sum += Math.abs(rawData[blockStart + j]);
      filteredData.push(sum / blockSize);
    }

    const multiplier = Math.pow(Math.max(...filteredData), -1);
    const normalizedData = filteredData.map(n => n * multiplier);

    ctx.clearRect(0, 0, w, h);
    const barWidth = (w / samples) - 2;

    normalizedData.forEach((val, i) => {
      const barHeight = Math.max(val * (h - 10), 4);
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, secondaryColor);
      gradient.addColorStop(1, primaryColor);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      const x = i * (barWidth + 2);
      const y = (h - barHeight) / 2;
      const r = Math.min(3, barWidth / 2);
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
    ctx.fillText('جاهز للمعالجة', 15, h / 2);
  }
}

function showFileInfo() {
  if (!currentFile) return;

  document.getElementById('fileName').innerText = currentFile.name;
  document.getElementById('fileSize').innerText = (currentFile.size / 1048576).toFixed(1) + ' MB';
  document.getElementById('fileInfo').classList.add('show');
  document.getElementById('settingsSection').classList.add('show');
  document.getElementById('waveformSection').classList.add('show');

  const audio = new Audio();
  audio.src = URL.createObjectURL(currentFile);
  audio.onloadedmetadata = () => {
    const minutes = Math.floor(audio.duration / 60);
    const seconds = Math.floor(audio.duration % 60);
    document.getElementById('fileDuration').innerText =
      `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  drawWaveform(currentFile);
}


/* ==========================================
   6. PLAYER MODAL
========================================== */
window.openPlayer = function(type) {
  activeType = type;
  const audioId = type === 'vocal' ? 'vocalAudio' : 'instAudio';
  activeAudio = document.getElementById(audioId);

  if (!activeAudio.src || activeAudio.src === window.location.href) {
    showToast('الصوت غير متوفر أو لم يتم معالجته بعد', 'warning');
    return;
  }

  document.getElementById('playerTitle').innerText = type === 'vocal' ? 'صوت المطرب' : 'الموسيقى الخلفية';
  document.getElementById('trackName').innerText = type === 'vocal' ? 'المسار الصوتي' : 'المسار الموسيقي';
  document.getElementById('trackFileName').innerText = currentFile ? currentFile.name : 'Unknown.mp3';

  const artwork = document.getElementById('playerArtwork');
  const icon = document.getElementById('playerArtworkIcon');
  artwork.className = 'player-artwork';
  if (type === 'vocal') {
    artwork.classList.add('vocal-theme');
    icon.className = 'fas fa-microphone-alt';
  } else {
    artwork.classList.add('inst-theme');
    icon.className = 'fas fa-guitar';
  }

  document.getElementById('modalSeek').value = activeAudio.currentTime ? (activeAudio.currentTime / activeAudio.duration) * 100 : 0;
  document.getElementById('modalCurrentTime').innerText = window.formatTime(activeAudio.currentTime || 0);
  document.getElementById('modalTotalTime').innerText = window.formatTime(activeAudio.duration || 0);

  syncPlayPauseIcon();

  document.getElementById('playerModal').classList.add('open');
  history.pushState({
    modalOpen: true
  }, '', '#player');

  if (progressInterval) clearInterval(progressInterval);
  progressInterval = setInterval(updateModalProgress, 100);
}

window.closePlayer = function() {
  if (window.location.hash === '#player') {
    history.back();
  } else {
    document.getElementById('playerModal').classList.remove('open');
    if (progressInterval) clearInterval(progressInterval);
  }
}

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

window.toggleModalPlay = function() {
  if (!activeAudio) return;

  const otherAudioId = activeAudio.id === 'vocalAudio' ? 'instAudio' : 'vocalAudio';
  const otherAudio = document.getElementById(otherAudioId);

  if (activeAudio.paused) {
    if (otherAudio && !otherAudio.paused) {
      clearInterval(otherAudio.fadeInterval);
      let otherVol = otherAudio.volume;
      otherAudio.fadeInterval = setInterval(() => {
        otherVol -= 0.1;
        if (otherVol > 0.05) otherAudio.volume = otherVol;
        else {
          clearInterval(otherAudio.fadeInterval);
          otherAudio.pause();
          otherAudio.volume = 1;
        }
      }, 40);
    }

    clearInterval(activeAudio.fadeInterval);
    activeAudio.volume = 0;
    activeAudio.play();
    let activeVol = 0;
    activeAudio.fadeInterval = setInterval(() => {
      activeVol += 0.1;
      if (activeVol < 0.95) activeAudio.volume = activeVol;
      else {
        clearInterval(activeAudio.fadeInterval);
        activeAudio.volume = 1;
      }
    }, 40);
  } else {
    clearInterval(activeAudio.fadeInterval);
    let currentVol = activeAudio.volume;
    activeAudio.fadeInterval = setInterval(() => {
      currentVol -= 0.1;
      if (currentVol > 0.05) activeAudio.volume = currentVol;
      else {
        clearInterval(activeAudio.fadeInterval);
        activeAudio.pause();
        activeAudio.volume = 1;
        syncPlayPauseIcon();
      }
    }, 40);

    const icon = document.querySelector('#modalPlayBtn i');
    const artwork = document.getElementById('playerArtwork');
    icon.className = 'fas fa-play';
    artwork.classList.remove('playing');
    return;
  }
  syncPlayPauseIcon();
}

function syncPlayPauseIcon() {
  if (!activeAudio) return;
  const icon = document.querySelector('#modalPlayBtn i');
  const artwork = document.getElementById('playerArtwork');
  if (activeAudio.paused) {
    icon.className = 'fas fa-play';
    artwork.classList.remove('playing');
  } else {
    icon.className = 'fas fa-pause';
    artwork.classList.add('playing');
  }
}

window.seekModalAudio = function(val) {
  if (activeAudio && activeAudio.duration) {
    activeAudio.currentTime = (val / 100) * activeAudio.duration;
    document.getElementById('modalCurrentTime').innerText = window.formatTime(activeAudio.currentTime);
  }
}

window.seekRelative = function(seconds) {
  if (activeAudio && activeAudio.duration) {
    let newTime = activeAudio.currentTime + seconds;
    if (newTime < 0) newTime = 0;
    if (newTime > activeAudio.duration) newTime = activeAudio.duration;
    activeAudio.currentTime = newTime;
  }
}

function updateModalProgress() {
  if (activeAudio && activeAudio.duration) {
    document.getElementById('modalSeek').value = (activeAudio.currentTime / activeAudio.duration) * 100;
    document.getElementById('modalCurrentTime').innerText = window.formatTime(activeAudio.currentTime);
    if (activeAudio.ended) syncPlayPauseIcon();
  }
}

window.downloadCurrentAudio = function() {
  if (!activeType) return;
  const fileName = activeType === 'vocal' ? 'Vocals.wav' : 'Instrumental.wav';
  const audioId = activeType === 'vocal' ? 'vocalAudio' : 'instAudio';
  window.downloadAudio(audioId, fileName);
}

window.formatTime = function(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  return Math.floor(sec / 60) + ':' + Math.floor(sec % 60).toString().padStart(2, '0');
}

window.downloadAudio = function(id, name) {
  const url = document.getElementById(id).src;
  if (!url) return showToast('لا يوجد ملف متاح', 'error');
  showToast('جاري بدء التنزيل...', 'success');
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}


/* ==========================================
   7. PROCESSING (GRADIO)
========================================== */
document.getElementById('cfg_agg').addEventListener('input', (e) => {
  document.getElementById('aggValue').innerText = e.target.value;
});

window.startProcessing = async function() {
  if (!currentFile) return showToast('اختر ملف صوتي أولاً', 'warning');

  isProcessingActive = true;

  const isTokenActive = localStorage.getItem('hf_token_active') !== 'false';
  const rawToken = localStorage.getItem('hf_token');
  const savedToken = (isTokenActive && rawToken) ? rawToken : null;

  const processBtn = document.getElementById('processBtn');
  processBtn.disabled = true;
  processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري المعالجة...';

  if (savedToken) {
    showToast('🚀 جاري المعالجة السريعة (سيرفر VIP)...', 'success');
  } else {
    showToast('⏳ الخطة المجانية — قد تستغرق وقتاً', 'warning');
  }

  document.getElementById('progressSection').classList.add('show');
  document.getElementById('resultsSection').classList.remove('show');
  document.getElementById('progressStatus').innerText = 'جاري الاتصال السحابي المجاني أولاً...';

  let p = 0;
  let simInterval = setInterval(() => {
    if (p < 30) {
      p += 1.5;
      document.getElementById('progressStatus').innerText = "جاري رفع البيانات...";
    } else if (p < 85) {
      p += 0.3;
      document.getElementById('progressStatus').innerText = "جاري العزل بالذكاء الاصطناعي...";
    }
    updateProcessing(Math.floor(p));
  }, 300);

  try {
    // 1. تحديد النموذج والمسار الصحيح بناءً على اختيار المستخدم
    const selectedModelRadio = document.querySelector('input[name="model_choice"]:checked');
    const isKaraoke = selectedModelRadio && selectedModelRadio.id === 'model_karaoke';

    let apiEndpoint = "";
    let predictParams = {};

    if (isKaraoke) {
      apiEndpoint = "/roformer_separator";
      predictParams = {
        audio: currentFile,
        model_key: "MelBand Roformer | Karaoke by Gabox",
        out_format: "wav",
        segment_size: 256,
        override_seg_size: false,
        overlap: 8,
        batch_size: 1,
        norm_thresh: 0.9,
        amp_thresh: 1.0,
        single_stem: ""
      };
    } else {
      apiEndpoint = "/mdxc_separator";
      predictParams = {
        audio: currentFile,
        model: "MDX23C-8KFFT-InstVoc_HQ_2.ckpt",
        out_format: "wav",
        segment_size: 256,
        override_seg_size: false,
        overlap: 8,
        batch_size: 1,
        norm_thresh: 0.9,
        amp_thresh: 1.0,
        single_stem: ""
      };
    }

    let result;
    let isUsingVIP = false;

    // 2. محاولة الاتصال بناءً على توفر التوكن وحالته
    if (savedToken) {
      try {
        // أولوية أولى: سيرفر VIP السريع
        const clientVIP = await Client.connect("itsalboushi/UVR5_UI", {
          token: savedToken,
          hf_token: savedToken
        });
        result = await clientVIP.predict(apiEndpoint, predictParams);
        isUsingVIP = true;
      } catch (vipErr) {
        // فشل VIP (خلص الرصيد أو السيرفر نايم) -> انتقال للمجاني
        showToast('نفد رصيد التوكن أو غير متاح! التبديل للمجاني...', 'warning');
        document.getElementById('progressStatus').innerText = 'يتم الآن المعالجة عبر السيرفر المجاني...';
        const clientFree = await Client.connect("TheStinger/UVR5_UI", {});
        result = await clientFree.predict(apiEndpoint, predictParams);
        isUsingVIP = false;
      }
    } else {
      // لا يوجد توكن أو التوكن مقفول -> السيرفر المجاني فوراً
      const clientFree = await Client.connect("TheStinger/UVR5_UI", {});
      result = await clientFree.predict(apiEndpoint, predictParams);
      isUsingVIP = false;
    }

    // --- إكمال العملية بعد نجاح أي من السيرفرين ---
    clearInterval(simInterval);
    document.getElementById('progressStatus').innerText = 'تم العزل! جاري تحميل الملفات...';
    updateProcessing(90);

    let downloadP = 90;
    let downloadInterval = setInterval(() => {
      if (downloadP < 99) {
        downloadP += 0.5;
        updateProcessing(Math.floor(downloadP));
      }
    }, 800);

    // تحديد الروابط بناءً على السيرفر الذي نجح فعلاً
    const getUrl = (i) => {
      const baseUrl = isUsingVIP ?
        "https://itsalboushi-uvr5-ui.hf.space" :
        "https://thestinger-uvr5-ui.hf.space";
      return typeof i === 'string' ? i : (i?.url || (i?.path ? baseUrl + "/file=" + i.path : ''));
    };

    const fetchAudio = async (url) => {
      if (!url) return '';
      try {
        let fetchOptions = {};
        if (isUsingVIP) {
          fetchOptions = {
            headers: {
              "Authorization": `Bearer ${savedToken}`
            }
          };
        }
        const res = await fetch(url, fetchOptions);
        if (!res.ok) return '';
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      } catch (e) {
        return '';
      }
    };

    const rawInstUrl = getUrl(result.data[0]);
    const rawVocalUrl = getUrl(result.data[1]);

    const instBlob = await fetchAudio(rawInstUrl);
    const vocalBlob = await fetchAudio(rawVocalUrl);

    clearInterval(downloadInterval);

    document.getElementById('instAudio').src = instBlob;
    document.getElementById('vocalAudio').src = vocalBlob;

    const vocalCard = document.getElementById('vocalCard');
    if (!vocalBlob) vocalCard.style.display = 'none';
    else vocalCard.style.display = 'flex';

    updateProcessing(100);
    document.getElementById('progressStatus').innerText = 'تمت المعالجة بنجاح!';

    saveToHistory(currentFile.name, rawInstUrl, rawVocalUrl);

    setTimeout(() => {
      isProcessingActive = false;
      document.getElementById('progressSection').classList.remove('show');
      document.getElementById('resultsSection').classList.add('show');
      processBtn.disabled = false;
      processBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> بدء المعالجة';
      showToast('✨ تم الفصل بنجاح!', 'success');
    }, 1000);

  } catch (err) {
    clearInterval(simInterval);
    console.error(err);
    const msg = err.message || '';
    if (msg.toLowerCase().includes('quota')) {
      showToast('🚫 انتهت حصة IP المجانية! استخدم التوكن.', 'error');
    } else if (msg.includes('queue')) {
      showToast('⏳ طابور الانتظار ممتلئ، أعد المحاولة.', 'warning');
    } else {
      showToast('⚠️ خطأ من السيرفر: ' + (msg.substring(0, 60) || 'تأكد من الاتصال'), 'error');
    }
    isProcessingActive = false;
    processBtn.disabled = false;
    processBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> بدء المعالجة';
    document.getElementById('progressSection').classList.remove('show');
  }
}

function updateProcessing(percent) {
  document.getElementById('progressPercent').innerText = percent + '%';
  document.getElementById('progressFill').style.width = percent + '%';

  const steps = [{
      id: 1,
      min: 0,
      max: 25
    },
    {
      id: 2,
      min: 25,
      max: 50
    },
    {
      id: 3,
      min: 50,
      max: 75
    },
    {
      id: 4,
      min: 75,
      max: 100
    }
  ];

  steps.forEach(s => {
    const step = document.getElementById('step' + s.id);
    if (percent >= s.max) {
      step.classList.add('done');
      step.classList.remove('active');
    } else if (percent >= s.min) {
      step.classList.add('active');
      step.classList.remove('done');
    }
  });
}


/* ==========================================
   8. HISTORY (IndexedDB)
========================================== */
window.saveToHistory = async function(name, instUrl, vocalUrl) {
  const id = Date.now().toString();
  const timestamp = Date.now();

  let history = JSON.parse(localStorage.getItem('voiceHistory') || '[]');
  history.unshift({
    id: id,
    name: name,
    instUrl: instUrl || '',
    vocalUrl: vocalUrl || '',
    date: new Date().toLocaleString('ar-SA'),
    timestamp: timestamp
  });

  localStorage.setItem('voiceHistory', JSON.stringify(history.slice(0, 15)));

  try {
    const instRes = await fetch(document.getElementById('instAudio').src);
    const instBlob = await instRes.blob();

    let vocalBlob = null;
    if (document.getElementById('vocalAudio').src && document.getElementById('vocalCard').style.display !== 'none') {
      const vocalRes = await fetch(document.getElementById('vocalAudio').src);
      vocalBlob = await vocalRes.blob();
    }

    const db = await dbPromise;
    const tx = db.transaction("audioFiles", "readwrite");
    const store = tx.objectStore("audioFiles");
    store.put({
      id: id,
      instBlob: instBlob,
      vocalBlob: vocalBlob,
      timestamp: timestamp
    });
  } catch (e) {
    console.log("لم يتم حفظ الملفات في الذاكرة المحلية.");
  }

  loadHistory();
}

window.loadHistory = function() {
  const history = JSON.parse(localStorage.getItem('voiceHistory') || '[]');
  const list = document.getElementById('historyList');

  if (history.length === 0) {
    list.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>لا توجد معالجات سابقة</p>
          </div>
        `;
    return;
  }

  const warningBanner = `
        <div class="banner-info">
          <i class="fas fa-bolt"></i>
          <span><strong>التشغيل الفوري:</strong> المقاطع تُحفظ داخل جهازك حصرياً لمدة 24 ساعة (بدون إنترنت).</span>
        </div>
      `;

  const historyItems = history.map((h, index) => {
    const hoursPassed = h.timestamp ? (Date.now() - h.timestamp) / (1000 * 60 * 60) : 0;
    const isValid = hoursPassed <= 24;
    const statusClass = isValid ? 'active' : 'expired';
    const statusText = isValid ? 'متاح للتشغيل' : 'منتهي الصلاحية';
    const btnClass = isValid ? 'active' : 'expired';
    const btnIcon = isValid ? 'fa-play' : 'fa-times';
    const onclick = isValid ? `restoreFromHistory(${index})` : `showToast('انتهت صلاحية الملف', 'error')`;

    return `
          <div class="history-item ${isValid ? '' : 'disabled'}" onclick="${onclick}">
            <div class="history-meta">
              <strong>${h.name}</strong>
              <small><i class="fas fa-calendar-alt"></i> ${h.date}</small>
              <span class="history-status ${statusClass}">
                <i class="fas fa-circle" style="font-size: 0.5rem;"></i> ${statusText}
              </span>
            </div>
            <div class="history-play-btn ${btnClass}">
              <i class="fas ${btnIcon}"></i>
            </div>
          </div>
        `;
  }).join('');

  list.innerHTML = warningBanner + historyItems;
}

window.clearHistory = function() {
  document.getElementById('confirmModal').classList.add('open');
  history.pushState({
    confirmOpen: true
  }, '', '#confirm');
}

window.closeConfirmModal = function() {
  if (window.location.hash === '#confirm') {
    history.back();
  } else {
    document.getElementById('confirmModal').classList.remove('open');
  }
}

window.confirmClearHistory = async function() {
  localStorage.removeItem('voiceHistory');
  loadHistory();
  
  try {
    const db = await dbPromise;
    const tx = db.transaction("audioFiles", "readwrite");
    tx.objectStore("audioFiles").clear();
  } catch (e) {
    console.log("لم يتم تفريغ قاعدة البيانات:", e);
  }
  
  showToast('تم مسح السجل وتفريغ الذاكرة بنجاح', 'success');
  window.closeConfirmModal();
}

window.restoreFromHistory = async function(index) {
  const history = JSON.parse(localStorage.getItem('voiceHistory') || '[]');
  const item = history[index];
  if (!item) return;

  const hoursPassed = item.timestamp ? (Date.now() - item.timestamp) / (1000 * 60 * 60) : 0;
  if (hoursPassed > 24) {
    showToast('انتهت صلاحية الملف.', 'error');
    return;
  }

  try {
    const db = await dbPromise;
    const tx = db.transaction("audioFiles", "readonly");
    const store = tx.objectStore("audioFiles");
    const request = item.id ? store.get(item.id) : {
      onsuccess: null
    };

    const handleFallback = async () => {
      if (!item.instUrl) {
        showToast('⚠️ مقطع قديم — أعد معالجته للحفظ بجهازك.', 'warning');
        return;
      }
      showToast('جاري استرجاع المقطع...', 'success');
      const isTokenActive = localStorage.getItem('hf_token_active') !== 'false';
      const savedToken = isTokenActive ? localStorage.getItem('hf_token') : null;
      const fetchOptions = savedToken ? {
        headers: {
          "Authorization": `Bearer ${savedToken}`
        }
      } : {};

      try {
        const instRes = await fetch(item.instUrl, fetchOptions);
        if (!instRes.ok) throw new Error('Expired');
        const instBlob = await instRes.blob();

        let vocalBlob = null;
        if (item.vocalUrl) {
          const vocalRes = await fetch(item.vocalUrl, fetchOptions);
          if (vocalRes.ok) vocalBlob = await vocalRes.blob();
        }

        document.getElementById('instAudio').src = URL.createObjectURL(instBlob);
        if (vocalBlob) {
          document.getElementById('vocalAudio').src = URL.createObjectURL(vocalBlob);
          document.getElementById('vocalCard').style.display = 'flex';
        } else {
          document.getElementById('vocalCard').style.display = 'none';
        }

        showPage('home');
        document.getElementById('fileName').innerText = item.name;
        document.getElementById('fileInfo').classList.add('show');
        document.getElementById('resultsSection').classList.add('show');
        currentFile = {
          name: item.name
        };
        showToast('✨ تم الاسترجاع!', 'success');
      } catch (err) {
        showToast('❌ انتهت صلاحية المقطع، أعد معالجته.', 'error');
      }
    };

    if (!item.id) {
      await handleFallback();
      return;
    }

    request.onsuccess = async () => {
      const data = request.result;
      if (data && data.instBlob) {
        showToast('⚡ تشغيل فوري من جهازك...', 'success');
        document.getElementById('instAudio').src = URL.createObjectURL(data.instBlob);

        if (data.vocalBlob) {
          document.getElementById('vocalAudio').src = URL.createObjectURL(data.vocalBlob);
          document.getElementById('vocalCard').style.display = 'flex';
        } else {
          document.getElementById('vocalCard').style.display = 'none';
        }

        showPage('home');
        document.getElementById('fileName').innerText = item.name;
        document.getElementById('fileInfo').classList.add('show');
        document.getElementById('resultsSection').classList.add('show');
        currentFile = {
          name: item.name
        };
      } else {
        await handleFallback();
      }
    };
  } catch (e) {
    showToast('حدث خطأ أثناء قراءة الملف.', 'error');
  }
}


/* ==========================================
   9. SETTINGS (HF TOKEN)
========================================== */
window.saveSettings = async function() {
  const token = document.getElementById('hf_token_input').value.trim();

  if (!token) {
    localStorage.removeItem('hf_token');
    showToast('تم مسح التوكن — ستعمل بالخطة المجانية', 'success');
    return;
  }

  if (!token.startsWith('hf_')) {
    showToast('❌ التوكن يجب أن يبدأ بـ hf_', 'error');
    return;
  }

  showToast('جاري التحقق من التوكن...', 'warning');

  try {
    const res = await fetch('https://huggingface.co/api/whoami-v2', {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (res.ok) {
      localStorage.setItem('hf_token', token);
      showToast('✅ التوكن صالح! تم الحفظ', 'success');
    } else {
      showToast('❌ التوكن خاطئ أو منتهي', 'error');
    }
  } catch (e) {
    showToast('⚠️ خطأ في الاتصال', 'error');
  }
}

window.toggleTokenStatus = function() {
  const isCurrentActive = localStorage.getItem('hf_token_active') !== 'false';
  const newActiveState = !isCurrentActive;
  localStorage.setItem('hf_token_active', newActiveState ? 'true' : 'false');
  updateTokenLockUI(newActiveState);
  if (newActiveState) showToast('🔓 التوكن نشط (السرعة القصوى)', 'success');
  else showToast('🔒 التوكن مجمد — الوضع المجاني', 'warning');
}

function updateTokenLockUI(isActive) {
  const btn = document.getElementById('tokenToggleBtn');
  const icon = document.getElementById('tokenLockIcon');
  const input = document.getElementById('hf_token_input');
  const statusText = document.getElementById('tokenStatusText');

  if (!btn || !icon) return;

  if (isActive) {
    icon.className = 'fas fa-lock-open';
    icon.style.color = 'var(--success)';
    btn.style.borderColor = 'var(--success)';
    btn.style.background = 'var(--success-soft)';
    if (input) input.style.opacity = '1';
    if (statusText) {
      statusText.style.color = 'var(--success)';
      statusText.innerHTML = '⚡ التوكن نشط (السرعة القصوى)';
    }
  } else {
    icon.className = 'fas fa-lock';
    icon.style.color = 'var(--text-tertiary)';
    btn.style.borderColor = 'var(--border)';
    btn.style.background = 'var(--bg-input)';
    if (input) input.style.opacity = '0.6';
    if (statusText) {
      statusText.style.color = 'var(--text-secondary)';
      statusText.innerHTML = '🔒 التوكن مجمد (الوضع المجاني)';
    }
  }
}


/* ==========================================
   10. INIT
========================================== */
window.autoCleanOldBlobs = async function() {
  try {
    const history = JSON.parse(localStorage.getItem('voiceHistory') || '[]');
    const db = await dbPromise;
    const tx = db.transaction("audioFiles", "readwrite");
    const store = tx.objectStore("audioFiles");

    let hasCleaned = false;
    history.forEach(h => {
      const hoursPassed = h.timestamp ? (Date.now() - h.timestamp) / (1000 * 60 * 60) : 0;
      if (hoursPassed > 24 && h.id) {
        store.delete(h.id);
        hasCleaned = true;
      }
    });
    if (hasCleaned) console.log("تم تنظيف الملفات القديمة من الذاكرة بنجاح");
  } catch (e) {
    console.log("لم يتم التنظيف التلقائي:", e);
  }
}

document.getElementById('hf_token_input').value = localStorage.getItem('hf_token') || '';
updateTokenLockUI(localStorage.getItem('hf_token_active') !== 'false');
loadHistory();
autoCleanOldBlobs();
setTimeout(() => showToast('👋 مرحباً بك في Voice Studio Pro', 'success'), 500);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
