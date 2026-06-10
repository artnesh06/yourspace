/* ─────────────── UTILS ─────────────── */
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
const APP_CONFIG=window.APP_CONFIG||{};
const SUPABASE_URL=APP_CONFIG.supabaseUrl||'';
const SUPABASE_ANON_KEY=APP_CONFIG.supabaseAnonKey||'';
const ENABLE_REMOTE_SYNC=false;
const LOCAL_NAMESPACE='workboard-local-state-v2';
const REMOTE_TABLE='workboard_states';
const REMOTE_SAVE_DEBOUNCE_MS=900;
const asmMemoryStore = window.__asmMemoryStore || (window.__asmMemoryStore = {});

function safeStorageGet(key){
  try{
    const value=localStorage.getItem(key);
    return value===null?(asmMemoryStore[key]||null):value;
  }catch(_err){
    return asmMemoryStore[key]||null;
  }
}

function safeStorageSet(key,value){
  asmMemoryStore[key]=String(value);
  try{
    localStorage.setItem(key,value);
  }catch(_err){}
}

function safeStorageRemove(key){
  delete asmMemoryStore[key];
  try{
    localStorage.removeItem(key);
  }catch(_err){}
}

let supabaseClient=null;
let currentUser=null;
let currentView='kanban';
let _id=1;
let dragCard=null,dragFromCol=null;
let dragStartClientX=0,dragStartClientY=0;
let dragCardOverCol=null,dragCardOverId=null,dragCardOverSide='after';
let dragCol=null;
let dragColOverId=null;
let dragColOverSide='after';
let dragAttachmentId=null;
let dragAttachmentOverId=null;
let imageViewerZoom=1;
const imageViewerBaseWidthVw=84;
let today=new Date(),calYear=today.getFullYear(),calMonth=today.getMonth();
let calEvents=createDefaultCalEvents();
let kanban=createDefaultKanban();
let localSavedAt=0;
let remoteSaveTimer=null;
let toastTimer=null;
let syncingRemote=false;
let remoteSyncWarned=false;
let dueTickerTimer=null;
let boardMotionTimer=null;
let activeDescEditorEl=null;
let activeDescCardId=null;
let descSaveTimer=null;
let activeDescDirty=false;
let descExpanded=false;
let activeMediaCardId=null;
let activeMediaColId=null;
let activeMediaIndex=0;
let activeMediaTotal=0;

const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_FULL=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DESC_ALLOWED_TAGS=new Set(['p','br','strong','b','em','i','u','s','strike','ul','ol','li','blockquote','span','a','h1','h2','h3','h4','h5','h6']);
const DESC_ALLOWED_STYLES=new Set(['font-weight','font-style','text-decoration','font-size','color','background-color','text-align']);

function plainTextToRichHtml(text){
  return esc(String(text||'')).replace(/\n/g,'<br>');
}

function richHtmlToPlainText(html){
  const tmp=document.createElement('div');
  tmp.innerHTML=String(html||'');
  return String(tmp.textContent||'').replace(/\s+/g,' ').trim();
}

function sanitizeRichStyle(styleText){
  const style=String(styleText||'');
  if(!style.trim())return'';
  const safeRules=[];
  style.split(';').forEach(rule=>{
    const parts=rule.split(':');
    if(parts.length<2)return;
    const prop=parts[0].trim().toLowerCase();
    const value=parts.slice(1).join(':').trim();
    if(!DESC_ALLOWED_STYLES.has(prop)||!value)return;
    const lowerValue=value.toLowerCase();
    if(lowerValue.includes('url(')||lowerValue.includes('javascript:')||lowerValue.includes('expression('))return;
    safeRules.push(`${prop}:${value}`);
  });
  return safeRules.join(';');
}

function sanitizeRichHtml(rawHtml){
  const template=document.createElement('template');
  template.innerHTML=String(rawHtml||'');
  const dangerousTags=new Set(['script','style','iframe','object','embed','meta','link','form','input','button','textarea','select']);
  const walk=node=>{
    if(!node)return;
    if(node.nodeType===1){
      const tag=node.tagName.toLowerCase();
      Array.from(node.childNodes).forEach(walk);
      if(dangerousTags.has(tag)){
        node.remove();
        return;
      }
      if(!DESC_ALLOWED_TAGS.has(tag)){
        const parent=node.parentNode;
        if(!parent)return;
        while(node.firstChild)parent.insertBefore(node.firstChild,node);
        parent.removeChild(node);
        return;
      }

      Array.from(node.attributes).forEach(attr=>{
        const name=attr.name.toLowerCase();
        if(name.startsWith('on')){
          node.removeAttribute(attr.name);
          return;
        }
        if(name==='style'){
          const safeStyle=sanitizeRichStyle(attr.value);
          if(safeStyle)node.setAttribute('style',safeStyle);
          else node.removeAttribute('style');
          return;
        }
        if(tag==='a'&&name==='href'){
          const href=String(attr.value||'').trim();
          const lowerHref=href.toLowerCase();
          const isSafe=lowerHref.startsWith('http://')||lowerHref.startsWith('https://')||lowerHref.startsWith('mailto:')||lowerHref.startsWith('tel:')||lowerHref.startsWith('#')||lowerHref.startsWith('/');
          if(!isSafe)node.removeAttribute('href');
          return;
        }
        if(tag==='a'&&name==='target'){
          if(attr.value!=='_blank')node.removeAttribute('target');
          return;
        }
        if(tag==='a'&&name==='rel')return;
        if(name!=='href'&&name!=='target'&&name!=='rel'){
          node.removeAttribute(attr.name);
        }
      });
      if(tag==='a'&&node.getAttribute('target')==='_blank'){
        node.setAttribute('rel','noopener noreferrer');
      }
    }
  };
  Array.from(template.content.childNodes).forEach(walk);
  return template.innerHTML.trim();
}

function getCardDescHtml(card){
  if(card&&typeof card.descHtml==='string'&&card.descHtml.trim()){
    return sanitizeRichHtml(card.descHtml);
  }
  if(card&&typeof card.desc==='string'&&card.desc.trim()){
    return plainTextToRichHtml(card.desc);
  }
  return'';
}

function getCardDescPreview(card){
  const plain=richHtmlToPlainText(getCardDescHtml(card));
  if(!plain)return'';
  return plain.length>180?`${plain.slice(0,177)}...`:plain;
}

document.addEventListener('DOMContentLoaded',initApp);

async function initApp(){
  document.addEventListener('keydown',handleCardModalKeyNav);
  document.addEventListener('click',event=>{
    if(event.target instanceof Element&&event.target.closest('.cdx-attach-menu-wrap'))return;
    closeAttachmentMenus();
  });
  setupDummyLanding();
  if(!currentUser)currentUser={id:'local-user',email:'Local mode'};
  await loadStateForUser();
  renderKanban();
  renderCal();
}

function createLocalSession(){
  const session={email:'Local mode',createdAt:new Date().toISOString(),mode:'local'};
  safeStorageSet('asm_session',JSON.stringify(session));
  return session;
}

function setupDummyLanding(){
  // On app.html, just show the app directly
  const gate=document.getElementById('landing-gate');
  if(gate){
    // We're on index.html (shouldn't happen but fallback)
    gate.style.display='flex';
    showApp(false);
    return;
  }
  // We're on app.html — check session
  const saved=safeStorageGet('asm_session');
  if(!saved){
    const session=createLocalSession();
    currentUser={id:'local-user',email:session.email};
    showApp(true);
    return;
  }
  try{
    const session=JSON.parse(saved);
    if(session&&session.email){
      currentUser={id:session.email,email:session.email};
      showApp(true);
    } else {
      const fallback=createLocalSession();
      currentUser={id:'local-user',email:fallback.email};
      showApp(true);
    }
  }catch(e){
    const fallback=createLocalSession();
    currentUser={id:'local-user',email:fallback.email};
    showApp(true);
  }
}

function dummyEnterApp(intent='login'){
  const gate=document.getElementById('landing-gate');
  if(gate)gate.style.display='none';
  currentUser={id:'dummy-user',email:intent==='signin'?'Dummy sign in':'Dummy login'};
  showApp(true);
  showToast(intent==='signin'?'Dummy sign in aktif':'Dummy login aktif');
}

async function applySession(session){
  const user=session&&session.user?session.user:null;
  if(!user){
    currentUser=null;
    showAuthGate();
    showApp(false);
    return;
  }
  currentUser=user;
  document.getElementById('user-email').textContent=user.email||'Akun';
  showAuthGate(false);
  showApp(true);
  await loadStateForUser();
  renderKanban();
  renderCal();
}

function showAuthGate(show=true){
  const gate=document.getElementById('auth-gate')||document.getElementById('landing-gate');
  if(gate)gate.style.display=show?'grid':'none';
}
function showApp(show=true){
  document.getElementById('app-shell').classList.toggle('app-hidden',!show);
}

function setAuthMessage(message,isError=false){
  const el=document.getElementById('auth-message');
  el.textContent=message||'';
  el.classList.toggle('error',Boolean(isError));
}
function showToast(message){
  const toast=document.getElementById('toast');
  toast.textContent=message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove('show'),2200);
}
function setAuthLoading(isLoading,intent='login'){
  const loginBtn=document.getElementById('auth-login-btn');
  const registerBtn=document.getElementById('auth-register-btn');
  const resetBtn=document.getElementById('auth-reset-btn');
  const resendBtn=document.getElementById('auth-resend-btn');
  loginBtn.disabled=isLoading;
  registerBtn.disabled=isLoading;
  if(resetBtn)resetBtn.disabled=isLoading;
  if(resendBtn)resendBtn.disabled=isLoading;
  if(!isLoading){
    loginBtn.textContent='Masuk';
    registerBtn.textContent='Daftar';
    if(resetBtn)resetBtn.textContent='Lupa password';
    if(resendBtn)resendBtn.textContent='Kirim ulang verifikasi';
    return;
  }
  loginBtn.textContent=intent==='login'?'Masuk...':'Masuk';
  registerBtn.textContent=intent==='register'?'Daftar...':'Daftar';
  if(resetBtn)resetBtn.textContent=intent==='reset'?'Mengirim...':'Lupa password';
  if(resendBtn)resendBtn.textContent=intent==='resend'?'Mengirim...':'Kirim ulang verifikasi';
}

function readAuthForm(){
  const email=(document.getElementById('auth-email').value||'').trim();
  const password=document.getElementById('auth-password').value||'';
  return{email,password};
}

function getAuthRedirectUrl(){
  if(window.location.protocol==='file:')return undefined;
  return`${window.location.origin}${window.location.pathname}`;
}

function validateAuthForm(email,password){
  if(!email){
    setAuthMessage('Isi email dulu.',true);
    return false;
  }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    setAuthMessage('Format email belum valid.',true);
    return false;
  }
  if(!password){
    setAuthMessage('Isi password dulu.',true);
    return false;
  }
  if(password.length<8){
    setAuthMessage('Password minimal 8 karakter.',true);
    return false;
  }
  return true;
}

async function signInWithEmailPassword(){
  if(!supabaseClient){
    setAuthMessage('Konfigurasi auth belum aktif.',true);
    return;
  }
  const{email,password}=readAuthForm();
  if(!validateAuthForm(email,password))return;
  setAuthLoading(true,'login');
  setAuthMessage('Sedang login...');
  try{
    const {error}=await supabaseClient.auth.signInWithPassword({email,password});
    if(error){
      if(error.code==='email_not_confirmed'){
        setAuthMessage('Email belum dikonfirmasi. Cek inbox, atau matikan Confirm email di Supabase Auth supaya bisa login langsung.',true);
        return;
      }
      if(String(error.message||'').toLowerCase().includes('invalid login credentials')){
        setAuthMessage('Email/password tidak cocok. Kalau lupa, klik Lupa password.',true);
        return;
      }
      setAuthMessage(error.message||'Login gagal. Cek email/password kamu.',true);
      return;
    }
    setAuthMessage('Login berhasil.');
  }catch(_err){
    setAuthMessage('Gagal login. Coba lagi.',true);
  }finally{
    setAuthLoading(false);
  }
}

async function registerWithEmailPassword(){
  if(!supabaseClient){
    setAuthMessage('Konfigurasi auth belum aktif.',true);
    return;
  }
  const{email,password}=readAuthForm();
  if(!validateAuthForm(email,password))return;
  setAuthLoading(true,'register');
  setAuthMessage('Membuat akun...');
  try{
    const {data,error}=await supabaseClient.auth.signUp({email,password});
    if(error){
      if(error.code==='email_exists'){
        setAuthMessage('Email sudah terdaftar. Langsung klik Masuk saja.',true);
        return;
      }
      if(error.code==='email_provider_disabled'){
        setAuthMessage('Email/password signup dimatikan di Supabase. Aktifkan dulu Email provider.',true);
        return;
      }
      setAuthMessage(error.message||'Gagal daftar akun.',true);
      return;
    }
    if(data&&data.session){
      setAuthMessage('Akun berhasil dibuat dan langsung login.');
      return;
    }
    if(data&&data.user&&Array.isArray(data.user.identities)&&data.user.identities.length===0){
      setAuthMessage('Email ini kemungkinan sudah terdaftar. Coba Masuk atau klik Lupa password.',true);
      return;
    }
    setAuthMessage('Akun berhasil dibuat. Kalau belum bisa login, verifikasi email dulu atau matikan Confirm email di Supabase.');
  }catch(_err){
    setAuthMessage('Gagal daftar akun. Coba lagi.',true);
  }finally{
    setAuthLoading(false);
  }
}

async function sendPasswordReset(){
  if(!supabaseClient){
    setAuthMessage('Konfigurasi auth belum aktif.',true);
    return;
  }
  const {email}=readAuthForm();
  if(!email){
    setAuthMessage('Isi email dulu untuk reset password.',true);
    return;
  }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    setAuthMessage('Format email belum valid.',true);
    return;
  }
  setAuthLoading(true,'reset');
  setAuthMessage('Mengirim reset password...');
  try{
    const redirectTo=getAuthRedirectUrl();
    const opts=redirectTo?{redirectTo}:undefined;
    const {error}=await supabaseClient.auth.resetPasswordForEmail(email,opts);
    if(error){
      setAuthMessage(error.message||'Gagal kirim reset password.',true);
      return;
    }
    setAuthMessage('Email reset password sudah dikirim. Cek inbox kamu.');
  }catch(_err){
    setAuthMessage('Gagal kirim reset password. Coba lagi.',true);
  }finally{
    setAuthLoading(false);
  }
}

async function resendSignupConfirmation(){
  if(!supabaseClient){
    setAuthMessage('Konfigurasi auth belum aktif.',true);
    return;
  }
  const {email}=readAuthForm();
  if(!email){
    setAuthMessage('Isi email dulu untuk kirim ulang verifikasi.',true);
    return;
  }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    setAuthMessage('Format email belum valid.',true);
    return;
  }
  setAuthLoading(true,'resend');
  setAuthMessage('Mengirim ulang email verifikasi...');
  try{
    const redirectTo=getAuthRedirectUrl();
    const payload={type:'signup',email};
    if(redirectTo)payload.options={emailRedirectTo:redirectTo};
    const {error}=await supabaseClient.auth.resend(payload);
    if(error){
      setAuthMessage(error.message||'Gagal kirim ulang verifikasi.',true);
      return;
    }
    setAuthMessage('Email verifikasi dikirim ulang. Cek inbox kamu.');
  }catch(_err){
    setAuthMessage('Gagal kirim ulang verifikasi. Coba lagi.',true);
  }finally{
    setAuthLoading(false);
  }
}

async function signOutUser(){
  if(!supabaseClient)return;
  await supabaseClient.auth.signOut();
  showToast('Logout berhasil');
}

function getStorageKey(){
  const uid=currentUser&&currentUser.id?currentUser.id:'anon';
  return`${LOCAL_NAMESPACE}:${uid}`;
}

function saveLocalData(triggerRemote=true){
  if(!currentUser)return;
  try{
    localSavedAt=Date.now();
    safeStorageSet(getStorageKey(),JSON.stringify({kanban,calEvents,savedAt:localSavedAt}));
    if(triggerRemote)queueRemoteSave();
  }catch(err){
    console.warn('Data lokal gagal disimpan.',err);
  }
}

function loadLocalData(){
  if(!currentUser)return false;
  try{
    const raw=safeStorageGet(getStorageKey());
    if(!raw)return false;
    const data=JSON.parse(raw);
    if(data&&data.kanban&&Array.isArray(data.kanban.cols)&&data.calEvents&&typeof data.calEvents==='object'){
      kanban=normalizeKanbanData(data.kanban);
      calEvents=data.calEvents;
      localSavedAt=Number(data.savedAt||0);
      syncIdCounter();
      return true;
    }
  }catch(err){
    console.warn('Data lokal gagal dimuat.',err);
  }
  return false;
}

async function loadRemoteData(){
  if(!ENABLE_REMOTE_SYNC||!supabaseClient||!currentUser)return false;
  try{
    const {data,error}=await supabaseClient
      .from(REMOTE_TABLE)
      .select('kanban,cal_events,updated_at')
      .eq('user_id',currentUser.id)
      .maybeSingle();
    if(error){
      console.warn('Remote load error',error);
      if(!remoteSyncWarned){
        showToast('Cloud sync belum aktif. Cek schema/RLS Supabase.');
        remoteSyncWarned=true;
      }
      return false;
    }
    if(data&&data.kanban&&data.cal_events){
      const remoteSavedAt=Date.parse(data.updated_at||0)||0;
      if(remoteSavedAt>=localSavedAt){
        kanban=normalizeKanbanData(data.kanban);
        calEvents=data.cal_events;
        localSavedAt=remoteSavedAt;
        syncIdCounter();
        saveLocalData(false);
      }
      return true;
    }
  }catch(err){
    console.warn('Remote load gagal',err);
    if(!remoteSyncWarned){
      showToast('Cloud sync error. Cek koneksi atau konfigurasi DB.');
      remoteSyncWarned=true;
    }
  }
  return false;
}

function queueRemoteSave(force=false){
  if(!ENABLE_REMOTE_SYNC||!supabaseClient||!currentUser)return;
  if(force){
    saveRemoteData();
    return;
  }
  clearTimeout(remoteSaveTimer);
  remoteSaveTimer=setTimeout(()=>saveRemoteData(),REMOTE_SAVE_DEBOUNCE_MS);
}

async function saveRemoteData(){
  if(!ENABLE_REMOTE_SYNC||!supabaseClient||!currentUser||syncingRemote)return;
  syncingRemote=true;
  try{
    const {error}=await supabaseClient.from(REMOTE_TABLE).upsert({
      user_id:currentUser.id,
      kanban,
      cal_events:calEvents,
      updated_at:new Date().toISOString()
    },{onConflict:'user_id'});
    if(error){
      console.warn('Remote save error',error);
      if(!remoteSyncWarned){
        showToast('Cloud sync gagal. Jalankan schema Supabase dulu.');
        remoteSyncWarned=true;
      }
      return;
    }
    remoteSyncWarned=false;
  }catch(err){
    console.warn('Remote save gagal',err);
    if(!remoteSyncWarned){
      showToast('Cloud sync gagal. Cek Supabase.');
      remoteSyncWarned=true;
    }
  }finally{
    syncingRemote=false;
  }
}

async function loadStateForUser(){
  const hasLocal=loadLocalData();
  const hasRemote=await loadRemoteData();
  if(!hasLocal&&!hasRemote){
    _id=1;
    kanban=createDefaultKanban();
    calEvents=createDefaultCalEvents();
    syncIdCounter();
    saveLocalData(false);
    queueRemoteSave(true);
  }
  if(hasLocal&&!hasRemote){
    queueRemoteSave(true);
  }
}

function syncIdCounter(){
  let max=0;
  const scan=id=>{
    const n=Number(String(id||'').replace(/\D/g,''));
    if(Number.isFinite(n)&&n>max)max=n;
  };
  kanban.cols.forEach(col=>{scan(col.id);col.cards.forEach(card=>scan(card.id))});
  Object.values(calEvents).forEach(events=>(events||[]).forEach(ev=>scan(ev.id)));
  _id=max+1;
}

function uid(){return'id'+((_id++))}

/* ─────────────── VIEW SWITCH ─────────────── */
function switchView(v){
  currentView=v;
  document.getElementById('view-kanban').classList.toggle('active',v==='kanban');
  document.getElementById('view-kalender').classList.toggle('active',v==='kalender');
  document.getElementById('vt-kanban').classList.toggle('active',v==='kanban');
  document.getElementById('vt-kalender').classList.toggle('active',v==='kalender');
  document.getElementById('topbar-kanban-right').style.display=v==='kanban'?'flex':'none';
  document.getElementById('topbar-cal-right').style.display=v==='kalender'?'flex':'none';
  if(v==='kalender')renderCal();
}

/* ─────────────── MODAL ─────────────── */
function showModal(html,variant='default'){
  const box=document.getElementById('modal-box');
  box.innerHTML=html;
  box.classList.toggle('modal-wide',variant==='card-detail');
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(()=>{
    const i=document.querySelector('#modal-box input:not([type=file]):not([type=date]):not([type=time])');
    if(i)i.focus();
  },60);
}
function closeModal(){
  if(activeDescDirty&&activeDescCardId&&document.getElementById('cd-desc-editor')){
    saveCardDesc(activeDescCardId);
  }
  clearTimeout(descSaveTimer);
  activeDescEditorEl=null;
  activeDescCardId=null;
  activeDescDirty=false;
  descExpanded=false;
  activeMediaCardId=null;
  activeMediaColId=null;
  activeMediaIndex=0;
  activeMediaTotal=0;
  dragAttachmentId=null;
  dragAttachmentOverId=null;
  closeAttachmentMenus();
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('modal-box').classList.remove('modal-wide');
}
function handleOverlayClick(e){if(e.target===document.getElementById('modal-overlay'))closeModal()}

function previewImg(input,previewId){
  const file=input.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=e=>{const img=document.getElementById(previewId);img.src=e.target.result;img.style.display='block'};
  r.readAsDataURL(file);
}

function getImageFiles(fileList){
  return Array.from(fileList||[]).filter(file=>file&&String(file.type||'').startsWith('image/'));
}

function isFileDrag(event){
  const dt=event&&event.dataTransfer?event.dataTransfer:null;
  if(!dt)return false;
  if(dt.files&&dt.files.length)return true;
  return Array.from(dt.types||[]).includes('Files');
}

function dropzoneDragOver(event){
  if(!isFileDrag(event))return;
  event.preventDefault();
  event.stopPropagation();
  if(event.dataTransfer)event.dataTransfer.dropEffect='copy';
  const zone=event.currentTarget;
  if(zone&&zone.classList)zone.classList.add('drop-active');
  const modal=zone&&zone.closest?zone.closest('.cdx-card-modal'):null;
  if(modal)modal.classList.add('drop-active');
}

function dropzoneDragEnter(event){
  if(!isFileDrag(event))return;
  event.preventDefault();
  event.stopPropagation();
  const zone=event.currentTarget;
  if(!zone||!zone.classList)return;
  const nextDepth=Number(zone.dataset.dragDepth||0)+1;
  zone.dataset.dragDepth=String(nextDepth);
  zone.classList.add('drop-active');
  const modal=zone.closest?zone.closest('.cdx-card-modal'):null;
  if(modal)modal.classList.add('drop-active');
}

function dropzoneDragLeave(event){
  event.preventDefault();
  event.stopPropagation();
  const zone=event.currentTarget;
  if(!zone||!zone.classList)return;
  const nextDepth=Math.max(0,Number(zone.dataset.dragDepth||0)-1);
  zone.dataset.dragDepth=String(nextDepth);
  if(nextDepth===0)zone.classList.remove('drop-active');
  const modal=zone.closest?zone.closest('.cdx-card-modal'):null;
  if(modal){
    const rect=modal.getBoundingClientRect();
    const outside=event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom;
    if(outside){
      modal.classList.remove('drop-active');
      modal.dataset.dragDepth='0';
    }
  }
}

function dropzoneDropToInput(event,inputId){
  if(!isFileDrag(event))return;
  event.preventDefault();
  event.stopPropagation();
  const zone=event.currentTarget;
  document.querySelectorAll('.drop-active').forEach(item=>{
    item.classList.remove('drop-active');
    if(item.dataset)item.dataset.dragDepth='0';
  });
  const input=document.getElementById(inputId);
  if(!input)return;
  const files=getImageFiles(event.dataTransfer&&event.dataTransfer.files?event.dataTransfer.files:[]);
  if(!files.length){
    const types=Array.from(event.dataTransfer&&event.dataTransfer.types?event.dataTransfer.types:[]);
    if(types.includes('Files'))showToast('Drop file gambar ya');
    return;
  }
  if(typeof DataTransfer==='undefined'){
    showToast('Browser belum dukung drag drop ini');
    return;
  }
  const dt=new DataTransfer();
  const selected=input.multiple?files:[files[0]];
  selected.forEach(file=>dt.items.add(file));
  try{
    input.files=dt.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }catch(_err){
    showToast('Gagal attach file, coba klik tombol upload');
  }
}

/* ══════════════════════════════════════
   KANBAN
══════════════════════════════════════ */
function createDefaultKanban(){
  return{
    cols:[
      {id:'c1',name:'To Do',cards:[
        {id:'k1',title:'Design landing page',desc:'Buat wireframe & mockup homepage baru.',due:'2026-05-28',img:'',attachments:[],posted:false,comments:['Looks great!']},
        {id:'k2',title:'Nulis blog post',desc:'Draft artikel tips produktivitas.',due:'2026-05-30',img:'',attachments:[],posted:false,comments:[]}
      ]},
      {id:'c2',name:'In Progress',cards:[
        {id:'k3',title:'API integration',desc:'Koneksi frontend ke payment gateway.',due:'2026-05-29',img:'',attachments:[],posted:false,comments:['Almost done','Nunggu API keys']}
      ]},
      {id:'c3',name:'Review',cards:[]},
      {id:'c4',name:'Done',cards:[
        {id:'k4',title:'Setup CI/CD',desc:'GitHub Actions untuk auto-deploy.',due:'2026-05-20',img:'',attachments:[],posted:true,comments:[]}
      ]}
    ]
  };
}

function normalizeKanbanData(rawKanban){
  if(!rawKanban||!Array.isArray(rawKanban.cols))return createDefaultKanban();
  const cols=rawKanban.cols.map((col,idx)=>({
    id:String(col&&col.id?col.id:`c${idx+1}`),
    name:String(col&&col.name?col.name:`Column ${idx+1}`),
    cards:Array.isArray(col&&col.cards)?col.cards.map(normalizeCard):[]
  }));
  return{...rawKanban,cols};
}

function normalizeCard(card){
  const safeCard=card&&typeof card==='object'?card:{};
  const legacyDesc=typeof safeCard.desc==='string'?safeCard.desc:'';
  const rawDescHtml=typeof safeCard.descHtml==='string'?safeCard.descHtml:'';
  const normalizedDescHtml=rawDescHtml.trim()?sanitizeRichHtml(rawDescHtml):(legacyDesc?plainTextToRichHtml(legacyDesc):'');
  // Migrate comments: string[] → {text,createdAt,author}[]
  const rawComments=Array.isArray(safeCard.comments)?safeCard.comments:[];
  const normalizedComments=rawComments.map(item=>{
    if(item&&typeof item==='object'&&typeof item.text==='string')return item;
    return{text:String(item||''),createdAt:new Date().toISOString(),author:''};
  });
  return{
    ...safeCard,
    id:String(safeCard.id||`k-${Date.now()}-${Math.random().toString(16).slice(2,7)}`),
    title:String(safeCard.title||'Untitled card'),
    desc:legacyDesc||richHtmlToPlainText(normalizedDescHtml),
    descHtml:normalizedDescHtml,
    due:typeof safeCard.due==='string'?safeCard.due:'',
    dueTime:typeof safeCard.dueTime==='string'?safeCard.dueTime:'',
    img:typeof safeCard.img==='string'?safeCard.img:'',
    attachments:Array.isArray(safeCard.attachments)?safeCard.attachments
      .filter(item=>item&&typeof item==='object'&&typeof item.url==='string')
      .map((item,idx)=>({
        id:String(item.id||`att-${idx+1}`),
        name:typeof item.name==='string'&&item.name.trim()?item.name:`file-${idx+1}.png`,
        url:item.url,
        addedAt:typeof item.addedAt==='string'?item.addedAt:new Date().toISOString(),
        size:Number(item.size||0)
      })) : [],
    posted:Boolean(safeCard.posted),
    createdAt:typeof safeCard.createdAt==='string'?safeCard.createdAt:new Date().toISOString(),
    createdBy:typeof safeCard.createdBy==='string'?safeCard.createdBy:'',
    comments:normalizedComments
  };
}

function getKanbanCard(id){
  for(const col of kanban.cols){
    const c=col.cards.find(card=>card.id===id);
    if(c)return{card:c,col};
  }
  return null;
}

function canStartColumnDrag(target){
  if(!target||!(target instanceof Element))return true;
  return !target.closest('.card,.cards-list,.add-card-btn,.col-actions,.icon-btn,button,input,textarea,select,a,[contenteditable="true"]');
}

function clearColumnDragVisuals(){
  const board=document.getElementById('board');
  if(board)board.classList.remove('col-drag-active');
  document.body.classList.remove('is-col-dragging');
  document.querySelectorAll('.col').forEach(col=>{
    col.classList.remove('col-dragging','col-drop-before','col-drop-after');
  });
}

function resetColumnDragState(){
  dragCol=null;
  dragColOverId=null;
  dragColOverSide='after';
}

function moveColumn(dragId,targetId,side='after'){
  if(!dragId||!targetId||dragId===targetId)return false;
  const fromIndex=kanban.cols.findIndex(col=>col.id===dragId);
  const targetIndex=kanban.cols.findIndex(col=>col.id===targetId);
  if(fromIndex<0||targetIndex<0)return false;
  const moved=kanban.cols.splice(fromIndex,1)[0];
  let insertAt=kanban.cols.findIndex(col=>col.id===targetId);
  if(insertAt<0)insertAt=kanban.cols.length;
  if(side==='after')insertAt+=1;
  if(insertAt<0)insertAt=0;
  if(insertAt>kanban.cols.length)insertAt=kanban.cols.length;
  kanban.cols.splice(insertAt,0,moved);
  return true;
}

function moveColumnByPointer(dragId,pointerX){
  const board=document.getElementById('board');
  if(!board)return false;
  const colEls=Array.from(board.querySelectorAll('.col'));
  if(!colEls.length)return false;
  let targetId=colEls[colEls.length-1].dataset.colId||'';
  let side='after';
  for(const colEl of colEls){
    if((colEl.dataset.colId||'')===dragId)continue;
    const rect=colEl.getBoundingClientRect();
    const mid=rect.left+(rect.width/2);
    if(pointerX<mid){
      targetId=colEl.dataset.colId||'';
      side='before';
      break;
    }
  }
  if(!targetId||targetId===dragId)return false;
  return moveColumn(dragId,targetId,side);
}

function clearInactiveCardDropLists(activeList=null){
  document.querySelectorAll('.cards-list.drag-active').forEach(listEl=>{
    if(listEl!==activeList)listEl.classList.remove('drag-active');
  });
}

function autoScrollDuringCardDrag(event){
  if(!dragCard||dragCol||!event)return;
  const verticalEdge=52;
  const verticalStep=7;
  const horizontalEdge=104;
  const horizontalStep=14;
  const movedX=Math.abs(event.clientX-dragStartClientX);
  const movedY=Math.abs(event.clientY-dragStartClientY);
  const horizontalIntent=movedX>90&&movedX>(movedY*1.25);
  const nearTop=event.clientY<verticalEdge;
  const nearBottom=window.innerHeight-event.clientY<verticalEdge;

  if(!horizontalIntent&&(nearTop||nearBottom)){
    window.scrollBy({top:nearTop?-verticalStep:verticalStep,behavior:'auto'});
  }

  const wrap=document.querySelector('.board-wrap');
  if(!wrap)return;
  const rect=wrap.getBoundingClientRect();
  if(event.clientX<rect.left+horizontalEdge){
    wrap.scrollLeft-=horizontalStep;
  }else if(rect.right-event.clientX<horizontalEdge){
    wrap.scrollLeft+=horizontalStep;
  }
}

function placeDraggedCardInList(list,event){
  if(!dragCard||dragCol||!list)return false;
  const draggedEl=document.querySelector(`.card[data-card-id="${dragCard}"]`);
  if(!draggedEl)return false;

  const cards=Array.from(list.querySelectorAll('.card')).filter(el=>el!==draggedEl);
  let targetId='';
  let side='after';

  if(!cards.length){
    if(draggedEl.parentNode!==list)list.appendChild(draggedEl);
  }else{
    let insertBefore=null;
    for(const card of cards){
      const rect=card.getBoundingClientRect();
      if(event&&event.clientY<rect.top+(rect.height/2)){
        insertBefore=card;
        targetId=card.dataset.cardId||'';
        side='before';
        break;
      }
      targetId=card.dataset.cardId||'';
      side='after';
    }
    if(insertBefore){
      if(draggedEl.nextSibling!==insertBefore)list.insertBefore(draggedEl,insertBefore);
    }else if(draggedEl!==list.lastElementChild){
      list.appendChild(draggedEl);
    }
  }

  dragCardOverCol=list.id.replace('list-','');
  dragCardOverId=targetId;
  dragCardOverSide=side;
  list.classList.add('drag-active');
  clearInactiveCardDropLists(list);
  return true;
}

function refreshColumnCountsFromDOM(){
  document.querySelectorAll('.col').forEach(colEl=>{
    const countEl=colEl.querySelector('.col-count');
    if(countEl)countEl.textContent=String(colEl.querySelectorAll('.card').length);
  });
}

function markCardDragLanded(cardId){
  document.querySelectorAll('.card-drag-landed').forEach(el=>el.classList.remove('card-drag-landed'));
  if(!cardId)return;
  const movedEl=document.querySelector(`.card[data-card-id="${cardId}"]`);
  if(!movedEl)return;
  movedEl.classList.add('card-drag-landed');
  setTimeout(()=>movedEl.classList.remove('card-drag-landed'),950);
}

function finishCardDrag(shouldSave=true){
  const movedCardId=dragCard;
  syncCardOrderFromDOM();
  refreshColumnCountsFromDOM();
  clearCardDragVisuals();
  resetCardDragState();
  if(shouldSave)saveLocalData();
  markCardDragLanded(movedCardId);
}

function clearCardDragVisuals(){
  document.body.classList.remove('is-card-dragging');
  document.querySelectorAll('.card').forEach(cardEl=>{
    cardEl.classList.remove('dragging','card-drop-before','card-drop-after');
  });
  clearInactiveCardDropLists(null);
}

function syncCardOrderFromDOM(){
  const allCards=new Map();
  const originalColByCard=new Map();
  kanban.cols.forEach(col=>{
    col.cards.forEach(card=>{
      if(!card||!card.id)return;
      allCards.set(card.id,card);
      originalColByCard.set(card.id,col.id);
    });
  });

  const nextByCol=new Map(kanban.cols.map(col=>[col.id,[]]));
  const assigned=new Set();
  document.querySelectorAll('.cards-list').forEach(listEl=>{
    const colId=listEl.id.replace('list-','');
    if(!nextByCol.has(colId))return;
    const nextCards=[];
    Array.from(listEl.querySelectorAll('.card')).forEach(el=>{
      const id=el.dataset.cardId;
      const card=allCards.get(id);
      if(!id||!card||assigned.has(id))return;
      assigned.add(id);
      nextCards.push(card);
    });
    nextByCol.set(colId,nextCards);
  });

  allCards.forEach((card,id)=>{
    if(assigned.has(id))return;
    const colId=originalColByCard.get(id);
    const fallback=nextByCol.get(colId);
    if(fallback)fallback.push(card);
  });

  kanban.cols.forEach(col=>{
    col.cards=nextByCol.get(col.id)||[];
  });
}

function resetCardDragState(){
  dragCard=null;
  dragFromCol=null;
  dragStartClientX=0;
  dragStartClientY=0;
  dragCardOverCol=null;
  dragCardOverId=null;
  dragCardOverSide='after';
}

function moveCardBetweenColumns(cardId,fromColId,toColId,targetCardId='',side='after'){
  if(!cardId||!fromColId||!toColId)return false;
  const fromCol=kanban.cols.find(col=>col.id===fromColId);
  const toCol=kanban.cols.find(col=>col.id===toColId);
  if(!fromCol||!toCol)return false;
  const fromIndex=fromCol.cards.findIndex(card=>card.id===cardId);
  if(fromIndex<0)return false;
  if(cardId===targetCardId)return false;
  const [moved]=fromCol.cards.splice(fromIndex,1);
  let insertAt=toCol.cards.length;
  if(targetCardId){
    const targetIndex=toCol.cards.findIndex(card=>card.id===targetCardId);
    if(targetIndex>=0){
      insertAt=targetIndex+(side==='after'?1:0);
    }
  }
  if(insertAt<0)insertAt=0;
  if(insertAt>toCol.cards.length)insertAt=toCol.cards.length;
  toCol.cards.splice(insertAt,0,moved);
  return true;
}

function getDueClass(due){
  if(!due)return'';
  const diff=(new Date(due)-new Date())/86400000;
  return diff<0?'due-over':diff<=2?'due-warn':'due-ok';
}

function getCardDueDateTime(cardOrDue,dueTime=''){
  const due=typeof cardOrDue==='object'&&cardOrDue?cardOrDue.due:cardOrDue;
  const time=typeof cardOrDue==='object'&&cardOrDue?cardOrDue.dueTime:dueTime;
  if(!due)return null;
  const safeTime=time&&/^\d{2}:\d{2}$/.test(time)?time:'00:00';
  const date=new Date(`${due}T${safeTime}:00`);
  if(Number.isNaN(date.getTime()))return null;
  return date;
}

function getCardDueClass(card){
  if(!card||!card.due)return'';
  const target=getCardDueDateTime(card);
  if(!target)return'';
  const diff=(target-new Date())/86400000;
  return diff<0?'due-over':diff<=2?'due-warn':'due-ok';
}

function formatDueDate(due,dueTime=''){
  if(!due)return'';
  const d=getCardDueDateTime(due,dueTime)||new Date(due);
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const time=dueTime?`, ${dueTime}`:'';
  return`${d.getDate()} ${months[d.getMonth()]}${time}`;
}

function getDueCountdown(cardOrDue,dueTime=''){
  const due=typeof cardOrDue==='object'&&cardOrDue?cardOrDue.due:cardOrDue;
  if(!due)return'';
  const now=new Date();
  const target=getCardDueDateTime(cardOrDue,dueTime)||new Date(due);
  let diff=target-now;
  const isOverdue=diff<0;
  if(isOverdue)diff=Math.abs(diff);
  const days=Math.floor(diff/86400000);
  const hours=Math.floor((diff%86400000)/3600000);
  const mins=Math.floor((diff%3600000)/60000);
  const secs=Math.floor((diff%60000)/1000);
  let parts=[];
  if(days>0)parts.push(`${days}d`);
  if(hours>0||days>0)parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  const timeStr=parts.join(' ');
  return isOverdue?`-${timeStr}`:`${timeStr}`;
}

function getDueTickerTrackHtml(text,long){
  const raw=String(text||'');
  const safe=esc(raw);
  return`<span class="card-due-ticker-track">
      <span>${safe}</span>
      ${long?`<span aria-hidden="true">${safe}</span>`:''}
    </span>`;
}

function getDueTickerHtml(text,threshold=14,slot=''){
  const raw=String(text||'');
  const long=raw.length>threshold;
  return`<span class="card-due-ticker ${long?'is-long':''}" ${slot?`data-due-slot="${slot}"`:''} data-due-text="${esc(raw)}">${getDueTickerTrackHtml(raw,long)}</span>`;
}

function updateDueTickerText(ticker,text,threshold=14){
  if(!ticker)return;
  const raw=String(text||'');
  if(ticker.dataset&&ticker.dataset.dueText===raw)return;
  const long=raw.length>threshold;
  ticker.classList.toggle('is-long',long);
  if(ticker.dataset)ticker.dataset.dueText=raw;
  ticker.innerHTML=getDueTickerTrackHtml(raw,long);
}

function getDueBadgeInner(card){
  const dueFormatted=formatDueDate(card.due,card.dueTime);
  const stateClass=card.posted?'due-done':getCardDueClass(card);
  return`
    <span class="card-due card-due-date ${stateClass}">
      ${iconClock(12)}
      ${getDueTickerHtml(dueFormatted,13,'date')}
    </span>`;
}

function getCardMetaHtml(card){
  return`
    ${card.due?`<span class="card-due-group" data-card-id="${esc(card.id)}">${getDueBadgeInner(card)}</span>`:''}
    ${card.comments&&card.comments.length?`<span class="card-cmts">${iconMsg(10)} ${card.comments.length}</span>`:''}`;
}

function updateDueBadges(){
  document.querySelectorAll('.card-due-group[data-card-id]').forEach(el=>{
    const found=getKanbanCard(el.dataset.cardId);
    if(!found||!found.card||!found.card.due)return;
    const card=found.card;
    const stateClass=card.posted?'due-done':getCardDueClass(card);
    el.querySelectorAll('.card-due').forEach(pill=>{
      pill.classList.remove('due-done','due-ok','due-warn','due-over');
      if(stateClass)pill.classList.add(stateClass);
    });
    updateDueTickerText(el.querySelector('[data-due-slot="date"]'),formatDueDate(card.due,card.dueTime),13);
  });
}

function startDueTicker(){
  clearInterval(dueTickerTimer);
  dueTickerTimer=setInterval(updateDueBadges,1000);
}

function refreshCardElement(cardId){
  const found=getKanbanCard(cardId);
  if(!found)return;
  const card=found.card;
  const cardEl=document.querySelector(`.card[data-card-id="${cardId}"]`);
  if(!cardEl)return;
  cardEl.classList.toggle('card-done',Boolean(card.posted));

  const checkBtn=cardEl.querySelector('.card-check-btn');
  if(checkBtn){
    checkBtn.classList.toggle('active',Boolean(card.posted));
    checkBtn.title=card.posted?'Tandai belum selesai':'Tandai selesai';
    checkBtn.innerHTML=card.posted?iconCheck(12):iconCircle(14);
    checkBtn.classList.remove('spark');
    if(card.posted){
      void checkBtn.offsetWidth;
      checkBtn.classList.add('spark');
      setTimeout(()=>checkBtn.classList.remove('spark'),560);
    }
  }

  const metaEl=cardEl.querySelector('.card-meta');
  if(metaEl)metaEl.innerHTML=getCardMetaHtml(card);
}

function refreshModalPostedState(cardId){
  const found=getKanbanCard(cardId);
  if(!found)return;
  const card=found.card;
  const modalCheck=document.querySelector('.cdx-check-btn');
  if(modalCheck){
    modalCheck.classList.toggle('active',Boolean(card.posted));
    modalCheck.innerHTML=card.posted?iconCheck(13):iconCircle(13);
    if(card.posted){
      modalCheck.classList.remove('spark');
      void modalCheck.offsetWidth;
      modalCheck.classList.add('spark');
      setTimeout(()=>modalCheck.classList.remove('spark'),620);
    }
  }
  const postState=document.querySelector('.cdx-post-state');
  if(postState){
    postState.classList.toggle('active',Boolean(card.posted));
    postState.textContent=card.posted?'Sudah dipost':'Belum dipost';
  }
}

function renderKanban(){
  const board=document.getElementById('board');
  if(boardMotionTimer)clearTimeout(boardMotionTimer);
  document.body.classList.add('board-render-silent');
  board.innerHTML='';
  kanban.cols.forEach(col=>{
    const el=document.createElement('div');
    el.className='col';
    el.dataset.colId=col.id;
    el.innerHTML=`
      <div class="col-header" draggable="true">
        <span class="col-name">${esc(col.name)}</span>
        <div class="col-right">
          <span class="col-count">${col.cards.length}</span>
          <div class="col-actions">
            <button class="icon-btn" onclick="renameCol('${col.id}')" title="Rename">${iconEdit()}</button>
            <button class="icon-btn" onclick="deleteCol('${col.id}')" title="Delete">${iconTrash()}</button>
          </div>
        </div>
      </div>
      <div class="cards-list" id="list-${col.id}"></div>
      <button class="add-card-btn" onclick="openNewCard('${col.id}')">${iconPlus(12)} Add card</button>`;
    board.appendChild(el);

    const colHeader=el.querySelector('.col-header');
    colHeader.addEventListener('dragstart',event=>{
      if(dragCard||!canStartColumnDrag(event.target)){
        event.preventDefault();
        return;
      }
      dragCol=col.id;
      dragColOverId=null;
      dragColOverSide='after';
      board.classList.add('col-drag-active');
      document.body.classList.add('is-col-dragging');
      if(event.dataTransfer){
        event.dataTransfer.effectAllowed='move';
        event.dataTransfer.setData('text/plain',`col:${col.id}`);
        // Use entire column as drag ghost image
        event.dataTransfer.setDragImage(el, el.offsetWidth/2, 20);
      }
      requestAnimationFrame(()=>el.classList.add('col-dragging'));
    });

    el.addEventListener('dragover',event=>{
      if(dragCard&&!dragCol){
        event.preventDefault();
        event.stopPropagation();
        autoScrollDuringCardDrag(event);
        placeDraggedCardInList(el.querySelector('.cards-list'),event);
        if(event.dataTransfer)event.dataTransfer.dropEffect='move';
        return;
      }
      if(!dragCol||dragCard||dragCol===col.id)return;
      event.preventDefault();
      event.stopPropagation();
      const rect=el.getBoundingClientRect();
      const side=event.clientX<(rect.left+(rect.width/2))?'before':'after';
      dragColOverId=col.id;
      dragColOverSide=side;
      document.querySelectorAll('.col').forEach(colEl=>colEl.classList.remove('col-drop-before','col-drop-after'));
      el.classList.add(side==='before'?'col-drop-before':'col-drop-after');
      if(event.dataTransfer)event.dataTransfer.dropEffect='move';
    });

    el.addEventListener('drop',event=>{
      if(dragCard&&!dragCol){
        event.preventDefault();
        event.stopPropagation();
        placeDraggedCardInList(el.querySelector('.cards-list'),event);
        finishCardDrag(true);
        return;
      }
      if(!dragCol||dragCard)return;
      event.preventDefault();
      event.stopPropagation();
      const moved=dragColOverId&&dragColOverId!==dragCol
        ?moveColumn(dragCol,dragColOverId,dragColOverSide)
        :moveColumnByPointer(dragCol,event.clientX);
      clearColumnDragVisuals();
      resetColumnDragState();
      if(moved){
        saveLocalData();
        renderKanban();
      }else{
        renderKanban();
      }
    });

    colHeader.addEventListener('dragend',()=>{
      if(!dragCol)return;
      clearColumnDragVisuals();
      resetColumnDragState();
      renderKanban();
    });

    const list=el.querySelector('#list-'+col.id);
    col.cards.forEach(card=>{
      const descPreview=getCardDescPreview(card);
      const c=document.createElement('div');
      c.className='card';
      c.draggable=true;
      c.dataset.cardId=card.id;
      c.innerHTML=`
        ${card.img?`<img src="${card.img}" class="card-img" alt="">`:''}
        <div class="card-top-row">
          <button class="card-check-btn ${card.posted?'active':''}" onclick="event.stopPropagation();toggleCardPosted('${card.id}','${col.id}')" title="${card.posted?'Tandai belum selesai':'Tandai selesai'}">
            ${card.posted?iconCheck(12):iconCircle(14)}
          </button>
          <div class="card-title">${esc(card.title)}</div>
          <div class="card-more-wrap">
            <button class="card-more-btn" onclick="event.stopPropagation();toggleCardMenu(this,'${card.id}','${col.id}')" title="More">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
            </button>
            <div class="card-menu">
              <button onclick="event.stopPropagation();moveCardPrompt('${card.id}','${col.id}')">Move</button>
              <button onclick="event.stopPropagation();archiveCard('${card.id}','${col.id}')">Archive</button>
              <button onclick="event.stopPropagation();shareCard('${card.id}','${col.id}')">Share</button>
              <button class="danger" onclick="event.stopPropagation();deleteCardQuick('${card.id}','${col.id}')">Delete</button>
            </div>
          </div>
        </div>
        ${descPreview?`<div class="card-desc">${esc(descPreview)}</div>`:''}
        <div class="card-meta">
          ${getCardMetaHtml(card)}
        </div>`;
      if(card.posted)c.classList.add('card-done');
      // Detect image orientation and apply appropriate class
      if(card.img){
        const imgEl=c.querySelector('.card-img');
        if(imgEl){
          // Prevent image native drag from interfering with card drag
          imgEl.draggable=false;
          imgEl.addEventListener('load',function(){
            if(this.naturalWidth > this.naturalHeight * 1.3){
              this.classList.add('card-img-landscape');
            } else if(this.naturalHeight > this.naturalWidth * 1.2){
              // Portrait: wrap in container with blurred background
              const wrap=document.createElement('div');
              wrap.className='card-img-wrap';
              const blurImg=document.createElement('img');
              blurImg.className='card-img-blur';
              blurImg.src=this.src;
              blurImg.alt='';
              blurImg.draggable=false;
              this.parentNode.insertBefore(wrap,this);
              wrap.appendChild(blurImg);
              wrap.appendChild(this);
            }
          });
        }
      }
      c.addEventListener('dragstart',event=>{
        event.stopPropagation();
        document.querySelectorAll('.card-drag-landed').forEach(el=>el.classList.remove('card-drag-landed'));
        document.body.classList.add('is-card-dragging');
        dragCard=card.id;
        dragFromCol=col.id;
        dragStartClientX=event.clientX;
        dragStartClientY=event.clientY;
        dragCardOverCol=col.id;
        dragCardOverId=card.id;
        dragCardOverSide='after';
        if(event.dataTransfer){
          event.dataTransfer.effectAllowed='move';
          event.dataTransfer.setData('text/plain',`card:${card.id}`);
        }
        setTimeout(()=>c.classList.add('dragging'),0);
      });
      c.addEventListener('dragover',event=>{
        if(!dragCard||dragCol||dragCard===card.id)return;
        event.preventDefault();
        event.stopPropagation();
        autoScrollDuringCardDrag(event);
        const parentList=c.closest('.cards-list');
        if(parentList)placeDraggedCardInList(parentList,event);
        if(event.dataTransfer)event.dataTransfer.dropEffect='move';
      });
      c.addEventListener('drop',event=>{
        if(!dragCard||dragCol)return;
        event.preventDefault();
        event.stopPropagation();
        const parentList=c.closest('.cards-list');
        if(parentList)placeDraggedCardInList(parentList,event);
        finishCardDrag(true);
      });
      c.addEventListener('dragend',()=>{
        if(dragCard)finishCardDrag(true);
      });
      c.addEventListener('click',(event)=>{
        // If clicking on title being edited, check btn, or more menu, don't open modal
        if(event.target.closest('.card-title-edit')) return;
        if(event.target.closest('.card-check-btn')) return;
        if(event.target.closest('.card-more-wrap')) return;
        openCard(card.id,col.id);
      });
      // Inline edit title on double-click on title
      const titleEl=c.querySelector('.card-title');
      if(titleEl){
        titleEl.addEventListener('dblclick',(event)=>{
          event.stopPropagation();
          const input=document.createElement('input');
          input.type='text';
          input.className='card-title-edit';
          input.value=card.title;
          titleEl.replaceWith(input);
          input.focus();
          input.select();
          function save(){
            const val=input.value.trim();
            if(val&&val!==card.title){
              card.title=val;
              saveLocalData();
            }
            renderKanban();
          }
          input.addEventListener('blur',save);
          input.addEventListener('keydown',(e)=>{
            if(e.key==='Enter'){e.preventDefault();input.blur();}
            if(e.key==='Escape'){input.value=card.title;input.blur();}
          });
        });
      }
      list.appendChild(c);
    });

    list.addEventListener('dragover',e=>{
      if(!dragCard||dragCol)return;
      e.preventDefault();
      e.stopPropagation();
      autoScrollDuringCardDrag(e);
      placeDraggedCardInList(list,e);
      if(e.dataTransfer)e.dataTransfer.dropEffect='move';
    });
    list.addEventListener('dragleave',e=>{
      // Only remove if leaving the list entirely (not entering a child)
      if(!e.relatedTarget||!list.contains(e.relatedTarget)){
        list.classList.remove('drag-active');
      }
    });
    list.addEventListener('drop',e=>{
      if(!dragCard||dragCol)return;
      e.preventDefault();
      e.stopPropagation();
      placeDraggedCardInList(list,e);
      finishCardDrag(true);
    });
  });

  board.ondragover=event=>{
    if(dragCard&&!dragCol){
      event.preventDefault();
      autoScrollDuringCardDrag(event);
      if(event.dataTransfer)event.dataTransfer.dropEffect='move';
      return;
    }
    if(!dragCol||dragCard)return;
    event.preventDefault();
    if(!(event.target instanceof Element)||!event.target.closest('.col')){
      document.querySelectorAll('.col').forEach(colEl=>colEl.classList.remove('col-drop-before','col-drop-after'));
      dragColOverId=null;
      dragColOverSide='after';
    }
    if(event.dataTransfer)event.dataTransfer.dropEffect='move';
  };
  board.ondrop=event=>{
    if(dragCard&&!dragCol){
      event.preventDefault();
      finishCardDrag(true);
      return;
    }
    if(!dragCol||dragCard)return;
    event.preventDefault();
    const moved=dragColOverId&&dragColOverId!==dragCol
      ?moveColumn(dragCol,dragColOverId,dragColOverSide)
      :moveColumnByPointer(dragCol,event.clientX);
    clearColumnDragVisuals();
    resetColumnDragState();
    if(moved){
      saveLocalData();
      renderKanban();
    }else{
      renderKanban();
    }
  };

  const addColBtn=document.createElement('button');
  addColBtn.className='add-col-btn';
  addColBtn.innerHTML=`${iconPlus(13)} Add column`;
  addColBtn.onclick=openNewCol;
  board.appendChild(addColBtn);
  startDueTicker();
  boardMotionTimer=setTimeout(()=>{
    document.body.classList.remove('board-render-silent');
    boardMotionTimer=null;
  },240);
}

function openNewCard(colId){
  showModal(`
    <h3>New card</h3>
    <label>Title</label><input id="nc-title" placeholder="Tulis judul card..." autocomplete="off">
    <label>Cover image <span class="optional-note">(optional)</span></label>
    <div class="upload-area" onclick="document.getElementById('nc-file').click()" ondragenter="dropzoneDragEnter(event)" ondragover="dropzoneDragOver(event)" ondragleave="dropzoneDragLeave(event)" ondrop="dropzoneDropToInput(event,'nc-file')">
      ${iconUpload(18)} Upload gambar kalau ada
      <input type="file" id="nc-file" accept="image/*" style="display:none" onchange="previewImg(this,'nc-preview')">
    </div>
    <p class="upload-helper">Gambar boleh dikosongkan dulu, bisa ditambah nanti dari detail card.</p>
    <img id="nc-preview" class="upload-preview">
    <div class="modal-footer">
      <button class="btn-cancel" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="addCard('${colId}')">Add card</button>
    </div>`);
}

function addCard(colId){
  const title=document.getElementById('nc-title').value.trim();if(!title)return;
  const imgEl=document.getElementById('nc-preview');
  const img=imgEl&&imgEl.style.display!=='none'?imgEl.src:'';
  const col=kanban.cols.find(c=>c.id===colId);
  const attachments=img?[{id:uid(),name:'cover-image.png',url:img,addedAt:new Date().toISOString(),size:0}]:[];
  col.cards.unshift({
    id:uid(),
    title,
    desc:'',
    descHtml:'',
    due:'',
    dueTime:'',
    img,
    attachments,
    posted:false,
    createdAt:new Date().toISOString(),
    createdBy:currentUser&&currentUser.email?currentUser.email:'',
    comments:[]
  });
  saveLocalData();
  closeModal();
  renderKanban();
}

function openCard(cardId,colId,mediaIndex=0){
  const found=getKanbanCard(cardId);if(!found)return;
  const resolvedColId=colId||found.col.id;
  const card=found.card;
  if(activeMediaCardId!==cardId)descExpanded=false;
  if(!Array.isArray(card.attachments))card.attachments=[];
  const mediaItems=getCardMediaItems(card);
  const hasMedia=mediaItems.length>0;
  const mediaPaneVisible=hasMedia; // auto-show if has media, hide if empty
  const safeIndex=hasMedia?Math.max(0,Math.min(Number(mediaIndex)||0,mediaItems.length-1)):0;
  const activeMedia=hasMedia?mediaItems[safeIndex]:null;
  activeMediaCardId=cardId;
  activeMediaColId=resolvedColId;
  activeMediaIndex=safeIndex;
  activeMediaTotal=mediaItems.length;
  const attachmentsHtml=card.attachments.length?card.attachments.map(att=>`
    <div class="cdx-attach-item ${activeMedia&&(String(activeMedia.id)===String(att.id)||activeMedia.url===att.url)?'is-previewed':''}" draggable="true" data-attachment-id="${esc(att.id)}"
      ondragstart="startAttachmentDrag(event,'${cardId}','${att.id}')"
      ondragover="dragAttachmentOver(event,'${att.id}')"
      ondrop="dropAttachmentOn(event,'${cardId}','${att.id}')"
      ondragend="endAttachmentDrag()">
      <div class="cdx-attach-thumb-wrap" onclick="selectCardAttachmentPreview('${cardId}','${att.id}')">
        <img src="${att.url}" class="cdx-attach-thumb" alt="${esc(att.name)}" draggable="false">
      </div>
      <div class="cdx-attach-meta" onclick="selectCardAttachmentPreview('${cardId}','${att.id}')">
        <div class="cdx-attach-name-row">
          <div class="cdx-attach-name">${esc(att.name)}</div>
        </div>
        <div class="cdx-attach-sub">${formatAttachmentMeta(att)}</div>
      </div>
      <div class="cdx-attach-actions">
        ${att.url===card.img?`<span class="cdx-cover-badge">Cover</span>`:''}
        <button class="cdx-icon-action" title="Download" onclick="downloadCardAttachment('${cardId}','${att.id}')">${iconDownload(13)}</button>
        <div class="cdx-attach-menu-wrap">
          <button class="cdx-icon-action" title="More" onclick="toggleAttachmentMenu(event,'${att.id}')">${iconMore(14)}</button>
          <div class="cdx-attach-menu" id="att-menu-${att.id}">
            <button type="button" onclick="renameCardAttachment('${cardId}','${att.id}')">Edit</button>
            <button type="button" onclick="downloadCardAttachment('${cardId}','${att.id}')">Download</button>
            <button type="button" onclick="setCardCoverFromAttachment('${cardId}','${att.id}')">Make cover</button>
            <button type="button" class="danger" onclick="removeCardAttachment('${cardId}','${att.id}')">Remove</button>
          </div>
        </div>
      </div>
    </div>`).join(''):`<div class="cdx-empty-note">Belum ada attachment.</div>`;
  const dueLabel=formatDueLabel(card.due,card.dueTime);
  const dueStateClass=getDueStateClass(card);
  const dueStateLabel=getDueStateLabel(card);
  const descHtml=getCardDescHtml(card);
  // Layout: if has media → image left + content+comments right (classic)
  //         if no media  → content left + comments right (trello slim)
  if(hasMedia){
    // CLASSIC LAYOUT: left = image, right = content + comments
    showModal(`
      <div class="cdx-card-modal" ondragenter="dropzoneDragEnter(event)" ondragover="dropzoneDragOver(event)" ondragleave="dropzoneDragLeave(event)" ondrop="dropzoneDropToInput(event,'cd-files')">
        <section class="cdx-media-pane">
          <div class="cdx-media-frame"
            data-image-url="${esc(activeMedia.url)}"
            data-image-name="${esc(activeMedia.name)}"
            onclick="openImageViewerFromFrame(this)"
            ondragenter="dropzoneDragEnter(event)" ondragover="dropzoneDragOver(event)" ondragleave="dropzoneDragLeave(event)" ondrop="dropzoneDropToInput(event,'cd-file')">
            <div class="cdx-media-bg" style="background-image:url('${esc(activeMedia.url)}')"></div>
            <img src="${esc(activeMedia.url)}" class="cdx-media-image-main" alt="${esc(activeMedia.name)}">
          </div>
          <div class="cdx-media-nav-row ${mediaItems.length<2?'is-hidden':''}">
            <button class="cdx-media-nav-btn" type="button" onclick="cycleCardMedia('${cardId}','${resolvedColId}',-1)">${iconChevronLeft(15)} Prev</button>
            <div class="cdx-media-nav-count">${safeIndex+1} / ${mediaItems.length}</div>
            <button class="cdx-media-nav-btn" type="button" onclick="cycleCardMedia('${cardId}','${resolvedColId}',1)">Next ${iconChevronRight(15)}</button>
          </div>
          <input type="file" id="cd-file" accept="image/*" multiple style="display:none" onchange="changeCardImg('${cardId}',this)">
        </section>
        <section class="cdx-info-pane">
          <button class="cdx-close-btn" onclick="closeModal()" title="Close">×</button>
          <div class="cdx-title-row">
            <button type="button" class="cdx-check-btn ${card.posted?'active':''}" onclick="event.stopPropagation();toggleCardPosted('${cardId}')" title="Checklist posted">
              ${card.posted?iconCheck(13):iconCircle(13)}
            </button>
            <div class="cdx-title-wrap" id="cd-title-wrap">
              <h3 id="cd-title" spellcheck="true" onblur="saveCardTitleFromElement('${cardId}',this)" onpaste="pastePlainText(event)" onkeydown="handleCardTitleKeydown(event,'${cardId}')">${esc(card.title)}</h3>
            </div>
            <button type="button" class="cdx-inline-edit" onclick="editCardTitle('${cardId}')" title="Edit title">${iconEdit(14)}</button>
          </div>
          <div class="cdx-meta-grid cdx-meta-grid-date-only">
            <div class="cdx-meta-block">
              <div class="cdx-meta-label">Due date</div>
              <div class="cdx-due-controls">
                <div class="cdx-due-input-group">
                  <input type="date" id="cd-due" value="${card.due||''}" onchange="saveCardDueDate('${cardId}',this.value)">
                  <input type="time" id="cd-due-time" value="${card.dueTime||''}" onchange="saveCardDueTime('${cardId}',this.value)">
                  <span class="cdx-timezone-chip">WIB</span>
                </div>
                <span class="cdx-due-state ${dueStateClass}">${dueStateLabel}</span>
                <span class="cdx-post-state ${card.posted?'active':''}">${card.posted?'Sudah dipost':'Belum dipost'}</span>
              </div>
              <div class="cdx-due-hint">${dueLabel}</div>
            </div>
          </div>
          <div class="cdx-section">
            <div class="cdx-section-head"><span>${iconList(14)} Description</span>
              <div class="cdx-desc-actions">
                <span class="cdx-desc-status saved" id="cd-desc-status">Saved</span>
                <button class="cdx-text-btn" onclick="focusCardDescEditor()">Edit</button>
                <button class="cdx-text-btn cdx-save-btn" id="cd-desc-save" onclick="saveCardDesc('${cardId}',true)" disabled>Save</button>
              </div>
            </div>
            <div class="cdx-desc-toolbar">
              <button class="cdx-tool-btn" type="button" onclick="descExec('bold')" title="Bold"><strong>B</strong></button>
              <button class="cdx-tool-btn" type="button" onclick="descExec('italic')" title="Italic"><em>I</em></button>
              <button class="cdx-tool-btn" type="button" onclick="descExec('underline')" title="Underline"><u>U</u></button>
              <button class="cdx-tool-btn" type="button" onclick="descSetSize('small')" title="Teks kecil">A-</button>
              <button class="cdx-tool-btn" type="button" onclick="descSetSize('normal')" title="Teks normal">A</button>
              <button class="cdx-tool-btn" type="button" onclick="descSetSize('large')" title="Teks besar">A+</button>
              <button class="cdx-tool-btn" type="button" onclick="descExec('insertUnorderedList')" title="Bullet list">${iconListBullets(13)}</button>
              <button class="cdx-tool-btn" type="button" onclick="descExec('insertOrderedList')" title="Numbered list">${iconListNumbers(13)}</button>
              <button class="cdx-tool-btn" type="button" onclick="descAddLink()" title="Add link">${iconLink(13)}</button>
              <button class="cdx-tool-btn" type="button" onclick="descExec('removeFormat')" title="Clear format">${iconEraser(13)}</button>
            </div>
            <div class="cdx-desc-shell" id="cd-desc-shell">
              <div class="cdx-desc-editor" id="cd-desc-editor" contenteditable="true" spellcheck="true" oninput="handleCardDescInput('${cardId}')">${descHtml||'<p><br></p>'}</div>
              <div class="cdx-desc-fade" aria-hidden="true"></div>
            </div>
            <button class="cdx-desc-toggle" id="cd-desc-toggle" type="button" onclick="toggleCardDescExpand()">
              <span id="cd-desc-toggle-label">Show more</span>${iconChevronDown(14)}
            </button>
          </div>
          <div class="cdx-section">
            <div class="cdx-section-head"><span>${iconAttach(14)} Attachments</span>
              <div class="cdx-attach-head-actions">
                <button class="cdx-text-btn" onclick="downloadAllCardAttachments('${cardId}')" ${card.attachments.length?'':'disabled'}>Download all</button>
                <button class="cdx-text-btn" onclick="document.getElementById('cd-files').click()">Add</button>
              </div>
            </div>
            <input type="file" id="cd-files" accept="image/*" multiple style="display:none" onchange="addCardAttachment('${cardId}',this)">
            <div class="cdx-attachment-list" ondragenter="dropzoneDragEnter(event)" ondragover="handleAttachmentListDragOver(event)" ondragleave="handleAttachmentListDragLeave(event)" ondrop="handleAttachmentListDrop(event,'${cardId}')">
              ${attachmentsHtml}
            </div>
          </div>
          <div class="cdx-section cdx-comments-section">
            <div class="cdx-section-head"><span>${iconMsg(14)} Comments &amp; activity</span></div>
            <div class="cdx-comment-composer-inline">
              <textarea id="cd-comment-input" rows="2" placeholder="Tulis komentar..." onkeydown="handleCardCommentKeydown(event,'${cardId}')"></textarea>
              <button type="button" onclick="addCardComment('${cardId}')">Post</button>
            </div>
            <div class="cdx-comment-list" id="cd-comments-list">${getCardCommentsHtml(card)}</div>
          </div>
        </section>
      </div>`,'card-detail');
  } else {
    // TRELLO SLIM LAYOUT: left = content, right = comments (200px)
    showModal(`
      <div class="cdx-card-modal cdx-trello-layout" ondragenter="dropzoneDragEnter(event)" ondragover="dropzoneDragOver(event)" ondragleave="dropzoneDragLeave(event)" ondrop="dropzoneDropToInput(event,'cd-files')">
        <section class="cdx-main-pane">
          <div class="cdx-title-row">
            <button type="button" class="cdx-check-btn ${card.posted?'active':''}" onclick="event.stopPropagation();toggleCardPosted('${cardId}')" title="Checklist posted">
              ${card.posted?iconCheck(13):iconCircle(13)}
            </button>
            <div class="cdx-title-wrap" id="cd-title-wrap">
              <h3 id="cd-title" spellcheck="true" onblur="saveCardTitleFromElement('${cardId}',this)" onpaste="pastePlainText(event)" onkeydown="handleCardTitleKeydown(event,'${cardId}')">${esc(card.title)}</h3>
            </div>
            <button type="button" class="cdx-inline-edit" onclick="editCardTitle('${cardId}')" title="Edit title">${iconEdit(14)}</button>
          </div>
          <div class="cdx-meta-grid cdx-meta-grid-date-only">
            <div class="cdx-meta-block">
              <div class="cdx-meta-label">Due date</div>
              <div class="cdx-due-controls">
                <div class="cdx-due-input-group">
                  <input type="date" id="cd-due" value="${card.due||''}" onchange="saveCardDueDate('${cardId}',this.value)">
                  <input type="time" id="cd-due-time" value="${card.dueTime||''}" onchange="saveCardDueTime('${cardId}',this.value)">
                  <span class="cdx-timezone-chip">WIB</span>
                </div>
                <span class="cdx-due-state ${dueStateClass}">${dueStateLabel}</span>
                <span class="cdx-post-state ${card.posted?'active':''}">${card.posted?'Sudah dipost':'Belum dipost'}</span>
              </div>
              <div class="cdx-due-hint">${dueLabel}</div>
            </div>
          </div>
          <div class="cdx-section">
            <div class="cdx-section-head"><span>${iconList(14)} Description</span>
              <div class="cdx-desc-actions">
                <span class="cdx-desc-status saved" id="cd-desc-status">Saved</span>
                <button class="cdx-text-btn" onclick="focusCardDescEditor()">Edit</button>
                <button class="cdx-text-btn cdx-save-btn" id="cd-desc-save" onclick="saveCardDesc('${cardId}',true)" disabled>Save</button>
              </div>
            </div>
            <div class="cdx-desc-toolbar">
              <button class="cdx-tool-btn" type="button" onclick="descExec('bold')" title="Bold"><strong>B</strong></button>
              <button class="cdx-tool-btn" type="button" onclick="descExec('italic')" title="Italic"><em>I</em></button>
              <button class="cdx-tool-btn" type="button" onclick="descExec('underline')" title="Underline"><u>U</u></button>
              <button class="cdx-tool-btn" type="button" onclick="descSetSize('small')" title="Teks kecil">A-</button>
              <button class="cdx-tool-btn" type="button" onclick="descSetSize('normal')" title="Teks normal">A</button>
              <button class="cdx-tool-btn" type="button" onclick="descSetSize('large')" title="Teks besar">A+</button>
              <button class="cdx-tool-btn" type="button" onclick="descExec('insertUnorderedList')" title="Bullet list">${iconListBullets(13)}</button>
              <button class="cdx-tool-btn" type="button" onclick="descExec('insertOrderedList')" title="Numbered list">${iconListNumbers(13)}</button>
              <button class="cdx-tool-btn" type="button" onclick="descAddLink()" title="Add link">${iconLink(13)}</button>
              <button class="cdx-tool-btn" type="button" onclick="descExec('removeFormat')" title="Clear format">${iconEraser(13)}</button>
            </div>
            <div class="cdx-desc-shell" id="cd-desc-shell">
              <div class="cdx-desc-editor" id="cd-desc-editor" contenteditable="true" spellcheck="true" oninput="handleCardDescInput('${cardId}')">${descHtml||'<p><br></p>'}</div>
              <div class="cdx-desc-fade" aria-hidden="true"></div>
            </div>
            <button class="cdx-desc-toggle" id="cd-desc-toggle" type="button" onclick="toggleCardDescExpand()">
              <span id="cd-desc-toggle-label">Show more</span>${iconChevronDown(14)}
            </button>
          </div>
          <div class="cdx-section">
            <div class="cdx-section-head"><span>${iconAttach(14)} Attachments</span>
              <div class="cdx-attach-head-actions">
                <button class="cdx-text-btn" onclick="downloadAllCardAttachments('${cardId}')" ${card.attachments.length?'':'disabled'}>Download all</button>
                <button class="cdx-text-btn" onclick="document.getElementById('cd-files').click()">Add</button>
              </div>
            </div>
            <input type="file" id="cd-files" accept="image/*" multiple style="display:none" onchange="addCardAttachment('${cardId}',this)">
            <input type="file" id="cd-file" accept="image/*" multiple style="display:none" onchange="changeCardImg('${cardId}',this)">
            <div class="cdx-attachment-list" ondragenter="dropzoneDragEnter(event)" ondragover="handleAttachmentListDragOver(event)" ondragleave="handleAttachmentListDragLeave(event)" ondrop="handleAttachmentListDrop(event,'${cardId}')">
              ${attachmentsHtml}
            </div>
          </div>
        </section>
        <section class="cdx-side-pane" id="cdx-side-pane">
          <div class="cdx-resize-handle" id="cdx-resize-handle" title="Drag to resize"></div>
          <div class="cdx-side-topbar">
            <span class="cdx-side-title">${iconMsg(14)} Comments</span>
            <button class="cdx-close-btn" onclick="closeModal()" title="Close">×</button>
          </div>
          <div class="cdx-comment-composer" id="cdx-comment-composer">
            <div class="cdx-comment-collapsed" id="cdx-comment-collapsed" onclick="expandCommentInput('${cardId}')">
              Tulis komentar...
            </div>
            <div class="cdx-comment-expanded" id="cdx-comment-expanded" style="display:none">
              <div class="cdx-comment-toolbar">
                <button class="cdx-tool-btn" type="button" onclick="commentExec('bold')" title="Bold"><strong>B</strong></button>
                <button class="cdx-tool-btn" type="button" onclick="commentExec('italic')" title="Italic"><em>I</em></button>
                <button class="cdx-tool-btn" type="button" onclick="commentExec('underline')" title="Underline"><u>U</u></button>
                <button class="cdx-tool-btn" type="button" onclick="commentSetSize('small')" title="Teks kecil">A-</button>
                <button class="cdx-tool-btn" type="button" onclick="commentSetSize('normal')" title="Teks normal">A</button>
                <button class="cdx-tool-btn" type="button" onclick="commentSetSize('large')" title="Teks besar">A+</button>
                <button class="cdx-tool-btn" type="button" onclick="commentExec('insertUnorderedList')" title="Bullet list">${iconListBullets(13)}</button>
                <button class="cdx-tool-btn" type="button" onclick="commentExec('insertOrderedList')" title="Numbered list">${iconListNumbers(13)}</button>
                <button class="cdx-tool-btn" type="button" onclick="commentAddLink()" title="Add link">${iconLink(13)}</button>
                <button class="cdx-tool-btn" type="button" onclick="commentExec('removeFormat')" title="Clear format">${iconEraser(13)}</button>
              </div>
              <div class="cdx-comment-input" id="cd-comment-input" contenteditable="true" spellcheck="true" data-placeholder="Tulis komentar..."></div>
              <div class="cdx-comment-composer-bottom">
                <button type="button" class="cmt-post-btn" onclick="addCardComment('${cardId}')">Post</button>
                <button type="button" class="cmt-cancel-btn" onclick="collapseCommentInput()">Cancel</button>
              </div>
            </div>
          </div>
          <div class="cdx-comment-list" id="cd-comments-list">${getCardCommentsHtml(card)}</div>
        </section>
      </div>`,'card-detail');
  }
  setTimeout(()=>{
    initCardDescEditor(cardId);
    initCommentResize();
    initCommentInput(cardId);
  },30);
}

function getCardCommentsHtml(card){
  const comments=Array.isArray(card&&card.comments)?card.comments:[];
  // Build activity: created entry + comments
  const createdAt=card.createdAt||'';
  const createdBy=card.createdBy||'';
  const createdEntry=`
    <div class="cdx-activity-item">
      <div class="cdx-activity-avatar">${getInitials(createdBy)}</div>
      <div class="cdx-activity-body">
        <span class="cdx-activity-author">${createdBy?esc(getDisplayName(createdBy)):'You'}</span>
        <span class="cdx-activity-action"> membuat card ini</span>
        ${createdAt?`<div class="cdx-activity-time">${formatActivityTime(createdAt)}</div>`:''}
      </div>
    </div>`;
  if(!comments.length)return createdEntry+`<div class="cdx-comment-empty">Belum ada komentar.</div>`;
  const commentsHtml=comments.map((comment,idx)=>{
    const text=typeof comment==='object'?comment.text:String(comment||'');
    const time=typeof comment==='object'?comment.createdAt:'';
    const author=typeof comment==='object'?comment.author:'';
    return`
    <div class="cdx-comment-item">
      <div class="cdx-activity-avatar">${getInitials(author)}</div>
      <div class="cdx-activity-body">
        <span class="cdx-activity-author">${author?esc(getDisplayName(author)):'You'}</span>
        <div class="cdx-comment-body">${esc(text)}</div>
        <div class="cdx-comment-meta">
          ${time?`<span class="cdx-activity-time">${formatActivityTime(time)}</span>`:''}
          <button type="button" class="cdx-comment-remove" onclick="deleteCardComment('${card.id}',${idx})">remove</button>
        </div>
      </div>
    </div>`;
  }).join('');
  return createdEntry+commentsHtml;
}

function getInitials(email){
  if(!email)return'Y';
  const name=email.split('@')[0];
  const parts=name.split(/[._\-\s]+/);
  if(parts.length>=2)return(parts[0][0]+parts[1][0]).toUpperCase();
  return name.slice(0,2).toUpperCase();
}

function getDisplayName(email){
  if(!email)return'You';
  return email.split('@')[0].replace(/[._\-]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}

function formatActivityTime(iso){
  if(!iso)return'';
  const d=new Date(iso);
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const hh=String(d.getHours()).padStart(2,'0');
  const mm=String(d.getMinutes()).padStart(2,'0');
  return`${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

function getCardMediaItems(card){
  const items=[];
  if(card&&card.img){
    items.push({id:'cover',name:'Cover image',url:card.img,addedAt:new Date().toISOString(),size:0});
  }
  if(card&&Array.isArray(card.attachments)){
    card.attachments.forEach((att,idx)=>{
      if(!att||!att.url)return;
      if(items.some(item=>item.url===att.url))return;
      items.push({
        id:String(att.id||`att-${idx+1}`),
        name:att.name||`file-${idx+1}.png`,
        url:att.url,
        addedAt:att.addedAt||new Date().toISOString(),
        size:Number(att.size||0)
      });
    });
  }
  return items;
}

function renderCardMediaPreview(cardId,index=0){
  const found=getKanbanCard(cardId);if(!found)return;
  const items=getCardMediaItems(found.card);
  const hasMedia=items.length>0;
  const safeIndex=hasMedia?Math.max(0,Math.min(Number(index)||0,items.length-1)):0;
  const activeMedia=hasMedia?items[safeIndex]:null;
  activeMediaCardId=cardId;
  activeMediaColId=found.col.id;
  activeMediaIndex=safeIndex;
  activeMediaTotal=items.length;

  const frame=document.querySelector('.cdx-media-frame');
  if(frame){
    frame.dataset.imageUrl=activeMedia?activeMedia.url:'';
    frame.dataset.imageName=activeMedia?activeMedia.name:'';
    frame.innerHTML=activeMedia
      ?`
        <div class="cdx-media-bg" style="background-image:url('${esc(activeMedia.url)}')"></div>
        <img src="${esc(activeMedia.url)}" class="cdx-media-image-main" alt="${esc(activeMedia.name)}">
      `
      :`<div class="cdx-media-empty">${iconUpload(22)}<span>Belum ada visual</span></div>`;
  }

  const navRow=document.querySelector('.cdx-media-nav-row');
  if(navRow)navRow.classList.toggle('is-hidden',items.length<2);
  const countEl=document.querySelector('.cdx-media-nav-count');
  if(countEl)countEl.textContent=items.length?`${safeIndex+1} / ${items.length}`:'-';

  document.querySelectorAll('.cdx-attach-item').forEach(item=>{
    const attId=item.dataset?item.dataset.attachmentId:'';
    const att=(found.card.attachments||[]).find(entry=>entry&&String(entry.id)===String(attId));
    item.classList.toggle('is-previewed',Boolean(activeMedia&&att&&(String(activeMedia.id)===String(att.id)||activeMedia.url===att.url)));
  });
}

function cycleCardMedia(cardId,colId,currentIndexOrStep,stepValue){
  const found=getKanbanCard(cardId);if(!found)return;
  const items=getCardMediaItems(found.card);
  if(items.length<2)return;
  const step=stepValue===undefined?Number(currentIndexOrStep)||0:Number(stepValue)||0;
  const base=activeMediaCardId===cardId?activeMediaIndex:(Number(currentIndexOrStep)||0);
  const next=(base+step+items.length)%items.length;
  renderCardMediaPreview(cardId,next);
}

function isTypingTarget(target){
  if(!target||!(target instanceof Element))return false;
  const tag=(target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='textarea'||tag==='select'||tag==='button')return true;
  if(target.isContentEditable)return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}

function handleCardModalKeyNav(event){
  const viewer=document.getElementById('image-viewer-overlay');
  if(viewer){
    if(event.key==='Escape')closeImageViewer();
    if(event.key==='+'||event.key==='=')setImageViewerZoom(.2);
    if(event.key==='-')setImageViewerZoom(-.2);
    if(event.key==='0')resetImageViewerZoom();
    return;
  }
  if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
  const overlay=document.getElementById('modal-overlay');
  if(!overlay||!overlay.classList.contains('open'))return;
  if(!activeMediaCardId||activeMediaTotal<2)return;
  if(isTypingTarget(event.target))return;
  event.preventDefault();
  const step=event.key==='ArrowLeft'?-1:1;
  cycleCardMedia(activeMediaCardId,activeMediaColId,activeMediaIndex,step);
}

function openImageViewerFromFrame(frame){
  const url=frame&&frame.dataset?frame.dataset.imageUrl:'';
  const name=frame&&frame.dataset?frame.dataset.imageName:'';
  if(url){
    openImageViewer(url,name||'Image');
    return;
  }
  const input=document.getElementById('cd-file');
  if(input)input.click();
}

function openImageViewer(url,name='Image'){
  if(!url)return;
  closeImageViewer();
  imageViewerZoom=1.1;
  const overlay=document.createElement('div');
  overlay.className='image-viewer-overlay';
  overlay.id='image-viewer-overlay';
  overlay.innerHTML=`
    <div class="image-viewer-topbar">
      <div class="image-viewer-title">${esc(name)}</div>
      <div class="image-viewer-actions">
        <button type="button" onclick="setImageViewerZoom(-.2)" title="Zoom out">${iconMinus(14)}</button>
        <button type="button" id="image-viewer-reset" onclick="resetImageViewerZoom()" title="Reset zoom">${Math.round(imageViewerZoom*100)}%</button>
        <button type="button" onclick="setImageViewerZoom(.2)" title="Zoom in">${iconPlus(14)}</button>
        <button type="button" onclick="downloadImageViewer()" title="Download">${iconDownload(14)}</button>
        <button type="button" onclick="closeImageViewer()" title="Close">x</button>
      </div>
    </div>
    <div class="image-viewer-stage" onclick="if(event.target===this)closeImageViewer()">
      <img src="${esc(url)}" id="image-viewer-img" alt="${esc(name)}">
    </div>`;
  document.body.appendChild(overlay);
  applyImageViewerZoom();
  const stage=overlay.querySelector('.image-viewer-stage');
  stage.addEventListener('wheel',event=>{
    if(!(event.metaKey||event.ctrlKey))return;
    event.preventDefault();
    setImageViewerZoom(event.deltaY<0?.1:-.1);
  },{passive:false});
  requestAnimationFrame(()=>{
    stage.scrollTop=0;
    stage.scrollLeft=Math.max(0,(stage.scrollWidth-stage.clientWidth)/2);
  });
}

function closeImageViewer(){
  const viewer=document.getElementById('image-viewer-overlay');
  if(viewer)viewer.remove();
}

function setImageViewerZoom(delta){
  imageViewerZoom=Math.max(.35,Math.min(4,imageViewerZoom+delta));
  applyImageViewerZoom();
}

function applyImageViewerZoom(){
  const img=document.getElementById('image-viewer-img');
  if(img)img.style.width=`${Math.round(imageViewerBaseWidthVw*imageViewerZoom*10)/10}vw`;
  const resetBtn=document.getElementById('image-viewer-reset');
  if(resetBtn)resetBtn.textContent=`${Math.round(imageViewerZoom*100)}%`;
}

function resetImageViewerZoom(){
  imageViewerZoom=1;
  applyImageViewerZoom();
}

function downloadImageViewer(){
  const img=document.getElementById('image-viewer-img');
  const title=document.querySelector('.image-viewer-title');
  if(!img||!img.src)return;
  downloadUrl(img.src,(title&&title.textContent?title.textContent:'image.png'));
}

function selectCardAttachmentPreview(cardId,attId){
  const found=getKanbanCard(cardId);if(!found)return;
  const items=getCardMediaItems(found.card);
  const att=(found.card.attachments||[]).find(item=>item&&String(item.id)===String(attId));
  const index=items.findIndex(item=>String(item.id)===String(attId)||(att&&item.url===att.url));
  if(index<0)return;
  renderCardMediaPreview(cardId,index);
}

function formatDueLabel(due,dueTime=''){
  if(!due)return'No due date';
  const dateObj=getCardDueDateTime(due,dueTime)||new Date(`${due}T00:00:00`);
  if(Number.isNaN(dateObj.getTime()))return due;
  const dateText=dateObj.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  return dueTime?`${dateText} · ${dueTime} WIB`:dateText;
}

function getDueStateClass(cardOrDue,dueTime=''){
  const due=typeof cardOrDue==='object'&&cardOrDue?cardOrDue.due:cardOrDue;
  const time=typeof cardOrDue==='object'&&cardOrDue?cardOrDue.dueTime:dueTime;
  if(!due)return'none';
  const dateObj=getCardDueDateTime(cardOrDue,dueTime)||new Date(`${due}T00:00:00`);
  if(Number.isNaN(dateObj.getTime()))return'none';
  const now=new Date();
  if(time){
    if(dateObj<now)return'overdue';
    if(dateObj.toDateString()===now.toDateString())return'today';
    return'ok';
  }
  const dayNow=new Date(now);
  const dayTarget=new Date(dateObj);
  dayNow.setHours(0,0,0,0);
  dayTarget.setHours(0,0,0,0);
  if(dayTarget<dayNow)return'overdue';
  if(dayTarget.getTime()===dayNow.getTime())return'today';
  return'ok';
}

function getDueStateLabel(cardOrDue,dueTime=''){
  const state=getDueStateClass(cardOrDue,dueTime);
  if(state==='overdue')return'Overdue';
  if(state==='today')return'Today';
  if(state==='ok')return'On track';
  return'No date';
}

function formatAttachmentMeta(att){
  const date=att&&att.addedAt?new Date(att.addedAt):null;
  const datePart=date&&!Number.isNaN(date.getTime())
    ?date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
    :'Just now';
  if(!att||!att.size)return`Added ${datePart}`;
  const sizeMb=(Number(att.size)/1048576);
  const sizeText=sizeMb>=1?`${sizeMb.toFixed(1)} MB`:`${Math.max(1,Math.round(Number(att.size)/1024))} KB`;
  return`${sizeText} · ${datePart}`;
}

function saveCardField(cardId,field,val){
  const f=getKanbanCard(cardId);if(!f)return;
  f.card[field]=val;
  saveLocalData();
  renderKanban();
}

function saveCardDueDate(cardId,value){
  const f=getKanbanCard(cardId);if(!f)return;
  f.card.due=value||'';
  saveLocalData();
  refreshCardElement(cardId);
  refreshModalDueState(cardId);
}

function saveCardDueTime(cardId,value){
  const f=getKanbanCard(cardId);if(!f)return;
  f.card.dueTime=value||'';
  saveLocalData();
  refreshCardElement(cardId);
  refreshModalDueState(cardId);
}

function refreshModalDueState(cardId){
  const f=getKanbanCard(cardId);if(!f)return;
  const card=f.card;
  const dueState=document.querySelector('.cdx-due-state');
  if(dueState){
    dueState.className=`cdx-due-state ${getDueStateClass(card)}`;
    dueState.textContent=getDueStateLabel(card);
  }
  const dueHint=document.querySelector('.cdx-due-hint');
  if(dueHint)dueHint.textContent=formatDueLabel(card.due,card.dueTime);
}

function initCardDescEditor(cardId){
  const editor=document.getElementById('cd-desc-editor');
  if(!editor)return;
  activeDescEditorEl=editor;
  activeDescCardId=cardId;
  activeDescDirty=false;
  editor.dataset.cardId=cardId;
  editor.addEventListener('paste',handleCardDescPaste);
  setDescSaveState(false);
  requestAnimationFrame(()=>refreshDescOverflow(true));
}

function initCommentInput(cardId){
  const inp=document.getElementById('cd-comment-input');
  if(!inp||inp.tagName==='TEXTAREA')return;
  // Add keydown handler for Ctrl+Enter to post
  inp.addEventListener('keydown',(e)=>handleCardCommentKeydown(e,cardId));
  // Focus styles
  inp.addEventListener('focus',()=>inp.classList.add('focused'));
  inp.addEventListener('blur',()=>inp.classList.remove('focused'));
}

const COMMENT_PANEL_STORAGE_KEY='workboard-comment-panel-width';

function initCommentResize(){
  const handle=document.getElementById('cdx-resize-handle');
  const sidepane=document.getElementById('cdx-side-pane');
  const modal=sidepane&&sidepane.closest('.cdx-card-modal');
  if(!handle||!sidepane||!modal)return;

  // Restore saved width
  const savedWidth=parseInt(safeStorageGet(COMMENT_PANEL_STORAGE_KEY)||'0');
  if(savedWidth>=160&&savedWidth<=600){
    sidepane.style.width=savedWidth+'px';
    sidepane.style.maxWidth=savedWidth+'px';
    modal.style.gridTemplateColumns=`minmax(400px,1fr) ${savedWidth}px`;
  }

  let startX=0,startWidth=0,dragging=false;

  handle.addEventListener('mousedown',(e)=>{
    e.preventDefault();
    dragging=true;
    startX=e.clientX;
    startWidth=sidepane.offsetWidth;
    document.body.style.cursor='col-resize';
    document.body.style.userSelect='none';
  });

  document.addEventListener('mousemove',(e)=>{
    if(!dragging)return;
    const delta=startX-e.clientX; // dragging left = wider
    const newWidth=Math.max(160,Math.min(600,startWidth+delta));
    sidepane.style.width=newWidth+'px';
    sidepane.style.maxWidth=newWidth+'px';
    modal.style.gridTemplateColumns=`minmax(320px,1fr) ${newWidth}px`;
  });

  document.addEventListener('mouseup',()=>{
    if(!dragging)return;
    dragging=false;
    document.body.style.cursor='';
    document.body.style.userSelect='';
    safeStorageSet(COMMENT_PANEL_STORAGE_KEY,sidepane.offsetWidth);
  });
}

function setDescSaveState(isDirty,message=''){
  activeDescDirty=Boolean(isDirty);
  const saveBtn=document.getElementById('cd-desc-save');
  const status=document.getElementById('cd-desc-status');
  if(saveBtn)saveBtn.disabled=!activeDescDirty;
  if(status){
    status.textContent=message||(activeDescDirty?'Unsaved changes':'Saved');
    status.classList.toggle('dirty',activeDescDirty);
    status.classList.toggle('saved',!activeDescDirty);
  }
}

function markDescDirty(){
  setDescSaveState(true);
}

function focusCardDescEditor(){
  const editor=activeDescEditorEl||document.getElementById('cd-desc-editor');
  if(!editor)return;
  editor.focus();
  const sel=window.getSelection();
  if(!sel)return;
  const range=document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

function ensureDescEditorFocus(){
  const editor=activeDescEditorEl||document.getElementById('cd-desc-editor');
  if(!editor)return null;
  if(document.activeElement!==editor)editor.focus();
  activeDescEditorEl=editor;
  if(editor.dataset&&editor.dataset.cardId)activeDescCardId=editor.dataset.cardId;
  return editor;
}

function handleCardDescPaste(event){
  const editor=event.currentTarget;
  const cardId=editor&&editor.dataset?editor.dataset.cardId:activeDescCardId;
  const clipboard=event.clipboardData||window.clipboardData;
  if(!clipboard)return;
  const html=clipboard.getData('text/html');
  const text=clipboard.getData('text/plain');
  event.preventDefault();
  if(html){
    document.execCommand('insertHTML',false,sanitizeRichHtml(html));
  }else if(text){
    document.execCommand('insertText',false,text);
  }
  markDescDirty();
  requestAnimationFrame(()=>refreshDescOverflow(false));
}

function handleCardDescInput(cardId){
  if(cardId)activeDescCardId=cardId;
  markDescDirty();
  requestAnimationFrame(()=>refreshDescOverflow(false));
}

function normalizeDescEditorHtml(rawHtml){
  const template=document.createElement('template');
  template.innerHTML=String(rawHtml||'');
  template.content.querySelectorAll('font').forEach(fontNode=>{
    const sizeVal=Number(fontNode.getAttribute('size')||3);
    const span=document.createElement('span');
    const px=sizeVal<=2?'12px':sizeVal===3?'14px':sizeVal===4?'16px':sizeVal>=5?'20px':'14px';
    span.style.fontSize=px;
    span.innerHTML=fontNode.innerHTML;
    fontNode.replaceWith(span);
  });
  return template.innerHTML;
}

function descExec(command,value=''){
  const editor=ensureDescEditorFocus();
  if(!editor)return;
  document.execCommand(command,false,value);
  markDescDirty();
  requestAnimationFrame(()=>refreshDescOverflow(false));
}

function refreshDescOverflow(forceCollapse=false){
  const shell=document.getElementById('cd-desc-shell');
  const editor=document.getElementById('cd-desc-editor');
  const toggle=document.getElementById('cd-desc-toggle');
  const toggleLabel=document.getElementById('cd-desc-toggle-label');
  if(!shell||!editor||!toggle||!toggleLabel)return;

  if(forceCollapse)descExpanded=false;
  const overflowLimit=260;
  const hasOverflow=editor.scrollHeight>overflowLimit+8;

  if(!hasOverflow){
    shell.classList.remove('is-collapsed');
    toggle.classList.add('is-hidden');
    toggle.classList.remove('is-expanded');
    toggleLabel.textContent='Show more';
    return;
  }

  shell.classList.toggle('is-collapsed',!descExpanded);
  toggle.classList.remove('is-hidden');
  toggle.classList.toggle('is-expanded',descExpanded);
  toggleLabel.textContent=descExpanded?'Show less':'Show more';
}

function toggleCardDescExpand(){
  descExpanded=!descExpanded;
  refreshDescOverflow(false);
}

function descSetSize(mode){
  const map={small:'2',normal:'3',large:'5'};
  const size=map[mode]||'3';
  descExec('fontSize',size);
}

function descAddLink(){
  const editor=ensureDescEditorFocus();
  if(!editor)return;
  const url=prompt('Masukkan link (https://...)','https://');
  if(url===null)return;
  const cleanUrl=String(url).trim();
  if(!cleanUrl)return;
  descExec('createLink',cleanUrl);
}

function queueSaveCardDesc(cardId){
  if(!cardId)return;
  clearTimeout(descSaveTimer);
  descSaveTimer=setTimeout(()=>saveCardDesc(cardId),180);
}

function saveCardDesc(cardId,explicit=false){
  if(!cardId)return;
  const found=getKanbanCard(cardId);if(!found)return;
  const editor=document.getElementById('cd-desc-editor');
  if(!editor)return;
  const normalizedHtml=normalizeDescEditorHtml(editor.innerHTML||'');
  const safeHtml=sanitizeRichHtml(normalizedHtml);
  found.card.descHtml=safeHtml;
  found.card.desc=richHtmlToPlainText(safeHtml);
  saveLocalData();
  renderKanban();
  setDescSaveState(false,explicit?'Saved':'Saved');
  if(explicit)showToast('Description saved');
}

function editCardTitle(cardId){
  const f=getKanbanCard(cardId);if(!f)return;
  const title=document.getElementById('cd-title');if(!title)return;
  title.setAttribute('contenteditable','true');
  title.classList.add('is-editing');
  title.focus();
  const sel=window.getSelection();
  if(sel){
    const range=document.createRange();
    range.selectNodeContents(title);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

function pastePlainText(event){
  const text=(event.clipboardData||window.clipboardData).getData('text/plain');
  event.preventDefault();
  document.execCommand('insertText',false,text);
}

function handleCardTitleKeydown(event,cardId){
  if(event.key==='Escape'){
    event.preventDefault();
    const f=getKanbanCard(cardId);
    if(event.currentTarget&&f)event.currentTarget.textContent=f.card.title;
    event.currentTarget.blur();
  }
  if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){
    event.preventDefault();
    event.currentTarget.blur();
  }
}

function saveCardTitleFromElement(cardId,el){
  const f=getKanbanCard(cardId);if(!f||!el)return;
  const val=String(el.textContent||'').replace(/\s+\n/g,'\n').trim();
  el.removeAttribute('contenteditable');
  el.classList.remove('is-editing');
  if(!val){
    el.textContent=f.card.title;
    return;
  }
  if(val===f.card.title)return;
  f.card.title=val;
  el.textContent=val;
  saveLocalData();
  const cardTitle=document.querySelector(`.card[data-card-id="${cardId}"] .card-title`);
  if(cardTitle)cardTitle.textContent=val;
}

function saveCardTitle(cardId,val){
  const f=getKanbanCard(cardId);if(!f||!val.trim())return;
  f.card.title=val.trim();
  saveLocalData();
  renderKanban();
  setTimeout(()=>openCard(cardId,f.col.id),30);
}

function changeCardImg(cardId,input){
  const files=getImageFiles(input.files||[]);
  if(!files.length){
    input.value='';
    return;
  }
  const f=getKanbanCard(cardId);if(!f)return;
  if(!Array.isArray(f.card.attachments))f.card.attachments=[];

  const fileResults=new Array(files.length);
  let pending=files.length;
  files.forEach((file,index)=>{
    const reader=new FileReader();
    reader.onload=e=>{
      fileResults[index]={
        name:file.name||`image-${index+1}.png`,
        url:e.target.result,
        size:Number(file.size||0)
      };
      pending-=1;
      if(pending!==0)return;

      const firstValid=fileResults.find(item=>item&&item.url);
      if(firstValid)f.card.img=firstValid.url;
      fileResults.forEach(item=>{
        if(!item||!item.url)return;
        if(f.card.attachments.some(att=>att&&att.url===item.url))return;
        f.card.attachments.unshift({
          id:uid(),
          name:item.name,
          url:item.url,
          addedAt:new Date().toISOString(),
          size:item.size
        });
      });
      saveLocalData();
      renderKanban();
      setTimeout(()=>openCard(cardId,f.col.id,0),40);
    };
    reader.readAsDataURL(file);
  });
  input.value='';
}

function addCardAttachment(cardId,input){
  const files=Array.from(input.files||[]);
  if(!files.length)return;
  const found=getKanbanCard(cardId);if(!found)return;
  if(!Array.isArray(found.card.attachments))found.card.attachments=[];
  let pending=files.length;
  let firstUrl='';
  files.forEach((file,fileIdx)=>{
    const reader=new FileReader();
    reader.onload=e=>{
      const url=e.target.result;
      if(fileIdx===0)firstUrl=url;
      found.card.attachments.unshift({
        id:uid(),
        name:file.name||`attachment-${Date.now()}.png`,
        url,
        addedAt:new Date().toISOString(),
        size:Number(file.size||0)
      });
      pending-=1;
      if(pending===0){
        // Auto-set cover if card has no cover yet
        if(!found.card.img&&firstUrl){
          found.card.img=firstUrl;
        }
        saveLocalData();
        renderKanban();
        setTimeout(()=>openCard(cardId,found.col.id,0),40);
      }
    };
    reader.readAsDataURL(file);
  });
  input.value='';
}

function removeCardAttachment(cardId,attId){
  const found=getKanbanCard(cardId);if(!found)return;
  if(!Array.isArray(found.card.attachments))return;
  closeAttachmentMenus();
  const target=found.card.attachments.find(att=>att&&att.id===attId);
  found.card.attachments=found.card.attachments.filter(att=>att&&att.id!==attId);
  if(target&&found.card.img&&target.url===found.card.img){
    found.card.img='';
  }
  saveLocalData();
  renderKanban();
  setTimeout(()=>openCard(cardId,found.col.id,0),40);
}

function setCardCoverFromAttachment(cardId,attId){
  const found=getKanbanCard(cardId);if(!found)return;
  const att=(found.card.attachments||[]).find(item=>item&&item.id===attId);
  if(!att||!att.url)return;
  closeAttachmentMenus();
  found.card.img=att.url;
  saveLocalData();
  renderKanban();
  setTimeout(()=>openCard(cardId,found.col.id,0),40);
}

function renameCardAttachment(cardId,attId){
  const found=getKanbanCard(cardId);if(!found)return;
  if(!Array.isArray(found.card.attachments))return;
  const att=found.card.attachments.find(item=>item&&item.id===attId);
  if(!att)return;
  closeAttachmentMenus();
  const nextName=prompt('Ganti nama file',att.name||'');
  if(nextName===null)return;
  const cleanName=String(nextName).trim();
  if(!cleanName){
    showToast('Nama file tidak boleh kosong');
    return;
  }
  att.name=cleanName;
  saveLocalData();
  renderKanban();
  setTimeout(()=>openCard(cardId,found.col.id,0),40);
}

function closeAttachmentMenus(){
  document.querySelectorAll('.cdx-attach-menu.open').forEach(menu=>menu.classList.remove('open'));
}

function toggleAttachmentMenu(event,attId){
  event.preventDefault();
  event.stopPropagation();
  const menu=document.getElementById(`att-menu-${attId}`);
  if(!menu)return;
  const shouldOpen=!menu.classList.contains('open');
  closeAttachmentMenus();
  if(shouldOpen)menu.classList.add('open');
}

function downloadUrl(url,filename='download'){
  if(!url)return;
  const link=document.createElement('a');
  link.href=url;
  link.download=filename||'download';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadCardAttachment(cardId,attId){
  const found=getKanbanCard(cardId);if(!found)return;
  const att=(found.card.attachments||[]).find(item=>item&&item.id===attId);
  if(!att||!att.url)return;
  closeAttachmentMenus();
  downloadUrl(att.url,att.name||'attachment');
}

function sanitizeZipName(name,index=0){
  const fallback=`attachment-${index+1}.png`;
  return String(name||fallback).replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim()||fallback;
}

function crc32(bytes){
  if(!crc32.table){
    crc32.table=new Uint32Array(256);
    for(let i=0;i<256;i++){
      let c=i;
      for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);
      crc32.table[i]=c>>>0;
    }
  }
  let crc=0xffffffff;
  for(let i=0;i<bytes.length;i++){
    crc=crc32.table[(crc^bytes[i])&0xff]^(crc>>>8);
  }
  return(crc^0xffffffff)>>>0;
}

function writeUint16(arr,value){
  arr.push(value&255,(value>>>8)&255);
}

function writeUint32(arr,value){
  arr.push(value&255,(value>>>8)&255,(value>>>16)&255,(value>>>24)&255);
}

function dosDateTime(date=new Date()){
  const year=Math.max(1980,date.getFullYear());
  const dosTime=(date.getHours()<<11)|(date.getMinutes()<<5)|Math.floor(date.getSeconds()/2);
  const dosDate=((year-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate();
  return{dosTime,dosDate};
}

async function urlToBytes(url){
  const response=await fetch(url);
  const buffer=await response.arrayBuffer();
  return new Uint8Array(buffer);
}

function buildZip(files){
  const encoder=new TextEncoder();
  const chunks=[];
  const central=[];
  let offset=0;
  const {dosTime,dosDate}=dosDateTime();

  files.forEach(file=>{
    const nameBytes=encoder.encode(file.name);
    const data=file.bytes;
    const crc=crc32(data);
    const local=[];
    writeUint32(local,0x04034b50);
    writeUint16(local,20);
    writeUint16(local,0x0800);
    writeUint16(local,0);
    writeUint16(local,dosTime);
    writeUint16(local,dosDate);
    writeUint32(local,crc);
    writeUint32(local,data.length);
    writeUint32(local,data.length);
    writeUint16(local,nameBytes.length);
    writeUint16(local,0);
    chunks.push(new Uint8Array(local),nameBytes,data);

    const centralFile=[];
    writeUint32(centralFile,0x02014b50);
    writeUint16(centralFile,20);
    writeUint16(centralFile,20);
    writeUint16(centralFile,0x0800);
    writeUint16(centralFile,0);
    writeUint16(centralFile,dosTime);
    writeUint16(centralFile,dosDate);
    writeUint32(centralFile,crc);
    writeUint32(centralFile,data.length);
    writeUint32(centralFile,data.length);
    writeUint16(centralFile,nameBytes.length);
    writeUint16(centralFile,0);
    writeUint16(centralFile,0);
    writeUint16(centralFile,0);
    writeUint16(centralFile,0);
    writeUint32(centralFile,0);
    writeUint32(centralFile,offset);
    central.push(new Uint8Array(centralFile),nameBytes);
    offset+=local.length+nameBytes.length+data.length;
  });

  const centralSize=central.reduce((sum,item)=>sum+item.length,0);
  const end=[];
  writeUint32(end,0x06054b50);
  writeUint16(end,0);
  writeUint16(end,0);
  writeUint16(end,files.length);
  writeUint16(end,files.length);
  writeUint32(end,centralSize);
  writeUint32(end,offset);
  writeUint16(end,0);
  return new Blob([...chunks,...central,new Uint8Array(end)],{type:'application/zip'});
}

async function downloadAllCardAttachments(cardId){
  const found=getKanbanCard(cardId);if(!found)return;
  const attachments=(found.card.attachments||[]).filter(att=>att&&att.url);
  if(!attachments.length){
    showToast('Belum ada attachment');
    return;
  }
  closeAttachmentMenus();
  try{
    showToast('Menyiapkan ZIP...');
    const usedNames=new Set();
    const files=await Promise.all(attachments.map(async(att,index)=>{
      let name=sanitizeZipName(att.name,index);
      if(usedNames.has(name)){
        const dot=name.lastIndexOf('.');
        name=dot>0?`${name.slice(0,dot)}-${index+1}${name.slice(dot)}`:`${name}-${index+1}`;
      }
      usedNames.add(name);
      return{name,bytes:await urlToBytes(att.url)};
    }));
    const blob=buildZip(files);
    const url=URL.createObjectURL(blob);
    downloadUrl(url,`${sanitizeZipName(found.card.title||'attachments')}.zip`);
    setTimeout(()=>URL.revokeObjectURL(url),4000);
  }catch(err){
    console.warn('Download all gagal',err);
    showToast('Gagal bikin ZIP');
  }
}

function startAttachmentDrag(event,cardId,attId){
  if(event.target instanceof Element&&event.target.closest('button,.cdx-attach-menu')){
    event.preventDefault();
    return;
  }
  event.stopPropagation();
  dragAttachmentId=attId;
  dragAttachmentOverId=attId;
  const item=event.currentTarget;
  if(event.dataTransfer){
    event.dataTransfer.effectAllowed='move';
    event.dataTransfer.setData('text/plain',`attachment:${attId}`);
    if(typeof event.dataTransfer.setDragImage==='function'&&item){
      event.dataTransfer.setDragImage(item,28,Math.min(34,item.offsetHeight/2));
    }
  }
  if(item&&item.classList)item.classList.add('is-dragging');
}

function dragAttachmentOver(event,attId){
  if(!dragAttachmentId||dragAttachmentId===attId)return;
  event.preventDefault();
  event.stopPropagation();
  dragAttachmentOverId=attId;
  const item=event.currentTarget;
  const rect=item.getBoundingClientRect();
  const before=event.clientY<(rect.top+(rect.height/2));
  document.querySelectorAll('.cdx-attach-item').forEach(el=>el.classList.remove('attach-drop-before','attach-drop-after'));
  item.classList.add(before?'attach-drop-before':'attach-drop-after');
  item.dataset.dropSide=before?'before':'after';
  const draggedEl=document.querySelector(`.cdx-attach-item[data-attachment-id="${dragAttachmentId}"]`);
  if(draggedEl&&item.parentNode&&draggedEl!==item){
    item.parentNode.insertBefore(draggedEl,before?item:item.nextSibling);
  }
  if(event.dataTransfer)event.dataTransfer.dropEffect='move';
}

function dropAttachmentOn(event,cardId,attId){
  if(!dragAttachmentId)return;
  event.preventDefault();
  event.stopPropagation();
  syncAttachmentOrderFromDom(cardId);
  endAttachmentDrag();
}

function handleAttachmentListDragOver(event){
  if(dragAttachmentId){
    event.preventDefault();
    event.stopPropagation();
    const list=event.currentTarget;
    if(list&&list.classList)list.classList.add('attach-reorder-active');
    const draggedEl=document.querySelector(`.cdx-attach-item[data-attachment-id="${dragAttachmentId}"]`);
    if(draggedEl&&list&&list.contains(draggedEl)&&!(event.target instanceof Element&&event.target.closest('.cdx-attach-item'))){
      list.appendChild(draggedEl);
    }
    if(event.dataTransfer)event.dataTransfer.dropEffect='move';
    return;
  }
  dropzoneDragOver(event);
}

function handleAttachmentListDragLeave(event){
  if(dragAttachmentId){
    const list=event.currentTarget;
    if(list&&list.classList&&(!event.relatedTarget||!list.contains(event.relatedTarget))){
      list.classList.remove('attach-reorder-active');
    }
    return;
  }
  dropzoneDragLeave(event);
}

function handleAttachmentListDrop(event,cardId){
  if(dragAttachmentId){
    event.preventDefault();
    event.stopPropagation();
    syncAttachmentOrderFromDom(cardId);
    endAttachmentDrag();
    return;
  }
  dropzoneDropToInput(event,'cd-files');
}

function syncAttachmentOrderFromDom(cardId){
  const found=getKanbanCard(cardId);if(!found)return false;
  const listEl=document.querySelector('.cdx-attachment-list');
  if(!listEl)return false;
  const order=Array.from(listEl.querySelectorAll('.cdx-attach-item'))
    .map(item=>item.dataset?item.dataset.attachmentId:'')
    .filter(Boolean);
  const current=Array.isArray(found.card.attachments)?found.card.attachments:[];
  if(!order.length||!current.length)return false;
  const byId=new Map(current.map(att=>[att.id,att]));
  const ordered=order.map(id=>byId.get(id)).filter(Boolean);
  current.forEach(att=>{if(att&&!order.includes(att.id))ordered.push(att)});
  const changed=ordered.length===current.length&&ordered.some((att,idx)=>att.id!==current[idx].id);
  if(!changed)return false;
  found.card.attachments=ordered;
  saveLocalData();
  renderKanban();
  return true;
}

function endAttachmentDrag(){
  dragAttachmentId=null;
  dragAttachmentOverId=null;
  document.querySelectorAll('.cdx-attach-item').forEach(item=>{
    item.classList.remove('is-dragging','attach-drop-before','attach-drop-after');
    if(item.dataset)delete item.dataset.dropSide;
  });
  document.querySelectorAll('.cdx-attachment-list').forEach(list=>list.classList.remove('attach-reorder-active'));
}

function renderCardComments(cardId){
  const found=getKanbanCard(cardId);if(!found)return;
  const list=document.getElementById('cd-comments-list');
  if(list)list.innerHTML=getCardCommentsHtml(found.card);
  const count=document.getElementById('cd-comment-count');
  if(count)count.textContent=Array.isArray(found.card.comments)?found.card.comments.length:0;
  refreshCardElement(cardId);
}

function addCardComment(cardId){
  const inp=document.getElementById('cd-comment-input');
  if(!inp)return;
  // Support both contenteditable div and textarea
  const txt=inp.tagName==='TEXTAREA'?inp.value.trim():(inp.innerText||'').trim();
  if(!txt)return;
  const found=getKanbanCard(cardId);if(!found)return;
  if(!Array.isArray(found.card.comments))found.card.comments=[];
  found.card.comments.push({
    text:txt,
    createdAt:new Date().toISOString(),
    author:currentUser&&currentUser.email?currentUser.email:''
  });
  // Clear input
  if(inp.tagName==='TEXTAREA')inp.value='';
  else{inp.innerHTML='';inp.style.height='';}
  saveLocalData();
  renderCardComments(cardId);
  collapseCommentInput();
}

function commentExec(cmd){
  const inp=document.getElementById('cd-comment-input');
  if(inp)inp.focus();
  document.execCommand(cmd,false,null);
}

function expandCommentInput(cardId){
  const collapsed=document.getElementById('cdx-comment-collapsed');
  const expanded=document.getElementById('cdx-comment-expanded');
  if(!collapsed||!expanded)return;
  collapsed.style.display='none';
  expanded.style.display='flex';
  setTimeout(()=>{
    const inp=document.getElementById('cd-comment-input');
    if(inp)inp.focus();
  },30);
}

function collapseCommentInput(){
  const collapsed=document.getElementById('cdx-comment-collapsed');
  const expanded=document.getElementById('cdx-comment-expanded');
  const inp=document.getElementById('cd-comment-input');
  if(collapsed)collapsed.style.display='';
  if(expanded)expanded.style.display='none';
  if(inp){inp.innerHTML='';inp.style.height='';}
}

function deleteCardComment(cardId,idx){
  const found=getKanbanCard(cardId);if(!found)return;
  if(!Array.isArray(found.card.comments))found.card.comments=[];
  found.card.comments.splice(idx,1);
  saveLocalData();
  renderCardComments(cardId);
}

function handleCardCommentKeydown(event,cardId){
  // Ctrl/Cmd+Enter to post
  if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){
    event.preventDefault();
    addCardComment(cardId);
    return;
  }
  // For textarea: Enter posts, Shift+Enter newline
  const inp=document.getElementById('cd-comment-input');
  if(inp&&inp.tagName==='TEXTAREA'&&event.key==='Enter'&&!event.shiftKey){
    event.preventDefault();
    addCardComment(cardId);
  }
}

function addKanbanCmt(cardId){
  const inp=document.getElementById('cmt-inp-kb');
  const txt=inp?inp.value.trim():'';
  if(!txt)return;
  const f=getKanbanCard(cardId);if(!f)return;
  if(!Array.isArray(f.card.comments))f.card.comments=[];
  f.card.comments.push(txt);
  inp.value='';
  saveLocalData();
  renderKanban();
}

function delKanbanCmt(cardId,idx){
  const f=getKanbanCard(cardId);if(!f)return;
  if(!Array.isArray(f.card.comments))f.card.comments=[];
  f.card.comments.splice(idx,1);
  saveLocalData();
  renderKanban();
}

function deleteCard(cardId,colId){
  const col=kanban.cols.find(c=>c.id===colId);
  col.cards=col.cards.filter(c=>c.id!==cardId);
  saveLocalData();
  closeModal();
  renderKanban();
}

function toggleCardMediaPane(btn){
  const modal=btn.closest('.cdx-card-modal');
  if(!modal)return;
  const hidden=modal.classList.toggle('cdx-media-hidden');
  btn.title=hidden?'Tampilkan visual':'Sembunyikan visual';
  btn.classList.toggle('active',!hidden);
}

function toggleCardPosted(cardId,colId){  const found=getKanbanCard(cardId);
  if(!found)return;
  found.card.posted=!found.card.posted;
  saveLocalData();
  refreshCardElement(cardId);
  refreshModalPostedState(cardId);
}

function toggleCardMenu(btn,cardId,colId){
  // Close all other menus first
  document.querySelectorAll('.card-menu.open').forEach(m=>{
    if(m!==btn.nextElementSibling){
      m.classList.remove('open');
      const owner=m.closest('.card');
      if(owner)owner.classList.remove('menu-open');
    }
  });
  const menu=btn.nextElementSibling;
  const owner=btn.closest('.card');
  const willOpen=!menu.classList.contains('open');
  menu.classList.toggle('open',willOpen);
  if(owner)owner.classList.toggle('menu-open',willOpen);
  // Close on outside click
  setTimeout(()=>{
    function closeMenu(e){
      if(!menu.contains(e.target)&&e.target!==btn){
        menu.classList.remove('open');
        if(owner)owner.classList.remove('menu-open');
        document.removeEventListener('click',closeMenu);
      }
    }
    document.addEventListener('click',closeMenu);
  },10);
}

function deleteCardQuick(cardId,colId){
  if(!confirm('Hapus card ini?'))return;
  const col=kanban.cols.find(c=>c.id===colId);
  if(!col)return;
  col.cards=col.cards.filter(c=>c.id!==cardId);
  saveLocalData();
  renderKanban();
  showToast('Card dihapus');
}

function archiveCard(cardId,colId){
  const col=kanban.cols.find(c=>c.id===colId);
  if(!col)return;
  col.cards=col.cards.filter(c=>c.id!==cardId);
  saveLocalData();
  renderKanban();
  showToast('Card diarsipkan');
}

function shareCard(cardId,colId){
  const found=getKanbanCard(cardId);
  if(!found)return;
  const text=`${found.card.title}${found.card.due?' — Due: '+formatDueDate(found.card.due,found.card.dueTime):''}`;
  if(navigator.clipboard){
    navigator.clipboard.writeText(text).then(()=>showToast('Disalin ke clipboard'));
  }else{
    showToast(text);
  }
}

function moveCardPrompt(cardId,colId){
  const otherCols=kanban.cols.filter(c=>c.id!==colId);
  if(!otherCols.length){showToast('Tidak ada kolom lain');return;}
  let html=`<h3>Move card</h3><label>Pindah ke kolom</label><div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">`;
  otherCols.forEach(c=>{
    html+=`<button class="btn-primary" style="text-align:left" onclick="doMoveCard('${cardId}','${colId}','${c.id}')">${esc(c.name)}</button>`;
  });
  html+=`</div><div class="modal-footer"><button class="btn-cancel" onclick="closeModal()">Cancel</button></div>`;
  showModal(html);
}

function doMoveCard(cardId,fromColId,toColId){
  moveCardBetweenColumns(cardId,fromColId,toColId,'','after');
  saveLocalData();
  closeModal();
  renderKanban();
  showToast('Card dipindahkan');
}

function openNewCol(){
  showModal(`<h3>New column</h3><label>Nama kolom</label><input id="ncol-name" placeholder="e.g. Staging">
    <div class="modal-footer"><button class="btn-cancel" onclick="closeModal()">Cancel</button>
    <button class="btn-primary" onclick="addCol()">Add</button></div>`);
}

function addCol(){
  const name=document.getElementById('ncol-name').value.trim();if(!name)return;
  kanban.cols.push({id:uid(),name,cards:[]});
  saveLocalData();
  closeModal();
  renderKanban();
}

function renameCol(colId){
  const col=kanban.cols.find(c=>c.id===colId);
  showModal(`<h3>Rename column</h3><label>Nama baru</label><input id="rcol-name" value="${esc(col.name)}">
    <div class="modal-footer"><button class="btn-cancel" onclick="closeModal()">Cancel</button>
    <button class="btn-primary" onclick="doRenameCol('${colId}')">Save</button></div>`);
}

function doRenameCol(colId){
  const name=document.getElementById('rcol-name').value.trim();if(!name)return;
  const col=kanban.cols.find(c=>c.id===colId);
  col.name=name;
  saveLocalData();
  closeModal();
  renderKanban();
}

function deleteCol(colId){
  if(!confirm('Hapus kolom ini dan semua card-nya?'))return;
  kanban.cols=kanban.cols.filter(c=>c.id!==colId);
  saveLocalData();
  renderKanban();
}

function resetLocalData(){
  if(!confirm('Reset semua data user ini ke contoh awal?'))return;
  _id=1;
  kanban=createDefaultKanban();
  calEvents=createDefaultCalEvents();
  syncIdCounter();
  saveLocalData();
  renderKanban();
  renderCal();
  closeModal();
  showToast('Data direset');
}

/* ══════════════════════════════════════
   CALENDAR
══════════════════════════════════════ */
function dateKey(y,m,d){return`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
function prevMonth(){calMonth--;if(calMonth<0){calMonth=11;calYear--}renderCal()}
function nextMonth(){calMonth++;if(calMonth>11){calMonth=0;calYear++}renderCal()}
function goToday(){calYear=today.getFullYear();calMonth=today.getMonth();renderCal()}

function renderCal(){
  document.getElementById('nav-month-label').textContent=`${MONTHS[calMonth]} ${calYear}`;
  const grid=document.getElementById('cal-grid');
  grid.innerHTML='';
  const firstDay=new Date(calYear,calMonth,1).getDay();
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const daysInPrev=new Date(calYear,calMonth,0).getDate();
  const cells=[];
  for(let i=0;i<firstDay;i++)cells.push({day:daysInPrev-firstDay+1+i,cur:false,y:calYear,m:calMonth-1<0?11:calMonth-1});
  for(let d=1;d<=daysInMonth;d++)cells.push({day:d,cur:true,y:calYear,m:calMonth});
  while(cells.length%7!==0)cells.push({day:cells.length-firstDay-daysInMonth+1,cur:false,y:calYear,m:calMonth+1>11?0:calMonth+1});

  cells.forEach(cell=>{
    const key=dateKey(cell.y,cell.m,cell.day);
    const evs=calEvents[key]||[];
    const isToday=cell.cur&&cell.day===today.getDate()&&cell.y===today.getFullYear()&&cell.m===today.getMonth();
    const dow=new Date(cell.y,cell.m,cell.day).getDay();
    const el=document.createElement('div');
    el.className='date-cell'+(cell.cur?'':' other-month')+(isToday?' today':'')+(evs.length?' has-events':'')+(dow===0?' sun':'')+(dow===6?' sat':'');
    let pills='';
    evs.slice(0,2).forEach(ev=>{pills+=`<div class="event-pill" onclick="event.stopPropagation();openCalDay('${key}')">${esc(ev.title)}</div>`});
    if(evs.length>2)pills+=`<div class="more-badge">+${evs.length-2} more</div>`;
    el.innerHTML=`<div class="date-num">${cell.day}</div>${pills}`;
    el.addEventListener('click',()=>openCalDay(key));
    grid.appendChild(el);
  });
}

function openCalDay(key){
  const parts=key.split('-');
  const y=parseInt(parts[0],10),m=parseInt(parts[1],10)-1,d=parseInt(parts[2],10);
  const dayName=DAYS_FULL[new Date(y,m,d).getDay()];
  const evs=calEvents[key]||[];
  const evHtml=evs.length?evs.map(ev=>renderCalEvItem(ev,key)).join(''):`<div class="empty-state">Belum ada event hari ini</div>`;
  showModal(`
    <div class="cal-modal-header">
      <div><div class="cal-modal-title">${d} ${MONTHS[m]} ${y}</div><div class="cal-modal-sub">${dayName}</div></div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div id="cal-ev-list-${key}">${evHtml}</div>
    <div class="add-ev-section">
      <h4>Add event</h4>
      <div><label>Title</label><input id="cev-title" placeholder="Nama event..."></div>
      <div><label>Description</label><textarea id="cev-desc" placeholder="Detail..."></textarea></div>
      <div><label>Time</label><input type="time" id="cev-time"></div>
      <div><label>Image</label>
        <div class="upload-area" onclick="document.getElementById('cev-file').click()" ondragenter="dropzoneDragEnter(event)" ondragover="dropzoneDragOver(event)" ondragleave="dropzoneDragLeave(event)" ondrop="dropzoneDropToInput(event,'cev-file')">
          ${iconUpload(16)} Upload image
          <input type="file" id="cev-file" accept="image/*" style="display:none" onchange="previewImg(this,'cev-preview')">
        </div>
        <img id="cev-preview" class="upload-preview">
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="addCalEvent('${key}')">Add event</button>
      </div>
    </div>`);
}

function renderCalEvItem(ev,key){
  const cmts=(ev.comments||[]).map((c,i)=>`
    <div class="comment-item">${esc(c)}
      <div class="comment-meta"><span>Just now</span>
        <button class="cmt-del-btn" onclick="delCalCmt('${key}','${ev.id}',${i})">remove</button>
      </div>
    </div>`).join('');
  return`
    <div class="ev-item">
      <div class="ev-item-header">
        <div class="ev-item-title" id="evtitle-${ev.id}">${esc(ev.title)}</div>
        <div class="ev-item-actions">
          <button class="ev-btn" onclick="editCalEvTitle('${key}','${ev.id}')">${iconEdit(12)}</button>
          <button class="ev-btn" onclick="deleteCalEv('${key}','${ev.id}')">${iconTrash(12)}</button>
        </div>
      </div>
      ${ev.time?`<div class="ev-item-time">${iconClock(11)}${esc(ev.time)}</div>`:''}
      ${ev.desc?`<div class="ev-item-desc">${esc(ev.desc)}</div>`:''}
      ${ev.img?`<img src="${ev.img}" class="ev-detail-img" alt="">`:''}
      <div class="comment-list" id="cal-cmts-${ev.id}">${cmts}</div>
      <div class="cmt-row">
        <input id="cal-cmt-inp-${ev.id}" placeholder="Komentar..." onkeydown="if(event.key==='Enter')addCalCmt('${key}','${ev.id}')">
        <button class="cmt-post" onclick="addCalCmt('${key}','${ev.id}')">Post</button>
      </div>
    </div>`;
}

function addCalEvent(key){
  const title=document.getElementById('cev-title').value.trim();if(!title)return;
  const desc=document.getElementById('cev-desc').value.trim();
  const time=document.getElementById('cev-time').value;
  const imgEl=document.getElementById('cev-preview');
  const img=imgEl&&imgEl.style.display!=='none'?imgEl.src:'';
  if(!calEvents[key])calEvents[key]=[];
  calEvents[key].push({id:uid(),title,desc,time,img,comments:[]});
  saveLocalData();
  renderCal();
  openCalDay(key);
}

function deleteCalEv(key,evId){
  if(!calEvents[key])return;
  calEvents[key]=calEvents[key].filter(e=>e.id!==evId);
  if(!calEvents[key].length)delete calEvents[key];
  saveLocalData();
  renderCal();
  openCalDay(key);
}

function editCalEvTitle(key,evId){
  const el=document.getElementById('evtitle-'+evId);if(!el)return;
  const ev=(calEvents[key]||[]).find(e=>e.id===evId);if(!ev)return;
  el.outerHTML=`<input class="edit-title-input" style="font-size:13px" id="evtitle-edit-${evId}" value="${esc(ev.title)}"
    onblur="saveCalEvTitle('${key}','${evId}',this.value)" onkeydown="if(event.key==='Enter')this.blur()">`;
  document.getElementById('evtitle-edit-'+evId).focus();
}

function saveCalEvTitle(key,evId,val){
  const ev=(calEvents[key]||[]).find(e=>e.id===evId);
  if(ev&&val.trim()){
    ev.title=val.trim();
    saveLocalData();
  }
  renderCal();
  openCalDay(key);
}

function addCalCmt(key,evId){
  const inp=document.getElementById('cal-cmt-inp-'+evId);
  const txt=inp?inp.value.trim():'';
  if(!txt)return;
  const ev=(calEvents[key]||[]).find(e=>e.id===evId);if(!ev)return;
  if(!ev.comments)ev.comments=[];
  ev.comments.push(txt);
  inp.value='';
  saveLocalData();
  renderCal();
  openCalDay(key);
}

function delCalCmt(key,evId,idx){
  const ev=(calEvents[key]||[]).find(e=>e.id===evId);if(!ev)return;
  ev.comments.splice(idx,1);
  saveLocalData();
  renderCal();
  openCalDay(key);
}

/* ─────────────── SAMPLE DATA ─────────────── */
function createDefaultCalEvents(){
  const events={};
  const sk=dateKey(today.getFullYear(),today.getMonth(),today.getDate());
  events[sk]=[
    {id:uid(),title:'Weekly sync',desc:'Meeting semua divisi.',time:'09:00',img:'',comments:['Prepare deck dulu!']},
    {id:uid(),title:'Review design',desc:'Feedback dari stakeholder.',time:'14:00',img:'',comments:[]}
  ];
  const d2=new Date(today);
  d2.setDate(d2.getDate()+2);
  const sk2=dateKey(d2.getFullYear(),d2.getMonth(),d2.getDate());
  events[sk2]=[{id:uid(),title:'Deadline proposal',desc:'Submit ke manajemen.',time:'17:00',img:'',comments:[]}];
  return events;
}

/* ─────────────── SVG ICONS ─────────────── */
function iconEdit(s=14){return`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`}
function iconTrash(s=14){return`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`}
function iconPlus(s=14){return`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`}
function iconUpload(s=18){return`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="display:inline-block;vertical-align:-4px;margin-right:4px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`}
function iconCal(s=10){return`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`}
function iconMsg(s=10){return`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`}
function iconClock(s=11){return`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`}
function iconCheck(s=11){return`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" style="flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>`}
function iconCircle(s=11){return`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/></svg>`}
function iconChevronLeft(s=16){return`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="15 18 9 12 15 6"/></svg>`}
function iconChevronRight(s=16){return`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="9 18 15 12 9 6"/></svg>`}
function iconChevronDown(s=16){return`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="6 9 12 15 18 9"/></svg>`}
function iconMinus(s=14){return`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>`}
function iconList(s=14){return`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`}
function iconListBullets(s=14){return`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1.4"/><circle cx="4" cy="12" r="1.4"/><circle cx="4" cy="18" r="1.4"/></svg>`}
function iconListNumbers(s=14){return`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 7V5l-1 1"/><path d="M3 13h2l-2 2h2"/><path d="M3 17.5c0-.8.7-1.5 1.5-1.5S6 16.7 6 17.5 5.3 19 4.5 19"/></svg>`}
function iconLink(s=14){return`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 1 0-7.07-7.07L11 4"/><path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L13 19"/></svg>`}
function iconEraser(s=14){return`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 20H8"/><path d="M16 4 4.7 15.3a2.1 2.1 0 0 0 0 3l.9.9a2.1 2.1 0 0 0 3 0L20 8a2.1 2.1 0 0 0 0-3l-1-1a2.1 2.1 0 0 0-3 0Z"/></svg>`}
function iconAttach(s=14){return`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05 12.25 20.24a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.2a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`}
function iconImage(s=14){return`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`}
function iconDownload(s=14){return`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`}
function iconMore(s=14){return`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`}

/* ══════════════════════════════════════
   AUTH SYSTEM (localStorage)
══════════════════════════════════════ */
function switchAuthTab(tab){
  document.getElementById('tab-login').classList.toggle('active', tab==='login');
  document.getElementById('tab-register').classList.toggle('active', tab==='register');
  document.getElementById('form-login').classList.toggle('auth-form-hidden', tab!=='login');
  document.getElementById('form-register').classList.toggle('auth-form-hidden', tab!=='register');
  document.getElementById('login-msg').textContent='';
  document.getElementById('reg-msg').textContent='';
}

function getUsers(){
  try{ return JSON.parse(safeStorageGet('asm_users')||'{}'); }
  catch(e){ return {}; }
}

function saveUsers(users){
  safeStorageSet('asm_users', JSON.stringify(users));
}

function simpleHash(str){
  let hash=0;
  for(let i=0;i<str.length;i++){
    const c=str.charCodeAt(i);
    hash=((hash<<5)-hash)+c;
    hash|=0;
  }
  return 'h_'+Math.abs(hash).toString(36);
}

function handleRegister(e){
  e.preventDefault();
  const email=document.getElementById('reg-email').value.trim().toLowerCase();
  const pw=document.getElementById('reg-password').value;
  const pw2=document.getElementById('reg-password2').value;
  const msg=document.getElementById('reg-msg');

  if(!email||!pw){msg.textContent='Isi semua field.';msg.className='auth-msg';return;}
  if(pw.length<6){msg.textContent='Password minimal 6 karakter.';msg.className='auth-msg';return;}
  if(pw!==pw2){msg.textContent='Password tidak cocok.';msg.className='auth-msg';return;}

  const users=getUsers();
  if(users[email]){msg.textContent='Email sudah terdaftar.';msg.className='auth-msg';return;}

  users[email]={hash:simpleHash(pw),createdAt:new Date().toISOString()};
  saveUsers(users);

  msg.textContent='Berhasil daftar! Silakan login.';
  msg.className='auth-msg success';

  // Auto switch to login
  setTimeout(()=>{
    switchAuthTab('login');
    document.getElementById('login-email').value=email;
    document.getElementById('login-password').focus();
  },800);
}

function handleLogin(e){
  e.preventDefault();
  const email=document.getElementById('login-email').value.trim().toLowerCase();
  const pw=document.getElementById('login-password').value;
  const msg=document.getElementById('login-msg');

  if(!email||!pw){msg.textContent='Isi email dan password.';msg.className='auth-msg';return;}

  const users=getUsers();
  const user=users[email];
  if(!user){msg.textContent='Email belum terdaftar.';msg.className='auth-msg';return;}
  if(user.hash!==simpleHash(pw)){msg.textContent='Password salah.';msg.className='auth-msg';return;}

  // Login success
  safeStorageSet('asm_session',JSON.stringify({email}));
  currentUser={id:email,email};

  const gate=document.getElementById('landing-gate');
  if(gate)gate.style.display='none';
  showApp(true);
  showToast('Login berhasil — '+email);
  loadStateForUser().then(()=>{renderKanban();renderCal();});
}

function handleLogout(){
  safeStorageRemove('asm_session');
  window.location.href = 'index.html';
}

/* ══════════════════════════════════════
   RIPPLE BUTTON EFFECT
══════════════════════════════════════ */
document.addEventListener('click', function(e){
  const btn = e.target.closest('.auth-submit-btn, .tb-btn-strong');
  if(!btn) return;

  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size/2) + 'px';
  ripple.style.top = (e.clientY - rect.top - size/2) + 'px';
  btn.appendChild(ripple);

  ripple.addEventListener('animationend', ()=> ripple.remove());
});
