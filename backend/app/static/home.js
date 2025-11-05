const token = localStorage.getItem('medassist_token');
if (!token) {
	location.href = '/login';
}

const user = JSON.parse(localStorage.getItem('medassist_user') || 'null');
const userLabel = document.getElementById('userLabel');
if (user && user.email) userLabel.textContent = user.email;

const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggle');
const recentsDiv = document.getElementById('recents');

function getRecents() {
	try { return JSON.parse(localStorage.getItem('medassist_recents') || '[]'); } catch { return []; }
}
function setRecents(list) {
	localStorage.setItem('medassist_recents', JSON.stringify(list.slice(0, 20)));
}
function renderRecents() {
	recentsDiv.innerHTML = '';
	const list = getRecents();
	if (!list.length) { recentsDiv.innerHTML = '<div class="small">No chats yet</div>'; return; }
	for (const item of list) {
		const div = document.createElement('div');
		div.className = 'item';
		div.textContent = item.q;
		div.onclick = () => {
			queryInput.value = item.q;
			sendBtn.click();
		};
		recentsDiv.appendChild(div);
	}
}

if (toggleBtn) toggleBtn.onclick = () => sidebar.classList.toggle('open');

document.getElementById('clear').onclick = () => { setRecents([]); renderRecents(); };
document.getElementById('logout').onclick = () => { localStorage.removeItem('medassist_token'); localStorage.removeItem('medassist_user'); location.href = '/login'; };

const messages = document.getElementById('messages');
const queryInput = document.getElementById('query');
const sendBtn = document.getElementById('send');
const micBtn = document.getElementById('mic');
const overlay = document.getElementById('overlay');
const overlayContent = document.getElementById('overlay-content');

function addMessage(text, who) {
	const div = document.createElement('div');
	div.className = `message ${who}`;
	div.textContent = text;
	messages.appendChild(div);
	messages.scrollTop = messages.scrollHeight;
}

async function api(path, method = 'GET', body) {
	const res = await fetch(path, {
		method,
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	return res.json();
}

async function sendQuery() {
	const q = queryInput.value.trim();
	if (!q) return;
	sendBtn.disabled = true;
	addMessage(q, 'user');
	queryInput.value = '';
	addMessage('Thinking...', 'bot');
	try {
		const res = await api('/api/rag/query', 'POST', { query: q, topK: 5 });
		messages.lastChild.textContent = res.answer || 'No answer.';
		if (res.matches && res.matches.length) {
			overlayContent.innerHTML = res.matches.map(m => `<div style='margin-bottom:8px'><div style='color:#9bb0d3;font-size:12px'>${m.source}</div><div>${m.text}</div></div>`).join('');
			overlay.hidden = false;
		}
		const list = getRecents();
		list.unshift({ q });
		setRecents(list);
		renderRecents();
	} finally {
		sendBtn.disabled = false;
	}
}

sendBtn.onclick = sendQuery;

// Enter-to-send
queryInput.addEventListener('keydown', (e) => {
	if (e.key === 'Enter' && !e.shiftKey) {
		e.preventDefault();
		sendQuery();
	}
});

// Voice input via Web Speech API
let recognition = null;
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
	const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
	recognition = new Rec();
	recognition.lang = 'en-US';
	recognition.interimResults = false;
	recognition.maxAlternatives = 1;

	recognition.onstart = () => { micBtn.classList.add('recording'); };
	recognition.onend = () => { micBtn.classList.remove('recording'); };
	recognition.onerror = () => { micBtn.classList.remove('recording'); };
	recognition.onresult = (ev) => {
		const transcript = ev.results[0][0].transcript || '';
		queryInput.value = transcript;
		queryInput.focus();
	};
} else {
	micBtn.title = 'Voice not supported in this browser';
}

micBtn.onclick = () => {
	if (!recognition) { alert('Voice input not supported in this browser.'); return; }
	try { recognition.start(); } catch (_) { /* ignore double start */ }
};

renderRecents();
