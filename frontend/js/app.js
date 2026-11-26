const STORAGE_KEY = "transitflow_network_v1";

const demoRoutes = [
  {id:"r1",name:"Purple Line",color:"teal",active:true,stops:["West End","Central Hub","Museum","City Square","Market","East Park","Airport"]},
  {id:"r2",name:"Blue Line",color:"blue",active:true,stops:["North Gate","Central Hub","Museum","University","Tech Park","East Park","Airport"]},
  {id:"r3",name:"Orange Line",color:"orange",active:true,stops:["West End","Central Hub","Library","City Square","Lake View","Tech Park"]},
  {id:"r4",name:"Green Line",color:"green",active:true,stops:["Hill Top","North Gate","City Square","Market","Tech Park","South Gate"]},
  {id:"r5",name:"Red Line",color:"pink",active:true,stops:["Airport","East Park","City Square","University","South Gate"]},
  {id:"r6",name:"Silver Line",color:"blue",active:true,stops:["Harbour","West End","Library","University","South Gate"]}
];

let routes = loadRoutes();
let lastJourney = null;
const $ = (id) => document.getElementById(id);
const colorHex = {teal:"#0d9488",purple:"#0d9488",blue:"#4b9ed0",orange:"#e8a04e",green:"#54b58b",pink:"#d879a7"};

function loadRoutes(){
  try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); return Array.isArray(saved) ? saved : structuredClone(demoRoutes); }
  catch { return structuredClone(demoRoutes); }
}
function saveRoutes(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(routes)); }
function uniqueStops(){
  const set = new Set(); routes.forEach(r => r.stops.forEach(s => set.add(s)));
  return [...set].sort((a,b)=>a.localeCompare(b));
}
function activeRoutes(excluded=[]){ return routes.filter(r=>r.active && !excluded.includes(r.id)); }
function escapeHTML(value){
  return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function toast(message){
  const el=$("toast"); el.textContent=message; el.classList.add("show");
  clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove("show"),2600);
}
function fillSelect(select, selected){
  if(!select) return;
  const stops=uniqueStops();
  select.innerHTML=stops.map(s=>`<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join("");
  if(selected && stops.includes(selected)) select.value=selected;
}
function fillAllSelects(){
  ["quickSource","quickDestination","sourceStop","destinationStop","bfsSource","bfsDestination"].forEach(id=>fillSelect($(id)));
  if($("quickSource") && $("quickDestination") && uniqueStops().length>1) $("quickDestination").selectedIndex=uniqueStops().length-1;
  if($("destinationStop") && uniqueStops().length>1) $("destinationStop").selectedIndex=uniqueStops().length-1;
  if($("bfsDestination") && uniqueStops().length>1) $("bfsDestination").selectedIndex=uniqueStops().length-1;
  renderInactiveOptions();
}
function routeGraph(excluded=[]){
  const graph=new Map();
  activeRoutes(excluded).forEach(route=>{
    route.stops.forEach((stop,index)=>{
      if(!graph.has(stop)) graph.set(stop,[]);
      if(index>0) graph.get(stop).push({stop:route.stops[index-1],route});
      if(index<route.stops.length-1) graph.get(stop).push({stop:route.stops[index+1],route});
    });
  });
  return graph;
}

// BFS is performed on stops. Every adjacent stop on a bus route is one edge.
// The first discovered destination therefore has the fewest bus segments.
function findJourney(source,destination,excluded=[]){
  if(source===destination) return {found:true,buses:0,stops:[source],legs:[]};

  // Route-level BFS: each graph node is a bus route. Two routes are
  // connected when they share a stop where passengers can interchange.
  const available=activeRoutes(excluded);
  const startRoutes=available.filter(r=>r.stops.includes(source));
  const targetRoutes=new Set(available.filter(r=>r.stops.includes(destination)).map(r=>r.id));
  if(!startRoutes.length||!targetRoutes.size) return {found:false};

  const byId=new Map(available.map(r=>[r.id,r]));
  const queue=[...startRoutes], previous=new Map(), transferFromPrevious=new Map();
  startRoutes.forEach(r=>previous.set(r.id,null));
  let foundRoute=null, head=0;

  while(head<queue.length && !foundRoute){
    const current=queue[head++];
    if(targetRoutes.has(current.id)){foundRoute=current;break;}
    for(const next of available){
      if(previous.has(next.id)) continue;
      const interchange=current.stops.find(stop=>next.stops.includes(stop));
      if(!interchange) continue;
      previous.set(next.id,current.id);
      transferFromPrevious.set(next.id,interchange);
      queue.push(next);
    }
  }
  if(!foundRoute) return {found:false};

  const routeChain=[];
  let routeId=foundRoute.id;
  while(routeId!==null){
    routeChain.push(byId.get(routeId));
    routeId=previous.get(routeId);
  }
  routeChain.reverse();

  const legs=[];
  let entry=source;
  for(let i=0;i<routeChain.length;i++){
    const route=routeChain[i];
    const exit=i===routeChain.length-1 ? destination : transferFromPrevious.get(routeChain[i+1].id);
    const fromIndex=route.stops.indexOf(entry);
    const toIndex=route.stops.indexOf(exit);
    if(fromIndex<0||toIndex<0) return {found:false};
    const direction=fromIndex<=toIndex?1:-1;
    const segment=[];
    for(let j=fromIndex;;j+=direction){segment.push(route.stops[j]);if(j===toIndex)break;}
    legs.push({route,stops:segment});
    entry=exit;
  }
  const path=[];
  legs.forEach((leg,i)=>leg.stops.forEach((stop,j)=>{if(i===0||j>0)path.push(stop);}));
  return {found:true,buses:routeChain.length,stops:path,legs};
}
function renderJourney(result,source,destination){
  const panel=$("journeyResult");
  if(!result.found){
    panel.innerHTML=`<div class="empty-result"><div class="empty-illustration">⊘</div><h2>No journey found</h2><p>There is no active bus connection from <strong>${escapeHTML(source)}</strong> to <strong>${escapeHTML(destination)}</strong>. Try another stop or enable a closed route.</p></div>`;
    return;
  }
  if(result.buses===0){
    panel.innerHTML=`<div class="journey-head"><div><div class="eyebrow">JOURNEY RESULT</div><h2>You are already there</h2><p>Starting point and destination are the same stop.</p></div><div class="bus-count">0 buses</div></div><div class="journey-explanation">No bus is required. Your destination is <strong>${escapeHTML(source)}</strong>.</div>`;
    return;
  }
  let html=`<div class="journey-head"><div><div class="eyebrow">OPTIMAL JOURNEY FOUND</div><h2>${escapeHTML(source)} <span style="color:#a4a8b5">→</span> ${escapeHTML(destination)}</h2><p>${result.stops.length} stops along the journey · ${result.legs.length} bus${result.legs.length===1?"":"es"}</p></div><div class="bus-count">${result.buses} bus${result.buses===1?"":"es"}</div></div><div class="journey-stops">`;
  html+=`<div class="journey-stop"><div class="stop-marker">●</div><div class="stop-info"><strong>${escapeHTML(source)}</strong><small>Start your journey</small></div></div>`;
  result.legs.forEach((leg,index)=>{
    const nextLeg=result.legs[index+1];
    html+=`<div class="bus-leg"><div class="bus-pill">▰</div><div><strong>${escapeHTML(leg.route.name)}</strong><small>${escapeHTML(leg.stops[0])} → ${escapeHTML(leg.stops[leg.stops.length-1])} · ${leg.stops.length-1} stop${leg.stops.length-1===1?"":"s"}</small></div></div>`;
    if(nextLeg){
      html+=`<div class="journey-stop interchange"><div class="stop-marker">↔</div><div class="stop-info"><strong>${escapeHTML(leg.stops[leg.stops.length-1])}</strong><small>Interchange · Change to ${escapeHTML(nextLeg.route.name)}</small></div></div>`;
    }
  });
  html+=`<div class="journey-stop final"><div class="stop-marker">✓</div><div class="stop-info"><strong>${escapeHTML(destination)}</strong><small>Destination reached</small></div></div></div><div class="journey-explanation">✓ This journey uses the minimum number of buses found by Breadth-First Search. The algorithm optimizes bus count, not total distance or travel time.</div>`;
  panel.innerHTML=html;
}
function renderInactiveOptions(){
  const box=$("inactiveOptions"); if(!box)return;
  box.innerHTML=routes.filter(r=>!r.active).map(r=>`<label class="inactive-option"><input type="checkbox" value="${r.id}" checked> Exclude ${escapeHTML(r.name)} (already inactive)</label>`).join("") || `<span style="font-size:10px;color:#a0a4b1">No inactive routes right now.</span>`;
}
function renderOverview(){
  const active=routes.filter(r=>r.active).length, stops=uniqueStops().length;
  $("statRoutes").textContent=active; $("statStops").textContent=stops; $("statClosed").textContent=routes.length-active;
  $("mapStopCount").textContent=stops;
  $("overviewRoutes").innerHTML=routes.slice(0,6).map(r=>`<div class="route-row"><span class="route-color" style="background:${colorHex[r.color]||colorHex.purple}"></span><div><strong>${escapeHTML(r.name)}</strong><small>${r.stops.length} stops · ${r.stops.slice(0,3).map(escapeHTML).join(" · ")}${r.stops.length>3?"…":""}</small></div><i class="status-dot ${r.active?"":"off"}"></i></div>`).join("");
}
function renderNetwork(){
  const filter=document.querySelector(".filter-tab.active")?.dataset.filter||"all";
  const query=($("routeSearch").value||"").toLowerCase();
  const list=routes.filter(r=>(filter==="all"||(filter==="active"&&r.active)||(filter==="inactive"&&!r.active)) && (r.name.toLowerCase().includes(query)||r.stops.some(s=>s.toLowerCase().includes(query))));
  $("networkGrid").innerHTML=list.length?list.map(r=>`<article class="network-card"><div class="network-card-top"><span class="route-color" style="background:${colorHex[r.color]||colorHex.purple}"></span><div><h3>${escapeHTML(r.name)}</h3><small>${r.stops.length} stops · ${r.stops.length-1} segments</small></div><span class="route-status ${r.active?"":"inactive"}">${r.active?"ACTIVE":"INACTIVE"}</span></div><div class="network-stops">${r.stops.map(escapeHTML).join("　›　")}</div><div class="network-card-footer"><span>Route ID: ${escapeHTML(r.id)}</span><div class="card-actions"><button class="small-action" data-edit="${r.id}">Edit</button><button class="small-action" data-toggle="${r.id}">${r.active?"Close":"Activate"}</button></div></div></article>`).join(""):`<div class="no-routes">No routes match your search.</div>`;
}
function refresh(){
  saveRoutes(); fillAllSelects(); renderOverview(); renderNetwork();
}
function switchView(view){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  $(view+"View").classList.add("active");
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  const title={overview:"Overview",planner:"Journey planner",network:"Route network",algorithm:"BFS explorer"}[view];
  $("breadcrumbTitle").textContent=title;
  $("sidebar").classList.remove("open");
  window.scrollTo({top:0,behavior:"smooth"});
}
function openRouteModal(route){
  $("routeForm").reset(); $("editingRouteId").value=route?.id||"";
  $("modalTitle").textContent=route?"Edit bus route":"Add a bus route";
  if(route){$("routeName").value=route.name;$("routeColor").value=route.color;$("routeStops").value=route.stops.join(", ");}
  $("routeModal").classList.add("open");
}
function saveRoute(event){
  event.preventDefault();
  const id=$("editingRouteId").value;
  const name=$("routeName").value.trim();
  const stops=$("routeStops").value.split(",").map(s=>s.trim()).filter(Boolean);
  if(stops.length<2){toast("A route needs at least two stops.");return;}
  if(new Set(stops.map(s=>s.toLowerCase())).size!==stops.length){toast("Remove duplicate stops from this route.");return;}
  const duplicate=routes.find(r=>r.name.toLowerCase()===name.toLowerCase()&&r.id!==id);
  if(duplicate){toast("A route with that name already exists.");return;}
  if(id){
    const existing=routes.find(r=>r.id===id);
    Object.assign(existing,{name,color:$("routeColor").value,stops});
  }else{
    routes.push({id:"r"+Date.now(),name,color:$("routeColor").value,stops,active:true});
  }
  $("routeModal").classList.remove("open");refresh();toast("Route saved successfully.");
}
function calculateFromForm(formType){
  const source=$(formType==="quick"?"quickSource":"sourceStop").value;
  const destination=$(formType==="quick"?"quickDestination":"destinationStop").value;
  const excluded=formType==="quick"?[]:[...document.querySelectorAll("#inactiveOptions input:checked")].map(i=>i.value);
  const result=findJourney(source,destination,excluded);lastJourney=result;
  switchView("planner");$("sourceStop").value=source;$("destinationStop").value=destination;
  renderJourney(result,source,destination);
}
function runBfsVisualization(){
  const source=$("bfsSource").value,destination=$("bfsDestination").value;
  const available=activeRoutes(), queue=available.filter(r=>r.stops.includes(source));
  const previous=new Map(queue.map(r=>[r.id,null])), order=[];
  let head=0,found=false;
  const targets=new Set(available.filter(r=>r.stops.includes(destination)).map(r=>r.id));
  while(head<queue.length){
    const route=queue[head++];order.push(route);
    if(targets.has(route.id)){found=true;break;}
    for(const next of available){
      if(previous.has(next.id))continue;
      if(route.stops.some(stop=>next.stops.includes(stop))){
        previous.set(next.id,route.id);queue.push(next);
      }
    }
  }
  $("bfsStatus").textContent=`Explored ${order.length} route${order.length===1?"":"s"} in breadth-first order`;
  $("bfsSteps").innerHTML=order.map((r,i)=>`<div class="bfs-step ${targets.has(r.id)&&i===order.length-1?"destination":i===order.length-1?"current":"visited"}" style="animation-delay:${i*.07}s"><b>${escapeHTML(r.name)}</b><small>Level ${i+1}${targets.has(r.id)?" · Target":""}</small></div>`).join("");
  const journey=findJourney(source,destination);
  $("bfsResult").textContent=found?`✓ Destination reached. Minimum buses: ${journey.buses}. Each BFS level represents one additional bus route.`:"No active path connects these stops.";
}
function bindEvents(){
  document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.view)));
  document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.go)));
  $("mobileMenu").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
  $("quickForm").addEventListener("submit",e=>{e.preventDefault();calculateFromForm("quick");});
  $("plannerForm").addEventListener("submit",e=>{e.preventDefault();calculateFromForm("planner");});
  $("swapStops").addEventListener("click",()=>{const a=$("sourceStop").value;$("sourceStop").value=$("destinationStop").value;$("destinationStop").value=a;});
  $("addRouteButton").addEventListener("click",()=>openRouteModal());
  $("routeForm").addEventListener("submit",saveRoute);
  document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>$ (b.dataset.close).classList.remove("open")));
  $("routeModal").addEventListener("click",e=>{if(e.target===$("routeModal"))$("routeModal").classList.remove("open");});
  $("networkGrid").addEventListener("click",e=>{
    const edit=e.target.closest("[data-edit]"),toggle=e.target.closest("[data-toggle]");
    if(edit){const r=routes.find(x=>x.id===edit.dataset.edit);openRouteModal(r);}
    if(toggle){const r=routes.find(x=>x.id===toggle.dataset.toggle);r.active=!r.active;refresh();toast(`${r.name} ${r.active?"activated":"closed"}.`);}
  });
  document.querySelectorAll(".filter-tab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".filter-tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderNetwork();}));
  $("routeSearch").addEventListener("input",renderNetwork);
  $("closureButton").addEventListener("click",()=>{switchView("network");document.querySelector('[data-filter="all"]').click();toast("Use Close on any route to simulate a closure.");});
  $("runBfs").addEventListener("click",runBfsVisualization);
  $("resetData").addEventListener("click",()=>{if(confirm("Restore the original TransitFlow demo routes?")){routes=structuredClone(demoRoutes);refresh();toast("Demo network restored.");}});
  $("helpButton").addEventListener("click",()=>alert("TransitFlow uses Breadth-First Search (BFS) to explore connected stops level by level. It returns a journey with the minimum number of bus segments. The result is not necessarily the shortest distance or fastest journey."));
}
document.addEventListener("DOMContentLoaded",()=>{bindEvents();fillAllSelects();renderOverview();renderNetwork();});
