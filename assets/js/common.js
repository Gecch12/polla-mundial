
const D=window.POLLA_DATA;const base=D.base,movers=D.movers,leaders=D.leaders,rompe=D.rompe,summary=D.summary,email=D.email||{};
const pages=[['index.html','Home'],['ranking.html','Ranking'],['race.html','Race'],['movements.html','Movimientos'],['golpes.html','Golpes'],['visuales.html','Visuales'],['info.html','Información'],['maximos.html','Máximos']];
function nav(active){document.body.insertAdjacentHTML('afterbegin','<div class="topbar">'+pages.map(p=>`<a class="${p[0]==active?'active':''}" href="${p[0]}">${p[1]}</a>`).join('')+'</div>')}
function fmtDate(d){return new Date(d+'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'short'})}
function medal(p){return p===1?'🥇':p===2?'🥈':p===3?'🥉':''}
function pointsRank(row, rows){
  rows=rows||latestRows();
  const pts=[...new Set(rows.map(x=>Number(x.Puntos)).filter(x=>!isNaN(x)).sort((a,b)=>b-a))];
  return pts.indexOf(Number(row.Puntos))+1;
}
function rankLabel(row, rows){const r=pointsRank(row,rows);return `${medal(r)} ${r}`}
function parseMoney(s){const m=String(s||'').match(/[0-9][0-9,.]*/);return m?Number(m[0].replace(/,/g,'')):0}
function fmtMoney(n){return 'S/. '+Number(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}
function prizeAmounts(){
  const body=(email&&email.body)||'';
  const labels=[['1er',2490],['2do',830],['3er',415],['4to',207.5]];
  return labels.map(([lab,fb])=>{const re=new RegExp('Premio para el '+lab+'\\. Lugar:\\s*(S/\\.\\s*[0-9,.]+)','i');const m=body.match(re);return m?parseMoney(m[1]):fb});
}
function prizePerPerson(row, rows){
  rows=rows||latestRows();
  const r=pointsRank(row,rows);
  const amounts=prizeAmounts();
  if(r<1||r>amounts.length)return 0;
  const tied=rows.filter(x=>pointsRank(x,rows)===r).length||1;
  return amounts[r-1]/tied;
}
function colorForName(name){let h=0;for(let i=0;i<name.length;i++)h=(h*31+name.charCodeAt(i))>>>0;return `hsl(${h%360},72%,58%)`}
function changeHtml(v){if(v===null||v===undefined||isNaN(v))return '<span class="flat">—</span>';if(v>0)return `<span class="up">▲ ${v}</span>`;if(v<0)return `<span class="down">▼ ${Math.abs(v)}</span>`;return '<span class="flat">0</span>'}
function latestRows(){const latest=summary.updated;return base.filter(d=>d.Fecha===latest).sort((a,b)=>a.Posicion-b.Posicion)}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function shortName(s,n=18){s=String(s||'');return s.length>n?s.slice(0,n-1)+'…':s}
