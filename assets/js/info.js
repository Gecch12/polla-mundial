nav('info.html');
const e=email||{};
const currentInfo=latestRows();
const predictions=window.POLLA_PREDICTIONS||{};
function moneyFromBody(label, fallback=''){
  const body=e.body||'';
  const re=new RegExp('Premio para el '+label+'\\. Lugar:\\s*(S/\\.\\s*[0-9,.]+)','i');
  const m=body.match(re);
  return m?m[1]:fallback;
}
const prizes=[
  {pos:1,amount:moneyFromBody('1er',e.prize1||'S/. 2,490.00'),row:currentInfo[0]},
  {pos:2,amount:moneyFromBody('2do','S/. 830.00'),row:currentInfo[1]},
  {pos:3,amount:moneyFromBody('3er','S/. 415.00'),row:currentInfo[2]},
  {pos:4,amount:moneyFromBody('4to','S/. 207.50'),row:currentInfo[3]},
];
function predHtml(name){
  const p=predictions[(name||'').toUpperCase()];
  if(!p) return '<div class="mini-tooltip">Pronóstico no disponible</div>';
  return `<div class="mini-tooltip"><b>Pronóstico restante</b><span>Semis: ${esc(p.semis||'—')}</span><span>Final: ${esc(p.final||'—')}</span><span>Campeón: ${esc(p.campeon||'—')}</span></div>`;
}
const pointsCard = `<div class="card points-card"><div class="kpi-title">Puntos posibles</div><div class="points-grid"><div><b>2da a 5ta etapa</b><span>3 pts ganador/empate</span><span>5 pts resultado exacto</span><span>+2 pts clasificado</span></div><div><b>6ta etapa</b><span>3 pts ganador/empate</span><span>5 pts resultado exacto</span><span>Campeón 10 · 2do 6 · 3ro 4 · 4to 2</span></div></div></div>`;
document.getElementById('emailMeta').innerHTML=`
  <div class="card info-subject-card"><div class="kpi-title">Asunto</div><div class="kpi-value small-kpi">${esc(e.subject||'')}</div></div>
  ${pointsCard}
  <div class="card prize-card"><div class="kpi-title">Premios según ranking actual</div><div class="prize-ranking">
  ${prizes.map(p=>`<div class="prize-row has-tip" tabindex="0"><div class="prize-pos">#${p.pos}</div><div class="prize-name">${esc(p.row?.Participante||'—')}</div><div class="prize-points">${p.row?.Puntos??'—'} pts</div><div class="prize-amount">${esc(p.amount||'—')}</div>${predHtml(p.row?.Participante)}</div>`).join('')}
  </div><div class="muted hover-note">Pasa el mouse sobre un nombre para ver semis, final y campeón. En móvil, toca una fila.</div></div>`;
function formatEmailBody(body){
  if(!body) return 'Sin cuerpo disponible.';
  let x=esc(body).trim();
  x=x.replace(/^⭐([^\n]+)⭐/m,'<div class="mail-title">⭐$1⭐</div>');
  x=x.replace(/^\* ([^\n:]+):/gm,'<h3>$1</h3>');
  x=x.replace(/^(Part\.\s*\d+:.*?)$/gm,'<div class="match-line">$1</div>');
  x=x.replace(/^(TOTAL PARTICIPANTES:.*)$/gm,'<div class="mail-highlight">$1</div>');
  x=x.replace(/^(Premio para .* Lugar:.*)$/gm,'<div class="mail-highlight">$1</div>');
  x=x.replace(/\n/g,'<br>');
  return x;
}
document.getElementById('emailBody').innerHTML=formatEmailBody(e.body||'');
document.getElementById('emailFoot').innerHTML=`Último correo procesado: ${esc(e.subject||'')}. ${e.date?`Fecha: ${esc(e.date)}. `:''}${e.attachment?`Excel procesado: ${esc(e.attachment)}.`:''}`;
