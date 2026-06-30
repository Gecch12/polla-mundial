nav('golpes.html');
const golpes=rompe.slice(0,25);
const tableRows=golpes.map((r,i)=>`<tr class="clickable-row" data-golpe="${i}"><td>${fmtDate(r.Fecha)}</td><td>${esc(r.Partido_Label)}</td><td><b>${r.Participantes_con_puntos}</b></td><td>${r.Puntos_totales_otorgados}</td><td>${r.Max_puntos}</td></tr>`).join('');
document.getElementById('golpesTable').innerHTML='<thead><tr><th>Fecha</th><th>Partido / código</th><th>Participantes con puntos</th><th>Puntos repartidos</th><th>Máx.</th></tr></thead><tbody>'+tableRows+'</tbody>';
const cards=document.getElementById('golpesCards');
if(cards){cards.innerHTML=golpes.map((r,i)=>`<div class="mini-card golpe-card" data-golpe="${i}"><div class="top"><span class="date">${fmtDate(r.Fecha)}</span><span class="name">${r.Participantes_con_puntos} con puntos</span></div><div class="meta">Partido/código: <b>${esc(r.Partido_Label)}</b></div><div class="meta">Puntos repartidos: <b>${r.Puntos_totales_otorgados}</b> · Máx.: <b>${r.Max_puntos}</b></div><div class="tap-hint">Tocar para ver quiénes sumaron</div></div>`).join('')}

function detalleHtml(r){
 const rows=(r.Detalle||[]).map(d=>`<div class="detail-row"><div><b>${esc(d.Participante)}</b>${d.Posicion_dia?`<span class="sub">Pos. ${d.Posicion_dia}</span>`:''}</div><span class="pill-score">${d.Puntos} pts</span></div>`).join('') || '<p class="muted">No se encontró detalle para este golpe.</p>';
 return `<div class="modal-card"><button class="modal-close" aria-label="Cerrar">×</button><p class="eyebrow">Golpe de polla</p><h2>${esc(r.Partido_Label)}</h2><p class="muted">${fmtDate(r.Fecha)} · ${r.Participantes_con_puntos} participantes sumaron · ${r.Puntos_totales_otorgados} puntos repartidos</p><div class="detail-list">${rows}</div></div>`;
}
function openGolpe(i){
 const r=golpes[i]; if(!r) return;
 let modal=document.getElementById('golpeModal');
 if(!modal){modal=document.createElement('div'); modal.id='golpeModal'; modal.className='modal'; document.body.appendChild(modal);}
 modal.innerHTML=detalleHtml(r);
 modal.classList.add('open');
 modal.querySelector('.modal-close').onclick=()=>modal.classList.remove('open');
 modal.onclick=(e)=>{if(e.target===modal)modal.classList.remove('open')};
}
document.querySelectorAll('[data-golpe]').forEach(el=>el.addEventListener('click',()=>openGolpe(Number(el.dataset.golpe))));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const m=document.getElementById('golpeModal'); if(m)m.classList.remove('open')}});
