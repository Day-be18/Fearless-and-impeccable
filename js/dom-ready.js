// Патч для исправления ошибки в updateSyncIndicator
(function() {
    // Ждем, когда document будет готов
    function patchUpdateSyncIndicator() {
        var indicator = document.getElementById('syncIndicator');
        if (!indicator) {
            // Повторим попытку через 100ms
            setTimeout(patchUpdateSyncIndicator, 100);
            return;
        }

        // Все окей, DOM готов
        console.log('✓ DOM инициализирован, можно работать с syncIndicator');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', patchUpdateSyncIndicator);
    } else {
        patchUpdateSyncIndicator();
    }
})();
