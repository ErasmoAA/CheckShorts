let nav = 0;
let clickedDate = null;
let channels = [];
let shortsPerChannel = 2; // Valor por defecto
// dailyProgress ahora almacenará un objeto para cada día, con el array de booleanos Y el shortsPerChannel con el que se creó ese progreso
let dailyProgress = {}; // { 'YYYY-MM-DD': { progress: [true, false], shortsNum: 2, channelsNum: 4 } }

// Elementos del DOM
const calendar = document.getElementById('calendar');
const monthDisplay = document.getElementById('monthDisplay');
const settingsButton = document.getElementById('settingsButton');
const setupModal = document.getElementById('setupModal');
const checklistModal = document.getElementById('checklistModal');
const addChannelForm = document.getElementById('addChannelForm');
const newChannelNameInput = document.getElementById('newChannelName');
const channelList = document.getElementById('channelList');
const shortsPerChannelInput = document.getElementById('shortsPerChannel');
const closeChecklistButton = document.getElementById('closeChecklistButton');
const closeSetupButton = document.getElementById('closeSetupButton');
const dailyProgressBarFill = document.querySelector('#dailyProgressBar .progress-bar-fill');
const dailyProgressText = document.getElementById('dailyProgressText');
const weeklyProgressBarFill = document.querySelector('#weeklyProgressBar .progress-bar-fill');
const weeklyProgressText = document.getElementById('weeklyProgressText');

// --- MANEJO DE DATOS (localStorage) ---
function saveData() {
    localStorage.setItem('myContentCalendarChannels', JSON.stringify(channels));
    localStorage.setItem('myContentCalendarShortsNum', shortsPerChannel); // Guardar el número actual de shorts
    localStorage.setItem('myContentCalendarProgress', JSON.stringify(dailyProgress));
}

function loadData() {
    const channelsData = localStorage.getItem('myContentCalendarChannels');
    const shortsNumData = localStorage.getItem('myContentCalendarShortsNum');
    const progressData = localStorage.getItem('myContentCalendarProgress');
    
    channels = channelsData ? JSON.parse(channelsData) : [];
    shortsPerChannel = shortsNumData ? parseInt(shortsNumData, 10) : 2;
    dailyProgress = progressData ? JSON.parse(progressData) : {};

    shortsPerChannelInput.value = shortsPerChannel; // Actualizar el input
}

// --- MODAL DE CONFIGURACIÓN ---
function renderChannelList() {
    channelList.innerHTML = '';
    channels.forEach((channelName, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${channelName}</span><button class="delete-channel-btn">X</button>`;
        li.querySelector('.delete-channel-btn').addEventListener('click', () => deleteChannel(index));
        channelList.appendChild(li);
    });
}

function addChannel(name) {
    if (name && !channels.includes(name)) {
        channels.push(name);
        renderChannelList();
        saveDataAndRender(true); // Pasar true para indicar que hubo un cambio en canales
    }
}

function deleteChannel(index) {
    channels.splice(index, 1);
    renderChannelList();
    saveDataAndRender(true); // Pasar true para indicar que hubo un cambio en canales
}

function updateShortsPerChannel() {
    const newValue = parseInt(shortsPerChannelInput.value, 10);
    if (newValue && newValue > 0 && newValue !== shortsPerChannel) { // Solo si el valor es válido y diferente
        shortsPerChannel = newValue;
        saveDataAndRender(true); // Pasar true para indicar que hubo un cambio en shortsPerChannel
    } else {
        // Si el valor no es válido, restaurar el valor anterior en el input
        shortsPerChannelInput.value = shortsPerChannel; 
    }
}

function saveDataAndRender(configChanged = false) {
    // Si la configuración (canales o shorts/canal) ha cambiado, debemos limpiar el progreso FUTURO
    if (configChanged) {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        const newDailyProgress = {};
        for (const date in dailyProgress) {
            // Solo copiamos el progreso de días pasados
            if (date < todayStr) { 
                newDailyProgress[date] = dailyProgress[date];
            }
        }
        dailyProgress = newDailyProgress; // Reemplazar el progreso con el "limpiado"
    }
    saveData();
    renderCalendar();
}

// --- MODAL DE CHECKLIST ---
function openChecklistModal(date) {
    const channelsCount = channels.length;
    // Obtener la configuración de shorts para ESE día específico
    const currentDayConfig = dailyProgress[date] || { shortsNum: shortsPerChannel, channelsNum: channelsCount, progress: [] };
    const shortsNumForThisDay = currentDayConfig.shortsNum;
    const channelsNumForThisDay = currentDayConfig.channelsNum;
    const totalDailyVideos = channelsNumForThisDay * shortsNumForThisDay;

    if (totalDailyVideos === 0) {
        alert("Primero añade al menos un canal y define el número de shorts en la configuración.");
        return;
    }

    clickedDate = date;
    const progressArray = currentDayConfig.progress || Array(totalDailyVideos).fill(false);
    
    const checklistTitle = document.getElementById('checklistTitle');
    const [year, month, day] = date.split('-').map(Number);
    checklistTitle.innerText = `Progreso para ${day}/${month}/${year}`;

    const checklistContainer = document.getElementById('checklist-container');
    checklistContainer.innerHTML = '';

    // Renderizar los checklists basados en la configuración de *ese día*
    for (let channelIndex = 0; channelIndex < channelsNumForThisDay; channelIndex++) {
        const channelName = channels[channelIndex] || `Canal ${channelIndex + 1}`; // Usar nombre si existe
        const group = document.createElement('div');
        group.classList.add('channel-group');
        group.innerHTML = `<h4>${channelName}</h4>`;

        for (let i = 0; i < shortsNumForThisDay; i++) {
            const videoIndex = channelIndex * shortsNumForThisDay + i;
            const itemId = `video-${date}-${videoIndex}`;
            
            const item = document.createElement('div');
            item.classList.add('checklist-item');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = itemId;
            checkbox.checked = progressArray[videoIndex];
            checkbox.addEventListener('change', () => updateProgress(videoIndex, checkbox.checked));
            
            const label = document.createElement('label');
            label.htmlFor = itemId;
            label.innerText = `Short ${i + 1}`;
            
            item.appendChild(checkbox);
            item.appendChild(label);
            group.appendChild(item);
        }
        checklistContainer.appendChild(group);
    }

    updateDailyProgressBar(shortsNumForThisDay, channelsNumForThisDay);
    checklistModal.classList.remove('hide');
}

function updateProgress(videoIndex, isChecked) {
    const channelsCount = channels.length;
    const totalDailyVideos = channelsCount * shortsPerChannel; // Siempre usamos la configuración actual para un nuevo update
    
    // Si no existe el registro de este día, o si la configuración ha cambiado, inicializamos
    if (!dailyProgress[clickedDate] || dailyProgress[clickedDate].shortsNum !== shortsPerChannel || dailyProgress[clickedDate].channelsNum !== channelsCount) {
        dailyProgress[clickedDate] = {
            progress: Array(totalDailyVideos).fill(false),
            shortsNum: shortsPerChannel,
            channelsNum: channelsCount
        };
    }
    
    dailyProgress[clickedDate].progress[videoIndex] = isChecked;
    saveData();
    updateDailyProgressBar(shortsPerChannel, channelsCount);
    renderCalendar();
}

function updateDailyProgressBar(shortsNum, channelsNum) {
    const totalDailyVideos = channelsNum * shortsNum;
    if (totalDailyVideos === 0) {
        dailyProgressText.innerText = `0/0`;
        dailyProgressBarFill.style.width = `0%`;
        return;
    }
    const progress = (dailyProgress[clickedDate] && dailyProgress[clickedDate].progress) || [];
    const completedCount = progress.filter(Boolean).length;
    const percentage = (completedCount / totalDailyVideos) * 100;
    
    dailyProgressText.innerText = `${completedCount}/${totalDailyVideos}`;
    dailyProgressBarFill.style.width = `${percentage}%`;
}

// --- LÓGICA DEL CALENDARIO ---
function renderCalendar() {
    const dt = new Date();
    if (nav !== 0) dt.setMonth(new Date().getMonth() + nav);
    const month = dt.getMonth();
    const year = dt.getFullYear();
    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const paddingDays = firstDayOfMonth.getDay(); 

    monthDisplay.innerText = `${dt.toLocaleDateString('es-ES', { month: 'long' }).toUpperCase()} ${year}`;
    calendar.innerHTML = '';
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    for (let i = 0; i < paddingDays + daysInMonth; i++) {
        const daySquare = document.createElement('div');
        daySquare.classList.add('day');
        
        if (i >= paddingDays) {
            const dayOfMonth = i - paddingDays + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
            
            daySquare.innerHTML = `<span class="day-number">${dayOfMonth}</span><div class="progress-circle"></div>`;

            // Obtener el progreso y la configuración de shorts para ESE DÍA ESPECÍFICO
            const dayConfig = dailyProgress[dateStr];
            let totalVideosForThisDay = 0;
            let completedCountForThisDay = 0;

            if (dayConfig) {
                totalVideosForThisDay = dayConfig.channelsNum * dayConfig.shortsNum;
                completedCountForThisDay = dayConfig.progress.filter(Boolean).length;
            } else {
                // Si no hay configuración para este día, usar la configuración actual
                totalVideosForThisDay = channels.length * shortsPerChannel;
            }

            if (totalVideosForThisDay > 0) {
                const progressFraction = completedCountForThisDay / totalVideosForThisDay;
                const progressClassIndex = Math.round(progressFraction * 8); // Se mapea a 8 clases
                daySquare.classList.add(`progress-${progressClassIndex}`);
            }

            daySquare.addEventListener('click', () => openChecklistModal(dateStr));
            if (dateStr === todayStr) daySquare.classList.add('current-day');
        } else {
            daySquare.classList.add('padding');
        }
        calendar.appendChild(daySquare);
    }
    updateWeeklyProgressBar();
}

function updateWeeklyProgressBar() {
    const channelsCount = channels.length;
    
    if (channelsCount === 0) {
        weeklyProgressText.innerText = `0/0`;
        weeklyProgressBarFill.style.width = `0%`;
        return;
    }

    const dt = new Date();
    if (nav !== 0) dt.setMonth(new Date().getMonth() + nav);
    const year = dt.getFullYear();
    const month = dt.getMonth();
    const currentDayOfWeek = dt.getDay();

    let weeklyCompletedCount = 0;
    let maxWeeklyVideosPossible = 0;

    for (let i = 0; i < 7; i++) {
        const day = new Date(year, month, dt.getDate() - currentDayOfWeek + i);
        
        // Solo contamos días dentro del mes que se está visualizando
        if (day.getMonth() === month) {
            const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
            
            const dayConfig = dailyProgress[dateStr];
            if (dayConfig) {
                // Usar la configuración de shorts y canales que tenía ese día
                maxWeeklyVideosPossible += dayConfig.channelsNum * dayConfig.shortsNum;
                weeklyCompletedCount += dayConfig.progress.filter(Boolean).length;
            } else {
                // Si no hay progreso para el día, usar la configuración actual
                maxWeeklyVideosPossible += channelsCount * shortsPerChannel;
            }
        }
    }
    
    const percentage = maxWeeklyVideosPossible === 0 ? 0 : (weeklyCompletedCount / maxWeeklyVideosPossible) * 100;
    weeklyProgressText.innerText = `${weeklyCompletedCount}/${maxWeeklyVideosPossible}`;
    weeklyProgressBarFill.style.width = `${percentage}%`;
}

// --- INICIALIZACIÓN Y EVENTOS ---
function init() {
    loadData();

    if (channels.length === 0) {
        setupModal.classList.remove('hide');
    }
    renderChannelList();
    renderCalendar();

    addChannelForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addChannel(newChannelNameInput.value.trim());
        newChannelNameInput.value = '';
    });
    
    shortsPerChannelInput.addEventListener('change', updateShortsPerChannel);
    shortsPerChannelInput.addEventListener('input', updateShortsPerChannel); // También al escribir

    settingsButton.addEventListener('click', () => setupModal.classList.remove('hide'));
    closeSetupButton.addEventListener('click', () => setupModal.classList.add('hide'));
    closeChecklistButton.addEventListener('click', () => checklistModal.classList.add('hide'));
    document.getElementById('backButton').addEventListener('click', () => { nav--; renderCalendar(); });
    document.getElementById('nextButton').addEventListener('click', () => { nav++; renderCalendar(); });
}

init();