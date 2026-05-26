// Firebase Configuration - Malaboushi Karaoke Platform
const firebaseConfig = {
  apiKey: "AIzaSyBB_U4C880PW4GxZd8FALv8yBSiP2mNeBY",
  authDomain: "malaboushi.firebaseapp.com",
  databaseURL: "https://malaboushi-default-rtdb.firebaseio.com/",
  projectId: "malaboushi",
  storageBucket: "malaboushi.firebasestorage.app",
  messagingSenderId: "110336819350",
  appId: "1:110336819350:web:2b1b0488e72b811f0602b7"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
const storage = firebase.storage();

// Google Auth Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Auth State Listener
auth.onAuthStateChanged((user) => {
  if (user) {
    onUserLoggedIn(user);
  } else {
    onUserLoggedOut();
  }
});

// Login with Google
async function signInWithGoogle() {
  try {
    showLoading('جاري تسجيل الدخول...');
    const result = await auth.signInWithPopup(googleProvider);
    const user = result.user;

    // Save user to database
    await saveUserToDatabase(user);

    hideLoading();
    showToast('مرحباً بك!', 'success');
    return user;
  } catch (error) {
    hideLoading();
    showToast('فشل تسجيل الدخول', 'error');
    console.error(error);
    return null;
  }
}

// Logout
async function signOutUser() {
  try {
    await auth.signOut();
    showToast('تم تسجيل الخروج', 'info');
  } catch (error) {
    console.error(error);
  }
}

// Save user to database
async function saveUserToDatabase(user) {
  const userRef = db.ref('users/' + user.uid);
  const snapshot = await userRef.once('value');

  if (!snapshot.exists()) {
    await userRef.set({
      displayName: user.displayName || 'مستخدم',
      photoURL: user.photoURL || '',
      email: user.email,
      bio: '',
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      isOnline: true,
      lastSeen: firebase.database.ServerValue.TIMESTAMP
    });
  } else {
    await userRef.update({
      isOnline: true,
      lastSeen: firebase.database.ServerValue.TIMESTAMP
    });
  }
}

// Update user status
function updateUserStatus(online) {
  if (!auth.currentUser) return;

  const userStatusRef = db.ref('users/' + auth.currentUser.uid + '/isOnline');
  const lastSeenRef = db.ref('users/' + auth.currentUser.uid + '/lastSeen');

  if (online) {
    userStatusRef.set(true);
  } else {
    userStatusRef.set(false);
    lastSeenRef.set(firebase.database.ServerValue.TIMESTAMP);
  }
}

// Get current user
function getCurrentUser() {
  return auth.currentUser;
}

// User callbacks (will be set from main.js)
let onUserLoggedIn = (user) => {};
let onUserLoggedOut = () => {};