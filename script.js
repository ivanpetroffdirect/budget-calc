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

    const outTotalWeekForecast = document.getElementById('outTotalWeekForecast');
    const outMaxDayRiskCombo = document.getElementById('outMaxDayRiskCombo');
    const totalWeekHint = document.getElementById('totalWeekHint');

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

        // Динамическое обновление подписи расхода до рестарта
        dynamicExpensesLabel.innerHTML = `Расход с понедельника по ${daysWordMap[dayIdx]} <span class="hint-trigger" data-hint="Реальный или планируемый расход текущей кампании на этой неделе до момента нажатия кнопки «Сохранить».">?</span>`;

        // Коэффициенты для расчета максимального расхода в день рестарта
        const oldCoeff = oldModel === 'clicks' ? 0.35 : 1.0;
        const newCoeff = newModel === 'clicks' ? 0.35 : 1.0;

        // --- РАСЧЕТ МАКСИМАЛЬНОГО РАСХОДА В ДЕНЬ РЕСТАРТА (С УЧЕТОМ ОСТАТКА СТАРЫХ СРЕДСТВ) ---
        // 1. Вычисляем фактический остаток по старой стратегии на эту неделю (не может быть меньше 0)
        const oldBudgetRemainder = Math.max(0, oldBudget - expensesBefore);

        // 2. Теоретический лимит расхода старой стратегии в день правок (35% для CPC или 100% для CPA)
        const oldDayTheoreticalLimit = oldBudget * oldCoeff;

        // 3. Итоговый старый компонент: старая стратегия потратит свой лимит, но не больше реального остатка бюджета
        const dayOldComponent = Math.min(oldDayTheoreticalLimit, oldBudgetRemainder);

        // 4. Новый компонент: новая стратегия стартует с нуля и может взять свой полный овердрафт от нового бюджета
        const dayNewComponent = newBudget * newCoeff;

        // Финальная сумма пикового расхода в день рестарта
        const maxDayRiskCombo = dayOldComponent + dayNewComponent;

        // Динамический текст подсказки для второй карточки, подробно объясняющий ограничение остатка
        let dayHintText = `Теоретический пиковый сценарий расхода бюджета в день внесения правок из-за наложения суточных лимитов старой и новой конфигураций стратегий. Складывается из: `;
        if (oldDayTheoreticalLimit > oldBudgetRemainder) {
            dayHintText += `остатка старого бюджета (${formatNumber(Math.round(oldBudgetRemainder))} ₽, так как теоретический лимит старой стратегии ${oldCoeff * 100}% составлял ${formatNumber(Math.round(oldDayTheoreticalLimit))} ₽, но кампания ограничена остатком средств)`;
        } else {
            dayHintText += `${oldCoeff * 100}% от старого бюджета (${formatNumber(Math.round(oldDayTheoreticalLimit))} ₽)`;
        }
        dayHintText += ` + ${newCoeff * 100}% от нового бюджета (${formatNumber(Math.round(dayNewComponent))} ₽).`;
        
        // Динамическое обновление заголовка и подсказки второй карточки
        dynamicDayTitle.innerHTML = `Сколько кампания может потратить ${daysTargetMap[dayIdx]} <span class="hint-trigger" data-hint="${dayHintText}">?</span>`;

        // Количество дней со дня рестарта (Пн = 7 дней, ..., Вс = 1 день)
        const daysFromRestart = 8 - dayIdx; 

        let availableNewBudgetRemainder = 0;
        let weekHintText = "";

        // Расчет остатка бюджета на неделю и формирование первой подсказки (с ограничением сверху в 100% нового бюджета)
        if (newModel === 'conversions') {
            availableNewBudgetRemainder = newBudget;
            weekHintText = "Суммарный лимит, который кампания технически может освоить за текущую календарную неделю (Фактический расход до рестарта + 100% нового бюджета).";
        } else {
            const fullDaysComponent = (newBudget / 7) * (daysFromRestart - 1);
            const restartDayComponent = newBudget * 0.35;
            const rawRemainder = fullDaysComponent + restartDayComponent;

            // Применение лимита: остаток не может превышать 100% нового недельного бюджета
            availableNewBudgetRemainder = Math.min(rawRemainder, newBudget);

            if (rawRemainder > newBudget) {
                weekHintText = `Суммарный лимит за текущую календарную неделю для CPC. По формуле остаток бюджета до конца недели (${formatNumber(Math.round(rawRemainder))} ₽) превысил новый недельный лимит, поэтому алгоритм ограничен ровно до 100% нового бюджета (${formatNumber(newBudget)} ₽). Итог: Фактический расход до рестарта + новый бюджет целиком.`;
            } else {
                weekHintText = `Суммарный лимит за текущую календарную неделю для CPC. Складывается из: Фактического расхода до рестарта + 35% от нового бюджета (в день правок) + среднесуточного лимита (новый бюджет / 7) за оставшиеся полные дни до конца недели (их осталось: ${daysFromRestart - 1}).`;
            }
        }

        // Запись динамической подсказки в первую карточку результатов
        totalWeekHint.setAttribute('data-hint', weekHintText);

        // Итоговый прогноз за неделю
        const totalWeekForecast = expensesBefore + availableNewBudgetRemainder;

        // Вывод результатов на экран
        outTotalWeekForecast.textContent = `${formatNumber(Math.round(totalWeekForecast))} ₽`;
        outMaxDayRiskCombo.textContent = `${formatNumber(Math.round(maxDayRiskCombo))} ₽`;
    }

    [oldModelSelect, newModelSelect, restartDaySelect].forEach(select => {
        select.addEventListener('change', calculateRestart);
    });

    handleInputChangeRestrictions();
});
