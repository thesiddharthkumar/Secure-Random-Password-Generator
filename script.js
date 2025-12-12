document.addEventListener('DOMContentLoaded', () => {
    const CHARS = {
        upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        lower: 'abcdefghijklmnopqrstuvwxyz',
        num: '0123456789',
        sym: '!@#$%^&*()_+~`|}{[]:;?><,./-=',
        ambiguous: 'Il1O0',
        similar: 'il1|o0O'
    };
    
    const htmlEl = document.documentElement;
    const loader = document.getElementById('loader');
    
    const display = document.getElementById('password');
    const displayContainer = document.querySelector('.display-container');
    const lengthRange = document.getElementById('lengthRange');
    const lengthValue = document.getElementById('lengthValue');
    
    const opts = {
        upper: document.getElementById('uppercase'),
        lower: document.getElementById('lowercase'),
        num: document.getElementById('numbers'),
        sym: document.getElementById('symbols'),
        avoidAmbiguous: document.getElementById('avoidAmbiguous'),
        excludeSimilar: document.getElementById('excludeSimilar')
    };
    
    const strengthBar = document.getElementById('strengthBar');
    const entropyText = document.getElementById('entropyText');
    const strengthLabel = document.getElementById('strengthLabel');
    const patternWarning = document.getElementById('patternWarning');
    const specialChars = document.getElementById('specialChars');
    const passwordAge = document.getElementById('passwordAge');

    const generateBtn = document.getElementById('generateMainBtn');
    const copyBtn = document.getElementById('copyBtn');
    const visibilityBtn = document.getElementById('visibilityBtn');
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const securityBtn = document.getElementById('securityBtn');
    const phishingCheckBtn = document.getElementById('phishingCheckBtn');
    
    const historyBtn = document.getElementById('historyBtn');
    const historyDrawer = document.getElementById('historyDrawer');
    const closeHistory = document.getElementById('closeHistory');
    const deleteHistoryBtn = document.getElementById('deleteHistoryBtn');
    const exportHistoryBtn = document.getElementById('exportHistoryBtn');
    const historyList = document.getElementById('historyList');
    
    const securityModal = document.getElementById('securityModal');
    const closeSecurity = document.getElementById('closeSecurity');
    const securityReport = document.getElementById('securityReport');
    
    const notification = document.getElementById('notification');
    const notifText = document.getElementById('notif-text');
    const passwordExpiry = document.getElementById('passwordExpiry');

    let passwordHistory = JSON.parse(localStorage.getItem('securegen_history') || '[]');
    let currentPassword = '';
    let passwordTimestamp = null;
    let autoRefreshTimer = null;
    let isMasked = false;


    function showToast(msg, type = 'info') {
        notifText.innerText = msg;
        const icon = notification.querySelector('i');
        
        notification.classList.remove('hidden');
        
        if (type === 'error') icon.className = "bi bi-exclamation-octagon-fill";
        else if (type === 'warning') icon.className = "bi bi-exclamation-triangle-fill";
        else icon.className = "bi bi-check-circle-fill";
        
        if(type === 'error') notification.style.background = 'var(--danger)';
        else if(type === 'warning') notification.style.background = 'var(--warning)';
        else notification.style.background = 'var(--text-primary)';

        setTimeout(() => {
            notification.classList.add('hidden');
            setTimeout(() => notification.style.background = '', 400); 
        }, 2500);
    }

    function getEnhancedPool() {
        let pool = '';
        let charSets = [];
        if (opts.upper.checked) charSets.push(CHARS.upper);
        if (opts.lower.checked) charSets.push(CHARS.lower);
        if (opts.num.checked) charSets.push(CHARS.num);
        if (opts.sym.checked) charSets.push(CHARS.sym);
        
        pool = charSets.join('');
        if (opts.avoidAmbiguous.checked) pool = pool.split('').filter(c => !CHARS.ambiguous.includes(c)).join('');
        if (opts.excludeSimilar.checked) pool = pool.split('').filter(c => !CHARS.similar.includes(c)).join('');
        
        return { pool, charSets };
    }

    function generateSecurePassword(animate = true) {
        const length = +lengthRange.value;
        const { pool, charSets } = getEnhancedPool();
        
        if (!pool || charSets.length === 0) {
            showToast('Select at least one option!', 'error');
            displayContainer.classList.add('shake');
            setTimeout(() => displayContainer.classList.remove('shake'), 400);
            return;
        }
        
        let result = '';
        const array = new Uint32Array(length);
        window.crypto.getRandomValues(array);
        
        // Ensure at least one character from each selected set is included
        for (let i = 0; i < charSets.length && i < length; i++) {
            const subArray = new Uint32Array(1);
            window.crypto.getRandomValues(subArray);
            result += charSets[i][subArray[0] % charSets[i].length];
        }
        
        // Fill the rest of the password
        for (let i = result.length; i < length; i++) {
            result += pool[array[i] % pool.length];
        }
        
        result = shuffleString(result);
        currentPassword = result;
        passwordTimestamp = new Date();
        
        if (animate) scrambleText(result);
        else updateDisplay(result, pool.length);
        
        addToHistory(result);
        startAutoRefresh();
    }

    function updateDisplay(result, poolLen) {
        display.value = result;
        if (isMasked) display.classList.add('masked');
        updatePasswordStats(result);
        updateStrength(result, poolLen);
    }

    function shuffleString(str) {
        const arr = str.split('');
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr.join('');
    }

    function scrambleText(finalText) {
        let iterations = 0;
        const pool = getEnhancedPool().pool || CHARS.upper;
        
        if (display.scrambleInterval) clearInterval(display.scrambleInterval);
        
        display.scrambleInterval = setInterval(() => {
            display.value = finalText.split("").map((letter, index) => {
                if (index < iterations) return finalText[index];
                return pool[Math.floor(Math.random() * pool.length)];
            }).join("");
            
            if (iterations >= finalText.length) {
                clearInterval(display.scrambleInterval);
                updateDisplay(finalText, pool.length);
            }
            iterations += 1/3;
        }, 30);
    }

    function updateStrength(password, poolSize) {
        const effectivePoolSize = Math.max(1, poolSize);
        let entropy = Math.floor(password.length * Math.log2(effectivePoolSize));
        
        entropyText.innerText = `${entropy} bits`;
        let percentage = Math.min(100, (entropy / 128) * 100);
        
        let color = 'var(--danger)';
        let label = "Weak";

        if (entropy >= 100) { label = "Excellent"; color = 'var(--info)'; }
        else if (entropy >= 80) { label = "Strong"; color = 'var(--success)'; }
        else if (entropy >= 50) { label = "Medium"; color = 'var(--warning)'; }

        strengthLabel.innerText = label;
        strengthBar.style.width = `${percentage}%`;
        strengthBar.style.backgroundColor = color;
    }

    function updatePasswordStats(password) {
        const specialCount = (password.match(/[!@#$%^&*()_+~`|}{[\]:;?><,./\-=]/g) || []).length;
        specialChars.textContent = `${specialCount} special`;
        
        const hasPattern = /(.)\1{2,}|123|abc|password/i.test(password);
        if(hasPattern) {
            patternWarning.classList.remove('hidden');
            patternWarning.style.animation = 'none';
            patternWarning.offsetHeight; 
            patternWarning.style.animation = 'pop 0.3s ease';
        }
        else patternWarning.classList.add('hidden');
        
        passwordAge.textContent = 'Just now';
        
        specialChars.style.animation = 'none';
        specialChars.offsetHeight;
        specialChars.style.animation = 'pop 0.3s ease';
    }

    function runSecurityAudit() {
        if (!display.value || display.value === 'Generating...') {
            showToast('Generate a password first', 'warning');
            return;
        }
        
        securityModal.classList.add('active');
        const pwd = display.value;
        let score = 0;
        let html = '';

        // Checks
        const checks = [
            { label: 'Length > 14', pass: pwd.length > 14, pts: 25 },
            { label: 'Contains Symbols', pass: /[!@#$%^&*]/.test(pwd), pts: 20 },
            { label: 'Contains Numbers', pass: /[0-9]/.test(pwd), pts: 15 },
            { label: 'Contains Uppercase', pass: /[A-Z]/.test(pwd), pts: 15 },
            { label: 'Contains Lowercase', pass: /[a-z]/.test(pwd), pts: 15 },
            { label: 'No Repetitions', pass: !/(.)\1/.test(pwd), pts: 10 }
        ];

        checks.forEach(c => {
            if(c.pass) score += c.pts;
            html += `
            <div class="security-item">
                <span>${c.label}</span>
                <span class="security-score ${c.pass ? 'score-good' : 'score-poor'}">
                    ${c.pass ? 'PASS' : 'FAIL'}
                </span>
            </div>`;
        });
        
        const totalHtml = `
            <div class="security-item" style="border-bottom: 2px solid var(--border)">
                <span style="font-weight:700">Total Security Score</span>
                <span class="security-score ${score > 80 ? 'score-good' : 'score-medium'}">${score}/100</span>
            </div>` + html;

        securityReport.innerHTML = totalHtml;
    }

    // --- History Functions ---

    function renderHistory() {
        historyList.innerHTML = '';
        if(passwordHistory.length === 0) {
            historyList.innerHTML = '<div class="empty-state" style="text-align:center; padding:20px; color:var(--text-tertiary)">No history</div>';
            return;
        }
        passwordHistory.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.style.animationDelay = `${index * 0.05}s`; // Staggered list
            div.innerHTML = `<span>${item.password.substring(0,18)}...</span> <i class="bi bi-copy"></i>`;
            div.onclick = () => {
                display.value = item.password;
                updateDisplay(item.password, item.password.length); 
                historyDrawer.classList.remove('open');
            };
            historyList.appendChild(div);
        });
    }

    function addToHistory(pass) {
        if(pass === 'ERROR' || !pass) return;
        // Check if the exact password is the most recent one to prevent duplicates on manual re-generation
        if(passwordHistory.length > 0 && passwordHistory[0].password === pass) return;
        
        passwordHistory.unshift({ password: pass, timestamp: new Date() });
        if(passwordHistory.length > 20) passwordHistory.pop();
        localStorage.setItem('securegen_history', JSON.stringify(passwordHistory));
    }

    function exportHistoryToText() {
        if(passwordHistory.length === 0) {
            showToast('No history to export', 'warning');
            return;
        }

        const formattedText = passwordHistory.map(item => {
            // Ensure item.timestamp is treated as a date object or string
            const date = new Date(item.timestamp).toLocaleString();
            return `Password: ${item.password}\nGenerated: ${date}\n---`;
        }).join('\n');

        const blob = new Blob([formattedText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = 'passwords' + new Date().toISOString().slice(0, 10) + '.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('History exported', 'info');
    }

    // --- Auto-Refresh ---

    function startAutoRefresh() {
        if(autoRefreshTimer) clearTimeout(autoRefreshTimer);
        const sec = parseInt(passwordExpiry.value);
        if(sec > 0) {
            autoRefreshTimer = setTimeout(() => {
                generateSecurePassword(true);
                showToast('Auto-refreshed');
            }, sec * 1000);
        }
    }


    // --- Event Listeners ---
    lengthRange.addEventListener('input', (e) => {
        lengthValue.innerText = e.target.value;
        // Animation for value change
        lengthValue.style.transform = 'scale(1.2)';
        setTimeout(() => lengthValue.style.transform = 'scale(1)', 100);
        
        localStorage.setItem('securegen_length', e.target.value);
        generateSecurePassword(false);
    });

    Object.values(opts).forEach(opt => opt.addEventListener('change', () => generateSecurePassword(true)));

    generateBtn.addEventListener('click', () => {
        generateBtn.style.transform = 'scale(0.95)';
        setTimeout(() => generateBtn.style.transform = '', 100);
        generateSecurePassword(true);
    });

    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(display.value);
        showToast('Copied to clipboard');
        copyBtn.querySelector('i').classList.replace('bi-copy', 'bi-check2');
        setTimeout(() => copyBtn.querySelector('i').classList.replace('bi-check2', 'bi-copy'), 1500);
    });

    visibilityBtn.addEventListener('click', () => {
        isMasked = !isMasked;
        display.classList.toggle('masked', isMasked);
        visibilityBtn.querySelector('i').className = isMasked ? 'bi bi-eye-slash' : 'bi bi-eye';
        
        // pop effect
        visibilityBtn.style.transform = 'scale(1.2)';
        setTimeout(() => visibilityBtn.style.transform = '', 150);
    });

    securityBtn.addEventListener('click', runSecurityAudit);
    phishingCheckBtn.addEventListener('click', runSecurityAudit);
    closeSecurity.addEventListener('click', () => securityModal.classList.remove('active'));
    
    // History Events
    historyBtn.addEventListener('click', () => { renderHistory(); historyDrawer.classList.add('open'); });
    closeHistory.addEventListener('click', () => historyDrawer.classList.remove('open'));
    deleteHistoryBtn.addEventListener('click', () => {
        passwordHistory = [];
        localStorage.removeItem('securegen_history');
        renderHistory();
        showToast('History cleared', 'warning');
    });
    // Add the new export functionality here
    exportHistoryBtn.addEventListener('click', exportHistoryToText);

    // Theme & Init
    themeToggle.addEventListener('click', () => {
        const curr = htmlEl.getAttribute('data-theme');
        const next = curr === 'light' ? 'dark' : 'light';
        htmlEl.setAttribute('data-theme', next);
        themeIcon.className = next === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
        localStorage.setItem('securegen_theme', next);
        
        // Spin effect
        themeToggle.style.transform = 'rotate(180deg)';
        setTimeout(() => themeToggle.style.transform = 'rotate(0deg)', 400);
    });

    // Init Load
    const savedTheme = localStorage.getItem('securegen_theme') || 'light';
    htmlEl.setAttribute('data-theme', savedTheme);
    themeIcon.className = savedTheme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
    
    setTimeout(() => {
        loader.classList.add('hidden');
        if(localStorage.getItem('securegen_length')) {
            lengthRange.value = localStorage.getItem('securegen_length');
            lengthValue.innerText = lengthRange.value;
        }
        generateSecurePassword(false);
    }, 800);
});
