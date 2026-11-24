// Appended to the account workspace script; all untrusted strings are rendered as text nodes.
export const adminCasesScript = String.raw`
const caseStates={open:'Açık',in_progress:'İnceleniyor',resolved:'Sonuçlandı'};
const percentage=new Intl.NumberFormat('tr-TR',{style:'percent',maximumFractionDigits:1});
function showDuelFunnel(data){
  const list=by('duel-funnel-steps');list.replaceChildren();
  if(data==='unavailable')return status('duel-funnel-status','Huni verileri alınamadı.',true);
  if(!data)return status('duel-funnel-status','Huni ölçümü etkin değil.');
  if(!data.registered)return status('duel-funnel-status','Henüz 7 günü dolmuş ölçüme katılan kayıt yok.');
  status('duel-funnel-status','Ölçüm başlangıcı: '+date(data.coverageStart)+'. Yüzdeler önceki adıma göredir.');
  const stages=[['Kayıt (ölçüme katılan)',data.registered],['Hızlı Düello seçildi',data.selected],
    ['Eşleşme bulundu',data.matched],['Aynı eşleşmede maç tamamlandı',data.completed]];
  stages.forEach(([label,value],i)=>{
    const tile=el('div'),previous=i?stages[i-1][1]:0;
    tile.append(el('dt',label),el('dd',num(value)+(i&&previous?' · '+percentage.format(value/previous):'')));
    if(i&&previous)tile.append(el('small',num(previous-value)+' oyuncu bu adıma geçmedi.'));
    list.append(tile);
  });
}
function showCohorts(data) {
  by('cohort-details').hidden=!data?.cohorts.length;
  by('cohort-summary').replaceChildren(); by('cohort-rows').replaceChildren();
  if (!data) {status('cohort-status','Kohort ölçümü alınamadı.',true);return;}
  status('cohort-status',data.cohorts.length ? 'İlk maç ilk yedi takvim gününü, D1 ve D7 ilgili günün tamamlanan maçlarını ölçer. Tamamlanmamış günler oranlara katılmaz.'
    : 'Ölçüm için yeterli kayıt ve maç geçmişi yok.');
  for(const [key,label] of [['firstMatch','Kayıt → ilk maç'],['d1','1. gün geri dönüş'],['d7','7. gün geri dönüş']]){
    const m=data[key],item=el('div');
    item.append(el('dt',label),el('dd',m.rate===null?'Yeterli veri yok':percentage.format(m.rate)+' · '+num(m.played)+' / '+num(m.signedUp)));
    by('cohort-summary').append(item);
  }
  for(const c of data.cohorts){
    const row=by('cohort-rows').insertRow();
    for(const value of [date(c.day),num(c.signups),...['firstMatch','d1','d7'].map(key=>c[key]===null?'Bekleniyor':num(c[key])+' · '+percentage.format(c[key]/c.signups))]){
      row.insertCell().textContent=value;
    }
  }
}
let casePage=1, caseEpoch=0, caseAccount=null, riskEpoch=0;
function caseField(form,label,control){const wrapper=el('label');wrapper.append(el('span',label),control);form.append(wrapper);}
function caseOption(value,label){const o=el('option',label);o.value=value;return o;}
function caseEmailStatus(value){
  return value==='accepted'?' E-posta OneSignal tarafından kabul edildi.':value==='failed'?' Yanıt uygulamada kayıtlı, ancak e-posta gönderimi doğrulanamadı.':'';
}
async function loadCases(target=1, message=''){
  const epoch=++caseEpoch;
  by('cases-prev').disabled=by('cases-next').disabled=true;
  by('cases-list').replaceChildren(); status('cases-status','Talepler yükleniyor.');
  try{
    const params=new URLSearchParams({queue:by('cases-state').value,owner:by('cases-owner').value,page:String(target)});
    if(caseAccount)params.set('account',caseAccount);
    const d=await read(api+'/cases?'+params);
    if(epoch!==caseEpoch)return;
    casePage=target;
    status('cases-status',[message,'İlk yanıt hedefi: '+d.targetHours+' saat',d.overdue===null?'':num(d.overdue)+' geciken',
      caseAccount?'Hesap: '+caseAccount:'',d.items.length?'Sayfa '+target+' · '+num(d.items.length)+' kayıt':'Bu filtrede talep yok.'].filter(Boolean).join(' · '));
    by('cases-prev').disabled=target<=1;by('cases-next').disabled=!d.more;
    for(const item of d.items){
      const row=el('li'),view=el('button','Hesabı aç');view.type='button';view.addEventListener('click',()=>openDetail(item.accountId));
      row.append(el('strong',item.subject),el('small',(item.bugReport?'Hata bildirimi':item.kind==='appeal'?'Moderasyon itirazı':'Destek')+' · '+caseStates[item.status]+' · '+timestamp(item.createdAt)+' · '+item.accountId),
        el('p',item.message,'case-copy'),el('small','Sorumlu: '+(item.assignee || 'Atanmamış')),view);
      if(item.attachments&&item.attachments.length){const files=el('div'),label=el('small','Ek dosyalar: ');files.append(label);for(const f of item.attachments){const link=el('a',f.name+' · '+Math.max(1,Math.round(f.size/1024))+' KB');link.href=api+'/cases/'+encodeURIComponent(item.id)+'/attachments/'+encodeURIComponent(f.id);link.target='_blank';link.rel='noopener noreferrer';files.append(link);}row.append(files);}
      if(item.waitingForPlayer)row.append(el('small','Oyuncu yanıtı bekleniyor'));
      if(item.late)row.append(el('small',item.firstReplyAt?'İlk yanıt hedefi aşıldı':'İlk yanıt gecikti'));
      if(item.moderationId)row.append(el('small','Moderasyon kaydı: '+item.moderationId));
      if(item.resolution)row.append(el('p','Oyuncuya yanıt: '+item.resolution,'case-copy'));
      row.append(caseConversation(item));
      const staff=d.staff.filter(s=>s.role==='owner'||s.role===(item.kind==='appeal'?'moderator':'support'));
      if(item.status!=='resolved' && item.canEdit && staff.length){
        const edit=el('details'),form=el('form',null,'ops-form');edit.append(el('summary','Ata veya durum değiştir'),form);
        const assignee=el('select');assignee.append(caseOption('','Atanmamış'),...staff.map(s=>caseOption(s.email,s.email)));
        assignee.value=staff.some(s=>s.email===item.assignee)?item.assignee:'';
        const next=el('select');for(const [value,label] of Object.entries(caseStates))next.append(caseOption(value,label));next.value=item.status;
        const reason=el('input');reason.required=true;reason.minLength=8;reason.maxLength=500;
        const answer=el('textarea');answer.minLength=8;answer.maxLength=1000;
        caseField(form,'Sorumlu',assignee);caseField(form,'Durum',next);caseField(form,'İç işlem gerekçesi',reason);caseField(form,'Oyuncuya gönderilecek yanıt',answer);
        function sync(){answer.required=next.value==='resolved';answer.parentElement.hidden=!answer.required;}
        next.addEventListener('change',sync);sync();
        const save=el('button','Talebi güncelle'),feedback=el('p');save.type='submit';feedback.setAttribute('role','status');form.append(save,feedback);
        form.addEventListener('submit',async e=>{
          e.preventDefault();
          if(next.value==='resolved'&&!confirm(item.bugReport?'Talebi sonuçlandırıp yanıtı oyuncuya e-posta ile de iletmek istiyor musunuz?':'Talebi sonuçlandırıp yanıtı oyuncuya göstermek istiyor musunuz?'))return;
          save.disabled=true;feedback.textContent='';
          try{const saved=await write('/cases/'+encodeURIComponent(item.id),{revision:item.revision,assignee:assignee.value||null,status:next.value,reason:reason.value,
            resolution:answer.required?answer.value:null});await loadCases(1,'Talep güncellendi.'+caseEmailStatus(saved.emailStatus));}
          catch(error){feedback.textContent=error.message;}finally{save.disabled=false;}
        });
        row.append(edit);
      }
      by('cases-list').append(row);
    }
  }catch(error){if(epoch===caseEpoch)status('cases-status',error.message,true);}
}
function caseConversation(item){
  const panel=el('details'),controls=el('div'),messages=el('div'),form=el('form',null,'ops-form');
  const endpoint='/cases/'+encodeURIComponent(item.id)+'/replies';
  const reload=el('button','Konuşmayı yenile'),feedback=el('p'),field=el('textarea'),action=el('select'),send=el('button','Mesajı gönder');
  panel.append(el('summary','Konuşmayı aç'),controls,messages,form,feedback);
  reload.type='button';controls.append(reload);feedback.setAttribute('role','status');
  field.required=true;field.minLength=3;field.maxLength=1200;
  action.append(caseOption('reply','Yanıt gönder'),caseOption('ask','Oyuncudan bilgi iste'));
  send.type='submit';caseField(form,'Mesaj türü',action);caseField(form,'Oyuncuya açık mesaj',field);form.append(send);form.hidden=true;
  let revision=item.revision,request=0;
  async function refresh(){
    const seq=++request;reload.disabled=send.disabled=true;
    try{
      const d=await read(api+endpoint);if(seq!==request)return;
      revision=d.revision;messages.replaceChildren();
      if(!d.items.length)messages.append(el('p','Henüz ek mesaj yok.'));
      for(const m of d.items)messages.append(el('small',(m.sender==='staff'?'Tavriko destek':'Oyuncu')+' · '+timestamp(m.createdAt)),
        el('p',m.body,'case-copy'));
      form.hidden=!item.canEdit||d.status==='resolved';feedback.textContent=d.waitingForPlayer?'Oyuncudan yanıt bekleniyor.':'';
    }catch(error){feedback.textContent=error.message;}
    finally{if(seq===request)reload.disabled=send.disabled=false;}
  }
  panel.addEventListener('toggle',()=>{if(panel.open)void refresh();});
  reload.addEventListener('click',refresh);
  form.addEventListener('submit',async e=>{
    e.preventDefault();reload.disabled=send.disabled=true;
    try{
      const ask=action.value==='ask',sent=await write(endpoint,{revision,body:field.value,ask});field.value='';
      if(revision===item.revision)item.revision=sent.revision;
      const queue=by('cases-state').value;
      if(queue==='overdue'||(ask&&queue==='active')||(!ask&&queue==='waiting')){
        await loadCases(casePage,(ask?'Mesaj gönderildi. Talep oyuncu yanıtını bekliyor.':'Mesaj gönderildi.')+caseEmailStatus(sent.emailStatus));by('cases-refresh').focus();
      }
      else{await refresh();feedback.textContent='Mesaj gönderildi.'+caseEmailStatus(sent.emailStatus)+' '+feedback.textContent;}
    }catch(error){feedback.textContent=error.message;}
    finally{reload.disabled=send.disabled=false;}
  });
  return panel;
}
by('cases-refresh').addEventListener('click',()=>loadCases(casePage));
for(const id of ['cases-state','cases-owner'])by(id).addEventListener('change',()=>loadCases(1));
by('cases-prev').addEventListener('click',()=>loadCases(casePage-1));by('cases-next').addEventListener('click',()=>loadCases(casePage+1));
by('cases-clear-account').addEventListener('click',()=>{caseAccount=null;by('cases-clear-account').hidden=true;loadCases(1);});
by('detail-cases').addEventListener('click',()=>{
  if(!current)return;caseAccount=current.id;dialog.close();by('cases-clear-account').hidden=false;
  by('cases-owner').value='all';by('cases-state').value='active';loadCases(1);by('cases-refresh').focus();
});
async function loadRisk(message=''){
  const epoch=++riskEpoch;status('risk-status','Uyarılar yükleniyor.');
  try{
    const d=await read(api+'/risk?queue='+encodeURIComponent(by('risk-state').value));if(epoch!==riskEpoch)return;
    by('risk-list').replaceChildren();
    status('risk-status',[message,d.items.length?num(d.items.length)+(d.more?'+':'')+' uyarı gösteriliyor.':'Bu durumda uyarı yok.'].filter(Boolean).join(' '));
    for(const item of d.items){
      const row=el('li');row.append(el('strong',item.actor),el('p',num(item.count)+' telafi · '+timestamp(item.createdAt)));
      const evidence=el('details'),records=el('div');evidence.append(el('summary','İlgili telafi kayıtları'),records);row.append(evidence);
      let loaded=false;
      evidence.addEventListener('toggle',async()=>{
        if(!evidence.open||loaded)return;
        loaded=true;records.textContent='Yükleniyor.';
        try{
          const grants=await read(api+'/risk/'+encodeURIComponent(item.id)+'/grants');
          records.replaceChildren();
          if(!grants.items.length)records.textContent='Bu zaman aralığında kayıt bulunamadı.';
          for(const grant of grants.items){
            const entry=el('p'),open=el('button',grant.accountId);open.type='button';open.addEventListener('click',()=>openDetail(grant.accountId));
            entry.append(document.createTextNode(timestamp(grant.createdAt)+' · '+num(grant.amount)+' '+kinds[grant.kind]+' · '+
              ({applied:'Uygulandı',pending:'Onay bekliyor',rejected:'Reddedildi'}[grant.status]||grant.status)+' '),open);records.append(entry);
          }
        }catch(error){records.textContent=error.message;loaded=false;}
      });
      if(item.reviewedAt){row.append(el('p',item.reason),el('small',item.reviewer+' · '+timestamp(item.reviewedAt)));}
      else if(item.actor!==access.actor){
        const form=el('form',null,'ops-form'),input=el('input'),button=el('button','İncelendi olarak işaretle'),feedback=el('p');
        input.required=true;input.minLength=8;input.maxLength=500;button.type='submit';feedback.setAttribute('role','status');
        caseField(form,'İnceleme gerekçesi',input);form.append(button,feedback);
        form.addEventListener('submit',async e=>{e.preventDefault();button.disabled=true;
          try{await write('/risk/'+encodeURIComponent(item.id),{reason:input.value});await loadRisk('İnceleme kaydedildi.');}
          catch(error){feedback.textContent=error.message;}finally{button.disabled=false;}});
        row.append(form);
      }else{row.append(el('small','Başka bir onaycı incelemeli.'));}
      by('risk-list').append(row);
    }
  }catch(error){if(epoch===riskEpoch){by('risk-list').replaceChildren();status('risk-status',error.message,true);}}
}
by('risk-refresh').addEventListener('click',()=>loadRisk());
by('risk-state').addEventListener('change',()=>loadRisk());
`;
