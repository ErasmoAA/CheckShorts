// ======================================================
// scripts.js - VERSIÓN FINAL CORREGIDA
// Soluciona el error de actualización de estado en múltiples días.
// ======================================================

// --- VARIABLES GLOBALES Y SELECTORES ---
let nav = 0;
let clicked = null;
let channels = [];
let currentUser = null;
let userData = null;
let subscriberChartInstance = null;

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
const analyticsButton = document.getElementById('analyticsButton');
const dailyLogButton = document.getElementById('dailyLogButton');
const subscriberModal = document.getElementById('subscriberModal');
const subscriberForm = document.getElementById('subscriberForm');
const subscriberList = document.getElementById('subscriber-list');
const subscriberTitle = document.getElementById('subscriberTitle');
const analyticsModal = document.getElementById('analyticsModal');
const closeAnalyticsButton = document.getElementById('closeAnalyticsButton');
const editChannelModal = document.getElementById('editChannelModal');
const editChannelForm = document.getElementById('editChannelForm');
const editChannelIdInput = document.getElementById('editChannelId');
const editChannelNameInput = document.getElementById('editChannelName');
const editChannelShortsOverrideInput = document.getElementById('editChannelShortsOverride');
const editChannelVoiceInput = document.getElementById('editChannelVoice');
const editChannelMusicInput = document.getElementById('editChannelMusic');
const editChannelStyleInput = document.getElementById('editChannelStyle');
const editChannelSubtitlesInput = document.getElementById('editChannelSubtitles');
const closeEditModalButton = document.getElementById('closeEditModalButton');


// --- HELPERS DE CONTEO Y UTILIDAD ---
function countDoneStatuses(dayData) {
  if (!dayData || typeof dayData !== 'object' || !dayData.channels) return 0;
  let total = 0;
  for (const channelMap of Object.values(dayData.channels)) {
    if (channelMap && typeof channelMap === 'object') {
      for (const status of Object.values(channelMap)) {
        if (status === 'done') total++;
      }
    }
  }
  return total;
}

function hasInProgress(dayData) {
  if (!dayData || typeof dayData !== 'object' || !dayData.channels) return false;
  for (const channelMap of Object.values(dayData.channels)) {
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

function getShortsForChannel(channel) {
    const globalDefault = parseInt(shortsPerChannelInput.value) || 2;
    if (channel && channel.shortsOverride && !isNaN(channel.shortsOverride) && channel.shortsOverride > 0) {
        return channel.shortsOverride;
    }
    return globalDefault;
}

function getOrphanChannelNames() {
    if (!userData || !userData.calendar) return [];
    const inCalendar = new Set();
    for (const dateKey of Object.keys(userData.calendar)) {
        const day = userData.calendar[dateKey];
        if (day && day.channels && typeof day.channels === 'object') {
            for (const ch of Object.keys(day.channels)) { inCalendar.add(ch); }
        }
    }
    const inChannels = new Set((channels || []).map(c => c.name));
    return [...inCalendar].filter(name => !inChannels.has(name));
}

// --- LÓGICA DE SUSCRIPTORES Y ANALÍTICAS ---
function getTodayDateString() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function openSubscriberModal() {
    const todayKey = getTodayDateString();
    subscriberTitle.innerText = `Registrar Suscriptores del ${todayKey}`;
    subscriberList.innerHTML = '';

    if (channels.length === 0) {
        subscriberList.innerHTML = '<p>Añade un canal en Configuración para empezar.</p>';
    } else {
        channels.forEach(channel => {
            const currentValue = userData.subscriberHistory?.[todayKey]?.[channel.id] || '';
            const item = document.createElement('div');
            item.className = 'subscriber-item';
            item.innerHTML = `
                <label for="subscribers-${channel.id}">${channel.name}</label>
                <input type="number" id="subscribers-${channel.id}" data-channel-id="${channel.id}" value="${currentValue}" placeholder="0">
            `;
            subscriberList.appendChild(item);
        });
    }
    subscriberModal.classList.remove('hide');
}

async function saveSubscriberCounts(event) {
    event.preventDefault();
    const todayKey = getTodayDateString();

    if (!userData.subscriberHistory) userData.subscriberHistory = {};
    if (!userData.subscriberHistory[todayKey]) userData.subscriberHistory[todayKey] = {};

    const inputs = subscriberList.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
        const channelId = input.dataset.channelId;
        const count = parseInt(input.value);
        if (channelId && !isNaN(count) && count >= 0) {
            userData.subscriberHistory[todayKey][channelId] = count;
        }
    });

    await saveData();
    subscriberModal.classList.add('hide');
}

function openAnalyticsModal() {
    analyticsModal.classList.remove('hide');
    renderSubscriberChart();
}

function renderSubscriberChart() {
    const ctx = document.getElementById('subscriberChart').getContext('2d');
    
    if (subscriberChartInstance) {
        subscriberChartInstance.destroy();
    }

    const history = userData.subscriberHistory || {};
    const dates = Object.keys(history).sort();

    if (dates.length === 0) return;

    const datasets = channels.map(channel => {
        const data = dates.map(date => history[date]?.[channel.id] ?? null);
        const randomColor = `hsl(${Math.random() * 360}, 70%, 50%)`;
        return {
            label: channel.name,
            data: data,
            borderColor: randomColor,
            backgroundColor: randomColor + '33',
            tension: 0.1,
            spanGaps: true,
        };
    });

    subscriberChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: dates, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: false } },
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Evolución por Canal' }
            }
        }
    });
}

// --- FUNCIONES DE MANTENIMIENTO Y REPARACIÓN ---
async function purgeOrphanChannelsFromCalendar() {
  if (!userData?.calendar) return;
  const keepNames = new Set((channels || []).map(c => c.name));
  let changed = false;
  const deletedOrphans = [];

  for (const dateKey of Object.keys(userData.calendar)) {
    const day = userData.calendar[dateKey];
    if (!day || !day.channels || typeof day.channels !== 'object') continue;

    for (const key of Object.keys(day.channels)) {
      if (!keepNames.has(key)) {
        deletedOrphans.push(key);
        delete day.channels[key];
        changed = true;
      }
    }
  }

  if (changed) {
    await saveData();
    renderCalendar();
    updateSettingsExtras();
    const uniqueDeleted = [...new Set(deletedOrphans)];
    alert(`Limpieza completada.\nCanales eliminados: ${uniqueDeleted.join(', ')}`);
  } else {
    alert('No se encontraron canales huérfanos para eliminar.');
  }
}

// --- GESTIÓN DE LA INTERFAZ DE CONFIGURACIÓN ---
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
    cleanBtn.textContent = 'Eliminar canales huérfanos del calendario';
    cleanBtn.style.marginTop = '8px';
    cleanBtn.addEventListener('click', () => purgeOrphanChannelsFromCalendar());
    section.appendChild(cleanBtn);
  }

  updateSettingsExtras();
}

function updateSettingsExtras() {
  const stats = document.getElementById('channelStats');
  if (!stats) return;
  const orphanCount = getOrphanChannelNames().length;
  stats.textContent = `Canales: ${channels.length} · Huérfanos en calendario: ${orphanCount}`;

  const cleanBtn = document.getElementById('cleanOrphansButton');
  if (cleanBtn) {
    cleanBtn.style.display = orphanCount > 0 ? 'block' : 'none';
  }
}

// --- AUTENTICACIÓN ---
async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
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
    
    const todayKey = getTodayDateString();
    if (!userData.subscriberHistory?.[todayKey]) {
        openSubscriberModal();
    }
  } else {
    userStatusDisplay.innerText = 'No hay sesión iniciada.';
    googleSignInButton.classList.remove('hide');
    signOutButton.classList.add('hide');
    channels = [];
    userData = null;
    renderCalendar();
    renderChannels();
    currentStreakDisplay.innerText = '0 días';
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
      
      let needsSave = false;
      if (userData.channels && userData.channels.length > 0 && typeof userData.channels[0] === 'string') {
        userData.channels = userData.channels.map(name => ({
          id: genId(), name, voice: '', music: '', style: '', subtitles: '', shortsOverride: null
        }));
        needsSave = true;
      }
      if(userData.calendar){
          for(const dateKey in userData.calendar){
              if(userData.calendar[dateKey] && !userData.calendar[dateKey].hasOwnProperty('channels')){
                  const oldDayData = {...userData.calendar[dateKey]};
                  userData.calendar[dateKey] = { channels: oldDayData, dailyGoal: null };
                  needsSave = true;
              }
          }
      }
      if (!userData.subscriberHistory) {
          userData.subscriberHistory = {};
          needsSave = true;
      }

      channels = userData.channels || [];
      shortsPerChannelInput.value = userData.shortsPerChannel || 2;
      
      if (needsSave) await saveData();

    } else {
      userData = {
        channels: [], shortsPerChannel: 2, calendar: {},
        lastLoginDate: new Date().toISOString().split('T')[0],
        streak: 0, achievements: [], subscriberHistory: {}
      };
      channels = [];
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
  startOfWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7));
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
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    const dayData = userData?.calendar?.[dateKey];
    
    let totalForDay;
    if (dayData && dayData.dailyGoal) {
      totalForDay = dayData.dailyGoal;
    } else {
      totalForDay = channels.reduce((sum, channel) => sum + getShortsForChannel(channel), 0);
    }
    
    const completedForDay = countDoneStatuses(dayData);
    const inProgressToday = hasInProgress(dayData);

    if (totalForDay > 0) {
      const progressPercentage = (completedForDay / totalForDay) * 100;
      const progressBar = document.createElement('div');
      progressBar.classList.add('day-progress-bar');
      progressBar.style.width = `${progressPercentage}%`;
      dayBox.appendChild(progressBar);
      if (progressPercentage === 100) dayBox.classList.add('completed-day');
      else if (completedForDay > 0 || inProgressToday) dayBox.classList.add('partial-day');
      else dayBox.classList.add('pending-day');
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
  if (channels.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    alert('Este canal ya existe.');
    return;
  }
  const newChannel = {
    id: genId(), name, voice: '', music: '', style: '', subtitles: '', shortsOverride: null
  };
  channels.push(newChannel);
  await saveData();
  renderChannels();
  renderCalendar();
  updateSettingsExtras();
}

async function removeChannel(channelId) {
    const channelToRemove = channels.find(c => c.id === channelId);
    if (!channelToRemove) return;
    if (!confirm(`¿Estás seguro de que quieres eliminar el canal "${channelToRemove.name}"?`)) {
        return;
    }
    channels = channels.filter(c => c.id !== channelId);
    if (userData.calendar) {
        for (const dateKey in userData.calendar) {
            if (userData.calendar[dateKey].channels && userData.calendar[dateKey].channels[channelToRemove.name]) {
                delete userData.calendar[dateKey].channels[channelToRemove.name];
            }
        }
    }
    await saveData();
    renderChannels();
    renderCalendar();
    updateSettingsExtras();
    console.log(`✅ Canal "${channelToRemove.name}" eliminado.`);
}

function renderChannels() {
    channelList.innerHTML = '';
    if (!channels || channels.length === 0) {
        const li = document.createElement('li');
        li.innerText = 'No hay canales. ¡Añade uno!';
        channelList.appendChild(li);
        return;
    }
    
    channels.sort((a, b) => a.name.localeCompare(b.name));
    channels.forEach(channel => {
        const li = document.createElement('li');
        const nameSpan = document.createElement('span');
        nameSpan.textContent = channel.name;
        
        const buttonsDiv = document.createElement('div');
        
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.innerHTML = '✏️';
        editBtn.title = 'Editar detalles';
        editBtn.addEventListener('click', () => openEditModal(channel.id));
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '-';
        removeBtn.title = 'Eliminar canal';
        removeBtn.addEventListener('click', () => removeChannel(channel.id));
        
        buttonsDiv.appendChild(editBtn);
        buttonsDiv.appendChild(removeBtn);
        li.appendChild(nameSpan);
        li.appendChild(buttonsDiv);
        channelList.appendChild(li);
    });
}

async function updateShortsPerChannel() {
  if (!currentUser) return;
  await saveData();
  renderCalendar();
  calculateAndDisplayStreak();
}

// --- EDICIÓN DE CANAL ---
function openEditModal(channelId) {
  const channel = channels.find(c => c.id === channelId);
  if (channel) {
    editChannelIdInput.value = channel.id;
    editChannelNameInput.value = channel.name;
    editChannelShortsOverrideInput.value = channel.shortsOverride || '';
    editChannelVoiceInput.value = channel.voice || '';
    editChannelMusicInput.value = channel.music || '';
    editChannelStyleInput.value = channel.style || '';
    editChannelSubtitlesInput.value = channel.subtitles || '';
    editChannelModal.classList.remove('hide');
  }
}

function closeEditModal() {
  editChannelModal.classList.add('hide');
}

async function saveChannelEdit(event) {
  event.preventDefault();
  const channelId = editChannelIdInput.value;
  const channelIndex = channels.findIndex(c => c.id === channelId);

  if (channelIndex > -1) {
    const oldName = channels[channelIndex].name;
    const newName = editChannelNameInput.value.trim();

    channels[channelIndex].name = newName;
    channels[channelIndex].voice = editChannelVoiceInput.value.trim();
    channels[channelIndex].music = editChannelMusicInput.value.trim();
    channels[channelIndex].style = editChannelStyleInput.value.trim();
    channels[channelIndex].subtitles = editChannelSubtitlesInput.value.trim();
    
    const overrideValue = parseInt(editChannelShortsOverrideInput.value);
    channels[channelIndex].shortsOverride = !isNaN(overrideValue) && overrideValue > 0 ? overrideValue : null;

    if (oldName !== newName && userData.calendar) {
        for (const dateKey in userData.calendar) {
            if (userData.calendar[dateKey].channels && userData.calendar[dateKey].channels[oldName]) {
                userData.calendar[dateKey].channels[newName] = userData.calendar[dateKey].channels[oldName];
                delete userData.calendar[dateKey].channels[oldName];
            }
        }
    }

    await saveData();
    renderChannels();
    renderCalendar();
    closeEditModal();
  }
}

// --- CHECKLIST ---
function openChecklistModal(date) {
  if (!currentUser) return;
  clicked = date;
  checklistTitle.innerText = `Contenido para ${new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
  checklistContainer.innerHTML = '';

  const totalExpectedShorts = channels.reduce((sum, channel) => sum + getShortsForChannel(channel), 0);
  let completedShortsToday = 0;

  if (channels.length === 0) {
    checklistContainer.innerHTML = '<p>Añade canales en Configuración para empezar.</p>';
  } else {
    channels.forEach(channel => {
      const channelDiv = document.createElement('div');
      channelDiv.classList.add('channel-checklist-group');
      channelDiv.innerHTML = `<h4>${channel.name}</h4>`;
      
      const styleInfoDiv = document.createElement('div');
      styleInfoDiv.className = 'channel-style-info';
      styleInfoDiv.innerHTML = `
        <p><strong>Voz:</strong> ${channel.voice || 'No especificada'}</p>
        <p><strong>Música:</strong> ${channel.music || 'No especificada'}</p>
        <p><strong>Estilo:</strong> ${channel.style || 'No especificado'}</p>
        <p><strong>Subtítulos:</strong> ${channel.subtitles || 'No especificados'}</p>
      `;
      channelDiv.appendChild(styleInfoDiv);

      const numShorts = getShortsForChannel(channel);
      
      for (let i = 0; i < numShorts; i++) {
        const shortId = `short_${i}`;
        const currentStatus = userData?.calendar?.[date]?.channels?.[channel.name]?.[shortId] || 'pending';
        if (currentStatus === 'done') completedShortsToday++;
        
        const row = document.createElement('div');
        row.classList.add('checklist-item');
        row.innerHTML = `
          <span class="item-label">Short ${i + 1}</span>
          <div class="status-buttons">
            <button class="status-btn pending ${currentStatus === 'pending' ? 'active' : ''}" data-status="pending" data-channel="${channel.name}" data-short="${shortId}" data-date="${date}">⏳</button>
            <button class="status-btn inprogress ${currentStatus === 'in_progress' ? 'active' : ''}" data-status="in_progress" data-channel="${channel.name}" data-short="${shortId}" data-date="${date}">🛠️</button>
            <button class="status-btn done ${currentStatus === 'done' ? 'active' : ''}" data-status="done" data-channel="${channel.name}" data-short="${shortId}" data-date="${date}">✅</button>
          </div>
        `;
        channelDiv.appendChild(row);
      }
      checklistContainer.appendChild(channelDiv);
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
  if (!userData.calendar[date]) userData.calendar[date] = { channels: {}, dailyGoal: null };
  if (!userData.calendar[date].channels) userData.calendar[date].channels = {};
  if (!userData.calendar[date].channels[channelName]) userData.calendar[date].channels[channelName] = {};

  if (!userData.calendar[date].dailyGoal) {
    const totalExpectedOnThisDay = channels.reduce((sum, ch) => sum + getShortsForChannel(ch), 0);
    userData.calendar[date].dailyGoal = totalExpectedOnThisDay;
  }

  userData.calendar[date].channels[channelName][shortId] = status;
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
    let streakCount = 0;
    let checkDate = new Date(today);

    while (true) {
        const dateKey = checkDate.toISOString().split('T')[0];
        
        let totalExpected;
        const dayDataForStreak = userData.calendar?.[dateKey];
        if (dayDataForStreak && dayDataForStreak.dailyGoal) {
          totalExpected = dayDataForStreak.dailyGoal;
        } else {
          totalExpected = channels.reduce((sum, ch) => sum + getShortsForChannel(ch), 0);
        }

        const completed = countDoneStatuses(dayDataForStreak);
        
        if (totalExpected > 0 && completed === totalExpected) {
            streakCount++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            if (checkDate.getTime() !== today.getTime()) {
                break;
            }
            streakCount = 0;
            break;
        }
        if (streakCount > 3650) break;
    }

    if (userData.streak !== streakCount) {
        userData.streak = streakCount;
        await saveData();
    }
    currentStreakDisplay.innerText = `${streakCount} día${streakCount !== 1 ? 's' : ''}`;
}


// --- LOGROS ---
const achievementDefinitions = {
  'first_short': { title: 'Primer Short', description: '¡Publica tu primer short!', check: (data) => Object.keys(data.calendar || {}).length > 0 },
  'five_shorts': { title: 'Cinco Shorts', description: '¡Publica cinco shorts!', check: (data) => { let c=0; for(const d in data.calendar) if(data.calendar[d].channels) for(const ch in data.calendar[d].channels) c+=Object.values(data.calendar[d].channels[ch]).filter(s=>s==='done').length; return c>=5; } },
  'ten_shorts': { title: 'Diez Shorts', description: '¡Publica diez shorts!', check: (data) => { let c=0; for(const d in data.calendar) if(data.calendar[d].channels) for(const ch in data.calendar[d].channels) c+=Object.values(data.calendar[d].channels[ch]).filter(s=>s==='done').length; return c>=10; } },
  'first_streak': { title: 'En Racha', description: '¡Mantén una racha de 3 días!', check: (data) => data.streak >= 3 },
  'seven_streak': { title: 'Racha de la Semana', description: '¡Mantén una racha de 7 días!', check: (data) => data.streak >= 7 },
  'thirty_streak': { title: 'Racha Legendaria', description: '¡Mantén una racha de 30 días!', check: (data) => data.streak >= 30 },
  'new_channel': { title: 'Diversificando', description: '¡Añade tu segundo canal!', check: (data) => data.channels.length >= 2 },
  'three_channels': { title: 'Creador Múltiple', description: '¡Gestiona 3 canales!', check: (data) => data.channels.length >= 3 }
};

async function checkAchievements() {
  if (!currentUser || !userData) return;
  if (!userData.achievements) userData.achievements = [];
  let achievementsUpdated = false;
  for (const id in achievementDefinitions) {
    if (!userData.achievements.includes(id) && achievementDefinitions[id].check(userData)) {
      userData.achievements.push(id);
      achievementsUpdated = true;
      showAchievementNotification(achievementDefinitions[id].title);
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
    achievementsContainer.innerHTML = '<p>Inicia sesión para ver tus logros.</p>';
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
    achievementsContainer.innerHTML = '<p>Aún no tienes logros. ¡Sigue publicando!</p>';
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

  // Eventos para el modal de edición
  editChannelForm.addEventListener('submit', saveChannelEdit);
  closeEditModalButton.addEventListener('click', closeEditModal);
  
  // Eventos de Analíticas
  analyticsButton.addEventListener('click', openAnalyticsModal);
  dailyLogButton.addEventListener('click', openSubscriberModal);
  subscriberForm.addEventListener('submit', saveSubscriberCounts);
  closeAnalyticsButton.addEventListener('click', () => analyticsModal.classList.add('hide'));

  // Evento centralizado para el checklist
  checklistContainer.addEventListener('click', async (e) => {
    if (e.target.classList.contains('status-btn')) {
        const button = e.target;
        const date = button.dataset.date;
        const channelName = button.dataset.channel;
        const shortId = button.dataset.short;
        const newStatus = button.dataset.status;
        
        await updateShortStatus(date, channelName, shortId, newStatus);
        
        // Solo recargamos el modal si sigue abierto
        if (!checklistModal.classList.contains('hide')) {
            openChecklistModal(date);
        }
        
        renderCalendar();
        calculateAndDisplayStreak();
        checkAchievements();
    }
  });


  renderCalendar();
}

init();
// --- FIN ---