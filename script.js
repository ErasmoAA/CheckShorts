// ======================================================
// scripts.js - VERSIÓN CON EDICIÓN DE CANALES
// Incorpora la funcionalidad para editar nombres y añadir detalles de estilo.
// ======================================================

// --- VARIABLES GLOBALES Y SELECTORES ---
let nav = 0;
let clicked = null;
let channels = []; // Ahora será un array de objetos: [{id, name, voice, music, style}]
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

// NUEVOS SELECTORES PARA EL MODAL DE EDICIÓN
const editChannelModal = document.getElementById('editChannelModal');
const editChannelForm = document.getElementById('editChannelForm');
const editChannelIdInput = document.getElementById('editChannelId');
const editChannelNameInput = document.getElementById('editChannelName');
const editChannelVoiceInput = document.getElementById('editChannelVoice');
const editChannelMusicInput = document.getElementById('editChannelMusic');
const editChannelStyleInput = document.getElementById('editChannelStyle');
const closeEditModalButton = document.getElementById('closeEditModalButton');


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
    if (!userData || !userData.calendar) return [];
    const inCalendar = new Set();
    const valid = (n) => {
        const s = (n ?? '').toString().trim();
        return s && s.toLowerCase() !== 'undefined';
    };
    for (const dateKey of Object.keys(userData.calendar)) {
        const day = userData.calendar[dateKey];
        if (!day || typeof day !== 'object') continue;
        for (const ch of Object.keys(day)) {
            if (valid(ch)) inCalendar.add(ch);
        }
    }
    // Ahora `channels` es un array de objetos, por lo que extraemos los nombres.
    const inChannels = new Set((channels || []).map(c => c.name));
    return [...inCalendar].filter(name => !inChannels.has(name));
}

// --- FUNCIONES DE MANTENIMIENTO Y REPARACIÓN ---

async function migrateAndRepairUserData() {
    if (!userData) return;

    let changed = false;
    
    // --- MIGRACIÓN AUTOMÁTICA DE LA ESTRUCTURA DE CANALES ---
    // Si detectamos que `channels` es un array de strings, lo convertimos a objetos.
    if (userData.channels && userData.channels.length > 0 && typeof userData.channels[0] === 'string') {
        console.log("Migrando estructura de canales de strings a objetos...");
        userData.channels = userData.channels.map(name => ({
            id: genId(),
            name: name,
            voice: '',
            music: '',
            style: ''
        }));
        changed = true; // Forzamos un guardado para persistir la nueva estructura.
    }
    
    const original = Array.isArray(userData.channels) ? userData.channels.slice() : []; // Usamos slice para clonar
    let normalized = [];

    // Nos aseguramos de que cada canal sea un objeto con ID.
    for (const item of original) {
        if (typeof item === 'object' && item.name) {
            normalized.push({
                id: item.id || genId(),
                name: item.name,
                voice: item.voice || '',
                music: item.music || '',
                style: item.style || ''
            });
        } else if (typeof item === 'string') { // Doble seguridad por si algo sale mal
            normalized.push({ id: genId(), name: item, voice: '', music: '', style: '' });
            changed = true;
        }
    }
    
    if(changed) {
        userData.channels = normalized;
    }

    if (userData.calendar && typeof userData.calendar === 'object') {
        for (const dateKey of Object.keys(userData.calendar)) {
            const day = userData.calendar[dateKey];
            if (!day || typeof day !== 'object') continue;

            if (Object.prototype.hasOwnProperty.call(day, 'undefined')) {
                delete day['undefined'];
                changed = true;
            }

            for (const channelName of Object.keys(day)) {
                const items = day[channelName];
                if (items && typeof items === 'object') {
                    for (const sId of Object.keys(items)) {
                        const s = items[sId];
                        if (s === 'fail') { items[sId] = 'pending'; changed = true; }
                        if (s === 'inprogress') { items[sId] = 'in_progress'; changed = true; }
                    }
                }
            }
        }
    }

    if (changed) {
        channels = userData.channels;
        await saveData();
    } else {
        channels = original;
    }
}

async function purgeOrphanChannelsFromCalendar() {
  if (!userData?.calendar) return;

  const keepNames = new Set((channels || []).map(c => c.name));
  let changed = false;
  const deletedOrphans = [];

  for (const dateKey of Object.keys(userData.calendar)) {
    const day = userData.calendar[dateKey];
    if (!day || typeof day !== 'object') continue;

    if ('undefined' in day) {
      delete day['undefined'];
      changed = true;
    }
    for (const key of Object.keys(day)) {
      if (!keepNames.has(key)) {
        deletedOrphans.push(key);
        delete day[key];
        changed = true;
      }
    }
  }

  if (changed) {
    await saveData();
    renderCalendar();
    updateSettingsExtras();

    const uniqueDeleted = [...new Set(deletedOrphans)];
    if (uniqueDeleted.length > 0) {
      alert(`Limpieza completada.\nCanales eliminados del calendario: ${uniqueDeleted.join(', ')}`);
    } else {
      alert('Limpieza completada. No se encontraron nuevos datos para eliminar.');
    }
  } else {
    alert('No se encontraron canales huérfanos para eliminar.');
  }
}

async function forceCleanOrphans() {
  console.log("--- INICIANDO LIMPIEZA FORZADA ---");

  if (!currentUser || !userData) {
    console.error("Error: Debes iniciar sesión para ejecutar la limpieza.");
    return;
  }

  const validChannelNames = new Set(userData.channels.map(c => c.name));
  console.log("Canales válidos según userData:", Array.from(validChannelNames));

  const orphans = new Set();
  for (const dateKey in userData.calendar) {
    const dayData = userData.calendar[dateKey];
    for (const channelName in dayData) {
      if (!validChannelNames.has(channelName)) {
        orphans.add(channelName);
      }
    }
  }

  if (orphans.size === 0) {
    console.log("✅ No se encontraron canales huérfanos.");
    return;
  }

  console.warn("Canales huérfanos encontrados:", Array.from(orphans));

  let changed = false;
  for (const dateKey in userData.calendar) {
    const dayData = userData.calendar[dateKey];
    for (const orphanName of orphans) {
      if (dayData[orphanName]) {
        console.log(`Eliminando "${orphanName}" del calendario para la fecha: ${dateKey}`);
        delete dayData[orphanName];
        changed = true;
      }
    }
  }

  if (changed) {
    console.log("Guardando el estado limpio en Firestore...");
    await saveData();
    console.log("¡Limpieza forzada completada! Recarga la página para verificar.");
  }

  console.log("--- FIN DE LA LIMPIEZA ---");
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
      await migrateAndRepairUserData(); // Esta función ahora se encarga de la migración
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
    const totalForDay = (channels.length || 0) * (userData?.shortsPerChannel || 0);
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


// --- CANALES (ACTUALIZADO PARA OBJETOS) ---
async function addChannel(name) {
  if (!name || !currentUser) return;
  name = name.toString().trim();
  if (channels.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    alert('Este canal ya existe.');
    return;
  }
  const newChannel = {
    id: genId(),
    name: name,
    voice: '',
    music: '',
    style: ''
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
    if (!confirm(`¿Estás seguro de que quieres eliminar el canal "${channelToRemove.name}"? Esta acción es permanente.`)) {
        return;
    }
    channels = channels.filter(c => c.id !== channelId);
    // Además de borrar el canal de la lista, limpiamos sus datos del calendario
    if (userData.calendar) {
        for (const dateKey in userData.calendar) {
            if (userData.calendar[dateKey][channelToRemove.name]) {
                delete userData.calendar[dateKey][channelToRemove.name];
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
  let value = parseInt(shortsPerChannelInput.value);
  if (isNaN(value) || value < 1) {
    value = 1;
    shortsPerChannelInput.value = 1;
  }
  userData.shortsPerChannel = value;
  await saveData();
  renderCalendar();
}

// --- EDICIÓN DE CANAL (NUEVAS FUNCIONES) ---
function openEditModal(channelId) {
  const channel = channels.find(c => c.id === channelId);
  if (channel) {
    editChannelIdInput.value = channel.id;
    editChannelNameInput.value = channel.name;
    editChannelVoiceInput.value = channel.voice || '';
    editChannelMusicInput.value = channel.music || '';
    editChannelStyleInput.value = channel.style || '';
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

    // Si el nombre del canal cambió, debemos actualizarlo en el calendario
    if (oldName !== newName && userData.calendar) {
        for (const dateKey in userData.calendar) {
            if (userData.calendar[dateKey][oldName]) {
                userData.calendar[dateKey][newName] = userData.calendar[dateKey][oldName];
                delete userData.calendar[dateKey][oldName];
            }
        }
    }

    await saveData();
    renderChannels();
    renderCalendar(); // Para reflejar cualquier cambio de nombre en el progreso
    closeEditModal();
  }
}


// --- CHECKLIST (ACTUALIZADO) ---
function openChecklistModal(date) {
  if (!currentUser) return;
  clicked = date;
  checklistTitle.innerText = `Contenido para ${new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
  checklistContainer.innerHTML = '';

  const totalExpectedShorts = (channels.length || 0) * (userData?.shortsPerChannel || 0);
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
      `;
      channelDiv.appendChild(styleInfoDiv);

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
        row.querySelectorAll('.status-btn').forEach(button => {
          button.addEventListener('click', async (e) => {
            const newStatus = e.currentTarget.dataset.status;
            await updateShortStatus(date, channel.name, shortId, newStatus);
            openChecklistModal(date); // Recargamos el modal para actualizar contadores
            renderCalendar();
            calculateAndDisplayStreak();
            checkAchievements();
          });
        });
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
    let streakCount = 0;
    let checkDate = new Date(today);

    // Bucle para contar la racha hacia atrás
    while (true) {
        const dateKey = checkDate.toISOString().split('T')[0];
        const totalExpected = (channels.length || 0) * (userData.shortsPerChannel || 0);
        const completed = countDoneStatuses(userData.calendar?.[dateKey]);
        
        if (totalExpected > 0 && completed === totalExpected) {
            streakCount++;
            checkDate.setDate(checkDate.getDate() - 1); // Retrocedemos un día
        } else {
            // Si el día de hoy no está completo, la racha de hoy es 0,
            // pero la racha "guardada" podría ser de ayer.
            // Si el día que falla no es hoy, rompemos.
            if (checkDate.getTime() !== today.getTime()) {
                break;
            }
            // Si es hoy el que falla, la racha es 0 y rompemos.
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
  'five_shorts': { title: 'Cinco Shorts', description: '¡Publica cinco shorts!', check: (data) => { let c=0; for(const d in data.calendar) for(const ch in data.calendar[d]) c+=Object.values(data.calendar[d][ch]).filter(s=>s==='done').length; return c>=5; } },
  'ten_shorts': { title: 'Diez Shorts', description: '¡Publica diez shorts!', check: (data) => { let c=0; for(const d in data.calendar) for(const ch in data.calendar[d]) c+=Object.values(data.calendar[d][ch]).filter(s=>s==='done').length; return c>=10; } },
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

  // NUEVOS EVENTOS PARA EL MODAL DE EDICIÓN
  editChannelForm.addEventListener('submit', saveChannelEdit);
  closeEditModalButton.addEventListener('click', closeEditModal);

  renderCalendar();
}

init();
// --- FIN ---