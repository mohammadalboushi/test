        /**
         * PROFESSIONAL CALCULATOR ENGINE
         * UPDATED: Fixed Implicit Multiplication after % (e.g. 400000%83 -> 400000%*83)
         */

        let appMode = 'calc'; 
        let activeInputId = 'val1'; 
        let activeCalcCurr = 'LBP'; 

        // Calculation State
        let diffStep = 1; 
        let diffStart = null;
        let timeUnit = 'sec';
        let isFinalState = false;
        
        // Repeated Equals Logic
        let lastRepeatedOp = null;
        let lastResultValue = 0;

        let historyData = [];
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // --- Sound & Initialization ---
        function playSound() {
            if(audioCtx.state === 'suspended') audioCtx.resume();
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.frequency.setValueAtTime(600, audioCtx.currentTime);
            o.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05);
            g.gain.setValueAtTime(0.05, audioCtx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
            o.connect(g); g.connect(audioCtx.destination);
            o.start(); o.stop(audioCtx.currentTime + 0.05);
        }

        window.onload = () => { 
            loadState(); 
            resetTempData();
            setupFastClicks();
            document.querySelectorAll('.curr-val-input').forEach(inp => {
                inp.addEventListener('click', () => setActiveInput(inp.id));
            });
            updateUI(false); 
        };

        function resetTempData() {
            appMode = 'calc';
            diffStep = 1; diffStart = null;
            timeUnit = 'sec';
            isFinalState = false;
            lastRepeatedOp = null;
        }

        // --- Core Input Logic ---
        function setActiveInput(id) {
            activeInputId = id;
            document.querySelectorAll('.curr-box').forEach(b => b.classList.remove('active'));
            document.getElementById(id).parentElement.classList.add('active');
        }

        function setupFastClicks() {
            document.querySelectorAll('.k-btn').forEach(btn => {
                btn.addEventListener('touchstart', (e) => { e.preventDefault(); btn.classList.add('pressed'); handleInput(btn); }, {passive: false});
                btn.addEventListener('touchend', (e) => { e.preventDefault(); btn.classList.remove('pressed'); });
                btn.addEventListener('mousedown', (e) => { e.preventDefault(); btn.classList.add('pressed'); handleInput(btn); }); 
                btn.addEventListener('mouseup', () => btn.classList.remove('pressed'));
                btn.addEventListener('mouseleave', () => btn.classList.remove('pressed'));
            });

            // Fast Events Helpers
            const bind = (id, fn) => {
                const el = document.getElementById(id);
                if(el) {
                    el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }, {passive: false});
                    el.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
                }
            };

            bind('btnRate', openRate);
            bind('btnGrid', toggleTools);
            bind('btnHome', () => switchMode('calc'));
            bind('toolAge', () => switchMode('age'));
            bind('toolDiff', () => switchMode('diff'));
            bind('toolScale', () => switchMode('scale'));
            bind('toolSpeed', () => switchMode('speed'));
            bind('toolHistory', openHistory); 
            bind('btnCloseHist', closeModals);
            bind('btnCloseRate', closeModals);
            bind('btnSaveRate', closeModals);
            bind('btnClearHistory', clearHistory);
            bind('btnBackspace', deleteChar);
            bind('currencyToggleBtn', toggleCurrency);

            document.getElementById('box1').onclick = () => { setActiveInput('val1'); document.getElementById('val1').focus(); };
            document.getElementById('box2').onclick = () => { setActiveInput('val2'); document.getElementById('val2').focus(); };
            document.getElementById('box3').onclick = () => { setActiveInput('val3'); document.getElementById('val3').focus(); };
            document.getElementById('label2').onclick = () => { if(appMode === 'speed') toggleTimeUnit(); };
        }

        function toggleCurrency() {
            if(appMode !== 'calc') return;
            const btn = document.getElementById('currencyToggleBtn');
            if(activeCalcCurr === 'LBP') {
                activeCalcCurr = 'USD';
                btn.innerText = 'دولار ($)';
            } else {
                activeCalcCurr = 'LBP';
                btn.innerText = 'ليرة (L.L)';
            }
            calculate(false);
        }

        function toggleTimeUnit() {
            timeUnit = (timeUnit === 'sec') ? 'min' : (timeUnit === 'min') ? 'hour' : 'sec';
            updateUI();
        }

        // --- Input Handling ---
        function handleInput(btn) {
            playSound();
            const val = btn.getAttribute('data-val');
            const action = btn.getAttribute('data-action');
            
            if(isFinalState) {
                if (val && !['+','-','*','/','%'].includes(val)) {
                    clearAll(false);
                } else if (['+','-','*','/','%'].includes(val)) {
                    document.getElementById('val1').value = formatString(lastResultValue.toString());
                    isFinalState = false;
                    document.getElementById('resultContainer').classList.remove('final-state');
                } else {
                    isFinalState = false;
                    document.getElementById('resultContainer').classList.remove('final-state');
                }
            }

            if (val) insertChar(val);
            else if (action) {
                if(action === 'clear') clearAll();
                else if(action === 'parens') { if (appMode === 'calc') insertParens(); }
                else if(action === 'calc') calculate(true);
            }
        }

        function cleanString(str) {
            if(!str) return '';
            return str.replace(/,/g, '').replace(/×/g, '*').replace(/÷/g, '/');
        }

        function formatString(str) {
            if(!str) return '';
            let visual = str.replace(/\*/g, '×').replace(/\//g, '÷');
            return visual.replace(/(\d+)(\.\d*)?/g, (match, p1, p2) => {
                return p1.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (p2 || "");
            });
        }

        function insertChar(char) {
            const input = document.getElementById(activeInputId);
            if(!input) return;

            let val = input.value;
            let rawVal = cleanString(val);
            const operators = ['+','-','*','/','%'];
            const lastChar = rawVal.slice(-1);

            // 1. منطق استبدال العمليات (التعديل هنا)
            // إذا كان الحرف الجديد عملية حسابية، والحرف السابق عملية حسابية أيضاً
            if (operators.includes(char) && operators.includes(lastChar) && appMode === 'calc') {
                // نمنع الاستبدال فقط إذا كان الحرف السابق هو %
                // لأننا نريد السماح بوجود %+ أو %- أو %*
                if (lastChar !== '%') {
                    val = val.slice(0, -1);
                }
            }

            // 2. Decimal logic
            if (char === '.') {
                const parts = rawVal.split(/[\+\-\*\/\%]/);
                const currentNumber = parts[parts.length - 1];
                if (currentNumber.includes('.')) return; 
                if (currentNumber === '') char = '0.'; 
            }

            // 3. IMPLICIT MULTIPLICATION AFTER %
            // If previous char was %, and user types a number, insert * automatically
            if (lastChar === '%' && !operators.includes(char) && char !== '.') {
                char = '*' + char;
            }

            let newRaw = cleanString(val) + char;
            input.value = (appMode === 'calc' || appMode === 'scale') ? formatString(newRaw) : newRaw;
            
            if(appMode === 'calc') calculate(false);
            else updateUI(true);
        }

        function insertParens() {
            insertChar('('); 
        }

        function deleteChar() {
            playSound();
            const input = document.getElementById(activeInputId);
            let val = input.value;
            if(isFinalState) {
                isFinalState = false;
                document.getElementById('resultContainer').classList.remove('final-state');
            }
            let raw = cleanString(val);
            let newRaw = raw.substring(0, raw.length - 1);
            input.value = formatString(newRaw);
            
            if(appMode === 'calc') calculate(false);
            else updateUI(true);
        }

        function clearAll(fullReset = true) {
            playSound();
            ['val1', 'val2', 'val3'].forEach(id => document.getElementById(id).value = '');
            if(fullReset) {
                if(appMode === 'diff') { diffStep = 1; diffStart = null; setActiveInput('val1'); }
                if(appMode === 'age') setActiveInput('val1');
                lastRepeatedOp = null;
            }
            isFinalState = false;
            document.getElementById('resultContainer').classList.remove('final-state');
            document.getElementById('mainResult').innerText = '0';
            document.getElementById('subResult').innerText = '';
        }

        // --- SEQUENTIAL MATH LOGIC (Left-To-Right) ---
        
        function computeSequential(expr) {
            try {
                // 1. تفكيك النص إلى أرقام وعمليات
                // نستخدم Regex لفصل الأرقام والعمليات والنسبة المئوية
                let tokens = expr.match(/(\d+(\.\d+)?)|([\+\-\*\/\%\(\)])/g);
                if (!tokens) return 0;

                // 2. المعالجة الذكية للنسبة المئوية (Merchant Logic)
                // الهدف: تحويل "100 - 10%" إلى "100 - 10" (أي خصم 10)
                let processedTokens = [];
                
                for (let i = 0; i < tokens.length; i++) {
                    if (tokens[i] === '%') {
                        // الرقم الذي قبل علامة %
                        let currentVal = parseFloat(processedTokens.pop()); 
                        
                        // العملية التي سبقت الرقم (مثلاً + أو -)
                        let prevOp = processedTokens.length > 0 ? processedTokens[processedTokens.length - 1] : null;
                        
                        // الرقم الأساسي الذي سنحسب النسبة منه (المبلغ الأصلي)
                        let baseNumber = processedTokens.length > 1 ? parseFloat(processedTokens[processedTokens.length - 2]) : 0;

                        if ((prevOp === '+' || prevOp === '-') && !isNaN(baseNumber)) {
                             // حالة الخصم والزيادة: النسبة تكون من المبلغ الأساسي
                             // مثال: 200000 - 10%  --> الـ 10% تصبح 20000
                             let percentValue = baseNumber * (currentVal / 100);
                             processedTokens.push(percentValue);
                        } else {
                            // حالة الضرب والقسمة العادية: مجرد قسمة على 100
                            // مثال: 5000 * 50% --> تعني 5000 * 0.5
                            processedTokens.push(currentVal / 100);
                        }
                    } else {
                        processedTokens.push(tokens[i]);
                    }
                }
                tokens = processedTokens;

                // 3. الحساب التسلسلي (تراكمي - مثل آلة المحل)
                let result = 0;
                let currentOp = '+';
                let i = 0;

                // معالجة الرقم الأول (أو إذا كان سالباً)
                if (tokens.length > 0 && !isNaN(parseFloat(tokens[0]))) {
                    result = parseFloat(tokens[0]);
                    i = 1;
                } else if (tokens.length > 1 && tokens[0] === '-' && !isNaN(parseFloat(tokens[1]))) {
                    result = -1 * parseFloat(tokens[1]);
                    i = 2;
                }

                // حلقة الحساب
                while (i < tokens.length) {
                    let token = tokens[i];
                    
                    if (['+', '-', '*', '/'].includes(token)) {
                        currentOp = token;
                        if (i + 1 < tokens.length) {
                            let nextVal = parseFloat(tokens[i + 1]);
                            if (!isNaN(nextVal)) {
                                switch (currentOp) {
                                    case '+': result += nextVal; break;
                                    case '-': result -= nextVal; break;
                                    case '*': result *= nextVal; break;
                                    case '/': if(nextVal !== 0) result /= nextVal; break;
                                }
                                i++; 
                            }
                        }
                    } 
                    i++;
                }

                return result;
            } catch (e) {
                return 0;
            }
        }

        function calculate(isEqualPressed) {
            if (appMode === 'calc') {
                const inputEl = document.getElementById('val1');
                let rawInput = cleanString(inputEl.value);

                // --- التعديل هنا ---
                // السماح لعلامة % بالمرور للحساب، وحذف باقي العمليات (+ - * /) فقط إذا كانت في آخر السطر
                const lastChar = rawInput.slice(-1);
                if (['+','-','*','/'].includes(lastChar)) {
                    if (!isEqualPressed) return; 
                    rawInput = rawInput.slice(0, -1);
                }
                // -------------------

                let result = 0;

                if (isEqualPressed && isFinalState && lastRepeatedOp) {
                    let tempExpr = `${lastResultValue}${lastRepeatedOp.op}${lastRepeatedOp.val}`;
                    result = computeSequential(tempExpr);
                } else {
                    result = computeSequential(rawInput);
                    
                    if (isEqualPressed) {
                        // حفظ آخر عملية للتكرار
                        // نستخدم regex يستثني الـ % من كونه عملية "تكرار" تقليدية لتجنب الأخطاء
                        const match = rawInput.match(/([\+\-\*\/])(\d+(\.\d+)?)$/);
                        if (match) {
                            lastRepeatedOp = { op: match[1], val: match[2] };
                        } else {
                            // إذا انتهت بـ % لا نقوم بحفظ التكرار بنفس الطريقة لأن الحساب تم داخلياً
                            lastRepeatedOp = null;
                        }
                    }
                }
                
                lastResultValue = result;

                // --- Currency Conversion ---
                const rate = parseFloat(document.getElementById('exchangeRate').value) || 1;
                let lbpVal = 0, usdVal = 0;
                let mainText = '', subText = '';

                if (activeCalcCurr === 'LBP') {
                    lbpVal = result; usdVal = result / rate;
                    mainText = formatReadable(lbpVal);
                    subText = formatReadable(usdVal) + ' $';
                } else {
                    usdVal = result; lbpVal = result * rate;
                    mainText = formatReadable(usdVal) + ' $';
                    subText = formatReadable(lbpVal) + ' L.L';
                }

                // Render
                const mainResEl = document.getElementById('mainResult');
                const subResEl = document.getElementById('subResult');
                fitText(mainResEl, mainText, true);
                fitText(subResEl, subText, false);

                if (isEqualPressed) {
                    addToHistory(rawInput, result, activeCalcCurr);
                    isFinalState = true;
                    document.getElementById('resultContainer').classList.add('final-state');
                } else {
                    isFinalState = false;
                    document.getElementById('resultContainer').classList.remove('final-state');
                }

            } else if (appMode === 'diff' && isEqualPressed && diffStep === 1) {
                let d = document.getElementById('val1').value;
                let m = document.getElementById('val2').value;
                let y = document.getElementById('val3').value;
                if(d && m && y) {
                    diffStart = new Date(parseInt(y), parseInt(m)-1, parseInt(d));
                    clearAll(false);
                    diffStep = 2;
                    setActiveInput('val1');
                    updateUI(true);
                }
            } else if (isEqualPressed) {
                updateUI(true);
            }
        }


        function liveCalculateOtherModes() {
            const v1 = cleanString(document.getElementById('val1').value);
            const v2 = cleanString(document.getElementById('val2').value);
            const v3 = cleanString(document.getElementById('val3').value);
            const mainRes = document.getElementById('mainResult');
            const subRes = document.getElementById('subResult');

            if (appMode === 'scale') {
                let w = parseFloat(v1) || 0; let p = parseFloat(v2) || 0;
                mainRes.innerText = formatReadable((w * p) / 1000);
                subRes.innerText = "الإجمالي";
            } 
            else if (appMode === 'speed') {
                let s = parseFloat(v1) || 0; let t = parseFloat(v2) || 0;
                let distKM = 0;
                if(timeUnit === 'hour') distKM = s * t;
                else if(timeUnit === 'min') distKM = s * (t / 60);
                else distKM = s * (t / 3600);
                mainRes.innerText = formatReadable(distKM) + ' كم';
                subRes.innerText = formatReadable(distKM * 1000) + ' متر';
            }
            else if (appMode === 'age' || appMode === 'diff') {
                let dateRes = null;
                if(appMode === 'age') dateRes = calculateAgeLogic(null, v1, v2, v3);
                else if (appMode === 'diff' && diffStep === 2) {
                     if(diffStart && v1 && v2 && v3.length===4) {
                         const d2 = new Date(parseInt(v3), parseInt(v2)-1, parseInt(v1));
                         let t1 = diffStart.getTime(); let t2 = d2.getTime();
                         let start = (t1 < t2) ? diffStart : d2; let end = (t1 < t2) ? d2 : diffStart;
                         let yy = end.getFullYear() - start.getFullYear();
                         let mm = end.getMonth() - start.getMonth();
                         let dd = end.getDate() - start.getDate();
                         if (dd < 0) { mm--; let pm = new Date(end.getFullYear(), end.getMonth(), 0); dd += pm.getDate(); }
                         if (mm < 0) { yy--; mm += 12; }
                         dateRes = { years: yy, months: mm, days: dd };
                    }
                }

                if (dateRes && !dateRes.error) {
                    mainRes.innerHTML = `
                        <div class="age-result-container">
                            <div class="age-box-res"><span class="age-num">${dateRes.years}</span><span class="age-txt">سنة</span></div>
                            <div class="age-box-res"><span class="age-num">${dateRes.months}</span><span class="age-txt">شهر</span></div>
                            <div class="age-box-res"><span class="age-num">${dateRes.days}</span><span class="age-txt">يوم</span></div>
                        </div>`;
                    if(appMode === 'age') subRes.innerText = `عيد ميلادك القادم بعد: ${dateRes.nextBirthday} يوم 🎂`;
                    else subRes.innerText = "الفرق الزمني";
                } else {
                    mainRes.innerText = '...';
                }
            }
        }

        function calculateAgeLogic(targetDate, dStr, mStr, yStr) {
            if(!dStr || !mStr || !yStr) return null;
            if(yStr.length < 4) return null;
            const d = parseInt(dStr); const m = parseInt(mStr); const y = parseInt(yStr);
            if(d>31 || m>12) return { error: 'التاريخ خطأ' };
            const birthDate = new Date(y, m - 1, d);
            const refDate = targetDate ? targetDate : new Date();
            let years = refDate.getFullYear() - birthDate.getFullYear();
            let months = refDate.getMonth() - birthDate.getMonth();
            let days = refDate.getDate() - birthDate.getDate();
            if (days < 0) { months--; const prev = new Date(refDate.getFullYear(), refDate.getMonth(), 0); days += prev.getDate(); }
            if (months < 0) { years--; months += 12; }
            let nextB = null;
            if(appMode === 'age') {
                const today = new Date();
                let next = new Date(today.getFullYear(), m - 1, d);
                if (today > next) next.setFullYear(today.getFullYear() + 1);
                const diffT = Math.abs(next - today);
                nextB = Math.ceil(diffT / (1000 * 60 * 60 * 24)); 
            }
            return { years: Math.abs(years), months: Math.abs(months), days: Math.abs(days), nextBirthday: nextB };
        }

        function fitText(el, text, isMain) {
            const len = text.length;
            let size = isMain ? 2.4 : 1.4;
            
            if(isFinalState) {
                size = isMain ? 2.8 : 1.6; 
                if (len > 10) size = isMain ? 2.2 : 1.3;
                if (len > 15) size = isMain ? 1.7 : 1.0;
                if (len > 22) size = isMain ? 1.3 : 0.8;
                if (len > 30) size = isMain ? 1.0 : 0.7;
            } else {
                if (len > 12) size = isMain ? 2.0 : 1.2;
                if (len > 18) size = isMain ? 1.6 : 1.0;
                if (len > 24) size = isMain ? 1.2 : 0.8;
                if (len > 32) size = isMain ? 1.0 : 0.7;
            }
            el.style.fontSize = size + 'rem';
            el.innerText = text;
        }

        function formatReadable(num) {
            if (num === undefined || num === null || isNaN(num)) return '0';
            let str = parseFloat(num.toFixed(10)).toLocaleString('en-US', { useGrouping: false });
            let parts = str.split('.');
            parts[0] = Number(parts[0]).toLocaleString('en-US');
            return parts[0] + (parts[1] ? '.' + parts[1].replace(/,/g, '') : '');
        }

        function switchMode(mode) {
            appMode = mode;
            clearAll(); 
            document.getElementById('toolsMenu').style.display = 'none';
            const box1 = document.getElementById('box1');
            const box2 = document.getElementById('box2');
            const box3 = document.getElementById('box3');
            const currBtn = document.getElementById('currencyToggleBtn');
            const label1 = document.getElementById('label1');

            if (mode === 'calc') {
                activeInputId = 'val1';
                box1.style.display = 'flex';
                box2.style.display = 'none';
                box3.style.display = 'none';
                currBtn.style.display = 'inline-block';
                label1.style.display = 'none';
                activeCalcCurr = 'LBP';
                currBtn.innerText = 'ليرة (L.L)';
            } else {
                box1.style.display = 'flex';
                box2.style.display = 'flex';
                currBtn.style.display = 'none';
                label1.style.display = 'block';
                activeInputId = 'val1';
            }
            setActiveInput(activeInputId);
            updateUI(false);
        }

        function toggleTools() {
            const menu = document.getElementById('toolsMenu');
            menu.style.display = (menu.style.display === 'grid') ? 'none' : 'grid';
        }

        function updateUI(reCalc) {
            const box1 = document.getElementById('box1'); const box2 = document.getElementById('box2'); const box3 = document.getElementById('box3');
            const btnEqual = document.getElementById('btnEqual');
            
            document.querySelectorAll('.tool-box').forEach(el => el.classList.remove('active'));
            if(appMode !== 'calc') document.getElementById('tool' + appMode.charAt(0).toUpperCase() + appMode.slice(1)).classList.add('active');
            
            btnEqual.innerText = '='; btnEqual.style.background = '';

            if (appMode === 'calc') {
                if(reCalc) calculate(false);
            } else if (appMode === 'scale') {
                box3.style.display = 'none';
                box2.style.display = 'flex'; 
                document.getElementById('label1').innerText = "الوزن (غ)"; document.getElementById('label2').innerText = "السعر (للكيلو)";
                if(reCalc) liveCalculateOtherModes();
            } else if (appMode === 'speed') {
                box3.style.display = 'none';
                box2.style.display = 'flex';
                document.getElementById('label1').innerText = "السرعة (كم/سا)"; 
                let unitT = "ثانية"; if(timeUnit==='min') unitT="دقيقة"; if(timeUnit==='hour') unitT="ساعة";
                document.getElementById('label2').innerText = "الوقت (" + unitT + ") 🔁";
                if(reCalc) liveCalculateOtherModes();
            } else if (appMode === 'age' || appMode === 'diff') {
                box3.style.display = 'flex';
                box2.style.display = 'flex';
                document.getElementById('label1').innerText = "اليوم"; document.getElementById('label2').innerText = "الشهر"; document.getElementById('label3').innerText = "السنة";
                if (appMode === 'diff') {
                    document.getElementById('subResult').innerText = diffStep === 1 ? "أدخل التاريخ الأول (1)" : "أدخل التاريخ الثاني (2)";
                    btnEqual.innerText = diffStep === 1 ? "التالي" : "=";
                    btnEqual.style.background = diffStep === 1 ? 'var(--blue-color)' : ''; 
                } else {
                    document.getElementById('subResult').innerText = "أدخل تاريخ ميلادك";
                }
                if(reCalc) liveCalculateOtherModes();
            }
            saveState();
        }

        // --- History & Storage ---
        function openHistory() { 
            document.getElementById('toolsMenu').style.display = 'none';
            renderHistory(); 
            document.getElementById('historyModal').classList.add('show'); 
            history.pushState({modal:true},null,location.href); 
        }
        function openRate() { document.getElementById('rateModal').classList.add('show'); history.pushState({modal:true},null,location.href); }
        function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('show')); }
        function clearHistory() { historyData=[]; saveState(); renderHistory(); }

        function addToHistory(eq, res, curr) {
            if(!eq || res === 0) return;
            const time = new Date().toLocaleTimeString('ar-LB',{hour:'2-digit',minute:'2-digit'});
            historyData.unshift({ eq, res, curr, time });
            if(historyData.length > 30) historyData.pop();
            saveState();
        }
        function renderHistory() {
            const list = document.getElementById('historyList'); list.innerHTML = '';
            if (appMode !== 'calc') { list.innerHTML = '<li style="text-align:center; padding:10px; color:#999">السجل متاح للآلة الحاسبة فقط</li>'; return; }
            historyData.forEach(item => {
                const li = document.createElement('li'); li.className = 'history-item';
                let vEq = item.eq.replace(/\*/g,'×').replace(/\//g,'÷');
                li.innerHTML = `<div style="font-size:0.8rem; direction:ltr">${vEq}</div><div style="font-weight:bold; color:var(--blue-color); direction:ltr">= ${formatReadable(item.res)} ${item.curr==='LBP'?'': '$'}</div>`;
                li.onclick = () => { 
                    closeModals();
                    activeCalcCurr = item.curr;
                    document.getElementById('currencyToggleBtn').innerText = (item.curr === 'LBP') ? 'ليرة (L.L)' : 'دولار ($)';
                    document.getElementById('val1').value = formatString(item.eq); 
                    calculate(true); 
                };
                list.appendChild(li);
            });
        }

        function saveState() {
            localStorage.setItem('rate', document.getElementById('exchangeRate').value);
            localStorage.setItem('hist', JSON.stringify(historyData));
        }
        function loadState() {
            if(localStorage.getItem('rate')) document.getElementById('exchangeRate').value = localStorage.getItem('rate');
            if(localStorage.getItem('hist')) historyData = JSON.parse(localStorage.getItem('hist'));
        }

        document.getElementById('exchangeRate').addEventListener('input', () => { updateUI(true); saveState(); });
        document.getElementById('btnSaveRate').addEventListener('click', closeModals);

        // --- KODULAR INTEGRATION ---
        function handleAndroidBack() {
            if(document.querySelector('.modal.show')) {
                closeModals();
                sendToKodular("STAY");
                return;
            }
            if(document.getElementById('toolsMenu').style.display === 'grid') {
                toggleTools();
                sendToKodular("STAY");
                return;
            }
            if(appMode !== 'calc') {
                switchMode('calc');
                sendToKodular("STAY");
                return;
            }
            sendToKodular("EXIT");
        }

        function sendToKodular(message) {
            if (window.AppInventor && window.AppInventor.setWebViewString) {
                window.AppInventor.setWebViewString(message);
            }
        }
        