// Главный инициализирующий скрипт
(function() {
    'use strict';

    console.log('🚀 Инициализация приложения...');

    // Флаг инициализации
    var isInitialized = false;

    // Функция для запуска инициализации
    function initializeApp() {
        if (isInitialized) return;
        isInitialized = true;

        console.log('📋 Проверяем готовность DOM...');
        
        // Проверяем наличие ключевых элементов
        var requiredElements = [
            'templatesGrid',
            'addTemplateBtn',
            'importBtn',
            'searchInput',
            'categoryFilter',
            'syncIndicator'
        ];

        var allReady = true;
        requiredElements.forEach(function(id) {
            if (!document.getElementById(id)) {
                console.warn('⚠ Элемент не найден:', id);
                allReady = false;
            }
        });

        if (!allReady) {
            console.error('✗ Требуемые элементы DOM не найдены');
            return;
        }

        console.log('✓ DOM готов');

        // Проверяем наличие TemplateDB
        if (!window.TemplateDB) {
            console.warn('⚠ TemplateDB еще не инициализирован, ждем...');
            setTimeout(initializeApp, 100);
            return;
        }

        console.log('✓ TemplateDB инициализирован');

        // Проверяем наличие TemplateApp
        if (!window.app || typeof window.app.init !== 'function') {
            console.warn('⚠ TemplateApp еще не инициализирован, ждем...');
            setTimeout(initializeApp, 100);
            return;
        }

        console.log('✓ Приложение успешно инициализировано');
        console.log('🎉 Все системы работают нормально');
    }

    // Ждем DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            console.log('📄 DOM загружен, инициализируем...');
            setTimeout(initializeApp, 200);
        });
    } else {
        console.log('📄 DOM уже загружен, инициализируем...');
        setTimeout(initializeApp, 200);
    }

    // Также инициализируем при загрузке окна
    window.addEventListener('load', function() {
        console.log('🔧 Окно загружено, проверяем инициализацию...');
        setTimeout(initializeApp, 100);
    });
})();
