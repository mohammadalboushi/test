import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBB_U4C880PW4GxZd8FALv8yBSiP2mNeBY",
    authDomain: "malaboushi.firebaseapp.com",
    databaseURL: "https://malaboushi-default-rtdb.firebaseio.com/",
    projectId: "malaboushi",
    storageBucket: "malaboushi.firebasestorage.app",
    messagingSenderId: "110336819350",
    appId: "1:110336819350:web:2b1b0488e72b811f0602b7"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let RATE = 89000; // غيرناها من const لـ let لنقدر نعدلها
let menuItems = [];
let cart = [];
let currentItemToCustomize = null;
let currentKiloItem = null;
let storePhone = "96170359935"; 

// جلب الإعدادات (أرقام التواصل وسعر الصرف)
onValue(ref(db, 'settings/contact'), (snapshot) => {
    const contact = snapshot.val();
    if (contact) {
        storePhone = contact.whatsapp || "96170359935"; 
        const waBtn = document.getElementById('waLinkBtn');
        const phBtn = document.getElementById('phoneLinkBtn');
        if(waBtn) waBtn.href = `https://wa.me/${storePhone}`;
        if(phBtn) phBtn.href = `tel:${contact.phone || '01382472'}`;
        
        if (contact.rate && contact.rate !== RATE) {
            RATE = contact.rate;
            // إعادة عرض المنيو والسلة لتحديث الأسعار بالدولار فوراً
            if (menuItems.length > 0) renderMenu();
            if (cart.length > 0) updateCartUI();
        }
    }
});

// جلب الداتا من فايربيس (مع الترتيب)
onValue(ref(db, 'menuItems'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        menuItems = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        }));
        // ترتيب العناصر بناءً على الحقل order اللي تعدل بالأدمن
        menuItems.sort((a, b) => (a.order || 0) - (b.order || 0));
        renderMenu();
    } else {
        document.getElementById("sandwichesContainer").innerHTML = '<p style="text-align:center;width:100%;">جاري تحميل المنيو...</p>';
    }
});

// ===== RENDER =====
function renderMenu() {
  const sandContainer  = document.getElementById("sandwichesContainer");
  const kiloContainer  = document.getElementById("kiloContainer");
  const drinksContainer = document.getElementById("drinksContainer");

  if(sandContainer) sandContainer.innerHTML = menuItems.filter(i=>i.type==='sandwich').map(item=>{
    const usd = (item.price/RATE).toFixed(2);
    const badge = item.badge ? `<div class="product-badge">⭐ ${item.badge}</div>` : '';
    return `
      <div class="product">
        <div class="product-img-wrap">
          <img src="${item.img || 'https://midomido.neocities.org/bastermaa.jpg'}" alt="${item.name}" loading="lazy">
          ${badge}
        </div>
        <div class="product-body">
          <h3>${item.name}</h3>
          <div class="price-box">
            <span class="price-lbp">${item.price.toLocaleString('en-US')} ل.ل</span>
            <span class="price-usd">$${usd}</span>
          </div>
          <button class="add-btn" onclick="prepareOrder('${item.id}')">
            <i class="fa-solid fa-sliders"></i> اطلب وعدّل
          </button>
        </div>
      </div>`;
  }).join('');

  if(kiloContainer) kiloContainer.innerHTML = menuItems.filter(i=>i.type==='kilo').map(item=>{
    const usd = (item.price/RATE).toFixed(2);
    return `
      <div class="kilo-card">
        <div class="kilo-icon">${item.icon||'⚖️'}</div>
        <h3>${item.name}</h3>
        <div class="price-box" style="width:100%;">
          <span class="price-lbp">${item.price.toLocaleString('en-US')} ل.ل / كيلو</span>
          <span class="price-usd">$${usd}</span>
        </div>
        <button class="add-btn" onclick="openWeightModal('${item.id}')">
          <i class="fa-solid fa-weight-scale"></i> حدد الوزن
        </button>
      </div>`;
  }).join('');

  if(drinksContainer) drinksContainer.innerHTML = menuItems.filter(i=>i.type==='drink').map(item=>{
    const usd = (item.price/RATE).toFixed(2);
    return `
      <div class="product">
        <div class="product-img-wrap">
          <img src="${item.img || 'https://midomido.neocities.org/mido/%D8%A8%D9%8A%D8%A8%D8%B3%D9%8A.png'}" alt="${item.name}" loading="lazy">
        </div>
        <div class="product-body">
          <h3>${item.name}</h3>
          <div class="price-box">
            <span class="price-lbp">${item.price.toLocaleString('en-US')} ل.ل</span>
            <span class="price-usd">$${usd}</span>
          </div>
          <button class="add-btn" onclick="addToCartDirect('${item.id}')">
            <i class="fa-solid fa-circle-plus"></i> أضف للسلة
          </button>
        </div>
      </div>`;
  }).join('');
}

// ===== CART ANIMATION =====
function triggerCartAnimation() {
  const btn = document.querySelector('.cart-float');
  if(btn) {
    btn.classList.remove('cart-added-animation');
    void btn.offsetWidth;
    btn.classList.add('cart-added-animation');
    setTimeout(()=>btn.classList.remove('cart-added-animation'), 600);
  }
}

// ===== CLEAR CART =====
function openClearCartModal() {
  if(cart.length===0){ openModal('emptyAlertModal'); return; }
  openModal('clearCartModal');
}
function closeClearCartModal() { closeModal('clearCartModal'); }
function closeEmptyAlertModal() { closeModal('emptyAlertModal'); }
function confirmClearCart() { cart=[]; updateCartUI(); closeClearCartModal(); }

// ===== CART UI =====
function updateCartUI() {
  let totalItems = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
  document.getElementById("cartCount").innerText = totalItems;
  
  const cartItemsDiv = document.getElementById("cartItems");
  let totalLBP = 0;
  
  if(cart.length === 0){
    cartItemsDiv.innerHTML = `<div class="empty-cart"><i class="fa-solid fa-cart-shopping"></i><p>السلة فارغة 😕</p><p style="font-size:0.85em;color:#bbb;margin-top:5px;">أضف منتجات من القائمة</p></div>`;
  } else {
    cartItemsDiv.innerHTML = cart.map((item, index) => {
      let itemTotal = item.price * (item.qty || 1);
      totalLBP += itemTotal;
      let qtyText = item.qty > 1 ? `<span style="color:var(--red); font-weight:bold; margin-right:5px;">(x${item.qty})</span>` : '';
      
      return `
        <div class="cart-item">
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name} ${qtyText}</div>
            ${item.notes ? `<span class="cart-notes">${item.notes}</span>` : ''}
            <div class="cart-item-price">${itemTotal.toLocaleString()} ل.ل</div>
          </div>
          <div class="cart-item-remove" onclick="removeFromCart(${index})">
            <i class="fa-solid fa-xmark"></i>
          </div>
        </div>`;
    }).join('');
  }
  document.getElementById("cartTotalLBP").innerText = totalLBP.toLocaleString() + " ل.ل";
  document.getElementById("cartTotalUSD").innerText = "$" + (totalLBP/RATE).toFixed(2);
}

function removeFromCart(index) {
  if (cart[index].qty > 1) {
    cart[index].qty--;
  } else {
    cart.splice(index, 1);
  }
  updateCartUI();
}

function addItemToCart(newItem) {
  let existingItem = cart.find(item => item.name === newItem.name && item.notes === newItem.notes);
  if (existingItem) {
    existingItem.qty = (existingItem.qty || 1) + 1;
  } else {
    newItem.qty = 1;
    cart.push(newItem);
  }
  updateCartUI();
  triggerCartAnimation();
}

// ===== SANDWICH =====
function prepareOrder(id) {
  const item = menuItems.find(p=>p.id===id || p.id==id);
  currentItemToCustomize = item;
  const list = document.getElementById("ingredientsList");
  let ingredients = item.ingredients || ["مايونيز","خردل","بندورة","كبيس"];
  list.innerHTML = ingredients.map(ing=>`
    <label class="ingredient-option" id="opt_${ing}">
      <span>${ing}</span>
      <input type="checkbox" value="${ing}" checked onchange="toggleIngredientStyle('opt_${ing}', this.checked)">
    </label>`).join('');
  openModal('customizeModal');
}

function toggleIngredientStyle(id, checked) {
  const el = document.getElementById(id);
  el.classList.toggle('unchecked', !checked);
}

function confirmAddToCart() {
  const checkboxes = document.querySelectorAll('#ingredientsList input[type="checkbox"]');
  let excluded = [];
  checkboxes.forEach(box=>{ if(!box.checked) excluded.push(box.value); });
  let noteText = excluded.length > 0 ? "(بدون: " + excluded.join("، ") + ")" : "";
  
  addItemToCart({...currentItemToCustomize, notes: noteText});
  closeCustomizeModal();
}

// ===== KILO =====
function openWeightModal(id) {
  currentKiloItem = menuItems.find(p=>p.id===id || p.id==id);
  openModal('weightModal');
}

function closeWeightModal() { closeModal('weightModal'); }

function selectWeight(grams) {
  if(!currentKiloItem) return;
  const names = {200:"وقية (200غ)",300:"وقية ونصف (300غ)",400:"وقيتين (400غ)",500:"نصف كيلو (500غ)",600:"3 وقيات (600غ)",750:"كيلو إلا ربع (750غ)",800:"4 وقيات (800غ)",1000:"كيلو كامل (1000غ)"};
  const calculatedPrice = (currentKiloItem.price/1000)*grams;
  
  addItemToCart({ name:currentKiloItem.name, price:calculatedPrice, notes:`(كمية: ${names[grams]||grams+'غ'})`, img:null });
  closeWeightModal();
}

// ===== DRINKS =====
function addToCartDirect(id) {
  const item = menuItems.find(p=>p.id===id || p.id==id);
  addItemToCart({...item, notes:""});
}

// ===== MODAL HELPERS =====
function openModal(id) {
  const m = document.getElementById(id);
  m.style.display = 'flex';
  requestAnimationFrame(() => m.classList.add('active'));
  history.pushState({ modal: id }, null, "#" + id);
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m.classList.contains('active')) {
    m.classList.remove('active');
    m.style.display = 'none';
    if (window.location.hash === "#" + id) {
      history.replaceState(null, null, window.location.pathname);
    }
  }
}

function closeCustomizeModal() { closeModal('customizeModal'); }

function toggleCart() {
  const m = document.getElementById("cartModal");
  if(m.classList.contains('active')) {
    history.back();
  } else {
    updateCartUI();
    openModal('cartModal');
  }
}

window.addEventListener('popstate', function(event) {
  ['customizeModal','cartModal','clearCartModal','emptyAlertModal','weightModal'].forEach(id => {
    const m = document.getElementById(id);
    if (m && m.classList.contains('active')) {
      m.classList.remove('active');
      m.style.display = 'none';
    }
  });
});

// ===== SEND ORDER =====
function sendOrder() {
  if(cart.length === 0){ openModal('emptyAlertModal'); return; }
  let message = "مرحبا ميدو، طلبي هو:%0a%0a";
  let total = 0;
  
  cart.forEach((item, index) => {
    let itemQty = item.qty || 1;
    let itemTotal = item.price * itemQty;
    let qtyText = itemQty > 1 ? ` x${itemQty}` : '';
    message += `${index+1}- ${item.name}${qtyText} ${item.notes}%0a`;
    total += itemTotal;
  });
  
  const usdTotal = (total/RATE).toFixed(2);
  message += `%0a*المجموع: ${total.toLocaleString()} ل.ل (${usdTotal}$)*`;
  message += "%0a%0a📍 العنوان:";
  
  window.open(`https://wa.me/${storePhone}?text=${message}`, '_blank');
}

// ===== STATUS + COUNTER =====
function checkStatus() {
  const now = new Date().toLocaleString("en-US",{timeZone:"Asia/Beirut"});
  const d = new Date(now);
  const h = d.getHours(), m = d.getMinutes();
  const open = (h>10||(h===10&&m>=0)) && (h<23||(h===23&&m<=30));
  const box = document.getElementById("statusBox");
  if(box) {
      box.innerHTML = open
        ? `<span class="status-dot"></span>🟢 مفتوح الآن (اطلب دليفري)`
        : `<span class="status-dot"></span>🔴 مغلق الآن (نفتح 10 ص)`;
      box.className = open ? 'open' : 'closed';
  }
}

function updateVisitorCounter() {
  const BASE_COUNT = 1500;
  const today = new Date();
  const START_DATE = new Date('2025-12-02');
  const diffDays = Math.floor((today-START_DATE)/(1000*60*60*24));
  let acc = 0;
  for(let i=0;i<=diffDays;i++){
    let d=new Date(START_DATE.getTime()+(i*86400000));
    let seed=d.getDate()*1000+(d.getMonth()+1)*100+d.getFullYear();
    seed=(seed*9301+49297)%233280;
    acc+=Math.floor((seed/233280)*11)+20;
  }
  let final = BASE_COUNT+acc;
  const key='mido_visited_today';
  if(localStorage.getItem(key)!==today.toDateString()){final++;localStorage.setItem(key,today.toDateString());}
  const counterDiv = document.getElementById('counter');
  if(counterDiv) counterDiv.innerHTML = `👑 عدد الزوار: <span>${final.toLocaleString('en-US')}</span>`;
}

// ===== CHAT =====
function toggleChat() {
  const box = document.getElementById("chatBox");
  box.classList.toggle('open');
}
function askBot(t) {
  const b = document.getElementById("chatBody");
  const map = {
    branches: ["كم فرع عندكم؟ 🏪", "نحنا فرع الشياح - طريق صيدا القديمة.<br>ويوجد لدينا فروع بخلدة والجيّة. 🏪"],
    meat:     ["اللحمة حلال؟ 🥩", "اطمّن يا غالي! 🕌 اللحمة عنا حلال 100% مذبوحة عالطريقة الشرعية، طازجة ونظيفة."],
    menu:     ["شو في أكل؟ 🍔", "القائمة كلها فوق 👆 عنا بسترما، روستو، سجق، مقانق، وهوت دوغ مع مشروبات باردة."],
    party:    ["عندي عزيمة 🎉", "أهلاً وسهلاً! 🎊 منبيضلك وجهك بالطلبيات الكبيرة. حكينا واتساب لنرتبلك ياها بسهولة."],
    location: ["وين الموقع؟ 📍", "نحن بالشياح - طريق صيدا القديمة. 📍 ناطرينك يا غالي!"],
    hours:    ["ايمت بتفتحوا؟ ⏰", "يومياً من 10 الصبح للـ 11:30 بالليل. ⏰"],
    delivery: ["في دليفري؟ 🛵", "طبعاً! 🛵 لكل بيروت وضواحيها. اطلب من السلة ورح يوصلك الطلب واتساب فوراً."]
  };
  const [u, r] = map[t] || ['سؤال', 'ما عندي جواب 😅'];
  b.innerHTML += `<div class="user-msg">${u}</div>`;
  b.scrollTop = b.scrollHeight;
  setTimeout(()=>{ b.innerHTML += `<div class="bot-msg">${r}</div>`; b.scrollTop=b.scrollHeight; }, 600);
}

window.onclick = function(event) {
  ['customizeModal','cartModal','clearCartModal','emptyAlertModal','weightModal'].forEach(id=>{
    const m = document.getElementById(id);
    if(event.target === m){ closeModal(id); }
  });
};

window.addEventListener('scroll', ()=>{
  const scrollBtn = document.getElementById('scrollTop');
  if(scrollBtn) scrollBtn.classList.toggle('visible', window.scrollY > 300);
});

checkStatus();
updateVisitorCounter();
setInterval(updateVisitorCounter, 3600000);
setInterval(checkStatus, 60000);

// ===== ربط الفنكشنات بالـ Window لتشتغل من الـ HTML =====
window.renderMenu = renderMenu;
window.prepareOrder = prepareOrder;
window.openWeightModal = openWeightModal;
window.addToCartDirect = addToCartDirect;
window.openModal = openModal;
window.closeModal = closeModal;
window.openClearCartModal = openClearCartModal;
window.closeClearCartModal = closeClearCartModal;
window.confirmClearCart = confirmClearCart;
window.closeEmptyAlertModal = closeEmptyAlertModal;
window.updateCartUI = updateCartUI;
window.removeFromCart = removeFromCart;
window.toggleIngredientStyle = toggleIngredientStyle;
window.confirmAddToCart = confirmAddToCart;
window.closeWeightModal = closeWeightModal;
window.selectWeight = selectWeight;
window.toggleCart = toggleCart;
window.closeCustomizeModal = closeCustomizeModal;
window.sendOrder = sendOrder;
window.toggleChat = toggleChat;
window.askBot = askBot;
