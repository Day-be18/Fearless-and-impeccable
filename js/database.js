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
    
    // Класс для работы с базой данных
    class TemplateDatabase {
        constructor() {
            this.db = null;
            this.isInitialized = false;
            this.useIndexedDB = true;
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
            } catch (error) {
                console.error('Ошибка при инициализации базы данных:', error);
                // Fallback на localStorage
                this.useIndexedDB = false;
                this.initLocalStorage();
                this.isInitialized = true;
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
                    id: this.generateId(),
                    dateCreated: new Date().toISOString(),
                    dateModified: new Date().toISOString(),
                    favorite: template.favorite || false
                };
                
                if (this.useIndexedDB) {
                    await this.addToIndexedDB(newTemplate);
                } else {
                    this.addToLocalStorage(newTemplate);
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
                
                if (this.useIndexedDB) {
                    await this.updateInIndexedDB(updatedTemplate);
                } else {
                    this.updateInLocalStorage(updatedTemplate);
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
                if (this.useIndexedDB) {
                    await this.deleteFromIndexedDB(id);
                } else {
                    this.deleteFromLocalStorage(id);
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
                let templates = await this.getAllTemplates();
                
                // Фильтрация по избранным
                if (favoritesOnly) {
                    templates = templates.filter(t => t.favorite);
                }
                
                // Фильтрация по категории
                if (category && category !== 'all') {
                    templates = templates.filter(t => t.category === category);
                }
                
                // Поиск по названию и содержанию
                if (query) {
                    const searchQuery = query.toLowerCase();
                    templates = templates.filter(t => 
                        t.name.toLowerCase().includes(searchQuery) ||
                        t.content.toLowerCase().includes(searchQuery) ||
                        t.category.toLowerCase().includes(searchQuery)
                    );
                }
                
                return templates;
            } catch (error) {
                console.error('Ошибка при поиске шаблонов:', error);
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