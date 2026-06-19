document.addEventListener('DOMContentLoaded', () => {
    const changeTypeSelect = document.getElementById('changeTypeSelect');

    const oldModelSelect = document.getElementById('oldModelRestart');
    const newModelSelect = document.getElementById('newModelRestart');
    const restartDaySelect = document.getElementById('restartDay');
    const expensesInput = document.getElementById('expensesBeforeRestart');
    const oldBudgetInput = document.getElementById('oldBudget');
    const newBudgetInput = document.getElementById('newBudget');

    const newModelGroup = document.getElementById('newModelGroup');
    const newBudgetGroup = document.getElementById('newBudgetGroup');

    const dynamicExpensesLabel = document.getElementById('dynamicExpensesLabel');
    const dynamicDayTitle = document.getElementById('dynamicDayTitle');
    const restartNotice = document.getElementById('restartNotice');

    const outTotalWeekForecast = document.getElementById('outTotalWeekForecast');
    const outMaxDayRiskCombo = document.getElementById('outMaxDayRiskCombo');

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

    function calculateRestart() {
        const oldModel = oldModelSelect.value;
        const newModel = newModelSelect.value;
        const dayIdx = parseInt(restartDaySelect.value, 10);

        const expensesBefore = parseNumber(expensesInput.value);
        const oldBudget = parseNumber(oldBudgetInput.value);
        const newBudget = parseNumber(newBudgetInput.value);

        // Обновляем динамические тексты в инпутах и заголовках карточек (с сохранением вашего нового формата)
        dynamicExpensesLabel.innerHTML = `Расход с понедельника по ${daysWordMap[dayIdx]} <span class="hint-trigger" data-hint="Реальный или планируемый расход текущей кампании на этой неделе до момента нажатия кнопки «Сохранить».">?</span>`;
        dynamicDayTitle.innerHTML = `Сколько кампания может потратить ${daysTargetMap[dayIdx]} <span class="hint-trigger" data-hint="Теоретический пиковый сценарий расхода бюджета в день внесения правок из-за наложения суточных лимитов старой и новой конфигураций стратегий.">?</span>`;

        // Коэффициенты для расчета максимального расхода в день рестарта
        const oldCoeff = oldModel === 'clicks' ? 0.35 : 1.0;
        const newCoeff = newModel === 'clicks' ? 0.35 : 1.0;

        restartNotice.textContent = `* При текущем выборе максимальный расход в день рестарта складывается из суточных овердрафтов: ${(oldCoeff*100)}% от старого бюджета + ${(newCoeff*100)}% от нового бюджета.`;

        // --- ВЫЧИСЛЕНИЕ КОЛИЧЕСТВА ДНЕЙ СО ДНЯ РЕСТАРТА ---
        // Понедельник(1) -> 7 дней, ..., Воскресенье(7) -> 1 день
        const daysFromRestart = 8 - dayIdx; 

        // --- РАСЧЕТ ОСТАТКА НОВОГО БЮДЖЕТА ---
        let availableNewBudgetRemainder = 0;

        if (newModel === 'conversions') {
            // Если новая модель CPA — доступно 100% нового бюджета
            availableNewBudgetRemainder = newBudget;
        } else {
            // Если новая модель CPC — считаем по вашей формуле:
            // (Новый бюджет / 7) * (Количество дней - 1) + Новый бюджет * 35%
            const fullDaysComponent = (newBudget / 7) * (daysFromRestart - 1);
            const restartDayComponent = newBudget * 0.35;
            availableNewBudgetRemainder = fullDaysComponent + restartDayComponent;
        }

        // Итоговый прогноз за неделю: Фактический расход до рестарта + рассчитанный остаток
        const totalWeekForecast = expensesBefore + availableNewBudgetRemainder;

        // Расчет максимального расхода в день рестарта (остался прежним)
        const dayOldComponent = oldBudget * oldCoeff;
        const dayNewComponent = newBudget * newCoeff;
        const maxDayRiskCombo = dayOldComponent + dayNewComponent;

        // Вывод результатов на экран
        outTotalWeekForecast.textContent = `${formatNumber(Math.round(totalWeekForecast))} ₽`;
        outMaxDayRiskCombo.textContent = `${formatNumber(Math.round(maxDayRiskCombo))} ₽`;
    }

    [oldModelSelect, newModelSelect, restartDaySelect].forEach(select => {
        select.addEventListener('change', calculateRestart);
    });

    handleInputChangeRestrictions();
});
