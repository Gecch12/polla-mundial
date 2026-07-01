nav('info.html');
const e=email||{};
const currentInfo=latestRows();
function moneyFromBody(label, fallback=''){
  const body=e.body||'';
  const re=new RegExp('Premio para el '+label+'\\. Lugar:\\s*(S/\\.\\s*[0-9,.]+)','i');
  const m=body.match(re);
  return m?m[1]:fallback;
}
const prizes=[
  {pos:1,label:'1er lugar',amount:moneyFromBody('1er',e.prize1||''),row:currentInfo[0]},
  {pos:2,label:'2do lugar',amount:moneyFromBody('2do'),row:currentInfo[1]},
  {pos:3,label:'3er lugar',amount:moneyFromBody('3er'),row:currentInfo[2]},
  {pos:4,label:'4to lugar',amount:moneyFromBody('4to'),row:currentInfo[3]},
];

document.getElementById('emailMeta').innerHTML=`
  <div class="card info-subject-card">
    <div class="kpi-title">Asunto</div>
    <div class="kpi-value small-kpi">${esc(e.subject||'')}</div>
  </div>
  <div class="card">
    <div class="kpi-title">Participantes</div>
    <div class="kpi-value">${e.participants||summary.participants}</div>
    <div class="muted">Total informado por Beto</div>
  </div>
  <div class="card prize-card">
    <div class="kpi-title">Premios según ranking actual</div>
    <div class="prize-ranking">
      ${prizes.map(p=>`<div class="prize-row">
        <div class="prize-pos">#${p.pos}</div>
        <div class="prize-name">${esc(p.row?.Participante||'—')}</div>
        <div class="prize-points">${p.row?.Puntos??'—'} pts</div>
        <div class="prize-amount">${esc(p.amount||'—')}</div>
      </div>`).join('')}
    </div>
  </div>`;

document.getElementById('emailBody').textContent=e.body||'Sin cuerpo disponible.';
document.getElementById('emailFoot').innerHTML=`Último correo procesado: ${esc(e.subject||'')}. ${e.date?`Fecha: ${esc(e.date)}. `:''}${e.attachment?`Excel procesado: ${esc(e.attachment)}.`:''}`;
