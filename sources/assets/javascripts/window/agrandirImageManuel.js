// Variables pour suivre l'état du redimensionnement
var resizing = false;
var initialWidth, initialHeight;
var startX, startY;

// Événement pour commencer le redimensionnement
window.addEventListener('mousedown', function(event) {
    if (event.target.classList.contains('window-resize-handle')) {
        resizing = true;
        startX = event.clientX;
        startY = event.clientY;
        initialWidth = event.target.closest('.window').offsetWidth;
        initialHeight = event.target.closest('.window').offsetHeight;
    }
});

// Événement pour redimensionner la fenêtre
window.addEventListener('mousemove', function(event) {
    if (resizing) {
        var newWidth = initialWidth + (event.clientX - startX);
        var newHeight = initialHeight + (event.clientY - startY);
        event.target.closest('.window').style.width = newWidth + 'px';
        event.target.closest('.window').style.height = newHeight + 'px';
    }
});

// Événement pour arrêter le redimensionnement
window.addEventListener('mouseup', function() {
    resizing = false;
});
