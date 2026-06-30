
const D=window.POLLA_DATA;const base=D.base,movers=D.movers,leaders=D.leaders,rompe=D.rompe,summary=D.summary;
const pages=[['index.html','Home'],['ranking.html','Ranking'],['race.html','Race'],['movements.html','Movimientos'],['golpes.html','Golpes'],['info.html','Información general']];
function nav(active){document.body.insertAdjacentHTML('afterbegin','<div class="topbar">'+pages.map(p=>`<a class="${p[0]==active?'active':''}" href="${p[0]}">${p[1]}</a>`).join('')+'</div>')}
function fmtDate(d){return new Date(d+'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'short'})}
function medal(p){return p===1?'🥇':p===2?'🥈':p===3?'🥉':''}
function colorForName(name){let h=0;for(let i=0;i<name.length;i++)h=(h*31+name.charCodeAt(i))>>>0;return `hsl(${h%360},72%,58%)`}
function changeHtml(v){if(v===null||v===undefined||isNaN(v))return '<span class="flat">—</span>';if(v>0)return `<span class="up">▲ ${v}</span>`;if(v<0)return `<span class="down">▼ ${Math.abs(v)}</span>`;return '<span class="flat">0</span>'}
function latestRows(){const latest=summary.updated;return base.filter(d=>d.Fecha===latest).sort((a,b)=>a.Posicion-b.Posicion)}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function shortName(s,n=18){s=String(s||'');return s.length>n?s.slice(0,n-1)+'…':s}
