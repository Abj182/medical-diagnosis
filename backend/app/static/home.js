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

sendBtn.onclick = async () => {
	const q = queryInput.value.trim();
	if (!q) return;
	addMessage(q, 'user');
	queryInput.value = '';
	addMessage('Thinking...', 'bot');
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
};

renderRecents();
