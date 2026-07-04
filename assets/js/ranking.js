nav('ranking.html');
const rows=latestRows();
function render(q=''){
  const f=rows.filter(r=>r.Participante.toLowerCase().includes(q.toLowerCase()));
  document.getElementById('meta').textContent=`${f.length} participantes`;
  const table=document.getElementById('rankTable');
  if(table){table.innerHTML='<thead><tr><th>Pos.</th><th>Participante</th><th>Puntos</th><th>Movimiento</th><th>Distancia líder</th><th>Premio actual</th></tr></thead><tbody>'+f.map(r=>{const pr=prizePerPerson(r,rows);return `<tr><td class="rank">${rankLabel(r,rows)}</td><td>${esc(r.Participante)}</td><td><b>${r.Puntos}</b></td><td>${changeHtml(r.Cambio_Posicion)}</td><td>${r.Distancia_Lider}</td><td>${pr?`<b class="money">${fmtMoney(pr)}</b>`:'—'}</td></tr>`}).join('')+'</tbody>'}
  const cards=document.getElementById('rankCards');
  if(cards){cards.innerHTML=f.map(r=>`<div class="mini-card rank-card"><div class="top"><span class="date">${rankLabel(r,rows)}</span><span class="name">${r.Puntos} pts</span></div><div class="name">${esc(r.Participante)}</div><div class="meta">Movimiento: ${changeHtml(r.Cambio_Posicion)} · Distancia al líder: <b>${r.Distancia_Lider}</b>${prizePerPerson(r,rows)?` · Premio: <b class="money">${fmtMoney(prizePerPerson(r,rows))}</b>`:''}</div></div>`).join('')}
}
render();
document.getElementById('search').addEventListener('input',e=>render(e.target.value));
