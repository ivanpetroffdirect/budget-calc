document.addEventListener('DOMContentLoaded', () => {
    // Основной селект типа изменений
    const changeTypeSelect = document.getElementById('changeTypeSelect');

    // Элементы ввода данных
    const oldModelSelect = document.getElementById('oldModelRestart');
    const newModelSelect = document.getElementById('newModelRestart');
    const restartDaySelect = document.getElementById('restartDay');
    const expensesInput = document.getElementById('expensesBeforeRestart');
    const oldBudgetInput = document.getElementById('oldBudget');
    const newBudgetInput = document.getElementById('newBudget');

    // Контейнеры полей для управления disabled-стилями
    const newModelGroup = document.getElementById('newModelGroup');
    const newBudgetGroup = document.getElementById('newBudgetGroup');

    // Текстовые динамические метки
    const dynamicExpensesLabel = document.getElementById('dynamicExpensesLabel');
    const dynamicDayTitle = document.getElementById('dynamicDayTitle');
    const restartNotice = document.getElementById('restartNotice');

    // Элементы вывода результатов
    const outTotalWeekForecast = document.getElementById('outTotalWeekForecast');
    const outMaxDayRiskCombo = document.getElementById('outMaxDayRiskCombo');

    // Элементы поп-апа
    const popupOverlay = document.getElementById('hintPopup');
    const popupText = document.getElementById('popupText');
    const popupClose = document.querySelector('.popup-close');

    const daysWordMap = {
        1: 'понедельник', 2: 'вторник', 3: 'среду', 4: 'четверг',
        5: 'пятницу', 6: 'субботу', 7: 'воскресенье'
    };

    const daysTargetMap = {
        1: 'в понедельник', 2: 'во вторник', 3: 'в среду', 4: 'в четверг',
        5: 'в пятницу', 6: 'в субботу', 7: 'в воскресенье'
    };

    // --- Валидация и маски числового ввода ---
    function formatNumber(val) {
        return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }

    function parseNumber(str) {
        return parseFloat(str.replace(/\s+/g, '')) || 0;
    }

    function applyMask(input) {
        let value = input.value.replace(/\D/g, '');
        if (value === '') value = '0';
        input.value = formatNumber(parseInt(value, 10));
    }

    [expensesInput, oldBudgetInput, newBudgetInput].forEach(input => {
        input.addEventListener('input', () => {
            applyMask(input);
            calculateRestart();
        });
        input.addEventListener('blur', () => {
            if (!input.value.trim()) input.value = '0';
        });
    });

    // Синхронизация при изменении исходных полей, от которых зависят заблокированные
    oldModelSelect.addEventListener('change', () => {
        if (newModelSelect.disabled) {
            newModelSelect.value = oldModelSelect.value;
        }
        calculateRestart();
    });

    oldBudgetInput.addEventListener('input', () => {
        if (newBudgetInput.disabled) {
            newBudgetInput.value = oldBudgetInput.value;
        }
    });

    // --- Интерактивная логика блокировок на основе типа изменений ---
    function handleInputChangeRestrictions() {
        const type = changeTypeSelect.value;

        if (type === 'budget') {
            newModelSelect.disabled = true;
            newModelGroup.classList.add('disabled-state');
            newModelSelect.value = oldModelSelect.value;

            newBudgetInput.disabled = false;
            newBudgetGroup.classList.remove('disabled-state');
        } 
        else if (type === 'model') {
            newBudgetInput.disabled = true;
            newBudgetGroup.classList.add('disabled-state');
            newBudgetInput.value = oldBudgetInput.value;

            newModelSelect.disabled = false;
            newModelGroup.classList.remove('disabled-state');
        } 
        else {
            newModelSelect.disabled = false;
            newModelGroup.classList.remove('disabled-state');
            newBudgetInput.disabled = false;
            newBudgetGroup.classList.remove('disabled-state');
        }

        calculateRestart();
    }

    changeTypeSelect.addEventListener('change', handleInputChangeRestrictions);

    // --- Логика модальных окон (Подсказки) ---
    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('hint-trigger')) {
            if (e.target.closest('.disabled-state')) return;
            
            const text = e.target.getAttribute('data-hint');
            if (text) {
                popupText.textContent = text;
                popupOverlay.classList.add('active');
            }
        }
    });

    popupClose.addEventListener('click', () => popupOverlay.classList.remove('active'));
    popupOverlay.addEventListener('click', (e) => {
        if (e.target === popupOverlay) popupOverlay.classList.remove('active');
    });

    // --- Главная функция расчета ---
    function calculateRestart() {
        const oldModel = oldModelSelect.value;
        const newModel = newModelSelect.value;
        const dayIdx = parseInt(restartDaySelect.value, 10);

        const expensesBefore = parseNumber(expensesInput.value);
        const oldBudget = parseNumber(oldBudgetInput.value);
        const newBudget = parseNumber(newBudgetInput.value);

        // 1. Динамическое обновление текстов лейблов в зависимости от дня недели
        dynamicExpensesLabel.innerHTML = `Расход с понедельника по ${daysWordMap[dayIdx]} <span class="hint-trigger" data-hint="Реальный или планируемый расход текущей кампании на этой неделе до момента нажатия кнопки «Сохранить».">?</span>`;
        dynamicDayTitle.innerHTML = `Максимальный расход ${daysTargetMap[dayIdx]} <span class="hint-trigger" data-hint="Теоретический пиковый сценарий расхода бюджета в день внесения правок из-за наложения суточных лимитов старой и новой конфигураций стратегий.">?</span>`;

        // 2. Расчет коэффициентов овердрафта (CPC = 35%, CPA = 100%)
        const oldCoeff = oldModel === 'clicks' ? 0.35 : 1.0;
        const newCoeff = newModel === 'clicks' ? 0.35 : 1.0;

        // Корректировка текста дисклеймера снизу
        restartNotice.textContent = `* При текущем выборе максимальный расход в день рестарта складывается из суточных овердрафтов: ${(oldCoeff*100)}% от старого бюджета + ${(newCoeff*100)}% от нового бюджета.`;

        // 3. Расчет метрики: Лимит бюджета на неделю
        const totalWeekForecast = expensesBefore + newBudget;

        // 4. Расчет метрики: Максимальный расход в день рестарта (наложение лимитов)
        const dayOldComponent = oldBudget * oldCoeff;
        const dayNewComponent = newBudget * newCoeff;
        const maxDayRiskCombo = dayOldComponent + dayNewComponent;

        // 5. Вывод результатов
        outTotalWeekForecast.textContent = `${formatNumber(Math.round(totalWeekForecast))} ₽`;
        outMaxDayRiskCombo.textContent = `${formatNumber(Math.round(maxDayRiskCombo))} ₽`;
    }

    [oldModelSelect, newModelSelect, restartDaySelect].forEach(select => {
        select.addEventListener('change', calculateRestart);
    });

    handleInputChangeRestrictions();
});
