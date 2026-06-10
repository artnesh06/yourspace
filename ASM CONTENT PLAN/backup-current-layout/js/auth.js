/* ══════════════════════════════════════
   AUTH SYSTEM (localStorage)
══════════════════════════════════════ */
const asmMemoryStore = window.__asmMemoryStore || (window.__asmMemoryStore = {});

function safeStorageGet(key){
  try{
    const value = localStorage.getItem(key);
    return value === null ? (asmMemoryStore[key] || null) : value;
  }catch(_err){
    return asmMemoryStore[key] || null;
  }
}

function safeStorageSet(key,value){
  asmMemoryStore[key] = String(value);
  try{
    localStorage.setItem(key,value);
  }catch(_err){}
}

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

  // Login success — save session and redirect
  safeStorageSet('asm_session',JSON.stringify({email}));
  window.location.href = 'app.html';
}

/* Ripple effect */
document.addEventListener('click', function(e){
  const btn = e.target.closest('.auth-submit-btn');
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

/* Toast */
function showToast(message){
  const el=document.getElementById('toast');
  if(!el)return;
  el.textContent=message;
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),2500);
}
