'use strict';
const C=BoardCore, cfg=window.CLASSBOARD_CONFIG||{}, $=s=>document.querySelector(s), esc=C.escapeHtml;
const demo=!cfg.bridgeUrl;
async function passwordProof(password,salt){if(!demo||crypto.subtle)return C.proof(password,salt);let h=2166136261;for(const c of password+salt)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(16).padStart(8,'0').repeat(8);}
let actor=null, classroom=null, classes=[], posts=[], sectionId='', search='', pageToken='', busy=false;
const app=$('#app'), dialog=$('#modal');
const appName = cfg.appName || "인천고잔고등학교 JH's padlet";
$('#brandName').textContent = appName;
document.title = appName;
function toast(s){$('#toast').textContent=s;$('#toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.display='none',5000);}
function errorText(e){return e.message||String(e);}
function modal(title,html){$('#modalContent').innerHTML=`<div class="modal-head"><h2 id="modalTitle">${esc(title)}</h2><button class="close" aria-label="닫기">×</button></div>${html}`;$('#modalContent .close').onclick=()=>{if(!busy)dialog.close();};dialog.showModal();}
dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
async function guard(fn,button){if(busy)return;busy=true;if(button)button.disabled=true;try{await fn();}catch(e){toast(errorText(e));const x=$('#formError');if(x)x.textContent=errorText(e);}finally{busy=false;if(button)button.disabled=false;}}
function banner(){return demo?'<div class="demo-banner">연결 전 체험 모드 · 이 브라우저에만 저장됩니다. 실제 학생 자료는 서버 연결 후 사용하세요.</div>':'';}
function date(t){return new Date(t).toLocaleString('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});}
function ctx(){return actor?.teacher?{teacherToken:actor.token}:{sessionToken:actor?.token};}
let peer=null,peerOrigin='',bridgePromise=null,channel='',pending=new Map();
function bridge(){if(bridgePromise)return bridgePromise;bridgePromise=new Promise((resolve,reject)=>{channel=C.uuid();const u=new URL(cfg.bridgeUrl);if(u.origin!=='https://script.google.com'||!u.pathname.endsWith('/exec'))return reject(Error('Apps Script 배포 URL을 확인해주세요.'));u.searchParams.set('channel',channel);const frame=document.createElement('iframe');frame.hidden=true;frame.title='파일 저장 연결';const timeout=setTimeout(()=>{reject(Error('서버 연결을 확인해주세요. Apps Script 공개 범위와 WEB_ORIGIN 설정을 확인하세요.'));bridgePromise=null;frame.remove();},30000);const ready=e=>{if(e.data?.type!=='board-ready'||e.data.channel!==channel||!/^https:\/\/[a-zA-Z0-9-]+\.googleusercontent\.com$/.test(e.origin))return;peer=e.source;peerOrigin=e.origin;clearTimeout(timeout);window.removeEventListener('message',ready);resolve();};window.addEventListener('message',ready);frame.src=u.href;document.body.append(frame);});return bridgePromise;}
window.addEventListener('message',e=>{if(e.source!==peer||e.origin!==peerOrigin||e.data?.channel!==channel||e.data.type!=='board-response')return;const item=pending.get(e.data.id);if(!item)return;clearTimeout(item.timer);pending.delete(e.data.id);e.data.result?.ok?item.resolve(e.data.result.data):item.reject(Error(e.data.result?.error||'요청에 실패했습니다.'));});
async function rpc(action,payload={}){const p={...ctx(),classId:classroom?.id,...payload};if(demo)return Demo.call(action,p);await bridge();const id=C.uuid();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('응답이 지연됩니다. 저장 여부를 새로고침으로 확인한 뒤 다시 시도해주세요.'));},180000);pending.set(id,{resolve,reject,timer});peer.postMessage({type:'board-request',channel,id,action,payload:p},peerOrigin);});}
function entry() {
  actor = null;
  classroom = null;
  search = '';
  sessionStorage.removeItem('board-student');
  $('#roleButton').textContent = '교사 입장';
  $('#roleButton').onclick = teacherLogin;
  app.innerHTML = `<div class="entry">
    <section class="entry-content" aria-labelledby="entryTitle">
      ${banner()}
      <h1 id="entryTitle">학급 게시판<br>입장하기</h1>
      <p class="entry-instruction">선생님이 알려준 학급 코드와 학번, 이름을 입력하세요.</p>
      <form id="entryForm">
        <div class="field">
          <label for="code">학급 입장 코드</label>
          <input id="code" class="code-input" maxlength="20" minlength="4" pattern="[A-Za-z0-9]{4,20}"
            placeholder="학급 코드 입력" autocomplete="off" autocapitalize="characters" required ${demo?'value="DEMO2026"':''}>
        </div>
        <div class="row entry-identity">
          <div class="field">
            <label for="studentNo">학번</label>
            <input id="studentNo" type="text" inputmode="numeric" pattern="[0-9]{5}" minlength="5" maxlength="5"
              title="학번은 숫자 5자리로 입력해주세요." placeholder="예: 10101" required>
          </div>
          <div class="field">
            <label for="studentName">이름</label>
            <input id="studentName" type="text" autocomplete="name" placeholder="예: 김하늘" required>
          </div>
        </div>
        <p id="formError" class="status-error" role="alert"></p>
        <button class="button primary full entry-submit" type="submit">학급 입장 <span aria-hidden="true">→</span></button>
      </form>
    </section>
    <div class="entry-visual">
      <img src="classroom-hero.webp" alt="" fetchpriority="high" width="1200" height="1000">
    </div>
  </div>`;
  $('#entryForm').onsubmit = e => {
    e.preventDefault();
    guard(async () => {
      const code = C.normalizeCode($('#code').value.trim());
      const identity = C.studentIdentity($('#studentNo').value.trim(), $('#studentName').value.trim());
      const r = await rpc('join', {code, ...identity});
      actor = {token:r.token, studentNo:r.studentNo, studentName:r.studentName};
      classroom = r.classroom;
      sectionId = '';
      await loadBoard();
    }, e.submitter);
  };
}
function teacherLogin(){if(actor)return;modal('교사 입장',`${demo?'<div class="demo-banner">교사 화면을 체험합니다. 실제 교사 계정은 연결 후 사용할 수 있습니다.</div><button id="demoTeacher" class="button full">교사 화면 체험하기</button>':`<form id="teacherForm"><div class="field"><label for="email">교사 이메일</label><input type="email" id="email" required autocomplete="username"></div><div class="field"><label for="teacherPassword">비밀번호</label><input type="password" id="teacherPassword" required autocomplete="current-password"></div><p id="formError" class="status-error" role="alert"></p><button type="submit" class="button full">로그인</button></form>`}`);if(demo){$('#demoTeacher').onclick=()=>guard(async()=>{actor={teacher:true,token:'demo-teacher'};dialog.close();await teacherHome();},$('#demoTeacher'));return;}$('#teacherForm').onsubmit=e=>{e.preventDefault();guard(async()=>{if(!cfg.firebaseApiKey)throw Error('config.js에 Firebase 웹 API 키를 입력해주세요.');const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+encodeURIComponent(cfg.firebaseApiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('#email').value,password:$('#teacherPassword').value,returnSecureToken:true})});const data=await r.json();if(!r.ok)throw Error('이메일과 비밀번호 또는 Firebase 로그인 설정을 확인해주세요.');actor={teacher:true,token:data.idToken};try{classes=await rpc('classes');}catch(e){actor=null;throw e;}dialog.close();await teacherHome(true);},e.submitter);};}
function roleHeader(){ $('#roleButton').textContent='나가기';$('#roleButton').onclick=()=>{if(confirm('게시판에서 나갈까요?'))entry();};}
async function teacherHome(loaded = false) {
  classroom = null;
  roleHeader();
  if (!loaded) classes = await rpc('classes');

  const activityCount = classes.reduce((total, group) => total + group.sections.length, 0);
  const cards = classes.map(group => {
    const activityNames = group.sections.map(section => `<span class="activity-chip">${esc(section.name)}</span>`).join('');
    return `<button class="class-card" data-class="${esc(group.id)}" type="button">
      <span class="class-symbol" aria-hidden="true">▤</span>
      <span class="class-info">
        <strong class="class-name">${esc(group.name)}</strong>
        <span class="class-activities">${activityNames || '<span class="muted">활동 항목 없음</span>'}</span>
      </span>
      <span class="class-meta">
        <span class="badge ${group.entryClosed?'badge-neutral':'badge-blue'}">${group.entryClosed?'입장 마감':'입장 가능'}</span>
        <span class="class-code-wrap"><span class="muted">입장 코드</span><span class="class-code">${esc(group.code)}</span></span>
      </span>
      <span class="class-arrow" aria-hidden="true">→</span>
    </button>`;
  }).join('');

  app.innerHTML = `<div class="workspace teacher-home">
    ${banner()}
    <div class="workspace-head">
      <div>
        <h1>학급 관리</h1>
        <p class="workspace-summary">학급 ${classes.length}개 <span aria-hidden="true">·</span> 활동 ${activityCount}개</p>
      </div>
      <button id="newClass" class="button" type="button"><span aria-hidden="true">＋</span> 학급 만들기</button>
    </div>
    <section class="class-list" aria-label="학급 목록">
      ${cards || '<div class="empty"><h2>만들어진 학급이 없어요</h2><p>학급을 만들고 입장 코드를 설정하세요.</p></div>'}
    </section>
  </div>`;
  $('#newClass').onclick = createClassModal;
  document.querySelectorAll('[data-class]').forEach(button => {
    button.onclick = () => guard(async () => {
      classroom = classes.find(group => group.id === button.dataset.class);
      sectionId = '';
      search = '';
      await loadBoard();
    }, button);
  });
}
function createClassModal(){modal('학급 만들기',`<form id="createClassForm"><div class="field"><label for="className">학급 이름</label><input id="className" maxlength="50" placeholder="예: 1학년 1반" required></div><div class="field"><label for="classCode">학급 입장 코드</label><input id="classCode" class="code-input" maxlength="20" minlength="4" pattern="[A-Za-z0-9]{4,20}" placeholder="예: SCIENCE101" required autocomplete="off"><p class="help">원하는 영문·숫자 4~20자리로 설정하세요. 영문은 대소문자를 구분하지 않으며, 다른 학급과 같은 코드는 사용할 수 없습니다.</p></div><p id="formError" class="status-error" role="alert"></p><div class="actions"><button class="button" type="submit">학급 만들기</button></div></form>`);$('#createClassForm').onsubmit=e=>{e.preventDefault();guard(async()=>{const code=C.normalizeCode($('#classCode').value);classroom=await rpc('createClass',{name:$('#className').value.trim(),code});sectionId='';dialog.close();await loadBoard();},e.submitter);};}
function nameModal(title,label,placeholder,fn){modal(title,`<form id="nameForm"><label for="newName">${label}</label><input id="newName" maxlength="40" placeholder="${placeholder}" required><p id="formError" class="status-error" role="alert"></p><div class="actions"><button class="button" type="submit">만들기</button></div></form>`);$('#nameForm').onsubmit=e=>{e.preventDefault();guard(async()=>{await fn($('#newName').value.trim());dialog.close();},e.submitter);};}
async function loadBoard(){roleHeader();classroom=await rpc('class');const r=await rpc('posts');posts=r.items;pageToken=r.nextPageToken;renderBoard();}
function visiblePosts(){return posts.filter(p=>(!sectionId||p.sectionId===sectionId)&&(!search||[p.title,p.body,p.studentNo,p.studentName].join(' ').toLowerCase().includes(search.toLowerCase()))).sort((a,b)=>b.createdAt-a.createdAt);}
function bodyHtml(s){return esc(s).replace(/https?:\/\/[^\s<>]+/g,url=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);}
function renderBoard() {
  const teacher = !!actor.teacher;
  const current = classroom.sections.find(section => section.id === sectionId);
  if (!current) sectionId = '';
  const canWrite = classroom.sections.length > 0 && (teacher || !classroom.writeClosed);
  const sectionButton = (id, name, count) => `<button class="navitem ${sectionId===id?'active':''}" type="button"
    data-section="${esc(id)}" aria-pressed="${sectionId===id}"><span class="nav-label">${esc(name)}</span><span class="nav-count">${count}</span></button>`;

  app.innerHTML = `<div class="workspace board-workspace">
    ${banner()}
    <div class="board-head">
      <div class="board-heading">
        ${teacher?'<button class="back-button" id="home" type="button">← 학급 목록</button>':''}
        <h1>${esc(classroom.name)}</h1>
        <p class="workspace-summary">${teacher?'학급 게시판 관리':esc(actor.studentNo)+' '+esc(actor.studentName)}
          ${classroom.writeClosed?'<span class="badge badge-neutral">작성 마감</span>':''}
        </p>
      </div>
      <div class="board-actions">
        ${teacher?`<button class="button subtle" id="settings" type="button">학급 설정</button>
          <button class="button light" id="export" type="button">↓ 일괄 다운로드</button>`:''}
        <button class="button primary write-button" id="write" type="button" ${canWrite?'':'disabled'}>
          <span aria-hidden="true">＋</span> 글쓰기
        </button>
      </div>
    </div>
    <div class="layout">
      <aside class="sidebar" aria-label="활동 항목">
        <h2 class="side-title">활동 항목</h2>
        <nav class="activity-nav" aria-label="게시글 보기">
          ${sectionButton('', '전체 게시글', posts.length)}
          ${classroom.sections.map(section => sectionButton(
            section.id, section.name, posts.filter(post => post.sectionId === section.id).length
          )).join('')}
        </nav>
        ${teacher?`<div class="section-actions">
          <button class="button subtle" id="addSection" type="button">＋ 항목 만들기</button>
          <button class="button subtle" id="manageSections" type="button">항목 편집·삭제</button>
        </div>
        <div class="side-info">
          <span class="muted">학급 입장 코드</span>
          <strong class="class-code">${esc(classroom.code)}</strong>
          <button class="button light small" id="copyCode" type="button">코드 복사</button>
        </div>`:''}
      </aside>
      <section class="board-panel" aria-labelledby="boardTitle">
        <div class="board-toolbar">
          <div class="board-title-wrap">
            <h2 id="boardTitle">${esc(current?.name || '전체 게시글')}</h2>
            <span class="muted" id="resultCount"></span>
          </div>
          <div class="board-filters">
            <input class="search" type="search" id="search" placeholder="제목·내용·작성자 검색" aria-label="게시글 검색" value="${esc(search)}">
            <button class="button subtle small" id="refresh" type="button"><span aria-hidden="true">↻</span> 새로고침</button>
          </div>
        </div>
        <div class="board-stream" id="postGrid"></div>
        ${pageToken?'<button class="button subtle full more-button" id="more" type="button">게시글 더 불러오기</button><p class="help">검색·항목별 개수는 현재 불러온 글 기준입니다.</p>':''}
      </section>
    </div>
  </div>`;
  renderPosts();

  document.querySelectorAll('[data-section]').forEach(button => {
    button.onclick = () => {
      sectionId = button.dataset.section;
      renderBoard();
      [...document.querySelectorAll('[data-section]')].find(item => item.dataset.section === sectionId)?.focus();
    };
  });
  $('#search').oninput = e => { search = e.target.value; renderPosts(); };
  $('#refresh').onclick = e => guard(async () => {
    classroom = await rpc('class');
    await loadBoard();
    toast('게시글을 새로 불러왔습니다.');
  }, e.currentTarget);
  $('#write').onclick = () => composer();
  if ($('#more')) $('#more').onclick = e => guard(async () => {
    const r = await rpc('posts', {pageToken});
    posts.push(...r.items);
    pageToken = r.nextPageToken;
    renderBoard();
  }, e.currentTarget);
  if (teacher) {
    $('#home').onclick = () => guard(() => teacherHome());
    $('#addSection').onclick = () => nameModal('활동 항목 만들기','항목 이름','예: 실험 결과 공유',async name => {
      classroom = await rpc('createSection', {name});
      renderBoard();
    });
    $('#manageSections').onclick = manageSections;
    $('#settings').onclick = settings;
    $('#export').onclick = exportModal;
    $('#copyCode').onclick = () => copy(classroom.code);
  }
}

function postCard(post) {
  const attachments = post.files.map(file => `<button class="attachment" type="button" data-file="${esc(file.id)}" data-post="${esc(post.id)}">
    <span class="attachment-icon" aria-hidden="true">${/^image\//.test(file.mime)?'▧':'▤'}</span>
    <span class="attachment-name">${esc(file.name)}</span><span class="muted">${(file.size/1024).toFixed(0)}KB</span>
  </button>`).join('');
  return `<article class="post">
    <div class="post-content">
      <header class="post-top">
        <span class="avatar" aria-hidden="true">${esc(post.studentName.slice(-2))}</span>
        <div class="post-byline">
          <span class="post-author">${esc(post.studentName)} <span class="muted">${esc(post.studentNo)}</span></span>
          <span class="muted">${date(post.createdAt)}</span>
        </div>
        <button class="iconbtn post-edit" type="button" data-edit="${esc(post.id)}">수정·삭제</button>
      </header>
      <h3>${esc(post.title)}</h3>
      <div class="post-body">${bodyHtml(post.body)}</div>
      ${attachments?'<div class="attachments">'+attachments+'</div>':''}
    </div>
    <footer class="post-foot">
      <button class="iconbtn reaction" type="button" data-like="${esc(post.id)}" aria-label="좋아요 ${post.likes.length}개"><span aria-hidden="true">♡</span> ${post.likes.length}</button>
      <button class="iconbtn reaction" type="button" data-comments="${esc(post.id)}">댓글 ${post.commentCount}</button>
    </footer>
  </article>`;
}

function renderPosts() {
  const items = visiblePosts();
  const container = $('#postGrid');
  $('#resultCount').textContent = items.length + '개';

  if (!items.length) {
    let title = '아직 게시글이 없어요';
    let message = '글쓰기로 첫 게시글을 올려보세요.';
    if (search.trim()) {
      title = '검색 결과가 없어요';
      message = '다른 검색어를 입력해보세요.';
    } else if (!classroom.sections.length) {
      title = '아직 활동 항목이 없어요';
      message = actor.teacher?'‘항목 만들기’로 수업 활동을 추가하세요.':'선생님이 활동 항목을 준비하고 있어요.';
    } else if (classroom.writeClosed && !actor.teacher) {
      message = '이 학급의 글쓰기가 마감되었습니다.';
    }
    container.innerHTML = `<div class="empty"><h3>${title}</h3><p>${message}</p></div>`;
    return;
  }

  if (sectionId) {
    container.innerHTML = '<div class="board-grid">'+items.map(postCard).join('')+'</div>';
  } else {
    const grouped = new Map();
    for (const post of items) {
      if (!grouped.has(post.sectionId)) grouped.set(post.sectionId, []);
      grouped.get(post.sectionId).push(post);
    }
    const sections = classroom.sections.filter(section => grouped.has(section.id));
    const knownIds = new Set(sections.map(section => section.id));
    for (const id of grouped.keys()) {
      if (!knownIds.has(id)) sections.push({id, name:'기타 게시글'});
    }
    container.innerHTML = sections.map(section => {
      const group = grouped.get(section.id);
      return `<section class="post-group">
        <div class="group-head"><h3>${esc(section.name)}</h3><span class="badge badge-blue">${group.length}개</span></div>
        <div class="board-grid">${group.map(postCard).join('')}</div>
      </section>`;
    }).join('');
  }

  container.querySelectorAll('[data-file]').forEach(button => {
    button.onclick = () => guard(() => openFile(button.dataset.post, button.dataset.file), button);
  });
  container.querySelectorAll('[data-like]').forEach(button => {
    button.onclick = () => guard(async () => {
      const post = await rpc('like', {postId:button.dataset.like});
      posts = posts.map(item => item.id === post.id ? post : item);
      renderPosts();
      [...container.querySelectorAll('[data-like]')].find(item => item.dataset.like === post.id)?.focus();
    }, button);
  });
  container.querySelectorAll('[data-comments]').forEach(button => {
    button.onclick = () => guard(() => comments(button.dataset.comments), button);
  });
  container.querySelectorAll('[data-edit]').forEach(button => {
    button.onclick = () => editGate(posts.find(post => post.id === button.dataset.edit));
  });
}
async function copy(s){try{await navigator.clipboard.writeText(s);toast('입장 코드를 복사했습니다.');}catch(_){toast('입장 코드: '+s);}}
function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function from64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
async function openFile(postId,fileId){const f=await rpc('file',{postId,fileId});const bytes=from64(f.base64);if(/^image\/(jpeg|png|gif|webp)$/.test(f.mime)){const url=URL.createObjectURL(new Blob([bytes],{type:f.mime}));modal(f.name,`<img class="full" id="previewImage" alt="첨부 사진 미리보기"><div class="actions"><button class="button" id="downloadImage">다운로드</button></div>`);$('#previewImage').src=url;dialog.addEventListener('close',()=>URL.revokeObjectURL(url),{once:true});$('#downloadImage').onclick=()=>download(new Blob([bytes],{type:f.mime}),f.name);}else download(new Blob([bytes],{type:'application/octet-stream'}),f.name);}
function editGate(post){if(actor.teacher){composer(post,'');return;}modal('게시글 비밀번호 확인',`<p class="help">${esc(post.title)}</p><form id="passwordForm"><label for="postPassword">수정·삭제용 비밀번호</label><input type="password" id="postPassword" required autocomplete="off"><p id="formError" class="status-error" role="alert"></p><div class="actions"><button class="button" type="submit">확인</button></div></form>`);$('#passwordForm').onsubmit=e=>{e.preventDefault();guard(async()=>{const proof=await passwordProof($('#postPassword').value,post.salt);await rpc('authorizePost',{postId:post.id,proof});dialog.close();composer(post,proof);},e.submitter);};}
function composer(post=null,existingProof=''){if(!classroom.sections.length){toast('선생님이 활동 항목을 만든 뒤 글을 올릴 수 있습니다.');return;}let kept=post?[...post.files]:[], selected=[];const postId=post?.id||C.uuid().replaceAll('-',''),salt=post?.salt||C.uuid();modal(post?'게시글 수정':'새로운 생각 올리기',`<form id="postForm"><div class="field"><label for="postSection">활동 항목</label><select id="postSection" ${post?'disabled':''}>${classroom.sections.map(s=>`<option value="${s.id}" ${(post?.sectionId||sectionId)===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div><div class="field"><label for="postTitle">제목</label><input id="postTitle" maxlength="100" required placeholder="어떤 생각을 나누고 싶나요?" value="${esc(post?.title||'')}"></div><div class="field"><label for="postBody">내용</label><textarea id="postBody" maxlength="10000" placeholder="발견한 점, 궁금한 점, 함께 나누고 싶은 내용을 적어주세요.">${esc(post?.body||'')}</textarea></div><div class="field upload-field"><label class="upload-zone" for="postFiles"><span aria-hidden="true" class="upload-symbol">＋</span><span>사진·파일 첨부</span></label><input id="postFiles" class="visually-hidden" type="file" multiple accept=".jpg,.jpeg,.png,.gif,.webp,.heic,.pdf,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"><p class="help">최대 3개 · 파일당 5MB · 새 첨부 합계 10MB</p><ul class="file-list" id="fileList" aria-live="polite"></ul></div>${!post?'<div class="row"><div class="field"><label for="newPassword">게시글 비밀번호</label><input id="newPassword" type="password" minlength="6" maxlength="100" autocomplete="new-password" required placeholder="6자 이상"></div><div class="field"><label for="confirmPassword">비밀번호 확인</label><input id="confirmPassword" type="password" minlength="6" maxlength="100" autocomplete="new-password" required></div></div><p class="help">수정·삭제할 때 필요해요. 다른 곳에서 사용하는 비밀번호는 피해주세요.</p>':''}<p id="formError" class="status-error" role="alert"></p><div id="saveProgress" class="progress" aria-live="polite"></div><div class="actions">${post?'<button class="button danger" type="button" id="deletePost">삭제</button>':''}${post&&actor.teacher?'<button class="button subtle" type="button" id="resetPassword">비밀번호 초기화</button>':''}<button class="button" type="submit">${post?'수정 저장':'게시글 올리기'}</button></div></form>`);
 const fileList=()=>{$('#fileList').innerHTML=kept.map((f,i)=>`<li><span>${esc(f.name)}</span><button type="button" class="iconbtn" data-keep="${i}" aria-label="${esc(f.name)} 삭제">×</button></li>`).join('')+selected.map((f,i)=>`<li><span>새 파일 · ${esc(f.name)}</span><button type="button" class="iconbtn" data-new="${i}" aria-label="${esc(f.name)} 삭제">×</button></li>`).join('');document.querySelectorAll('[data-keep]').forEach(b=>b.onclick=()=>{kept.splice(Number(b.dataset.keep),1);fileList();});document.querySelectorAll('[data-new]').forEach(b=>b.onclick=()=>{selected.splice(Number(b.dataset.new),1);fileList();});};fileList();$('#postFiles').onchange=e=>{const added=[...e.target.files];if(added.some(f=>f.size>5*1024*1024)){toast('파일당 5MB 이하로 올려주세요.');e.target.value='';return;}if(kept.length+selected.length+added.length>3||[...selected,...added].reduce((s,f)=>s+f.size,0)>10*1024*1024){toast('최대 3개, 새 첨부 총 10MB까지 가능합니다.');e.target.value='';return;}selected.push(...added);e.target.value='';fileList();};
 $('#postForm').onsubmit=e=>{e.preventDefault();guard(async()=>{let proof=existingProof;if(!post){if($('#newPassword').value!==$('#confirmPassword').value)throw Error('비밀번호 확인이 일치하지 않습니다.');proof=await passwordProof($('#newPassword').value,salt);}$('#saveProgress').textContent='글과 첨부파일을 저장하고 있습니다. 창을 닫지 마세요.';const files=[];for(const f of selected){files.push({name:f.name,size:f.size,mime:f.type||'application/octet-stream',base64:await file64(f)});}await rpc(post?'updatePost':'createPost',{postId,sectionId:$('#postSection').value,title:$('#postTitle').value,body:$('#postBody').value,proof,salt,files,keepFileIds:kept.map(f=>f.id),version:post?.updatedAt});dialog.close();toast('글과 첨부파일이 모두 저장되었습니다.');try{await loadBoard();}catch(_){toast('저장은 완료되었습니다. 목록은 새로고침해주세요.');}},e.submitter);};
 if(post){$('#deletePost').onclick=e=>{if(!confirm('이 게시글과 첨부파일을 삭제할까요?'))return;guard(async()=>{await rpc('deletePost',{postId:post.id,proof:existingProof});dialog.close();await loadBoard();toast('게시글을 삭제했습니다.');},e.currentTarget);};if(actor.teacher)$('#resetPassword').onclick=()=>{dialog.close();passwordReset(post);};}}
function file64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(Error('파일을 읽지 못했습니다.'));reader.readAsDataURL(file);});}
function passwordReset(post){modal('게시글 비밀번호 초기화',`<form id="resetForm"><label for="resetValue">새 비밀번호</label><input id="resetValue" type="password" minlength="6" maxlength="100" required autocomplete="new-password"><label for="resetConfirm">새 비밀번호 확인</label><input id="resetConfirm" type="password" minlength="6" maxlength="100" required autocomplete="new-password"><p id="formError" class="status-error" role="alert"></p><div class="actions"><button class="button" type="submit">초기화</button></div></form>`);$('#resetForm').onsubmit=e=>{e.preventDefault();guard(async()=>{if($('#resetValue').value!==$('#resetConfirm').value)throw Error('비밀번호 확인이 일치하지 않습니다.');const salt=C.uuid(),proof=await passwordProof($('#resetValue').value,salt);await rpc('resetPassword',{postId:post.id,salt,proof});dialog.close();await loadBoard();toast('새 비밀번호를 학생에게 알려주세요.');},e.submitter);};}
async function comments(postId){const p=posts.find(p=>p.id===postId),items=await rpc('comments',{postId});modal('생각에 답하기',`<h3>${esc(p.title)}</h3><div>${items.sort((a,b)=>a.createdAt-b.createdAt).map(c=>`<div class="comment">${esc(c.body)}<small>${esc(c.studentNo)} ${esc(c.studentName)} · ${date(c.createdAt)} ${actor.teacher?`<button class="iconbtn" data-delete-comment="${c.id}">삭제</button>`:''}</small></div>`).join('')||'<p class="help">첫 번째 댓글을 남겨보세요.</p>'}</div><form id="commentForm" style="margin-top:20px"><label for="commentBody">댓글</label><textarea id="commentBody" maxlength="1000" required placeholder="친구의 생각에 질문이나 응원을 남겨주세요."></textarea><p id="formError" class="status-error" role="alert"></p><div class="actions"><button class="button" type="submit" ${classroom.writeClosed&&!actor.teacher?'disabled':''}>댓글 남기기</button></div></form>`);$('#commentForm').onsubmit=e=>{e.preventDefault();guard(async()=>{await rpc('comment',{postId,body:$('#commentBody').value});dialog.close();await loadBoard();await comments(postId);},e.submitter);};document.querySelectorAll('[data-delete-comment]').forEach(b=>b.onclick=()=>{if(!confirm('댓글을 삭제할까요?'))return;guard(async()=>{await rpc('deleteComment',{postId,commentId:b.dataset.deleteComment});dialog.close();await loadBoard();await comments(postId);},b);});}
function manageSections(){
 modal('활동 항목 편집',`<p class="help">항목 이름을 바꾸거나 빈 항목을 삭제할 수 있습니다. 글이 있는 항목은 게시글을 먼저 정리해주세요.</p><div id="sectionEditor">${classroom.sections.map(s=>`<form class="section-edit-row" data-section-form="${s.id}"><label for="section-name-${s.id}">항목 이름</label><div class="row"><input id="section-name-${s.id}" value="${esc(s.name)}" required maxlength="40"><button class="button small" type="submit">이름 저장</button><button class="button subtle small" type="button" data-delete-section="${s.id}">삭제</button></div></form>`).join('')||'<p class="help">아직 항목이 없습니다. ‘항목 만들기’로 추가해주세요.</p>'}</div><p id="formError" class="status-error" role="alert"></p>`);
 document.querySelectorAll('[data-section-form]').forEach(form=>form.onsubmit=e=>{e.preventDefault();guard(async()=>{classroom=await rpc('renameSection',{sectionId:form.dataset.sectionForm,name:form.querySelector('input').value.trim()});renderBoard();toast('항목 이름을 저장했습니다.');},e.submitter);});
 document.querySelectorAll('[data-delete-section]').forEach(button=>button.onclick=()=>{const id=button.dataset.deleteSection,name=classroom.sections.find(s=>s.id===id)?.name;if(!confirm('‘'+name+'’ 항목을 삭제할까요? 글이 있는 항목은 삭제되지 않습니다.'))return;guard(async()=>{classroom=await rpc('deleteSection',{sectionId:id});if(sectionId===id)sectionId='';renderBoard();dialog.close();manageSections();toast('항목을 삭제했습니다.');},button);});
}
function settings(){modal('학급 설정',`<form id="codeForm"><label for="customClassCode">학급 입장 코드</label><div class="row"><input id="customClassCode" class="code-input" maxlength="20" minlength="4" pattern="[A-Za-z0-9]{4,20}" value="${esc(classroom.code)}" required autocomplete="off"><button class="button subtle small" type="submit" style="flex-shrink:0">코드 저장</button></div><p class="help">영문·숫자 4~20자리 · 다른 학급과 중복 불가<br>코드를 변경해도 이미 입장한 학생의 세션은 최대 12시간 유지됩니다.</p></form><form id="settingsForm" style="margin-top:25px"><label class="row"><input id="entryClosed" type="checkbox" style="width:auto" ${classroom.entryClosed?'checked':''}> 신규 입장 마감</label><label class="row"><input id="writeClosed" type="checkbox" style="width:auto" ${classroom.writeClosed?'checked':''}> 글·수정·댓글·좋아요 작성 마감</label><p id="formError" class="status-error" role="alert"></p><div class="actions"><button class="button" type="submit">설정 저장</button></div></form>`);$('#codeForm').onsubmit=e=>{e.preventDefault();guard(async()=>{const code=C.normalizeCode($('#customClassCode').value);classroom=await rpc('setCode',{code});renderBoard();toast('입장 코드를 저장했습니다: '+classroom.code);},e.submitter);};$('#settingsForm').onsubmit=e=>{e.preventDefault();guard(async()=>{classroom=await rpc('classSettings',{entryClosed:$('#entryClosed').checked,writeClosed:$('#writeClosed').checked});dialog.close();renderBoard();},e.submitter);};}
function exportModal(){modal('활동별 일괄 다운로드',`<p>글 목록과 학생별 글·첨부파일을 하나로 모아 받습니다.</p><form id="exportForm"><label for="exportSection">다운로드할 항목</label><select id="exportSection"><option value="">학급 전체</option>${classroom.sections.map(s=>`<option value="${s.id}" ${sectionId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select><p class="help">엑셀에서 열 수 있는 글 목록(CSV), 전체 글 보기(HTML), 학생별 글(TXT)과 첨부파일을 ZIP으로 받습니다. 약 25MB 단위로 나누며, 여러 파일 다운로드 허용이 필요할 수 있습니다.</p><div class="progress" id="exportProgress" aria-live="polite"></div><p id="formError" class="status-error" role="alert"></p><div class="actions"><button class="button" type="submit">ZIP 다운로드</button></div></form>`);$('#exportForm').onsubmit=e=>{e.preventDefault();guard(async()=>{const selected=$('#exportSection').value;const result=await rpc('export',{sectionId:selected});const list=result.posts.sort((a,b)=>a.studentNo.localeCompare(b.studentNo,'ko',{numeric:true}));if(!list.length)throw Error('다운로드할 게시글이 없습니다.');const sectionName=id=>result.classroom.sections.find(s=>s.id===id)?.name||'항목';const rows=[['활동 항목','학번','이름','제목','내용','작성일','첨부파일'],...list.map(p=>[sectionName(p.sectionId),p.studentNo,p.studentName,p.title,p.body,new Date(p.createdAt).toLocaleString('ko-KR'),p.files.map(f=>f.name).join(' / ')])];let entries=[{name:'글_목록.csv',data:C.csv(rows)},{name:'전체_글_보기.html',data:'<!doctype html><meta charset="utf-8"><title>학급 게시글</title><style>body{font:15px/1.8 sans-serif;max-width:900px;margin:40px auto;padding:20px}article{border-bottom:1px solid #ccc;padding:25px 0}pre{white-space:pre-wrap;font:inherit}h1{color:#246653}</style><h1>'+esc(result.classroom.name)+'</h1>'+list.map(p=>'<article><h2>'+esc(p.title)+'</h2><p>'+esc(sectionName(p.sectionId))+' · '+esc(p.studentNo)+' '+esc(p.studentName)+'</p><pre>'+esc(p.body)+'</pre><p>첨부: '+esc(p.files.map(f=>f.name).join(', '))+'</p></article>').join('')}];let size=entries.reduce((s,e)=>s+new TextEncoder().encode(e.data).length,0),part=1,done=0,total=list.reduce((s,p)=>s+p.files.length,0);const prefix=C.safeName(classroom.name)+'_'+C.safeName(selected?sectionName(selected):'전체');function flush(){download(C.zip(entries),prefix+'_'+String(part++).padStart(2,'0')+'.zip');entries=[];size=0;}
 for(const p of list){const dir=C.safeName(sectionName(p.sectionId))+'/'+C.safeName(p.studentNo+'_'+p.studentName)+'/'+C.safeName(p.title)+'_'+p.id.slice(0,8)+'/';entries.push({name:dir+'게시글.txt',data:[p.title,p.studentNo+' '+p.studentName,new Date(p.createdAt).toLocaleString('ko-KR'),'',p.body].join('\n')});for(let i=0;i<p.files.length;i++){const f=p.files[i];$('#exportProgress').textContent=`첨부파일 확인 중 ${done+1} / ${total} · ${f.name}`;const r=await rpc('file',{postId:p.id,fileId:f.id});const bytes=from64(r.base64);if(size+bytes.length>25*1024*1024&&entries.length)flush();entries.push({name:dir+String(i+1).padStart(2,'0')+'_'+C.safeName(f.name),data:bytes});size+=bytes.length;done++;}}if(entries.length)flush();$('#exportProgress').textContent=`완료 · 게시글 ${list.length}개, 첨부파일 ${done}개, ZIP ${part-1}개를 다운로드했습니다.`;toast('일괄 다운로드가 완료되었습니다.');},e.submitter);};}
/* Explicit local demo. Never used when a server URL is configured. */
const Demo={
 async db(){if(this.handle)return this.handle;this.handle=await new Promise((resolve,reject)=>{const r=indexedDB.open('classboard-demo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('체험 데이터를 저장할 수 없습니다. 브라우저 저장소 설정을 확인해주세요.'));});return this.handle;},
 async read(){const db=await this.db();const value=await new Promise((resolve,reject)=>{const r=db.transaction('data').objectStore('data').get('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});if(value){if(value.schemaVersion!==2){const seedIds=['sample1','sample2','sample3'];value.posts=value.posts.filter(p=>!seedIds.includes(p.id));seedIds.forEach(id=>{delete value.secrets[id];delete value.comments[id];});const names={free:'자유 게시판',experiment:'실험 결과 공유',question:'궁금한 점',report:'최종 보고서'};value.classes.forEach(c=>{if(c.id==='demo')c.sections=c.sections.filter(sec=>!(names[sec.id]===sec.name&&!value.posts.some(p=>p.classId===c.id&&p.sectionId===sec.id)));});value.schemaVersion=2;await this.write(value);}return value;}return {schemaVersion:2,classes:[{id:'demo',name:'1학년 1반',code:'DEMO2026',sections:[],entryClosed:false,writeClosed:false,createdAt:Date.now()}],posts:[],secrets:{},sessions:{},comments:{},files:{}};},
 async write(value){const db=await this.db();await new Promise((resolve,reject)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(value,'state');tx.oncomplete=resolve;tx.onerror=()=>reject(Error('브라우저 체험 저장 공간이 부족합니다.'));});},
 async call(action,p){const s=await this.read();let a;if(action!=='join'){a=p.teacherToken==='demo-teacher'?{teacher:true}:s.sessions[p.sessionToken];if(!a)throw Error('학급에 다시 입장해주세요.');}
 const tc=()=>{if(!a?.teacher)throw Error('교사 권한이 필요합니다.');};let c=s.classes.find(x=>x.id===p.classId),post=s.posts.find(x=>x.id===p.postId&&x.classId===p.classId);const scope=()=>{if(!c||(!a.teacher&&a.classId!==c.id))throw Error('학급 접근 권한이 없습니다.');};const own=()=>{scope();if(!post)throw Error('게시글을 찾을 수 없습니다.');if(!a.teacher&&s.secrets[post.id]!==p.proof)throw Error('게시글 비밀번호가 일치하지 않습니다. 예시 글은 교사 화면에서 수정할 수 있어요.');};let r;
 switch(action){case'join':{p.code=C.normalizeCode(p.code);Object.assign(p,C.studentIdentity(p.studentNo,p.studentName));}c=s.classes.find(x=>x.code===p.code&&!x.entryClosed);if(!c)throw Error('입장 코드가 올바르지 않거나 입장이 마감되었습니다.');{const token=C.uuid();s.sessions[token]={classId:c.id,studentNo:p.studentNo,studentName:p.studentName};r={token,classroom:c,studentNo:p.studentNo,studentName:p.studentName};}break;
 case'classes':tc();r=s.classes;break;case'class':scope();r=c;break;
 case'createClass':tc();{const code=C.normalizeCode(p.code);if(s.classes.some(x=>x.code===code))throw Error('다른 학급에서 사용 중인 코드입니다. 다른 코드를 입력해주세요.');r={id:C.uuid(),name:p.name,code,sections:[],entryClosed:false,writeClosed:false,createdAt:Date.now()};s.classes.push(r);}break;
 case'createSection':tc();scope();if(c.sections.some(x=>x.name===p.name))throw Error('같은 이름의 항목이 있습니다.');c.sections.push({id:C.uuid(),name:p.name});r=c;break;
 case'renameSection':tc();scope();{const sec=c.sections.find(x=>x.id===p.sectionId);if(!sec)throw Error('활동 항목을 찾을 수 없습니다.');const name=String(p.name||'').trim();if(!name||name.length>40)throw Error('항목 이름을 확인해주세요.');if(c.sections.some(x=>x.id!==sec.id&&x.name===name))throw Error('같은 이름의 항목이 있습니다.');sec.name=name;r=c;}break;
 case'deleteSection':tc();scope();if(!c.sections.some(x=>x.id===p.sectionId))throw Error('활동 항목을 찾을 수 없습니다.');if(s.posts.some(x=>x.classId===c.id&&x.sectionId===p.sectionId))throw Error('글이 있는 항목은 삭제할 수 없습니다. 게시글을 먼저 정리해주세요.');c.sections=c.sections.filter(x=>x.id!==p.sectionId);r=c;break;
 case'classSettings':tc();scope();c.entryClosed=p.entryClosed;c.writeClosed=p.writeClosed;r=c;break;
 case'setCode':case'rotateCode':tc();scope();{const code=C.normalizeCode(p.code);if(s.classes.some(x=>x.id!==c.id&&x.code===code))throw Error('다른 학급에서 사용 중인 코드입니다. 다른 코드를 입력해주세요.');c.code=code;r=c;}break;
 case'posts':scope();r={items:s.posts.filter(x=>x.classId===c.id),nextPageToken:''};break;
 case'authorizePost':own();r=true;break;
 case'createPost':case'updatePost':scope();if(c.writeClosed&&!a.teacher)throw Error('글쓰기가 마감되었습니다.');if(action==='updatePost'){own();if(p.version!==post.updatedAt)throw Error('새로고침 후 다시 수정해주세요.');}else{post=s.posts.find(x=>x.id===p.postId);if(post){own();r=post;break;}post={id:p.postId,classId:c.id,sectionId:p.sectionId,studentNo:a.teacher?'교사':a.studentNo,studentName:a.teacher?'선생님':a.studentName,salt:p.salt,files:[],likes:[],commentCount:0,createdAt:Date.now()};s.posts.push(post);s.secrets[post.id]=p.proof;}post.files=post.files.filter(f=>p.keepFileIds.includes(f.id));for(const f of p.files){const id=C.uuid();s.files[id]=f;post.files.push({id,name:f.name,mime:f.mime,size:f.size});}post.title=p.title;post.body=p.body;post.updatedAt=Date.now();r=post;break;
 case'deletePost':own();s.posts=s.posts.filter(x=>x.id!==post.id);delete s.secrets[post.id];post.files.forEach(f=>delete s.files[f.id]);r=true;break;
 case'resetPassword':tc();scope();s.secrets[post.id]=p.proof;post.salt=p.salt;post.updatedAt=Date.now();r=true;break;
 case'like':scope();if(c.writeClosed&&!a.teacher)throw Error('참여가 마감되었습니다.');{const key=p.sessionToken||'teacher',i=post.likes.indexOf(key);if(i>=0)post.likes.splice(i,1);else post.likes.push(key);r=post;}break;
 case'comments':scope();r=s.comments[post.id]||[];break;
 case'comment':scope();if(c.writeClosed&&!a.teacher)throw Error('참여가 마감되었습니다.');{r={id:C.uuid(),body:p.body,studentNo:a.teacher?'교사':a.studentNo,studentName:a.teacher?'선생님':a.studentName,createdAt:Date.now()};(s.comments[post.id]||=([])).push(r);post.commentCount++;}break;
 case'deleteComment':tc();scope();s.comments[post.id]=(s.comments[post.id]||[]).filter(x=>x.id!==p.commentId);post.commentCount=s.comments[post.id].length;r=true;break;
 case'file':scope();if(!post.files.some(f=>f.id===p.fileId)||!s.files[p.fileId])throw Error('첨부파일을 찾을 수 없습니다.');r=s.files[p.fileId];break;
 case'export':tc();scope();r={classroom:c,posts:s.posts.filter(x=>x.classId===c.id&&(!p.sectionId||x.sectionId===p.sectionId))};break;
 default:throw Error('지원하지 않는 요청입니다.');}
 if(c&&!['join','class','posts','file','comments','export','authorizePost','classes'].includes(action))c.activityAt=Date.now();await this.write(s);return structuredClone(r);
 }
};
entry();
let pollBusy=false;setInterval(async()=>{if(!actor||!classroom||busy||pollBusy||dialog.open||document.hidden||pageToken)return;pollBusy=true;try{const latest=await rpc('class');if(latest.activityAt!==classroom.activityAt){classroom=latest;await loadBoard();}}catch(_){/* Manual refresh shows actionable errors. */}finally{pollBusy=false;}},60000);

