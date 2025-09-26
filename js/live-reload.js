/**
 * Live Reload - скрипт для автоматического обновления страницы при изменении файлов
 */

(function() {
    // Время последней модификации страницы
    let lastModified = new Date().getTime();
    
    // Статус соединения
    let isConnected = true;
    
    // Создаем элемент статуса, если его нет
    let statusElement = document.getElementById('live-reload-status');
    if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.id = 'live-reload-status';
        statusElement.style.position = 'fixed';
        statusElement.style.bottom = '10px';
        statusElement.style.right = '10px';
        statusElement.style.padding = '5px 10px';
        statusElement.style.borderRadius = '3px';
        statusElement.style.fontSize = '12px';
        statusElement.style.zIndex = '9999';
        statusElement.style.opacity = '0.7';
        statusElement.style.transition = 'opacity 0.3s';
        statusElement.style.backgroundColor = '#4a6fa5';
        statusElement.style.color = 'white';
        statusElement.textContent = 'Live Reload активен';
        
        // Добавляем возможность скрыть статус при наведении
        statusElement.addEventListener('mouseover', function() {
            this.style.opacity = '0.2';
        });
        statusElement.addEventListener('mouseout', function() {
            this.style.opacity = '0.7';
        });
        
        document.body.appendChild(statusElement);
    }
    
    /**
     * Проверяет изменения файлов и перезагружает страницу при необходимости
     */
    function checkForChanges() {
        fetch(window.location.href, { method: 'HEAD', cache: 'no-store' })
            .then(response => {
                // Обновляем статус соединения
                if (!isConnected) {
                    isConnected = true;
                    statusElement.style.backgroundColor = '#4a6fa5';
                    statusElement.textContent = 'Live Reload активен';
                }
                
                // Проверяем время последней модификации
                const serverLastModified = new Date(response.headers.get('Last-Modified')).getTime();
                if (serverLastModified > lastModified) {
                    console.log('[Live Reload] Обнаружены изменения, перезагрузка страницы...');
                    location.reload();
                    lastModified = serverLastModified;
                }
            })
            .catch(err => {
                console.error('[Live Reload] Ошибка проверки обновлений:', err);
                if (isConnected) {
                    isConnected = false;
                    statusElement.style.backgroundColor = '#dc3545';
                    statusElement.textContent = 'Live Reload отключен';
                }
            });
    }
    
    // Проверяем изменения каждую секунду
    setInterval(checkForChanges, 1000);
    
    // Выводим сообщение в консоль
    console.log('[Live Reload] Инициализирован. Страница будет автоматически обновляться при изменении файлов.');
})();