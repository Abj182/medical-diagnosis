const token = localStorage.getItem('medassist_token');
if (!token) { location.href = '/login'; }

// Elements
const layout = document.getElementById('layout');
const sidebar = document.getElementById('sidebar');
const sideToggle = document.getElementById('sideToggle');
const sideOpener = document.getElementById('sideOpener');
const recentsDiv = document.getElementById('recents');
const filterChips = document.querySelectorAll('.chipbar .chip');
const newChatBtn = document.getElementById('newChat');
const messages = document.getElementById('messages');
const queryInput = document.getElementById('query');
const sendBtn = document.getElementById('send');
const micBtn = document.getElementById('mic');
const overlay = document.getElementById('overlay');
const overlayContent = document.getElementById('overlay-content');
const overlayToggle = document.getElementById('overlayToggle');
const overlayClose = document.getElementById('overlayClose');

// Sidebar collapse/expand (persist). Only history collapses.
const COLLAPSE_KEY = 'medassist_sidebar_collapsed';
function setCollapsed(v){
	if (v) layout.classList.add('collapsed'); else layout.classList.remove('collapsed');
	localStorage.setItem(COLLAPSE_KEY, String(v ? 1 : 0));
	sideOpener.classList.toggle('hidden', !v);
}
setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
if (sideToggle) sideToggle.onclick = (e) => { e.stopPropagation(); setCollapsed(!layout.classList.contains('collapsed')); };
if (sideOpener) sideOpener.onclick = (e) => { e.stopPropagation(); setCollapsed(false); };
// Ensure clicks inside sidebar never toggle and always expand in case of overlap
sidebar.addEventListener('click', (e)=> { e.stopPropagation(); setCollapsed(false); });

let chatList = [];
let currentChatId = null;

async function api(path, method = 'GET', body) {
	const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
	return res.json();
}

async function loadChats() {
	const res = await api('/api/chats/list');
	chatList = res.chats || [];
	renderRecents();
}

async function openChat(id) {
	const res = await api(`/api/chats/get?id=${encodeURIComponent(id)}`);
	if (!res.chat) return;
	currentChatId = res.chat.id;
	renderConversation(res.chat.messages || []);
	[...recentsDiv.querySelectorAll('.item')].forEach(el => el.classList.toggle('active', el.dataset.id === id));
	messages.scrollTop = messages.scrollHeight;
}

async function createChat(tag='textbook') {
	const res = await api('/api/chats/create', 'POST', { title: 'New Chat', tag });
	currentChatId = res.id;
	await loadChats();
	renderConversation([]);
}

function renderConversation(msgs) {
	messages.innerHTML = '';
	for (const m of msgs) addMessage(m.text, m.role === 'user' ? 'user' : 'bot');
	messages.scrollTop = messages.scrollHeight;
}

function renderRecents() {
	recentsDiv.innerHTML = '';
	const activeFilter = document.querySelector('.chipbar .chip.active')?.dataset.filter || 'all';
	const filtered = chatList.filter(c => activeFilter === 'all' ? true : c.tag === activeFilter);
	if (!filtered.length) { recentsDiv.innerHTML = '<div class="small">No chats yet</div>'; return; }
	for (const c of filtered) {
		const div = document.createElement('div');
		div.className = 'item';
		div.dataset.id = c.id;
		div.textContent = c.title || 'Untitled';
		if (c.id === currentChatId) div.classList.add('active');
		recentsDiv.appendChild(div);
	}
}

recentsDiv.addEventListener('click', (e) => {
	const item = e.target.closest('.item');
	if (!item) return;
	e.stopPropagation();
	openChat(item.dataset.id);
});

filterChips.forEach(chip => chip.onclick = () => { filterChips.forEach(c=>c.classList.remove('active')); chip.classList.add('active'); renderRecents(); });

document.getElementById('clear').onclick = async () => {
	if (!confirm('This will permanently delete all your chats. Continue?')) return;
	await api('/api/chats/clear', 'POST'); chatList = []; currentChatId = null; renderRecents(); messages.innerHTML=''; };

document.getElementById('logout').onclick = () => { localStorage.clear(); location.href = '/login'; };

if (newChatBtn) newChatBtn.onclick = async () => { const tag = document.querySelector('.chipbar .chip.active')?.dataset.filter || 'textbook'; await createChat(tag==='all'?'textbook':tag); };

function addMessage(text, who) {
	const div = document.createElement('div');
	div.className = `message ${who}`;
	div.textContent = text;
	messages.appendChild(div);
	messages.scrollTop = messages.scrollHeight;
}

async function sendQuery() {
	if (!currentChatId) await createChat('textbook');
	const q = queryInput.value.trim(); if (!q) return;
	sendBtn.disabled = true;
	addMessage(q, 'user');
	await api('/api/chats/append', 'POST', { id: currentChatId, role: 'user', text: q });
	queryInput.value = '';
	addMessage('Thinking...', 'bot');
	try {
		const res = await api('/api/rag/query', 'POST', { query: q, topK: 5 });
		const answer = res.answer || 'No answer.';
		messages.lastChild.textContent = answer;
		await api('/api/chats/append', 'POST', { id: currentChatId, role: 'bot', text: answer });
		if (res.matches && res.matches.length) {
			overlayContent.innerHTML = res.matches.map(m => `<div style='margin-bottom:8px'><div style='color:#9bb0d3;font-size:12px'>${m.source}</div><div>${m.text}</div></div>`).join('');
			overlay.hidden = false;
		}
		await loadChats();
		[...recentsDiv.querySelectorAll('.item')].forEach(el => el.classList.toggle('active', el.dataset.id === currentChatId));
	} finally { sendBtn.disabled = false; }
}

sendBtn.onclick = sendQuery;
queryInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuery(); } });
queryInput.addEventListener('focus', () => { try { queryInput.scrollIntoView({ block: 'end', behavior: 'smooth' }); } catch(_){} });

// Voice input via Web Speech API
let recognition = null;
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
	const Rec = window.SpeechRecognition || window.webkitSpeechRecognition; recognition = new Rec(); recognition.lang = 'en-US'; recognition.interimResults = false; recognition.maxAlternatives = 1;
	recognition.onstart = () => { micBtn.classList.add('recording'); };
	recognition.onend = () => { micBtn.classList.remove('recording'); };
	recognition.onerror = () => { micBtn.classList.remove('recording'); };
	recognition.onresult = (ev) => { const transcript = ev.results[0][0].transcript || ''; queryInput.value = transcript; queryInput.focus(); };
} else { micBtn.title = 'Voice not supported in this browser'; }
micBtn.onclick = () => { if (!recognition) { alert('Voice input not supported.'); return; } try { recognition.start(); } catch(_){} };

// Overlay controls
overlayToggle.onclick = () => { overlay.hidden = !overlay.hidden; };
overlayClose.onclick = () => { overlay.hidden = true; };

// Bootstrap
(async function init(){ await loadChats(); if (chatList.length) { await openChat(chatList[0].id); } else { await createChat('textbook'); } })();
