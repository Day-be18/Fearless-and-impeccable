// Обработчик ошибок загрузки ресурсов
(function() {
    'use strict';

    // Перехватываем ошибки загрузки ресурсов
    window.addEventListener('error', function(event) {
        if (event.target !== window) {
            var target = event.target;
            var filename = target.src || target.href || target.data || '';
            
            // Игнорируем ошибки 404 для некритичных ресурсов
            if (filename.includes('manifest') || 
                filename.includes('favicon') || 
                filename.includes('apple-touch') ||
                filename.includes('browserconfig')) {
                console.warn('⚠ Некритичный ресурс недоступен:', filename);
                event.preventDefault();
            }
        }
    }, true);

    // Отключаем попытку загрузки несуществующих ссылок
    document.addEventListener('load', function(event) {
        if (event.target.tagName === 'LINK') {
            var href = event.target.getAttribute('href');
            if (href && (href.includes('manifest') || href.includes('browserconfig'))) {
                console.warn('⚠ LINK ресурс загружен:', href);
            }
        }
    }, true);
})();
