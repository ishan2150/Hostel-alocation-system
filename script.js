// ---------- HOSTEL ALLOCATION: Robust script.js ----------
// This version waits for DOMContentLoaded, defends against corrupted localStorage,
// and logs helpful console messages if something goes wrong.

const defaultState = {
  rooms: [
    { no: '101', capacity: 2, occupied: 0 },
    { no: '102', capacity: 2, occupied: 0 },
    { no: '103', capacity: 3, occupied: 0 },
    { no: '104', capacity: 3, occupied: 1 },
    { no: '105', capacity: 2, occupied: 2 },
    { no: '106', capacity: 3, occupied: 0 },
    { no: '107', capacity: 2, occupied: 0 }
  ],
  requests: []
};

function loadState() {
  const s = localStorage.getItem('hostelState');
  if (!s) {
    localStorage.setItem('hostelState', JSON.stringify(defaultState));
    return structuredClone(defaultState);
  }
  try {
    const parsed = JSON.parse(s);
    // Defensive: if rooms is not an array, reset to default
    if (!parsed || !Array.isArray(parsed.rooms)) {
      console.warn('hostelState.rooms malformed — resetting to defaultState.');
      localStorage.setItem('hostelState', JSON.stringify(defaultState));
      return structuredClone(defaultState);
    }
    return parsed;
  } catch (e) {
    console.error('Failed to parse hostelState from localStorage — resetting to defaultState.', e);
    localStorage.setItem('hostelState', JSON.stringify(defaultState));
    return structuredClone(defaultState);
  }
}
function saveState(st) { localStorage.setItem('hostelState', JSON.stringify(st)); }

// Wait for DOM ready before accessing elements
document.addEventListener('DOMContentLoaded', () => {
  let state = loadState();

  // Elements (selected after DOM ready)
  const roomsDiv = document.getElementById('rooms');
  const availList = document.getElementById('availList');
  const nameEl = document.getElementById('name');
  const enrollEl = document.getElementById('enroll');
  const contactEl = document.getElementById('contact');
  const roommatesEl = document.getElementById('roommates');
  const applyBtn = document.getElementById('applyBtn');
  const clearBtn = document.getElementById('clearBtn');
  const msg = document.getElementById('msg');
  const requestsDiv = document.getElementById('requests');
  const adminPanel = document.getElementById('adminPanel');
  const adminLoginBox = document.getElementById('adminLoginBox');
  const adminLoginBtn = document.getElementById('adminLoginBtn');
  const openAdmin = document.getElementById('openAdmin');
  const adminUser = document.getElementById('adminUser');
  const adminPass = document.getElementById('adminPass');
  const adminMsg = document.getElementById('adminMsg');
  const logoutAdmin = document.getElementById('logoutAdmin');
  const hideLogin = document.getElementById('hideLogin');

  // If any core element is missing — log and stop to avoid runtime errors
  const requiredEls = { roomsDiv, availList, nameEl, enrollEl, contactEl, roommatesEl, applyBtn, clearBtn, msg, requestsDiv };
  for (const [k, v] of Object.entries(requiredEls)) {
    if (!v) {
      console.error(`Critical DOM element missing: ${k}. Check index.html contains element with id="${k === 'roomsDiv' ? 'rooms' : k.replace('El','')}"`);
      // show helpful visual hint if possible
      if (document.body) {
        const warn = document.createElement('div');
        warn.style.background = '#fee';
        warn.style.color = '#900';
        warn.style.padding = '10px';
        warn.style.margin = '10px';
        warn.textContent = `Error: required element "${k}" not found. Open console for details.`;
        document.body.prepend(warn);
      }
      return; // stop execution, prevents further exceptions
    }
  }

  // Helpers
  function getFreeSlots(r) { return Math.max(0, r.capacity - r.occupied); }
  function roommateCountFromSelect(val) { return Number(val); }
  function makeSelectable(el, onSelect) {
    el.setAttribute('tabindex', '0');
    el.addEventListener('click', onSelect);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(); });
  }

  let selectedRoom = null;

  function renderRoomChoices() {
    roomsDiv.innerHTML = '';
    // defensive: ensure state.rooms is array
    if (!state.rooms || !Array.isArray(state.rooms)) {
      console.warn('state.rooms invalid when rendering; resetting to default rooms.');
      state.rooms = structuredClone(defaultState.rooms);
      saveState(state);
    }

    // Show rooms that have at least 1 free slot
    state.rooms.forEach(r => {
      const free = getFreeSlots(r);
      const el = document.createElement('div');
      el.className = 'room' + (free < 1 ? ' unavailable' : '');
      el.innerHTML = `<strong>Room ${r.no}</strong><div class='meta'>Capacity: ${r.capacity} | Free: ${free}</div>`;
      if (free >= 1) {
        makeSelectable(el, () => {
          document.querySelectorAll('.room').forEach(x => x.classList.remove('selected'));
          el.classList.add('selected');
          selectedRoom = r.no;
        });
      }
      roomsDiv.appendChild(el);
    });

    // If nothing was appended, show a friendly message
    if (roomsDiv.children.length === 0) {
      const notice = document.createElement('div');
      notice.className = 'muted';
      notice.textContent = 'No rooms available right now.';
      roomsDiv.appendChild(notice);
      console.info('renderRoomChoices: no rooms appended (maybe all full).');
    }
  }

  function renderAvailableList() {
    availList.innerHTML = '';
    state.rooms.forEach(r => {
      const free = getFreeSlots(r);
      if (free > 0) {
        const div = document.createElement('div');
        div.innerHTML = `<strong>${r.no}</strong> - Capacity ${r.capacity}, Free ${free}`;
        availList.appendChild(div);
      }
    });
  }

  function renderRequests() {
    requestsDiv.innerHTML = '';
    if (state.requests.length === 0) requestsDiv.innerHTML = '<div class="muted">No requests yet</div>';
    state.requests.slice().reverse().forEach(rq => {
      const div = document.createElement('div');
      div.className = 'req';
      div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><div>
        <strong>${rq.name}</strong> <span class='muted'>(${rq.enroll})</span>
        <div class='muted small'>Room: ${rq.room} • Occupant: ${rq.occupantCount || 1} • Roommates claimed: ${rq.roommateCount || 0} • ${new Date(rq.appliedAt).toLocaleString()}</div>
      </div>
      <div>
        <span class='status ${rq.status==='approved'?'approved':rq.status==='rejected'?'rejected':'pending'}'>${rq.status}</span>
      </div></div>
      <div style='margin-top:8px' class='muted'>Contact: ${rq.contact}</div>`;

      const actions = document.createElement('div');
      actions.className = 'room-actions';

      if (rq.status === 'pending') {
        const app = document.createElement('button'); app.textContent = 'Approve';
        app.onclick = () => { approveRequest(rq.id); };
        const rej = document.createElement('button'); rej.textContent = 'Reject'; rej.className = 'btn-danger';
        rej.onclick = () => { rejectRequest(rq.id); };
        actions.appendChild(app); actions.appendChild(rej);
      }

      const info = document.createElement('button'); info.textContent = 'View Info'; info.className = 'btn-muted';
      info.onclick = () => {
        alert(`Name: ${rq.name}\nEnrollment: ${rq.enroll}\nContact: ${rq.contact}\nRoom: ${rq.room}\nApplicant occupies: ${rq.occupantCount || 1}\nRoommates claimed: ${rq.roommateCount || 0}\nStatus: ${rq.status}`);
      };
      actions.appendChild(info);

      div.appendChild(actions);
      requestsDiv.appendChild(div);
    });
  }

  // Actions
  applyBtn.addEventListener('click', () => {
    msg.textContent = '';
    const name = nameEl.value.trim();
    const enroll = enrollEl.value.trim();
    const contact = contactEl.value.trim();
    const roommates = roommateCountFromSelect(roommatesEl.value);
    const occupantCount = 1; // each approved application occupies 1 slot

    if (!name || !enroll || !contact) { msg.textContent = 'Please fill all fields.'; return; }
    if (isNaN(roommates) || roommates < 1) { msg.textContent = 'You must choose at least 1 roommate.'; return; }
    if (!selectedRoom) { msg.textContent = 'Please choose a room from the list.'; return; }

    const roomObj = state.rooms.find(r => r.no === selectedRoom);
    if (!roomObj) { msg.textContent = 'Selected room not found.'; return; }
    if (getFreeSlots(roomObj) < occupantCount) { msg.textContent = 'Selected room no longer has a free slot.'; renderRoomChoices(); return; }

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    state.requests.push({
      id,
      name,
      enroll,
      contact,
      room: selectedRoom,
      roommateCount: roommates,
      occupantCount: occupantCount,
      status: 'pending',
      appliedAt: Date.now()
    });
    saveState(state);
    msg.textContent = 'Application submitted. It will be visible in Admin panel for approval.';
    nameEl.value = ''; enrollEl.value = ''; contactEl.value = ''; selectedRoom = null; document.querySelectorAll('.room').forEach(x => x.classList.remove('selected'));
    renderRequests(); renderAvailableList(); renderRoomChoices();
  });

  clearBtn.addEventListener('click', () => {
    nameEl.value = ''; enrollEl.value = ''; contactEl.value = ''; roommatesEl.value = '1'; selectedRoom = null;
    document.querySelectorAll('.room').forEach(x => x.classList.remove('selected'));
    msg.textContent = 'Cleared.'; renderRoomChoices();
  });

  roommatesEl.addEventListener('change', () => { selectedRoom = null; document.querySelectorAll('.room').forEach(x => x.classList.remove('selected')); renderRoomChoices(); });

  // Admin controls
  openAdmin.addEventListener('click', () => { adminLoginBox.style.display = 'block'; adminMsg.textContent = ''; adminUser.value = ''; adminPass.value = ''; });
  hideLogin.addEventListener('click', () => { adminLoginBox.style.display = 'none'; });

  adminLoginBtn.addEventListener('click', () => {
    const u = adminUser.value.trim(); const p = adminPass.value;
    if (u === 'admin' && p === '1234') {
      adminLoginBox.style.display = 'none'; adminPanel.style.display = 'block'; adminMsg.textContent = ''; renderRequests();
    } else { adminMsg.textContent = 'Invalid credentials.'; }
  });

  logoutAdmin.addEventListener('click', () => { adminPanel.style.display = 'none'; renderRoomChoices(); });

  function approveRequest(id) {
    const idx = state.requests.findIndex(r => r.id === id); if (idx === -1) return;
    const rq = state.requests[idx];
    const room = state.rooms.find(rr => rr.no === rq.room);
    if (!room) { alert('Room no longer exists'); return; }
    const free = getFreeSlots(room);
    if (free < (rq.occupantCount || 1)) { alert('Not enough free slots to approve this request.'); return; }
    room.occupied += (rq.occupantCount || 1);
    rq.status = 'approved';
    saveState(state);
    renderRequests(); renderAvailableList(); renderRoomChoices();
  }
  function rejectRequest(id) { const rq = state.requests.find(r => r.id === id); if (!rq) return; rq.status = 'rejected'; saveState(state); renderRequests(); }

  // helper to reset demo from console
  window._resetHostelDemo = () => { localStorage.removeItem('hostelState'); location.reload(); };

  // initial render
  if (!roommatesEl.value) roommatesEl.value = '1';
  renderRoomChoices(); renderAvailableList(); renderRequests();

  console.info('script.js loaded: DOM ready and components initialized.');
});