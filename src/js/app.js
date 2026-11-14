
// Student Academic Management System - original timetable design with working modal forms
const $ = id => document.getElementById(id);
let courses = [], routines = [], exams = JSON.parse(localStorage.getItem('classsyncExams') || '[]');
let formType = '', editingId = null;
const days = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];
const periods = [['08:00','08:50'],['09:00','09:50'],['10:00','10:50'],['11:30','12:20'],['12:30','13:20'],['13:30','14:20'],['14:30','15:20'],['15:30','16:20'],['16:30','17:20']];
const safe = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => new Date().toISOString().slice(0,10);
const saveExams = () => localStorage.setItem('classsyncExams',JSON.stringify(exams));
const message = text => alert(text);
function timeMinutes(t){const [h,m]=t.split(':').map(Number);return h*60+m;}

async function loadData(){
  try{
    courses=await window.coursesAPI.getCourses();
    routines=await window.coursesAPI.getRoutines();
  }
  catch(e){message('Unable to load data: '+e.message);}
  render();
}

function render(){
  renderCourses();
  renderRoutine();
  renderExams();
  renderDashboard();
}

function navigate(button){
  document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));
  $(button.dataset.page).classList.remove('hidden');
  document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b===button));
  $('pageTitle').textContent=button.textContent.trim();
}

document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>navigate(b)));

function courseOptions(selected){
  return courses.map(c=>`<option value="${safe(c.id)}" ${c.id===selected?'selected':''}>${safe(c.code)} — ${safe(c.name)}</option>`).join('');
}

function field(label,name,type,value='',extra=''){
  return `<label>${label}<input name="${name}" type="${type}" value="${safe(value)}" ${extra} required></label>`;
}

function selectField(label,name,options,value){
  return `<label>${label}<select name="${name}" required>${options}</select></label>`;
}

function openForm(type,row=null){
  formType=type;
  editingId=row?.id||null;
  const title={course:'Course',routine:'Class Routine',exam:'Exam'}[type];
  $('formTitle').textContent=(row?'Edit ':'Add ')+title;
  let html='';

  if(type==='course'){
    html=field('Course Name','name','text',row?.name||'')+
      field('Course Code','code','text',row?.code||'')+
      field('Credit','credit','number',row?.credit??3,'min="1" max="10"')+
      field('Instructor','instructor','text',row?.instructor||'');
  }else if(type==='routine'){
    const dayOpts=days.map(d=>`<option ${row?.day===d?'selected':''}>${d}</option>`).join('');
    const startIndex=Math.max(0,periods.findIndex(p=>p[0]===row?.startTime));
    const duration=row?Math.max(1,periods.findIndex(p=>p[1]===row.endTime)-startIndex+1):1;
    const startOpts=periods.map((p,i)=>`<option value="${i}" ${i===startIndex?'selected':''}>Period ${i+1} (${p[0]}–${p[1]})</option>`).join('');
    html=selectField('Course','courseId',courseOptions(row?.courseId),row?.courseId)+
      selectField('Day','day',dayOpts,row?.day)+
      selectField('Starting Period','period',startOpts,startIndex)+
      `<label>Duration (periods)<select name="duration" id="durationSelect">${Array.from({length:9},(_,i)=>`<option value="${i+1}" ${i+1===duration?'selected':''}>${i+1}</option>`).join('')}</select></label>`+
      field('Room','room','text',row?.room||'');
  }else{
    const status=['Not started','In progress','Prepared'].map(s=>`<option ${row?.status===s?'selected':''}>${s}</option>`).join('');
    html=selectField('Course','courseId',courseOptions(courses.find(c=>c.code===row?.course)?.id),courses.find(c=>c.code===row?.course)?.id)+
      field('Exam Type','type','text',row?.type||'Midterm')+
      field('Date','date','date',row?.date||today())+
      field('Time','time','time',row?.time||'')+
      field('Room','room','text',row?.room||'')+
      selectField('Status','status',status,row?.status);
  }

  $('formFields').innerHTML=html;
  $('editor').showModal();
}

function closeForm(){
  $('editor').close();
  editingId=null;
}

$('closeForm').onclick=closeForm;
$('cancelForm').onclick=closeForm;

$('editorForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const data=Object.fromEntries(new FormData(e.currentTarget));

  try{
    if(formType==='course'){
      if(courses.some(c=>c.code.toLowerCase()===data.code.trim().toLowerCase()&&c.id!==editingId))
        return message('Course code already exists.');

      const item={
        id:editingId||Date.now().toString(),
        name:data.name.trim(),
        code:data.code.trim(),
        credit:Number(data.credit),
        instructor:data.instructor.trim()
      };

      if(!item.name||!item.code||item.credit<1)
        return message('Please enter valid course details.');

      if(editingId)await window.coursesAPI.editCourse(item);
      else await window.coursesAPI.addCourse(item);
    }

    if(formType==='routine'){
      const course=courses.find(c=>c.id===data.courseId);
      const index=Number(data.period);
      const duration=Number(data.duration);

      if(!course)return message('Please select a course.');

      const max=index<3?3-index:9-index;
      if(duration<1||duration>max)
        return message('Class cannot cross the break or exceed the timetable.');

      const startTime=periods[index][0];
      const endTime=periods[index+duration-1][1];

      if(routines.some(r=>r.id!==editingId&&r.day===data.day&&startTime<r.endTime&&endTime>r.startTime))
        return message('Another class exists at this time.');

      const item={
        id:editingId||Date.now().toString(),
        courseId:course.id,
        courseName:course.name,
        courseCode:course.code,
        day:data.day,
        startTime,
        endTime,
        room:data.room.trim()
      };

      if(editingId)await window.coursesAPI.editRoutine(item);
      else await window.coursesAPI.addRoutine(item);
    }

    if(formType==='exam'){
      const course=courses.find(c=>c.id===data.courseId);
      if(!course)return message('Please select a course.');

      if(exams.some(x=>x.id!==editingId&&x.course===course.code&&x.type===data.type&&x.date===data.date))
        return message('This exam already exists.');

      const item={
        id:editingId||Date.now().toString(),
        course:course.code,
        type:data.type.trim(),
        date:data.date,
        time:data.time,
        room:data.room.trim(),
        status:data.status
      };

      exams=editingId?exams.map(x=>x.id===editingId?item:x):[...exams,item];
      saveExams();
    }

    closeForm();
    await loadData();
  }catch(error){
    message('Could not save: '+error.message);
  }
});

$('addCourse').onclick=()=>openForm('course');

$('addRoutine').onclick=()=>courses.length
  ?openForm('routine')
  :message('Add a course first.');

$('addExam').onclick=()=>courses.length
  ?openForm('exam')
  :message('Add a course first.');

function edit(type,id){
  const list={course:courses,routine:routines,exam:exams}[type];
  const row=list.find(x=>x.id===id);
  if(row)openForm(type,row);
}

async function remove(type,id){
  if(!confirm('Delete this item?'))return;

  try{
    if(type==='course')await window.coursesAPI.deleteCourse(id);
    if(type==='routine')await window.coursesAPI.deleteRoutine(id);
    if(type==='exam'){
      exams=exams.filter(x=>x.id!==id);
      saveExams();
    }
    await loadData();
  }catch(e){
    message('Delete failed: '+e.message);
  }
}

function actionButtons(type,id){
  return `<div class="actions"><button data-edit="${type}:${id}">Edit</button><button data-delete="${type}:${id}">Delete</button></div>`;
}

document.addEventListener('click',e=>{
  const editKey=e.target.dataset.edit;
  const deleteKey=e.target.dataset.delete;

  if(editKey){
    const [type,id]=editKey.split(':');
    edit(type,id);
  }

  if(deleteKey){
    const [type,id]=deleteKey.split(':');
    remove(type,id);
  }
});

function renderCourses(){
  $('courseList').innerHTML=courses.length
    ?courses.map(c=>`<div class="card"><h3>${safe(c.name)}</h3><p>${safe(c.code)} | ${safe(c.credit)} Credits</p><p>Instructor: ${safe(c.instructor||'Not added')}</p>${actionButtons('course',c.id)}</div>`).join('')
    :'<article>No courses added yet.</article>';
}

function renderRoutine(){
  const sorted=[...routines].sort((a,b)=>
    days.indexOf(a.day)-days.indexOf(b.day)||
    a.startTime.localeCompare(b.startTime)
  );

  const hours=sorted.reduce((sum,r)=>
    sum+(timeMinutes(r.endTime)-timeMinutes(r.startTime))/60,0
  );

  $('routineStats').innerHTML=`
    <article><small>Total Classes</small><h3>${sorted.length}</h3></article>
    <article><small>Active Days</small><h3>${new Set(sorted.map(r=>r.day)).size}</h3></article>
    <article><small>Weekly Hours</small><h3>${hours.toFixed(1)}</h3></article>
  `;

  let html='<table class="routine-table"><thead><tr><th>Day</th>';

  periods.forEach((p,i)=>{
    if(i===3)html+='<th class="break-head">Break<small>10:50–11:30</small></th>';
    html+=`<th>Period ${i+1}<small>${p[0]}–${p[1]}</small></th>`;
  });

  html+='</tr></thead><tbody>';

  days.forEach(day=>{
    html+=`<tr><th class="day-cell">${day}</th>`;
    let i=0;

    while(i<9){
      if(i===3)html+='<td class="break-cell">BREAK</td>';

      const r=sorted.find(x=>x.day===day&&x.startTime===periods[i][0]);

      if(r){
        let end=periods.findIndex((p,j)=>j>=i&&p[1]===r.endTime);
        if(end<i)end=i;

        const span=end-i+1;

        html+=`<td colspan="${span}" class="class-cell">
          <strong>${safe(r.courseCode)}</strong>
          <span>${safe(r.courseName)}</span>
          <small>${safe(r.startTime)}–${safe(r.endTime)} | Room ${safe(r.room)}</small>
          ${actionButtons('routine',r.id)}
        </td>`;

        i+=span;
      }else{
        html+='<td class="empty-cell">—</td>';
        i++;
      }
    }

    html+='</tr>';
  });

  $('routineList').innerHTML=html+'</tbody></table>';
}

$('exportRoutine').onclick=()=>window.print();

function renderExams(){
  const sorted=[...exams].sort((a,b)=>a.date.localeCompare(b.date));
  const upcoming=sorted.filter(e=>e.date>=today());

  $('examSummary').innerHTML=`
    <article><small>Total Exams</small><h2>${exams.length}</h2></article>
    <article><small>Upcoming</small><h2>${upcoming.length}</h2></article>
    <article><small>Prepared</small><h2>${exams.filter(e=>e.status==='Prepared').length}</h2></article>
    <article><small>In Progress</small><h2>${exams.filter(e=>e.status==='In progress').length}</h2></article>
  `;

  $('examList').innerHTML=sorted.length
    ?sorted.map(e=>`<div class="card"><h3>${safe(e.course)} - ${safe(e.type)}</h3><p>${safe(e.date)} ${safe(e.time||'')}</p><p>Room: ${safe(e.room||'Not added')}</p><p>Status: ${safe(e.status)}</p>${actionButtons('exam',e.id)}</div>`).join('')
    :'<article>No exams planned.</article>';
}

function renderDashboard(){
  const todayName=days[(new Date().getDay()+1)%7];
  const list=routines.filter(r=>r.day===todayName).sort((a,b)=>a.startTime.localeCompare(b.startTime));

  $('courseCount').textContent=courses.length;
  $('creditCount').textContent=courses.reduce((s,c)=>s+Number(c.credit),0);
  $('todayCount').textContent=list.length;
  $('examCount').textContent=exams.filter(e=>e.date>=today()).length;

  $('todayList').innerHTML=list.map(r=>`
    <div class="row">
      <strong>${safe(r.courseCode)} — ${safe(r.courseName)}</strong>
      <small>${r.startTime}–${r.endTime} | Room ${safe(r.room)}</small>
    </div>
  `).join('')||'<p class="row">No classes today.</p>';

  $('nextExams').innerHTML=exams
    .filter(e=>e.date>=today())
    .sort((a,b)=>a.date.localeCompare(b.date))
    .slice(0,4)
    .map(e=>`<div class="row"><strong>${safe(e.course)} — ${safe(e.type)}</strong><small>${e.date} ${safe(e.time||'')}</small></div>`)
    .join('')||'<p class="row">No upcoming exams.</p>';
}

function loadSettings(){
  const s=JSON.parse(localStorage.getItem('classsyncSettings')||'{}');

  $('studentName').value=s.name||'';
  $('studentInitial').value=s.initial||'S';
  $('darkMode').checked=!!s.dark;

  document.body.classList.toggle('dark',!!s.dark);
  $('photoPreview').src=s.photo||'';

  if(s.photo)$('profileBadge').innerHTML=`<img src="${s.photo}" alt="Profile">`;

  updateProfile();
}

function updateProfile(){
  const name=$('studentName').value.trim()||'Student';

  $('profileName').textContent=name;

  if(!$('photoPreview').src||$('photoPreview').getAttribute('src')===''){
    $('profileBadge').textContent=$('studentInitial').value||name[0]||'S';
  }
}

$('studentPhoto').onchange=e=>{
  const file=e.target.files[0];
  if(!file)return;

  if(file.size>1500000)
    return message('Choose an image smaller than 1.5 MB.');

  const reader=new FileReader();

  reader.onload=()=>{
    $('photoPreview').src=reader.result;
    $('profileBadge').innerHTML=`<img src="${reader.result}" alt="Profile">`;
  };

  reader.readAsDataURL(file);
};

$('removePhoto').onclick=()=>{
  $('studentPhoto').value='';
  $('photoPreview').removeAttribute('src');
  updateProfile();
};

$('darkMode').onchange=e=>
  document.body.classList.toggle('dark',e.target.checked);

$('saveSettings').onclick=()=>{
  const photo=$('photoPreview').getAttribute('src')||'';

  const settings={
    name:$('studentName').value.trim(),
    initial:$('studentInitial').value.trim()||'S',
    dark:$('darkMode').checked,
    photo
  };

  localStorage.setItem('classsyncSettings',JSON.stringify(settings));
  updateProfile();
  $('settingsMessage').textContent='Settings saved successfully.';
};

loadSettings();
loadData();
