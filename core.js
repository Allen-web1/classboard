/* Browser / Node shared: no dependencies. */
(function(root){
  const enc = new TextEncoder();
  const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeName = s => String(s).replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/^\.+/,'_').slice(0,100) || '이름없음';
  const csv = rows => '\ufeff'+rows.map(r=>r.map(v=>{let s=String(v??''); if (/^[\s]*[=+@\-]/.test(s)) s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');
  async function proof(password,salt){const k=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);return Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:210000,hash:'SHA-256'},k,256))).map(x=>x.toString(16).padStart(2,'0')).join('');}
  const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++) n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
  function crc32(a){let c=0xffffffff; for(const n of a)c=crcTable[(c^n)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
  function zip(entries){let offset=0, local=[],central=[]; const make=n=>{const a=new Uint8Array(n);return[a,new DataView(a.buffer)];};
    for(const e of entries){const name=enc.encode(e.name),data=typeof e.data==='string'?enc.encode(e.data):e.data,crc=crc32(data);const [l,v]=make(30+name.length);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);l.set(name,30);local.push(l,data);
      const[c,w]=make(46+name.length);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint32(16,crc,true);w.setUint32(20,data.length,true);w.setUint32(24,data.length,true);w.setUint16(28,name.length,true);w.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=l.length+data.length;}
    const[e,v]=make(22);v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,central.reduce((s,x)=>s+x.length,0),true);v.setUint32(16,offset,true);return new Blob([...local,...central,e],{type:'application/zip'});
  }
  function uuid(){const a=new Uint8Array(16);crypto.getRandomValues(a);return Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');}
  function normalizeCode(value){if(typeof value!=='string')throw Error('입장 코드를 입력해주세요.');const code=value.trim().toUpperCase();if(!/^[A-Z0-9]{4,20}$/.test(code))throw Error('입장 코드는 영문·숫자 4~20자리로 설정해주세요.');return code;}
  function studentIdentity(no,name){if(typeof no!=='string'||!/^[0-9]{5}$/.test(no))throw Error('학번은 숫자 5자리로 입력해주세요.');if(typeof name!=='string'||!name.trim())throw Error('이름을 입력해주세요.');return {studentNo:no,studentName:name.trim()};}
  const api={escapeHtml,safeName,csv,proof,zip,crc32,uuid,normalizeCode,studentIdentity};if(typeof module!=='undefined')module.exports=api;root.BoardCore=api;
})(globalThis);
