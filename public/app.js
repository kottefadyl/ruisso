const $ = (selector,root=document) => root.querySelector(selector);
const app = $('#app');
const modal = $('#modal');
const state = { user:null,csrf:'',meta:null,center:'all',year:'',page:'dashboard',listPage:1,q:'',status:'',kind:'',period:'',data:null,request:0,reprise:false,exam:{subject_id:'',class_name:'',sequence:'',school_year:'',archived:''} };
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Number(value)||0);
const date = value => value ? new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',year:'numeric',timeZone:'Africa/Douala'}).format(new Date(`${String(value).slice(0,10)}T12:00:00Z`)) : '—';
const initials = name => String(name).trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
const isManager = () => state.user?.role === 'manager';
const paths = {
  grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  wallet:'M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v12H5a3 3 0 0 1-3-3V6 M20 12h-6v5h6 M17 14.5h.01',
  receipt:'M4 3l2 2 2-2 2 2 2-2 2 2 2-2 2 2 2-2v18l-2-2-2 2-2-2-2 2-2-2-2 2-2-2-2 2z M8 9h8 M8 13h8 M8 17h4',
  building:'M4 21V5h11v16 M15 10h5v11 M2 21h20 M8 9h3 M8 13h3 M8 17h3 M17 14h.01 M17 18h.01',
  shield:'M12 3l8 4v5c0 5-8 9-8 9s-8-4-8-9V7z M8 12l3 3 5-6',
  settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
  clock:'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  help:'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  logout:'M9 21H4V3h5 M9 12h12 M17 8l4 4-4 4',
  plus:'M12 5v14 M5 12h14',search:'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  arrow:'M5 12h14 M14 7l5 5-5 5',down:'M6 9l6 6 6-6',up:'M7 17L17 7 M7 7h10v10',
  close:'M6 6l12 12 M6 18L18 6',edit:'M12 20H4v-8 M16 3l5 5-11 11-6 1 1-6z M13 6l5 5',
  eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  print:'M6 9V3h12v6 M6 18H3V9h18v9h-3 M6 14h12v7H6z M17 12h.01',
  undo:'M3 10h10a7 7 0 0 1 0 14 M3 10l5-5 M3 10l5 5',
  check:'M5 12l4 4L19 6',lock:'M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3',
  pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0 M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  phone:'M5 3h4l2 5-3 2c2 4 3 5 6 6l2-3 5 2v4c-1 4-9 1-13-3S1 5 5 3',
  menu:'M4 6h16 M4 12h16 M4 18h16',book:'M12 6c-3-3-7-3-10-2v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-3-1-7-1-10 2z M12 6v15',
  mail:'M3 5h18v14H3z M3 5l9 7 9-7',chart:'M4 20h17 M7 15v-4 M12 15V4 M17 15V8',
  file:'M14 3H6v18h12V7z M14 3v4h4 M9 13h6 M9 17h6',transfer:'M4 8h14 M14 4l4 4-4 4 M20 16H6 M10 12l-4 4 4 4',
  archive:'M3 4h18v4H3z M5 8v12h14V8 M10 12h4',download:'M12 3v12 M7 10l5 5 5-5 M4 21h16',
  scale:'M12 3v18 M5 21h14 M6 7h12 M6 7l-3 7h6z M18 7l-3 7h6z',camera:'M4 7h4l2-3h4l2 3h4v13H4z M15 13a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.grid}"/></svg>`;
const brand = () => `<div class="brand"><img class="brand-mark" src="/assets/favicon.svg" alt=""><div><div class="brand-name">GestRuisseau</div><div class="brand-sub">LE RUISSEAU DU SUCCÈS</div></div></div>`;
const badge = v => `<span class="badge ${esc(v.status)}">${esc(v.label)}</span>`;
const button = (label,action,ico='plus',cls='',attrs='') => `<button type="button" class="btn ${cls}" data-action="${action}" ${attrs}>${icon(ico)}${label}</button>`;
const empty = (title,description,action='',label='',ico='people',compact=false) => `<div class="empty-state ${compact?'compact':''}"><div class="empty-icon">${icon(ico)}</div><h3>${title}</h3><p>${description}</p>${action?button(label,action,'plus','secondary'):''}</div>`;
const options = (items,value,key='id',label='name') => items.map(item=>`<option value="${esc(item[key])}" ${String(item[key])===String(value)?'selected':''}>${esc(item[label])}</option>`).join('');
const field = (label,name,value='',type='text',extra='',wide=false) => `<label class="field ${wide?'wide':''}"><span>${label}</span><input type="${type}" name="${name}" value="${esc(value)}" ${extra}></label>`;
const selectField = (label,name,opts,extra='',wide=false) => `<label class="field ${wide?'wide':''}"><span>${label}</span><select name="${name}" aria-label="${esc(label)}" ${extra}>${opts}</select></label>`;
const passwordField = (label,name,extra='autocomplete="current-password"') => `<label class="field"><span>${label}</span><div class="password-wrap"><input name="${name}" type="password" required maxlength="72" ${extra}><button type="button" class="icon-btn" data-action="toggle-password" aria-label="Afficher le mot de passe" aria-pressed="false">${icon('eye')}</button></div></label>`;
const methodOptions = '<option value="cash">Espèces</option><option value="mtn">MTN Mobile Money</option><option value="orange">Orange Money</option><option value="bank">Virement bancaire</option>';
const methods = {cash:'Espèces',mtn:'MTN Mobile Money',orange:'Orange Money',bank:'Virement bancaire'};
const monthLabel = p => p ? new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${p}-15T12:00:00Z`)) : '';
const duration = minutes => {const h=Math.floor(minutes/60),m=minutes%60;return `${h} h${m?` ${String(m).padStart(2,'0')}`:''}`;};
const payStatus = {due:['urgent','À payer'],partial:['warning','Partiellement payé'],paid:['active','Soldé'],overpaid:['expired','Trop-perçu'],none:['','Rien à payer']};
const payBadge = s => badge({status:payStatus[s.status][0],label:payStatus[s.status][1]});
const schoolStatus = {nouveau:'Nouveau',redoublant:'Redoublant'};
const avatarHtml = (name,photo,cls='') => photo?`<img class="avatar photo ${cls}" src="/api/files/${Number(photo)}" alt="">`:`<span class="avatar ${cls}">${esc(initials(name))}</span>`;
const capital = v => String(v||'').charAt(0).toUpperCase()+String(v||'').slice(1);
const fileSize = n => n>=1048576?`${(n/1048576).toFixed(1).replace('.',',')} Mo`:`${Math.max(1,Math.round(n/1024))} Ko`;
const payRule = (t,s=t) => s.pay_type==='monthly'?`Fixe · ${money(s.monthly_salary)} FCFA / mois`:`À l’heure · ${money(t.hourly_rate)} FCFA / h`;
const titles = {dashboard:'Tableau de bord',students:'Élèves',payments:'Paiements',cash:'Caisse & mouvements',teachers:'Enseignants & paie',exams:'Banque d’épreuves',reprise:'Reprise comptable',centers:'Nos sièges',users:'Équipe & accès',settings:'Paramètres',audit:'Journal d’activité',help:'Manuel d’utilisation'};

async function api(url,{method='GET',body}={}) {
  const response = await fetch(`/api${url}`,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':state.csrf},body:body?JSON.stringify(body):undefined});
  const data = await response.json();
  if(!response.ok) {
    if(response.status===401 && state.user) {resetPrivateState();await boot();}
    const error = new Error(data.error || 'Impossible de terminer cette action.'); error.fields=data.fields; error.duplicate=data.duplicate; throw error;
  }
  return data;
}
function resetPrivateState() {
  Object.assign(state,{user:null,meta:null,data:null,center:'all',year:'',page:'dashboard',listPage:1,q:'',status:'',kind:'',period:'',reprise:false,exam:{subject_id:'',class_name:'',sequence:'',school_year:'',archived:''}});
  state.request++;
  clearTimeout(paymentSearchTimer);paymentSearchSequence++;
  modal.close();modal.innerHTML='';
  $('#print-area').innerHTML='';
}
let toastTimer;
function toast(message,error=false) { const el=$('#toast');el.textContent=message;el.className=`show ${error?'error':''}`;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.className='',5500); }
function formError(form,error) {
  const el=$('.form-error',form);
  const detail=error.fields?.map(f=>f.message).join(' ');
  if(el) {el.textContent=detail || error.message;el.setAttribute('tabindex','-1');el.focus();} else toast(error.message,true);
}
function showModal(title,content,wide=false) {
  modal.className=wide?'dialog-wide':'';
  modal.innerHTML=`<div class="modal-header"><h2 id="modal-title">${title}</h2><button class="icon-btn" data-action="close" aria-label="Fermer">${icon('close')}</button></div><div class="modal-body">${content}</div>`;
  labelTables(modal);colorAvatars(modal);
  if(!modal.open) modal.showModal();
}
const actions = (submit='Enregistrer') => `<div class="modal-actions">${button('Annuler','close','close','secondary')}<button class="btn" type="submit">${icon('check')}${submit}</button></div>`;
const networkArt = () => `<svg class="network-art" viewBox="0 0 400 190" fill="none" aria-hidden="true"><path d="M80 65L200 140 320 65M200 140V40" stroke="#7eafff" stroke-width="1.5" stroke-dasharray="5 6"/><circle cx="80" cy="65" r="34" fill="#2254b5" stroke="#608cd2"/><circle cx="320" cy="65" r="34" fill="#2254b5" stroke="#608cd2"/><circle cx="200" cy="40" r="34" fill="#2254b5" stroke="#608cd2"/><rect x="174" y="114" width="52" height="52" rx="16" fill="#fff"/><path d="M188 130h11c7 0 10 10 0 13h-7v10M204 144l9 9" stroke="#174bc5" stroke-width="3" stroke-linecap="round"/><g stroke="#c1d7ff" stroke-width="2"><path d="M69 80V52h21v28M65 80h29M76 58h7M76 65h7M76 72h7 M189 54V26h21v28M185 54h29M196 32h7M196 39h7M196 46h7 M309 80V52h21v28M305 80h29M316 58h7M316 65h7M316 72h7"/></g><g fill="#bdd4f8" font-family="Segoe UI,sans-serif" font-size="11" text-anchor="middle"><text x="80" y="115">Biyem-Assi</text><text x="200" y="91">Ngoa Ekélé</text><text x="320" y="115">Mendong</text></g></svg>`;

function authPage(setup=false) {
  document.title=`${setup?'Première connexion':'Connexion'} · GestRuisseau`;
  const token = new URLSearchParams(location.hash.slice(1)).get('token') || '';
  app.innerHTML=`<main class="auth-page"><section class="auth-story">${brand()}<div class="auth-copy"><div class="eyebrow">Un élève, un examen.</div><h1>La réussite se<br>construit.<br><em>Ensemble.</em></h1><p>Vos élèves, vos équipes, vos sièges.<br>Un seul espace pour accompagner chaque parcours et garder le cap.</p><div class="auth-pills"><span>Gestion multisite</span><span>Suivi des paiements</span><span>Caisse transparente</span></div>${networkArt()}</div><div class="auth-footer"><span>Le Ruisseau du Succès</span><span>Yaoundé, Cameroun</span></div></section><section class="auth-main"><div class="auth-form-wrap">${brand()}<div class="auth-kicker">${icon('lock')} ESPACE DE GESTION</div><h2>${setup?'Bienvenue chez vous.':'Heureux de vous revoir.'}</h2><p>${setup?'Créez votre compte manager pour commencer à gérer le réseau. Vous pourrez ensuite inviter vos secrétaires.':'Connectez-vous pour retrouver l’activité de votre centre et accompagner la réussite de vos élèves.'}</p><form id="auth-form" data-type="${setup?'setup':'login'}"><div class="form-error" role="alert"></div>${setup?field('Votre nom complet','name','','text','required autocomplete="name" maxlength="120" placeholder="Ex. Jean Mballa"'):''}${field('Adresse e-mail','email','','email','required autocomplete="username" maxlength="190" placeholder="vous@exemple.cm"')}${passwordField(setup?'Choisissez un mot de passe':'Mot de passe','password',setup?'minlength="12" autocomplete="new-password" placeholder="Au moins 12 caractères"':'autocomplete="current-password" placeholder="Votre mot de passe"')}${setup?`${token?`<input type="hidden" name="token" value="${esc(token)}">`:field('Clé d’initialisation','token','','password','required autocomplete="off" placeholder="Clé affichée au démarrage du serveur"')}<p class="form-note">Ce compte disposera d’un accès à tous les sièges. La création initiale n’est possible qu’une seule fois.</p>`:''}<button type="submit" class="btn full">${setup?'Créer mon espace':'Se connecter'}${icon('arrow')}</button></form><p class="auth-help">${setup?'Votre mot de passe reste personnel. Choisissez une phrase longue que vous pourrez retenir.':'Un problème de connexion ?<br>Contactez le responsable de votre centre.'}</p><div class="auth-security">${icon('shield')} Accès privé · Données de votre réseau</div></div></section></main>`;
  if(token) history.replaceState(null,'','/initialisation');
}
async function boot() {
  try {
    let data;
    try { data=await api('/auth/bootstrap'); } catch { data=await api('/auth/bootstrap'); }
    state.csrf=data.csrf;state.user=data.user;
    if(!state.user) {resetPrivateState();authPage(data.needsSetup);return;}
    state.meta=await api('/meta'); state.year ||= state.meta.school_year;
    state.center=isManager()?state.center:String(state.user.center_id);
    state.page=location.hash.slice(1).split('?')[0] || 'dashboard';
    if(!titles[state.page]) state.page='dashboard';
    if(!isManager() && ['users','settings','audit'].includes(state.page)) state.page='dashboard';
    if(location.pathname!=='/app') history.replaceState(null,'',`/app#${state.page}`);
    shell();await renderPage();
  } catch(error) {app.innerHTML=`<div class="loading-screen">${icon('shield')}<h2>Connexion indisponible</h2><p>${esc(error.message)}</p>${button('Réessayer','retry','undo','secondary')}</div>`;}
}
const nav = (page,ico) => `<a class="nav-link ${state.page===page?'active':''}" href="#${page}" data-nav="${page}" ${state.page===page?'aria-current="page"':''}>${icon(ico)}<span>${titles[page]}</span></a>`;
const tab = (page,ico,label) => `<a class="tab ${state.page===page?'active':''}" href="#${page}" data-nav="${page}">${icon(ico)}<span>${label}</span></a>`;
function shell() {
  app.innerHTML=`<aside class="sidebar" id="sidebar">${brand()}<div class="nav-label">ESPACE DE GESTION</div><nav aria-label="Gestion">${nav('dashboard','grid')}${nav('students','people')}${nav('payments','receipt')}${nav('cash','wallet')}${nav('teachers','book')}${nav('exams','file')}${nav('reprise','scale')}</nav><div class="nav-label">LE RÉSEAU</div><nav aria-label="Administration">${nav('centers','building')}${isManager()?nav('users','shield')+nav('settings','settings')+nav('audit','clock'):''}</nav><div class="nav-label">AIDE</div><nav aria-label="Aide" class="nav-help">${nav('help','help')}</nav><div class="nav-spacer"></div><div class="sidebar-footer"><button class="user-chip" data-action="account" aria-label="Mon compte"><span class="avatar">${esc(initials(state.user.name))}</span><span class="user-meta"><strong>${esc(state.user.name)}</strong><span>${isManager()?'Manager du réseau':'Secrétariat · '+esc(state.meta.centers[0]?.name||'')}</span></span></button><button class="icon-btn" data-action="logout" aria-label="Se déconnecter" title="Se déconnecter">${icon('logout')}</button></div></aside><div class="scrim" data-action="menu-close" aria-hidden="true"></div><div class="workspace"><header class="topbar"><button class="icon-btn mobile-menu" data-action="menu" aria-label="Ouvrir la navigation" aria-expanded="false" aria-controls="sidebar">${icon('menu')}</button><div class="breadcrumb"><span>Espace de gestion</span><span>/</span><strong id="breadcrumb-title">${titles[state.page]}</strong></div><div class="top-actions"><a class="btn secondary small-btn top-help" href="#help" aria-label="Ouvrir le manuel" title="Manuel d’utilisation">${icon('help')}<span>Manuel</span></a><label class="context">${icon('building')}<span class="sr-only">Siège</span><select id="center-filter" class="context-select" aria-label="Filtrer par siège" ${isManager()?'':'disabled'}>${isManager()?'<option value="all">Tous les sièges</option>':''}${options(state.meta.centers,state.center)}</select></label><label class="context">${icon('clock')}<span class="sr-only">Session</span><select id="year-filter" class="context-select" aria-label="Session scolaire">${state.meta.years.map(y=>`<option ${y===state.year?'selected':''}>${esc(y)}</option>`).join('')}</select></label></div></header><main class="page" id="page" tabindex="-1"></main></div><nav class="bottom-nav" aria-label="Navigation rapide">${tab('dashboard','grid','Accueil')}${tab('students','people','Élèves')}<button type="button" class="tab tab-main" data-action="payment-new" aria-label="Enregistrer un paiement">${icon('plus')}<span>Encaisser</span></button>${tab('cash','wallet','Caisse')}${tab('teachers','book','Paie')}</nav>`;
  $('#center-filter').value=state.center;
}
// Sur mobile, chaque cellule reçoit l’intitulé de sa colonne pour un affichage en cartes.
function labelTables(root) {
  root.querySelectorAll('table').forEach(table=>{
    const heads=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach(row=>[...row.children].forEach((cell,i)=>{if(heads[i])cell.dataset.label=heads[i];}));
  });
}
// Couleur stable par personne : même nom, même teinte d’avatar.
function colorAvatars(root) {
  root.querySelectorAll('span.avatar:not([data-tone])').forEach(a=>{let h=0;for(const c of a.textContent)h=(h*31+c.charCodeAt(0))%997;a.dataset.tone=String(h%6);});
}
function setMenu(open) {
  $('#sidebar')?.classList.toggle('open',open); document.body.classList.toggle('menu-open',open);
  $('[data-action="menu"]')?.setAttribute('aria-expanded',String(open));
}
const scopeLabel = () => esc(`${state.center==='all'?'Tous les sièges':state.meta.centers.find(c=>String(c.id)===String(state.center))?.name||''} · Session ${state.year}`);
const pageIcons = {dashboard:'grid',students:'people',payments:'receipt',cash:'wallet',teachers:'book',exams:'file',reprise:'scale',centers:'building',users:'shield',settings:'settings',audit:'clock',help:'help'};
const pageHead = (title,subtitle,buttons='',kicker=scopeLabel()) => `<div class="page-heading"><div class="page-title-wrap"><span class="page-icon tone-${state.page}">${icon(pageIcons[state.page])}</span><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${subtitle}</p></div></div>${buttons?`<div class="heading-actions">${buttons}</div>`:''}</div>`;
const footer = () => `<footer class="page-footer"><span>© ${new Date().getFullYear()} GestRuisseau<span class="dot-separator">·</span>Le Ruisseau du Succès</span><span>Yaoundé, Cameroun<span class="dot-separator">·</span>Version 1.0</span></footer>`;
const stat = (label,value,foot,ico,color='',currency=false) => `<article class="stat-card"><div class="stat-top"><span class="stat-title">${label}</span><span class="stat-icon ${color}">${icon(ico)}</span></div><div class="stat-value">${money(value)}${currency?'<span class="currency">FCFA</span>':''}</div><div class="stat-foot">${foot}</div></article>`;
const query = extra => new URLSearchParams({center_id:state.center,...extra}).toString();
async function renderPage() {
  const turn=++state.request; const page=state.page;
  document.title=`${titles[page]} · GestRuisseau`;
  $('#breadcrumb-title').textContent=titles[page];
  document.querySelectorAll('[data-nav]').forEach(a=>{a.classList.toggle('active',a.dataset.nav===page);if(a.dataset.nav===page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  const container=$('#page');container.setAttribute('aria-busy','true');
  try {
    let html='';
    if(page==='dashboard'||page==='centers') {const data=await api(`/dashboard?${query({school_year:state.year})}`);if(turn!==state.request)return;state.data=data;html=page==='dashboard'?dashboard(data):centersPage(data);}
    if(page==='students') {const data=await api(`/students?${query({school_year:state.year,q:state.q,status:state.status,page:state.listPage})}`);if(turn!==state.request)return;state.data=data;html=studentsPage(data);}
    if(page==='payments'||page==='cash') {const data=await api(`/ledger?${query({q:state.q,kind:page==='payments'?'payment':state.kind,page:state.listPage})}`);if(turn!==state.request)return;state.data=data;html=ledgerPage(data,page==='payments');}
    if(page==='teachers') {const data=await api(`/teachers?period=${state.period||state.meta.today.slice(0,7)}`);if(turn!==state.request)return;state.data=data;state.period=data.period;html=teachersPage(data);}
    if(page==='exams') {const e=state.exam;const data=await api(`/exams?${new URLSearchParams({q:state.q,page:state.listPage,subject_id:e.subject_id,class_name:e.class_name,sequence:e.sequence,school_year:e.school_year,archived:e.archived})}`);if(turn!==state.request)return;state.data=data;html=examsPage(data);}
    if(page==='reprise') {const data=await api(`/reprise?${query({})}`);if(turn!==state.request)return;state.data=data;html=reprisePage(data);}
    if(page==='users') {const data=await api('/users');if(turn!==state.request)return;state.data=data;html=usersPage(data);}
    if(page==='settings') html=settingsPage();
    if(page==='audit') {const data=await api(`/audit?page=${state.listPage}`);if(turn!==state.request)return;state.data=data;html=auditPage(data);}
    if(page==='help') html=helpPage();
    if(turn!==state.request)return;
    container.innerHTML=html+footer();labelTables(container);colorAvatars(document);
  } catch(error) {if(turn===state.request && $('#page')) container.innerHTML=empty('Chargement impossible',esc(error.message),'refresh','Réessayer','help');}
  finally {container.removeAttribute('aria-busy');}
}
function chart(data) {
  const current=state.meta.today; const days=[];
  for(let i=6;i>=0;i--){const d=new Date(`${current}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-i);const key=d.toISOString().slice(0,10);days.push({key,label:new Intl.DateTimeFormat('fr-FR',{weekday:'short'}).format(d),...(data.find(v=>v.operation_date===key)||{income:0,expenses:0})});}
  const max=Math.max(10000,...days.flatMap(d=>[Number(d.income),Number(d.expenses)]));
  const lines=[0,1,2].map(i=>`<line x1="42" x2="550" y1="${15+i*60}" y2="${15+i*60}"/><text x="0" y="${18+i*60}">${money(Math.round(max*(1-i/2)/1000))}k</text>`).join('');
  const bars=days.map((d,i)=>{const x=62+i*71;const a=Number(d.income)/max*120,b=Number(d.expenses)/max*120;return `<g><title>${date(d.key)} : entrées ${money(d.income)}, sorties ${money(d.expenses)} FCFA</title><rect x="${x}" y="${135-Math.max(a,2)}" width="17" height="${Math.max(a,2)}" rx="3" fill="${a?'#2259cc':'#e9eff9'}"/><rect x="${x+21}" y="${135-Math.max(b,2)}" width="17" height="${Math.max(b,2)}" rx="3" fill="${b?'#9abaf4':'#f1f4fa'}"/><text x="${x+19}" y="160" text-anchor="middle">${esc(d.label)}</text></g>`;}).join('');
  return `<div class="legend"><span><i></i>Entrées</span><span><i class="expenses"></i>Sorties</span><span>En milliers de FCFA</span></div><svg class="chart" viewBox="0 0 560 175" role="img" aria-label="Entrées et sorties sur les sept derniers jours">${lines}${bars}</svg>${data.length?'':'<p class="chart-empty">Vos premiers mouvements apparaîtront ici.</p>'}`;
}
const quick = (action,ico,label,hint,cls='') => `<button type="button" class="quick-action ${cls}" data-action="${action}" aria-label="${label}"><span class="quick-icon">${icon(ico)}</span><span><strong>${label}</strong><small>${hint}</small></span>${icon('arrow')}</button>`;
function onboarding() {
  const steps=[['Vérifiez vos sièges','Adresses et téléphones dans « Nos sièges ».','#centers',isManager()],['Créez les accès secrétaires','Un compte par secrétaire, limité à son siège.','#users',isManager()],['Inscrivez votre premier élève','Classe, groupe et contact du parent.','student-new',true],['Enregistrez son paiement','Le reçu et la validité sont créés ensemble.','payment-new',true]].filter(x=>x[3]);
  return `<section class="panel onboarding"><div class="panel-header"><div><h2>Bienvenue dans GestRuisseau</h2><p>Quelques étapes pour bien démarrer. Tout est expliqué en détail dans le <a href="#help">manuel d’utilisation</a>.</p></div>${button('Inscrire un élève','student-new')}</div><ol class="steps">${steps.map(([title,hint,target],i)=>`<li>${target.startsWith('#')?`<a href="${target}">`:`<button type="button" data-action="${target}">`}<span class="step-number">${i+1}</span><span><strong>${title}</strong><small>${hint}</small></span>${icon('arrow')}${target.startsWith('#')?'</a>':'</button>'}</li>`).join('')}</ol></section>`;
}
function dashboard(data) {
  const todayLabel=new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Douala'}).format(new Date());
  const first=!data.students.total&&!data.recent.length;
  return pageHead(`Bonjour, ${esc(state.user.name.split(' ')[0])}`,`${esc(todayLabel)} · voici l’essentiel ${state.center==='all'?'de votre réseau':'de votre siège'}.`)+
    (first?onboarding():`<div class="quick-grid">${quick('student-new','people','Nouvel élève','Inscription et contact du parent')}${quick('payment-new','receipt','Enregistrer un paiement','Mensualité ou inscription, avec reçu','primary')}${quick('expense-new','wallet','Enregistrer une dépense','Fournitures, loyer, transport…')}${quick('session-new','clock','Saisir une séance','Heures de cours d’un enseignant')}</div>`)+
    `<div class="stats-grid">${stat('Élèves inscrits',data.students.total,`<span class="green">${money(data.students.active)} validités actives</span> · session ${esc(state.year)}`,'people')}${stat('Encaissements du jour',data.finance.today_income,'Toutes les entrées du jour, annulations incluses','receipt','green',true)}${stat('Solde des caisses',data.finance.balance,`${data.centers.length} siège${data.centers.length>1?'s':''} · toutes périodes`,'wallet','purple',true)}${stat('Élèves à suivre',Number(data.students.expiring)+Number(data.students.unpaid),`${money(data.students.expiring)} à échéance · ${money(data.students.unpaid)} expirés ou non payés`,'clock','amber')}</div>`+
    `<div class="dashboard-grid"><section class="panel"><div class="panel-header"><div><h2>Les mouvements de la semaine</h2><p>Une vue claire sur vos entrées et sorties</p></div><span class="panel-tag">7 derniers jours</span></div><div class="panel-body">${chart(data.chart)}</div></section><section class="panel"><div class="panel-header"><h2>Vos sièges</h2><a class="panel-link" href="#centers">Tout voir ${icon('arrow')}</a></div><div class="centers-list">${data.centers.map(c=>`<div class="center-row"><span class="center-marker">${icon('building')}</span><div class="center-info"><strong>${esc(c.name)}</strong><span>${c.student_count} élèves · Yaoundé</span></div><div class="center-balance">${money(c.balance)}<span>FCFA en caisse</span></div></div>`).join('')}</div></section></div>`+
    `<div class="dashboard-bottom"><section class="panel"><div class="panel-header"><h2>Dernières opérations</h2><a class="panel-link" href="#cash">Voir la caisse ${icon('arrow')}</a></div>${data.recent.length?ledgerTable(data.recent,true):empty('Votre caisse attend ses premiers mouvements','Les paiements et dépenses enregistrés apparaîtront ici.','payment-new','Enregistrer un paiement','wallet',true)}</section><section class="panel"><div class="panel-header"><h2>Les élèves à accompagner</h2><a class="panel-link" href="#students">Voir les élèves ${icon('arrow')}</a></div>${data.alerts.length?`<div class="panel-body">${data.alerts.map(s=>`<div class="alert-row"><span class="avatar">${esc(initials(s.name))}</span><div class="alert-info"><strong>${esc(s.name)}</strong><p>${esc(s.class_name)} · ${esc(s.center_name)}</p></div><button class="icon-btn" data-action="student-view" data-id="${s.id}" aria-label="Ouvrir la fiche de ${esc(s.name)}">${icon('arrow')}</button>${badge(s.validity)}</div>`).join('')}</div>`:empty('Tout est à jour','Les validités proches de l’échéance et les élèves non payés seront signalés ici.','','','check',true)}</section></div>`;
}
const pagination = data => `<div class="pagination"><span>${money(data.total)} résultat${data.total>1?'s':''}</span><div><button class="icon-btn" data-action="page-prev" ${data.page<=1?'disabled':''} aria-label="Page précédente">‹</button><span>Page ${data.page} sur ${data.pages}</span><button class="icon-btn" data-action="page-next" ${data.page>=data.pages?'disabled':''} aria-label="Page suivante">›</button></div></div>`;
const searchInput = placeholder => `<form class="search" id="search-form">${icon('search')}<input name="q" aria-label="${placeholder}" placeholder="${placeholder}" value="${esc(state.q)}" maxlength="100"></form>`;
const chips = (action,current,items) => `<div class="chips" role="group" aria-label="Filtres">${items.map(([value,label])=>`<button type="button" class="chip ${current===value?'active':''}" data-action="${action}" data-value="${value}" aria-pressed="${current===value}">${label}</button>`).join('')}</div>`;
const tel = phone => phone ? `<a class="tel" href="tel:${esc(String(phone).replace(/[^d+]/g,''))}" data-action="noop">${esc(phone)}</a>` : '';
function studentsPage(data) {
  const filtered=state.q||state.status;
  return pageHead('Élèves','Inscriptions, contacts des parents et validités. Cliquez sur un élève pour ouvrir sa fiche.',button('Inscrire un élève','student-new'))+
  `<section class="panel"><div class="toolbar">${searchInput('Rechercher un nom, une classe, un téléphone…')}${chips('status',state.status,[['','Tous'],['active','À jour'],['expiring','Échéance proche'],['expired','Expirés'],['unpaid','Non payés']])}</div>${data.items.length?`<div class="table-wrap"><table class="clickable"><thead><tr><th>Élève</th><th>Classe / groupe</th><th>Siège / quartier</th><th>Parent / tuteur</th><th>Validité</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${data.items.map(s=>`<tr data-action="student-view" data-id="${s.id}"><td><div class="person-cell"><span class="avatar">${esc(initials(s.name))}</span><div><strong>${esc(s.name)}</strong><small>EL-${String(s.id).padStart(4,'0')}</small></div></div></td><td>${esc(s.class_name)} <span class="badge ${s.school_status==='redoublant'?'warning':'blue'}">${esc(schoolStatus[s.school_status]||'')}</span><small>${esc(s.group_name||'Sans groupe')}</small></td><td>${esc(s.center_name)}<small>${esc(s.quarter||'Quartier non précisé')}</small></td><td>${esc(s.parent_name)}<small>${tel(s.parent_phone)}</small></td><td>${badge(s.validity)}<small>${s.valid_until?'Jusqu’au '+date(s.valid_until):'Aucune période active'}</small></td><td><div class="row-actions">${button('Encaisser','student-pay','receipt','small-btn '+(['active','warning'].includes(s.validity.status)?'secondary':''),`data-id="${s.id}" aria-label="Encaisser un paiement pour ${esc(s.name)}"`)}<button class="icon-btn" data-action="student-edit" data-id="${s.id}" aria-label="Modifier ${esc(s.name)}" title="Modifier la fiche">${icon('edit')}</button><button class="icon-btn" data-action="student-view" data-id="${s.id}" aria-label="Voir ${esc(s.name)}" title="Ouvrir la fiche">${icon('eye')}</button></div></td></tr>`).join('')}</tbody></table></div>`:empty(filtered?'Aucun élève trouvé':'Bienvenue à vos futurs élèves',filtered?'Essayez une autre recherche ou un autre filtre.':'Créez une fiche pour commencer le suivi de son inscription, de ses paiements et de sa validité.',filtered?'':'student-new','Inscrire un élève')}${pagination(data)}</section>`;
}
const kindLabels={payment:'Paiement élève',income:'Recette',expense:'Dépense',opening:'Solde initial',reversal:'Annulation',salary:'Salaire enseignant',advance:'Avance sur salaire',transfer:'Transfert entre caisses',remittance:'Reversement au promoteur'};
const amount = l => `<span class="amount ${l.amount>0?'in':'out'}">${l.amount>0?'+':'−'}${money(Math.abs(l.amount))}<span class="currency"> FCFA</span></span>`;
const ledgerStatus = l => (l.reversed_by?'<span class="badge expired">Annulée</span>':l.kind==='reversal'?'<span class="badge warning">Contre-écriture</span>':'')+(l.source==='reprise'?' <span class="badge blue">Reprise</span>':'')+(l.missing_doc&&!l.attachment_file_id&&l.kind!=='reversal'?' <span class="badge urgent">Pièce manquante</span>':'');
function ledgerTable(items,compact=false) {
  return `<div class="table-wrap"><table class="clickable"><thead><tr><th>Opération</th>${compact?'<th>Siège</th>':'<th>Siège / date</th><th>Mode</th>'}<th class="num">Montant</th><th><span class="sr-only">Justificatif</span></th></tr></thead><tbody>${items.map(l=>`<tr data-action="receipt" data-id="${l.id}" class="${l.reversed_by?'is-reversed':''}"><td><strong>${esc(l.student_name||l.teacher_name||(l.kind==='transfer'&&l.link_center_name?`${l.amount<0?'Vers':'Depuis'} ${l.link_center_name}`:l.category))}</strong> ${ledgerStatus(l)}<small>${esc(kindLabels[l.kind]||l.category)}${compact?' · '+date(l.operation_date):' · '+esc(l.receipt_number||l.reference)}${l.receipt_ref?' · pièce '+esc(l.receipt_ref):''}</small></td>${compact?`<td>${esc(l.center_name)}</td>`:`<td>${esc(l.center_name)}<small>${date(l.operation_date)} · ${esc(l.author_name)}</small></td><td>${esc(methods[l.method])}</td>`}<td class="num">${amount(l)}</td><td><div class="row-actions"><button class="icon-btn" data-action="receipt" data-id="${l.id}" aria-label="Reçu ${esc(l.reference)}" title="Voir le justificatif">${icon('receipt')}</button></div></td></tr>`).join('')}</tbody></table></div>`;
}
function ledgerPage(data,payments) {
  return pageHead(payments?'Paiements':'Caisse & mouvements',payments?'Chaque paiement est lié à un élève, à un siège et à un reçu. Cliquez sur une ligne pour revoir le reçu.':'Toutes les entrées et sorties d’argent. Cliquez sur une ligne pour voir le justificatif.',payments?button('Enregistrer un paiement','payment-new'):button('Autre recette','income-new','plus','secondary')+button('Transfert / reversement','transfer-new','transfer','secondary')+button('Enregistrer une dépense','expense-new','plus'))+
    (!payments?`<div class="stats-grid metrics-three">${stat('Total des entrées',data.totals.income,'Toutes périodes, annulations comprises','up','green',true)}${stat('Total des sorties',data.totals.expenses,'Toutes périodes, annulations comprises','wallet','amber',true)}${stat('Solde disponible',data.totals.balance,'Espèces, Mobile Money et virements','wallet','',true)}</div>`:'')+
    `<section class="panel"><div class="toolbar">${searchInput('Rechercher une référence, un nom, un motif…')}${payments?'':chips('kind',state.kind,[['','Tout'],['income','Entrées'],['expense','Sorties'],['transfer','Transferts'],['reprise','Reprise'],['missing','Pièces manquantes']])}</div>${data.items.length?ledgerTable(data.items):empty(payments?'Aucun paiement pour le moment':'Votre historique est prêt',payments?'Enregistrez le paiement d’un élève pour générer son reçu et actualiser sa validité.':'Les paiements, recettes et dépenses de votre siège apparaîtront ici.',payments?'payment-new':'income-new',payments?'Premier paiement':'Ajouter une recette',payments?'receipt':'wallet')}${pagination(data)}</section><p class="footnote">${icon('shield')} ${payments?'Un renouvellement anticipé prolonge la validité existante.':'Aucun mouvement n’est jamais supprimé : en cas d’erreur, le manager l’annule depuis son justificatif, avec un motif.'}</p>`;
}
function teachersPage(data) {
  const t=data.totals;
  return pageHead('Enseignants & paie','Séances, avances et salaires du mois, pour les enseignants payés à l’heure ou au salaire fixe.',button('Saisir une séance','session-new','clock','secondary')+(isManager()?button('Nouvel enseignant','teacher-new'):''))+
    `<div class="stats-grid">${stat(`Dû pour ${esc(monthLabel(data.period))}`,t.gross,'Heures × taux ou salaire fixe','book','',true)}${stat('Avances versées',t.advances,'Déduites du salaire du mois','wallet','amber',true)}${stat('Salaires versés',t.paid,'Sorties de caisse, tous sièges','check','green',true)}${stat('Reste à payer',t.remaining,'Somme des montants encore dus','clock','purple',true)}</div>`+
    `<section class="panel"><div class="toolbar"><label class="small muted" for="period-filter">Mois de paie</label><input type="month" id="period-filter" value="${esc(data.period)}" max="${esc(data.current_period)}" aria-label="Mois de paie"><span class="record-count">${data.items.length} enseignant${data.items.length>1?'s':''} · montants en FCFA</span></div>${data.items.length?`<div class="table-wrap"><table class="clickable"><thead><tr><th>Enseignant</th><th>Mode de paie</th><th>Activité du mois</th><th>Dû</th><th>Avances</th><th>Versé</th><th>Reste</th><th>Statut</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${data.items.map(x=>{const s=x.summary;return `<tr data-action="teacher-view" data-id="${x.id}"><td><div class="person-cell">${avatarHtml(x.name,x.photo_file_id)}<div><strong>${esc(x.name)}</strong><small>${x.matricule?esc(x.matricule)+' · ':'<span class="badge warning">Dossier à compléter</span> '}${esc(x.subjects||'Matières non précisées')}${x.active?'':' · désactivé'}</small></div></div></td><td>${esc(payRule(x,s))}${s.frozen?'<small>Barème figé pour ce mois</small>':''}</td><td>${s.sessions?`${duration(s.minutes)}<small>${s.sessions} séance${s.sessions>1?'s':''}</small>`:'<span class="muted">Aucune séance</span>'}</td><td><strong>${money(s.gross)}</strong></td><td>${money(s.advances)}</td><td>${money(s.paid)}</td><td class="amount ${s.remaining>0?'out':''}">${money(s.remaining)}</td><td>${payBadge(s)}</td><td><div class="row-actions"><button class="icon-btn" data-action="teacher-view" data-id="${x.id}" aria-label="Voir ${esc(x.name)}" title="Fiche et détail du mois">${icon('eye')}</button>${x.active?`<button class="icon-btn" data-action="session-new" data-id="${x.id}" aria-label="Séance de ${esc(x.name)}" title="Saisir une séance">${icon('clock')}</button>`:''}${button('Payer','teacher-pay','wallet','small-btn '+(s.remaining>0?'':'secondary'),`data-id="${x.id}" aria-label="Payer ${esc(x.name)}"`)}${isManager()?`<button class="icon-btn" data-action="teacher-edit" data-id="${x.id}" aria-label="Modifier ${esc(x.name)}" title="Modifier la fiche">${icon('edit')}</button>`:''}</div></td></tr>`;}).join('')}</tbody></table></div>`:empty('Aucun enseignant pour ce mois',isManager()?'Créez la fiche d’un enseignant : paiement à l’heure ou salaire mensuel fixe.':'Le manager doit d’abord créer les fiches enseignants.',isManager()?'teacher-new':'',isManager()?'Nouvel enseignant':'','book')}</section><p class="footnote">${icon('shield')} <span>Le dû d’un enseignant à l’heure est la somme de ses séances du mois, au taux en vigueur lors de la saisie. Le barème d’un mois est figé dès la première avance ou le premier versement. Avances et salaires sortent de la caisse du siège qui paie.</span></p>`;
}
function centersPage(data) {
  return pageHead('Nos sièges','Effectifs et situation de caisse de chaque siège.',isManager()?button('Ajouter un siège','center-new'):'')+
    `<div class="cards-grid">${data.centers.map((c,i)=>`<article class="panel center-card"><div class="center-card-top"><span class="center-marker">${icon('building')}</span><span class="badge active">Siège ${String(i+1).padStart(2,'0')}</span>${isManager()?`<button class="icon-btn" data-action="center-edit" data-id="${c.id}" aria-label="Modifier ${esc(c.name)}">${icon('edit')}</button>`:''}</div><h2>${esc(c.name)}</h2><p class="address">${esc(c.address)}</p><p class="contact">${icon('phone')}${esc(c.phone||'Téléphone à renseigner')}</p><div class="center-card-stats"><div><strong>${c.student_count}</strong><span>élèves · ${esc(state.year)}</span></div><div><strong>${money(c.balance)}</strong><span>FCFA en caisse</span></div></div>${button('Ouvrir le tableau de bord','center-open','arrow','secondary',`data-id="${c.id}"`)}</article>`).join('')}</div>`;
}
function usersPage(users) {
  return pageHead('Équipe & accès','Le manager voit tout le réseau. Chaque secrétaire n’accède qu’à son siège.',button('Créer un accès secrétaire','user-new'))+
    `<section class="panel"><div class="table-wrap"><table><thead><tr><th>Utilisateur</th><th>Rôle</th><th>Périmètre d’accès</th><th>Statut</th><th></th></tr></thead><tbody>${users.map(u=>`<tr><td><div class="person-cell"><span class="avatar">${esc(initials(u.name))}</span><div><strong>${esc(u.name)}</strong><small>${esc(u.email)}</small></div></div></td><td>${u.role==='manager'?'Manager':'Secrétaire'}</td><td>${esc(u.center_name||'Tous les sièges')}</td><td><span class="badge ${u.active?'active':'expired'}">${u.active?'Actif':'Désactivé'}</span></td><td>${u.role==='secretary'?button('Modifier','user-edit','edit','secondary small-btn',`data-id="${u.id}"`):'<span class="muted small">Compte principal</span>'}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function settingsPage() {
  return pageHead('Paramètres','Tarifs, durées de validité et session scolaire par défaut.')+
    `<div class="settings-grid"><section class="panel"><div class="panel-header"><div><h2>Tarifs & validités</h2><p>Les nouveaux paiements utilisent les tarifs en vigueur.</p></div>${button('Ajouter','tariff-new','plus','secondary small-btn')}</div><div class="table-wrap"><table><thead><tr><th>Libellé</th><th>Montant</th><th>Validité</th><th></th></tr></thead><tbody>${state.meta.tariffs.map(t=>`<tr><td><strong>${esc(t.name)}</strong><small>${t.active?'Disponible':'Désactivé'}</small></td><td>${money(t.amount)} FCFA</td><td>${t.duration_days?`${t.duration_days} jours`:'Sans prolongation'}</td><td><button class="icon-btn" data-action="tariff-edit" data-id="${t.id}" aria-label="Modifier ${esc(t.name)}">${icon('edit')}</button></td></tr>`).join('')}</tbody></table></div><div class="panel-body"><p class="form-note">Les montants proviennent des flyers fournis. Une mensualité correspond ici à 30 jours. Les changements de tarif ne modifient pas les paiements déjà enregistrés.</p></div></section><div><section class="panel"><div class="panel-header"><h2>Session scolaire par défaut</h2></div><div class="panel-body"><form id="settings-form"><div class="form-error" role="alert"></div>${field('Session','school_year',state.meta.school_year,'text','required pattern="20[0-9]{2}-20[0-9]{2}" placeholder="2026-2027"')}${field('Début de la reprise comptable','reprise_start',state.meta.reprise_start,'date',`required max="${esc(state.meta.today)}"`)}<p class="form-note">Les inscriptions précédentes restent consultables en changeant la session dans la barre supérieure. Les opérations de reprise peuvent être datées à partir du début de la reprise.</p><button class="btn" type="submit">Enregistrer</button></form></div></section><section class="panel"><div class="panel-header"><div><h2>Matières prédéfinies</h2><p>Proposées dans le dossier enseignant et la banque d’épreuves.</p></div>${button('Ajouter','subject-new','plus','secondary small-btn')}</div><div class="panel-body"><div class="subject-list">${state.meta.subjects.map(x=>`<button type="button" class="chip ${x.active?'':'inactive'}" data-action="subject-edit" data-id="${x.id}" title="Modifier">${esc(x.name)}${x.active?'':' (désactivée)'}</button>`).join('')||'<p class="form-note">Aucune matière.</p>'}</div></div></section><section class="panel" styleless="true"><div class="panel-header"><h2>Votre sécurité</h2></div><div class="panel-body"><p class="form-note">Modifiez votre mot de passe depuis votre compte. Ce changement déconnecte toutes vos sessions.</p>${button('Mon compte','account','shield','secondary')}</div></section></div></div>`;
}
const auditLabels={'account.setup':'Création du compte manager','account.login':'Connexion','account.password_changed':'Changement de mot de passe','student.created':'Inscription d’un élève','student.updated':'Modification d’un élève','payment.created':'Paiement enregistré','ledger.created':'Mouvement de caisse','ledger.reversed':'Annulation financière','center.created':'Création d’un siège','center.updated':'Modification d’un siège','user.created':'Création d’un accès','user.updated':'Modification d’un accès','tariff.created':'Création d’un tarif','tariff.updated':'Modification d’un tarif','settings.updated':'Modification des paramètres','teacher.created':'Création d’un enseignant','teacher.updated':'Modification d’un enseignant','teacher_session.created':'Séance enregistrée','teacher_session.cancelled':'Séance annulée','teacher.salary_paid':'Salaire versé','teacher.advance_paid':'Avance sur salaire','ledger.transfer':'Transfert entre caisses','ledger.remittance':'Reversement au promoteur','ledger.attachment_added':'Justificatif joint','file.uploaded':'Fichier déposé','subject.created':'Création d’une matière','subject.updated':'Modification d’une matière','exam.created':'Sujet déposé','exam.updated':'Sujet modifié','exam.archived':'Sujet archivé','exam.restored':'Sujet restauré','cash.counted':'Comptage de caisse','reprise.validated':'Reprise validée','reprise.reopened':'Reprise réouverte'};
function auditPage(data) {
  return pageHead('Journal d’activité','Connexions, modifications et opérations du réseau, de la plus récente à la plus ancienne.')+`<section class="panel"><div class="table-wrap"><table><thead><tr><th>Date</th><th>Action</th><th>Auteur</th><th>Siège</th><th>Élément</th></tr></thead><tbody>${data.items.map(a=>`<tr><td>${date(a.created_at)}<small>${esc(String(a.created_at).slice(11,16))} UTC</small></td><td>${esc(auditLabels[a.action]||a.action)}</td><td>${esc(a.author_name||'Système')}</td><td>${esc(a.center_name||'Réseau')}</td><td>${esc(a.entity)} #${a.entity_id}</td></tr>`).join('')}</tbody></table></div>${pagination(data)}</section>`;
}
// Rubrique « Manuel d’utilisation » : contenu dans public/manual.js, filtré selon le rôle.
function manualSections() {
  return (window.manualContent?window.manualContent({icon,button}):[]).filter(s=>s.role==='all'||isManager()).map((s,i)=>({...s,title:`${i+1}. ${s.title.replace(/^\d+\.\s*/,'')}`}));
}
function helpPage() {
  const sections=manualSections();
  return pageHead('Manuel d’utilisation',isManager()?'Le guide complet de GestRuisseau, pour le directeur et les secrétaires. Les sections marquées « Manager » sont masquées pour les secrétaires.':'Le guide complet de votre espace secrétariat : chaque écran, pas à pas, avec des exemples.',button('Imprimer le manuel','manual-print','print','secondary'),'AIDE')+
    `<div class="manual"><nav class="manual-toc" aria-label="Sommaire du manuel"><div class="search">${icon('search')}<input id="manual-search" type="search" placeholder="Rechercher dans le manuel" aria-label="Rechercher dans le manuel" autocomplete="off"></div><ol>${sections.map(s=>`<li data-section="${s.id}"><button type="button" data-action="manual-goto" data-target="${s.id}">${esc(s.title.replace(/^\d+\.\s*/,''))}${s.role==='manager'?' <span class="badge blue">Manager</span>':''}</button></li>`).join('')}</ol></nav><div class="manual-content">${sections.map(s=>`<section class="panel manual-section" id="manual-${s.id}" data-section="${s.id}"><div class="panel-header"><h2>${esc(s.title)}</h2>${s.role==='manager'?'<span class="badge blue">Manager</span>':''}</div><div class="panel-body help-copy">${s.html}</div></section>`).join('')}<div class="manual-empty" hidden>${empty('Aucune section trouvée','Essayez un autre mot : paiement, séance, mot de passe, annulation…','','','search',true)}</div></div></div>`;
}
const normalizeText = v => String(v).toLowerCase().normalize('NFD').replace(/\p{M}/gu,'');
function filterManual(q) {
  const term=normalizeText(q.trim()); let shown=0;
  document.querySelectorAll('.manual-section').forEach(section=>{
    const match=!term||normalizeText(section.textContent).includes(term);
    section.hidden=!match; if(match) shown++;
    const entry=$(`.manual-toc li[data-section="${section.dataset.section}"]`); if(entry) entry.hidden=!match;
  });
  const none=$('.manual-empty'); if(none) none.hidden=shown>0;
}
function printManual() {
  $('#print-area').innerHTML=`<article class="manual-print"><h1>GestRuisseau — Manuel d’utilisation</h1><p class="manual-print-sub">Le Ruisseau du Succès · ${isManager()?'Édition directeur et secrétaires':'Édition secrétariat'} · ${date(state.meta.today)}</p>${manualSections().map(s=>`<section><h2>${esc(s.title)}${s.role==='manager'?' (manager)':''}</h2>${s.html}</section>`).join('')}</article>`;
  window.print();
}

function studentForm(student=null) {
  const s=student||{center_id:state.center==='all'?state.meta.centers[0]?.id:state.center,school_year:state.year};
  const classes=['6e','5e','4e','3e','2nde A','2nde C','1ère A','1ère C','1ère D','Terminale A','Terminale C','Terminale D'];
  showModal(student?'Modifier la fiche élève':state.reprise?'Reprendre une fiche élève':'Inscrire un nouvel élève',`<p class="modal-subtitle">${state.reprise&&!student?'Reprise : indiquez la date réelle d’inscription. Une fiche du même nom dans le siège et la session sera signalée avant enregistrement.':'Une fiche claire pour suivre le parcours de l’élève et garder le lien avec son parent.'} L’inscription n’est pas un paiement : les frais s’encaissent ensuite.</p><form id="student-form" data-id="${student?.id||''}"><div class="form-error" role="alert"></div><div class="form-grid">${field('Nom complet de l’élève *','name',s.name,'text','required maxlength="140" placeholder="Ex. Marie Atangana"',true)}${selectField('Siège *','center_id',options(state.meta.centers,s.center_id),student?'disabled':'required')}${field('Session scolaire *','school_year',s.school_year,'text',`required pattern="20[0-9]{2}-20[0-9]{2}" ${student?'readonly':''}`)}<label class="field"><span>Classe *</span><input name="class_name" list="class-list" value="${esc(s.class_name)}" required maxlength="60" placeholder="Ex. Terminale A"><datalist id="class-list">${classes.map(c=>`<option value="${c}">`).join('')}</datalist></label>${field('Groupe','group_name',s.group_name,'text','maxlength="80" placeholder="Ex. Groupe du soir"')}${selectField('Statut scolaire *','school_status',`<option value="" ${s.school_status?'':'selected'} disabled>Choisir…</option>${Object.entries(schoolStatus).map(([v,l])=>`<option value="${v}" ${s.school_status===v?'selected':''}>${l}</option>`).join('')}`,'required id="student-status"')}${field('Quartier','quarter',s.quarter,'text','maxlength="100" placeholder="Ex. Biyem-Assi Lac"')}<div class="wide similar-hint" id="student-similar" aria-live="polite"><small>Nouveau : première fréquentation de cette classe. Redoublant : reprise d’une classe déjà suivie (à l’école, quel que soit le centre).</small></div>${!student&&state.reprise?field('Date réelle d’inscription *','enrolled_on','','date',`required min="${esc(state.meta.reprise_start)}" max="${esc(state.meta.today)}"`)+'<input type="hidden" name="reprise" value="true">':''}${field('Nom du parent / tuteur *','parent_name',s.parent_name,'text','required maxlength="140"',true)}${field('Téléphone du parent *','parent_phone',s.parent_phone,'tel','required maxlength="30" placeholder="+237 6XX XX XX XX"')}${field('E-mail du parent','parent_email',s.parent_email,'email','maxlength="190"')}<label class="field wide"><span>Notes utiles</span><textarea name="notes" maxlength="1000" placeholder="Informations utiles au suivi de l’élève">${esc(s.notes)}</textarea></label></div>${actions(student?'Enregistrer les modifications':'Inscrire l’élève')}</form>`);
}
async function studentView(studentId) {
  const s=await api(`/students/${studentId}`); const center=state.meta.centers.find(c=>c.id===s.center_id);
  const phone=String(s.parent_phone||'').replace(/[^\d+]/g,'');
  showModal('Fiche élève',`<div class="detail-header"><span class="avatar">${esc(initials(s.name))}</span><div><h3>${esc(s.name)}</h3><p class="muted small">EL-${String(s.id).padStart(4,'0')} · ${esc(s.class_name)} · ${esc(s.group_name||'Sans groupe')} · ${esc(center?.name)}</p></div></div><div class="validity-card ${esc(s.validity.status)}"><div><span>Validité</span><strong>${esc(s.validity.label)}</strong><small>${s.valid_until?`${s.validity.days>0?'Jusqu’au':'Depuis le'} ${date(s.valid_until)}`:'Aucun paiement de mensualité'}</small></div>${button(s.validity.status==='active'?'Renouveler':'Encaisser un paiement','student-pay','receipt','',`data-id="${s.id}"`)}</div><div class="detail-actions">${phone?`<a class="btn secondary" href="tel:${esc(phone)}">${icon('phone')}Appeler le parent</a>`:''}${button('Modifier la fiche','student-edit','edit','secondary',`data-id="${s.id}"`)}</div><dl class="detail-grid"><div><dt>Parent / tuteur</dt><dd>${esc(s.parent_name)}<br>${esc(s.parent_phone)}</dd></div><div><dt>E-mail du parent</dt><dd>${esc(s.parent_email||'Non renseigné')}</dd></div><div><dt>Siège / session</dt><dd>${esc(center?.name)} · ${esc(s.school_year)}</dd></div><div><dt>Quartier</dt><dd>${esc(s.quarter||'Non renseigné')}</dd></div><div><dt>Statut scolaire</dt><dd>${esc(schoolStatus[s.school_status]||'—')}</dd></div><div><dt>Inscrit le</dt><dd>${date(s.enrolled_on||s.created_at)}${s.source==='reprise'?` <span class="badge blue">Reprise</span><small class="muted"> · saisi le ${date(s.created_at)}</small>`:''}</dd></div></dl>${s.notes?`<p class="form-note">${esc(s.notes)}</p>`:''}<h3 class="section-title">Historique des paiements</h3>${s.payments.length?ledgerTable(s.payments,true):empty('Aucun paiement enregistré','Encaissez un premier paiement pour démarrer le suivi.','','','receipt',true)}`,true);
}
const addDaysLocal = (value,days) => {const d=new Date(`${value}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
const normalizeClass = v => String(v||'').toLowerCase().replace(/^1(?:ère|ere|re)\b/,'première').replace(/^2nde\b/,'seconde').replace(/^tle\b/,'terminale').trim();
// Tarif proposé : celui qui cite la classe de l’élève, sinon la première mensualité.
function suggestedTariff(student,tariffs) {
  const cls=normalizeClass(student?.class_name); const monthly=tariffs.filter(t=>t.duration_days>0);
  const match=cls&&monthly.find(t=>t.name.toLowerCase().split(/[·/]/).map(p=>p.trim()).some(p=>p===cls||p.endsWith(' '+cls)));
  return match||monthly[0]||tariffs[0];
}
const studentChip = (s,changeable) => `<div class="selected-student"><span class="avatar">${esc(initials(s.name))}</span><div><strong>${esc(s.name)}</strong><small>${esc(s.class_name)} · ${esc(s.center_name||state.meta.centers.find(c=>c.id===s.center_id)?.name)} · ${esc(s.school_year)}</small></div>${badge(s.validity)}${changeable?button('Changer','payment-change','undo','ghost small-btn'):''}</div>`;
const studentSearch = () => `<label class="field"><span>Rechercher l’élève *</span><input id="payment-search" type="search" placeholder="Nom, classe ou téléphone du parent" autocomplete="off" aria-controls="payment-results" aria-describedby="payment-search-hint"><small id="payment-search-hint">Session ${esc(state.year)} · ${state.center==='all'?'tous les sièges':'siège sélectionné'}. Saisissez au moins 2 caractères.</small></label><div id="payment-results" class="results" role="listbox" aria-label="Élèves trouvés"></div>`;
let paymentResults=[];
// Téléversement : les photos sont réduites dans le navigateur (JPEG) ; 4 Mo maximum par fichier.
const MAX_UPLOAD=4*1024*1024;
async function resizeImage(file,max) {
  const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('Image illisible. Utilisez une photo JPEG ou PNG.');});
  const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height)); const canvas=document.createElement('canvas');
  canvas.width=Math.round(bitmap.width*scale); canvas.height=Math.round(bitmap.height*scale);
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
  return new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.85));
}
async function uploadFile(file,purpose,centerId='') {
  let blob=file,name=file.name||'fichier';
  if(file.type.startsWith('image/')){blob=await resizeImage(file,purpose==='photo'?700:1800);name=name.replace(/\.[^.]+$/,'')+'.jpg';}
  if(blob.size>MAX_UPLOAD) throw new Error(`Fichier trop volumineux (${fileSize(blob.size)}) : 4 Mo maximum. Compressez le PDF ou prenez une photo plus légère.`);
  const params=new URLSearchParams({purpose,name}); if(centerId) params.set('center_id',centerId);
  const response=await fetch(`/api/files?${params}`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/octet-stream','X-CSRF-Token':state.csrf},body:blob});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error||'Envoi du fichier impossible.');
  return data;
}
const fileField = (label,purpose,target,accept,hint) => `<div class="field"><span>${label}</span><label class="file-drop"><input type="file" accept="${accept}" data-upload="${purpose}" data-target="${target}">${icon(purpose==='exam'?'file':'camera')}<span class="file-status">${hint}</span></label><input type="hidden" name="${target}" value=""></div>`;
const attachmentFields = () => `${fileField('Justificatif (photo ou PDF)','justificatif','attachment_id','application/pdf,image/jpeg,image/png,image/webp','Joindre une photo du reçu, de la facture… ou un PDF')}<label class="form-check"><input type="checkbox" name="missing_doc">Pièce justificative manquante — à signaler au promoteur</label>`;
// Reprise : date réelle (comprise entre le début de la reprise et aujourd’hui) et numéro de la pièce papier.
const repriseFields = (receiptLabel='N° du reçu / de la pièce papier') => state.reprise?`<div class="reprise-box"><input type="hidden" name="reprise" value="true"><p class="reprise-title">${icon('clock')}Reprise d’une opération passée · date de saisie enregistrée automatiquement</p><div class="form-grid">${field('Date réelle de l’opération *','operation_date','','date',`required min="${esc(state.meta.reprise_start)}" max="${esc(state.meta.today)}"`)}${field(receiptLabel,'receipt_ref','','text','maxlength="60" placeholder="Ex. 0123"')}</div></div>`:'';
const defaultCenter = () => state.center==='all'?state.meta.centers[0]?.id:state.center;
function paymentForm(student=null) {
  const tariffs=state.meta.tariffs.filter(t=>t.active);
  if(!tariffs.length){toast('Aucun tarif actif. Le manager doit en créer un dans Paramètres.',true);return;}
  state.paymentStudent=student; state.due=null; const suggested=suggestedTariff(student,tariffs);
  showModal(state.reprise?'Reprendre un paiement':'Enregistrer un paiement',`<form id="payment-form"><div class="form-error" role="alert"></div><input type="hidden" name="request_key" value="${crypto.randomUUID()}"><input type="hidden" name="student_id" id="payment-student" value="${student?.id||''}">${repriseFields('N° du reçu papier')}<div id="payment-who">${student?studentChip(student,false):studentSearch()}</div><fieldset class="field"><legend>Motif / tarif *</legend><div class="choice-grid">${tariffs.map(t=>`<label class="choice"><input type="radio" name="tariff_id" value="${t.id}" ${t===suggested?'checked':''}><span class="choice-body"><strong>${esc(t.name)}</strong><span class="choice-amount">${money(t.amount)} FCFA</span><small>${t.duration_days?`Par mois · + ${t.duration_days} jours de validité`:'Frais unique, sans prolongation'}</small></span></label>`).join('')}</div></fieldset><div class="form-grid"><label class="field" id="payment-period-field"><span>Période concernée *</span><input type="month" name="period" id="payment-period"><small>Mois couvert par ce paiement (arriéré ou avance possibles).</small></label>${field('Montant payé en FCFA *','amount','','number','required min="1" step="1" id="payment-amount"')}</div><fieldset class="field"><legend>Mode de règlement *</legend><div class="segmented">${Object.entries(methods).map(([value,label],i)=>`<label><input type="radio" name="method" value="${value}" ${i?'':'checked'}><span>${label}</span></label>`).join('')}</div></fieldset><div class="payment-summary" id="payment-summary" aria-live="polite"></div>${state.reprise?attachmentFields():''}<p class="form-note">${state.reprise?'Le paiement garde sa date réelle ; la date de saisie est enregistrée séparément.':'Le règlement est daté d’aujourd’hui.'} Un paiement partiel est accepté : le reste à payer figure sur le reçu, et la validité n’est prolongée qu’une fois le mois soldé.</p><div class="modal-actions">${button('Annuler','close','close','secondary')}<button class="btn" type="submit" id="payment-submit">${icon('check')}<span>Confirmer le paiement</span></button></div></form>`);
  updatePaymentSummary(true);
  if(!student) $('#payment-search')?.focus();
}
function pickPaymentStudent(student) {
  if(!student) return;
  state.paymentStudent=student;
  $('#payment-student').value=student.id;
  $('#payment-who').innerHTML=studentChip(student,true);
  const tariff=suggestedTariff(student,state.meta.tariffs.filter(t=>t.active));
  const radio=$(`#payment-form input[name="tariff_id"][value="${tariff.id}"]`); if(radio) radio.checked=true;
  updatePaymentSummary(true);
}
let dueSequence=0;
// Interroge le serveur pour le reste dû (tarif + mois), puis propose ce montant.
async function updatePaymentSummary(resetPeriod=false) {
  const form=$('#payment-form'); if(!form) return;
  const tariff=state.meta.tariffs.find(t=>String(t.id)===$('input[name="tariff_id"]:checked',form)?.value);
  const periodField=$('#payment-period-field'),periodInput=$('#payment-period');
  periodField.hidden=!tariff?.duration_days; periodInput.required=Boolean(tariff?.duration_days);
  state.due=null;
  if(!tariff||!state.paymentStudent){renderPaymentSummary();return;}
  const sequence=++dueSequence; const params=new URLSearchParams({tariff_id:tariff.id});
  if(tariff.duration_days&&periodInput.value&&!resetPeriod) params.set('period',periodInput.value);
  const opDate=$('[name="operation_date"]',form)?.value; if(opDate) params.set('date',opDate);
  try {
    const due=await api(`/students/${state.paymentStudent.id}/due?${params}`); if(sequence!==dueSequence||!$('#payment-form')) return;
    state.due=due; if(due.period) periodInput.value=due.period;
    const amount=$('#payment-amount'); amount.max=Math.max(1,due.remaining); amount.value=due.remaining||'';
  } catch(error){toast(error.message,true);}
  renderPaymentSummary();
}
function renderPaymentSummary() {
  const box=$('#payment-summary'); if(!box) return; const label=$('#payment-submit span');
  const tariff=state.meta.tariffs.find(t=>String(t.id)===$('#payment-form input[name="tariff_id"]:checked')?.value);
  const student=state.paymentStudent,due=state.due,amount=Number($('#payment-amount')?.value)||0;
  if(!tariff){box.innerHTML='<p>Choisissez un tarif.</p>';return;}
  if(!student||!due){box.innerHTML=`<span class="summary-amount">${money(tariff.amount)} <span class="small">FCFA</span></span><p>${student?'Calcul du reste dû…':'Choisissez l’élève pour connaître le reste à payer.'}</p>`;if(label)label.textContent='Confirmer le paiement';return;}
  const what=due.period?capital(monthLabel(due.period)):'ces frais';
  if(due.remaining<=0){box.innerHTML=`<p><strong>${esc(tariff.name)} : ${esc(what)} est déjà soldé.</strong> Choisissez un autre mois${due.period?'':' ou un autre tarif'}.</p>`;if(label)label.textContent='Déjà soldé';return;}
  const after=due.remaining-amount; let detail='';
  if(tariff.duration_days&&amount>=due.remaining){const end=student.valid_until?String(student.valid_until).slice(0,10):'';const from=end>state.meta.today?end:state.meta.today;detail=`<br>Validité prolongée jusqu’au <strong>${date(addDaysLocal(from,tariff.duration_days))}</strong>.`;}
  else if(tariff.duration_days&&amount>0) detail='<br>Paiement partiel : la validité sera prolongée quand ce mois sera soldé.';
  box.innerHTML=`<span class="summary-amount">${money(amount)} <span class="small">FCFA</span></span><p>${esc(what)} · dû ${money(due.due)} · déjà payé ${money(due.paid)}<br>${amount>due.remaining?`<strong class="text-danger">Le montant dépasse le reste à payer (${money(due.remaining)} FCFA).</strong>`:`Reste à payer après ce paiement : <strong>${money(Math.max(0,after))} FCFA</strong>`}${detail}</p>`;
  if(label) label.textContent=amount?`Encaisser ${money(amount)} FCFA`:'Confirmer le paiement';
}
function movementForm(kind) {
  const names={expense:'Enregistrer une dépense',income:'Enregistrer une recette',opening:'Enregistrer un solde initial'};
  showModal(state.reprise?names[kind].replace('Enregistrer','Reprendre'):names[kind],`<form id="movement-form"><div class="form-error" role="alert"></div><input type="hidden" name="request_key" value="${crypto.randomUUID()}"><input type="hidden" name="kind" value="${kind}">${repriseFields()}${selectField('Siège *','center_id',options(state.meta.centers,defaultCenter()),'required')}<div class="form-grid">${field('Montant en FCFA *','amount','','number',`required min="1" max="100000000" step="1" placeholder="Ex. 5 000"`)}${selectField('Mode de règlement *','method',methodOptions,'required')}</div><div class="form-grid">${field('Catégorie *','category',kind==='opening'?'Solde initial':'','text','required maxlength="100" list="category-list" placeholder="Ex. Fournitures, loyer…"')}${kind==='opening'?'':field(kind==='expense'?'Bénéficiaire':'Payeur','beneficiary','','text','maxlength="140" placeholder="Nom de la personne ou du fournisseur"')}</div><datalist id="category-list">${['Fournitures','Loyer','Transport','Électricité / eau','Communication','Entretien','Impression / photocopies','Collation','Divers'].map(c=>`<option value="${c}">`).join('')}</datalist><label class="field"><span>Motif *</span><textarea name="description" required minlength="3" maxlength="300" placeholder="${kind==='opening'?'Origine du solde : comptage des espèces au …, remis par …':'Précisez le motif de l’opération'}"></textarea></label>${kind==='opening'?'':attachmentFields()}<p class="form-note">${kind==='expense'?'Cette opération diminue le solde du siège. Pour un salaire ou une avance d’enseignant, utilisez « Enseignants & paie ». Pour une remise d’argent au promoteur ou à une autre caisse, utilisez « Transfert / reversement » : ce n’est pas une dépense.':kind==='opening'?'Saisissez l’argent réellement détenu à l’ouverture retenue et documentez son origine. Zéro seulement si la caisse était vide. Un seul solde initial actif par siège.':'Pour les frais d’un élève, utilisez le formulaire de paiement afin de mettre à jour sa validité.'}</p>${actions('Enregistrer l’opération')}</form>`);
  if(kind==='opening'&&state.reprise){const d=$('#movement-form [name="operation_date"]');if(d)d.value=state.meta.reprise_start;}
}
function transferForm() {
  const all=state.meta.transfer_centers||state.meta.centers; const from=defaultCenter();
  showModal(state.reprise?'Reprendre un transfert ou reversement':'Transfert ou reversement',`<p class="modal-subtitle">Mouvement de trésorerie : l’argent quitte une caisse sans être une dépense de fonctionnement.</p><form id="transfer-form"><div class="form-error" role="alert"></div><input type="hidden" name="request_key" value="${crypto.randomUUID()}">${repriseFields()}<fieldset class="field"><legend>Type de mouvement *</legend><div class="segmented"><label><input type="radio" name="kind" value="remittance" checked><span>Reversement au promoteur</span></label><label><input type="radio" name="kind" value="transfer"><span>Transfert vers une autre caisse</span></label></div></fieldset><div class="form-grid">${selectField('Caisse qui donne *','center_id',options(state.meta.centers,from),'required')}<label class="field transfer-to" hidden><span>Caisse qui reçoit *</span><select name="to_center_id" aria-label="Caisse qui reçoit"><option value="">Choisir…</option>${all.filter(c=>String(c.id)!==String(from)).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>${field('Montant en FCFA *','amount','','number','required min="1" max="100000000" step="1"')}${selectField('Mode *','method',methodOptions,'required')}${field('Remis à','beneficiary','','text','maxlength="140" placeholder="Nom de la personne qui reçoit l’argent"',true)}</div><label class="field"><span>Motif *</span><textarea name="description" required minlength="3" maxlength="300" placeholder="Ex. Remise de la recette de la semaine"></textarea></label>${attachmentFields()}<p class="form-note">Un transfert crée deux écritures liées : une sortie dans la caisse qui donne, une entrée dans la caisse qui reçoit. Son annulation (manager) corrige les deux.</p>${actions('Enregistrer le mouvement')}</form>`);
}
function countForm() {
  showModal('Comptage physique de la caisse',`<p class="modal-subtitle">Comptez l’argent réellement présent. Le système le compare au solde théorique à la même date.</p><form id="count-form"><div class="form-error" role="alert"></div>${selectField('Siège *','center_id',options(state.meta.centers,defaultCenter()),'required')}<div class="form-grid">${field('Date du comptage *','count_date',state.meta.today,'date',`required max="${esc(state.meta.today)}"`)}${field('Espèces comptées (FCFA) *','cash_amount','','number','required min="0" step="1"')}${field('Mobile Money / banque (FCFA)','other_amount','0','number','min="0" step="1"',true)}</div><label class="field"><span>Observations</span><textarea name="notes" maxlength="500" placeholder="Ex. Comptage fait en présence de …, billets et pièces"></textarea></label><p class="form-note">Le solde théorique inclut tous les modes de règlement : indiquez aussi l’argent détenu sur Mobile Money ou en banque pour ce siège.</p>${actions('Enregistrer le comptage')}</form>`);
}
function centerForm(center=null) {
  const c=center||{};
  showModal(center?'Modifier le siège':'Ajouter un siège',`<form id="center-form" data-id="${c.id||''}"><div class="form-error" role="alert"></div>${field('Nom du siège *','name',c.name,'text','required maxlength="100" placeholder="Ex. Biyem-Assi"')}${field('Adresse / repère *','address',c.address,'text','required maxlength="240" placeholder="Quartier, établissement, repère"')}${field('Téléphone','phone',c.phone,'tel','maxlength="30" placeholder="+237 6XX XX XX XX"')}${actions()}</form>`);
}
function userForm(user=null) {
  const u=user||{};
  showModal(user?'Modifier l’accès secrétaire':'Créer un accès secrétaire',`<form id="user-form" data-id="${u.id||''}"><div class="form-error" role="alert"></div>${field('Nom complet *','name',u.name,'text','required maxlength="120"')}${field('Adresse e-mail *','email',u.email,'email','required autocomplete="off" maxlength="190"')}${selectField('Siège attribué *','center_id',options(state.meta.centers,u.center_id),'required')}${field(user?'Nouveau mot de passe (laisser vide pour conserver)':'Mot de passe initial *','password','','password',`${user?'':'required'} minlength="12" maxlength="72" autocomplete="new-password" placeholder="Au moins 12 caractères"`)}${user?`<label class="form-check"><input type="checkbox" name="active" ${u.active?'checked':''}>Compte actif</label>`:''}<p class="form-note">${user?'Toute modification déconnecte les sessions de ce compte.':'Transmettez les identifiants personnellement à la secrétaire.'} L’accès est limité au siège attribué, y compris côté serveur.</p>${actions(user?'Enregistrer':'Créer le compte')}</form>`);
}
function tariffForm(tariff=null) {
  const t=tariff||{active:true,duration_days:30};
  showModal(tariff?'Modifier le tarif':'Ajouter un tarif',`<form id="tariff-form" data-id="${t.id||''}"><div class="form-error" role="alert"></div>${field('Libellé *','name',t.name,'text','required maxlength="100" placeholder="Ex. Répétition · Terminale A"')}<div class="form-grid">${field('Montant en FCFA *','amount',t.amount,'number','required min="1" max="10000000" step="1"')}${field('Durée en jours *','duration_days',t.duration_days,'number','required min="0" max="366" step="1"')}</div><label class="form-check"><input type="checkbox" name="active" ${t.active?'checked':''}>Tarif disponible pour les paiements</label><p class="form-note">Une durée de 0 jour correspond à des frais sans prolongation, par exemple l’inscription. Les anciens paiements conservent leurs montants et durées.</p>${actions()}</form>`);
}
const grades=['Professeur des lycées (PLEG)','Professeur des collèges (PCEG)','Professeur vacataire','Licencié','Master','Doctorant','Étudiant'];
function teacherForm(teacher=null) {
  const t=teacher||{pay_type:'hourly',active:true,hired_on:state.meta.today,subject_ids:[]};
  const chosen=new Set(t.subject_ids||[]);
  const subjects=state.meta.subjects.filter(x=>x.active||chosen.has(x.id));
  const photo=t.photo_file_id?`/api/files/${Number(t.photo_file_id)}`:'';
  showModal(teacher?'Modifier le dossier enseignant':'Nouveau dossier enseignant',`<p class="modal-subtitle">Dossier créé par le directeur ou le manager. La photographie, le matricule et au moins une matière sont obligatoires.</p><form id="teacher-form" data-id="${t.id||''}"><div class="form-error" role="alert"></div>
  <div class="photo-pick"><img id="teacher-photo-preview" class="photo-preview" src="${photo}" alt="Photographie de l’enseignant" ${photo?'':'hidden'}><span class="photo-placeholder" ${photo?'hidden':''}>${icon('camera')}</span><div class="field"><span>Photographie *</span><label class="file-drop"><input type="file" accept="image/jpeg,image/png,image/webp" data-upload="photo" data-target="photo_file_id">${icon('camera')}<span class="file-status">${photo?'Photo enregistrée — choisir pour la remplacer':'Choisir une photo (portrait, visage visible)'}</span></label><input type="hidden" name="photo_file_id" value=""></div></div>
  <div class="form-grid">${field('Matricule *','matricule',t.matricule,'text','required maxlength="30" placeholder="Ex. ENS-2026-001"')}${field('Téléphone *','phone',t.phone,'tel','required maxlength="30" placeholder="+237 6XX XX XX XX"')}${field('Nom *','last_name',t.last_name,'text','required maxlength="80" placeholder="Ex. Essomba"')}${field('Prénom *','first_name',t.first_name,'text','required maxlength="80" placeholder="Ex. Paul"')}<label class="field"><span>Grade</span><input name="grade" list="grade-list" value="${esc(t.grade)}" maxlength="80" placeholder="Ex. PLEG"><datalist id="grade-list">${grades.map(g=>`<option value="${esc(g)}">`).join('')}</datalist></label>${field('Adresse e-mail','email',t.email,'email','maxlength="190" placeholder="enseignant@exemple.cm"')}${field('Adresse','address',t.address,'text','maxlength="240" placeholder="Quartier, ville"',true)}</div>
  <fieldset class="field"><legend>Matières enseignées * <small class="muted">(une ou plusieurs)</small></legend><div class="check-grid">${subjects.map(x=>`<label class="check-chip"><input type="checkbox" name="subject_ids" value="${x.id}" ${chosen.has(x.id)?'checked':''}><span>${esc(x.name)}</span></label>`).join('')||'<p class="form-note">Aucune matière définie : ajoutez-en dans Paramètres.</p>'}</div></fieldset>
  <div class="form-grid">${field('Date d’entrée *','hired_on',String(t.hired_on||'').slice(0,10),'date','required')}${selectField('Mode de paie *','pay_type',`<option value="hourly" ${t.pay_type==='hourly'?'selected':''}>À l’heure (taux propre)</option><option value="monthly" ${t.pay_type==='monthly'?'selected':''}>Salaire mensuel fixe</option>`,'required id="teacher-pay-type"')}<label class="field wide pay-hourly" ${t.pay_type==='monthly'?'hidden':''}><span>Taux horaire en FCFA *</span><input type="number" name="hourly_rate" value="${esc(t.hourly_rate||'')}" min="1" max="1000000" step="1" placeholder="Ex. 2 000" ${t.pay_type==='monthly'?'':'required'}></label><label class="field wide pay-monthly" ${t.pay_type==='monthly'?'':'hidden'}><span>Salaire mensuel en FCFA *</span><input type="number" name="monthly_salary" value="${esc(t.monthly_salary||'')}" min="1" max="50000000" step="1" placeholder="Ex. 80 000" ${t.pay_type==='monthly'?'required':''}></label><label class="field wide"><span>Notes</span><textarea name="notes" maxlength="1000" placeholder="Disponibilités, sièges habituels…">${esc(t.notes)}</textarea></label></div>${teacher?`<label class="form-check"><input type="checkbox" name="active" ${t.active?'checked':''}>Enseignant actif</label>`:''}<p class="form-note">Les matières peuvent être modifiées ou complétées à tout moment. Un changement de taux ne modifie pas les séances déjà saisies.${teacher?' Avant de désactiver un enseignant, soldez ses mois en cours.':''}</p>${actions(teacher?'Enregistrer':'Créer le dossier')}</form>`,true);
}
function subjectForm(subject=null) {
  const x=subject||{active:true};
  showModal(subject?'Modifier la matière':'Ajouter une matière',`<form id="subject-form" data-id="${x.id||''}"><div class="form-error" role="alert"></div>${field('Nom de la matière *','name',x.name,'text','required maxlength="100" placeholder="Ex. Mathématiques"')}<label class="form-check"><input type="checkbox" name="active" ${x.active?'checked':''}>Matière proposée dans les formulaires</label><p class="form-note">Une matière désactivée reste attachée aux dossiers et sujets existants.</p>${actions()}</form>`);
}
function togglePayType(form) {
  const monthly=$('#teacher-pay-type',form).value==='monthly';
  $('.pay-hourly',form).hidden=monthly;$('.pay-monthly',form).hidden=!monthly;
  $('[name="hourly_rate"]',form).required=!monthly;$('[name="monthly_salary"]',form).required=monthly;
}
async function sessionForm(teacherId='') {
  const teachers=(await api(`/teachers?period=${state.meta.today.slice(0,7)}`)).items.filter(t=>t.active);
  if(!teachers.length){toast('Aucun enseignant actif. Le manager doit d’abord créer une fiche.',true);return;}
  showModal('Saisir une séance',`<p class="modal-subtitle">Chaque séance enregistrée compte dans la paie du mois des enseignants payés à l’heure.</p><form id="session-form"><div class="form-error" role="alert"></div><input type="hidden" name="request_key" value="${crypto.randomUUID()}">${selectField('Enseignant *','teacher_id',teachers.map(t=>`<option value="${t.id}" ${String(t.id)===String(teacherId)?'selected':''}>${esc(t.name)} · ${esc(payRule(t))}</option>`).join(''),'required')}<div class="form-grid">${selectField('Siège *','center_id',options(state.meta.centers,state.center==='all'?state.meta.centers[0]?.id:state.center),'required')}${field('Date de la séance *','session_date',state.meta.today,'date',`required max="${esc(state.meta.today)}"`)}${field('Durée en heures *','hours','2','number','required min="0.25" max="12" step="0.25"')}${field('Matière','subject','','text','maxlength="100" placeholder="Ex. Mathématiques"')}${field('Classe / groupe','class_name','','text','maxlength="100" placeholder="Ex. Terminale A · soir"',true)}</div><p class="form-note">Saisissez 1,5 pour 1 h 30. Le montant est calculé avec le taux horaire actuel de l’enseignant puis figé.</p>${actions('Enregistrer la séance')}</form>`);
}
async function teacherPayForm(teacherId,kind='salary') {
  const t=await api(`/teachers/${teacherId}?period=${state.period||state.meta.today.slice(0,7)}`); const s=t.summary;
  showModal(`Payer ${esc(t.name)}`,`<form id="teacher-pay-form" data-id="${t.id}" data-remaining="${s.remaining}"><div class="form-error" role="alert"></div><input type="hidden" name="request_key" value="${crypto.randomUUID()}"><input type="hidden" name="period" value="${esc(s.period)}">${repriseFields()}<div class="payment-summary"><strong>${money(Math.max(0,s.remaining))} <span class="small">FCFA restants</span></strong><p>${esc(monthLabel(s.period))} · ${esc(payRule(t,s))}<br>Dû ${money(s.gross)} − avances ${money(s.advances)} − versé ${money(s.paid)}</p></div><div class="form-grid">${selectField('Type de versement *','kind',`<option value="salary" ${kind==='salary'?'selected':''}>Salaire du mois</option><option value="advance" ${kind==='advance'?'selected':''}>Avance sur salaire</option>`,'required id="teacher-pay-kind"')}${field('Montant en FCFA *','amount',kind==='salary'&&s.remaining>0?s.remaining:'','number','required min="1" max="50000000" step="1"')}${selectField('Payé depuis la caisse de *','center_id',options(state.meta.centers,state.center==='all'?state.meta.centers[0]?.id:state.center),'required')}${selectField('Mode de règlement *','method',methodOptions,'required')}</div>${field('Précision','description','','text','maxlength="200" placeholder="Facultatif"')}<p class="form-note">Le montant sort de la caisse du siège choisi. Un salaire ne peut pas dépasser le reste à payer ; une avance est déduite du salaire de ${esc(monthLabel(s.period))}.</p>${actions('Enregistrer le versement')}</form>`);
}
async function teacherView(teacherId) {
  const t=await api(`/teachers/${teacherId}?period=${state.period||state.meta.today.slice(0,7)}`); const s=t.summary;
  showModal('Dossier enseignant',`<div class="detail-header">${avatarHtml(t.name,t.photo_file_id,'large')}<div><h3>${esc(t.name)}</h3><p class="muted small">${esc(t.matricule||'Matricule à renseigner')} · ${esc(t.grade||'Grade non précisé')} · ${t.active?'Actif':'Désactivé'}</p>${isManager()?button('Modifier le dossier','teacher-edit','edit','secondary small-btn',`data-id="${t.id}"`):''}</div></div><dl class="detail-grid"><div><dt>Matières</dt><dd>${esc(t.subjects||'Non précisées')}</dd></div><div><dt>Mode de paie actuel</dt><dd>${esc(payRule(t))}</dd></div><div><dt>Téléphone</dt><dd>${esc(t.phone||'Non renseigné')}</dd></div><div><dt>E-mail</dt><dd>${esc(t.email||'Non renseigné')}</dd></div><div><dt>Adresse</dt><dd>${esc(t.address||'Non renseignée')}</dd></div><div><dt>En poste depuis</dt><dd>${date(t.hired_on)}</dd></div><div><dt>Barème de ${esc(monthLabel(s.period))}</dt><dd>${esc(payRule(t,s))}${s.frozen?' · figé':''}</dd></div></dl>${t.notes?`<p class="form-note">${esc(t.notes)}</p>`:''}<div class="pay-grid"><div class="due"><span>Dû · ${esc(monthLabel(s.period))}</span><strong>${money(s.gross)}</strong></div><div><span>Avances</span><strong>${money(s.advances)}</strong></div><div><span>Versé</span><strong>${money(s.paid)}</strong></div><div><span>Reste</span><strong>${money(s.remaining)}</strong> ${payBadge(s)}</div></div><div class="panel-header"><h2>Séances du mois${isManager()?'':' · votre siège'}</h2>${t.active?button('Séance','session-new','plus','small-btn secondary',`data-id="${t.id}"`):''}</div>${t.sessions.length?`<div class="table-wrap"><table><thead><tr><th>Date</th><th>Durée</th><th>Matière / classe</th><th>Montant</th><th></th></tr></thead><tbody>${t.sessions.map(x=>`<tr class="${x.cancelled_at?'cancelled':''}"><td>${date(x.session_date)}<small>${esc(x.center_name)}</small></td><td>${duration(x.minutes)}</td><td>${esc(x.subject||'—')}<small>${esc(x.class_name)}</small></td><td>${x.rate?`${money(x.amount)} FCFA<small>${money(x.rate)} FCFA / h</small>`:'<span class="muted">Salaire fixe</span>'}</td><td>${x.cancelled_at?`<span class="badge expired" title="${esc(x.cancel_reason)}">Annulée</span>`:`<button class="icon-btn" data-action="session-cancel" data-id="${x.id}" aria-label="Annuler la séance du ${date(x.session_date)}" title="Annuler la séance">${icon('undo')}</button>`}</td></tr>`).join('')}</tbody></table></div>`:empty('Aucune séance ce mois-ci','Les séances saisies apparaîtront ici.','','','clock',true)}<div class="panel-header"><h2>Avances et salaires · ${esc(monthLabel(s.period))}</h2>${button('Payer','teacher-pay','wallet','small-btn',`data-id="${t.id}"`)}</div>${t.movements.length?ledgerTable(t.movements):empty('Aucun versement ce mois-ci','Les avances et salaires versés apparaîtront ici.','','','wallet',true)}`,true);
}
function sessionCancelForm(sessionId) {
  showModal('Annuler une séance',`<form id="session-cancel-form" data-id="${esc(sessionId)}"><div class="form-error" role="alert"></div><label class="field"><span>Motif de l’annulation *</span><textarea name="reason" required minlength="5" maxlength="250" placeholder="Ex. Séance non tenue, saisie en double"></textarea></label><p class="form-note">La séance reste visible, barrée, et n’est plus comptée dans la paie du mois. Si le salaire est déjà versé, le trop-perçu apparaîtra dans le reste à payer.</p>${actions('Confirmer l’annulation')}</form>`);
}
function accountForm() {
  showModal('Mon compte',`<p class="modal-subtitle"><strong>${esc(state.user.name)}</strong><br>${esc(state.user.email)} · ${isManager()?'Manager du réseau':'Secrétaire'}</p><form id="password-form"><div class="form-error" role="alert"></div>${passwordField('Mot de passe actuel','current_password')}${passwordField('Nouveau mot de passe','password','minlength="12" autocomplete="new-password" placeholder="Au moins 12 caractères"')}<p class="form-note">Vous serez déconnecté sur tous vos appareils après ce changement.</p>${actions('Changer mon mot de passe')}</form>`);
}
async function reverseForm(entryId) {
  const entry=await api(`/ledger/${entryId}`);
  showModal('Annuler cette opération',`<p class="modal-subtitle">${esc(entry.reference)}<br><strong>${esc(entry.description)} · ${money(Math.abs(entry.amount))} FCFA</strong></p><form id="reverse-form" data-id="${entry.id}"><div class="form-error" role="alert"></div><input type="hidden" name="request_key" value="${crypto.randomUUID()}"><label class="field"><span>Motif de l’annulation *</span><textarea name="reason" required minlength="5" maxlength="250" placeholder="Expliquez l’erreur à corriger"></textarea></label><p class="form-note">L’original restera dans l’historique. Une contre-écriture de ${money(-entry.amount)} FCFA sera créée${entry.student_id?' et la validité de l’élève sera recalculée':''}.</p>${actions('Confirmer l’annulation')}</form>`);
}
// Reçu au format A5 (148 × 210 mm, moitié d’un A4), sur le modèle remis par l’établissement.
const receiptTitles = {payment:'Reçu de paiement',income:'Reçu de recette',expense:'Bon de dépense',opening:'Solde initial',reversal:'Annulation',salary:'Bon de salaire',advance:'Bon d’avance',transfer:'Bon de transfert',remittance:'Bon de reversement'};
const frDay = v => v?String(v).slice(0,10).split('-').reverse().join('/'):'—';
function receiptHtml(l) {
  const payment=l.kind==='payment';
  const period=l.period?capital(monthLabel(l.period)):payment&&!l.duration_days?`Session ${l.student_school_year||''}`:'';
  const who=l.student_name||l.teacher_name||l.beneficiary||'';
  const info=[
    payment?['Nom et prénom de l’élève',l.student_name]:l.teacher_name?['Enseignant',l.teacher_name]:who?[l.amount>0?'Reçu de':'Remis à',who]:null,
    l.class_name&&payment?['Classe',l.class_name]:null,
    ['Motif',payment?l.category:l.kind==='reversal'?`Annulation — ${l.description}`:l.description],
    ['Siège',l.kind==='transfer'&&l.link_center_name?`${l.center_name} ${l.amount<0?'→':'←'} ${l.link_center_name}`:l.center_name],
    l.receipt_ref?['Pièce papier n°',l.receipt_ref]:null,
  ].filter(Boolean);
  const lines=[[payment?'Montant payé':l.amount>0?'Montant reçu':'Montant sorti',`${money(Math.abs(l.amount))} FCFA`],['Mode de paiement',methods[l.method]]];
  if(payment&&l.balance_after!==null&&l.balance_after!==undefined) lines.push(['Reste à payer',`${money(l.balance_after)} FCFA`]);
  const status=l.reversed_by?['void','Opération annulée — conservée pour l’historique']:payment?(l.balance_after===0?['ok','Paiement effectué en totalité.']:l.balance_after>0?['partial',`Paiement partiel — reste ${money(l.balance_after)} FCFA`]:['ok','Paiement enregistré.']):null;
  return `<article class="receipt"><header class="rc-head"><img class="rc-logo" src="/assets/logo-ruisseau.png" alt=""><div><div class="rc-name">Le Ruisseau du Succès</div><div class="rc-motto">Instruire • Former • Réussir</div></div></header><div class="rc-title">${esc(receiptTitles[l.kind]||'Justificatif')}</div><div class="rc-meta"><span><b>N° :</b> ${esc(l.receipt_number||l.reference)}</span><span><b>Date :</b> ${frDay(l.operation_date)}</span></div><dl class="rc-info">${info.map(([k,v])=>`<div><dt>${esc(k)} :</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${period?`<div class="rc-period"><small>${l.kind==='payment'?'Période concernée par le paiement':'Mois de paie'}</small><strong>${esc(period)}</strong></div>`:''}<div class="rc-lines">${lines.map(([k,v])=>`<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div>${status?`<div class="rc-status ${status[0]}">${status[0]==='ok'?'✓ ':''}${esc(status[1])}</div>`:''}<div class="rc-sign"><div><small>Signature du caissier</small><span>${esc(l.author_name)}</span></div><div><small>Cachet de l’établissement</small></div></div>${l.source==='reprise'?`<p class="rc-note">Opération du ${frDay(l.operation_date)} saisie le ${frDay(l.created_at)} (reprise).</p>`:''}<footer class="rc-foot"><span>+237 652 25 11 44 | +237 695 62 54 87</span><em>Ensemble pour la réussite de nos enfants</em></footer></article>`;
}
async function receiptView(entryId) {
  const entry=await api(`/ledger/${entryId}`);
  const html=receiptHtml(entry);$('#print-area').innerHTML=html;
  const canReverse=isManager()&&!entry.reversed_by&&entry.kind!=='reversal';
  const attachment=entry.attachment_file_id?`<p class="attachment-line">${icon('file')}Justificatif : <a href="/api/files/${Number(entry.attachment_file_id)}" target="_blank" rel="noopener">${esc(entry.attachment_name||'ouvrir')}</a></p>`:entry.kind!=='reversal'?`<form id="attach-form" data-id="${entry.id}" class="attachment-line">${entry.missing_doc?'<span class="badge urgent">Pièce manquante</span>':''}${fileField('Joindre un justificatif','justificatif','attachment_id','application/pdf,image/jpeg,image/png,image/webp','Photo ou PDF de la pièce')}<button class="btn secondary small-btn" type="submit">${icon('check')}Joindre</button></form>`:'';
  showModal('Justificatif d’opération',`<div class="receipt-preview">${html}</div>${attachment}<div class="modal-actions">${canReverse?button('Annuler l’opération','reverse','undo','danger push-left',`data-id="${entry.id}"`):''}${button('Fermer','close','close','secondary')}${button('Imprimer (A5)','print','print')}</div>`,true);
}

// Banque numérique d’épreuves.
const examClasses=['6e','5e','4e','3e','2nde A','2nde C','1ère A','1ère C','1ère D','Terminale A','Terminale C','Terminale D'];
const examSequences=['Séquence 1','Séquence 2','Séquence 3','Séquence 4','Séquence 5','Séquence 6','Trimestre 1','Trimestre 2','Trimestre 3','Examen blanc','BEPC blanc','Probatoire blanc','Baccalauréat blanc'];
function examsPage(data) {
  const e=state.exam; const filtered=state.q||e.subject_id||e.class_name||e.sequence||e.school_year;
  const classes=[...new Set([...examClasses,...data.classes])],sequences=[...new Set([...examSequences,...data.sequences])];
  const filter=(id,label,opts,value)=>`<select id="${id}" aria-label="${label}"><option value="">${label}</option>${opts.map(o=>Array.isArray(o)?`<option value="${esc(o[0])}" ${String(o[0])===String(value)?'selected':''}>${esc(o[1])}</option>`:`<option ${o===value?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
  return pageHead('Banque d’épreuves','Sujets d’examen en PDF transmis par les enseignants, classés par matière, classe et séquence. Consultez, téléchargez ou imprimez.',button('Déposer un sujet','exam-new','plus'),`Banque centralisée · ${money(data.total)} sujet${data.total>1?'s':''}`)+
  `<section class="panel"><div class="toolbar">${searchInput('Rechercher un titre, une référence, un enseignant…')}${filter('exam-subject','Toutes les matières',state.meta.subjects.map(s=>[s.id,s.name]),e.subject_id)}${filter('exam-class','Toutes les classes',classes,e.class_name)}${filter('exam-sequence','Toutes les séquences',sequences,e.sequence)}${filter('exam-year','Toutes les années',state.meta.years,e.school_year)}${isManager()?chips('exam-archived',e.archived,[['','Banque active'],['1','Archives']]):''}</div>${data.items.length?`<div class="table-wrap"><table><thead><tr><th>Sujet</th><th>Matière</th><th>Classe / séquence</th><th>Dépôt</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${data.items.map(x=>`<tr><td><div class="person-cell"><span class="file-badge">${icon('file')}<b>PDF</b></span><div><strong>${esc(x.title)}</strong><small>${esc(x.reference)} · ${esc(x.school_year)} · ${fileSize(x.file_size)}</small></div></div></td><td>${esc(x.subject_name)}</td><td>${esc(x.class_name)}<small>${esc(x.sequence)}</small></td><td>${date(x.created_at)}<small>${esc(x.uploader_name)}${x.teacher_name?` · transmis par ${esc(x.teacher_name)}`:''}</small></td><td><div class="row-actions"><a class="btn small-btn secondary" href="/api/files/${Number(x.file_id)}" target="_blank" rel="noopener" title="Consulter ou imprimer">${icon('eye')}Ouvrir</a><a class="icon-btn" href="/api/files/${Number(x.file_id)}?download=1" aria-label="Télécharger ${esc(x.title)}" title="Télécharger">${icon('download')}</a>${isManager()?`<button class="icon-btn" data-action="exam-edit" data-id="${x.id}" aria-label="Modifier ${esc(x.title)}" title="Modifier">${icon('edit')}</button><button class="icon-btn" data-action="exam-archive" data-id="${x.id}" data-archived="${x.archived_at?'1':''}" aria-label="${x.archived_at?'Restaurer':'Archiver'} ${esc(x.title)}" title="${x.archived_at?'Restaurer':'Archiver'}">${icon(x.archived_at?'undo':'archive')}</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`:empty(filtered?'Aucun sujet trouvé':'La banque attend ses premiers sujets',filtered?'Modifiez la recherche ou les filtres.':'Déposez le PDF d’un sujet transmis par un enseignant : matière, classe et séquence.',filtered?'':'exam-new','Déposer un sujet','file')}${pagination(data)}</section><p class="footnote">${icon('shield')} <span>Un même fichier PDF ne peut être déposé qu’une fois. Un titre identique pour la même matière, classe et séquence est signalé avant enregistrement. Pour imprimer, ouvrez le sujet puis utilisez l’impression du lecteur PDF.</span></p>`;
}
async function examForm(exam=null) {
  const teachers=(await api('/teachers?all=1')).items;
  const x=exam||{school_year:state.year,class_name:'',sequence:''};
  showModal(exam?'Modifier le sujet':'Déposer un sujet',`<form id="exam-form" data-id="${x.id||''}"><div class="form-error" role="alert"></div>${exam?'':fileField('Fichier PDF du sujet *','exam','file_id','application/pdf','Choisir le PDF (4 Mo maximum)')}${field('Titre du sujet *','title',x.title,'text','required minlength="3" maxlength="200" placeholder="Ex. Composition de mathématiques — séquence 2"')}<div class="form-grid">${selectField('Matière *','subject_id',`<option value="">Choisir…</option>${options(state.meta.subjects.filter(s=>s.active||s.id===x.subject_id),x.subject_id)}`,'required')}<label class="field"><span>Classe *</span><input name="class_name" list="exam-class-list" value="${esc(x.class_name)}" required maxlength="60" placeholder="Ex. 3e"><datalist id="exam-class-list">${examClasses.map(c=>`<option value="${c}">`).join('')}</datalist></label><label class="field"><span>Séquence / période *</span><input name="sequence" list="exam-sequence-list" value="${esc(x.sequence)}" required maxlength="60" placeholder="Ex. Séquence 2"><datalist id="exam-sequence-list">${examSequences.map(c=>`<option value="${c}">`).join('')}</datalist></label>${field('Année scolaire *','school_year',x.school_year,'text','required pattern="20[0-9]{2}-20[0-9]{2}"')}${selectField('Transmis par (enseignant)','teacher_id',`<option value="">Non précisé</option>${options(teachers,x.teacher_id)}`,'',true)}</div><label class="field"><span>Remarques</span><textarea name="notes" maxlength="500" placeholder="Durée, barème, corrigé disponible…">${esc(x.notes)}</textarea></label><p class="form-note">Date de dépôt et déposant sont enregistrés automatiquement. Plusieurs sujets sont possibles pour une même matière, classe et séquence.</p>${actions(exam?'Enregistrer':'Déposer le sujet')}</form>`);
}
// Reprise comptable : saisie des opérations historiques, rapprochement et validation.
const gapBadge = c => c.gap===null?'<span class="badge">Comptage à saisir</span>':c.gap===0?'<span class="badge active">Aucun écart</span>':`<span class="badge urgent">Écart ${c.gap>0?'+':'−'}${money(Math.abs(c.gap))} FCFA</span>`;
const repriseStatus = c => c.validation?`<span class="badge active">Validé le ${date(c.validation.validated_at)}</span>`:'<span class="badge warning">En cours de reprise</span>';
function repriseRows(c) {
  return [['Solde initial réel',c.opening],['+ Encaissements (paiements, recettes)',c.receipts],['− Dépenses (fonctionnement, salaires, avances)',c.expenses],['− Transferts sortants et reversements',c.transfers_out],['+ Transferts reçus d’autres caisses',c.transfers_in]];
}
function repriseCard(c) {
  const step=(cls,label,value)=>`<div class="${cls}"><span>${label}</span><strong>${value}</strong></div>`;
  return `<article class="panel reprise-card ${c.validation?'is-valid':''}"><div class="panel-header"><div><h2><span class="center-marker">${icon('building')}</span>${esc(c.center_name)}</h2><p>${repriseStatus(c)} ${gapBadge(c)}</p></div><div class="row-actions">${button('État PDF','reprise-print','print','secondary small-btn',`data-id="${c.center_id}"`)}${isManager()?c.validation?button('Réouvrir','reprise-reopen','undo','secondary small-btn',`data-id="${c.center_id}"`):button('Valider','reprise-validate','check','small-btn',`data-id="${c.center_id}"`):''}</div></div><div class="panel-body"><div class="reprise-figures">${step('','Élèves (session)',money(c.students.total))}${step('','Inscrits depuis le début',money(c.students.since_start))}${step('','Opérations saisies',money(c.operations.total))}${step(c.operations.missing_docs?'warn':'','Pièces manquantes',money(c.operations.missing_docs))}</div><table class="reprise-table"><tbody>${repriseRows(c).map(([k,v])=>`<tr><td>${k}</td><td class="num">${money(v)} FCFA</td></tr>`).join('')}<tr class="total"><td>= Solde théorique au ${date(c.until)}</td><td class="num">${money(c.theoretical)} FCFA</td></tr><tr><td>Comptage physique${c.count?` du ${date(c.count.count_date)} (${esc(c.count.counted_by_name)})`:''}</td><td class="num">${c.physical===null?'—':money(c.physical)+' FCFA'}</td></tr><tr class="${c.gap?'gap':''}"><td>Écart (physique − théorique)</td><td class="num">${c.gap===null?'—':(c.gap>0?'+':'')+money(c.gap)+' FCFA'}</td></tr></tbody></table>${c.validation?`<p class="form-note">Validé par ${esc(c.validation.validated_by_name)} le ${date(c.validation.validated_at)} à ${esc(String(c.validation.validated_at).slice(11,16))} UTC.${c.validation.explanation?` Explication : ${esc(c.validation.explanation)}`:''}</p>`:''}</div></article>`;
}
function reprisePage(data) {
  const start=date(data.reprise_start); const r=attrs=>`data-reprise="1" ${attrs||''}`;
  const steps=[
    ['Vérifier les paramètres','Siège, classes et groupes, matières, tarifs et période de reprise.',isManager()?'<a class="btn secondary small-btn" href="#settings">Paramètres</a>'+button('Solde initial','opening-new','wallet','secondary small-btn',r()):'<a class="btn secondary small-btn" href="#students">Voir les élèves</a>'],
    ['Créer les fiches élèves sans doublons','Une fiche du même nom dans le siège et la session est signalée.',button('Fiche élève','student-new','people','secondary small-btn',r())],
    ['Inscriptions à leur date réelle','La date réelle d’inscription est demandée sur la fiche. Les frais d’inscription se saisissent ensuite comme un paiement.',''],
    ['Paiements','Montant, date réelle, motif, période couverte et n° de reçu papier. Paiements partiels et arriérés acceptés.',button('Paiement','payment-new','receipt','secondary small-btn',r())],
    ['Dépenses','Catégorie, motif, bénéficiaire et justificatif (ou pièce manquante signalée).',button('Dépense','expense-new','wallet','secondary small-btn',r())+button('Recette','income-new','plus','secondary small-btn',r())],
    ['Reversements et transferts','Mouvements de trésorerie, jamais des dépenses.',button('Transfert / reversement','transfer-new','transfer','secondary small-btn',r())],
    ['Comptage physique','L’argent réellement présent dans chaque caisse.',button('Comptage','count-new','scale','secondary small-btn')],
    ['Rapprochement et validation','Écarts documentés, état PDF, validation horodatée par le promoteur.',button('État consolidé','reprise-print','print','secondary small-btn','data-id="all"')],
  ];
  const consolidated=data.centers.reduce((t,c)=>{for(const k of ['opening','receipts','expenses','transfers_out','transfers_in','theoretical'])t[k]+=c[k];t.physical+=c.physical||0;return t;},{opening:0,receipts:0,expenses:0,transfers_out:0,transfers_in:0,theoretical:0,physical:0});
  return pageHead('Reprise comptable',`Saisie des opérations réelles depuis le ${start} jusqu’à la mise en production, avec leur date réelle. La date de saisie est conservée séparément.`,button('État consolidé (PDF)','reprise-print','print','secondary','data-id="all"'),`${data.centers.filter(c=>c.validation).length} / ${data.centers.length} siège${data.centers.length>1?'s':''} validé${data.centers.length>1?'s':''}`)+
  `<div class="notice formula">${icon('scale')}<p><strong>Solde théorique = solde initial réel + encaissements − dépenses − transferts sortants</strong> (+ transferts reçus). Il est comparé au comptage physique ; un écart doit être expliqué avant validation. Ne créez jamais de fausse écriture pour équilibrer : remettez ou transférez réellement l’argent, et enregistrez ce mouvement.</p></div>`+
  `<section class="panel"><div class="panel-header"><div><h2>Ordre de saisie recommandé</h2><p>Les boutons ouvrent les formulaires en mode reprise (date réelle et n° de pièce demandés).</p></div></div><ol class="reprise-steps">${steps.map(([t,h,a],i)=>`<li><span class="step-number">${i+1}</span><div><strong>${t}</strong><small>${h}</small></div><div class="row-actions">${a}</div></li>`).join('')}</ol></section>`+
  `<div class="reprise-grid">${data.centers.map(repriseCard).join('')}</div>`+
  (data.centers.length>1?`<section class="panel"><div class="panel-header"><h2>Vue consolidée</h2></div><div class="table-wrap"><table><thead><tr><th>Siège</th><th class="num">Initial</th><th class="num">Encaissé</th><th class="num">Dépensé</th><th class="num">Transferts −/+</th><th class="num">Théorique</th><th class="num">Physique</th><th>Écart</th><th>Statut</th></tr></thead><tbody>${data.centers.map(c=>`<tr><td><strong>${esc(c.center_name)}</strong></td><td class="num">${money(c.opening)}</td><td class="num">${money(c.receipts)}</td><td class="num">${money(c.expenses)}</td><td class="num">−${money(c.transfers_out)} / +${money(c.transfers_in)}</td><td class="num">${money(c.theoretical)}</td><td class="num">${c.physical===null?'—':money(c.physical)}</td><td>${gapBadge(c)}</td><td>${repriseStatus(c)}</td></tr>`).join('')}<tr class="total"><td><strong>Total réseau</strong></td><td class="num">${money(consolidated.opening)}</td><td class="num">${money(consolidated.receipts)}</td><td class="num">${money(consolidated.expenses)}</td><td class="num">−${money(consolidated.transfers_out)} / +${money(consolidated.transfers_in)}</td><td class="num">${money(consolidated.theoretical)}</td><td class="num">${money(consolidated.physical)}</td><td></td><td></td></tr></tbody></table></div></section>`:'')+
  `<div class="dashboard-bottom"><section class="panel"><div class="panel-header"><h2>Comptages physiques</h2>${button('Comptage','count-new','plus','secondary small-btn')}</div>${data.counts.length?`<div class="table-wrap"><table><thead><tr><th>Date</th><th>Siège</th><th class="num">Espèces</th><th class="num">Autres</th></tr></thead><tbody>${data.counts.map(k=>`<tr><td>${date(k.count_date)}<small>${esc(k.counted_by_name)}</small></td><td>${esc(k.center_name)}<small>${esc(k.notes)}</small></td><td class="num">${money(k.cash_amount)}</td><td class="num">${money(k.other_amount)}</td></tr>`).join('')}</tbody></table></div>`:empty('Aucun comptage','Comptez l’argent de chaque caisse puis enregistrez le montant.','','','scale',true)}</section><section class="panel"><div class="panel-header"><h2>Historique des validations</h2></div>${data.history.length?`<div class="table-wrap"><table><thead><tr><th>Siège</th><th>Validation</th><th>Écart</th><th>Statut</th></tr></thead><tbody>${data.history.map(v=>`<tr><td>${esc(v.center_name)}</td><td>${date(v.validated_at)}<small>${esc(v.validated_by_name)}</small></td><td>${money(v.gap)} FCFA<small>${esc(v.explanation)}</small></td><td>${v.revoked_at?`<span class="badge expired">Réouverte</span><small>${esc(v.revoked_by_name)} · ${esc(v.revoke_reason)}</small>`:'<span class="badge active">Active</span>'}</td></tr>`).join('')}</tbody></table></div>`:empty('Aucune validation','Le promoteur valide chaque siège après contrôle.','','','check',true)}</section></div>`;
}
function repriseValidateForm(centerId) {
  const c=state.data.centers.find(x=>String(x.center_id)===String(centerId)); if(!c) return;
  showModal(`Valider la reprise · ${esc(c.center_name)}`,`<form id="reprise-validate-form" data-id="${c.center_id}"><div class="form-error" role="alert"></div><table class="reprise-table"><tbody>${repriseRows(c).map(([k,v])=>`<tr><td>${k}</td><td class="num">${money(v)} FCFA</td></tr>`).join('')}<tr class="total"><td>Solde théorique au ${date(c.until)}</td><td class="num">${money(c.theoretical)} FCFA</td></tr><tr><td>Comptage physique</td><td class="num">${c.physical===null?'Non saisi':money(c.physical)+' FCFA'}</td></tr><tr class="${c.gap?'gap':''}"><td>Écart</td><td class="num">${c.gap===null?'—':money(c.gap)+' FCFA'}</td></tr></tbody></table>${c.operations.missing_docs?`<p class="notice warn">${icon('file')}${c.operations.missing_docs} opération${c.operations.missing_docs>1?'s':''} sans justificatif (pièce manquante signalée).</p>`:''}<label class="field"><span>Explication de l’écart${c.gap?' *':''}</span><textarea name="explanation" maxlength="1000" ${c.gap?'required minlength="10"':''} placeholder="${c.gap?'Expliquez précisément l’origine de l’écart':'Facultatif'}"></textarea></label><p class="form-note">La validation est horodatée à votre nom. Ensuite, plus aucune opération ne peut être antidatée pour ce siège : toute correction passe par une annulation tracée.</p>${actions('Valider la reprise')}</form>`);
}
function repriseReopenForm(centerId) {
  showModal('Réouvrir la reprise',`<form id="reprise-reopen-form" data-id="${esc(centerId)}"><div class="form-error" role="alert"></div><label class="field"><span>Motif de la réouverture *</span><textarea name="reason" required minlength="5" maxlength="250" placeholder="Ex. Reçu papier retrouvé à saisir"></textarea></label><p class="form-note">La validation précédente reste dans l’historique, avec ce motif.</p>${actions('Réouvrir')}</form>`);
}
// État de reprise imprimable (A4) : par siège ou consolidé.
function printReprise(target) {
  const data=state.data; const list=target==='all'?data.centers:data.centers.filter(c=>String(c.center_id)===String(target));
  const sign='<div class="report-sign"><div>Établi par (secrétariat)<br><br>Nom, date et signature</div><div>Contrôlé et validé par le promoteur<br><br>Nom, date et signature</div></div>';
  const block=c=>`<section class="report-center"><h2>${esc(c.center_name)} — ${c.validation?`validé le ${date(c.validation.validated_at)} par ${esc(c.validation.validated_by_name)}`:'non validé'}</h2><table><tbody><tr><td>Élèves de la session</td><td>${money(c.students.total)}</td></tr><tr><td>Inscriptions depuis le ${date(c.reprise_start)}</td><td>${money(c.students.since_start)}</td></tr><tr><td>Opérations saisies (dont reprise)</td><td>${money(c.operations.total)} (${money(c.operations.reprise)})</td></tr><tr><td>Pièces justificatives manquantes</td><td>${money(c.operations.missing_docs)}</td></tr>${repriseRows(c).map(([k,v])=>`<tr><td>${k}</td><td>${money(v)} FCFA</td></tr>`).join('')}<tr class="total"><td>Solde théorique au ${date(c.until)}</td><td>${money(c.theoretical)} FCFA</td></tr><tr><td>Comptage physique</td><td>${c.physical===null?'Non saisi':money(c.physical)+' FCFA'}</td></tr><tr class="total"><td>Écart</td><td>${c.gap===null?'—':money(c.gap)+' FCFA'}</td></tr>${c.validation?.explanation?`<tr><td>Explication</td><td>${esc(c.validation.explanation)}</td></tr>`:''}</tbody></table></section>`;
  $('#print-area').innerHTML=`<article class="report"><header><img src="/assets/logo-ruisseau.png" alt=""><div><h1>État de reprise comptable${target==='all'?' consolidé':''}</h1><p>Le Ruisseau du Succès · période du ${date(data.reprise_start)} au ${date(data.today)} · édité le ${date(data.today)} par ${esc(state.user.name)}</p></div></header>${list.map(block).join('')}${target==='all'&&list.length>1?`<section class="report-center"><h2>Total du réseau</h2><table><tbody><tr><td>Solde théorique</td><td>${money(list.reduce((t,c)=>t+c.theoretical,0))} FCFA</td></tr><tr><td>Comptages physiques</td><td>${money(list.reduce((t,c)=>t+(c.physical||0),0))} FCFA</td></tr><tr><td>Sièges validés</td><td>${list.filter(c=>c.validation).length} / ${list.length}</td></tr></tbody></table></section>`:''}${sign}</article>`;
  window.print();
}

async function handleUpload(input) {
  const file=input.files?.[0]; const form=input.form; const status=input.parentElement.querySelector('.file-status'); const hidden=form?.querySelector(`[name="${input.dataset.target}"]`);
  if(!file||!form) return;
  const drop=input.closest('.file-drop');
  form.dataset.uploading='1'; status.textContent=`Envoi de « ${file.name} »…`; drop.classList.remove('done','failed');
  try {
    const centerId=form.querySelector('[name="center_id"]')?.value||'';
    const result=await uploadFile(file,input.dataset.upload,input.dataset.upload==='justificatif'?centerId:'');
    hidden.value=result.id; status.textContent=`✓ ${result.name} (${fileSize(result.size)})`; drop.classList.add('done');
    const missing=form.querySelector('[name="missing_doc"]'); if(missing) missing.checked=false;
    if(input.dataset.upload==='photo'){const img=$('#teacher-photo-preview',form);img.src=`/api/files/${result.id}`;img.hidden=false;$('.photo-placeholder',form).hidden=true;}
  } catch(error) {hidden.value='';input.value='';status.textContent=error.message;drop.classList.add('failed');}
  finally {delete form.dataset.uploading;}
}
function updateTransferForm(form) {
  const transfer=$('input[name="kind"]:checked',form).value==='transfer'; const box=$('.transfer-to',form); const select=$('select',box);
  box.hidden=!transfer; select.required=transfer; const from=$('[name="center_id"]',form).value;
  [...select.options].forEach(o=>{if(o.value)o.hidden=o.disabled=o.value===from;}); if(select.value===from) select.value='';
  const who=$('[name="beneficiary"]',form); if(who) who.placeholder=transfer?'Personne qui transporte ou réceptionne l’argent':'Nom du promoteur ou de la personne qui reçoit';
}
// Fiches portant le même nom : doublon possible et parcours de l’élève (nouveau / redoublant).
let similarSequence=0;
async function similarHint(form) {
  const name=$('[name="name"]',form).value.trim(),cls=normalizeClass($('[name="class_name"]',form).value),box=$('#student-similar',form);
  if(!box||name.length<3) return; const sequence=++similarSequence;
  const found=(await api(`/students/similar?name=${encodeURIComponent(name)}`)).filter(s=>String(s.id)!==form.dataset.id);
  if(sequence!==similarSequence||!found.length) return;
  const current=$('[name="school_year"]',form).value; const repeat=cls&&found.find(s=>s.school_year<current&&normalizeClass(s.class_name)===cls);
  const same=found.find(s=>s.school_year===current); const others=found.filter(s=>s!==same).slice(0,4);
  box.innerHTML=`<p class="notice ${same?'warn':''}">${icon('people')}<span>${same?`<strong>Doublon possible :</strong> « ${esc(same.name)} » existe déjà (${esc(same.class_name)} · ${esc(same.center_name)} · ${esc(same.school_year)}).`:''}${others.length?` Parcours trouvé : ${others.map(s=>`${esc(s.class_name)} en ${esc(s.school_year)}`).join(', ')}.`:''}${repeat?`<br><strong>Classe déjà suivie en ${esc(repeat.school_year)} : statut « Redoublant » proposé.</strong>`:''}</span></p>`;
  const status=$('#student-status',form); if(repeat&&!status.value) status.value='redoublant';
}
async function refreshMeta() {state.meta=await api('/meta');if(!state.meta.years.includes(state.year))state.year=state.meta.school_year;shell();}
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action]');if(!target)return;
  const action=target.dataset.action,entryId=target.dataset.id;
  // Les formulaires ouverts depuis la page « Reprise comptable » demandent la date réelle de l’opération.
  if(['student-new','payment-new','student-pay','expense-new','income-new','opening-new','transfer-new','teacher-pay'].includes(action)) state.reprise=target.dataset.reprise==='1';
  try {
    if(action==='close')modal.close();
    if(action==='toggle-password'){const input=target.parentElement.querySelector('input');const show=input.type==='password';input.type=show?'text':'password';target.setAttribute('aria-pressed',String(show));target.setAttribute('aria-label',show?'Masquer le mot de passe':'Afficher le mot de passe');}
    if(action==='retry')await boot();
    if(action==='refresh')await renderPage();
    if(action==='menu')setMenu(!$('#sidebar').classList.contains('open'));
    if(action==='menu-close')setMenu(false);
    if(action==='logout'){await api('/auth/logout',{method:'POST'});state.user=null;state.center='all';state.year='';history.replaceState(null,'','/login');await boot();}
    if(action==='student-new')studentForm();
    if(action==='student-edit')studentForm(await api(`/students/${entryId}`));
    if(action==='student-view')await studentView(entryId);
    if(action==='student-pay')paymentForm(await api(`/students/${entryId}`));
    if(action==='payment-new')paymentForm();
    if(action==='payment-pick')pickPaymentStudent(paymentResults[Number(target.dataset.index)]);
    if(action==='payment-change'){state.paymentStudent=null;$('#payment-student').value='';$('#payment-who').innerHTML=studentSearch();$('#payment-search').focus();updatePaymentSummary();}
    if(action==='income-new')movementForm('income');
    if(action==='expense-new')movementForm('expense');
    if(action==='opening-new')movementForm('opening');
    if(action==='transfer-new')transferForm();
    if(action==='count-new')countForm();
    if(action==='reprise-validate')repriseValidateForm(entryId);
    if(action==='reprise-reopen')repriseReopenForm(entryId);
    if(action==='reprise-print')printReprise(entryId);
    if(action==='exam-new')await examForm();
    if(action==='exam-edit')await examForm(state.data.items.find(x=>String(x.id)===entryId));
    if(action==='exam-archive'){const restore=target.dataset.archived==='1';if(confirm(restore?'Remettre ce sujet dans la banque active ?':'Archiver ce sujet ? Il ne sera plus proposé dans la banque active (il reste consultable dans les archives).')){await api(`/exams/${entryId}/archive`,{method:'POST',body:{archived:!restore}});await renderPage();toast(restore?'Sujet restauré.':'Sujet archivé.');}}
    if(action==='exam-archived'){state.exam.archived=target.dataset.value;state.listPage=1;await renderPage();}
    if(action==='subject-new')subjectForm();
    if(action==='subject-edit')subjectForm(state.meta.subjects.find(x=>String(x.id)===entryId));
    if(action==='center-new')centerForm();
    if(action==='center-edit')centerForm(state.meta.centers.find(c=>String(c.id)===entryId));
    if(action==='center-open'){state.center=entryId;$('#center-filter').value=entryId;if(state.page==='dashboard')await renderPage();else location.hash='dashboard';}
    if(action==='user-new')userForm();
    if(action==='user-edit')userForm(state.data.find(u=>String(u.id)===entryId));
    if(action==='tariff-new')tariffForm();
    if(action==='tariff-edit')tariffForm(state.meta.tariffs.find(t=>String(t.id)===entryId));
    if(action==='teacher-new')teacherForm();
    if(action==='teacher-edit')teacherForm(await api(`/teachers/${entryId}`));
    if(action==='teacher-view')await teacherView(entryId);
    if(action==='teacher-pay')await teacherPayForm(entryId);
    if(action==='session-new')await sessionForm(entryId);
    if(action==='session-cancel')sessionCancelForm(entryId);
    if(action==='account')accountForm();
    if(action==='receipt')await receiptView(entryId);
    if(action==='print')window.print();
    if(action==='manual-print')printManual();
    if(action==='manual-goto'){const section=$(`#manual-${target.dataset.target}`);section?.scrollIntoView({behavior:'smooth',block:'start'});section?.querySelector('h2')?.setAttribute('tabindex','-1');section?.querySelector('h2')?.focus({preventScroll:true});}
    if(action==='reverse')await reverseForm(entryId);
    if(action==='status'||action==='kind'){state[action]=target.dataset.value;state.listPage=1;await renderPage();}
    if(action==='page-prev'||action==='page-next'){state.listPage+=action==='page-prev'?-1:1;await renderPage();}
  } catch(error) {toast(error.message,true);}
});
document.addEventListener('change',async event=>{
  const el=event.target;
  if(el.dataset.upload){await handleUpload(el);return;}
  if(el.form?.id==='payment-form'&&el.name==='tariff_id'){updatePaymentSummary(true);return;}
  if(el.form?.id==='payment-form'&&el.name==='period'){updatePaymentSummary();return;}
  if(el.form?.id==='payment-form'&&el.name==='operation_date'){updatePaymentSummary(true);return;}
  if(el.form?.id==='transfer-form'&&(el.name==='kind'||el.name==='center_id')){updateTransferForm(el.form);return;}
  if(el.form?.id==='student-form'&&(el.name==='name'||el.name==='class_name')){await similarHint(el.form).catch(()=>{});return;}
  if(el.id?.startsWith('exam-')&&el.tagName==='SELECT'){state.exam[{'exam-subject':'subject_id','exam-class':'class_name','exam-sequence':'sequence','exam-year':'school_year'}[el.id]]=el.value;state.listPage=1;await renderPage();return;}
  if(el.id==='teacher-pay-type'){togglePayType(el.form);return;}
  if(el.id==='teacher-pay-kind'){const remaining=Number(el.form.dataset.remaining);$('[name="amount"]',el.form).value=el.value==='salary'&&remaining>0?remaining:'';return;}
  if(el.id==='period-filter'){if(!el.value)return;state.period=el.value;await renderPage();return;}
  if(el.id==='center-filter')state.center=el.value;
  else if(el.id==='year-filter')state.year=el.value;
  else return;
  state.listPage=1;await renderPage();
});
let paymentSearchTimer, paymentSearchSequence=0;
document.addEventListener('input',event=>{
  if(event.target.id==='manual-search'){filterManual(event.target.value);return;}
  if(event.target.id==='payment-amount'){renderPaymentSummary();return;}
  if(event.target.id!=='payment-search')return;
  clearTimeout(paymentSearchTimer);const q=event.target.value.trim();const sequence=++paymentSearchSequence;
  const list=$('#payment-results');
  if(q.length<2){list.innerHTML='';paymentResults=[];return;}
  list.innerHTML='<p class="results-note">Recherche…</p>';
  paymentSearchTimer=setTimeout(async()=>{
    try{
      const result=await api(`/students?${query({school_year:state.year,q})}`);
      if(sequence!==paymentSearchSequence||!$('#payment-results'))return;
      paymentResults=result.items.slice(0,8);
      list.innerHTML=paymentResults.length?paymentResults.map((s,i)=>`<button type="button" class="result" role="option" data-action="payment-pick" data-index="${i}"><span class="avatar">${esc(initials(s.name))}</span><span class="result-text"><strong>${esc(s.name)}</strong><small>${esc(s.class_name)} · ${esc(s.center_name)} · ${esc(s.parent_phone)}</small></span>${badge(s.validity)}</button>`).join(''):`<p class="results-note">Aucun élève trouvé pour « ${esc(q)} ».</p>`;
    }catch(error){toast(error.message,true);}
  },220);
});
document.addEventListener('keydown',event=>{
  if(event.target.id==='payment-search'&&event.key==='Enter'){event.preventDefault();$('#payment-results .result')?.click();}
  // « / » place le curseur dans la recherche de la page.
  if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&!modal.open){const search=$('#search-form input');if(search){event.preventDefault();search.focus();}}
});
document.addEventListener('submit',async event=>{
  const form=event.target;if(!(form instanceof HTMLFormElement))return;event.preventDefault();
  if(form.id==='search-form'){state.q=new FormData(form).get('q');state.listPage=1;await renderPage();return;}
  const submit=$('button[type="submit"]',form);if(submit?.disabled)return;
  if(form.dataset.uploading){formError(form,new Error('Patientez : envoi du fichier en cours.'));return;}
  if(submit)submit.disabled=true;const body=Object.fromEntries(new FormData(form));const entryId=form.dataset.id;
  try {
    if(form.id==='auth-form'){
      const data=await api(`/auth/${form.dataset.type}`,{method:'POST',body});state.user=data.user;state.csrf=data.csrf;history.replaceState(null,'','/app#dashboard');await boot();return;
    }
    let message='Enregistrement effectué.';let receiptId=null;let refresh=false;
    if(form.id==='student-form'){
      if(entryId)body.center_id=$('[name="center_id"]',form).value;
      await api(entryId?`/students/${entryId}`:'/students',{method:entryId?'PUT':'POST',body});message=entryId?'Fiche élève mise à jour.':'Élève inscrit. Vous pouvez maintenant enregistrer son paiement.';refresh=true;
    }
    if(form.id==='payment-form'){if(!body.student_id)throw new Error('Choisissez d’abord l’élève dans la liste des résultats.');if(!body.tariff_id)throw new Error('Choisissez un tarif.');if(state.due&&state.due.remaining<=0)throw new Error('Cette échéance est déjà soldée : choisissez un autre mois ou un autre tarif.');const result=await api('/payments',{method:'POST',body});receiptId=result.id;message=result.remaining>0?`Paiement partiel enregistré (reçu ${result.receipt_number}). Reste à payer : ${money(result.remaining)} FCFA.`:`Paiement enregistré (reçu ${result.receipt_number}). La caisse et la validité sont à jour.`;}
    if(form.id==='movement-form'){const result=await api('/ledger',{method:'POST',body});receiptId=result.id;message='Mouvement enregistré dans la caisse.';}
    if(form.id==='reverse-form'){await api(`/ledger/${entryId}/reverse`,{method:'POST',body});message='Opération annulée. La contre-écriture est conservée dans l’historique.';}
    if(form.id==='teacher-form'){body.active=entryId?$('[name="active"]',form).checked:true;body.subject_ids=new FormData(form).getAll('subject_ids').map(Number);if(!body.subject_ids.length)throw new Error('Sélectionnez au moins une matière.');if(!entryId&&!body.photo_file_id)throw new Error('La photographie de l’enseignant est obligatoire.');await api(entryId?`/teachers/${entryId}`:'/teachers',{method:entryId?'PUT':'POST',body});message=entryId?'Fiche enseignant mise à jour.':'Enseignant créé. Vous pouvez saisir ses séances.';}
    if(form.id==='session-form'){const result=await api('/teacher-sessions',{method:'POST',body});message=result.amount?`Séance enregistrée : ${money(result.amount)} FCFA ajoutés au dû du mois.`:'Séance enregistrée.';}
    if(form.id==='session-cancel-form'){await api(`/teacher-sessions/${entryId}/cancel`,{method:'POST',body});message='Séance annulée. Elle n’est plus comptée dans la paie.';}
    if(form.id==='teacher-pay-form'){const result=await api(`/teachers/${entryId}/payments`,{method:'POST',body});receiptId=result.id;message=body.kind==='salary'?'Salaire versé et enregistré dans la caisse.':'Avance enregistrée dans la caisse.';}
    if(form.id==='transfer-form'){const result=await api('/transfers',{method:'POST',body});receiptId=result.id;message=body.kind==='transfer'?'Transfert enregistré dans les deux caisses.':'Reversement au promoteur enregistré.';}
    if(form.id==='count-form'){await api('/cash-counts',{method:'POST',body});message='Comptage enregistré. Comparez-le au solde théorique dans « Reprise comptable ».';}
    if(form.id==='reprise-validate-form'){await api(`/reprise/${entryId}/validate`,{method:'POST',body});refresh=true;message='Reprise validée : validation horodatée à votre nom.';}
    if(form.id==='reprise-reopen-form'){await api(`/reprise/${entryId}/reopen`,{method:'POST',body});refresh=true;message='Reprise réouverte. Le motif est conservé dans l’historique.';}
    if(form.id==='exam-form'){if(!entryId&&!body.file_id)throw new Error('Choisissez d’abord le fichier PDF du sujet.');const result=entryId?await api(`/exams/${entryId}`,{method:'PUT',body}):await api('/exams',{method:'POST',body});message=entryId?'Sujet modifié.':`Sujet déposé dans la banque (${result.reference}).`;}
    if(form.id==='subject-form'){body.active=$('[name="active"]',form).checked;await api(entryId?`/subjects/${entryId}`:'/subjects',{method:entryId?'PUT':'POST',body});refresh=true;message='Matière enregistrée.';}
    if(form.id==='attach-form'){if(!body.attachment_id)throw new Error('Choisissez d’abord le fichier.');await api(`/ledger/${entryId}/attachment`,{method:'POST',body});modal.close();await renderPage();toast('Justificatif joint à l’opération.');await receiptView(entryId);return;}
    if(form.id==='center-form'){await api(entryId?`/centers/${entryId}`:'/centers',{method:entryId?'PUT':'POST',body});refresh=true;message='Informations du siège enregistrées.';}
    if(form.id==='user-form'){if(entryId)body.active=$('[name="active"]',form).checked;await api(entryId?`/users/${entryId}`:'/users',{method:entryId?'PUT':'POST',body});message=entryId?'Compte mis à jour. Les anciennes sessions sont déconnectées.':'Accès secrétaire créé.';}
    if(form.id==='tariff-form'){body.active=$('[name="active"]',form).checked;await api(entryId?`/tariffs/${entryId}`:'/tariffs',{method:entryId?'PUT':'POST',body});refresh=true;message='Tarif enregistré.';}
    if(form.id==='settings-form'){await api('/settings',{method:'PUT',body});state.year=body.school_year;refresh=true;message='Session scolaire mise à jour.';}
    if(form.id==='password-form'){await api('/auth/password',{method:'POST',body});modal.close();state.user=null;history.replaceState(null,'','/login');await boot();toast('Mot de passe modifié. Connectez-vous à nouveau.');return;}
    modal.close();if(refresh)await refreshMeta();await renderPage();toast(message);if(receiptId)await receiptView(receiptId);
  }catch(error){
    // Doublon probable : l’utilisateur confirme explicitement avant un nouvel envoi.
    if(error.duplicate&&!$('input[name="confirm_duplicate"]',form)&&confirm(`${error.message}\n\nEnregistrer quand même ?`)){form.insertAdjacentHTML('beforeend','<input type="hidden" name="confirm_duplicate" value="true">');setTimeout(()=>form.requestSubmit());return;}
    formError(form,error);
  }finally{if(submit)submit.disabled=false;}
});
window.addEventListener('hashchange',()=>{
  if(!state.user)return;
  let page=location.hash.slice(1)||'dashboard';if(!titles[page])page='dashboard';
  if(!isManager()&&['users','settings','audit'].includes(page))page='dashboard';
  state.page=page;state.listPage=1;state.q='';state.status='';state.kind='';
  setMenu(false);modal.close();renderPage();
});
modal.addEventListener('click',event=>{if(event.target===modal){const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)modal.close();}});
boot();
