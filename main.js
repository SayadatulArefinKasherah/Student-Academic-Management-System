
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');

const files = {
    courses: 'courses.json',
    routines: 'routines.json'
};

function readData(type) {
    const file = path.join(dataDir, files[type]);

    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return [];
    }
}

function writeData(type, data) {
    if (!files[type]) throw new Error('Invalid data type');

    fs.writeFileSync(
        path.join(dataDir, files[type]),
        JSON.stringify(data, null, 2)
    );

    return data;
}

// COURSE HANDLERS
ipcMain.handle('courses:get', () => readData('courses'));

ipcMain.handle('courses:add', (_, course) => {
    const courses = readData('courses');

    course.id = Date.now().toString();
    courses.push(course);

    return writeData('courses', courses);
});

ipcMain.handle('courses:edit', (_, course) => {
    const courses = readData('courses').map(item =>
        item.id === course.id ? course : item
    );

    return writeData('courses', courses);
});

ipcMain.handle('courses:delete', (_, id) => {
    const courses = readData('courses').filter(
        item => item.id !== id
    );

    return writeData('courses', courses);
});

// ROUTINE HANDLERS
ipcMain.handle('routines:get', () => readData('routines'));

ipcMain.handle('routines:add', (_, routine) => {
    const routines = readData('routines');
    const course = readData('courses').find(
        c => c.id === routine.courseId
    );

    if (!course) throw new Error('Course not found');

    routine.id = Date.now().toString();
    routine.courseName = course.name;
    routine.courseCode = course.code;

    routines.push(routine);

    return writeData('routines', routines);
});

ipcMain.handle('routines:edit', (_, routine) => {
    const course = readData('courses').find(
        c => c.id === routine.courseId
    );

    if (!course) throw new Error('Course not found');

    routine.courseName = course.name;
    routine.courseCode = course.code;

    const routines = readData('routines').map(item =>
        item.id === routine.id ? routine : item
    );

    return writeData('routines', routines);
});

ipcMain.handle('routines:delete', (_, id) => {
    const routines = readData('routines').filter(
        item => item.id !== id
    );

    return writeData('routines', routines);
});

// CREATE WINDOW
function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 850,
        minHeight: 600,

        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
    fs.mkdirSync(dataDir, { recursive: true });

    Object.values(files).forEach(file => {
        const location = path.join(dataDir, file);

        if (!fs.existsSync(location)) {
            fs.writeFileSync(location, '[]');
        }
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
