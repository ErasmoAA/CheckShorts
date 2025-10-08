// ===============================
// scripts.js (CORREGIDO - sin auto-recuperación de canales)
// ===============================

// --- VARIABLES GLOBALES Y SELECTORES ---
let nav = 0;
let clicked = null;
let channels = [];
let currentUser = null;
let userData = null;

const calendar = document.getElementById('calendar');
const monthDisplay = document.getElementById('monthDisplay');
const setupModal = document.getElementById('setupModal');
const checklistModal = document.getElementById('checklistModal');
const achievementsModal = document.getElementById('achievementsModal');

const addChannelForm = document.getElementById('addChannelForm');
const newChannelNameInput = document.getElementById('newChannelName');
const channelList = document.getElementById('channelList');
const shortsPerChannelInput = document.getElementById('shortsPerChannel');
const checklistContainer = document.getElementById('checklist-container');
const checklistTitle = document.getElementById('checklistTitle');

const googleSignInButton = document.getElementById('googleSignInButton');
const signOutButton = document.getElementById('signOutButton');
const userStatusDisplay = document.getElementById('userStatus');

const currentStreakDisplay = document.getElementById('currentStreak');
const dailyProgressBarFill = document.querySelector('#dailyProgressBar .progress-bar-fill');
const dailyProgressText = document.getElementById('dailyProgressText');
const weeklyProgressBarFill = document.querySelector('#weeklyProgressBar .progress-bar-fill');
const weeklyProgressText = document.getElementById('weeklyProgressText');

const settingsButton = document.getElementById('settingsButton');
const achievementsButton = document.getElementById('achievementsButton');
const closeSetupButton = document.getElementById('closeSetupButton');
const closeChecklistButton = document.getElementById('closeChecklistButton');
const closeAchievementsButton = document.getElementById('closeAchievementsButton');


// --- HELPERS DE CONTEO Y UTILIDAD ---
function countDoneStatuses(dayData) {
  if (!dayData || typeof dayData !== 'object') return 0;
  let total = 0;
  for (const channelMap of Object.values(dayData)) {
    if (channelMap && typeof channelMap === 'object') {
      for (const status of Object.values(channelMap)) {
        if (status === 'done') total++;
      }
    }
  }
  return total;
}

function hasInProgress(dayData) {
  if (!dayData || typeof dayData !== 'object') return false;
  for (const channelMap of Object.values(dayData)) {
    if (channelMap && typeof channelMap === 'object') {
      for (const status of Object.values(channelMap)) {
        if (status === 'in_progress') return true;
      }
    }
  }
  return false;
}

function genId() {
  return 'ch_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function getOrphanChannelNames() {
  const inCalendar = new Set();
  const valid = (n) => {
    const s = (n ?? '').toString().trim();
    return s && s.toLowerCase() !== 'undefined';
  };
  if (userData?.calendar && typeof userData.calendar === 'object') {
    for (const dateKey of Object.keys(userData.calendar)) {
      const day = userData.calendar[dateKey];
      if (!day || typeof day !== 'object') continue;
      for (const ch of Object.keys(day)) {
        if (valid(ch)) inCalendar.add(ch);
      }
    }
  }
  const inChannels = new Set((channels || []).map(c => c.name));
  return [...inCalendar].filter(name => !inChannels.has(name));
}

/**
 * Migra y repara userData - VERSIÓN CORREGIDA
 * YA NO re-añade canales automáticamente desde el calendario
 */
async function migrateAndRepairUserData() {
  if (!userData) return;

  let changed = false;

  // 1) Normalizar channels (strings -> {id, name})
  const original = Array.isArray(userData.channels) ? userData.channels : [];
  const normalized = [];
  const seen = new Set();

  for (const item of original) {
    if (typeof item === 'string') {
      const name = item.trim();
      if (name && name.toLowerCase() !== 'undefined') {
        const key = name.toLowerCase();
        if (!seen.has(key)) {
          normalized.push({ id: genId(), name });
          seen.add(key);
          changed = true;
        }
      }
    } else if (item && typeof item === 'object') {
      const name = (item.name ?? item.channel ?? '').toString().trim();
      if (name && name.toLowerCase() !== 'undefined') {
        const key = name.toLowerCase();
        if (!seen.has(key)) {
          normalized.push({ id: item.id || genId(), name });
          seen.add(key);
        }
      } else {
        changed = true;
      }
    }
  }

  // 2) Limpiar calendario y migrar estados
  // ⚠️ CAMBIO IMPORTANTE: Ya NO añadimos canales automáticamente
  if (userData.calendar && typeof userData.calendar === 'object') {
    for (const dateKey of Object.keys(userData.calendar)) {
      const day = userData.calendar[dateKey];
      if (!day || typeof day !== 'object') continue;

      // Eliminar la llave 'undefined'
      if (Object.prototype.hasOwnProperty.call(day, 'undefined')) {
        delete day['undefined'];
        changed = true;
      }

      for (const channelName of Object.keys(day)) {
        const items = day[channelName];
        if (items && typeof items === 'object') {
          for (const sId of Object.keys(items)) {
            const s = items[sId];
            // Migrar estados antiguos
            if (s === 'fail') {
              items[sId] = 'pending';
              changed = true;
            }
            if (s === 'inprogress') {
              items[sId] = 'in_progress';
              changed = true;
            }
          }
        }
      }
    }
  }

  // 3) Persistir si cambió algo
  if (changed || normalized.length !== original.length) {
    userData.channels = normalized;
    channels = normalized;
    await saveData();
  } else {
    channels = original;
  }
}

/**
 * Limpia canales huérfanos del calendario manualmente
 */
async function purgeOrphanChannelsFromCalendar() {
  if (!userData?.calendar) return;
  const keepNames = new Set((channels || []).map(c => c.name));
  let changed = false;

  for (const dateKey of Object.keys(userData.calendar)) {
    const day = userData.calendar[dateKey];
    if (!day || typeof day !== 'object') continue;

    if ('undefined' in day) {
      delete day['undefined'];
      changed = true;
    }
    for (const key of Object.keys(day)) {
      if (!keepNames.has(key)) {
        delete day[key];
        changed = true;
      }
    }
  }

  if (changed) {
    await saveData();
    renderCalendar();
    updateSettingsExtras();
  }
}

function ensureSettingsExtras() {
  const section = channelList?.closest('.config-section');
  if (!section) return;

  let stats = document.getElementById('channelStats');
  if (!stats) {
    stats = document.createElement('div');
    stats.id = 'channelStats';
    stats.style.cssText = 'margin-top:10px;margin-bottom:10px;font-weight:600;opacity:.9;';
    section.appendChild(stats);
  }

  let cleanBtn = document.getElementById('cleanOrphansButton');
  if (!cleanBtn) {
    cleanBtn = document.createElement('button');
    cleanBtn.id = 'cleanOrphansButton';
    cleanBtn.className = 'action-button close-button';
    cleanBtn.textContent = 'Limpiar datos antiguos del calendario';
    cleanBtn.style.marginTop = '8px';
    cleanBtn.addEventListener('click', async () => {
      await purgeOrphanChannelsFromCalendar();
      alert('✅ Limpieza completada. Se eliminaron datos de canales antiguos.');
    });
    section.appendChild(cleanBtn);
  }

  updateSettingsExtras();
}

function updateSettingsExtras() {
  const stats = document.getElementById('channelStats');
  if (!stats) return;
  const orphanCount = getOrphanChannelNames().length;
  stats.textContent = `Canales activos: ${channels.length}${orphanCount > 0 ? ` · Datos antiguos detectados: ${orphanCount}` : ''}`;
}


// --- AUTENTICACIÓN ---
async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
  } catch (error) {
    console.error("Error al iniciar sesión con Google:", error);
    alert("Error al iniciar sesión: " + error.message);
  }
}

async function signOutGoogle() {
  try {
    await auth.signOut();
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    alert("Error al cerrar sesión: " + error.message);
  }
}

async function handleAuthStatus(user) {
  currentUser = user;
  if (user) {
    userStatusDisplay.innerText = `Hola, ${user.displayName}`;
    googleSignInButton.classList.add('hide');
    signOutButton.classList.remove('hide');
    await loadData(user.uid);
    renderCalendar();
    renderChannels();
    calculateAndDisplayStreak();
  } else {
    userStatusDisplay.innerText = 'No hay sesión iniciada.';
    googleSignInButton.classList.remove('hide');
    signOutButton.classList.add('hide');
    channels = [];
    userData = null;
    renderCalendar();
    renderChannels();
    currentStreakDisplay.innerText = '0 días';
    dailyProgressBarFill.style.width = '0%';
    dailyProgressText.innerText = '0/0';
    weeklyProgressBarFill.style.width = '0%';
    weeklyProgressText.innerText = '0/0';
  }
}


// --- PERSISTENCIA (Firestore) ---
async function loadData(uid) {
  if (!uid) return;
  const docRef = db.collection('users').doc(uid);
  try {
    const doc = await docRef.get();
    if (doc.exists) {
      userData = doc.data();
      await migrateAndRepairUserData();
      channels = userData.channels || [];
      shortsPerChannelInput.value = userData.shortsPerChannel || 2;
    } else {
      userData = {
        channels: [],
        shortsPerChannel: 2,
        calendar: {},
        lastLoginDate: new Date().toISOString().split('T')[0],
        streak: 0,
        achievements: []
      };
      channels = [];
      shortsPerChannelInput.value = 2;
      await saveData();
    }
  } catch (error) {
    console.error("Error al cargar datos:", error);
  }
}

async function saveData() {
  if (!currentUser || !userData) return;
  const docRef = db.collection('users').doc(currentUser.uid);
  try {
    userData.channels = channels;
    userData.shortsPerChannel = parseInt(shortsPerChannelInput.value);
    await docRef.set(userData, { merge: true });
    console.log("✅ Datos guardados correctamente");
  } catch (error) {
    console.error("Error al guardar datos:", error);
  }
}


// --- CALENDARIO / RENDER ---
function renderCalendar() {
  const dt = new Date();
  if (nav !== 0) dt.setMonth(new Date().getMonth() + nav);

  const month = dt.getMonth();
  const year = dt.getFullYear();

  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const firstDayWeekday = firstDayOfMonth.getDay();
  const paddingDays = (firstDayWeekday + 6) % 7;

  monthDisplay.innerText = `${dt.toLocaleDateString('es-ES', { month: 'long' })} ${year}`;
  calendar.innerHTML = '';

  let totalVideosThisWeek = 0;
  let completedVideosThisWeek = 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(today);
  const currentDayOfWeek = today.getDay();
  const daysFromMonday = (currentDayOfWeek + 6) % 7;
  startOfWeek.setDate(today.getDate() - daysFromMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  for (let i = 0; i < paddingDays; i++) {
    const paddingBox = document.createElement('div');
    paddingBox.classList.add('day', 'padding');
    calendar.appendChild(paddingBox);
  }

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
    const dayBox = document.createElement('div');
    dayBox.classList.add('day');
    dayBox.innerText = dayNumber;

    const currentDay = new Date(year, month, dayNumber);
    currentDay.setHours(0, 0, 0, 0);

    if (currentDay.getTime() === today.getTime()) {
      dayBox.classList.add('current-day');
    }

    const formattedDay = dayNumber < 10 ? '0' + dayNumber : String(dayNumber);
    const formattedMonth = (month + 1) < 10 ? '0' + (month + 1) : String(month + 1);
    const dateKey = `${year}-${formattedMonth}-${formattedDay}`;

    const dayData = userData?.calendar?.[dateKey];
    const totalForDay = (channels.length || 0) * (userData?.shortsPerChannel || 0);
    const completedForDay = countDoneStatuses(dayData);
    const inProgressToday = hasInProgress(dayData);

    if (totalForDay > 0) {
      const progressPercentage = (completedForDay / totalForDay) * 100;

      const progressBar = document.createElement('div');
      progressBar.classList.add('day-progress-bar');
      progressBar.style.width = `${progressPercentage}%`;
      dayBox.appendChild(progressBar);

      if (progressPercentage === 100) {
        dayBox.classList.add('completed-day');
      } else if (completedForDay > 0 || inProgressToday) {
        dayBox.classList.add('partial-day');
      } else {
        dayBox.classList.add('pending-day');
      }
    }

    dayBox.addEventListener('click', () => openChecklistModal(dateKey));

    if (currentUser && currentDay >= startOfWeek && currentDay < endOfWeek) {
      totalVideosThisWeek += totalForDay;
      completedVideosThisWeek += completedForDay;
    }

    calendar.appendChild(dayBox);
  }

  if (currentUser) {
    updateWeeklyProgressBar(completedVideosThisWeek, totalVideosThisWeek);
  }
}

function updateWeeklyProgressBar(completed, total) {
  if (total === 0) {
    weeklyProgressBarFill.style.width = '0%';
    weeklyProgressText.innerText = '0/0';
  } else {
    const percentage = (completed / total) * 100;
    weeklyProgressBarFill.style.width = `${percentage}%`;
    weeklyProgressText.innerText = `${completed}/${total}`;
  }
}


// --- CANALES ---
async function addChannel(name) {
  if (!name || !currentUser) return;
  name = name.toString().trim();
  if (!name || name.toLowerCase() === 'undefined') {
    alert('Nombre de canal no válido.');
    return;
  }
  if (!channels.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    channels.push({ id: genId(), name });
    await saveData();
    renderChannels();
    renderCalendar();
    updateSettingsExtras();
  } else {
    alert('Este canal ya existe.');
  }
}

async function removeChannel(name) {
  if (!currentUser) return;
  
  // Confirmar antes de eliminar
  if (!confirm(`¿Eliminar el canal "${name}" y todos sus datos del calendario?`)) {
    return;
  }
  
  channels = channels.filter(c => c.name !== name);

  // Limpiar TODO el calendario de este canal
  if (userData.calendar) {
    for (const date in userData.calendar) {
      if (userData.calendar[date][name]) {
        delete userData.calendar[date][name];
      }
    }
  }
  
  await saveData();
  renderChannels();
  renderCalendar();
  updateSettingsExtras();
  
  console.log(`✅ Canal "${name}" eliminado permanentemente`);
}

function renderChannels() {
  channelList.innerHTML = '';
  if (channels.length === 0) {
    const li = document.createElement('li');
    li.innerText = 'No hay canales. ¡Añade uno!';
    channelList.appendChild(li);
  } else {
    channels.sort((a, b) => a.name.localeCompare(b.name));
    channels.forEach(channel => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span>${channel.name}</span>
        <button class="remove-btn" title="Eliminar canal">-</button>
      `;
      li.querySelector('.remove-btn').addEventListener('click', () => removeChannel(channel.name));
      channelList.appendChild(li);
    });
  }
}

async function updateShortsPerChannel() {
  if (!currentUser) return;
  let value = parseInt(shortsPerChannelInput.value);
  if (isNaN(value) || value < 1) {
    value = 1;
    shortsPerChannelInput.value = 1;
  }
  userData.shortsPerChannel = value;
  await saveData();
  renderCalendar();
}


// --- CHECKLIST ---
function openChecklistModal(date) {
  if (!currentUser) {
    alert('Por favor, inicia sesión para gestionar tu calendario.');
    return;
  }
  clicked = date;
  checklistTitle.innerText = `Contenido para ${new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
  checklistContainer.innerHTML = '';

  const totalExpectedShorts = (channels.length || 0) * (userData?.shortsPerChannel || 0);
  let completedShortsToday = 0;

  if (channels.length === 0) {
    checklistContainer.innerHTML = '<p>Añade canales en Configuración para empezar a planificar.</p>';
  } else {
    channels.forEach(channel => {
      const channelDiv = document.createElement('div');
      channelDiv.classList.add('channel-checklist-group');
      channelDiv.innerHTML = `<h4>${channel.name}</h4>`;
      checklistContainer.appendChild(channelDiv);

      const numShorts = userData?.shortsPerChannel || 0;
      for (let i = 0; i < numShorts; i++) {
        const shortId = `short_${i}`;
        const currentStatus = userData?.calendar?.[date]?.[channel.name]?.[shortId] || 'pending';
        if (currentStatus === 'done') completedShortsToday++;

        const row = document.createElement('div');
        row.classList.add('checklist-item');
        row.innerHTML = `
          <span class="item-label">Short ${i + 1}</span>
          <div class="status-buttons">
            <button class="status-btn pending ${currentStatus === 'pending' ? 'active' : ''}" data-status="pending" title="No hecho">⏳</button>
            <button class="status-btn inprogress ${currentStatus === 'in_progress' ? 'active' : ''}" data-status="in_progress" title="En proceso">🛠️</button>
            <button class="status-btn done ${currentStatus === 'done' ? 'active' : ''}" data-status="done" title="Subido">✅</button>
          </div>
        `;
        channelDiv.appendChild(row);

        row.querySelectorAll('.status-btn').forEach(button => {
          button.addEventListener('click', async (e) => {
            const newStatus = e.currentTarget.dataset.status;
            await updateShortStatus(date, channel.name, shortId, newStatus);
            openChecklistModal(date);
            renderCalendar();
            calculateAndDisplayStreak();
            checkAchievements();
          });
        });
      }
    });
  }

  updateDailyProgressBar(completedShortsToday, totalExpectedShorts);
  checklistModal.classList.remove('hide');
}

function updateDailyProgressBar(completed, total) {
  if (total === 0) {
    dailyProgressBarFill.style.width = '0%';
    dailyProgressText.innerText = '0/0';
  } else {
    const percentage = (completed / total) * 100;
    dailyProgressBarFill.style.width = `${percentage}%`;
    dailyProgressText.innerText = `${completed}/${total}`;
  }
}

async function updateShortStatus(date, channelName, shortId, status) {
  if (!currentUser) return;

  if (!userData.calendar) userData.calendar = {};
  if (!userData.calendar[date]) userData.calendar[date] = {};
  if (!userData.calendar[date][channelName]) userData.calendar[date][channelName] = {};

  userData.calendar[date][channelName][shortId] = status;
  await saveData();
}


// --- RACHA ---
async function calculateAndDisplayStreak() {
  if (!currentUser || !userData) {
    currentStreakDisplay.innerText = '0 días';
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDateKey = today.toISOString().split('T')[0];

  const totalExpectedToday = (channels.length || 0) * (userData.shortsPerChannel || 0);
  const completedToday = countDoneStatuses(userData.calendar?.[todayDateKey]);
  const isTodayComplete = totalExpectedToday > 0 && completedToday === totalExpectedToday;

  let streakCount = 0;
  let checkDate = new Date(today);

  if (isTodayComplete) {
    streakCount = 1;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const dateKey = checkDate.toISOString().split('T')[0];
    const totalExpected = (channels.length || 0) * (userData.shortsPerChannel || 0);
    const completed = countDoneStatuses(userData.calendar?.[dateKey]);

    if (totalExpected > 0 && completed === totalExpected) {
      streakCount++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
    if (streakCount > 365) break;
  }

  userData.streak = streakCount;
  userData.lastLoginDate = todayDateKey;
  await saveData();

  currentStreakDisplay.innerText = `${streakCount} día${streakCount !== 1 ? 's' : ''}`;
}


// --- LOGROS ---
const achievementDefinitions = {
  'first_short': {
    title: 'Primer Short',
    description: '¡Publica tu primer short!',
    check: (data) => {
      let totalCompleted = 0;
      for (const dateKey in data.calendar) {
        for (const channelName in data.calendar[dateKey]) {
          totalCompleted += Object.values(data.calendar[dateKey][channelName]).filter(s => s === 'done').length;
        }
      }
      return totalCompleted >= 1;
    }
  },
  'five_shorts': {
    title: 'Cinco Shorts',
    description: '¡Publica cinco shorts!',
    check: (data) => {
      let totalCompleted = 0;
      for (const dateKey in data.calendar) {
        for (const channelName in data.calendar[dateKey]) {
          totalCompleted += Object.values(data.calendar[dateKey][channelName]).filter(s => s === 'done').length;
        }
      }
      return totalCompleted >= 5;
    }
  },
  'ten_shorts': {
    title: 'Diez Shorts',
    description: '¡Publica diez shorts!',
    check: (data) => {
      let totalCompleted = 0;
      for (const dateKey in data.calendar) {
        for (const channelName in data.calendar[dateKey]) {
          totalCompleted += Object.values(data.calendar[dateKey][channelName]).filter(s => s === 'done').length;
        }
      }
      return totalCompleted >= 10;
    }
  },
  'first_streak': {
    title: 'Primer Racha',
    description: '¡Mantén una racha de 3 días!',
    check: (data) => data.streak >= 3
  },
  'seven_streak': {
    title: 'Racha de la Semana',
    description: '¡Mantén una racha de 7 días!',
    check: (data) => data.streak >= 7
  },
  'thirty_streak': {
    title: 'Racha Legendaria',
    description: '¡Mantén una racha de 30 días!',
    check: (data) => data.streak >= 30
  },
  'new_channel': {
    title: 'Nuevo Canal',
    description: '¡Añade tu segundo canal!',
    check: (data) => data.channels.length >= 2
  },
  'three_channels': {
    title: 'Creador Múltiple',
    description: '¡Gestiona 3 canales!',
    check: (data) => data.channels.length >= 3
  }
};

async function checkAchievements() {
  if (!currentUser || !userData) return;

  if (!userData.achievements) userData.achievements = [];

  let achievementsUpdated = false;
  for (const id in achievementDefinitions) {
    const achievement = achievementDefinitions[id];
    if (!userData.achievements.includes(id) && achievement.check(userData)) {
      userData.achievements.push(id);
      achievementsUpdated = true;
      showAchievementNotification(achievement.title);
    }
  }
  if (achievementsUpdated) await saveData();
}

function showAchievementNotification(title) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed; top: 20px; right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white; padding: 15px 20px; border-radius: 10px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3); z-index: 10000;
    animation: slideIn 0.5s ease;
  `;
  notification.innerHTML = `<strong>🏆 ¡Logro desbloqueado!</strong><br>${title}`;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.5s ease';
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

function renderAchievements() {
  const achievementsContainer = document.getElementById('achievements-container');
  achievementsContainer.innerHTML = '';

  if (!currentUser) {
    achievementsContainer.innerHTML = '<p class="no-achievements">Inicia sesión para ver tus logros.</p>';
    return;
  }

  if (userData.achievements && userData.achievements.length > 0) {
    const ul = document.createElement('ul');
    ul.classList.add('achievements-list');
    userData.achievements.forEach(achId => {
      const achievement = achievementDefinitions[achId];
      if (achievement) {
        const li = document.createElement('li');
        li.classList.add('achievement-item');
        li.innerHTML = `
          <span class="achievement-icon">🏆</span>
          <div class="achievement-info">
            <span class="achievement-title">${achievement.title}</span>
            <span class="achievement-description">${achievement.description}</span>
          </div>
        `;
        ul.appendChild(li);
      }
    });
    achievementsContainer.appendChild(ul);
  } else {
    achievementsContainer.innerHTML = '<p class="no-achievements">Aún no tienes logros. ¡Sigue publicando videos!</p>';
  }
}


// --- INICIALIZACIÓN / EVENTOS ---
function init() {
  auth.onAuthStateChanged(handleAuthStatus);

  addChannelForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const channelName = newChannelNameInput.value.trim();
    if (channelName) {
      addChannel(channelName);
      newChannelNameInput.value = '';
    }
  });

  shortsPerChannelInput.addEventListener('change', updateShortsPerChannel);
  shortsPerChannelInput.addEventListener('input', updateShortsPerChannel);

  settingsButton.addEventListener('click', () => {
    setupModal.classList.remove('hide');
    renderChannels();
    ensureSettingsExtras();
  });

  closeSetupButton.addEventListener('click', () => setupModal.classList.add('hide'));
  closeChecklistButton.addEventListener('click', () => checklistModal.classList.add('hide'));

  document.getElementById('backButton').addEventListener('click', () => { nav--; renderCalendar(); });
  document.getElementById('nextButton').addEventListener('click', () => { nav++; renderCalendar(); });

  googleSignInButton.addEventListener('click', signInWithGoogle);
  signOutButton.addEventListener('click', signOutGoogle);

  achievementsButton.addEventListener('click', () => {
    renderAchievements();
    achievementsModal.classList.remove('hide');
  });
  closeAchievementsButton.addEventListener('click', () => achievementsModal.classList.add('hide'));

  renderCalendar();
}

init();
// --- FIN ---