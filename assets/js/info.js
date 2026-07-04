nav('info.html');
const e=email||{};
const currentInfo=latestRows();
function moneyFromBody(label, fallback='') {
  const body=e.body||'';
  const re=new RegExp('Premio para el '+label+'\\. Lugar:\\s*(S/\\.\\s*[0-9,.]+)','i');
  const m=body.match(re);
  return m?m[1]:fallback;
}
const prizeMoney=[
  moneyFromBody('1er',e.prize1||'S/. 2,490.00'),
  moneyFromBody('2do','S/. 830.00'),
  moneyFromBody('3er','S/. 415.00'),
  moneyFromBody('4to','S/. 207.50'),
];
const prizes=[1,2,3,4].map(pos=>{
  const tied=currentInfo.filter(r=>pointsRank(r,currentInfo)===pos);
  const bag=parseMoney(prizeMoney[pos-1]);
  const each=tied.length?bag/tied.length:0;
  return {pos, amount:prizeMoney[pos-1], tied, each};
});
const pointsCard = `<div class="card points-card"><div class="kpi-title">Puntos posibles</div><div class="points-grid"><div><b>2da a 5ta etapa</b><span>3 pts ganador/empate</span><span>5 pts resultado exacto</span><span>+2 pts clasificado</span></div><div><b>6ta etapa</b><span>3 pts ganador/empate</span><span>5 pts resultado exacto</span><span>Campeón 10 · 2do 6 · 3ro 4 · 4to 2</span></div></div></div>`;
document.getElementById('emailMeta').innerHTML=`
  <div class="card info-subject-card"><div class="kpi-title">Asunto</div><div class="kpi-value small-kpi">${esc(e.subject||'')}</div></div>
  ${pointsCard}
  <div class="card prize-card"><div class="kpi-title">Premios según ranking actual</div><div class="prize-ranking">
  ${prizes.map(p=>`<div class="prize-row has-tip" tabindex="0"><div class="prize-pos">${medal(p.pos)} #${p.pos}</div><div class="prize-name">${p.tied.length?p.tied.map(x=>esc(x.Participante)).join(' + '):'—'}</div><div class="prize-points">${p.tied.length?p.tied[0].Puntos+' pts':''}${p.tied.length>1?` · ${p.tied.length} empatados`:''}</div><div class="prize-amount">${p.tied.length?(p.tied.length>1?fmtMoney(p.each)+' c/u':esc(p.amount)):'—'}${p.tied.length>1?`<span class="muted small">Bolsa: ${esc(p.amount)}</span>`:''}</div></div>`).join('')}
  </div></div>`;
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
