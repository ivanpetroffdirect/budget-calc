const daysTranslation = {
    1: ['понедельника', 'понедельник'],
    2: ['вторника', 'вторник'],
    3: ['среды', 'среду'],
    4: ['четверга', 'четверг'],
    5: ['пятницы', 'пятницу'],
    6: ['субботы', 'субботу'],
    7: ['воскресенья', 'воскресенье']
};

function init() {
    setupListeners();
    updateDynamicLabel();
    calculateRestartBlock();
}

// Вспомогательная функция форматирования (добавляет пробелы между тысячами)
function formatNumberWithSpaces(value) {
    const cleanValue = value.replace(/[^0-9]/g, '');
    return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Вспомогательная функция очистки (удаляет пробелы для математических вычислений)
function parseNumber(value) {
    const cleanValue = value.replace(/\s/g, '');
    return parseFloat(cleanValue) || 0;
}

function setupListeners() {
    document.getElementById('oldModelRestart').addEventListener('change', calculateRestartBlock);
    document.getElementById('newModelRestart').addEventListener('change', calculateRestartBlock);
    
    const numericInputs = ['expensesBeforeRestart', 'oldBudget', 'newBudget'];
    numericInputs.forEach(id => {
        const input = document.getElementById(id);
        input.addEventListener('input', (e) => {
            const cursorPosition = e.target.selectionStart;
            const oldLength = e.target.value.length;
            
            e.target.value = formatNumberWithSpaces(e.target.value);
            
            const newLength = e.target.value.length;
            e.target.setSelectionRange(cursorPosition + (newLength - oldLength), cursorPosition + (newLength - oldLength));
            
            calculateRestartBlock();
        });
    });
    
    document.getElementById('restartDay').addEventListener('change', () => {
        updateDynamicLabel();
        calculateRestartBlock();
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const popup = document.getElementById('hintPopup');
            if (popup.classList.contains('active')) {
                popup.classList.remove('active');
            }
        }
    });
}

function toggleHint(triggerElement) {
    const parent = triggerElement.closest('.form-group') || triggerElement.closest('div');
    const hint = parent.querySelector('.field-hint');
    
    if (hint) {
        const popup = document.getElementById('hintPopup');
        const popupText = document.getElementById('popupText');
        
        popupText.innerText = hint.innerText;
        popup.classList.add('active');
    }
}

function closeHintPopup(event) {
    const popup = document.getElementById('hintPopup');
    popup.classList.remove('active');
}

function updateDynamicLabel() {
    const dayIndex = document.getElementById('restartDay').value;
    const dayData = daysTranslation[dayIndex];
    
    const inputLabel = document.getElementById('dynamicExpensesLabel');
    inputLabel.innerHTML = `Фактические расходы с понедельника до ${dayData[0]} <span class="hint-trigger" onclick="toggleHint(this)">?</span>`;
    
    const outputTitle = document.getElementById('dynamicDayTitle');
    outputTitle.innerText = `Максимально возможный расход в ${dayData[1]} (день рестарта):`;
}

function calculateRestartBlock() {
    const oldBudget = parseNumber(document.getElementById('oldBudget').value);
    const newBudget = parseNumber(document.getElementById('newBudget').value);
    const expensesBeforeRestart = parseNumber(document.getElementById('expensesBeforeRestart').value);
    
    const oldModel = document.getElementById('oldModelRestart').value;
    const newModel = document.getElementById('newModelRestart').value;

    const oldDayFactor = (oldModel === 'clicks') ? 0.35 : 1.0;
    const newDayFactor = (newModel === 'clicks') ? 0.35 : 1.0;

    const dayOldComponent = Math.round(oldBudget * oldDayFactor);
    const dayNewComponent = Math.round(newBudget * newDayFactor);
    const maxDayRiskCombo = dayOldComponent + dayNewComponent;

    const budgetAfterRestart = newBudget;
    const totalWeekForecast = expensesBeforeRestart + budgetAfterRestart;

    document.getElementById('outNewBudgetRest').innerText = `${budgetAfterRestart.toLocaleString()} ₽`;
    document.getElementById('outTotalWeekForecast').innerText = `${totalWeekForecast.toLocaleString()} ₽`;
    document.getElementById('outDayOldComponent').innerText = `${dayOldComponent.toLocaleString()} ₽`;
    document.getElementById('outDayNewComponent').innerText = `${dayNewComponent.toLocaleString()} ₽`;
    document.getElementById('outMaxDayRiskCombo').innerText = `${maxDayRiskCombo.toLocaleString()} ₽`;

    // Заменена фраза «пиковые суточные лимиты» на «максимальный расход в день»
    let noticeText = `* `;
    if (oldModel !== newModel) {
        noticeText += `В день изменения настроек происходит смена модели оплаты, максимальный расход в день рассчитывается как ${oldDayFactor*100}% от старого бюджета + ${newDayFactor*100}% от нового бюджета.`;
    } else {
        noticeText += `При изменении бюджета максимальный расход в день составляет ${oldDayFactor*100}% от старого и нового бюджетов соответственно.`;
    }
    document.getElementById('restartNotice').innerText = noticeText;
}

window.onload = init;
