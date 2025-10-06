// --- script.js COMPLETO Y CORREGIDO CON CALENDARIO REAL ---

// --- VARIABLES GLOBALES Y SELECTORES ---
let nav = 0; // Controla el mes actual (0 = mes actual, 1 = siguiente mes, -1 = mes anterior)
let clicked = null; // Almacena la fecha en la que el usuario hizo clic
let channels = []; // Almacena la lista de canales del usuario
let currentUser = null; // Almacena el usuario de Firebase autenticado
let userData = null; // Almacena todos los datos del usuario de Firestore

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


// --- FUNCIONES DE AUTENTICACIÓN ---
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
        console.log("Usuario autenticado:", user.displayName);
        userStatusDisplay.innerText = `Hola, ${user.displayName}`;
        googleSignInButton.classList.add('hide');
        signOutButton.classList.remove('hide');
        await loadData(user.uid);
        renderCalendar();
        renderChannels();
        calculateAndDisplayStreak();
    } else {
        console.log("No hay usuario autenticado.");
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


// --- FUNCIONES DE PERSISTENCIA DE DATOS (FIREBASE FIRESTORE) ---
async function loadData(uid) {
    if (!uid) return;
    const docRef = db.collection('users').doc(uid);
    try {
        const doc = await docRef.get();
        if (doc.exists) {
            userData = doc.data();
            console.log("Datos del usuario cargados:", userData);
            channels = userData.channels || [];
            shortsPerChannelInput.value = userData.shortsPerChannel || 2;
        } else {
            console.log("No existen datos para este usuario. Creando datos iniciales.");
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
        console.log("Datos guardados con éxito.");
    } catch (error) {
        console.error("Error al guardar datos:", error);
    }
}


// --- FUNCIONES DE CALENDARIO Y RENDERIZADO ---
function renderCalendar() {
    const dt = new Date();
    if (nav !== 0) {
        dt.setMonth(new Date().getMonth() + nav);
    }

    const month = dt.getMonth();
    const year = dt.getFullYear();

    // Primer día del mes
    const firstDayOfMonth = new Date(year, month, 1);
    // Último día del mes
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Obtener el día de la semana del primer día (0 = Domingo, 1 = Lunes, etc.)
    // Ajustar para que Lunes sea 0: (getDay() + 6) % 7
    const firstDayWeekday = firstDayOfMonth.getDay();
    const paddingDays = (firstDayWeekday + 6) % 7; // Lunes = 0, Martes = 1, ..., Domingo = 6

    // Mostrar mes y año
    monthDisplay.innerText = `${dt.toLocaleDateString('es-ES', { month: 'long' })} ${year}`;

    calendar.innerHTML = '';

    // Variables para progreso semanal
    let totalVideosThisWeek = 0;
    let completedVideosThisWeek = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calcular inicio de la semana actual (Lunes)
    const startOfWeek = new Date(today);
    const currentDayOfWeek = today.getDay();
    const daysFromMonday = (currentDayOfWeek + 6) % 7; // Días desde el lunes
    startOfWeek.setDate(today.getDate() - daysFromMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    // Renderizar días de padding (días vacíos antes del día 1)
    for (let i = 0; i < paddingDays; i++) {
        const paddingBox = document.createElement('div');
        paddingBox.classList.add('day', 'padding');
        calendar.appendChild(paddingBox);
    }

    // Renderizar días del mes
    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
        const dayBox = document.createElement('div');
        dayBox.classList.add('day');
        dayBox.innerText = dayNumber;

        // Crear fecha para este día
        const currentDay = new Date(year, month, dayNumber);
        currentDay.setHours(0, 0, 0, 0);

        // Marcar el día actual
        if (currentDay.getTime() === today.getTime()) {
            dayBox.classList.add('current-day');
        }

        // Formato de fecha para el calendario (YYYY-MM-DD)
        const formattedDay = dayNumber < 10 ? '0' + dayNumber : dayNumber;
        const formattedMonth = (month + 1) < 10 ? '0' + (month + 1) : (month + 1);
        const dateKey = `${year}-${formattedMonth}-${formattedDay}`;

        // Obtener datos del día
        const dayData = userData?.calendar?.[dateKey];
        const totalForDay = (channels.length || 0) * (userData?.shortsPerChannel || 0);
        const completedForDay = dayData ? Object.values(dayData).flat().filter(s => s === 'done').length : 0;

        if (totalForDay > 0) {
            const progressPercentage = (completedForDay / totalForDay) * 100;
            
            // Crear barra de progreso del día
            const progressBar = document.createElement('div');
            progressBar.classList.add('day-progress-bar');
            progressBar.style.width = `${progressPercentage}%`;
            dayBox.appendChild(progressBar);

            // Añadir clases de estado
            if (progressPercentage === 100) {
                dayBox.classList.add('completed-day');
            } else if (completedForDay > 0) {
                dayBox.classList.add('partial-day');
            } else {
                dayBox.classList.add('pending-day');
            }
        }

        // Evento de clic
        dayBox.addEventListener('click', () => openChecklistModal(dateKey));

        // Calcular progreso semanal (solo para la semana actual)
        if (currentUser && currentDay >= startOfWeek && currentDay < endOfWeek) {
            totalVideosThisWeek += totalForDay;
            completedVideosThisWeek += completedForDay;
        }

        calendar.appendChild(dayBox);
    }

    // Actualizar barra de progreso semanal
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


// --- FUNCIONES DE GESTIÓN DE CANALES ---
async function addChannel(name) {
    if (!name || !currentUser) return;
    if (!channels.some(c => c.name === name)) {
        channels.push({ id: Date.now().toString(), name: name });
        await saveData();
        renderChannels();
        renderCalendar();
    } else {
        alert('Este canal ya existe.');
    }
}

async function removeChannel(name) {
    if (!currentUser) return;
    channels = channels.filter(c => c.name !== name);
    
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
                <button class="remove-btn">-</button>
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


// --- FUNCIONES DEL MODAL DE CHECKLIST ---
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

                const checkboxDiv = document.createElement('div');
                checkboxDiv.classList.add('checklist-item');
                checkboxDiv.innerHTML = `
                    <span class="item-label">Short ${i + 1}</span>
                    <div class="status-buttons">
                        <button class="status-btn done ${currentStatus === 'done' ? 'active' : ''}" data-status="done" title="Completado">✅</button>
                        <button class="status-btn pending ${currentStatus === 'pending' ? 'active' : ''}" data-status="pending" title="Pendiente">⏳</button>
                        <button class="status-btn fail ${currentStatus === 'fail' ? 'active' : ''}" data-status="fail" title="No realizado">❌</button>
                    </div>
                `;
                channelDiv.appendChild(checkboxDiv);

                checkboxDiv.querySelectorAll('.status-btn').forEach(button => {
                    button.addEventListener('click', async (e) => {
                        const newStatus = e.target.dataset.status;
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


// --- FUNCIÓN DE RACHA ---
async function calculateAndDisplayStreak() {
    if (!currentUser || !userData) {
        currentStreakDisplay.innerText = '0 días';
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDateKey = today.toISOString().split('T')[0];

    const totalExpectedToday = (channels.length || 0) * (userData.shortsPerChannel || 0);
    const completedToday = userData.calendar?.[todayDateKey] ? 
        Object.values(userData.calendar[todayDateKey]).flat().filter(s => s === 'done').length : 0;
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
        const completed = userData.calendar?.[dateKey] ? 
            Object.values(userData.calendar[dateKey]).flat().filter(s => s === 'done').length : 0;
        
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


// --- FUNCIONES DE LOGROS (GAMIFICACIÓN) ---
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

    if (!userData.achievements) {
        userData.achievements = [];
    }

    let achievementsUpdated = false;
    for (const id in achievementDefinitions) {
        const achievement = achievementDefinitions[id];
        if (!userData.achievements.includes(id) && achievement.check(userData)) {
            userData.achievements.push(id);
            achievementsUpdated = true;
            console.log(`¡Logro desbloqueado: ${achievement.title}!`);
            showAchievementNotification(achievement.title);
        }
    }

    if (achievementsUpdated) {
        await saveData();
    }
}

function showAchievementNotification(title) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        z-index: 10000;
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


// --- INICIALIZACIÓN Y EVENT LISTENERS ---
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
    });
    closeSetupButton.addEventListener('click', () => setupModal.classList.add('hide'));
    closeChecklistButton.addEventListener('click', () => checklistModal.classList.add('hide'));
    
    document.getElementById('backButton').addEventListener('click', () => { 
        nav--; 
        renderCalendar(); 
    });
    document.getElementById('nextButton').addEventListener('click', () => { 
        nav++; 
        renderCalendar(); 
    });

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

// --- FIN DEL ARCHIVO script.js ---