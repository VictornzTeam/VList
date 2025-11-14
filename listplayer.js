// listplayer.js — Google Sheets -> Player list (AUTOMATIC)
// Konfigurasi: SHEET_ID & GID (sudah diisi sesuai yang kamu kirim)
const SHEET_ID = "1JytAOIy_fz_Ip41UMyNwssyIL0Nnxq7Xsu7aGQGIa_I";
const GID = "941265557";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?gid=${GID}&tqx=out:json`;

// DOM refs
const playerListEl = document.querySelector(".player-list");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");

// Overlay refs
const overlay = document.getElementById("playerOverlay");
const ovName = document.getElementById("ov-name");
const ovDiscord = document.getElementById("ov-discord");
const ovRank = document.getElementById("ov-rank");
const ovRole = document.getElementById("ov-role");
const ovTimezone = document.getElementById("ov-timezone");
const ovFree = document.getElementById("ov-free");
const ovHobby = document.getElementById("ov-hobby");
const ovCita = document.getElementById("ov-cita");
const ovMoto = document.getElementById("ov-moto");
const ovAbout = document.getElementById("ov-about");
const ovSkinCanvas = document.getElementById("ov-skin");

let PLAYERS = {};
let playerItems = [];
let defaultOrder = [];

// --- parse gviz JSON -> object
function parseGvizResponse(text) {
  // remove wrapper like: /*O_o*/\ngoogle.visualization.Query.setResponse({...});
  const jsonText = text.replace(/^[^\{]*/, '').replace(/\);?$/, '');
  return JSON.parse(jsonText);
}

function tableToObjects(table) {
  const cols = table.cols.map(c => (c.label || c.id || "").toString().trim());
  const rows = table.rows.map(r => {
    const obj = {};
    r.c.forEach((cell, i) => {
      const key = cols[i] || `col${i}`;
      obj[key] = (cell && cell.v !== undefined) ? cell.v : "";
    });
    return obj;
  });
  return rows;
}

// normalize header names (indonesian headers mapping)
function mapRowToPlayer(row) {
  // helper to get value by possible header names (case-insensitive)
  const get = (...names) => {
    for (let n of names) {
      for (let k of Object.keys(row)) {
        if (k && k.toString().trim().toLowerCase() === n.toString().trim().toLowerCase()) {
          return row[k];
        }
      }
    }
    return "";
  };

  const name = get("Nama Minecraft", "Nama", "NamaPlayer", "Name");
  // ID Discord
  const discord = get("ID Discord", "Discord", "ID", "Discord ID");
  const rank = get("Rank mu di ProwNetwork", "Rank", "Rank mu", "Rank ProwNetwork");
  const timezone = get("Zona Waktu", "Zona", "ZonaWaktu", "Zona Waktu");
  const free = get("Sengan di waktu?", "Sengan di waktu?", "Waktu", "Senggang di waktu?", "Senggang");
  const role = get("Tugas di Base tim", "Tugas di Base tim", "Tugas", "Role", "Tugas di Base");
  const moto = get("Moto", "Motto");
  const about = get("Tentang Dirimu", "Tentang Dirimu", "Tentang");
  const hobby = get("Hobi", "Hobby");
  const cita = get("Cita-cita", "Cita-cita", "Cita cita", "Cita");
  const skinRaw = get("Skin Minecraft", "Skin Minecraft", "Skin");
  const slimRaw = get("Skin mu Mode Slim or Wide?", "Skin mu Mode Slim or Wide?", "Skin mu Mode Slim", "Skin mu Mode Slim or Wide");

  // convert Drive links to direct download where possible
  const skin = convertDriveToDirect(skinRaw);

  const isSlim = (() => {
    if (!slimRaw && typeof slimRaw === "boolean") return !!slimRaw;
    if (!slimRaw) return false;
    const s = slimRaw.toString().trim().toLowerCase();
    return s === "slim" || s === "true" || s === "1" || s === "yes" || s === "y";
  })();

  // id: derive from name sanitized or if there's a column 'Timestamp' or email? prefer slug from name
  const id = (name ? slugify(name) : `player-${Math.random().toString(36).slice(2,8)}`);

  return {
    id,
    name: name || id,
    discord: discord || "-",
    rank: rank || "-",
    timezone: timezone || "-",
    free: free || "-",
    role: role || "-",
    moto: moto || "-",
    about: about || "-",
    hobby: hobby || "-",
    cita: cita || "-",
    skin: skin || "",
    isSlim: !!isSlim
  };
}

function slugify(text) {
  return text.toString().toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9\-_]/g,'').slice(0,24);
}

// Try to convert common Google Drive share links to a direct download URL
function convertDriveToDirect(url) {
  if (!url) return "";
  try {
    const u = url.toString();
    // If already looks like direct image (ends with png/jpg/webp) return as-is
    if (/\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(u)) return u;

    // common patterns:
    // https://drive.google.com/open?id=FILEID
    // https://drive.google.com/file/d/FILEID/view?usp=sharing
    // https://drive.google.com/uc?id=FILEID&export=download
    let m;
    m = u.match(/\/file\/d\/([a-zA-Z0-9_\-]+)\//);
    if (m && m[1]) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
    m = u.match(/[?&]id=([a-zA-Z0-9_\-]+)/);
    if (m && m[1]) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
    // fallback: return original string (may not load due to Drive blocking)
    return u;
  } catch (e) {
    return url;
  }
}

// build PLAYERS from rows using the mapped headers
function buildPlayersFromRows(rows) {
  const map = {};
  rows.forEach(r => {
    const p = mapRowToPlayer(r);
    map[p.id] = p;
  });
  return map;
}

// render DOM list
function renderPlayerList(playersObj) {
  playerListEl.innerHTML = "";
  const keys = Object.keys(playersObj);
  // keep stable order as in sheet insertion order
  keys.forEach((key) => {
    const p = playersObj[key];
    const item = document.createElement("div");
    item.className = "player-item";
    item.dataset.player = p.id;
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.cursor = "pointer";

    const canvas = document.createElement("canvas");
    canvas.width = 64; canvas.height = 64;
    canvas.id = `head-${p.id}`;
    canvas.style.marginRight = "10px";
    canvas.style.borderRadius = "6px";

    const span = document.createElement("span");
    span.textContent = p.name;

    item.appendChild(canvas);
    item.appendChild(span);

    item.addEventListener("click", () => showOverlay(p.id));

    playerListEl.appendChild(item);
  });

  playerItems = Array.from(document.querySelectorAll(".player-item"));
  defaultOrder = [...playerItems];
  drawAllHeads(playersObj);
}

// draw head on each player canvas using skin image (crop head area typical Minecraft)
function drawAllHeads(playersObj) {
  playerItems.forEach(item => {
    const pid = item.dataset.player;
    const p = playersObj[pid];
    if (!p) return;
    const canvas = item.querySelector("canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = p.skin || "";

    img.onload = () => {
      ctx.clearRect(0,0,canvas.width, canvas.height);
      try {
        // crop head front (standard Minecraft skin coords 8,8 size 8x8)
        ctx.drawImage(img, 8, 8, 8, 8, 0, 0, canvas.width, canvas.height);
        // draw head overlay (hat) 40,8,8,8
        ctx.drawImage(img, 40, 8, 8, 8, 0, 0, canvas.width, canvas.height);
      } catch (e) {
        // fallback scale whole image
        ctx.drawImage(img, 0,0, img.width, img.height, 0,0, canvas.width, canvas.height);
      }
    };

    img.onerror = () => {
      // fallback: draw a circle with initials
      drawFallbackHead(ctx, p.name, canvas.width, canvas.height);
    };
  });
}

function drawFallbackHead(ctx, name, w, h) {
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = "#e0e0e0";
  ctx.fillRect(0,0,w,h);
  ctx.beginPath();
  ctx.fillStyle = "#bdbdbd";
  ctx.arc(w/2, h/2, Math.min(w,h)/2 - 4, 0, Math.PI*2);
  ctx.fill();
  const initials = (name || "").split(' ').map(s => s[0]).join('').slice(0,2).toUpperCase();
  ctx.fillStyle = "#111";
  ctx.font = `${Math.floor(w/2)}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initials || '?', w/2, h/2);
}

// overlay show
function showOverlay(pid) {
  const p = PLAYERS[pid];
  if (!p) return;
  ovName.textContent = p.name || pid;
  ovDiscord.textContent = p.discord || "-";
  ovRank.textContent = p.rank || "-";
  ovRole.textContent = p.role || "-";
  ovTimezone.textContent = p.timezone || "-";
  ovFree.textContent = p.free || "-";
  ovHobby.textContent = p.hobby || "-";
  ovCita.textContent = p.cita || "-";
  ovAbout.textContent = p.about || "-";
  ovMoto.textContent = p.moto || "-";

  // draw skin preview in ov-skin
  const canvas = ovSkinCanvas;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0,0, canvas.width, canvas.height);

  if (!p.skin) {
    drawFallbackHead(ctx, p.name, canvas.width, canvas.height);
  } else {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = p.skin;
    img.onload = () => {
      try {
        ctx.clearRect(0,0, canvas.width, canvas.height);
        const scale = 2;
        const armW = p.isSlim ? 3 : 4;
        // draw head & hat
        ctx.drawImage(img, 8,8,8,8, 8,0, 8*scale,8*scale);
        ctx.drawImage(img, 40,8,8,8, 8,0, 8*scale,8*scale);
        // body
        ctx.drawImage(img, 20,20,8,12, 8,16, 8*scale,12*scale);
        ctx.drawImage(img, 20,36,8,12, 8,16, 8*scale,12*scale);
        // arms
        ctx.drawImage(img, 44,20,armW,12, 0,16, armW*scale,12*scale);
        ctx.drawImage(img, 36,52,armW,12, 24,16, armW*scale,12*scale);
        // legs
        ctx.drawImage(img, 4,20,4,12, 8,40, 4*scale,12*scale);
        ctx.drawImage(img, 20,52,4,12, 16,40, 4*scale,12*scale);
      } catch (e) {
        ctx.drawImage(img, 0,0, canvas.width, canvas.height);
      }
    };
    img.onerror = () => {
      drawFallbackHead(ctx, p.name, canvas.width, canvas.height);
    };
  }

  overlay.classList.remove("hidden");
  overlay.classList.add("show");
}
window.showOverlay = showOverlay;

// close overlay
function closeOverlay() {
  overlay.classList.add("hidden");
  overlay.classList.remove("show");
}
window.closeOverlay = closeOverlay;

// search & sort handlers
function attachSearchSort() {
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const q = (searchInput.value || "").toLowerCase().trim();
      playerItems.forEach(item => {
        const name = item.querySelector("span").textContent.toLowerCase();
        item.style.display = name.includes(q) ? "flex" : "none";
      });
    });
  }
  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      const val = sortSelect.value;
      if (val === "default") {
        defaultOrder.forEach(n => playerListEl.appendChild(n));
        return;
      }
      if (val === "az") {
        const sorted = [...playerItems].sort((a,b) => a.querySelector("span").textContent.localeCompare(b.querySelector("span").textContent));
        sorted.forEach(n => playerListEl.appendChild(n));
        return;
      }
      // treat as rank or role match
      const matched = [];
      const others = [];
      playerItems.forEach(item => {
        const pid = item.dataset.player;
        const p = PLAYERS[pid] || {};
        if (p.rank === val || p.role === val) matched.push(item);
        else others.push(item);
      });
      matched.concat(others).forEach(n => playerListEl.appendChild(n));
    });
  }
}

// fetch sheet & render
async function fetchAndRenderSheet() {
  try {
    const res = await fetch(SHEET_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    const json = parseGvizResponse(text);
    const rows = tableToObjects(json.table);
    PLAYERS = buildPlayersFromRows(rows);
    renderPlayerList(PLAYERS);
    attachSearchSort();
  } catch (err) {
    console.error("Gagal memuat Google Sheet:", err);
    playerListEl.innerHTML = "<div style='color:#c00'>Gagal memuat data. Pastikan Sheet diset 'Anyone with the link' dan SHEET_ID/GID benar.</div>";
  }
}

// init
document.addEventListener("DOMContentLoaded", () => {
  // sidebar toggle (jika ada)
  const sidebar = document.getElementById('sidebar');
  const menuBtn = document.getElementById('menuBtn');
  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('active');
    });
    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) sidebar.classList.remove('active');
    });
  }

  fetchAndRenderSheet();

  // auto-refresh setiap 2 menit
  setInterval(fetchAndRenderSheet, 1000 * 60 * 2);
});
