<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>حاسبة احترافية</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <main class="calculator-container">
        <!-- الشريط العلوي -->
        <header class="calc-header">
            <h1 class="logo">حاسبة</h1>
            <div class="header-actions">
                <button id="theme-toggle" aria-label="تبديل المظهر" class="icon-btn">
                    <!-- أيقونة الشمس (تظهر في الوضع الداكن للتبديل للفاتح) -->
                    <svg id="sun-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="theme-icon"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                    <!-- أيقونة القمر -->
                    <svg id="moon-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="theme-icon hidden"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                </button>
                <button id="history-toggle" aria-label="فتح سجل العمليات" class="icon-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                </button>
            </div>
        </header>

        <!-- شاشة العرض -->
        <section class="calc-display" aria-live="polite">
            <div class="previous-operand" id="previous-operand"></div>
            <div class="current-operand" id="current-operand">0</div>
        </section>

        <!-- لوحة الأزرار -->
        <section class="calc-keypad">
            <!-- الصف الأول -->
            <button class="btn action-btn" data-action="clear">AC</button>
            <button class="btn action-btn" data-action="delete">DEL</button>
            <button class="btn action-btn" data-action="percent">%</button>
            <button class="btn op-btn" data-op="÷">÷</button>
            
            <!-- الصف الثاني -->
            <button class="btn num-btn" data-num="7">7</button>
            <button class="btn num-btn" data-num="8">8</button>
            <button class="btn num-btn" data-num="9">9</button>
            <button class="btn op-btn" data-op="×">×</button>
            
            <!-- الصف الثالث -->
            <button class="btn num-btn" data-num="4">4</button>
            <button class="btn num-btn" data-num="5">5</button>
            <button class="btn num-btn" data-num="6">6</button>
            <button class="btn op-btn" data-op="−">−</button>
            
            <!-- الصف الرابع -->
            <button class="btn num-btn" data-num="1">1</button>
            <button class="btn num-btn" data-num="2">2</button>
            <button class="btn num-btn" data-num="3">3</button>
            <button class="btn op-btn" data-op="+">+</button>
            
            <!-- الصف الخامس -->
            <button class="btn action-btn" data-action="sign">±</button>
            <button class="btn num-btn" data-num="0">0</button>
            <button class="btn num-btn" data-num=".">.</button>
            <button class="btn equals-btn" data-action="equals">=</button>
        </section>