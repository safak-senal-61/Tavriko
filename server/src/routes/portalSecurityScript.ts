export const passkeyBrowserScript = String.raw`
const securityApi='/api/portal/security';
const supportsPasskeys=()=>Boolean(window.isSecureContext && window.PublicKeyCredential &&
  PublicKeyCredential.parseCreationOptionsFromJSON && PublicKeyCredential.parseRequestOptionsFromJSON &&
  typeof PublicKeyCredential.prototype.toJSON==='function');
async function securityPost(path, body={}){
  const res=await fetch(securityApi+path,{method:'POST',credentials:'same-origin',cache:'no-store',
    headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error||'Güvenlik işlemi tamamlanamadı.');
  return data;
}
async function browserPasskey(mode){
  if(!supportsPasskeys())throw new Error('Bu tarayıcı geçiş anahtarını desteklemiyor.');
  const start=await securityPost('/passkeys/'+mode+'/start');
  const credential=mode==='register'
    ? await navigator.credentials.create({publicKey:PublicKeyCredential.parseCreationOptionsFromJSON(start.options)})
    : await navigator.credentials.get({publicKey:PublicKeyCredential.parseRequestOptionsFromJSON(start.options)});
  if(!credential)throw new Error('Geçiş anahtarı işlemi tamamlanmadı.');
  return await securityPost('/passkeys/'+mode+'/finish',{id:start.id,response:credential.toJSON()});
}
`;

export const staffSecurityScript = passkeyBrowserScript + String.raw`
const sessionMethods={password:'Şifre',totp:'Şifre + doğrulama kodu',passkey:'Geçiş anahtarı'};
let staffSequence=0;
async function loadStaffSecurity(){
  const sequence=++staffSequence;
  status('staff-status','Oturumlar yükleniyor.');
  try{
    const scope=by('staff-scope').value;
    const d=await read(securityApi+'/sessions?scope='+scope);
    if(sequence!==staffSequence)return;
    const list=by('staff-sessions');list.replaceChildren();
    status('staff-status',d.items.length?num(d.items.length)+(d.more?'+':'')+' aktif oturum.':'Aktif oturum bulunamadı.');
    for(const item of d.items){
      const row=el('li'),current=item.id===d.current;
      row.append(el('strong',item.device+(current?' · Bu oturum':'')),
        el('small',(scope==='team'?item.email+' · ':'')+sessionMethods[item.method]+' · '+timestamp(item.createdAt)),
        el('small','Oturum sonu: '+timestamp(item.expiresAt)));
      if(!current){
        const revoke=el('button','Oturumu kapat');revoke.type='button';
        revoke.addEventListener('click',async()=>{
          if(!confirm('Bu cihazın yönetim paneli oturumunu kapatmak istiyor musunuz?'))return;
          revoke.disabled=true;
          try{await securityPost('/sessions/'+encodeURIComponent(item.id)+'/revoke');await loadStaffSecurity();}
          catch(error){status('staff-status',error.message,true);if(sequence===staffSequence)revoke.disabled=false;}
        });
        row.append(revoke);
      }
      list.append(row);
    }
    const keyPanel=by('staff-keys');keyPanel.hidden=!d.keysEnabled;
    if(d.keysEnabled){
      const keys=await read(securityApi+'/passkeys');if(sequence!==staffSequence)return;
      const keyList=by('staff-key-list');keyList.replaceChildren();
      by('staff-enroll').disabled=!d.canEnroll||!supportsPasskeys()||keys.items.length>=10;
      status('staff-key-status',!supportsPasskeys()?'Bu tarayıcı geçiş anahtarını desteklemiyor.':
        !d.canEnroll?'Anahtar eklemek veya kaldırmak için şifre ve doğrulama koduyla yeniden giriş yapın.':
        keys.items.length?'Geçiş anahtarları bu panel adresiyle sınırlıdır.':'Henüz geçiş anahtarınız yok.');
      for(const key of keys.items){
        const row=el('li'),remove=el('button','Anahtarı kaldır');
        row.append(el('strong','Geçiş anahtarı'),el('small',timestamp(key.createdAt)),remove);
        remove.type='button';remove.disabled=!d.canEnroll;
        remove.addEventListener('click',async()=>{
          if(!confirm('Anahtar ve bu anahtarla açılan oturumlar kapatılsın mı?'))return;
          remove.disabled=true;
          try{await securityPost('/passkeys/remove',{id:key.id});await loadStaffSecurity();}
          catch(error){status('staff-key-status',error.message,true);remove.disabled=false;}
        });
        keyList.append(row);
      }
    }
  }catch(error){if(sequence===staffSequence)status('staff-status',error.message,true);}
}
by('staff-refresh').addEventListener('click',loadStaffSecurity);
by('staff-scope').addEventListener('change',loadStaffSecurity);
by('staff-enroll').addEventListener('click',async function(){
  this.disabled=true;
  try{await browserPasskey('register');await loadStaffSecurity();status('staff-key-status','Geçiş anahtarı kaydedildi.');}
  catch(error){status('staff-key-status',error.name==='NotAllowedError'?'Anahtar isteği iptal edildi.':error.message,true);this.disabled=false;}
});
`;
