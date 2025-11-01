// Модуль для работы с базой данных
(function() {
    'use strict';
    
    // Конфигурация базы данных
    const DB_CONFIG = {
        name: 'TemplatesDB',
        version: 1,
        storeName: 'templates',
        keyPath: 'id'
    };
    
    // Обновление индикатора синхронизации
    function updateSyncIndicator(state, message = '') {
        const indicator = document.getElementById('syncIndicator');
        if (!indicator) return;
        
        indicator.classList.remove('syncing', 'error', 'synced');
        const icon = indicator.querySelector('i');
        const status = indicator.querySelector('.sync-status');
        
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
                setTimeout(() => {
                    indicator.classList.remove('synced');
                    icon.className = 'fas fa-cloud';
                    status.textContent = 'Локально';
                }, 3000);
                break;
            default:
                icon.className = 'fas fa-cloud';
                status.textContent = 'Локально';
        }
    }
    
    // Класс для работы с базой данных
    class TemplateDatabase {
        constructor() {
            this.db = null;
            this.isInitialized = false;
            this.useIndexedDB = true;
            this.supabase = window.supabase; // Интеграция с Supabase
            this.syncEnabled = true; // Флаг для управления синхронизацией
            this.syncInterval = null; // Интервал автоматической синхронизации
            this.lastSyncTime = null; // Время последней синхронизации
            this.offlineQueue = []; // Очередь операций для выполнения при восстановлении соединения

            // Слушаем состояние сети
            if (typeof window !== 'undefined') {
                window.addEventListener('online', this.handleOnline.bind(this));
                window.addEventListener('offline', this.handleOffline.bind(this));
            }
        }
        
        // Обработчик восстановления соединения
        async handleOnline() {
            console.log('Соединение восстановлено');
            updateSyncIndicator('syncing');
            
            try {
                // Проверяем подключение к Supabase
                const isConnected = await this.checkSupabaseConnection();
                if (!isConnected) {
                    updateSyncIndicator('error', 'Нет подключения к облаку');
                    return;
                }

                // Запускаем синхронизацию
                await this.forceSyncWithSupabase();
                
                // Обрабатываем очередь офлайн-операций
                while (this.offlineQueue.length > 0) {
                    const operation = this.offlineQueue.shift();
                    try {
                        await this.processOfflineOperation(operation);
                    } catch (err) {
                        console.error('Ошибка обработки офлайн-операции:', err);
                        this.offlineQueue.unshift(operation); // Возвращаем операцию в очередь
                        break;
                    }
                }
            } catch (err) {
                console.error('Ошибка при обработке восстановления соединения:', err);
                updateSyncIndicator('error', 'Ошибка синхронизации');
            }
        }
        
        // Обработчик потери соединения
        handleOffline() {
            console.log('Соединение потеряно');
            updateSyncIndicator('error', 'Нет подключения');
            if (this.syncInterval) {
                clearInterval(this.syncInterval);
                this.syncInterval = null;
            }
        }
        
        // Обработка офлайн-операции
        async processOfflineOperation(operation) {
            switch (operation.type) {
                case 'add':
                    await this.addToSupabase(operation.data);
                    break;
                case 'update':
                    await this.updateInSupabase(operation.data);
                    break;
                case 'delete':
                    await this.deleteFromSupabase(operation.id);
                    break;
            }
        }
        
        // Добавление операции в офлайн-очередь
        addToOfflineQueue(type, data) {
            this.offlineQueue.push({ type, data, timestamp: Date.now() });
        }

        // Метод для синхронизации с Supabase
        async syncWithSupabase(force = false) {
            if ((!this.syncEnabled || !this.supabase) && !force) return;

            try {
                const now = Date.now();
                // Проверяем, прошло ли достаточно времени с последней синхронизации
                if (!force && this.lastSyncTime && (now - this.lastSyncTime < 30000)) { // 30 секунд
                    console.log('Пропуск синхронизации: слишком частые запросы');
                    return;
                }

                updateSyncIndicator('syncing');

                // Получаем все локальные шаблоны
                const localTemplates = await this.getAllTemplates();
                
                // Получаем все шаблоны из Supabase
                const { data: remoteTemplates, error } = await this.supabase
                    .from('templates')
                    .select('*');

                if (error) {
                    if (error.code === '404' || error.code === 'PGRST116') {
                        // Таблица не существует, создаём и синхронизируем локальные данные
                        await this.supabase.rpc('init_templates_table');
                        const localTemplates = await this.getAllTemplates();
                        if (localTemplates.length > 0) {
                            const { error: insertError } = await this.supabase
                                .from('templates')
                                .insert(localTemplates);
                            if (insertError) throw insertError;
                        }
                        return;
                    }
                    throw error;
                }

                // Создаём Map для быстрого поиска
                const localMap = new Map(localTemplates.map(t => [t.id, t]));
                const remoteMap = new Map(remoteTemplates.map(t => [t.id, t]));

                // Синхронизация: обновляем локальные данные
                for (const [id, remoteTemplate] of remoteMap) {
                    const localTemplate = localMap.get(id);
                    if (!localTemplate) {
                        // Добавляем отсутствующие локально
                        await this.addTemplate(remoteTemplate);
                        console.log('Синхронизирован из облака:', remoteTemplate.name);
                    } else if (new Date(remoteTemplate.dateModified) > new Date(localTemplate.dateModified)) {
                        // Обновляем если удаленная версия новее
                        await this.updateTemplate(remoteTemplate);
                        console.log('Обновлен из облака:', remoteTemplate.name);
                    }
                }

                // Синхронизация: отправляем локальные изменения
                for (const [id, localTemplate] of localMap) {
                    const remoteTemplate = remoteMap.get(id);
                    if (!remoteTemplate) {
                        // Отправляем отсутствующие в облаке
                        const { error } = await this.supabase
                            .from('templates')
                            .insert([localTemplate]);
                        if (error) {
                            console.warn('Ошибка синхронизации с облаком:', error);
                        } else {
                            console.log('Отправлен в облако:', localTemplate.name);
                        }
                    } else if (new Date(localTemplate.dateModified) > new Date(remoteTemplate.dateModified)) {
                        // Обновляем если локальная версия новее
                        const { error } = await this.supabase
                            .from('templates')
                            .update(localTemplate)
                            .eq('id', id);
                        if (error) {
                            console.warn('Ошибка обновления в облаке:', error);
                        } else {
                            console.log('Обновлен в облаке:', localTemplate.name);
                        }
                    }
                }

                this.lastSyncTime = now;
                console.info('Синхронизация завершена успешно');
                updateSyncIndicator('synced');
            } catch (err) {
                console.error('Ошибка синхронизации:', err);
                updateSyncIndicator('error', err.message);
                throw err; // Пробрасываем ошибку для обработки выше
            }
        }

        // Принудительная синхронизация
        async forceSyncWithSupabase() {
            try {
                await this.syncWithSupabase(true);
                return true;
            } catch (err) {
                console.error('Ошибка принудительной синхронизации:', err);
                return false;
            }
        }
        
        // Проверка подключения к Supabase
        async checkSupabaseConnection() {
            if (!this.supabase) return false;
            try {
                const { error } = await this.supabase
                    .from('templates')
                    .select('id')
                    .limit(1)
                    .maybeSingle();
                
                if (error) {
                    if (error.code === '404' || error.code === 'PGRST116') {
                        // Таблица не существует, попробуем создать
                        try {
                            await this.supabase.rpc('init_templates_table');
                            return true;
                        } catch (initError) {
                            console.warn('Не удалось создать таблицу:', initError);
                            return false;
                        }
                    }
                    throw error;
                }
                return true;
            } catch (err) {
                if (err.message?.includes('Failed to fetch')) {
                    console.warn('Supabase недоступен, работаем локально');
                } else {
                    console.warn('Ошибка проверки подключения к Supabase:', err);
                }
                return false;
            }
        }

        // Инициализация базы данных
        async init() {
            if (this.isInitialized) return;
            
            try {
                // Пробуем использовать IndexedDB
                if (this.useIndexedDB && 'indexedDB' in window) {
                    await this.initIndexedDB();
                } else {
                    // Fallback на localStorage
                    this.useIndexedDB = false;
                    this.initLocalStorage();
                }
                
                this.isInitialized = true;
                console.log('База данных инициализирована:', this.useIndexedDB ? 'IndexedDB' : 'localStorage');
                
                // Проверяем подключение к Supabase и запускаем синхронизацию
                if (this.supabase && this.syncEnabled) {
                    const isConnected = await this.checkSupabaseConnection();
                    if (isConnected) {
                        await this.startAutoSync();
                    } else {
                        updateSyncIndicator('error', 'Нет подключения к облаку');
                        // Повторная попытка подключения через 30 секунд
                        setTimeout(async () => {
                            const retryConnection = await this.checkSupabaseConnection();
                            if (retryConnection) {
                                await this.startAutoSync();
                            }
                        }, 30000);
                    }
                }
            } catch (error) {
                console.error('Ошибка при инициализации базы данных:', error);
                // Fallback на localStorage
                this.useIndexedDB = false;
                this.initLocalStorage();
                this.isInitialized = true;
                updateSyncIndicator('error', 'Ошибка инициализации');
            }
        }
        
        // Запуск автоматической синхронизации
        async startAutoSync(interval = 5 * 60 * 1000) { // По умолчанию каждые 5 минут
            if (this.syncInterval) {
                clearInterval(this.syncInterval);
            }
            
            const sync = async () => {
                if (!navigator.onLine) {
                    updateSyncIndicator('error', 'Нет подключения');
                    return;
                }

                try {
                    const isConnected = await this.checkSupabaseConnection();
                    if (!isConnected) {
                        updateSyncIndicator('error', 'Нет доступа к облаку');
                        return;
                    }

                    await this.syncWithSupabase();
                    this.lastSyncTime = Date.now();
                } catch (err) {
                    console.error('Ошибка синхронизации:', err);
                    updateSyncIndicator('error', err.message || 'Ошибка синхронизации');
                }
            };
            
            // Выполняем первичную синхронизацию
            await sync();
            
            // Устанавливаем интервал для регулярной синхронизации
            this.syncInterval = setInterval(sync, interval);
            
            // Добавляем обработчик для синхронизации при восстановлении соединения
            window.addEventListener('online', () => {
                console.log('Соединение восстановлено, запускаем синхронизацию...');
                sync();
            });
            
            console.log('Автоматическая синхронизация активирована');
        }

        // Добавление в Supabase
        async addToSupabase(template) {
            if (!this.supabase) return;
            try {
                const { error } = await this.supabase
                    .from('templates')
                    .insert([template])
                    .select();

                if (error) {
                    if (error.code === '404' || error.code === 'PGRST116') {
                        await this.supabase.rpc('init_templates_table');
                        return await this.addToSupabase(template);
                    }
                    throw error;
                }
            } catch (err) {
                console.error('Ошибка добавления в Supabase:', err);
                this.addToOfflineQueue('add', template);
                throw err;
            }
        }

        // Обновление в Supabase
        async updateInSupabase(template) {
            if (!this.supabase) return;
            try {
                const { error } = await this.supabase
                    .from('templates')
                    .update(template)
                    .eq('id', template.id)
                    .select();

                if (error) {
                    if (error.code === '404' || error.code === 'PGRST116') {
                        await this.supabase.rpc('init_templates_table');
                        return await this.updateInSupabase(template);
                    }
                    throw error;
                }
            } catch (err) {
                console.error('Ошибка обновления в Supabase:', err);
                this.addToOfflineQueue('update', template);
                throw err;
            }
        }

        // Удаление из Supabase
        async deleteFromSupabase(id) {
            if (!this.supabase) return;
            try {
                const { error } = await this.supabase
                    .from('templates')
                    .delete()
                    .eq('id', id)
                    .select();

                if (error) {
                    if (error.code === '404' || error.code === 'PGRST116') {
                        await this.supabase.rpc('init_templates_table');
                        return await this.deleteFromSupabase(id);
                    }
                    throw error;
                }
            } catch (err) {
                console.error('Ошибка удаления из Supabase:', err);
                this.addToOfflineQueue('delete', { id });
                throw err;
            }
        }
        
        // Остановка автоматической синхронизации
        stopAutoSync() {
            if (this.syncInterval) {
                clearInterval(this.syncInterval);
                this.syncInterval = null;
                console.log('Автоматическая синхронизация остановлена');
            }
        }
        
        // Инициализация IndexedDB
        async initIndexedDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);
                
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    this.db = request.result;
                    resolve();
                };
                
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    
                    // Создаём хранилище для шаблонов
                    if (!db.objectStoreNames.contains(DB_CONFIG.storeName)) {
                        const store = db.createObjectStore(DB_CONFIG.storeName, { keyPath: DB_CONFIG.keyPath });
                        
                        // Создаём индексы для поиска
                        store.createIndex('name', 'name', { unique: false });
                        store.createIndex('category', 'category', { unique: false });
                        store.createIndex('favorite', 'favorite', { unique: false });
                        store.createIndex('dateCreated', 'dateCreated', { unique: false });
                        store.createIndex('dateModified', 'dateModified', { unique: false });
                    }
                };
            });
        }
        
        // Инициализация localStorage
        initLocalStorage() {
            // Проверяем, есть ли уже данные
            if (!localStorage.getItem('templates')) {
                localStorage.setItem('templates', JSON.stringify([]));
            }
        }
        
        // Получение всех шаблонов
        async getAllTemplates() {
            await this.ensureInitialized();
            
            try {
                if (this.useIndexedDB) {
                    return await this.getAllFromIndexedDB();
                } else {
                    return this.getAllFromLocalStorage();
                }
            } catch (error) {
                console.error('Ошибка при получении шаблонов:', error);
                return [];
            }
        }
        
        // Получение из IndexedDB
        async getAllFromIndexedDB() {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([DB_CONFIG.storeName], 'readonly');
                const store = transaction.objectStore(DB_CONFIG.storeName);
                const request = store.getAll();
                
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result || []);
            });
        }
        
        // Получение из localStorage
        getAllFromLocalStorage() {
            try {
                const templates = localStorage.getItem('templates');
                return templates ? JSON.parse(templates) : [];
            } catch (error) {
                console.error('Ошибка при чтении из localStorage:', error);
                return [];
            }
        }
        
        // Добавление шаблона
        async addTemplate(template) {
            await this.ensureInitialized();
            
            try {
                // Генерируем ID и даты
                const newTemplate = {
                    ...template,
                    id: template.id || this.generateId(),
                    dateCreated: template.dateCreated || new Date().toISOString(),
                    dateModified: new Date().toISOString(),
                    favorite: template.favorite || false
                };
                
                // Сохраняем локально
                if (this.useIndexedDB) {
                    await this.addToIndexedDB(newTemplate);
                } else {
                    this.addToLocalStorage(newTemplate);
                }
                
                // Синхронизируем с Supabase если доступен и есть подключение
                if (this.supabase && this.syncEnabled) {
                    if (navigator.onLine) {
                        try {
                            const { error } = await this.supabase
                                .from('templates')
                                .insert([newTemplate]);
                            if (error) {
                                console.warn('Ошибка синхронизации с Supabase:', error);
                                this.addToOfflineQueue('add', newTemplate);
                            }
                        } catch (err) {
                            console.warn('Ошибка сети при синхронизации:', err);
                            this.addToOfflineQueue('add', newTemplate);
                        }
                    } else {
                        this.addToOfflineQueue('add', newTemplate);
                    }
                }
                
                console.log('Шаблон добавлен:', newTemplate.id);
                return newTemplate;
            } catch (error) {
                console.error('Ошибка при добавлении шаблона:', error);
                throw error;
            }
        }
        
        // Добавление в IndexedDB
        async addToIndexedDB(template) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([DB_CONFIG.storeName], 'readwrite');
                const store = transaction.objectStore(DB_CONFIG.storeName);
                const request = store.add(template);
                
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });
        }
        
        // Добавление в localStorage
        addToLocalStorage(template) {
            try {
                const templates = this.getAllFromLocalStorage();
                templates.push(template);
                localStorage.setItem('templates', JSON.stringify(templates));
            } catch (error) {
                console.error('Ошибка при записи в localStorage:', error);
                throw error;
            }
        }
        
        // Обновление шаблона
        async updateTemplate(template) {
            await this.ensureInitialized();
            
            try {
                const updatedTemplate = {
                    ...template,
                    dateModified: new Date().toISOString()
                };
                
                // Обновляем локально
                if (this.useIndexedDB) {
                    await this.updateInIndexedDB(updatedTemplate);
                } else {
                    this.updateInLocalStorage(updatedTemplate);
                }
                
                // Синхронизируем с Supabase если доступен и есть подключение
                if (this.supabase && this.syncEnabled) {
                    if (navigator.onLine) {
                        try {
                            const { error } = await this.supabase
                                .from('templates')
                                .update(updatedTemplate)
                                .eq('id', updatedTemplate.id);
                            if (error) {
                                console.warn('Ошибка синхронизации с Supabase:', error);
                                this.addToOfflineQueue('update', updatedTemplate);
                            }
                        } catch (err) {
                            console.warn('Ошибка сети при обновлении:', err);
                            this.addToOfflineQueue('update', updatedTemplate);
                        }
                    } else {
                        this.addToOfflineQueue('update', updatedTemplate);
                    }
                }
                
                console.log('Шаблон обновлён:', updatedTemplate.id);
                return updatedTemplate;
            } catch (error) {
                console.error('Ошибка при обновлении шаблона:', error);
                throw error;
            }
        }
        
        // Обновление в IndexedDB
        async updateInIndexedDB(template) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([DB_CONFIG.storeName], 'readwrite');
                const store = transaction.objectStore(DB_CONFIG.storeName);
                const request = store.put(template);
                
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });
        }
        
        // Обновление в localStorage
        updateInLocalStorage(template) {
            try {
                const templates = this.getAllFromLocalStorage();
                const index = templates.findIndex(t => t.id === template.id);
                
                if (index !== -1) {
                    templates[index] = template;
                    localStorage.setItem('templates', JSON.stringify(templates));
                } else {
                    throw new Error('Шаблон не найден');
                }
            } catch (error) {
                console.error('Ошибка при обновлении в localStorage:', error);
                throw error;
            }
        }
        
        // Удаление шаблона
        async deleteTemplate(id) {
            await this.ensureInitialized();
            
            try {
                // Удаляем локально
                if (this.useIndexedDB) {
                    await this.deleteFromIndexedDB(id);
                } else {
                    this.deleteFromLocalStorage(id);
                }
                
                // Удаляем из Supabase если доступен и есть подключение
                if (this.supabase && this.syncEnabled) {
                    if (navigator.onLine) {
                        try {
                            const { error } = await this.supabase
                                .from('templates')
                                .delete()
                                .eq('id', id);
                            if (error) {
                                console.warn('Ошибка удаления из Supabase:', error);
                                this.addToOfflineQueue('delete', { id });
                            }
                        } catch (err) {
                            console.warn('Ошибка сети при удалении:', err);
                            this.addToOfflineQueue('delete', { id });
                        }
                    } else {
                        this.addToOfflineQueue('delete', { id });
                    }
                }
                
                console.log('Шаблон удалён:', id);
                return true;
            } catch (error) {
                console.error('Ошибка при удалении шаблона:', error);
                throw error;
            }
        }
        
        // Удаление из IndexedDB
        async deleteFromIndexedDB(id) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([DB_CONFIG.storeName], 'readwrite');
                const store = transaction.objectStore(DB_CONFIG.storeName);
                const request = store.delete(id);
                
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });
        }
        
        // Удаление из localStorage
        deleteFromLocalStorage(id) {
            try {
                const templates = this.getAllFromLocalStorage();
                const filteredTemplates = templates.filter(t => t.id !== id);
                localStorage.setItem('templates', JSON.stringify(filteredTemplates));
            } catch (error) {
                console.error('Ошибка при удалении из localStorage:', error);
                throw error;
            }
        }
        
                // Поиск шаблонов
        async searchTemplates(query, category = 'all', favoritesOnly = false) {
            await this.ensureInitialized();
            
            try {
                // Пробуем сначала искать в Supabase если доступен
                if (this.supabase && this.syncEnabled) {
                    let supabaseQuery = this.supabase
                        .from('templates')
                        .select('*');

                    // Применяем фильтры
                    if (category !== 'all') {
                        supabaseQuery = supabaseQuery.eq('category', category);
                    }
                    if (favoritesOnly) {
                        supabaseQuery = supabaseQuery.eq('favorite', true);
                    }
                    if (query) {
                        // Используем полнотекстовый поиск
                        supabaseQuery = supabaseQuery.textSearch(
                            'content',
                            query,
                            {
                                config: 'russian',
                                type: 'plain'
                            }
                        );
                    }

                    const { data, error } = await supabaseQuery;
                    if (!error && data) {
                        return data;
                    }
                }

                // Если Supabase недоступен или произошла ошибка, ищем локально
                const templates = await this.getAllTemplates();
                return templates.filter(template => {
                    // Фильтр по категории
                    if (category !== 'all' && template.category !== category) {
                        return false;
                    }
                    
                    // Фильтр по избранному
                    if (favoritesOnly && !template.favorite) {
                        return false;
                    }
                    
                    // Поиск по имени и содержимому
                    if (query) {
                        const searchStr = query.toLowerCase();
                        return template.name.toLowerCase().includes(searchStr) ||
                               template.content.toLowerCase().includes(searchStr);
                    }
                    
                    return true;
                });
            } catch (error) {
                console.error('Error searching templates:', error);
                return [];
            }
        }
        
        // Получение категорий
        async getCategories() {
            await this.ensureInitialized();
            
            try {
                const templates = await this.getAllTemplates();
                const categories = [...new Set(templates.map(t => t.category).filter(Boolean))];
                return categories.sort();
            } catch (error) {
                console.error('Ошибка при получении категорий:', error);
                return [];
            }
        }
        
        // Экспорт данных
        async exportData() {
            await this.ensureInitialized();
            
            try {
                const templates = await this.getAllTemplates();
                return JSON.stringify(templates, null, 2);
            } catch (error) {
                console.error('Ошибка при экспорте данных:', error);
                throw error;
            }
        }
        
        // Импорт данных
        async importData(jsonData, merge = false) {
            await this.ensureInitialized();
            
            try {
                const templates = JSON.parse(jsonData);
                
                if (!Array.isArray(templates)) {
                    throw new Error('Неверный формат данных');
                }
                
                if (merge) {
                    // Объединяем с существующими данными
                    const existingTemplates = await this.getAllTemplates();
                    const existingIds = new Set(existingTemplates.map(t => t.id));
                    
                    for (const template of templates) {
                        if (!existingIds.has(template.id)) {
                            await this.addTemplate(template);
                        }
                    }
                } else {
                    // Заменяем все данные
                    if (this.useIndexedDB) {
                        await this.clearIndexedDB();
                        for (const template of templates) {
                            await this.addTemplate(template);
                        }
                    } else {
                        localStorage.setItem('templates', JSON.stringify(templates));
                    }
                }
                
                console.log('Данные импортированы:', templates.length, 'шаблонов');
                return templates.length;
            } catch (error) {
                console.error('Ошибка при импорте данных:', error);
                throw error;
            }
        }

        // Импорт шаблонов из JSON (обёртка для совместимости)
        async importTemplates(jsonString, merge = false) {
            await this.ensureInitialized();
            try {
                // Delegate to importData which already handles parsing and insertion
                return await this.importData(jsonString, merge);
            } catch (error) {
                console.error('Ошибка при импорте JSON шаблонов:', error);
                throw error;
            }
        }

        // Импорт шаблонов из TXT
        // Формат: несколько блоков, разделённых пустой строкой или строкой с ---
        // В каждом блоке первая строка - название шаблона, вторая (опционально) может быть 'Category: Название'
        async importTemplatesFromTxt(txtData, defaultCategory = 'Импортировано из TXT') {
            await this.ensureInitialized();

            try {
                if (!txtData || typeof txtData !== 'string') {
                    throw new Error('Пустые или неверные данные для импорта из TXT');
                }

                // Разбиваем на блоки: сначала проверяем явные разделители '---', иначе двойной перенос строки
                let blocks = [];
                if (/^\s*---\s*$/m.test(txtData)) {
                    blocks = txtData.split(/^\s*---\s*$/m);
                } else {
                    blocks = txtData.split(/\r?\n\r?\n+/);
                }

                const created = [];

                for (const raw of blocks) {
                    const block = raw.trim();
                    if (!block) continue;

                    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                    if (lines.length === 0) continue;

                    let name = lines[0];
                    let category = defaultCategory;
                    let contentLines = [];

                    // Проверяем, указана ли вторая строке категория в виде 'Category: ...' или 'Категория: ...'
                    if (lines.length > 1) {
                        const m = lines[1].match(/^(?:Category:|Категория:)\s*(.+)$/i);
                        if (m) {
                            category = m[1].trim() || defaultCategory;
                            contentLines = lines.slice(2);
                        } else {
                            contentLines = lines.slice(1);
                        }
                    }

                    const content = contentLines.join('\n').trim();

                    const templateObj = {
                        name: name || 'Без названия',
                        category: category || defaultCategory,
                        content: content || '',
                        favorite: false
                    };

                    // Используем addTemplate чтобы корректно проставить id и даты
                    const newT = await this.addTemplate(templateObj);
                    created.push(newT);
                }

                console.log('Импортировано шаблонов из TXT:', created.length);
                return created.length;
            } catch (error) {
                console.error('Ошибка при импорте из TXT:', error);
                throw error;
            }
        }
        
        // Очистка IndexedDB
        async clearIndexedDB() {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([DB_CONFIG.storeName], 'readwrite');
                const store = transaction.objectStore(DB_CONFIG.storeName);
                const request = store.clear();
                
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });
        }
        
        // Очистка localStorage
        clearLocalStorage() {
            try {
                localStorage.removeItem('templates');
                localStorage.setItem('templates', JSON.stringify([]));
            } catch (error) {
                console.error('Ошибка при очистке localStorage:', error);
                throw error;
            }
        }
        
        // Очистка всех данных
        async clearAll() {
            await this.ensureInitialized();
            
            try {
                if (this.useIndexedDB) {
                    await this.clearIndexedDB();
                } else {
                    this.clearLocalStorage();
                }
                
                console.log('Все данные очищены');
            } catch (error) {
                console.error('Ошибка при очистке данных:', error);
                throw error;
            }
        }
        
        // Проверка инициализации
        async ensureInitialized() {
            if (!this.isInitialized) {
                await this.init();
            }
        }
        
        // Генерация ID
        generateId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2);
        }
        
        // Получение статистики
        async getStats() {
            await this.ensureInitialized();
            
            try {
                const templates = await this.getAllTemplates();
                
                return {
                    total: templates.length,
                    favorites: templates.filter(t => t.favorite).length,
                    categories: (await this.getCategories()).length,
                    storageType: this.useIndexedDB ? 'IndexedDB' : 'localStorage'
                };
            } catch (error) {
                console.error('Ошибка при получении статистики:', error);
                return { total: 0, favorites: 0, categories: 0, storageType: 'unknown' };
            }
        }
    }
    
    // Создаём экземпляр базы данных
    const db = new TemplateDatabase();
    
    // Экспортируем в глобальную область
    window.TemplateDB = db;
    
    // Автоматическая инициализация
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => db.init());
    } else {
        db.init();
    }
    
})();