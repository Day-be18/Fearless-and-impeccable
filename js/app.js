/**
 * Основной файл приложения для управления шаблонами чатов
 */

document.addEventListener('DOMContentLoaded', () => {
    // Инициализация приложения после загрузки DOM
    const app = new TemplateApp();
    app.init();
});

class TemplateApp {
    constructor() {
        // Элементы DOM
        this.templatesGrid = document.getElementById('templatesGrid');
        this.searchInput = document.getElementById('searchInput');
        this.categoryFilter = document.getElementById('categoryFilter');
        this.addTemplateBtn = document.getElementById('addTemplateBtn');
        this.importBtn = document.getElementById('importBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.templateModal = document.getElementById('templateModal');
        this.importExportModal = document.getElementById('importExportModal');
        this.templateForm = document.getElementById('templateForm');
        this.modalTitle = document.getElementById('modalTitle');
        this.templateName = document.getElementById('templateName');
        this.templateCategory = document.getElementById('templateCategory');
        this.templateContent = document.getElementById('templateContent');
        this.templateId = document.getElementById('templateId');
        this.importExportTitle = document.getElementById('importExportTitle');
        this.importExportContent = document.getElementById('importExportContent');
        this.confirmImportExportBtn = document.getElementById('confirmImportExportBtn');
        this.favoritesOnlyToggle = document.getElementById('favoritesOnly');
        this.themeToggleBtn = document.getElementById('themeToggleBtn');
        this.sortSelect = document.getElementById('sortSelect');
        this.multiSelectToggle = document.getElementById('multiSelectToggle');
        this.bulkToolbar = document.getElementById('bulkToolbar');
        this.selectedCountEl = document.getElementById('selectedCount');
        this.bulkExportBtn = document.getElementById('bulkExportBtn');
        this.bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
        this.bulkClearBtn = document.getElementById('bulkClearBtn');
        
        // Состояние приложения
        this.currentCategory = 'all';
        this.currentFavoritesOnly = false;
        this.currentSort = 'dateModified_desc';
        this.multiSelectMode = false;
        this.selectedIds = new Set();
        
        // Закрытие модальных окон
        const closeButtons = document.querySelectorAll('.close-btn');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.templateModal.style.display = 'none';
                this.importExportModal.style.display = 'none';
            });
        });
        
        // Закрытие модальных окон при клике вне их области
        window.addEventListener('click', (event) => {
            if (event.target === this.templateModal) {
                this.templateModal.style.display = 'none';
            }
            if (event.target === this.importExportModal) {
                this.importExportModal.style.display = 'none';
            }
        });
    }

    /**
     * Инициализация приложения
     */
    init() {
        // Тема и состояние фильтров из localStorage
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark');
        }
        this.updateThemeToggleIcon();
        
        const savedFavOnly = localStorage.getItem('favoritesOnly') === 'true';
        if (this.favoritesOnlyToggle) {
            this.favoritesOnlyToggle.checked = savedFavOnly;
        }
        this.currentFavoritesOnly = savedFavOnly;
        
        const savedSort = localStorage.getItem('sort') || 'dateModified_desc';
        this.currentSort = savedSort;
        if (this.sortSelect) this.sortSelect.value = savedSort;

        // Дожидаемся инициализации базы данных перед загрузкой шаблонов
        setTimeout(() => {
            // Загрузка шаблонов с учетом текущих фильтров
            this.loadTemplates();
            // Загрузка категорий
            this.loadCategories();
        }, 100);
        
        // Обработчики событий
        this.addEventListeners();
    }

    /**
     * Добавление обработчиков событий
     */
    addEventListeners() {
        // Поиск шаблонов
        this.searchInput.addEventListener('input', () => {
            this.searchTemplates(this.searchInput.value, this.currentCategory);
        });
        
        // Фильтрация по категориям
        this.categoryFilter.addEventListener('change', () => {
            this.currentCategory = this.categoryFilter.value;
            this.searchTemplates(this.searchInput.value, this.currentCategory);
        });
        
        // Фильтр только избранных
        if (this.favoritesOnlyToggle) {
            this.favoritesOnlyToggle.addEventListener('change', () => {
                this.currentFavoritesOnly = this.favoritesOnlyToggle.checked;
                localStorage.setItem('favoritesOnly', String(this.currentFavoritesOnly));
                this.searchTemplates(this.searchInput.value, this.currentCategory);
            });
        }
        
        // Переключение темы
        if (this.themeToggleBtn) {
            this.themeToggleBtn.addEventListener('click', () => {
                document.body.classList.toggle('dark');
                const theme = document.body.classList.contains('dark') ? 'dark' : 'light';
                localStorage.setItem('theme', theme);
                this.updateThemeToggleIcon();
            });
        }

        if (this.sortSelect) {
            this.sortSelect.addEventListener('change', () => {
                this.currentSort = this.sortSelect.value;
                localStorage.setItem('sort', this.currentSort);
                this.loadTemplates();
            });
        }
        
        if (this.multiSelectToggle) {
            this.multiSelectToggle.addEventListener('click', () => {
                this.multiSelectMode = !this.multiSelectMode;
                this.selectedIds.clear();
                this.updateBulkUI();
                this.loadTemplates();
            });
        }
        
        if (this.bulkExportBtn) {
            this.bulkExportBtn.addEventListener('click', () => {
                if (this.selectedIds.size === 0) return;
                this.exportTemplatesByIds(Array.from(this.selectedIds));
            });
        }
        
        if (this.bulkDeleteBtn) {
            this.bulkDeleteBtn.addEventListener('click', () => {
                if (this.selectedIds.size === 0) return;
                if (!confirm(`Удалить выбранные (${this.selectedIds.size}) шаблонов?`)) return;
                const ops = Array.from(this.selectedIds).map(id => templateDB.deleteTemplate(isNaN(parseInt(id,10))? id : parseInt(id,10)));
                Promise.allSettled(ops).then(() => {
                    this.selectedIds.clear();
                    this.updateBulkUI();
                    this.loadTemplates();
                    this.loadCategories();
                    this.showNotification('Выбранные шаблоны удалены');
                }).catch(() => this.showNotification('Ошибка при удалении выбранных', 'error'));
            });
        }
        
        if (this.bulkClearBtn) {
            this.bulkClearBtn.addEventListener('click', () => {
                this.selectedIds.clear();
                this.updateBulkUI();
                this.loadTemplates();
            });
        }
        
        // Быстрый фокус на поиск: Ctrl/Cmd + K
        document.addEventListener('keydown', (e) => {
            const key = e.key && e.key.toLowerCase();
            if ((e.ctrlKey || e.metaKey) && key === 'k') {
                e.preventDefault();
                this.searchInput.focus();
            }
        });
        
        // Добавление нового шаблона
        this.addTemplateBtn.addEventListener('click', () => {
            this.openTemplateModal();
        });
        
        // Импорт шаблонов
        this.importBtn.addEventListener('click', () => {
            this.openImportModal();
        });
        
        // Экспорт шаблонов
        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', () => {
                this.openExportModal();
            });
        }
        
        // Сохранение шаблона
        this.templateForm.addEventListener('submit', (event) => {
            event.preventDefault();
            this.saveTemplate();
        });
        
        // Подтверждение импорта/экспорта
        this.confirmImportExportBtn.addEventListener('click', () => {
            if (this.importExportTitle.textContent === 'Импорт') {
                // Проверяем, какая вкладка активна
                const isJsonTab = document.getElementById('importJsonTab').classList.contains('active');
                const isTxtTab = document.getElementById('importTxtTab').classList.contains('active');
                
                console.log('Нажата кнопка импорта. Активные вкладки - JSON:', isJsonTab, 'TXT:', isTxtTab);
                
                // Не закрываем модальное окно при ошибке импорта
                const importResult = this.importTemplates();
                if (!importResult) {
                    return;
                }
            } else {
                // Экспорт: по активной вкладке формируем файл
                const isJsonTab = document.getElementById('importJsonTab').classList.contains('active');
                const isTxtTab = document.getElementById('importTxtTab').classList.contains('active');
                if (isJsonTab) {
                    try {
                        const data = this.importExportContent.value;
                        const blob = new Blob([data], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `templates_${Date.now()}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        this.importExportModal.style.display = 'none';
                    } catch (e) {
                        this.showNotification('Ошибка при подготовке JSON', 'error');
                    }
                } else if (isTxtTab) {
                    templateDB.getAllTemplates().then(templates => {
                        const txt = this.generateTxtFromTemplates(templates);
                        const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `templates_${Date.now()}.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        this.importExportModal.style.display = 'none';
                    }).catch(()=>this.showNotification('Ошибка при получении шаблонов', 'error'));
                }
            }
        });
        
        // Обработчики для вкладок импорта
        document.getElementById('importJsonTab').addEventListener('click', () => {
            document.getElementById('importJsonTab').classList.add('active');
            document.getElementById('importTxtTab').classList.remove('active');
            document.getElementById('txtImportOptions').style.display = 'none';
            this.importExportContent.placeholder = this.importExportTitle.textContent === 'Экспорт' ? 'Предпросмотр JSON...' : 'Вставьте JSON с шаблонами или загрузите файл...';
            if (this.importExportTitle.textContent === 'Экспорт') {
                templateDB.exportTemplates().then(jsonData => {
                    this.importExportContent.value = jsonData;
                });
            }
            console.log('Выбрана вкладка JSON');
        });
        
        document.getElementById('importTxtTab').addEventListener('click', () => {
            document.getElementById('importTxtTab').classList.add('active');
            document.getElementById('importJsonTab').classList.remove('active');
            document.getElementById('txtImportOptions').style.display = 'block';
            this.importExportContent.placeholder = this.importExportTitle.textContent === 'Экспорт' ? 'Предпросмотр TXT...' : 'Вставьте текст с шаблонами или загрузите файл...';
            if (this.importExportTitle.textContent === 'Экспорт') {
                templateDB.getAllTemplates().then(templates => {
                    this.importExportContent.value = this.generateTxtFromTemplates(templates);
                });
            }
            console.log('Выбрана вкладка TXT');
        });
        
        // Обработчик загрузки файла
        document.getElementById('fileInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Отображаем имя файла
            document.getElementById('fileName').textContent = file.name;
            
            // Определяем тип файла и устанавливаем активную вкладку
            if (file.name.toLowerCase().endsWith('.json')) {
                document.getElementById('importJsonTab').click();
            } else if (file.name.toLowerCase().endsWith('.txt')) {
                document.getElementById('importTxtTab').click();
            }
            
            // Читаем содержимое файла
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target.result;
                console.log('Прочитано содержимое файла:', file.name);
                console.log('Размер содержимого:', content.length, 'символов');
                console.log('Первые 100 символов:', content.substring(0, 100));
                this.importExportContent.value = content;
            };
            reader.readAsText(file);
        });
    }

    /**
     * Загрузка шаблонов из базы данных с учетом текущих фильтров
     */
    loadTemplates() {
        this.searchTemplates(this.searchInput.value, this.currentCategory);
    }

    /**
     * Отображение шаблонов в сетке
     * @param {Array} templates - Массив шаблонов
     */
    renderTemplates(templates) {
        this.templatesGrid.innerHTML = '';
        
        if (templates.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = 'Нет доступных шаблонов. Добавьте новый шаблон, нажав кнопку "Добавить шаблон".';
            this.templatesGrid.appendChild(emptyMessage);
            return;
        }
        
        if (this.currentFavoritesOnly) {
            templates = templates.filter(t => t.favorite);
        }
        templates = this.sortTemplates(templates);

        templates.forEach(template => {
            const templateCard = this.createTemplateCard(template);
            this.templatesGrid.appendChild(templateCard);
        });
    }

    /**
     * Создание карточки шаблона
     * @param {Object} template - Объект шаблона
     * @returns {HTMLElement} Элемент карточки шаблона
     */
    createTemplateCard(template) {
        const card = document.createElement('div');
        card.className = 'template-card';
        card.dataset.id = template.id;
        if (this.selectedIds.has(String(template.id))) {
            card.classList.add('selected');
        }
        
        const header = document.createElement('div');
        header.className = 'template-header';
        
        const titleContainer = document.createElement('div');
        
        const title = document.createElement('h3');
        title.className = 'template-title';
        title.textContent = template.name;
        titleContainer.appendChild(title);
        
        if (template.category) {
            const category = document.createElement('span');
            category.className = 'template-category';
            category.textContent = template.category;
            titleContainer.appendChild(category);
        }
        
        header.appendChild(titleContainer);
        
        const actions = document.createElement('div');
        actions.className = 'template-actions';
        
        // Чекбокс выбора при мультивыборе
        if (this.multiSelectMode) {
            const selectBox = document.createElement('input');
            selectBox.type = 'checkbox';
            selectBox.className = 'card-select';
            selectBox.checked = this.selectedIds.has(String(template.id));
            selectBox.addEventListener('change', () => {
                const key = String(template.id);
                if (selectBox.checked) this.selectedIds.add(key); else this.selectedIds.delete(key);
                card.classList.toggle('selected', selectBox.checked);
                this.updateBulkUI();
            });
            actions.appendChild(selectBox);
        }
        
        // Избранное
        const favoriteBtn = document.createElement('button');
        favoriteBtn.className = 'action-btn favorite-btn' + (template.favorite ? ' active' : '');
        favoriteBtn.innerHTML = '<i class="fas fa-star"></i>';
        favoriteBtn.title = template.favorite ? 'Убрать из избранного' : 'В избранное';
        favoriteBtn.addEventListener('click', () => {
            const updated = { ...template, favorite: !template.favorite };
            templateDB.updateTemplate(updated)
                .then(() => {
                    this.showNotification(updated.favorite ? 'Добавлено в избранное' : 'Удалено из избранного');
                    this.loadTemplates();
                })
                .catch(error => {
                    console.error('Ошибка при обновлении избранного:', error);
                    this.showNotification('Ошибка при обновлении избранного', 'error');
                });
        });
        
        const editBtn = document.createElement('button');
        editBtn.className = 'action-btn edit-btn';
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.title = 'Редактировать';
        editBtn.addEventListener('click', () => {
            this.openTemplateModal(template);
        });
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn delete-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.title = 'Удалить';
        deleteBtn.addEventListener('click', () => {
            this.deleteTemplate(template.id);
        });
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'action-btn copy-btn';
        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        copyBtn.title = 'Копировать в буфер обмена';
        copyBtn.addEventListener('click', () => {
            this.copyToClipboard(template.content);
        });
        
        const expandBtn = document.createElement('button');
        expandBtn.className = 'action-btn expand-btn';
        expandBtn.innerHTML = '<i class="fas fa-angle-down"></i>';
        expandBtn.title = 'Показать полностью';
        
        // Экспорт одного шаблона
        const exportOneBtn = document.createElement('button');
        exportOneBtn.className = 'action-btn download-btn';
        exportOneBtn.innerHTML = '<i class="fas fa-download"></i>';
        exportOneBtn.title = 'Экспортировать шаблон';
        exportOneBtn.addEventListener('click', () => {
            this.exportTemplatesAsTxt([template], `template_${template.id}.txt`);
        });
        
        actions.appendChild(favoriteBtn);
        actions.appendChild(copyBtn);
        actions.appendChild(expandBtn);
        actions.appendChild(exportOneBtn);
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        
        header.appendChild(actions);
        
        const content = document.createElement('div');
        content.className = 'template-content';
        content.textContent = template.content;
        
        // Логика разворачивания
        expandBtn.addEventListener('click', () => {
            const isExpanded = content.classList.toggle('expanded');
            expandBtn.innerHTML = isExpanded ? '<i class="fas fa-angle-up"></i>' : '<i class="fas fa-angle-down"></i>';
            expandBtn.title = isExpanded ? 'Свернуть' : 'Показать полностью';
        });
        
        const footer = document.createElement('div');
        footer.className = 'template-footer';
        
        const dateCreated = new Date(template.dateCreated);
        const dateModified = new Date(template.dateModified);
        
        const dateInfo = document.createElement('span');
        dateInfo.textContent = `Создан: ${this.formatDate(dateCreated)}`;
        
        const modifiedInfo = document.createElement('span');
        modifiedInfo.textContent = `Изменен: ${this.formatDate(dateModified)}`;
        
        footer.appendChild(dateInfo);
        footer.appendChild(modifiedInfo);
        
        card.appendChild(header);
        card.appendChild(content);
        card.appendChild(footer);
        
        return card;
    }

    /**
     * Форматирование даты
     * @param {Date} date - Объект даты
     * @returns {string} Отформатированная дата
     */
    formatDate(date) {
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    /**
     * Переключение иконки темы
     */
    updateThemeToggleIcon() {
        if (!this.themeToggleBtn) return;
        const icon = this.themeToggleBtn.querySelector('i');
        if (!icon) return;
        if (document.body.classList.contains('dark')) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
            this.themeToggleBtn.title = 'Светлая тема';
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
            this.themeToggleBtn.title = 'Тёмная тема';
        }
    }

    /**
     * Открытие модального окна для добавления/редактирования шаблона
     * @param {Object} template - Объект шаблона (если редактирование)
     */
    openTemplateModal(template = null) {
        if (template) {
            this.modalTitle.textContent = 'Редактировать шаблон';
            this.templateName.value = template.name;
            this.templateCategory.value = template.category || '';
            this.templateContent.value = template.content;
            this.templateId.value = template.id;
        } else {
            this.modalTitle.textContent = 'Добавить шаблон';
            this.templateForm.reset();
            this.templateId.value = '';
        }
        
        this.templateModal.style.display = 'block';
        this.templateName.focus();
    }

    /**
     * Открытие модального окна для импорта шаблонов
     */
    openImportModal() {
        this.importExportTitle.textContent = 'Импорт';
        this.importExportContent.value = '';
        this.importExportContent.placeholder = 'Вставьте JSON с шаблонами или загрузите файл...';
        this.confirmImportExportBtn.textContent = 'Импортировать';
        
        // Показываем опции импорта
        document.getElementById('importOptions').style.display = 'block';
        
        // Устанавливаем активную вкладку JSON по умолчанию
        const importJsonTab = document.getElementById('importJsonTab');
        const importTxtTab = document.getElementById('importTxtTab');
        const txtImportOptions = document.getElementById('txtImportOptions');
        
        importJsonTab.classList.add('active');
        importTxtTab.classList.remove('active');
        txtImportOptions.style.display = 'none';
        
        console.log('Открыто модальное окно импорта, активная вкладка: JSON');
        
        // Сбрасываем информацию о файле
        document.getElementById('fileName').textContent = '';
        document.getElementById('fileInput').value = '';
        
        this.importExportModal.style.display = 'block';
    }

    /**
     * Открытие модального окна для экспорта шаблонов
     */
    openExportModal() {
        this.importExportTitle.textContent = 'Экспорт';
        this.confirmImportExportBtn.textContent = 'Скачать';

        // Показываем опции формата (используем те же вкладки)
        const importOptions = document.getElementById('importOptions');
        importOptions.style.display = 'block';

        const importJsonTab = document.getElementById('importJsonTab');
        const importTxtTab = document.getElementById('importTxtTab');
        const txtImportOptions = document.getElementById('txtImportOptions');

        // Для экспорта скрываем опции TXT-импорта
        if (txtImportOptions) txtImportOptions.style.display = 'none';

        // Активируем JSON по умолчанию
        importJsonTab.classList.add('active');
        importTxtTab.classList.remove('active');
        this.importExportContent.placeholder = 'Предпросмотр JSON...';

        // Сгенерировать JSON предпросмотр
        templateDB.exportTemplates()
            .then(jsonData => {
                this.importExportContent.value = jsonData;
                this.importExportModal.style.display = 'block';
                this.importExportContent.select();
            })
            .catch(error => {
                console.error('Ошибка при экспорте шаблонов:', error);
                this.showNotification('Ошибка при экспорте шаблонов', 'error');
            });
    }

    /**
     * Сохранение шаблона (добавление или обновление)
     */
    saveTemplate() {
        const template = {
            name: this.templateName.value.trim(),
            category: this.templateCategory.value.trim() || 'Без категории',
            content: this.templateContent.value.trim()
        };
        
        const templateId = this.templateId.value;
        
        if (templateId) {
            // Обновление существующего шаблона
            // Проверяем, является ли ID числом или строкой (для localStorage)
            template.id = isNaN(parseInt(templateId, 10)) ? templateId : parseInt(templateId, 10);
            
            templateDB.updateTemplate(template)
                .then(() => {
                    this.templateModal.style.display = 'none';
                    this.loadTemplates();
                    this.loadCategories(); // Обновляем список категорий
                    this.showNotification('Шаблон успешно обновлен');
                })
                .catch(error => {
                    console.error('Ошибка при обновлении шаблона:', error);
                    this.showNotification('Ошибка при обновлении шаблона', 'error');
                });
        } else {
            // Добавление нового шаблона
            templateDB.addTemplate(template)
                .then(() => {
                    this.templateModal.style.display = 'none';
                    this.loadTemplates();
                    this.loadCategories(); // Обновляем список категорий
                    this.showNotification('Шаблон успешно добавлен');
                })
                .catch(error => {
                    console.error('Ошибка при добавлении шаблона:', error);
                    this.showNotification('Ошибка при добавлении шаблона', 'error');
                });
        }
    }

    /**
     * Удаление шаблона
     * @param {number} id - ID шаблона
     */
    deleteTemplate(id) {
        if (confirm('Вы уверены, что хотите удалить этот шаблон?')) {
            // Преобразуем ID в число, если это возможно (для IndexedDB)
            // или оставляем как есть (для localStorage)
            const templateId = isNaN(parseInt(id, 10)) ? id : parseInt(id, 10);
            templateDB.deleteTemplate(templateId)
                .then(() => {
                    this.loadTemplates();
                    this.loadCategories(); // Обновляем список категорий после удаления
                    this.showNotification('Шаблон успешно удален');
                })
                .catch(error => {
                    console.error('Ошибка при удалении шаблона:', error);
                    this.showNotification('Ошибка при удалении шаблона', 'error');
                });
        }
    }
    
    /**
     * Загрузка категорий
     */
    loadCategories() {
        templateDB.getCategories().then(categories => {
            // Очищаем текущие опции
            while (this.categoryFilter.options.length > 1) {
                this.categoryFilter.remove(1);
            }
            
            // Добавляем новые опции категорий
            categories.forEach(category => {
                if (category !== 'Все категории') {
                    const option = document.createElement('option');
                    option.value = category;
                    option.textContent = category;
                    this.categoryFilter.appendChild(option);
                }
            });
        }).catch(error => {
            console.error('Ошибка при загрузке категорий:', error);
        });
    }
    
    /**
     * Поиск шаблонов
     * @param {string} query - Поисковый запрос
     * @param {string} category - Категория для фильтрации
     */
    searchTemplates(query, category) {
        templateDB.searchTemplates(query, category).then(templates => {
            let result = templates;
            if (this.currentFavoritesOnly) {
                result = result.filter(t => t.favorite);
            }
            this.renderTemplates(result);
        }).catch(error => {
            console.error('Ошибка при поиске шаблонов:', error);
        });
    }

    /**
     * Импорт шаблонов из JSON или TXT
     */
    importTemplates() {
        const content = this.importExportContent.value.trim();
        
        if (!content) {
            this.showNotification('Пожалуйста, вставьте текст или загрузите файл', 'error');
            return false;
        }
        
        console.log('Импорт шаблонов, содержимое:', content.substring(0, 100) + '...');
        
        // Проверяем, какая вкладка активна
        const isJsonTab = document.getElementById('importJsonTab').classList.contains('active');
        const isTxtTab = document.getElementById('importTxtTab').classList.contains('active');
        
        console.log('Выполняется импорт. Активные вкладки - JSON:', isJsonTab, 'TXT:', isTxtTab);
        
        if (isJsonTab) {
            // Импорт из JSON
            templateDB.importTemplates(content)
                .then(count => {
                    this.loadTemplates();
                    this.loadCategories(); // Обновляем список категорий после импорта
                    this.showNotification(`Успешно импортировано ${count} шаблонов`);
                    this.importExportModal.style.display = 'none'; // Закрываем модальное окно после успешного импорта
                })
                .catch(error => {
                    console.error('Ошибка при импорте шаблонов из JSON:', error);
                    this.showNotification(`Ошибка при импорте: ${error.message}`, 'error');
                });
        } else if (isTxtTab) {
            // Импорт из TXT
            const defaultCategory = document.getElementById('defaultCategory').value.trim() || 'Импортировано из TXT';
            
            console.log('Импорт из TXT с категорией по умолчанию:', defaultCategory);
            
            // Проверяем формат TXT файла
            const lines = content.split('\n');
            console.log('Количество строк в файле:', lines.length);
            if (lines.length > 0) {
                console.log('Первая строка (название шаблона):', lines[0]);
                if (lines.length > 1) {
                    console.log('Вторая строка (начало содержимого):', lines[1]);
                }
            }
            
            templateDB.importTemplatesFromTxt(content, defaultCategory)
                .then(count => {
                    console.log('Успешно импортировано шаблонов из TXT:', count);
                    this.loadTemplates();
                    this.loadCategories(); // Обновляем список категорий после импорта
                    this.showNotification(`Успешно импортировано ${count} шаблонов из текста`);
                    this.importExportModal.style.display = 'none'; // Закрываем модальное окно после успешного импорта
                })
                .catch(error => {
                    console.error('Ошибка при импорте шаблонов из TXT:', error);
                    this.showNotification(`Ошибка при импорте из TXT: ${error.message}`, 'error');
                });
        } else {
            console.error('Не определена активная вкладка импорта');
            this.showNotification('Ошибка при импорте: не определен формат', 'error');
            return false;
        }
        
        return true;
    }

    /**
     * Копирование текста в буфер обмена
     * @param {string} text - Текст для копирования
     */
    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text)
                .then(() => {
                    this.showNotification('Скопировано в буфер обмена');
                })
                .catch(error => {
                    console.error('Ошибка при копировании в буфер обмена:', error);
                    this.showNotification('Не удалось скопировать текст', 'error');
                });
        } else {
            // Альтернативный метод для браузеров, не поддерживающих Clipboard API
            try {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                
                if (successful) {
                    this.showNotification('Скопировано в буфер обмена');
                } else {
                    this.showNotification('Не удалось скопировать текст', 'error');
                }
            } catch (error) {
                console.error('Ошибка при копировании в буфер обмена:', error);
                this.showNotification('Не удалось скопировать текст', 'error');
            }
        }
    }

    /**
     * Отображение уведомления
     * @param {string} message - Сообщение
     * @param {string} type - Тип уведомления ('success' или 'error')
     */
    showNotification(message, type = 'success') {
        // Проверяем, существует ли уже контейнер для уведомлений
        let notificationContainer = document.getElementById('notification-container');
        
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            document.body.appendChild(notificationContainer);
            
            // Добавляем стили для контейнера уведомлений
            notificationContainer.style.position = 'fixed';
            notificationContainer.style.bottom = '20px';
            notificationContainer.style.right = '20px';
            notificationContainer.style.zIndex = '1000';
        }
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Стили для уведомления
        notification.style.backgroundColor = type === 'success' ? '#4caf50' : '#f44336';
        notification.style.color = 'white';
        notification.style.padding = '12px 20px';
        notification.style.marginBottom = '10px';
        notification.style.borderRadius = '4px';
        notification.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(20px)';
        notification.style.transition = 'opacity 0.3s, transform 0.3s';
        
        notificationContainer.appendChild(notification);
        
        // Анимация появления
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        }, 10);
        
        // Автоматическое скрытие через 3 секунды
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                if (notification && notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    sortTemplates(list) {
        const arr = [...list];
        const key = this.currentSort;
        const byName = (a,b) => a.name.localeCompare(b.name, 'ru');
        const byDate = (aKey) => (a,b) => new Date(b[aKey]) - new Date(a[aKey]);
        const byDateAsc = (aKey) => (a,b) => new Date(a[aKey]) - new Date(b[aKey]);
        switch (key) {
            case 'name_asc': return arr.sort(byName);
            case 'name_desc': return arr.sort((a,b)=>byName(b,a));
            case 'dateCreated_desc': return arr.sort(byDate('dateCreated'));
            case 'dateCreated_asc': return arr.sort(byDateAsc('dateCreated'));
            case 'dateModified_asc': return arr.sort(byDateAsc('dateModified'));
            case 'dateModified_desc':
            default:
                return arr.sort(byDate('dateModified'));
        }
    }

    updateBulkUI() {
        if (!this.bulkToolbar) return;
        const hasSelection = this.selectedIds.size > 0;
        this.bulkToolbar.style.display = hasSelection ? 'block' : 'none';
        if (this.selectedCountEl) this.selectedCountEl.textContent = `${this.selectedIds.size} выбрано`;
        if (this.multiSelectToggle) {
            this.multiSelectToggle.classList.toggle('btn-primary', this.multiSelectMode);
        }
    }

    exportTemplatesByIds(ids) {
        templateDB.getAllTemplates().then(all => {
            const map = new Map(all.map(t=>[String(t.id), t]));
            const list = ids.map(id=>map.get(String(id))).filter(Boolean);
            if (list.length === 0) return;
            this.exportTemplatesAsTxt(list, `templates_${Date.now()}.txt`);
        });
    }

    exportTemplatesAsTxt(templates, filename) {
        try {
            const EOL = '\r\n';
            const blocks = templates.map(t => {
                const title = (t.name || 'Без названия').trim();
                const content = (t.content || '').replace(/\r?\n/g, EOL);
                return `${title}${EOL}${EOL}${content}`;
            });
            const data = blocks.join(`${EOL}${EOL}`) + EOL;
            const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showNotification('Экспорт в TXT выполнен');
        } catch (e) {
            console.error(e);
            this.showNotification('Ошибка при экспорте в TXT', 'error');
        }
    }

    generateTxtFromTemplates(templates) {
        const EOL = '\r\n';
        const blocks = templates.map(t => {
            const title = (t.name || 'Без названия').trim();
            const content = (t.content || '').replace(/\r?\n/g, EOL);
            return `${title}${EOL}${EOL}${content}`;
        });
        return blocks.join(`${EOL}${EOL}`) + EOL;
    }
}