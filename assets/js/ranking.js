nav('ranking.html');
const rows=latestRows();
const predictions=window.POLLA_PREDICTIONS||{};
const remainingMap=window.POLLA_REMAINING_POINTS||{};
const leaderPts=rows.length?Number(rows[0].Puntos||0):0;
const fourthPts=rows.length>=4?Number(rows[3].Puntos||0):leaderPts;
function predFor(name){return predictions[String(name||'').toUpperCase()]||null}
function remFor(r){const rec=remainingMap[String(r.Participante||'').toUpperCase()];return rec?Number(rec.remaining||0):0}
function maxPossible(r){return Number(r.Puntos||0)+remFor(r)}
function statusFor(r){const m=maxPossible(r);if(m>=leaderPts)return '<span class="status status-win">Matemáticamente posible</span>';if(m>=fourthPts)return '<span class="status status-paid">Con la calculadora puede ser</span>';return '<span class="status status-long">Necesita milagro</span>'}
function tipHtml(r){const p=predFor(r.Participante);const rem=remFor(r);const rec=remainingMap[String(r.Participante||'').toUpperCase()]||{};const max=maxPossible(r);return `<div class="mini-tooltip rank-tip"><b>Pronóstico restante</b><span>Semis: ${esc(p?.semis||'—')}</span><span>Final: ${esc(p?.final||'—')}</span><span>Campeón: ${esc(p?.campeon||'—')}</span><span>Puntos máximos restantes: ${rem} pts</span><span>Incluye ${rec.matches??'—'} partidos por jugar + ${rec.positions??0} pts por puestos finales</span><span>Si todo acierta: ${max} pts</span></div>`}
function nameCell(r){return `<span class="has-tip rank-name" tabindex="0">${esc(r.Participante)} ${tipHtml(r)}</span>`}
function render(q=''){
  const f=rows.filter(r=>r.Participante.toLowerCase().includes(q.toLowerCase()));
  document.getElementById('meta').textContent=`${f.length} participantes`;
  const table=document.getElementById('rankTable');
  if(table){table.innerHTML='<thead><tr><th>Pos.</th><th>Participante</th><th>Puntos</th><th>Pts restantes</th><th>Máx posible</th><th>Opciones</th><th>Movimiento</th><th>Distancia líder</th></tr></thead><tbody>'+f.map(r=>`<tr><td class="rank">${medal(r.Posicion)} ${r.Posicion}</td><td>${nameCell(r)}</td><td><b>${r.Puntos}</b></td><td><b>${remFor(r)}</b></td><td><b>${maxPossible(r)}</b></td><td>${statusFor(r)}</td><td>${changeHtml(r.Cambio_Posicion)}</td><td>${r.Distancia_Lider}</td></tr>`).join('')+'</tbody>'}
  const cards=document.getElementById('rankCards');
  if(cards){cards.innerHTML=f.map(r=>`<div class="mini-card rank-card has-tip" tabindex="0"><div class="top"><span class="date">${medal(r.Posicion)} #${r.Posicion}</span><span class="name">${r.Puntos} pts</span></div><div class="name">${esc(r.Participante)}</div><div class="meta">Pts restantes: <b>${remFor(r)}</b> · Máx posible: <b>${maxPossible(r)}</b></div><div class="meta">${statusFor(r)}</div><div class="meta">Movimiento: ${changeHtml(r.Cambio_Posicion)} · Distancia al líder: <b>${r.Distancia_Lider}</b></div>${tipHtml(r)}</div>`).join('')}
}
render();
document.getElementById('search').addEventListener('input',e=>render(e.target.value));
