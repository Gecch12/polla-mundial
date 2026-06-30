nav('info.html');
const e=D.email||{};
document.getElementById('emailKpis').innerHTML=`<div class="card"><div class="kpi-title">Correo usado</div><div class="kpi-value">29-Jun</div><div class="muted">Puntajes actualizados</div></div><div class="card"><div class="kpi-title">Participantes</div><div class="kpi-value">${summary.participants}</div><div class="muted">Según el correo</div></div><div class="card"><div class="kpi-title">Premio 1er lugar</div><div class="kpi-value">S/. 2,490</div><div class="muted">Monto informado</div></div><div class="card"><div class="kpi-title">Adjunto</div><div class="kpi-value">Excel</div><div class="muted">${esc(e.attachment||'')}</div></div>`;
document.getElementById('emailSubject').textContent=e.subject||'';
document.getElementById('emailMeta').textContent=`De: ${e.from||''} · Fecha: ${e.sent||''}`;
function formatBody(txt){return esc(txt||'').replace(/\n\n+/g,'</p><p>').replace(/\n/g,'<br>')}
document.getElementById('emailBody').innerHTML='<p>'+formatBody(e.body||'')+'</p>';
document.getElementById('foot').textContent='Última actualización: '+fmtDate(summary.updated)+'.';
