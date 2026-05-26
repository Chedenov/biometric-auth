const API = 'https://biometric-auth-03ew.onrender.com';
let currentUser = null;

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function showToast(msg, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast show ' + type;
    setTimeout(() => toast.className = 'toast', 3000);
}

function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    event.target.classList.add('active');
}

function base64ToUint8Array(base64) {
    const base64url = base64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64url.padEnd(base64url.length + (4 - base64url.length % 4) % 4, '=');
    const binary = atob(padded);
    return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
}

async function registerBegin() {
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();

    if (!username || !email) {
        showToast('Заполните все поля', 'error');
        return;
    }

    try {
        const res = await fetch(`${API}/auth/register/begin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail);

        const credential = await navigator.credentials.create({
            publicKey: {
                challenge: base64ToUint8Array(data.challenge),
                rp: { name: "BiometricAuth" },
                user: {
                    id: new TextEncoder().encode(String(data.user_id)),
                    name: username,
                    displayName: username
                },
                pubKeyCredParams: [
                    { type: "public-key", alg: -7 },
                    { type: "public-key", alg: -257 }
                ],
                authenticatorSelection: {
                    authenticatorAttachment: "platform",
                    userVerification: "required"
                },
                timeout: 60000,
            }
        });

        const credId = arrayBufferToBase64(credential.rawId);
        const clientData = arrayBufferToBase64(credential.response.clientDataJSON);
        const attestation = arrayBufferToBase64(credential.response.attestationObject);

        const res2 = await fetch(`${API}/auth/register/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                credential_id: credId,
                public_key: attestation,
                client_data: clientData,
                attestation
            })
        });
        const data2 = await res2.json();
        if (!res2.ok) throw new Error(data2.detail);

        showToast('Регистрация успешна!', 'success');
        setTimeout(() => showScreen('screen-login'), 1500);

    } catch (e) {
        console.error(e);
        showToast(e.message || 'Ошибка регистрации', 'error');
    }
}

async function loginBegin() {
    const username = document.getElementById('login-username').value.trim();
    if (!username) {
        showToast('Введите имя пользователя', 'error');
        return;
    }

    try {
        const res = await fetch(`${API}/auth/login/begin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail);

        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: base64ToUint8Array(data.challenge),
                allowCredentials: [{
                    type: "public-key",
                    id: base64ToUint8Array(data.credential_id)
                }],
                userVerification: "required",
                timeout: 60000,
            }
        });

        const clientData = arrayBufferToBase64(assertion.response.clientDataJSON);
        const authData = arrayBufferToBase64(assertion.response.authenticatorData);
        const signature = arrayBufferToBase64(assertion.response.signature);
        const credId = arrayBufferToBase64(assertion.rawId);

        const res2 = await fetch(`${API}/auth/login/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                credential_id: credId,
                client_data: clientData,
                authenticator_data: authData,
                signature
            })
        });
        const data2 = await res2.json();
        if (!res2.ok) throw new Error(data2.detail);

        currentUser = data2.user;
        showDashboard();

    } catch (e) {
        console.error(e);
        showToast(e.message || 'Ошибка входа', 'error');
    }
}

async function showDashboard() {
    document.getElementById('dash-username').textContent = currentUser.username;
    document.getElementById('dash-email').textContent = currentUser.email;
    showScreen('screen-dashboard');
    loadTasks();
    loadNotes();
    loadLogs();
}

// ЗАДАЧИ
async function loadTasks() {
    const res = await fetch(`${API}/notes/tasks/get/${currentUser.username}`);
    const data = await res.json();
    const list = document.getElementById('tasks-list');
    if (data.tasks.length === 0) {
        list.innerHTML = '<p class="empty">Задач пока нет</p>';
        return;
    }
    list.innerHTML = data.tasks.map(task => `
        <div class="task-item">
            <div class="task-check ${task.done ? 'done' : ''}" onclick="toggleTask(${task.id})">
                ${task.done ? '✓' : ''}
            </div>
            <span class="task-title ${task.done ? 'done' : ''}">${task.title}</span>
            <button class="task-delete" onclick="deleteTask(${task.id})">🗑</button>
        </div>
    `).join('');
}

async function addTask() {
    const input = document.getElementById('task-input');
    const title = input.value.trim();
    if (!title) return;

    await fetch(`${API}/notes/tasks/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username, title })
    });
    input.value = '';
    loadTasks();
}

async function toggleTask(id) {
    await fetch(`${API}/notes/tasks/toggle/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username })
    });
    loadTasks();
}

async function deleteTask(id) {
    await fetch(`${API}/notes/tasks/delete/${id}?username=${currentUser.username}`, {
        method: 'DELETE'
    });
    loadTasks();
}

// ЗАМЕТКИ
async function loadNotes() {
    const res = await fetch(`${API}/notes/get/${currentUser.username}`);
    const data = await res.json();
    const list = document.getElementById('notes-list');
    if (data.notes.length === 0) {
        list.innerHTML = '<p class="empty">Заметок пока нет</p>';
        return;
    }
    list.innerHTML = data.notes.map(note => `
        <div class="note-item">
            <div class="note-header">
                <span class="note-time">${new Date(note.created_at).toLocaleString('ru')}</span>
                <button class="note-delete" onclick="deleteNote(${note.id})">🗑</button>
            </div>
            <div>${note.content}</div>
        </div>
    `).join('');
}

async function addNote() {
    const input = document.getElementById('note-input');
    const content = input.value.trim();
    if (!content) return;

    await fetch(`${API}/notes/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username, content })
    });
    input.value = '';
    loadNotes();
    showToast('Заметка сохранена!', 'success');
}

async function deleteNote(id) {
    await fetch(`${API}/notes/delete/${id}?username=${currentUser.username}`, {
        method: 'DELETE'
    });
    loadNotes();
}

// ЛОГИ
async function loadLogs() {
    const res = await fetch(`${API}/users/logs/${currentUser.username}`);
    const data = await res.json();
    const list = document.getElementById('logs-list');
    if (data.logs.length === 0) {
        list.innerHTML = '<p class="empty">История пуста</p>';
        return;
    }
    list.innerHTML = data.logs.map(log => `
        <div class="log-item">
            <span>${log.event === 'login' ? '🔓' : '✨'}</span>
            <span class="log-text">${log.event === 'login' ? 'Вход' : 'Регистрация'}</span>
            <span class="log-time">${new Date(log.timestamp).toLocaleString('ru')}</span>
        </div>
    `).join('');
}

function logout() {
    currentUser = null;
    showScreen('screen-login');
    showToast('Вы вышли из системы');
}

// Enter для добавления задачи
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('task-input')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') addTask();
    });
});