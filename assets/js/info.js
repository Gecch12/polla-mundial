nav('info.html');
const e=email||{};
document.getElementById('emailMeta').innerHTML=`<div class="card"><div class="kpi-title">Asunto</div><div class="kpi-value small-kpi">${esc(e.subject||'')}</div></div><div class="card"><div class="kpi-title">Remitente</div><div class="kpi-value small-kpi">${esc(e.from||'')}</div></div><div class="card"><div class="kpi-title">Participantes</div><div class="kpi-value">${e.participants||summary.participants}</div><div class="muted">Según el correo</div></div><div class="card"><div class="kpi-title">Premio 1er lugar</div><div class="kpi-value">${esc(e.prize1||'')}</div><div class="muted">Monto informado</div></div><div class="card"><div class="kpi-title">Adjunto</div><div class="kpi-value small-kpi">Excel</div><div class="muted">${esc(e.attachment||'')}</div></div>`;
document.getElementById('emailBody').textContent=e.body||'Sin cuerpo disponible.';
document.getElementById('emailFoot').textContent='Correo procesado: '+(e.subject||'')+'.';
