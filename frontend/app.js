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

        // Запускаем WebAuthn
        const credential = await navigator.credentials.create({
            publicKey: {
                challenge: Uint8Array.from(atob(data.challenge), c => c.charCodeAt(0)),
               rp: { name: "BiometricAuth" },
                user: {
                    id: Uint8Array.from(String(data.user_id), c => c.charCodeAt(0)),
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

        // Отправляем на сервер
        const credId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
        const clientData = btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON)));
        const attestation = btoa(String.fromCharCode(...new Uint8Array(credential.response.attestationObject)));
        const pubKey = btoa(String.fromCharCode(...new Uint8Array(credential.response.attestationObject)));

        const res2 = await fetch(`${API}/auth/register/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, credential_id: credId, public_key: pubKey, client_data: clientData, attestation })
        });
        const data2 = await res2.json();
        if (!res2.ok) throw new Error(data2.detail);

        showToast('Регистрация успешна!', 'success');
        setTimeout(() => showScreen('screen-login'), 1500);

    } catch (e) {
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

        // Запускаем WebAuthn
        const credId = Uint8Array.from(atob(data.credential_id), c => c.charCodeAt(0));
        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: Uint8Array.from(atob(data.challenge), c => c.charCodeAt(0)),
                allowCredentials: [{ type: "public-key", id: credId }],
                userVerification: "required",
                timeout: 60000,
            }
        });

        const clientData = btoa(String.fromCharCode(...new Uint8Array(assertion.response.clientDataJSON)));
        const authData = btoa(String.fromCharCode(...new Uint8Array(assertion.response.authenticatorData)));
        const signature = btoa(String.fromCharCode(...new Uint8Array(assertion.response.signature)));

        const res2 = await fetch(`${API}/auth/login/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, credential_id: btoa(String.fromCharCode(...new Uint8Array(assertion.rawId))), client_data: clientData, authenticator_data: authData, signature })
        });
        const data2 = await res2.json();
        if (!res2.ok) throw new Error(data2.detail);

        currentUser = data2.user;
        showDashboard();

    } catch (e) {
        showToast(e.message || 'Ошибка входа', 'error');
    }
}

async function showDashboard() {
    document.getElementById('dash-username').textContent = currentUser.username;
    document.getElementById('dash-email').textContent = currentUser.email;

    const res = await fetch(`${API}/users/logs/${currentUser.username}`);
    const data = await res.json();

    const list = document.getElementById('logs-list');
    if (data.logs.length === 0) {
        list.innerHTML = '<p style="color:#4b5563;font-size:14px">История пуста</p>';
    } else {
        list.innerHTML = data.logs.map(log => `
            <div class="log-item">
                <span class="log-icon">${log.event === 'login' ? '🔓' : '✨'}</span>
                <span class="log-text">${log.event === 'login' ? 'Вход' : 'Регистрация'}</span>
                <span class="log-time">${new Date(log.timestamp).toLocaleString('ru')}</span>
            </div>
        `).join('');
    }

    showScreen('screen-dashboard');
}

function logout() {
    currentUser = null;
    showScreen('screen-login');
    showToast('Вы вышли из системы');
}