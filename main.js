const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const dataPath = path.join(__dirname, 'data');
const courseFile = path.join(dataPath, 'courses.json');
const routineFile = path.join(dataPath, 'routines.json');

function readData(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return [];
    }
}

function writeData(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'Student Academic Management System',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.loadFile('src/index.html');
}

app.whenReady().then(() => {
    if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath);
    if (!fs.existsSync(courseFile)) writeData(courseFile, []);
    if (!fs.existsSync(routineFile)) writeData(routineFile, []);

    ipcMain.handle('courses:get', () => readData(courseFile));

    ipcMain.handle('courses:add', (event, course) => {
        const courses = readData(courseFile);
        course.id = Date.now().toString();
        courses.push(course);
        writeData(courseFile, courses);
        return courses;
    });

    ipcMain.handle('courses:edit', (event, course) => {
        const courses = readData(courseFile).map(item =>
            item.id === course.id ? course : item
        );
        writeData(courseFile, courses);
        return courses;
    });

    ipcMain.handle('courses:delete', (event, id) => {
        const courses = readData(courseFile).filter(item => item.id !== id);
        writeData(courseFile, courses);
        return courses;
    });

    ipcMain.handle('routines:get', () => readData(routineFile));

    ipcMain.handle('routines:add', (event, routine) => {
        const routines = readData(routineFile);
        routine.id = Date.now().toString();
        const course = readData(courseFile).find(c => c.id === routine.courseId);

        if (!course) throw new Error('Course not found.');

        routine.courseName = course.name;
        routine.courseCode = course.code;
        routines.push(routine);
        writeData(routineFile, routines);
        return routines;
    });

    ipcMain.handle('routines:edit', (event, routine) => {
        const routines = readData(routineFile).map(item =>
            item.id === routine.id ? routine : item
        );
        writeData(routineFile, routines);
        return routines;
    });

    ipcMain.handle('routines:delete', (event, id) => {
        const routines = readData(routineFile).filter(item => item.id !== id);
        writeData(routineFile, routines);
        return routines;
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});