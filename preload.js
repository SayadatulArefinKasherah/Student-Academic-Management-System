const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('coursesAPI', {
    getCourses: () => ipcRenderer.invoke('courses:get'),
    addCourse: course => ipcRenderer.invoke('courses:add', course),
    editCourse: course => ipcRenderer.invoke('courses:edit', course),
    deleteCourse: id => ipcRenderer.invoke('courses:delete', id),

    getRoutines: () => ipcRenderer.invoke('routines:get'),
    addRoutine: routine => ipcRenderer.invoke('routines:add', routine),
    editRoutine: routine => ipcRenderer.invoke('routines:edit', routine),
    deleteRoutine: id => ipcRenderer.invoke('routines:delete', id)
});
