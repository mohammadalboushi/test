const firebaseConfig = {
  apiKey: "AIzaSyBB_U4C880PW4GxZd8FALv8yBSiP2mNeBY",
  authDomain: "malaboushi.firebaseapp.com",
  projectId: "malaboushi",
  storageBucket: "malaboushi.firebasestorage.app",
  messagingSenderId: "110336819350",
  appId: "1:110336819350:web:2b1b0488e72b811f0602b7",
  measurementId: "G-94ZT4TQYZY"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

db.enablePersistence().catch(function(err) {
  console.log("Offline error: ", err.code);
});

const provider = new firebase.auth.GoogleAuthProvider();
let currentUid = null;
let unsubscribeData = null;

// نظام الأقسام والـ 42 زر
function createEmptySection() {
    return { 
        col1: Array(6).fill(null), 
        col2: Array(6).fill(null), 
        col3: Array(6).fill(null), 
        col4: Array(6).fill(null),
        col5: Array(6).fill(null)
    };
}

let sections = JSON.parse(localStorage.getItem('sections')) || ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
let itemData = JSON.parse(localStorage.getItem('itemData')) || null;
let currentSection = sections[0];

// تهيئة الداتا الجديدة وتأمين الهجرة من النسخة القديمة إذا لزم الأمر
if (!itemData || !itemData[sections[0]]) {
    let newData = {};
    sections.forEach(s => newData[s] = createEmptySection());
    if (itemData && itemData.col1) { // داتا قديمة عمودية فقط
        ['col1','col2','col3','col4','col5'].forEach(col => {
            if(itemData[col]) {
                itemData[col].forEach((it, idx) => { if(idx < 6 && it && it.name) newData[sections[0]][col][idx] = it; });
            }
        });
    }
    itemData = newData;
}

let savedBills = [];
let customers = [];
let rate = 89000;
let settingsPassword = null;

let total = 0;
let enteredNum = '';
let customPriceMode = false;
let receiptData = {};
let sortMode = false;
let sortFirstSelection = null;
let currentEditCol = null;
let currentEditIndex = null;

let custNameInput = "";
let custAddressInput = "";
let custPhoneInput = "";
let isAddingCustomerFromMain = false;

let selectedCustomerForBill = null;
let currentViewedBillIndex = null;
let currentStatementCustomer = null;
let isAddingDebtTransaction = false;

let selectionMode = { bill: false, customer: false };
let selectedItems = { bill: new Set(), customer: new Set() };
let modalStack = [];

const getEl = (id) => document.getElementById(id);
const fmt = (n) => Number(n).toLocaleString('en-US');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.log(err));
}

function openSettingsMenu() {
    getEl('menu-overlay').classList.add('active');
    getEl('settings-menu').classList.add('open');
    window.history.pushState({ menu: true }, "");
}

function closeSettingsMenuBtn() {
    getEl('menu-overlay').classList.remove('active');
    getEl('settings-menu').classList.remove('open');
}

function showModal(id) {
    if (modalStack.length > 0) {
        getEl(modalStack[modalStack.length - 1]).classList.add('hidden');
    }
    modalStack.push(id);
    getEl(id).classList.remove('hidden');
    window.history.pushState({ modal: id }, "");
}

function goBackModalBtn() {
    window.history.back();
}

window.addEventListener('popstate', () => {
    const receiptBox = getEl('receipt');
    if (receiptBox && receiptBox.classList.contains('show')) {
        receiptBox.classList.remove('show');
        return;
    }

    if (getEl('settings-menu').classList.contains('open')) {
        getEl('menu-overlay').classList.remove('active');
        getEl('settings-menu').classList.remove('open');
        return;
    } 
    
    if (modalStack.length > 0) {
        const currentId = modalStack.pop();
        getEl(currentId).classList.add('hidden');
        if (modalStack.length > 0) {
            const prevId = modalStack[modalStack.length - 1];
            getEl(prevId).classList.remove('hidden');
        }
    }
});

function closeAllModals() {
    // حساب عدد النوافذ المفتوحة لنمسحها من تاريخ المتصفح دفعة وحدة
    let popCount = modalStack.length;
    if (getEl('settings-menu').classList.contains('open')) popCount++;
    const receiptBox = getEl('receipt');
    if (receiptBox && receiptBox.classList.contains('show')) popCount++;

    document.querySelectorAll('.custom-modal').forEach(e => e.classList.add('hidden'));
    modalStack = [];
    closeSettingsMenuBtn();
    if(receiptBox) receiptBox.classList.remove('show');

    // إرجاع متصفح الجوال للوراء دفعة واحدة بدون تخريب الواجهة
    if (popCount > 0) {
        window.history.go(-popCount);
    }
}

auth.onAuthStateChanged(user => {
  const nameTxt = getEl('user-name-txt');
  const emailTxt = getEl('user-email-txt');
  const authBtnTxt = getEl('auth-btn-txt');
  const avatar = getEl('user-avatar-img');
  const authDot = getEl('auth-status-dot');

  if (user) {
      currentUid = user.uid;
      if(authDot) authDot.style.background = '#10b981';
      if(nameTxt) nameTxt.textContent = user.displayName || "مستخدم";
      if(emailTxt) emailTxt.textContent = user.email;
      if(authBtnTxt) authBtnTxt.textContent = "تسجيل خروج";
      if(avatar) avatar.innerHTML = user.photoURL ? `<img src="${user.photoURL}" style="width:100%;height:100%;object-fit:cover;">` : "👤";
      
      syncOnceThenListen(user.uid);
  } else {
      currentUid = null;
      if(authDot) authDot.style.background = '#ef4444';
      if(nameTxt) nameTxt.textContent = "مستخدم زائر";
      if(emailTxt) emailTxt.textContent = "سجل الدخول للمزامنة";
      if(authBtnTxt) authBtnTxt.textContent = "تسجيل دخول";
      if(avatar) avatar.innerHTML = "👤";
      
      if(unsubscribeData) { unsubscribeData(); unsubscribeData = null; }
      
      itemData = JSON.parse(localStorage.getItem('itemData')) || itemData;
      sections = JSON.parse(localStorage.getItem('sections')) || sections;
      savedBills = JSON.parse(localStorage.getItem('savedBills')) || [];
      customers = JSON.parse(localStorage.getItem('customers')) || [];
      rate = parseFloat(localStorage.getItem('exchangeRate')) || 89000;
      settingsPassword = localStorage.getItem('settingsPassword') || null;
      
      if (!sections.includes(currentSection)) currentSection = sections[0];
      renderItems();
      renderCustomerList('manage');
      renderBillsList();
      updateTotal();
      updatePassBtn();
  }
});

function handleAuthAction() {
    closeSettingsMenuBtn();
    if (currentUid) {
        confirmModal("هل تريد تسجيل الخروج؟ سيتم مسح البيانات من الشاشة لحمايتها.").then(res => {
            if (res) {
                auth.signOut().then(() => {
                    localStorage.removeItem('itemData');
                    localStorage.removeItem('sections');
                    localStorage.removeItem('savedBills');
                    localStorage.removeItem('customers');
                    sections = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
                    itemData = {};
                    sections.forEach(s => itemData[s] = createEmptySection());
                    currentSection = "1";
                    savedBills = [];
                    customers = [];
                    renderItems();
                    reset();
                    closeAllModals();
                    showToast('تم تسجيل الخروج وتأمين الشاشة');
                });
            }
        });
    } else {
        openLoginModal();
    }
}

function openLoginModal() {
    const currentEmail = getEl('signup-email').value;
    const currentPass = getEl('signup-password').value;
    closeAllModals();
    getEl('login-email').value = currentEmail;
    getEl('login-password').value = currentPass;
    showModal('login-modal');
}

function openSignupModal() {
    const currentEmail = getEl('login-email').value;
    const currentPass = getEl('login-password').value;
    closeAllModals();
    getEl('signup-email').value = currentEmail;
    getEl('signup-password').value = currentPass;
    showModal('signup-modal');
}

function loginWithEmail() {
    const email = getEl('login-email').value.trim();
    const password = getEl('login-password').value;
    
    if (!email || !password) return alertModal("الرجاء إدخال البريد وكلمة المرور");
    
    showToast('جاري تسجيل الدخول...');
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            closeAllModals();
            showToast('تم تسجيل الدخول بنجاح');
        })
        .catch(error => {
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                alertModal("البريد الإلكتروني غير مسجل، أو كلمة المرور خاطئة");
            } else if (error.code === 'auth/invalid-email') {
                alertModal("صيغة البريد الإلكتروني غير صحيحة");
            } else {
                alertModal("حدث خطأ: " + error.message);
            }
        });
}

function registerNewUser() {
    const email = getEl('login-email').value.trim();
    const password = getEl('login-password').value;
    
    if (!email || !password) return alertModal("الرجاء إدخال البريد وكلمة المرور");
    if (password.length < 6) return alertModal("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
    
    showToast('جاري إنشاء الحساب...');
    auth.createUserWithEmailAndPassword(email, password)
        .then(() => {
            // تسجيل خروج فوري لأننا بدنا ياه يسجل دخول بنفسه مثل ما طلبت
            auth.signOut();
            showToast('تم إنشاء الحساب بنجاح');
            
            // إظهار رسالة توجيهية صغيرة وإبقاء الإيميل والباسورد بالمربعات
            const msgEl = getEl('login-msg-hint');
            if(msgEl) msgEl.style.display = 'block';
        })
        .catch(error => {
            if (error.code === 'auth/email-already-in-use') {
                alertModal("هذا البريد الإلكتروني مستخدم مسبقاً، يمكنك تسجيل الدخول مباشرة");
            } else if (error.code === 'auth/invalid-email') {
                alertModal("صيغة البريد الإلكتروني غير صحيحة");
            } else {
                alertModal("حدث خطأ: " + error.message);
            }
        });
}

function loginWithGoogle() {
    showToast('جاري الاتصال بجوجل...');
    auth.signInWithPopup(provider)
        .then(() => {
            closeAllModals();
            showToast('تم تسجيل الدخول عبر جوجل');
        })
        .catch(e => {
            showToast('فشل الدخول');
        });
}

function mergeLocalAndCloud(cloudData) {
  let localSections = JSON.parse(localStorage.getItem('sections')) || ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  let localItems = JSON.parse(localStorage.getItem('itemData')) || {};
  let localBills = JSON.parse(localStorage.getItem('savedBills')) || [];
  let localCusts = JSON.parse(localStorage.getItem('customers')) || [];
  
  let mergedSections = cloudData && cloudData.sections ? [...cloudData.sections] : localSections;
  let mergedItems = cloudData && cloudData.itemData ? JSON.parse(JSON.stringify(cloudData.itemData)) : localItems;
  let mergedBills = cloudData && cloudData.savedBills ? [...cloudData.savedBills] : [];
  let mergedCusts = cloudData && cloudData.customers ? [...cloudData.customers] : [];
  let mergedRate = cloudData && cloudData.rate ? cloudData.rate : (parseFloat(localStorage.getItem('exchangeRate')) || 89000);

  if (Object.keys(mergedItems).length === 0 || (!mergedItems[mergedSections[0]] && mergedItems.col1)) {
       let migrated = {};
       mergedSections.forEach(s => migrated[s] = createEmptySection());
       if (mergedItems.col1) {
           ['col1','col2','col3','col4','col5'].forEach(col => {
               if(mergedItems[col]) {
                   mergedItems[col].forEach((it, idx) => { if(idx<6 && it && it.name) migrated[mergedSections[0]][col][idx] = it; });
               }
           });
       }
       mergedItems = migrated;
  }

  localBills.forEach(lb => {
      const exists = mergedBills.find(cb => cb.time === lb.time && cb.total === lb.total);
      if(!exists) mergedBills.push(lb);
  });

  localCusts.forEach(lc => {
      const exists = mergedCusts.find(cc => cc.name === lc.name);
      if(!exists) mergedCusts.push(lc);
  });

  localStorage.removeItem('itemData');
  localStorage.removeItem('sections');
  localStorage.removeItem('savedBills');
  localStorage.removeItem('customers');

  return { itemData: mergedItems, sections: mergedSections, savedBills: mergedBills, customers: mergedCusts, rate: mergedRate };
}

function syncOnceThenListen(uid) {
  const hasLocalData = localStorage.getItem('itemData') || localStorage.getItem('savedBills') || localStorage.getItem('customers');

  if (hasLocalData) {
      db.collection('midoCashier').doc(uid).get({ source: 'server' }).then(doc => {
          let cloudData = doc.exists ? doc.data() : null;
          const merged = mergeLocalAndCloud(cloudData);
          itemData = merged.itemData;
          sections = merged.sections;
          savedBills = merged.savedBills;
          customers = merged.customers;
          rate = merged.rate;
          if (!sections.includes(currentSection)) currentSection = sections[0];
          saveDataToCloud();
          setupRealtimeListener(uid);
      }).catch(err => {
          db.collection('midoCashier').doc(uid).get().then(doc => {
              let cloudData = doc.exists ? doc.data() : null;
              const merged = mergeLocalAndCloud(cloudData);
              itemData = merged.itemData;
              sections = merged.sections;
              savedBills = merged.savedBills;
              customers = merged.customers;
              rate = merged.rate;
              if (!sections.includes(currentSection)) currentSection = sections[0];
              saveDataToCloud();
              setupRealtimeListener(uid);
          }).catch(e => setupRealtimeListener(uid));
      });
  } else {
      setupRealtimeListener(uid);
  }
}

function setupRealtimeListener(uid) {
  unsubscribeData = db.collection('midoCashier').doc(uid).onSnapshot(docSnap => {
      if(docSnap.exists) {
          const data = docSnap.data();
          sections = data.sections || ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
          itemData = data.itemData || {};
          if (Object.keys(itemData).length === 0) sections.forEach(s => itemData[s] = createEmptySection());
          if (!sections.includes(currentSection)) currentSection = sections[0];
          savedBills = data.savedBills || [];
          customers = data.customers || [];
          rate = data.rate || 89000;
          renderItems();
          if(!getEl('bills-modal').classList.contains('hidden')) renderBillsList();
          if(!getEl('debt-manage-modal').classList.contains('hidden')) renderCustomerList('manage');
      } else {
          // تصفير الذاكرة والواجهة بالكامل إذا كان الحساب جديداً ولا يملك بيانات
          sections = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
          itemData = {};
          sections.forEach(s => itemData[s] = createEmptySection());
          currentSection = "1";
          savedBills = [];
          customers = [];
          renderItems();
      }
  });
}

function saveData() {
  if (currentUid) {
      saveDataToCloud();
  } else {
      localStorage.setItem('itemData', JSON.stringify(itemData));
      localStorage.setItem('sections', JSON.stringify(sections));
      localStorage.setItem('savedBills', JSON.stringify(savedBills));
      localStorage.setItem('customers', JSON.stringify(customers));
      localStorage.setItem('exchangeRate', rate);
      
      renderItems();
      if(!getEl('bills-modal').classList.contains('hidden')) renderBillsList();
      if(!getEl('debt-manage-modal').classList.contains('hidden')) renderCustomerList('manage');
  }
}

function saveDataToCloud() {
  if (!currentUid) return;
  db.collection('midoCashier').doc(currentUid).set({
      itemData: itemData,
      sections: sections,
      savedBills: savedBills,
      customers: customers,
      rate: rate
  });
}

function vibrate(el) { 
  if(navigator.vibrate) navigator.vibrate(30); 
  if(el && el.tagName !== 'BODY') { 
      el.style.transform='scale(0.92)'; 
      setTimeout(()=>el.style.transform='scale(1)', 100); 
  } 
}

function showToast(msg) {
  const t = getEl('toast-notification');
  t.innerHTML = msg;
  t.classList.add('show');
  setTimeout(() => { t.classList.remove('show'); }, 2000);
}

// زر Esc كزر رجوع عالمي 
document.addEventListener('keydown', (e) => {
  if (e.key.match(/^F(1[0-2]|[1-9])$/)) {
      e.preventDefault();
      const secIndex = parseInt(e.key.substring(1)) - 1;
      if (sections[secIndex]) {
          currentSection = sections[secIndex];
          renderItems();
      }
      return;
  }

  if (e.key === 'Escape') {
      const receiptBox = getEl('receipt');
      if (receiptBox && receiptBox.classList.contains('show')) {
          toggleReceipt();
          return;
      }
      const activeModal = document.querySelector('.custom-modal:not(.hidden)');
      if (activeModal) {
          goBackModalBtn();
          return;
      }
      if (getEl('settings-menu').classList.contains('open')) {
          closeSettingsMenuBtn();
          return;
      }
      return;
  }
  
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
          if (e.key === 'Enter') {
              e.preventDefault();
              const activeModal = document.querySelector('.custom-modal:not(.hidden)');
              if (activeModal) {
                  if (activeModal.id === 'pay-box-modal') {
                      closeAllModals();
                      executeSaveBill(null);
                  } else {
                      const submitBtn = activeModal.querySelector('.btn-add') || activeModal.querySelector('.btn-close');
                      if (submitBtn) submitBtn.click();
                  }
              }
          }
          return; 
      }

      if (e.key >= '0' && e.key <= '9') { press(e.key); } 
      else if (e.key === 'End') { e.preventDefault(); press('00'); } 
      else if (e.key === 'PageDown') { e.preventDefault(); press('000'); } 
      else if (e.key === 'Backspace') { clearInput(); } 
      else if (e.key === 'Delete') { reset(); } 
      else if (e.key === '+' || e.key === 'Add' || e.key === 'Shift') { activatePrice(); } 
      else if (e.key === 'Enter') { 
          const anyModalOpen = document.querySelector('.custom-modal:not(.hidden)'); 
          if (!anyModalOpen) {
              initiateSave(); 
          } else if (anyModalOpen.id === 'pay-box-modal') {
              closeAllModals();
              executeSaveBill(null);
          }
      } 
      else if (e.key === '-' || e.key === 'Subtract') { const anyModalOpen = document.querySelector('.custom-modal:not(.hidden)'); if (!anyModalOpen) openPay(); } 
    });

function searchMainItems(term) {
  const resDiv = getEl('main-search-results');
  if (!term) { resDiv.style.display = 'none'; return; }
  let matches = [];
            sections.forEach(sec => {
              ['col1','col2','col3','col4','col5'].forEach(col => {
                  if(!itemData[sec][col]) itemData[sec][col] = Array(6).fill(null);
                  itemData[sec][col].forEach(item => {
                      if(item && item.name && item.name.includes(term)) matches.push(item);
                  });
              });
          });
  if(matches.length === 0) { resDiv.style.display = 'none'; return; }
  let html = '';
  matches.forEach(m => {
      html += `<div style="padding:10px; border-bottom:1px solid #eee; font-size:12px; cursor:pointer;" onclick="add('${m.name}', ${m.price}); getEl('main-search-input').value=''; getEl('main-search-results').style.display='none';">${m.name} - ${fmt(m.price)}</div>`;
  });
  resDiv.innerHTML = html;
  resDiv.style.display = 'block';
}

function initiateSave() { 
  if(total === 0) return alertModal("لا توجد طلبات لحفظها!");
  selectionMode.customer = false; 
  selectedItems.customer.clear();
  getEl('cust-select-search').value = '';
  renderCustomerList('select'); 
  showModal('customer-select-modal'); 
}

function openDebtManagement() { 
  checkSettingsPassword(() => {
      selectionMode.customer = false;
      selectedItems.customer.clear();
      getEl('cust-manage-search').value = '';
      renderCustomerList('manage'); 
      showModal('debt-manage-modal');
  });
}

function renderCustomerList(mode, searchTerm = '') {
  const listId = mode === 'select' ? 'customer-select-list' : 'debt-customer-list';
  const listEl = getEl(listId);
  listEl.innerHTML = '';
  
  if(mode === 'manage') {
      getEl('btn-cust-select-mode').style.display = selectionMode.customer ? 'none' : 'flex';
      getEl('cust-selection-bar').style.display = selectionMode.customer ? 'grid' : 'none';
      getEl('btn-add-cust-manage').style.display = selectionMode.customer ? 'none' : 'flex';
      listEl.className = selectionMode.customer ? 'showing-checks' : '';
  }

  let filtered = customers;
  if(searchTerm) {
      filtered = customers.filter(c => c.name.includes(searchTerm));
  }

  if (filtered.length === 0) { listEl.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:10px;">لا يوجد زبائن</div>'; return; }

  filtered.forEach(cust => {
      const name = cust.name;
      const div = document.createElement('div');
      div.className = 'customer-row';
      
      let html = '';
      if (mode === 'manage') {
          const isSel = selectedItems.customer.has(name);
          html += `<input type="checkbox" class="chk-select" ${isSel?'checked':''} onchange="toggleItemSelection('customer', '${name}', this)">`;
      }

      if (mode === 'select') {
          div.innerHTML = `<span style="font-weight:bold;">${name}</span>`;
          div.onclick = () => selectCustomerForBill(name);
      } else {
          const debt = savedBills.filter(b => b.customName === name).reduce((sum, b) => sum + b.total, 0);
          html += `<div style="flex:1; display:flex; justify-content:space-between;"><span>${name}</span> <span style="font-size:12px;color:${debt>=0?'#ef4444':'#10b981'};font-weight:900">${fmt(debt)} L.L.</span></div>`;
          div.innerHTML = html;
          setupCustomerInteraction(div, name);
      }
      listEl.appendChild(div);
  });
}

function openAddCustomerModal(fromMain) {
  isAddingCustomerFromMain = fromMain;
  getEl('add-cust-name').value = '';
  getEl('add-cust-address').value = '';
  getEl('add-cust-phone').value = '';
  showModal('add-customer-modal');
}

function confirmAddNewCustomer() {
  const n = getEl('add-cust-name').value.trim();
  const a = getEl('add-cust-address').value.trim();
  const p = getEl('add-cust-phone').value.trim();
  if(!n) return alertModal("الاسم مطلوب");
  if(customers.find(c => c.name === n)) return alertModal("موجود مسبقاً");
  customers.push({name: n, address: a, phone: p});
  saveData();
  showToast("تم الحفظ");
  goBackModalBtn();
  if(isAddingCustomerFromMain) renderCustomerList('select'); else renderCustomerList('manage');
}

function selectCustomerForBill(name) {
  closeAllModals(); // إغلاق نافذة السؤال
  executeSaveBill(name); // تنفيذ الحفظ مباشرة باسم الزبون
}

function setupCustomerInteraction(element, name) {
  let timer; let startX, startY; let isScrolling = false; let isLongPress = false;
  element.addEventListener('mousedown', (e) => { 
      if(selectionMode.customer || e.target.type === 'checkbox') return;
      timer = setTimeout(() => { isLongPress = true; confirmDeleteCustomer(name); }, 600); 
  });
  element.addEventListener('mouseup', (e) => { 
      clearTimeout(timer); 
      if(selectionMode.customer || e.target.type === 'checkbox') return;
      if(!isLongPress) openCustomerStatement(name); 
      isLongPress = false; 
  });
  element.addEventListener('touchstart', (e) => {
      if(selectionMode.customer || e.target.type === 'checkbox') return;
      startX = e.touches[0].clientX; startY = e.touches[0].clientY; isScrolling = false; isLongPress = false;
      timer = setTimeout(() => { if (!isScrolling) { isLongPress = true; if(navigator.vibrate) navigator.vibrate(40); confirmDeleteCustomer(name); } }, 600);
  }, {passive: true});
  element.addEventListener('touchmove', (e) => { if (Math.abs(e.touches[0].clientX - startX) > 10 || Math.abs(e.touches[0].clientY - startY) > 10) { isScrolling = true; clearTimeout(timer); } }, {passive: true});
  element.addEventListener('touchend', (e) => { 
      clearTimeout(timer); 
      if(selectionMode.customer || e.target.type === 'checkbox') return;
      if (!isScrolling && !isLongPress) openCustomerStatement(name); 
  });
}

async function confirmDeleteCustomer(name) {
  if (await confirmModal(`حذف الزبون "${name}" نهائياً؟`)) {
      customers = customers.filter(c => c.name !== name);
      saveData();
      renderCustomerList('manage');
  }
}

function openCustomerStatement(name) {
  currentStatementCustomer = name;
  
  // قمنا بإضافة رقم الفهرس الأصلي لكل فاتورة قبل تصفيتها، لكي لا نحذف فاتورة بالخطأ
  const billsWithOriginalIndex = savedBills.map((b, index) => ({ ...b, originalIndex: index }))
                                           .filter(b => b.customName === name);

  const totalLBP = billsWithOriginalIndex.reduce((sum, b) => sum + b.total, 0);
  const totalUSD = totalLBP / rate;

  getEl('statement-title').innerHTML = `<span>كشف حساب: ${name}</span><span style="cursor:pointer; color:#94a3b8; font-size:22px; padding:0 10px;" onclick="showAllCustomerBills('${name}')">⋮</span>`;
  
  const summaryEl = getEl('statement-summary');
  summaryEl.style.background = totalLBP > 0 ? 'linear-gradient(135deg, #fff0f0 0%, #ffe4e6 100%)' : (totalLBP < 0 ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)');
  summaryEl.style.border = totalLBP > 0 ? '1px solid #fecaca' : (totalLBP < 0 ? '1px solid #bbf7d0' : '1px solid #e2e8f0');
  summaryEl.style.padding = '12px 16px';
  summaryEl.style.borderRadius = '12px';
  summaryEl.style.boxShadow = totalLBP > 0 ? '0 4px 12px rgba(225,29,72,0.05)' : (totalLBP < 0 ? '0 4px 12px rgba(16,185,129,0.05)' : 'none');

  const mainColor = totalLBP > 0 ? '#e11d48' : (totalLBP < 0 ? '#059669' : '#475569');
  
  summaryEl.innerHTML = `
      <div style="text-align:center; font-size:14px; color:${mainColor}; font-weight:900; margin-bottom:10px;">مجموع الحساب</div>
      <div style="display:flex; align-items:center;">
          <div style="flex:1; text-align:center; direction:ltr;">
              <div style="font-weight:900; color:${mainColor}; font-size:18px;">${fmt(totalLBP)} <span style="font-size:12px;">L.L.</span></div>
          </div>
          <div style="width:1px; height:25px; background:${mainColor}; opacity:0.2;"></div>
          <div style="flex:1; text-align:center; direction:ltr;">
              <div style="font-weight:900; color:${mainColor}; font-size:18px;">$ ${totalUSD.toFixed(2)}</div>
          </div>
      </div>
  `;
  const list = getEl('statement-bills-list');
  list.style.maxHeight = '320px';
  list.innerHTML = '';
  
  if (billsWithOriginalIndex.length === 0) {
      list.innerHTML = '<div style="text-align:center;color:#94a3b8;font-size:12px;padding:20px;font-weight:bold;">الحساب صافي</div>';
  } else {
      billsWithOriginalIndex.reverse().forEach(bill => {
          const isPayment = bill.total < 0; 
          const isCashDebt = bill.note === "دين نقدي (كاش)";
          let titleColor = isPayment ? '#10b981' : (isCashDebt ? '#ef4444' : '#1e293b');
          let totalColor = isPayment ? '#10b981' : (isCashDebt ? '#ef4444' : '#ef4444');

          const div = document.createElement('div');
          
          // إعداد الكرت ليكون جاهزاً للالتقاط كصورة، وجعله قابلاً للضغط
          div.id = `bill-card-${bill.originalIndex}`;
          div.style.cursor = 'pointer';
          div.onclick = () => openBillActionMenu(bill.originalIndex);
          
          div.style.border = '1px solid #e2e8f0'; 
          div.style.borderRadius = '16px'; 
          div.style.padding = '12px';
          div.style.marginBottom = '15px'; 
          div.style.background = '#f8fafc';
          div.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)';

          let html = `<div style="font-size:11px; color:#64748b; margin-bottom:10px; text-align:center; border-bottom:1px dashed #cbd5e1; padding-bottom:5px; font-weight:bold;">${bill.time}</div>`;
          
          html += '<table style="width:100%; font-size:12px; text-align:right;"><tr style="color:#64748b; border-bottom:1px solid #e2e8f0;"><th style="padding:4px;">الصنف</th><th style="padding:4px; text-align:center;">الكمية</th><th style="padding:4px; text-align:left;">السعر</th></tr>';
          
          const items = Array.isArray(bill.items) ? bill.items : Object.values(bill.items);
          items.forEach(item => {
              html += `<tr>
                          <td style="padding:6px 4px; font-weight:800; color:${titleColor};">${item.name}</td>
                          <td style="padding:6px 4px; text-align:center; color:#ef4444; font-weight:900;">${item.count}</td>
                          <td style="padding:6px 4px; text-align:left; font-weight:800; color:#1e293b;">${fmt(item.price)}</td>
                       </tr>`;
          });
          
          html += `</table>`;
          
          // إضافة الإجمالي بالليرة والدولار بصف واحد (الدولار يمين والليرة يسار)
          html += `<div style="margin-top:10px; padding-top:10px; border-top:1px dashed #cbd5e1; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:5px;">
                      <span style="font-weight:900; font-size:14px; color:#334155;">الإجمالي:</span>
                      <div style="display:flex; align-items:center; gap:12px;">
                          <span style="font-weight:800; font-size:14px; color:#10b981;">$${(Math.abs(bill.total)/rate).toFixed(2)}</span>
                          <span style="font-weight:900; font-size:15px; color:${totalColor};">${fmt(Math.abs(bill.total))} L.L.</span>
                      </div>
                   </div>`;
          
          div.innerHTML = html;
          list.appendChild(div);
      });
  }
  showModal('customer-statement-modal');
}

function showAllCustomerBills(name) {
  const bills = savedBills.filter(b => b.customName === name);
  const container = getEl('all-bills-container');
  container.innerHTML = `<div style="font-size:16px; font-weight:900; text-align:center; margin-bottom:15px; color:#ef4444;">فواتير: ${name}</div>`;
  if(bills.length === 0) {
      container.innerHTML += `<div style="text-align:center; color:#94a3b8;">لا يوجد فواتير</div>`;
  } else {
      bills.reverse().forEach((bill) => {
          let d = `<div style="border:1px solid #e2e8f0; border-radius:16px; padding:16px; margin-bottom:15px; background:#f8fafc; box-shadow:0 2px 8px rgba(0,0,0,0.02);">`;
          d += `<div style="font-size:11px; color:#64748b; margin-bottom:10px; text-align:center; border-bottom:1px dashed #cbd5e1; padding-bottom:5px; font-weight:bold;">${bill.time}</div>`;
          d += '<table style="width:100%; font-size:13px; text-align:right;"><tr style="color:#64748b; border-bottom:1px solid #e2e8f0;"><th style="padding:6px;">الصنف</th><th style="padding:6px; text-align:center;">الكمية</th><th style="padding:6px; text-align:left;">السعر</th></tr>';
          const itemsList = Array.isArray(bill.items) ? bill.items : Object.values(bill.items);
          itemsList.forEach(item => {
              d += `<tr><td style="padding:8px 6px; font-weight:800; color:#1e293b;">${item.name}</td><td style="padding:8px 6px; text-align:center; color:#ef4444; font-weight:900;">${item.count}</td><td style="padding:8px 6px; text-align:left; font-weight:800; color:#1e293b;">${fmt(item.price)}</td></tr>`;
          });
          d += `</table>`;
          d += `<div style="margin-top:12px; padding-top:12px; border-top:1px dashed #cbd5e1; display:flex; justify-content:space-between; font-weight:900; font-size:15px;"><span>الإجمالي:</span><span style="color:#ef4444;">${fmt(bill.total)} L.L.</span></div>`;
          d += `</div>`;
          container.innerHTML += d;
      });
  }
  showModal('all-customer-bills-modal');
}

function openPaymentModal(isDebt) {
  isAddingDebtTransaction = isDebt;
  getEl('payment-amount').value = '';
  getEl('payment-modal-title').textContent = isDebt ? "تسجيل دين نقدي (كاش)" : "استلام دفعة من الحساب";
  showModal('payment-modal');
  setTimeout(() => getEl('payment-amount').focus(), 100);
}

function confirmTransaction(currency) {
  if (!currentStatementCustomer) return;
  const val = parseFloat(getEl('payment-amount').value);
  if (isNaN(val) || val <= 0) return alertModal("المبلغ غير صحيح");

  let amountLBP = 0, noteText = "", finalTotal = 0, billNote = "";
  if (currency === 'USD') { amountLBP = val * rate; } else { amountLBP = val; }

  if (isAddingDebtTransaction) {
      finalTotal = amountLBP; 
      billNote = "دين نقدي (كاش)";
      noteText = `سحب كاش (${currency === 'USD' ? '$' + val : fmt(val) + ' L.L.'})`;
  } else {
      finalTotal = -amountLBP;
      billNote = "دفعة حساب";
      noteText = `دفعة نقدية (${currency === 'USD' ? '$' + val : fmt(val) + ' L.L.'})`;
  }
  const transactionBill = {
      time: new Date().toLocaleString('ar-LB'),
      total: finalTotal,
      note: billNote,
      customName: currentStatementCustomer,
      items: [{ name: noteText, price: finalTotal, count: 1, unitPrice: finalTotal }]
  };
  savedBills.push(transactionBill);
  saveData();
  showToast(isAddingDebtTransaction ? "تم تسجيل الدين" : "تم تسجيل الدفعة");
  goBackModalBtn();
  openCustomerStatement(currentStatementCustomer);
}

async function clearCustomerDebt() {
  if (!currentStatementCustomer) return;
  if (await confirmModal(`تصفية حساب "${currentStatementCustomer}"؟`)) {
      savedBills = savedBills.filter(b => b.customName !== currentStatementCustomer);
      saveData();
      showToast("تم تصفية الحساب");
      openCustomerStatement(currentStatementCustomer);
  }
}

function openSavedBills() { 
  checkSettingsPassword(() => { 
      selectionMode.bill = false;
      selectedItems.bill.clear();
      renderBillsList(); 
      showModal('bills-modal'); 
  }); 
}

function renderBillsList() {
  const list = getEl('saved-bills-list'); list.innerHTML = '';
  
  getEl('btn-bill-select-mode').style.display = selectionMode.bill ? 'none' : 'flex';
  getEl('bill-selection-bar').style.display = selectionMode.bill ? 'grid' : 'none';
  list.className = selectionMode.bill ? 'showing-checks' : '';

  if (savedBills.length === 0) { list.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8; font-weight:bold;">السجل فارغ</div>'; return; }
  
  [...savedBills].reverse().forEach((bill, reversedIndex) => {
      const originalIndex = savedBills.length - 1 - reversedIndex;
      const div = document.createElement('div'); div.className = 'bill-row';
      
      const isPay = bill.total < 0; 
      const isDebt = bill.note === "دين نقدي (كاش)";
      
      let htmlContent = '';
      if(selectionMode.bill) {
           const isSel = selectedItems.bill.has(originalIndex);
           htmlContent += `<input type="checkbox" class="chk-select" ${isSel?'checked':''} onchange="toggleItemSelection('bill', ${originalIndex}, this)">`;
      }
      
      htmlContent += `<div style="flex:1"><div style="display:flex; justify-content:space-between; align-items:center; pointer-events: none;"><span style="font-weight:900; color:#1e293b;">#${savedBills.length - reversedIndex}</span><span style="font-size:12px; color:#64748b; font-weight:600;">${bill.time.split(',')[1] || bill.time}</span></div>`;
      if (bill.customName) { htmlContent += `<div class="bill-note" style="pointer-events: none; background:${isPay?'#10b981':(isDebt?'#ef4444':'#3b82f6')}">${bill.customName}</div>`; } 
      else if (bill.note) { htmlContent += `<div style="font-size:12px; color:#3b82f6; margin-top:4px; pointer-events: none; font-weight:bold;">${bill.note}</div>`; }
      htmlContent += `<div style="text-align:left; font-weight:900; color:${isPay?'#10b981':(isDebt?'#ef4444':'#f59e0b')}; margin-top:6px; pointer-events: none; font-size:14px;">${fmt(bill.total)} L.L.</div></div>`;
      
      div.innerHTML = htmlContent; 
      setupBillInteraction(div, originalIndex); 
      list.appendChild(div);
  });
  
  if(!selectionMode.bill) {
      const clearBtn = document.createElement('button'); clearBtn.className = 'btn-clear-history'; clearBtn.innerHTML = 'مسح السجل بالكامل (عام)'; clearBtn.onclick = clearAllHistory; list.appendChild(clearBtn);
  }
}

function setupBillInteraction(element, index) {
  let timer; let startX, startY; let isScrolling = false; let isLongPress = false;
  element.addEventListener('mousedown', (e) => { 
      if(selectionMode.bill || e.target.type === 'checkbox') return;
      timer = setTimeout(() => { isLongPress = true; confirmDeleteBill(index); }, 600); 
  });
  element.addEventListener('mouseup', (e) => { 
      clearTimeout(timer); 
      if(selectionMode.bill || e.target.type === 'checkbox') return;
      if (!isLongPress) showBillDetails(index); 
      isLongPress = false; 
  });
  element.addEventListener('touchstart', (e) => { 
      if(selectionMode.bill || e.target.type === 'checkbox') return;
      startX = e.touches[0].clientX; startY = e.touches[0].clientY; isScrolling = false; isLongPress = false; 
      timer = setTimeout(() => { if (!isScrolling) { isLongPress = true; if(navigator.vibrate) navigator.vibrate(40); confirmDeleteBill(index); } }, 600); 
  }, {passive: true});
  element.addEventListener('touchmove', (e) => { if (Math.abs(e.touches[0].clientX - startX) > 10 || Math.abs(e.touches[0].clientY - startY) > 10) { isScrolling = true; clearTimeout(timer); } }, {passive: true});
  element.addEventListener('touchend', (e) => { 
      clearTimeout(timer); 
      if(selectionMode.bill || e.target.type === 'checkbox') return;
      if (!isScrolling && !isLongPress) showBillDetails(index); 
  });
}

function toggleSelectionMode(type) {
  selectionMode[type] = !selectionMode[type];
  selectedItems[type].clear();
  if(type === 'bill') renderBillsList();
  else renderCustomerList('manage');
}

function toggleItemSelection(type, id, checkbox) {
  if(checkbox.checked) selectedItems[type].add(id);
  else selectedItems[type].delete(id);
}

function selectAllItems(type) {
  if(type === 'bill') {
      savedBills.forEach((_, idx) => selectedItems.bill.add(idx));
      renderBillsList();
  } else {
      customers.forEach(cust => selectedItems.customer.add(cust.name));
      renderCustomerList('manage');
  }
}

async function deleteSelectedItems(type) {
  if(selectedItems[type].size === 0) return showToast("لم يتم تحديد شيء");
  
  if(await confirmModal(`هل أنت متأكد من حذف ${selectedItems[type].size} عنصر؟`)) {
      if(type === 'bill') {
          const ids = Array.from(selectedItems[type]).sort((a,b)=>b-a);
          ids.forEach(idx => savedBills.splice(idx, 1));
          saveData();
          selectedItems.bill.clear();
          renderBillsList();
      } else {
          const namesToDelete = Array.from(selectedItems.customer);
          customers = customers.filter(c => !namesToDelete.includes(c.name));
          saveData();
          selectedItems.customer.clear();
          renderCustomerList('manage');
      }
      showToast("تم الحذف");
  }
}

async function confirmDeleteBill(index) { 
  if (await confirmModal("حذف هذه الفاتورة؟")) { 
      savedBills.splice(index, 1); 
      saveData(); 
      renderBillsList();
  } 
}

function showBillDetails(index) {
  currentViewedBillIndex = index; 
  const bill = savedBills[index]; 
  const container = getEl('bill-items-container'); 
  container.innerHTML = '';
  
  let detailsHtml = '<div style="position:relative;">';
  detailsHtml += '<div style="text-align:center; margin-bottom:15px; border-bottom:1px dashed #cbd5e1; padding-bottom:12px;"><div style="font-size:18px; font-weight:900; color:#0f172a;">فاتورة</div><div style="font-size:13px; font-weight:bold; color:#64748b; margin-top:6px;">' + bill.time + '</div></div>';

  let hasCustData = bill.customName || bill.custAddress || bill.custPhone;
  let custNoteHTML = bill.note && bill.note !== "دين نقدي (كاش)" && bill.note !== "دفعة حساب" ? ('<tr><td style="color:#64748b; padding:6px 0; width:60px;">ملاحظة:</td><td style="font-weight:900; padding:6px 0; color:#1e293b;">' + bill.note + '</td></tr>') : '';

  if (hasCustData || custNoteHTML !== '') {
      detailsHtml += '<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:12px; margin-bottom:16px;"><div style="font-size:12px; font-weight:800; color:#94a3b8; margin-bottom:10px;">بيانات الزبون</div><table style="width:100%; font-size:14px; border-collapse:collapse; text-align:right;">';
      if (bill.customName) detailsHtml += '<tr><td style="color:#64748b; padding:6px 0; width:60px;">الاسم:</td><td style="font-weight:900; padding:6px 0; color:#1e293b;">' + bill.customName + '</td></tr>';
      if (bill.custAddress) detailsHtml += '<tr><td style="color:#64748b; padding:6px 0; width:60px;">العنوان:</td><td style="font-weight:900; padding:6px 0; color:#1e293b;">' + bill.custAddress + '</td></tr>';
      if (bill.custPhone) detailsHtml += '<tr><td style="color:#64748b; padding:6px 0; width:60px;">الهاتف:</td><td style="font-weight:900; padding:6px 0; color:#1e293b;">' + bill.custPhone + '</td></tr>';
      detailsHtml += custNoteHTML;
      detailsHtml += '</table></div>';
  }

  detailsHtml += '<table style="width:100%; font-size:13px; border-collapse:collapse; margin-bottom:16px; text-align:right;"><tr style="border-bottom:2px solid #e2e8f0; color:#64748b;"><th style="padding:10px 4px;">الصنف</th><th style="padding:10px 4px; text-align:center;">الكمية</th><th style="padding:10px 4px; text-align:left;">الإجمالي</th></tr>';
  
  const itemsList = Array.isArray(bill.items) ? bill.items : Object.values(bill.items);
  itemsList.forEach(item => { 
      detailsHtml += '<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:12px 4px; font-weight:800; color:#1e293b;">' + item.name + '</td><td style="padding:12px 4px; text-align:center; color:#ef4444; font-weight:900;">' + item.count + '</td><td style="padding:12px 4px; text-align:left; font-weight:800; color:#1e293b;">' + fmt(item.price) + '</td></tr>'; 
  });
  
  detailsHtml += '</table>'; 
  detailsHtml += '<div style="border-top:2px dashed #cbd5e1; padding-top:16px;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"><span style="color:#64748b; font-size:14px; font-weight:800;">المجموع</span><span style="font-weight:900; color:#ef4444; font-size:18px;">.L.L ' + fmt(bill.total) + '</span></div><div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:#94a3b8; font-size:12px; font-weight:700;">بالدولار</span><span style="font-weight:900; color:#10b981; font-size:15px;">$' + (bill.total/rate).toFixed(2) + '</span></div></div></div>';
  
  container.innerHTML = detailsHtml; 
  showModal('bill-details-modal');
}

async function clearAllHistory() { 
  if (await confirmModal("مسح سجل الفواتير العامة؟ (ملاحظة: الديون لن تُحذف)")) { 
      savedBills = savedBills.filter(b => b.customName && b.customName.trim() !== "");
      saveData(); 
      showToast("تم مسح السجل العام");
      renderBillsList(); 
  } 
}

async function clearDailyReport() {
  if (await confirmModal("تصفير العداد وبدء شيفت جديد؟")) {
      const today = new Date().toLocaleDateString('ar-LB');
      const standardDate = new Date().toLocaleDateString();
      savedBills = savedBills.filter(b => {
          const isToday = b.time.includes(today) || b.time.includes(standardDate);
          const hasCustomer = b.customName && b.customName !== "";
          return !isToday || hasCustomer;
      });
      saveData();
      showToast("تم بدء شيفت جديد");
      closeAllModals();
  }
}

function renderSectionsBar() {
    const bar = getEl('sections-bar');
    bar.innerHTML = '';
    sections.forEach((sec, index) => {
        const div = document.createElement('div');
        div.className = `sec-tab ${sec === currentSection ? 'active' : ''}`;
        
        // عرض الاسم سادة بدون إجبار إضافة كلمة "قسم"
        div.textContent = sec; 
        
        let timer; let startX, startY; let isScrolling = false; let isLongPress = false;
        
        const selectSection = () => {
            currentSection = sec; 
            renderItems();
        };

        const editSection = () => {
            promptModal(`تعديل اسم القسم (${sec}):`).then(newName => {
                if(newName && newName.trim() !== "" && newName !== sec) {
                    if(sections.includes(newName)) {
                        alertModal("يوجد قسم بهذا الاسم مسبقاً!");
                        return;
                    }
                    // تحديث المصفوفة بالاسم الجديد
                    sections[index] = newName;
                    // نقل داتا الأصناف للمفتاح الجديد وحذف القديم
                    itemData[newName] = itemData[sec];
                    delete itemData[sec];
                    // إذا كنا واقفين على نفس القسم، نحدّث المؤشر
                    if(currentSection === sec) currentSection = newName;
                    
                    saveData();
                    renderItems();
                    showToast("تم تعديل الاسم بنجاح");
                }
            });
        };

        // منع قائمة الكليك اليمين
        div.oncontextmenu = function(e) { e.preventDefault(); return false; };

        // أحداث الماوس
        div.addEventListener('mousedown', (e) => { 
            if(e.button === 2) return; 
            isLongPress = false;
            isScrolling = false;
            timer = setTimeout(() => { isLongPress = true; vibrate(div); editSection(); }, 600); 
        });
        div.addEventListener('mouseup', (e) => { 
            clearTimeout(timer); 
            if(e.button === 2) return;
            if (!isLongPress && !isScrolling) selectSection();
            isLongPress = false; 
        });

        // أحداث اللمس (موبايل)
        div.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX; 
            startY = e.touches[0].clientY; 
            isScrolling = false; 
            isLongPress = false;
            timer = setTimeout(() => { 
                if (!isScrolling) { 
                    isLongPress = true; 
                    vibrate(div);
                    editSection(); 
                } 
            }, 600); 
        });
        div.addEventListener('touchmove', (e) => { 
            const moveX = Math.abs(e.touches[0].clientX - startX); 
            const moveY = Math.abs(e.touches[0].clientY - startY); 
            if (moveX > 15 || moveY > 15) { 
                isScrolling = true; 
                clearTimeout(timer); 
            } 
        });
        div.addEventListener('touchend', (e) => { 
            clearTimeout(timer); 
            if(e.cancelable && (isScrolling || isLongPress)) e.preventDefault(); 
            if (!isScrolling && !isLongPress) selectSection();
        });

        bar.appendChild(div);
    });
    
    const addBtn = document.createElement('div');
    addBtn.className = 'sec-tab sec-add';
    addBtn.innerHTML = '+';
    addBtn.onclick = () => {
        promptModal("أدخل اسم القسم الجديد:").then(name => {
            if(name && name.trim() !== "") {
                if(!sections.includes(name)) {
                    sections.push(name);
                    itemData[name] = createEmptySection();
                    currentSection = name;
                    saveData();
                    renderItems();
                } else {
                    alertModal("يوجد قسم بهذا الاسم مسبقاً!");
                }
            }
        });
    };
    bar.appendChild(addBtn);
}

function renderItems() { 
  renderSectionsBar();
  ['col1','col2','col3','col4','col5'].forEach(colKey => { 
      const colEl = getEl(colKey); colEl.innerHTML = ''; 
      if (!itemData[currentSection][colKey]) itemData[currentSection][colKey] = Array(6).fill(null);
      const colData = itemData[currentSection][colKey];
      for (let i = 0; i < 6; i++) {
          const item = colData[i];
          const btn = document.createElement('button'); 
          
          if(item && item.name) { 
              btn.className = 'btn'; 
              btn.innerHTML = `<span class="btn-text">${item.name}</span>`; 
              if (item.color) btn.style.borderLeftColor = item.color; 
          } else {
              btn.className = 'btn empty-slot';
              btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
          }
          
          setupSmartButton(btn, colKey, i, item); 
          colEl.appendChild(btn); 
      }
  }); 
  getEl('rate-display').textContent = `سعر الصرف: ${fmt(rate)}`; 
}

function setupSmartButton(btn, colKey, index, item) {
  let timer; let startX, startY; let isScrolling = false; let isLongPress = false;
  const actionEdit = () => checkSettingsPassword(() => openEditModal(colKey, index));
  
  // منع القوائم الافتراضية 
  btn.oncontextmenu = function(e) { e.preventDefault(); return false; };

  btn.addEventListener('mousedown', (e) => { 
      if(e.button === 2) return; 
      vibrate(btn);
      isLongPress = false;
      isScrolling = false;
      timer = setTimeout(() => { isLongPress = true; if(!sortMode) actionEdit(); }, 600); 
  });

  btn.addEventListener('mouseup', (e) => { 
      clearTimeout(timer); 
      if(e.button === 2) return;
      if (!isLongPress && !isScrolling) { 
          if (sortMode) {
              handleSortSelection(colKey, index, btn); 
          } else {
              // منع الاستجابة للضغطة السريعة إذا كان المربع فارغاً
              if (item && item.name) {
                  add(item.name, item.price || 0);
              }
          }
      } 
      isLongPress = false; 
  });

  // إزالة passive: true لنتمكن من إيقاف الـ Ghost Click عبر preventDefault
  btn.addEventListener('touchstart', (e) => {
      vibrate(btn);
      startX = e.touches[0].clientX; 
      startY = e.touches[0].clientY; 
      isScrolling = false; 
      isLongPress = false;
      timer = setTimeout(() => { 
          if (!isScrolling) { 
              isLongPress = true; 
              if(!sortMode) actionEdit(); 
          } 
      }, 600); 
  });

  btn.addEventListener('touchmove', (e) => { 
      const moveX = Math.abs(e.touches[0].clientX - startX); 
      const moveY = Math.abs(e.touches[0].clientY - startY); 
      if (moveX > 30 || moveY > 30) { 
          isScrolling = true; 
          clearTimeout(timer); 
      } 
  });

  btn.addEventListener('touchend', (e) => { 
      clearTimeout(timer); 
      
      // إيقاف الـ Ghost Click الذي ينفذ ضغطة وهمية بعد رفع الإصبع
      if(e.cancelable) e.preventDefault(); 
      
      if (isScrolling || isLongPress) {
          return; 
      }
      
      if (sortMode) {
          handleSortSelection(colKey, index, btn); 
      } else {
          // التفاعل فقط إذا كان المربع يحتوي على صنف معرف مسبقاً
          if (item && item.name) {
              add(item.name, item.price || 0);
          }
      }
  });
}

function press(num) { vibrate(event.target); if(enteredNum === '0') enteredNum = ''; enteredNum += num; updateInputDisplay(); }
function updateInputDisplay() { getEl('input-box').textContent = enteredNum || '0'; }
function clearInput() { enteredNum = ''; customPriceMode = false; getEl('input-box').style.background = '#fff'; getEl('input-box').style.borderColor = '#e2e8f0'; updateInputDisplay(); }
function activatePrice() { vibrate(event.target); customPriceMode = true; getEl('input-box').style.background = '#fff9c4'; getEl('input-box').style.borderColor = '#fbc02d'; updateInputDisplay(); }

function add(name, defaultPrice) { 
  let finalPrice = defaultPrice; 
  let qty = 1; 
  if (customPriceMode) { 
      if (enteredNum && enteredNum !== '0') finalPrice = parseFloat(enteredNum); 
  } else { 
      if (enteredNum && enteredNum !== '0') qty = parseFloat(enteredNum); 
  } 
  total += (finalPrice * qty); 
  const isCustom = (finalPrice !== defaultPrice); 
  const key = name + (isCustom ? '_' + Date.now() : ''); 
  if(!receiptData[key]) receiptData[key] = {name:name, price:0, count:0, unitPrice: finalPrice}; 
  receiptData[key].price += (finalPrice * qty); 
  receiptData[key].count += qty; 
  enteredNum = ''; 
  customPriceMode = false; 
  getEl('input-box').style.background = '#fff'; 
  getEl('input-box').style.borderColor = '#e2e8f0'; 
  updateInputDisplay(); 
  updateTotal(); 
  renderReceipt(); 
}

function updateTotal() { getEl('total-lbp').textContent = `المجموع: ${fmt(total)}`; getEl('total-usd').textContent = `$${(total/rate).toFixed(2)}`; const count = Object.values(receiptData).reduce((a,b)=>a+b.count,0); getEl('total-items').textContent = `عدد الأصناف: ${count}`; }

function toggleReceipt() { 
    const box = getEl('receipt'); 
    if(box.classList.contains('show')) {
        window.history.back();
    } else {
        box.classList.add('show'); 
        window.history.pushState({ receipt: true }, "");
        renderReceipt(); 
    }
}

function searchCartCustomer(term) {
  custNameInput = term;
  const resDiv = getEl('cart-cust-dropdown');
  if(!term) { resDiv.style.display = 'none'; return; }
  const matches = customers.filter(c => c.name.includes(term));
  if(matches.length === 0) { resDiv.style.display = 'none'; return; }
  let html = '';
  matches.forEach(m => {
      html += '<div style="padding:10px; border-bottom:1px solid #f1f5f9; font-size:13px; font-weight:700; cursor:pointer;" onclick="selectCartCustomer(\'' + m.name + '\', \'' + m.address + '\', \'' + m.phone + '\')">' + m.name + '</div>';
  });
  resDiv.innerHTML = html;
  resDiv.style.display = 'block';
}

function selectCartCustomer(n, a, p) {
  custNameInput = n; 
  custAddressInput = a; 
  custPhoneInput = p;
  renderReceipt();
}

function renderReceipt() { 
  const box = getEl('receipt'); 
  let html = '<div style="text-align:center;border-bottom:2px solid #f1f5f9;padding-bottom:10px;font-weight:900;margin-bottom:10px;color:#0f172a;font-size:16px;">قائمة الطلبات</div><div id="receipt-items-list" style="flex:1;overflow-y:auto;margin-bottom:12px;">'; 
  for(const [key, item] of Object.entries(receiptData)) { 
      html += '<div style="padding:8px 0; border-bottom:1px dashed #e2e8f0; display:flex; justify-content:space-between; font-size:13px; font-weight:700; cursor:pointer; color:#334155;" onclick="removeItem(\'' + key + '\', ' + item.price + ')"><div><span>' + item.name + '</span>' + (item.count > 1 ? '<span style="color:#ef4444;font-weight:900;margin-right:5px;">x' + item.count + '</span>' : '') + '<div style="font-size:11px;color:#94a3b8;font-weight:600;">' + fmt(item.unitPrice) + '</div></div><span style="font-weight:900;color:#1e293b;">' + fmt(item.price) + '</span></div>'; 
  } 
  html += '</div>'; 
  if(box.classList.contains('show')) { 
      html += '<div style="border-top:2px solid #e2e8f0; padding-top:12px;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;"><span style="font-weight:900; font-size:15px; color:#334155;">المجموع:</span><span style="font-weight:900; font-size:17px; color:#ef4444">' + fmt(total) + '</span></div><div style="display:flex; justify-content:space-between; align-items:center;"><span style="font-size:13px; color:#64748b; font-weight:700;">بالدولار:</span><span style="font-weight:900; font-size:15px; color:#10b981; font-family:sans-serif;">$' + (total/rate).toFixed(2) + '</span></div></div>';
      html += '<div style="font-size:13px; margin-top:16px; font-weight:900; color:#0f172a; border-bottom:2px solid #f1f5f9; padding-bottom:8px; margin-bottom:10px;">بيانات الزبون:</div>';
      
      html += '<div style="position:relative;">';
      html += '<input id="receipt-cust-name" type="text" oninput="searchCartCustomer(this.value)" value="' + custNameInput + '" placeholder="الاسم" style="width:100%; border:1px solid #cbd5e1; padding:10px; font-size:13px; font-family:inherit; font-weight:700; margin-bottom:8px; border-radius:10px; background:#f8fafc;">';
      html += '<div id="cart-cust-dropdown" style="display:none; position:absolute; top:42px; right:0; width:100%; background:#fff; border:1px solid #e2e8f0; border-radius:10px; box-shadow:0 4px 15px rgba(0,0,0,0.1); z-index:10; max-height:140px; overflow-y:auto;"></div>';
      html += '</div>';

      html += '<input id="receipt-cust-address" type="text" oninput="custAddressInput=this.value" value="' + custAddressInput + '" placeholder="العنوان" style="width:100%; border:1px solid #cbd5e1; padding:10px; font-size:13px; font-family:inherit; font-weight:700; margin-bottom:8px; border-radius:10px; background:#f8fafc;">';
      html += '<input id="receipt-cust-phone" type="text" oninput="custPhoneInput=this.value" value="' + custPhoneInput + '" placeholder="رقم الهاتف" style="width:100%; border:1px solid #cbd5e1; padding:10px; font-size:13px; font-family:inherit; font-weight:700; border-radius:10px; background:#f8fafc;">';
  } 
  box.innerHTML = html; 
  const list = document.getElementById('receipt-items-list'); 
  if(list) list.scrollTop = list.scrollHeight; 
}

async function removeItem(key, price) { if(await confirmModal("حذف هذا الصنف؟")) { total -= price; delete receiptData[key]; updateTotal(); renderReceipt(); } }

async function executeSaveBill(selectedName) {
  if(total===0) return alertModal("الفاتورة فارغة");
  
  // إذا اختار اسم زبون نستخدمه، وإلا نستخدم الاسم الفارغ (للفاتورة العامة)
  let finalName = selectedName || custNameInput;
  let finalAddress = custAddressInput;
  let finalPhone = custPhoneInput;

  if (selectedName) {
      const foundCust = customers.find(c => c.name === selectedName);
      if (foundCust) {
          finalAddress = foundCust.address || custAddressInput;
          finalPhone = foundCust.phone || custPhoneInput;
      }
  }

  savedBills.push({ 
      time: new Date().toLocaleString('ar-LB'), 
      total: total, 
      customName: finalName, 
      custAddress: finalAddress,
      custPhone: finalPhone,
      items: JSON.parse(JSON.stringify(receiptData)) 
  });
  saveData();
  reset(); 
  showToast(selectedName ? `تم تسجيل الفاتورة على حساب: ${selectedName}` : `تم الحفظ كفاتورة عامة`);
}

function reset() { 
  if(typeof event !== 'undefined' && event) vibrate(event.target); 
  total = 0; 
  receiptData = {}; 
  custNameInput = ""; 
  custAddressInput = ""; 
  custPhoneInput = ""; 
  selectedCustomerForBill = null; 
  getEl('customer-display').style.display = 'none'; 
  clearInput(); 
  updateTotal(); 
  getEl('receipt').innerHTML=''; 
  getEl('receipt').classList.remove('show'); 
  closeAllModals(); 
}

function openPay() { 
  if(total===0) return alertModal("لا يوجد طلبات!"); 
  getEl('pay-usd').value=''; 
  getEl('pay-lbp').value=''; 
  getEl('returned-usd').value=''; 
  getEl('returned-lbp').value=''; 
  calcPay(); 
  showModal('pay-box-modal'); 
  setTimeout(() => { getEl('pay-usd').focus(); }, 100);
}

function calcPay() { 
  const pUsd = Number(getEl('pay-usd').value)||0; 
  const pLbp = Number(getEl('pay-lbp').value)||0; 
  const rUsd = Number(getEl('returned-usd').value)||0; 
  const rLbp = Number(getEl('returned-lbp').value)||0; 
  const totalGiven = (pUsd * rate) + pLbp;
  const totalReturned = (rUsd * rate) + rLbp;
  const netPaid = totalGiven - totalReturned;
  const diff = total - netPaid;
  const statusEl = getEl('pay-status-msg');
  const displayEl = getEl('pay-balance-display');
  
  if (Math.abs(diff) < 500) {
      statusEl.textContent = "خالص (Balanced)";
      statusEl.style.color = "#10b981";
      displayEl.value = "0 L.L.";
      displayEl.style.background = "#f1f5f9";
      displayEl.style.color = "#10b981";
  } else if (diff > 0) {
      statusEl.textContent = "باقي عليه (Remaining):";
      statusEl.style.color = "#ef4444";
      displayEl.value = fmt(Math.ceil(diff/500)*500) + " L.L.";
      displayEl.style.background = "#fff0f0";
      displayEl.style.color = "#ef4444";
  } else {
      statusEl.textContent = "باقي للزبون (Change Due):";
      statusEl.style.color = "#10b981";
      displayEl.value = fmt(Math.abs(Math.round(diff/500)*500)) + " L.L.";
      displayEl.style.background = "#e8f5e9";
      displayEl.style.color = "#10b981";
  }
}

async function checkSettingsPassword(callback) { if(!settingsPassword) return callback(); const p = await promptModal("كلمة المرور:", true); if(p === settingsPassword) callback(); else if(p !== null) alertModal("كلمة المرور خاطئة"); }

async function managePassword() { 
  closeSettingsMenuBtn();
  if(settingsPassword) { 
      const p = await promptModal("كلمة المرور الحالية:", true); 
      if(p === settingsPassword) { 
          localStorage.removeItem('settingsPassword'); 
          settingsPassword = null; 
          await alertModal("تم إلغاء الحماية"); 
          updatePassBtn();
      } else if(p !== null) { 
          await alertModal("خطأ بالرمز"); 
      } 
  } else { 
      const newP = await promptModal("كلمة مرور جديدة:", true); 
      if(newP) { 
          localStorage.setItem('settingsPassword', newP); 
          settingsPassword = newP; 
          await alertModal("تمت الحماية"); 
          updatePassBtn();
      } 
  } 
}

function updatePassBtn() { 
  const btnTxt = getEl('lock-btn-txt'); 
  if(btnTxt) {
      btnTxt.textContent = settingsPassword ? "إلغاء قفل التطبيق" : "تعيين قفل للتطبيق";
  }
}

function toggleSortMode() { sortMode = !sortMode; sortFirstSelection = null; getEl('sort-indicator').style.display = sortMode ? 'flex' : 'none'; if(sortMode) renderItems(); }
function handleSortSelection(col, index, btn) { 
    vibrate(btn); 
    if (!sortFirstSelection) { 
        sortFirstSelection = {col, index}; btn.classList.add('sorting-selected'); 
    } else { 
        const s1 = sortFirstSelection; 
        const temp = itemData[currentSection][s1.col][s1.index]; 
        itemData[currentSection][s1.col][s1.index] = itemData[currentSection][col][index]; 
        itemData[currentSection][col][index] = temp; 
        sortFirstSelection = null; 
        saveData(); 
    } 
}

function openEditModal(col, idx) { 
    currentEditCol = col; currentEditIndex = idx; 
    const item = itemData[currentSection][col][idx]; 
    getEl('edit-name').value = item ? item.name : ''; 
    getEl('edit-price').value = item ? item.price : ''; 
    getEl('edit-modal-title').textContent = (item && item.name) ? "تعديل صنف" : "إضافة صنف";
    showModal('edit-modal'); 
    setTimeout(() => getEl('edit-name').focus(), 100);
}

function saveItemEdit() { 
    const name = getEl('edit-name').value.trim(); 
    const price = Number(getEl('edit-price').value) || 0; 
    if(!name) {
        itemData[currentSection][currentEditCol][currentEditIndex] = null;
    } else {
        itemData[currentSection][currentEditCol][currentEditIndex] = { name, price }; 
    }
    saveData(); goBackModalBtn(); 
}

async function deleteItem() { 
    itemData[currentSection][currentEditCol][currentEditIndex] = null; 
    saveData(); goBackModalBtn(); 
}

async function changeExchangeRate() { const val = await promptModal(`السعر الحالي: ${fmt(rate)}`, false); if(val && !isNaN(val)) { rate = parseFloat(val); saveData(); renderItems(); updateTotal(); } }

function showDailyReport() {
  const today = new Date().toLocaleDateString('ar-LB');
  const dayBills = savedBills.filter(b => b.time.includes(today) || b.time.includes(new Date().toLocaleDateString()));
  const totalCash = dayBills.reduce((a,b)=>a+b.total,0);
  const content = `<div style="text-align:center; padding:10px;"><div style="font-size:13px; color:#64748b; font-weight:700; margin-bottom:8px;">التاريخ: ${today}</div><div style="font-size:16px; font-weight:800; margin-bottom:15px; color:#1e293b;">عدد العمليات: ${dayBills.length}</div><div style="font-size:26px; font-weight:900; color:#10b981; margin-bottom:6px;">${fmt(totalCash)} L.L.</div><div style="font-size:14px; font-weight:700; color:#94a3b8;">($${(totalCash/rate).toFixed(2)})</div></div>`;
  getEl('daily-report-content').innerHTML = content;
  showModal('daily-report-modal');
}

function exportDataAndCopy() {
    const backupData = { itemData, sections, savedBills, customers, rate };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "mido_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    showToast("تم تنزيل ملف النسخة الاحتياطية");
}

function doCopy() {}

function openJsonImport() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput); // إضافة العنصر للصفحة ليسمح المتصفح بفتحه

    fileInput.onchange = e => {
        const file = e.target.files[0];
        if (!file) {
            document.body.removeChild(fileInput);
            return;
        }
        const reader = new FileReader();
        reader.onload = async event => {
            try {
                const imported = JSON.parse(event.target.result);
                // استيراد كافة البيانات (الأصناف، الأقسام، الفواتير، الزبائن، وسعر الصرف)
                if (imported.itemData) itemData = imported.itemData;
                if (imported.sections) sections = imported.sections;
                if (imported.savedBills) savedBills = imported.savedBills;
                if (imported.customers) customers = imported.customers;
                if (imported.rate) rate = imported.rate;
                
                saveData();
                renderItems();
                await alertModal("تم استيراد الملف بنجاح!");
            } catch (err) {
                await alertModal("الملف مضروب أو صيغته غلط");
            }
            document.body.removeChild(fileInput); // تنظيف الصفحة من الزر المخفي
        };
        reader.readAsText(file);
    };
    fileInput.click();
}

async function clearAllData() { 
    if(await confirmModal("حذف كل شيء نهائياً؟")) { 
        if (currentUid) {
            await db.collection('midoCashier').doc(currentUid).delete();
        }
        localStorage.clear(); 
        location.reload(); 
    } 
}

function alertModal(msg) { 
    getEl('alert-msg').innerHTML = msg; showModal('custom-alert'); 
    return new Promise(r => { 
        getEl('alert-ok').onclick = () => { goBackModalBtn(); r(); }; 
        getEl('custom-alert').onclick = (e) => { if(e.target === getEl('custom-alert')) { closeAllModals(); r(); } }; 
    }); 
}
function confirmModal(msg) { 
    getEl('confirm-msg').innerHTML = msg; showModal('custom-confirm'); 
    return new Promise(r => { 
        getEl('confirm-yes').onclick = () => { goBackModalBtn(); r(true); }; 
        getEl('confirm-no').onclick = () => { goBackModalBtn(); r(false); }; 
        getEl('custom-confirm').onclick = (e) => { if(e.target === getEl('custom-confirm')) { closeAllModals(); r(false); } }; 
    }); 
}
function promptModal(msg, isPass) { 
    getEl('prompt-msg').innerHTML = msg; const inp = getEl('prompt-input'); inp.value=''; inp.type=isPass?'password':'text'; showModal('custom-prompt'); setTimeout(()=>inp.focus(),100); 
    return new Promise(r => { 
        getEl('prompt-ok').onclick = () => { goBackModalBtn(); r(inp.value); }; 
        getEl('prompt-cancel').onclick = () => { goBackModalBtn(); r(null); }; 
        getEl('custom-prompt').onclick = (e) => { if(e.target === getEl('custom-prompt')) { closeAllModals(); r(null); } }; 
    }); 
}

let selectedBillOriginalIndex = null;

function openBillActionMenu(originalIndex) {
    selectedBillOriginalIndex = originalIndex;
    showModal('bill-action-modal');
}

async function deleteSpecificBill() {
    if (selectedBillOriginalIndex !== null) {
        if (await confirmModal("هل أنت متأكد من حذف هذه العملية من الحساب؟")) {
            savedBills.splice(selectedBillOriginalIndex, 1);
            saveData();
            
            goBackModalBtn(); // إغلاق نافذة الخيارات بعد الحذف
            
            // تحديث نافذة كشف الحساب مباشرة
            setTimeout(() => {
                openCustomerStatement(currentStatementCustomer);
            }, 100);
            
            showToast("تم الحذف بنجاح");
        }
    }
}

async function generateBillCanvas() {
    if (selectedBillOriginalIndex === null) return null;
    const billCard = document.getElementById(`bill-card-${selectedBillOriginalIndex}`);
    if (!billCard) return null;
    
    const clone = billCard.cloneNode(true);
    clone.style.position = 'fixed';
    clone.style.top = '0';
    clone.style.right = '0';
    clone.style.width = '350px'; 
    clone.style.margin = '0'; 
    clone.style.padding = '15px'; 
    clone.style.background = '#ffffff'; 
    clone.style.zIndex = '-9999'; 
    clone.setAttribute('dir', 'rtl'); 
    
    const header = document.createElement('div');
    header.innerHTML = `<div style="text-align:center; font-weight:900; color:#0d47a1; margin-bottom:12px; font-size:16px; border-bottom:2px solid #e2e8f0; padding-bottom:8px;">فاتورة حساب - ${currentStatementCustomer}</div>`;
    clone.insertBefore(header, clone.firstChild);

    document.body.appendChild(clone);
    
    try {
        const canvas = await html2canvas(clone, { 
            scale: 3, 
            backgroundColor: "#ffffff",
            useCORS: true,
            logging: false
        });
        if (document.body.contains(clone)) document.body.removeChild(clone);
        return canvas;
    } catch (err) {
        if (document.body.contains(clone)) document.body.removeChild(clone);
        return null;
    }
}

async function downloadBillAsImage() {
    showToast("جاري تجهيز الفاتورة...");
    const canvas = await generateBillCanvas();
    if (!canvas) {
        showToast("حدث خطأ أثناء استخراج الصورة");
        return;
    }
    
    const link = document.createElement('a');
    link.download = `فاتورة_${currentStatementCustomer}_رقم_${selectedBillOriginalIndex}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    
    goBackModalBtn();
    showToast("تم تنزيل الفاتورة كصورة بنجاح");
}

async function shareBillAsImage() {
    showToast("جاري تجهيز الفاتورة للمشاركة...");
    const canvas = await generateBillCanvas();
    if (!canvas) {
        showToast("حدث خطأ أثناء استخراج الصورة");
        return;
    }
    
    canvas.toBlob(async (blob) => {
        if (!blob) {
            showToast("حدث خطأ أثناء توليد الصورة");
            return;
        }
        const file = new File([blob], `فاتورة_${currentStatementCustomer}.png`, { type: "image/png" });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: "مشاركة الفاتورة",
                    text: `فاتورة حساب - ${currentStatementCustomer}`
                });
                goBackModalBtn();
            } catch (error) {
                console.log("تم الإلغاء أو حدث خطأ", error);
            }
        } else {
            showToast("متصفحك لا يدعم المشاركة المباشرة للصور");
        }
    }, "image/png");
}

window.onload = () => {
    renderItems();
    // إجبار كل النوافذ على الإغلاق الكامل عند الضغط بالخارج (تجاوز للـ HTML)
    document.querySelectorAll('.custom-modal').forEach(modal => {
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeAllModals();
            }
        };
    });
};
