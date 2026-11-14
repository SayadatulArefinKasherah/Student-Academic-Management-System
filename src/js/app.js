
// Student Academic Management System

const $ = id => document.getElementById(id);

let courses = [];
let routines = [];
let exams = JSON.parse(localStorage.getItem('classsyncExams') || '[]');

let editingCourse = null;
let editingRoutine = null;
let editingExam = null;

const days = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];

const periods = [
    ['08:00','08:50'],['09:00','09:50'],['10:00','10:50'],
    ['11:30','12:20'],['12:30','13:20'],['13:30','14:20'],
    ['14:30','15:20'],['15:30','16:20'],['16:30','17:20']
];

const safe = value => String(value ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
);

const saveExams = () =>
    localStorage.setItem('classsyncExams', JSON.stringify(exams));

function message(text) {
    alert(text);
}

// Navigation
document.querySelectorAll('[data-page]').forEach(button => {
    button.onclick = () => {
        document.querySelectorAll('.page').forEach(page =>
            page.classList.add('hidden'));

        $(button.dataset.page).classList.remove('hidden');

        document.querySelectorAll('[data-page]').forEach(item =>
            item.classList.toggle('active', item === button));

        $('pageTitle').textContent = button.textContent;
    };
});

// Load data from JSON files
async function loadData() {
    try {
        courses = await window.coursesAPI.getCourses();
        routines = await window.coursesAPI.getRoutines();
    } catch (error) {
        message('Unable to load data: ' + error.message);
    }
    render();
}

function render() {
    renderCourses();
    renderRoutine();
    renderExams();
    renderDashboard();
}

// Course Management
function renderCourses() {
    $('courseList').innerHTML = courses.length
        ? courses.map(c => `
        <div class="card">
            <h3>${safe(c.name)}</h3>
            <p>${safe(c.code)} | ${safe(c.credit)} Credits</p>
            <p>Instructor: ${safe(c.instructor || 'Not added')}</p>
            <div class="actions">
                <button onclick="editCourse('${c.id}')">Edit</button>
                <button onclick="deleteCourse('${c.id}')">Delete</button>
            </div>
        </div>`).join('')
        : '<article>No courses added yet.</article>';
}

async function addCourse() {
    const name = prompt('Course name:');
    if (!name || !name.trim()) return;

    const code = prompt('Course code:');
    if (!code || !code.trim()) return;

    const credit = Number(prompt('Course credit:', '3'));
    if (!credit || credit < 0) return message('Invalid credit.');

    const instructor = prompt('Instructor name:') || '';

    const data = { name, code, credit, instructor };

    try {
        if (editingCourse) {
            await window.coursesAPI.editCourse({
                ...data, id: editingCourse
            });
        } else {
            await window.coursesAPI.addCourse(data);
        }
        editingCourse = null;
        await loadData();
    } catch (error) {
        message(error.message);
    }
}

$('addCourse').onclick = () => {
    editingCourse = null;
    addCourse();
};

window.editCourse = id => {
    const c = courses.find(item => item.id === id);
    if (!c) return;

    editingCourse = id;
    addCourseEdit(c);
};

async function addCourseEdit(c) {
    const name = prompt('Course name:', c.name);
    if (name === null || !name.trim()) return;

    const code = prompt('Course code:', c.code);
    if (code === null || !code.trim()) return;

    const credit = Number(prompt('Credit:', c.credit));
    if (!credit || credit < 0) return;

    const instructor = prompt('Instructor:', c.instructor || '') || '';

    await window.coursesAPI.editCourse({
        id: c.id, name, code, credit, instructor
    });

    editingCourse = null;
    await loadData();
}

window.deleteCourse = async id => {
    if (!confirm('Delete this course?')) return;
    await window.coursesAPI.deleteCourse(id);
    await loadData();
};

// Class Routine
function renderRoutine() {
    const sorted = [...routines].sort((a, b) =>
        days.indexOf(a.day) - days.indexOf(b.day) ||
        a.startTime.localeCompare(b.startTime)
    );

    const hours = sorted.reduce((sum, r) =>
        sum + (timeMinutes(r.endTime) - timeMinutes(r.startTime)) / 60, 0
    );

    $('routineStats').innerHTML = `
        <article><small>Total Classes</small><h3>${sorted.length}</h3></article>
        <article><small>Active Days</small><h3>${new Set(sorted.map(r => r.day)).size}</h3></article>
        <article><small>Weekly Hours</small><h3>${hours.toFixed(1)}</h3></article>`;

    let html = `<table class="routine-table"><thead><tr>
        <th>Day</th>`;

    periods.forEach((p, i) => {
        if (i === 3) html += '<th class="break-head">Break<small>10:50–11:30</small></th>';
        html += `<th>Period ${i + 1}<small>${p[0]}–${p[1]}</small></th>`;
    });

    html += '</tr></thead><tbody>';

    days.forEach(day => {
        html += `<tr><th class="day-cell">${day}</th>`;
        let i = 0;

        while (i < 9) {
            if (i === 3) html += '<td class="break-cell">BREAK</td>';

            const r = sorted.find(item =>
                item.day === day && item.startTime === periods[i][0]
            );

            if (r) {
                let end = periods.findIndex((p, j) =>
                    j >= i && p[1] === r.endTime
                );

                if (end < i) end = i;
                const span = end - i + 1;

                html += `<td colspan="${span}" class="class-cell">
                    <strong>${safe(r.courseCode)}</strong>
                    <span>${safe(r.courseName)}</span>
                    <small>${safe(r.startTime)}–${safe(r.endTime)}
                    | Room ${safe(r.room)}</small>
                    <div class="actions">
                    <button onclick="editRoutine('${r.id}')">Edit</button>
                    <button onclick="deleteRoutine('${r.id}')">Delete</button>
                    </div>
                    </td>`;

                i += span;
            } else {
                html += '<td class="empty-cell">—</td>';
                i++;
            }
        }
        html += '</tr>';
    });

    $('routineList').innerHTML = html + '</tbody></table>';
}

function timeMinutes(time) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

async function routineForm(old = null) {
    if (!courses.length) return message('Add a course first.');

    const course = prompt(
        'Course code: ' + courses.map(c => c.code).join(', '),
        old?.courseCode || courses[0].code
    );

    if (course === null) return;

    const selected = courses.find(c =>
        c.code.toLowerCase() === course.toLowerCase()
    );

    if (!selected) return message('Course not found.');

    const day = prompt('Day:', old?.day || 'Saturday');
    if (!days.includes(day)) return message('Invalid day.');

    const oldIndex = periods.findIndex(p => p[0] === old?.startTime);
    const start = Number(prompt('Starting period (1-9):',
        oldIndex >= 0 ? oldIndex + 1 : 1));

    if (!Number.isInteger(start) || start < 1 || start > 9)
        return message('Invalid period.');

    const index = start - 1;
    const max = index < 3 ? 3 - index : 9 - index;

    const duration = Number(prompt(`Duration (1-${max}):`, '1'));

    if (!Number.isInteger(duration) || duration < 1 || duration > max)
        return message('Invalid duration. Class cannot cross the break.');

    const startTime = periods[index][0];
    const endTime = periods[index + duration - 1][1];

    const room = prompt('Room:', old?.room || '');
    if (!room || !room.trim()) return;

    const clash = routines.some(r =>
        r.id !== old?.id && r.day === day &&
        startTime < r.endTime && endTime > r.startTime
    );

    if (clash) return message('Another class exists at this time.');

    const data = {
        id: old?.id,
        courseId: selected.id,
        courseName: selected.name,
        courseCode: selected.code,
        day, startTime, endTime, room
    };

    if (old) await window.coursesAPI.editRoutine(data);
    else await window.coursesAPI.addRoutine(data);

    await loadData();
}

$('addRoutine').onclick = () => routineForm();

window.editRoutine = id =>
    routineForm(routines.find(r => r.id === id));

window.deleteRoutine = async id => {
    if (!confirm('Delete this class?')) return;
    await window.coursesAPI.deleteRoutine(id);
    await loadData();
};

$('exportRoutine').onclick = () => window.print();

// Exam Planner
function renderExams() {
    const sorted = [...exams].sort((a, b) =>
        a.date.localeCompare(b.date)
    );

    const upcoming = sorted.filter(e =>
        e.date >= new Date().toISOString().slice(0, 10)
    );

    $('examSummary').innerHTML = `
        <article><small>Total Exams</small><h2>${exams.length}</h2></article>
        <article><small>Upcoming</small><h2>${upcoming.length}</h2></article>
        <article><small>Prepared</small><h2>${exams.filter(e => e.status === 'Prepared').length}</h2></article>
        <article><small>In Progress</small><h2>${exams.filter(e => e.status === 'In progress').length}</h2></article>`;

    $('examList').innerHTML = sorted.length
        ? sorted.map(e => `
        <div class="card">
            <h3>${safe(e.course)} - ${safe(e.type)}</h3>
            <p>${safe(e.date)} ${safe(e.time || '')}</p>
            <p>Room: ${safe(e.room || 'Not added')}</p>
            <p>Status: ${safe(e.status)}</p>
            <div class="actions">
                <button onclick="editExam('${e.id}')">Edit</button>
                <button onclick="deleteExam('${e.id}')">Delete</button>
            </div>
        </div>`).join('')
        : '<article>No exams planned.</article>';
}

function examForm(old = null) {
    if (!courses.length) return message('Add a course first.');

    const course = prompt('Course code:',
        old?.course || courses[0].code);

    if (course === null) return;

    if (!courses.some(c => c.code.toLowerCase() === course.toLowerCase()))
        return message('Course not found.');

    const type = prompt('Exam type:', old?.type || 'Midterm');
    if (!type) return;

    const date = prompt('Date (YYYY-MM-DD):',
        old?.date || new Date().toISOString().slice(0, 10));

    if (!date) return;

    const time = prompt('Time:', old?.time || '') || '';
    const room = prompt('Room:', old?.room || '') || '';

    const status = prompt('Status: Not started, In progress, Prepared',
        old?.status || 'Not started');

    if (!['Not started', 'In progress', 'Prepared'].includes(status))
        return message('Invalid status.');

    if (exams.some(e =>
        e.id !== old?.id && e.course === course &&
        e.type === type && e.date === date
    )) return message('This exam already exists.');

    const item = {
        id: old?.id || Date.now().toString(),
        course, type, date, time, room, status
    };

    if (old) exams = exams.map(e => e.id === old.id ? item : e);
    else exams.push(item);

    saveExams();
    render();
}

$('addExam').onclick = () => examForm();

window.editExam = id =>
    examForm(exams.find(e => e.id === id));

window.deleteExam = id => {
    if (!confirm('Delete this exam?')) return;
    exams = exams.filter(e => e.id !== id);
    saveExams();
    render();
};

// Dashboard
function renderDashboard() {
    const today = days[(new Date().getDay() + 1) % 7];

    const list = routines.filter(r => r.day === today)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

    $('courseCount').textContent = courses.length;

    $('creditCount').textContent = courses.reduce(
        (sum, c) => sum + Number(c.credit), 0
    );

    $('todayCount').textContent = list.length;

    $('examCount').textContent = exams.filter(e =>
        e.date >= new Date().toISOString().slice(0, 10)
    ).length;

    $('todayList').innerHTML = list.length
        ? list.map(r => `
        <div class="row">
            <strong>${safe(r.courseName)}</strong>
            <small>${safe(r.startTime)}–${safe(r.endTime)} | Room ${safe(r.room)}</small>
        </div>`).join('')
        : '<p>No classes scheduled today.</p>';

    const next = exams.filter(e =>
        e.date >= new Date().toISOString().slice(0, 10)
    ).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);

    $('nextExams').innerHTML = next.length
        ? next.map(e => `
        <div class="row">
            <strong>${safe(e.course)} - ${safe(e.type)}</strong>
            <small>${safe(e.date)} | ${safe(e.status)}</small>
        </div>`).join('')
        : '<p>No upcoming exams.</p>';
}

// Student Profile
function applyProfile() {
    const s = JSON.parse(localStorage.getItem('classsyncSettings') || '{}');

    $('profileName').textContent = s.name || 'Student';

    $('profileBadge').innerHTML = s.photo
        ? `<img src="${s.photo}" alt="Profile">`
        : safe(s.initial || 'S');

    $('photoPreview').src = s.photo || '';
}

function loadSettings() {
    const s = JSON.parse(localStorage.getItem('classsyncSettings') || '{}');

    $('studentName').value = s.name || '';
    $('studentInitial').value = s.initial || 'S';
    $('darkMode').checked = !!s.dark;

    document.body.classList.toggle('dark', !!s.dark);
    applyProfile();
}

$('studentPhoto').onchange = event => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/'))
        return message('Choose a valid image.');

    const reader = new FileReader();

    reader.onload = () => {
        const img = new Image();

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 300;
            canvas.height = 300;

            const size = Math.min(img.width, img.height);
            const x = (img.width - size) / 2;
            const y = (img.height - size) / 2;

            canvas.getContext('2d').drawImage(
                img, x, y, size, size, 0, 0, 300, 300
            );

            const s = JSON.parse(
                localStorage.getItem('classsyncSettings') || '{}'
            );

            s.photo = canvas.toDataURL('image/jpeg', 0.82);

            localStorage.setItem('classsyncSettings', JSON.stringify(s));
            applyProfile();
        };

        img.src = reader.result;
    };

    reader.readAsDataURL(file);
};

$('removePhoto').onclick = () => {
    const s = JSON.parse(localStorage.getItem('classsyncSettings') || '{}');

    delete s.photo;

    localStorage.setItem('classsyncSettings', JSON.stringify(s));
    $('studentPhoto').value = '';
    applyProfile();
};

$('saveSettings').onclick = () => {
    const old = JSON.parse(
        localStorage.getItem('classsyncSettings') || '{}'
    );

    const s = {
        ...old,
        name: $('studentName').value,
        initial: $('studentInitial').value || 'S',
        dark: $('darkMode').checked
    };

    localStorage.setItem('classsyncSettings', JSON.stringify(s));

    document.body.classList.toggle('dark', s.dark);
    applyProfile();

    $('settingsMessage').textContent = 'Settings saved successfully!';
};

// Start application
loadSettings();
loadData();
