// --- إدارة حالة الآلة الحاسبة والمنطق ---
class Calculator {
    constructor(previousOperandElement, currentOperandElement) {
        this.previousOperandElement = previousOperandElement;
        this.currentOperandElement = currentOperandElement;
        this.clear();
        this.shouldResetScreen = false;
        this.errorState = false;
    }

    clear() {
        this.currentOperand = '0';
        this.previousOperand = '';
        this.operation = undefined;
        this.errorState = false;
        this.shouldResetScreen = false;
        this.currentOperandElement.classList.remove('error');
    }

    delete() {
        if (this.errorState) {
            this.clear();
            return;
        }
        if (this.currentOperand === '0' || this.currentOperand.length === 1 || 
           (this.currentOperand.length === 2 && this.currentOperand.startsWith('-'))) {
            this.currentOperand = '0';
            return;
        }
        this.currentOperand = this.currentOperand.toString().slice(0, -1);
    }

    appendNumber(number) {
        if (this.errorState) this.clear();
        if (number === '.' && this.currentOperand.includes('.')) return;
        if (this.shouldResetScreen) {
            this.currentOperand = number;
            this.shouldResetScreen = false;
        } else {
            if (this.currentOperand === '0' && number !== '.') {
                this.currentOperand = number;
            } else {
                this.currentOperand += number;
            }
        }
    }

    toggleSign() {
        if (this.errorState) return;
        if (this.currentOperand === '0') return;
        this.currentOperand = (parseFloat(this.currentOperand) * -1).toString();
    }

    applyPercent() {
        if (this.errorState) return;
        const current = parseFloat(this.currentOperand);
        if (isNaN(current)) return;

        if (this.operation && ['+', '−'].includes(this.operation)) {
            // منطق الحاسبة التقليدية: 200 + 10% = 220
            const prev = parseFloat(this.previousOperand);
            if (!isNaN(prev)) {
                this.currentOperand = ((prev * current) / 100).toString();
                return;
            }
        }
        // في حال الضرب/القسمة أو عدم وجود عملية سابقة: 10% = 0.1
        this.currentOperand = (current / 100).toString();
    }

    chooseOperation(operation) {
        if (this.errorState) this.clear();
        if (this.currentOperand === '0' && this.previousOperand === '') {
            if (operation === '−') {
                 // دعم البدء برقم سالب
                 this.currentOperand = '-';
                 return;
            }
        }
        if (this.currentOperand === '-' || this.currentOperand === '') return;
        
        if (this.previousOperand !== '') {
            this.compute();
        }
        if(this.errorState) return;

        this.operation = operation;
        this.previousOperand = this.currentOperand;
        this.shouldResetScreen = true;
    }

    compute() {
        let computation;
        const prev = parseFloat(this.previousOperand);
        const current = parseFloat(this.currentOperand);
        if (isNaN(prev) || isNaN(current)) return;

        switch (this.operation) {
            case '+':
                computation = prev + current;
                break;
            case '−':
                computation = prev - current;
                break;
            case '×':
                computation = prev * current;
                break;
            case '÷':
                if (current === 0) {
                    this.showError("لا يمكن القسمة على صفر");
                    return;
                }
                computation = prev / current;
                break;
            default:
                return;
        }

        // معالجة مشكلة الدقة العشرية (مثال: 0.1 + 0.2)
        computation = parseFloat(computation.toPrecision(15));

        // حفظ العملية في السجل
        saveToHistory(`${this.formatNumber(prev)} ${this.operation} ${this.formatNumber(current)}`, computation);

        this.currentOperand = computation.toString();
        this.operation = undefined;
        this.previousOperand = '';
        this.shouldResetScreen = true;
    }

    showError(msg) {
        this.currentOperand = msg;
        this.previousOperand = '';
        this.operation = undefined;
        this.errorState = true;
        this.currentOperandElement.classList.add('error');
    }

    formatNumber(number) {
        if (this.errorState) return number;
        if (number === '-') return '-';
        const stringNumber = number.toString();
        const integerDigits = parseFloat(stringNumber.split('.')[0]);
        const decimalDigits = stringNumber.split('.')[1];
        let integerDisplay;
        if (isNaN(integerDigits)) {
            integerDisplay = '';
        } else {
            // تنسيق بدون فواصل الآلاف لتجنب تعارض الكتابة RTL
            integerDisplay = integerDigits.toLocaleString('en', { maximumFractionDigits: 0 });
        }
        if (decimalDigits != null) {
            return `${integerDisplay}.${decimalDigits}`;
        } else {
            return integerDisplay;
        }
    }

    updateDisplay() {
        if (this.errorState) {
            this.currentOperandElement.textContent = this.currentOperand;
            this.previousOperandElement.textContent = '';
            return;
        }

        // تعديل حجم الخط ديناميكياً للأرقام الطويلة
        if(this.currentOperand.length > 10) {
            this.currentOperandElement.style.fontSize = '2.2rem';
        } else if(this.currentOperand.length > 7) {
            this.currentOperandElement.style.fontSize = '2.8rem';
        } else {
            this.currentOperandElement.style.fontSize = '3.5rem';
        }

        this.currentOperandElement.textContent = this.formatNumber(this.currentOperand);
        if (this.operation != null) {
            this.previousOperandElement.textContent = `${this.formatNumber(this.previousOperand)} ${this.operation}`;
        } else {
            this.previousOperandElement.textContent = '';
        }
    }
}

// --- التهيئة والربط بالواجهة ---
const previousOperandElement = document.getElementById('previous-operand');
const currentOperandElement = document.getElementById('current-operand');
const calculator = new Calculator(previousOperandElement, currentOperandElement);

// ربط أزرار الأرقام
document.querySelectorAll('.num-btn').forEach(button => {
    button.addEventListener('click', () => {
        calculator.appendNumber(button.dataset.num);
        calculator.updateDisplay();
    });
});

// ربط أزرار العمليات
document.querySelectorAll('.op-btn').forEach(button => {
    button.addEventListener('click', () => {
        calculator.chooseOperation(button.dataset.op);
        calculator.updateDisplay();
    });
});

// ربط أزرار الإجراءات
document.querySelector('[data-action="clear"]').addEventListener('click', () => {
    calculator.clear();
    calculator.updateDisplay();
});

document.querySelector('[data-action="delete"]').addEventListener('click', () => {
    calculator.delete();
    calculator.updateDisplay();
});

document.querySelector('[data-action="sign"]').addEventListener('click', () => {
    calculator.toggleSign();
    calculator.updateDisplay();
});

document.querySelector('[data-action="percent"]').addEventListener('click', () => {
    calculator.applyPercent();
    calculator.updateDisplay();
});

document.querySelector('[data-action="equals"]').addEventListener('click', () => {
    calculator.compute();
    calculator.updateDisplay();
});

// --- دعم لوحة المفاتيح ---
window.addEventListener('keydown', e => {
    if (e.key >= 0 && e.key <= 9) calculator.appendNumber(e.key);
    if (e.key === '.') calculator.appendNumber('.');
    if (e.key === '=' || e.key === 'Enter') {
        e.preventDefault();
        calculator.compute();
    }
    if (e.key === 'Backspace') calculator.delete();
    if (e.key === 'Escape') calculator.clear();
    if (e.key === '+') calculator.chooseOperation('+');
    if (e.key === '-') calculator.chooseOperation('−');
    if (e.key === '*') calculator.chooseOperation('×');
    if (e.key === '/') {
        e.preventDefault();
        calculator.chooseOperation('÷');
    }
    calculator.updateDisplay();
});

// --- ميزة نسخ النتيجة (Clipboard) ---
currentOperandElement.addEventListener('click', () => {
    if (calculator.errorState || calculator.currentOperand === '0') return;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(calculator.currentOperand).then(() => {
            showToast();
        }).catch(err => console.error('فشل النسخ:', err));
    }
});

function showToast() {
    const toast = document.getElementById('toast');
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 2000);
}

// --- إدارة الوضع الداكن والفاتح ---
const themeToggleBtn = document.getElementById('theme-toggle');
const sunIcon = document.getElementById('sun-icon');
const moonIcon = document.getElementById('moon-icon');

function setTheme(themeName) {
    try {
        localStorage.setItem('calc-theme', themeName);
    } catch(e) {} // معالجة تعطيل التخزين المحلي
    
    document.documentElement.setAttribute('data-theme', themeName);
    if (themeName === 'light') {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    } else {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    }
}

// تحميل المظهر المفضل
const getPreferredTheme = () => {
    try {
        const savedTheme = localStorage.getItem('calc-theme');
        if (savedTheme) return savedTheme;
    } catch(e) {}
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

setTheme(getPreferredTheme());

themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    setTheme(currentTheme === 'light' ? 'dark' : 'light');
});

// --- إدارة سجل العمليات ---
const historyToggleBtn = document.getElementById('history-toggle');
const closeHistoryBtn = document.getElementById('close-history');
const historyPanel = document.getElementById('history-panel');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history');

let calcHistory = [];

function loadHistory() {
    try {
        const stored = localStorage.getItem('calc-history');
        if (stored) {
            calcHistory = JSON.parse(stored);
        }
    } catch(e) {
        calcHistory = [];
    }
    renderHistory();
}

function saveToHistory(expr, res) {
    calcHistory.unshift({ expression: expr, result: res });
    if (calcHistory.length > 20) calcHistory.pop(); // حفظ آخر 20 عملية فقط
    try {
        localStorage.setItem('calc-history', JSON.stringify(calcHistory));
    } catch(e) {}
    renderHistory();
}

function renderHistory() {
    historyList.innerHTML = '';
    if (calcHistory.length === 0) {
        historyList.innerHTML = '<li class="empty-history">لا توجد عمليات سابقة</li>';
        return;
    }
    calcHistory.forEach(item => {
        const li = document.createElement('li');
        li.className = 'history-item';
        
        const exprDiv = document.createElement('div');
        exprDiv.className = 'history-expr';
        exprDiv.textContent = item.expression;
        
        const resDiv = document.createElement('div');
        resDiv.className = 'history-res';
        // التنسيق لضمان عدم وجود كسور طويلة جداً في السجل
        let formattedRes = parseFloat(item.result);
        formattedRes = isNaN(formattedRes) ? item.result : parseFloat(formattedRes.toPrecision(15)).toString();
        resDiv.textContent = `= ${formattedRes}`;
        
        li.appendChild(exprDiv);
        li.appendChild(resDiv);
        
        // إعادة استخدام النتيجة عند الضغط عليها
        li.addEventListener('click', () => {
            calculator.clear();
            calculator.currentOperand = formattedRes.toString();
            calculator.updateDisplay();
            historyPanel.classList.add('hidden');
        });
        
        historyList.appendChild(li);
    });
}

historyToggleBtn.addEventListener('click', () => {
    loadHistory();
    historyPanel.classList.remove('hidden');
});

closeHistoryBtn.addEventListener('click', () => {
    historyPanel.classList.add('hidden');
});

clearHistoryBtn.addEventListener('click', () => {
    calcHistory = [];
    try {
        localStorage.removeItem('calc-history');
    } catch(e) {}
    renderHistory();
});

// تحميل السجل الأولي بصمت
loadHistory();
