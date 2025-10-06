// --- script.js COMPLETO (SIN NOTIFICACIONES) ---

// --- VARIABLES GLOBALES Y SELECTORES ---
let nav = 0; // Controla el mes actual (0 = mes actual, 1 = siguiente mes, -1 = mes anterior)
let clicked = null; // Almacena la fecha en la que el usuario hizo clic
let channels = []; // Almacena la lista de canales del usuario
let currentUser = null; // Almacena el usuario de Firebase autenticado
let userData = null; // Almacena todos los datos del usuario de Firestore

const calendar = document.getElementById('calendar');
const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
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
        // handleAuthStatus se encargará de la carga de datos
    } catch (error) {
        console.error("Error al iniciar sesión con Google:", error);
        alert("Error al iniciar sesión: " + error.message);
    }
}

async function signOutGoogle() {
    try {
        await auth.signOut();
        // handleAuthStatus se encargará de resetear la interfaz
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
        // Limpiar datos y UI si no hay usuario
        channels = [];
        userData = null;
        renderCalendar(); // Renderizar con datos vacíos
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
            // Si no existen datos, inicializamos con valores por defecto
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
            await saveData(); // Guardar los datos iniciales
        }
    } catch (error) {
        console.error("Error al cargar datos:", error);
    }
}

async function saveData() {
    if (!currentUser || !userData) return;
    const docRef = db.collection('users').doc(currentUser.uid);
    try {
        // Actualizar el userData con los valores actuales del frontend
        userData.channels = channels;
        userData.shortsPerChannel = parseInt(shortsPerChannelInput.value);
        userData.lastLoginDate = new Date().toISOString().split('T')[0]; // Actualizar última fecha de login

        await docRef.set(userData, { merge: true }); // Usar merge para no sobrescribir todo el documento
        console.log("Datos guardados con éxito.");
    } catch (error) {
        console.error("Error al guardar datos:", error);
    }
}


// --- FUNCIONES DE CALENDARIO Y RENDERIZADO ---
function renderCalendar() {
    const dt = new Date(); // Fecha actual para obtener el mes y año
    if (nav !== 0) { // Si nav no es 0, significa que el usuario ha navegado
        dt.setMonth(new Date().getMonth() + nav);
    }

    const day = dt.getDate();
    const month = dt.getMonth();
    const year = dt.getFullYear();

    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dateString = firstDayOfMonth.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    });
    const paddingDays = weekdays.indexOf(dateString.split(', ')[0]);

    monthDisplay.innerText = `${dt.toLocaleDateString('es-ES', { month: 'long' })} ${year}`;

    calendar.innerHTML = ''; // Limpiar el calendario antes de renderizar

    let totalVideosThisWeek = 0;
    let completedVideosThisWeek = 0;
    const today = new Date(); // Usar una nueva instancia para evitar modificaciones

    // Calcular la fecha de inicio de la semana actual (domingo)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    for (let i = 1; i <= paddingDays + daysInMonth; i++) {
        const dayBox = document.createElement('div');
        dayBox.classList.add('day');

        const dayNumber = i - paddingDays;
        const formattedDay = dayNumber < 10 ? '0' + dayNumber : dayNumber;
        const formattedMonth = (month + 1) < 10 ? '0' + (month + 1) : (month + 1);
        const dateKey = `${year}-${formattedMonth}-${formattedDay}`;

        if (i > paddingDays) {
            dayBox.innerText = dayNumber;

            // Marcar el día actual
            const currentDay = new Date(year, month, dayNumber);
            if (currentDay.toDateString() === new Date().toDateString()) {
                dayBox.id = 'currentDay';
            }

            // Datos del día del calendario
            const dayData = userData?.calendar?.[dateKey];
            const totalForDay = (channels.length || 0) * (userData?.shortsPerChannel || 0);
            const completedForDay = dayData ? Object.values(dayData).flat().filter(s => s === 'done').length : 0;

            if (totalForDay > 0) {
                const progressPercentage = (completedForDay / totalForDay) * 100;
                const progressBar = document.createElement('div');
                progressBar.classList.add('day-progress-bar');
                progressBar.style.width = `${progressPercentage}%`;
                dayBox.appendChild(progressBar);

                if (progressPercentage === 100) {
                    dayBox.classList.add('completed-day');
                } else if (completedForDay > 0) {
                    dayBox.classList.add('partial-day');
                } else {
                    dayBox.classList.add('pending-day');
                }
            }


            dayBox.addEventListener('click', () => openChecklistModal(dateKey));

            // Calcular progreso semanal (solo para la semana actual y si el usuario está logueado)
            if (currentUser) {
                if (currentDay >= startOfWeek && currentDay < new Date(startOfWeek).setDate(startOfWeek.getDate() + 7)) {
                    totalVideosThisWeek += totalForDay;
                    completedVideosThisWeek += completedForDay;
                }
            }

        } else {
            dayBox.classList.add('padding');
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
        channels.push({ id: firebase.firestore.FieldValue.serverTimestamp(), name: name }); // Usar serverTimestamp para un ID único
        await saveData();
        renderChannels();
    } else {
        alert('Este canal ya existe.');
    }
}

async function removeChannel(name) {
    if (!currentUser) return;
    channels = channels.filter(c => c.name !== name);
    // Opcional: limpiar los datos de este canal del calendario si se elimina
    // Podría ser complejo, por ahora solo lo removemos de la lista de canales
    await saveData();
    renderChannels();
    renderCalendar(); // Volver a renderizar el calendario para reflejar los cambios
}

function renderChannels() {
    channelList.innerHTML = '';
    if (channels.length === 0) {
        const li = document.createElement('li');
        li.innerText = 'No hay canales. ¡Añade uno!';
        channelList.appendChild(li);
    } else {
        channels.sort((a, b) => a.name.localeCompare(b.name)); // Ordenar alfabéticamente
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
    renderCalendar(); // Volver a renderizar el calendario para reflejar los cambios
}


// --- FUNCIONES DEL MODAL DE CHECKLIST ---
function openChecklistModal(date) {
    if (!currentUser) {
        alert('Por favor, inicia sesión para gestionar tu calendario.');
        return;
    }
    clicked = date; // Guarda la fecha actual
    checklistTitle.innerText = `Contenido para ${new Date(date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
    checklistContainer.innerHTML = ''; // Limpiar el checklist anterior

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
                const shortId = `${channel.name}_${i}`;
                const isDone = userData?.calendar?.[date]?.[channel.name]?.[shortId] === 'done';
                if (isDone) completedShortsToday++;

                const checkboxDiv = document.createElement('div');
                checkboxDiv.classList.add('checklist-item');
                checkboxDiv.innerHTML = `
                    <input type="checkbox" id="${date}-${shortId}" ${isDone ? 'checked' : ''}>
                    <label for="${date}-${shortId}">Short ${i + 1} (${channel.name})</label>
                    <div class="status-buttons">
                        <button class="status-btn done ${isDone ? 'active' : ''}" data-status="done">✅</button>
                        <button class="status-btn pending ${!isDone && userData?.calendar?.[date]?.[channel.name]?.[shortId] === 'pending' ? 'active' : ''}" data-status="pending">⏳</button>
                        <button class="status-btn fail ${!isDone && userData?.calendar?.[date]?.[channel.name]?.[shortId] === 'fail' ? 'active' : ''}" data-status="fail">❌</button>
                    </div>
                `;
                channelDiv.appendChild(checkboxDiv);

                checkboxDiv.querySelectorAll('.status-btn').forEach(button => {
                    button.addEventListener('click', async (e) => {
                        const newStatus = e.target.dataset.status;
                        await updateShortStatus(date, channel.name, shortId, newStatus);
                        openChecklistModal(date); // Recargar el modal para actualizar UI y contadores
                        renderCalendar(); // Actualizar el calendario principal
                        calculateAndDisplayStreak(); // Recalcular racha
                        checkAchievements(); // Comprobar logros
                    });
                });
            }
        });
    }

    // Actualizar la barra de progreso diaria en el modal
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
    today.setHours(0, 0, 0, 0); // Normalizar a medianoche

    // Asegurarse de que lastLoginDate esté en formato de fecha para comparación
    let lastLoginDate = new Date(userData.lastLoginDate || '1970-01-01');
    lastLoginDate.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(today.getTime() - lastLoginDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const totalExpectedToday = (channels.length || 0) * (userData.shortsPerChannel || 0);
    const todayDateKey = today.toISOString().split('T')[0];
    const completedToday = userData.calendar?.[todayDateKey] ? Object.values(userData.calendar[todayDateKey]).flat().filter(s => s === 'done').length : 0;

    if (diffDays === 0) { // Mismo día, solo actualiza la racha visual si ya se completó
        if (completedToday === totalExpectedToday && totalExpectedToday > 0) {
            currentStreakDisplay.innerText = `${userData.streak} días (Hoy completado)`;
        } else {
             currentStreakDisplay.innerText = `${userData.streak} días`;
        }
    } else if (diffDays === 1) { // Ayer fue el último login, posible continuación de racha
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const yesterdayDateKey = yesterday.toISOString().split('T')[0];

        const totalExpectedYesterday = (channels.length || 0) * (userData.shortsPerChannel || 0);
        const completedYesterday = userData.calendar?.[yesterdayDateKey] ? Object.values(userData.calendar[yesterdayDateKey]).flat().filter(s => s === 'done').length : 0;

        if (totalExpectedYesterday > 0 && completedYesterday === totalExpectedYesterday) {
            // La racha continúa, actualizamos la fecha de login
            if (completedToday === totalExpectedToday && totalExpectedToday > 0) {
                 userData.streak = (userData.streak || 0) + 1; // Si hoy también está completo, incrementa la racha
                 currentStreakDisplay.innerText = `${userData.streak} días`;
                 await saveData();
            } else {
                currentStreakDisplay.innerText = `${userData.streak} días`; // Todavía no completo hoy, muestra racha actual
            }
        } else {
            // Ayer no se completó, la racha se rompe
            userData.streak = 0;
            currentStreakDisplay.innerText = '0 días';
            await saveData();
        }
    } else { // Más de un día de diferencia, la racha se rompe
        userData.streak = 0;
        currentStreakDisplay.innerText = '0 días';
        await saveData();
    }

    // Comprobar si se completó hoy por primera vez para incrementar la racha
    if (completedToday === totalExpectedToday && totalExpectedToday > 0 && userData.lastLoginDate !== todayDateKey) {
        userData.streak = (userData.streak || 0) + 1;
        userData.lastLoginDate = todayDateKey; // Actualiza la fecha para evitar doble conteo
        await saveData();
    }
     currentStreakDisplay.innerText = `${userData.streak || 0} días`; // Asegurarse de mostrar el valor final


    checkAchievements(); // Comprobar logros después de actualizar la racha
}

// --- FUNCIONES DE LOGROS (GAMIFICACIÓN) ---
const achievementDefinitions = {
    'first_short': { title: 'Primer Short', description: '¡Publica tu primer short!', check: (data) => {
        let totalCompleted = 0;
        for (const dateKey in data.calendar) {
            for (const channelName in data.calendar[dateKey]) {
                totalCompleted += Object.values(data.calendar[dateKey][channelName]).filter(s => s === 'done').length;
            }
        }
        return totalCompleted >= 1;
    }},
    'five_shorts': { title: 'Cinco Shorts', description: '¡Publica cinco shorts!', check: (data) => {
        let totalCompleted = 0;
        for (const dateKey in data.calendar) {
            for (const channelName in data.calendar[dateKey]) {
                totalCompleted += Object.values(data.calendar[dateKey][channelName]).filter(s => s === 'done').length;
            }
        }
        return totalCompleted >= 5;
    }},
    'ten_shorts': { title: 'Diez Shorts', description: '¡Publica diez shorts!', check: (data) => {
        let totalCompleted = 0;
        for (const dateKey in data.calendar) {
            for (const channelName in data.calendar[dateKey]) {
                totalCompleted += Object.values(data.calendar[dateKey][channelName]).filter(s => s === 'done').length;
            }
        }
        return totalCompleted >= 10;
    }},
    'first_streak': { title: 'Primer Racha', description: '¡Mantén una racha de 3 días!', check: (data) => data.streak >= 3 },
    'seven_streak': { title: 'Racha de la Semana', description: '¡Mantén una racha de 7 días!', check: (data) => data.streak >= 7 },
    'new_channel': { title: 'Nuevo Canal', description: '¡Añade tu segundo canal!', check: (data) => data.channels.length >= 2 },
    // Puedes añadir más logros aquí
};

async function checkAchievements() {
    if (!currentUser || !userData) return;

    let achievementsUpdated = false;
    for (const id in achievementDefinitions) {
        const achievement = achievementDefinitions[id];
        // Si el logro no ha sido ganado y la condición se cumple
        if (!userData.achievements.includes(id) && achievement.check(userData)) {
            userData.achievements.push(id);
            achievementsUpdated = true;
            console.log(`¡Logro desbloqueado: ${achievement.title}!`);
            // alert(`¡Logro desbloqueado: ${achievement.title}!`); // Opcional: mostrar un alert
        }
    }

    if (achievementsUpdated) {
        await saveData();
        renderAchievements(); // Actualizar la vista de logros si se abre el modal
    }
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
                    <span class="achievement-title">🏆 ${achievement.title}</span>
                    <span class="achievement-description">${achievement.description}</span>
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
    auth.onAuthStateChanged(handleAuthStatus); // Manejar cambios en el estado de autenticación

    addChannelForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addChannel(newChannelNameInput.value.trim());
        newChannelNameInput.value = '';
    });
    
    shortsPerChannelInput.addEventListener('change', updateShortsPerChannel);
    shortsPerChannelInput.addEventListener('input', updateShortsPerChannel);

    settingsButton.addEventListener('click', () => setupModal.classList.remove('hide'));
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

    renderCalendar(); // Renderizar el calendario al inicio
}

init();

// --- FIN DEL ARCHIVO script.js ---