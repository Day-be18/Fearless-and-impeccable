// Функция для безопасного обновления индикатора синхронизации
(function() {
    'use strict';

    window.updateSyncIndicatorSafely = function(state, message) {
        try {
            var indicator = document.getElementById('syncIndicator');
            if (!indicator) {
                console.warn('Индикатор синхронизации не найден');
                return;
            }
            
            // Сбрасываем классы
            indicator.classList.remove('syncing', 'error', 'synced');
            
            var icon = indicator.querySelector('i');
            var status = indicator.querySelector('.sync-status');
            
            // Проверяем наличие элементов
            if (!icon || !status) {
                console.warn('Элементы индикатора не найдены');
                return;
            }
            
            // Обновляем состояние
            switch (state) {
                case 'syncing':
                    indicator.classList.add('syncing');
                    icon.className = 'fas fa-sync';
                    status.textContent = 'Синхронизация...';
                    break;
                case 'error':
                    indicator.classList.add('error');
                    icon.className = 'fas fa-exclamation-circle';
                    status.textContent = message || 'Ошибка синхронизации';
                    break;
                case 'synced':
                    indicator.classList.add('synced');
                    icon.className = 'fas fa-cloud-upload-alt';
                    status.textContent = 'Синхронизировано';
                    setTimeout(function() {
                        if (indicator && icon && status) {
                            indicator.classList.remove('synced');
                            icon.className = 'fas fa-cloud';
                            status.textContent = 'Локально';
                        }
                    }, 3000);
                    break;
                default:
                    if (icon) icon.className = 'fas fa-cloud';
                    if (status) status.textContent = 'Локально';
            }
        } catch (err) {
            console.error('Ошибка при обновлении индикатора синхронизации:', err);
        }
    };
})();
