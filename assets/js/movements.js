
nav('movements.html');
const rows=movers.map(m=>`<tr><td>${fmtDate(m.Fecha)}</td><td><span class="up">▲ ${m.Puestos_Subidos}</span> ${esc(m.Mayor_Subida)}</td><td><span class="down">▼ ${Math.abs(m.Puestos_Bajados)}</span> ${esc(m.Mayor_Bajada)}</td><td>${esc(m.Lider)} · <b>${m.Puntos_Lider}</b> pts</td></tr>`).join('');
document.getElementById('movTable').innerHTML='<thead><tr><th>Jornada</th><th>Mayor subida</th><th>Mayor caída</th><th>Líder del día</th></tr></thead><tbody>'+rows+'</tbody>';
const cards=document.getElementById('movCards');
if(cards){cards.innerHTML=movers.map(m=>`<div class="mini-card"><div class="top"><span class="date">${fmtDate(m.Fecha)}</span><span class="meta">Líder: <b>${esc(m.Lider)}</b> · ${m.Puntos_Lider} pts</span></div><div class="meta"><span class="good">▲ ${m.Puestos_Subidos}</span> ${esc(m.Mayor_Subida)}</div><div class="meta"><span class="bad">▼ ${Math.abs(m.Puestos_Bajados)}</span> ${esc(m.Mayor_Bajada)}</div></div>`).join('')}
