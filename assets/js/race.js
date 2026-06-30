nav('race.html');
const dates=[...new Set(base.map(r=>r.Fecha))].sort();
let idx=dates.length-1,timer=null;
const viz=document.getElementById('raceViz');
const topN=summary.participants;
let rowH=30,leftW=210,barMax=640;
const latestTop=base.filter(r=>r.Fecha===summary.updated).sort((a,b)=>a.Posicion-b.Posicion).map(r=>r.Participante);
const allTop=[...new Set(base.map(r=>r.Participante))];
let names=[...new Set([...latestTop,...allTop])];
function dimensions(){
  const w=viz.clientWidth||1040;
  const mobile=window.innerWidth<850;
  rowH=mobile?34:30;
  leftW=mobile?(window.innerWidth<430?132:150):(window.innerWidth>=1100?230:210);
  barMax=Math.max(mobile?90:360, w-leftW-(mobile?56:105));
  viz.style.height=(topN*rowH+28)+'px';
}
function init(){
  dimensions();
  viz.innerHTML=names.map(name=>`<div class="race-row" data-name="${esc(name)}"><div class="race-name"></div><div class="race-track"><div class="race-fill"></div><div class="race-dot"></div><div class="race-points"></div></div></div>`).join('');
}
function rowFor(name){return viz.querySelector(`.race-row[data-name="${CSS.escape(name)}"]`)}
function draw(){
  dimensions();
  const d=dates[idx];
  document.getElementById('day').textContent=fmtDate(d);
  const rows=base.filter(r=>r.Fecha===d).sort((a,b)=>a.Posicion-b.Posicion);
  const max=Math.max(...rows.map(r=>r.Puntos));
  const min=Math.min(...rows.map(r=>r.Puntos));
  const rowMap=Object.fromEntries(rows.map(r=>[r.Participante,r]));
  names.forEach(name=>{
    const el=rowFor(name); if(!el) return;
    const r=rowMap[name];
    if(!r){el.classList.add('hidden-row'); return;}
    el.classList.remove('hidden-row');
    const y=(r.Posicion-1)*rowH+12;
    const pct=(r.Puntos-min)/(max-min||1);
    const w=Math.max(window.innerWidth<850?18:24, Math.round((window.innerWidth<850?22:90)+pct*(barMax-(window.innerWidth<850?22:90))));
    const c=colorForName(name);
    el.style.transform=`translateY(${y}px)`;
    el.style.setProperty('--person',c);
    el.querySelector('.race-name').innerHTML=`<b>${r.Posicion}</b> ${esc(shortName(name,window.innerWidth<850?(window.innerWidth<430?13:16):24))}`;
    el.querySelector('.race-fill').style.width=w+'px';
    el.querySelector('.race-dot').style.left=Math.max(0,w-7)+'px';
    el.querySelector('.race-points').style.left=Math.min(w+12, barMax+6)+'px';
    el.querySelector('.race-points').textContent=r.Puntos;
  });
}
function play(){clearInterval(timer);timer=setInterval(()=>{idx=(idx+1)%dates.length;draw()},Number(document.getElementById('speed').value));}
init();draw();
window.addEventListener('resize',()=>draw());
document.getElementById('play').onclick=play;
document.getElementById('pause').onclick=()=>clearInterval(timer);
document.getElementById('speed').onchange=()=>{if(timer)play()};