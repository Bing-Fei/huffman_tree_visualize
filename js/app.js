/**
 * app.js — 哈夫曼树可视化演示 · 主应用逻辑
 *
 * 模块职责：
 *   1. 状态管理（当前步骤、播放状态、速度等）
 *   2. 输入管理（添加/删除字符、频率编辑）
 *   3. 随机字符集生成
 *   4. 构建哈夫曼树 & 可视化播放控制
 *   5. 结果表格 & 统计信息渲染
 */

// ============================================================
// 应用状态
// ============================================================
const AppState = {
    charFreqList: [],       // [{ char, freq }]
    steps: [],              // buildHuffmanTree 返回的 steps
    codes: {},              // 最终编码表
    currentStep: 0,         // 当前步骤索引
    isPlaying: false,       // 是否自动播放中
    playTimer: null,        // setInterval 句柄
    speed: 5,               // 播放速度 1-10
    visualizer: null,       // TreeVisualizer 实例
};

// 默认示例（CLRS 经典示例）
const DEFAULT_EXAMPLE = [
    { char: 'A', freq: 5 },
    { char: 'B', freq: 9 },
    { char: 'C', freq: 12 },
    { char: 'D', freq: 13 },
    { char: 'E', freq: 16 },
    { char: 'F', freq: 45 },
];

// ============================================================
// DOM 引用
// ============================================================
const DOM = {};

function cacheDom() {
    // 输入相关
    DOM.charTableBody  = document.getElementById('char-tbody');
    DOM.btnAddChar     = document.getElementById('btn-add-char');
    DOM.btnExample     = document.getElementById('btn-example');
    DOM.btnRandom      = document.getElementById('btn-random');
    DOM.btnClear       = document.getElementById('btn-clear');
    DOM.btnBuild       = document.getElementById('btn-build');

    // 控制相关
    DOM.controlPanel   = document.getElementById('control-panel');
    DOM.btnPrev        = document.getElementById('btn-prev');
    DOM.btnPlay        = document.getElementById('btn-play');
    DOM.btnNext        = document.getElementById('btn-next');
    DOM.btnReset       = document.getElementById('btn-reset');
    DOM.speedSlider    = document.getElementById('speed-slider');
    DOM.speedLabel     = document.getElementById('speed-label');
    DOM.stepCurrent    = document.getElementById('step-current');
    DOM.stepTotal      = document.getElementById('step-total');
    DOM.stepDesc       = document.getElementById('step-description');

    // 可视化
    DOM.treeSvg        = document.getElementById('tree-svg');
    DOM.placeholder    = document.getElementById('placeholder');

    // 结果
    DOM.resultsPanel   = document.getElementById('results-panel');
    DOM.resultTbody    = document.getElementById('result-tbody');
    DOM.statFixed      = document.getElementById('stat-fixed');
    DOM.statHuffman    = document.getElementById('stat-huffman');
    DOM.statCompression = document.getElementById('stat-compression');
    DOM.statAvgLen     = document.getElementById('stat-avglen');
}

// ============================================================
// 初始化
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    cacheDom();
    AppState.visualizer = new TreeVisualizer(DOM.treeSvg);

    // 绑定事件
    DOM.btnAddChar.addEventListener('click', addCharRow);
    DOM.btnExample.addEventListener('click', loadExample);
    DOM.btnRandom.addEventListener('click', randomGenerate);
    DOM.btnClear.addEventListener('click', clearInput);
    DOM.btnBuild.addEventListener('click', buildAndVisualize);

    DOM.btnPrev.addEventListener('click', prevStep);
    DOM.btnPlay.addEventListener('click', togglePlay);
    DOM.btnNext.addEventListener('click', nextStep);
    DOM.btnReset.addEventListener('click', resetPlayback);

    DOM.speedSlider.addEventListener('input', onSpeedChange);

    // 默认加载示例
    loadExample();
});

// ============================================================
// 输入管理
// ============================================================

/** 加载默认示例 */
function loadExample() {
    AppState.charFreqList = DEFAULT_EXAMPLE.map(c => ({ ...c }));
    renderCharTable();
    hideVisualization();
}

/** 随机生成字符集 */
function randomGenerate() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const count = 5 + Math.floor(Math.random() * 8);  // 5-12 个字符
    const shuffled = chars.split('').sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    AppState.charFreqList = selected.map(ch => ({
        char: ch,
        freq: 1 + Math.floor(Math.random() * 99)
    }));

    renderCharTable();
    hideVisualization();
}

/** 清空输入 */
function clearInput() {
    AppState.charFreqList = [];
    renderCharTable();
    hideVisualization();
}

/** 添加一行空字符输入 */
function addCharRow() {
    // 生成一个未使用的字符
    const usedChars = new Set(AppState.charFreqList.map(c => c.char));
    let newChar = 'A';
    for (let i = 0; i < 26; i++) {
        const ch = String.fromCharCode(65 + i);
        if (!usedChars.has(ch)) { newChar = ch; break; }
        if (i === 25) newChar = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    }
    AppState.charFreqList.push({ char: newChar, freq: 1 });
    renderCharTable();
    // 聚焦新行的频率输入框
    const rows = DOM.charTableBody.querySelectorAll('tr');
    if (rows.length > 0) {
        const freqInput = rows[rows.length - 1].querySelector('.freq-input');
        if (freqInput) freqInput.select();
    }
}

/** 删除指定行 */
function removeCharRow(index) {
    AppState.charFreqList.splice(index, 1);
    renderCharTable();
}

/** 更新字符 */
function updateChar(index, value) {
    AppState.charFreqList[index].char = value.trim().slice(0, 1) || '?';
}

/** 更新频率 */
function updateFreq(index, value) {
    const num = parseInt(value, 10);
    AppState.charFreqList[index].freq = isNaN(num) || num < 1 ? 1 : num;
}

/** 渲染字符频率表格 */
function renderCharTable() {
    DOM.charTableBody.innerHTML = '';

    AppState.charFreqList.forEach((item, idx) => {
        const tr = document.createElement('tr');

        // 序号
        const tdIdx = document.createElement('td');
        tdIdx.textContent = idx + 1;
        tdIdx.className = 'row-index';
        tr.appendChild(tdIdx);

        // 字符输入
        const tdChar = document.createElement('td');
        const charInput = document.createElement('input');
        charInput.type = 'text';
        charInput.className = 'char-input';
        charInput.value = item.char;
        charInput.maxLength = 1;
        charInput.addEventListener('input', () => updateChar(idx, charInput.value));
        tdChar.appendChild(charInput);
        tr.appendChild(tdChar);

        // 频率输入
        const tdFreq = document.createElement('td');
        const freqInput = document.createElement('input');
        freqInput.type = 'number';
        freqInput.className = 'freq-input';
        freqInput.value = item.freq;
        freqInput.min = 1;
        freqInput.max = 9999;
        freqInput.addEventListener('input', () => updateFreq(idx, freqInput.value));
        tdFreq.appendChild(freqInput);
        tr.appendChild(tdFreq);

        // 删除按钮
        const tdDel = document.createElement('td');
        const delBtn = document.createElement('button');
        delBtn.className = 'btn-del';
        delBtn.textContent = '✕';
        delBtn.title = '删除';
        delBtn.addEventListener('click', () => removeCharRow(idx));
        tdDel.appendChild(delBtn);
        tr.appendChild(tdDel);

        DOM.charTableBody.appendChild(tr);
    });
}

// ============================================================
// 构建与可视化
// ============================================================

/** 点击"开始构建" */
function buildAndVisualize() {
    // 从表格同步最新输入
    syncFromTable();

    if (AppState.charFreqList.length < 2) {
        showToast('请至少输入 2 个字符！');
        return;
    }

    // 检查重复字符
    const chars = AppState.charFreqList.map(c => c.char);
    const unique = new Set(chars);
    if (unique.size !== chars.length) {
        showToast('存在重复字符，请修改后重试！');
        return;
    }

    // 停止之前的播放
    stopPlay();

    // 构建哈夫曼树
    try {
        const result = buildHuffmanTree(AppState.charFreqList);
        AppState.steps = result.steps;
        AppState.codes = result.codes;
        AppState.currentStep = 0;
    } catch (e) {
        showToast('构建失败：' + e.message);
        return;
    }

    // 显示控制面板
    DOM.controlPanel.style.display = '';
    DOM.placeholder.style.display = 'none';

    // 更新步骤信息
    updateStepInfo();
    renderCurrentStep();

    showToast('哈夫曼树构建完成，共 ' + (AppState.steps.length - 1) + ' 步合并');
}

/** 从表格 DOM 同步数据到 AppState（处理用户直接编辑的情况） */
function syncFromTable() {
    const rows = DOM.charTableBody.querySelectorAll('tr');
    rows.forEach((row, idx) => {
        if (idx < AppState.charFreqList.length) {
            const charInput = row.querySelector('.char-input');
            const freqInput = row.querySelector('.freq-input');
            if (charInput) AppState.charFreqList[idx].char = charInput.value.trim().slice(0, 1) || '?';
            if (freqInput) {
                const num = parseInt(freqInput.value, 10);
                AppState.charFreqList[idx].freq = isNaN(num) || num < 1 ? 1 : num;
            }
        }
    });
}

/** 隐藏可视化结果 */
function hideVisualization() {
    stopPlay();
    DOM.controlPanel.style.display = 'none';
    DOM.resultsPanel.style.display = 'none';
    DOM.placeholder.style.display = '';
    AppState.visualizer.clear();
}

// ============================================================
// 播放控制
// ============================================================

/** 更新步骤信息显示 */
function updateStepInfo() {
    DOM.stepCurrent.textContent = AppState.currentStep + 1;
    DOM.stepTotal.textContent   = AppState.steps.length;
    DOM.btnPrev.disabled = AppState.currentStep <= 0;
    DOM.btnNext.disabled = AppState.currentStep >= AppState.steps.length - 1;
}

/** 渲染当前步骤 */
function renderCurrentStep() {
    const step = AppState.steps[AppState.currentStep];
    AppState.visualizer.renderStep(step);

    // 更新步骤描述
    DOM.stepDesc.textContent = step.description;

    // 如果是最后一步，显示结果
    if (step.type === 'complete') {
        showResults();
    } else {
        DOM.resultsPanel.style.display = 'none';
    }

    updateStepInfo();
}

/** 上一步 */
function prevStep() {
    if (AppState.currentStep > 0) {
        AppState.currentStep--;
        renderCurrentStep();
    }
}

/** 下一步 */
function nextStep() {
    if (AppState.currentStep < AppState.steps.length - 1) {
        AppState.currentStep++;
        renderCurrentStep();
    } else {
        // 到达最后一步，停止播放
        stopPlay();
    }
}

/** 播放 / 暂停 切换 */
function togglePlay() {
    if (AppState.isPlaying) {
        stopPlay();
    } else {
        startPlay();
    }
}

/** 开始自动播放 */
function startPlay() {
    if (AppState.currentStep >= AppState.steps.length - 1) {
        AppState.currentStep = 0;
        renderCurrentStep();
    }
    AppState.isPlaying = true;
    DOM.btnPlay.textContent = '⏸ 暂停';

    const interval = getInterval();
    AppState.playTimer = setInterval(() => {
        if (AppState.currentStep < AppState.steps.length - 1) {
            AppState.currentStep++;
            renderCurrentStep();
        } else {
            stopPlay();
        }
    }, interval);
}

/** 停止播放 */
function stopPlay() {
    AppState.isPlaying = false;
    DOM.btnPlay.textContent = '▶ 播放';
    if (AppState.playTimer) {
        clearInterval(AppState.playTimer);
        AppState.playTimer = null;
    }
}

/** 重置到第一步 */
function resetPlayback() {
    stopPlay();
    AppState.currentStep = 0;
    renderCurrentStep();
}

/** 速度滑块变化 */
function onSpeedChange() {
    AppState.speed = parseInt(DOM.speedSlider.value, 10);
    DOM.speedLabel.textContent = AppState.speed + 'x';

    // 如果正在播放，重新设置定时器
    if (AppState.isPlaying) {
        stopPlay();
        startPlay();
    }
}

/** 根据速度计算播放间隔（毫秒） */
function getInterval() {
    // speed 1 → 3000ms, speed 10 → 300ms
    const s = AppState.speed;
    return Math.round(3000 / s);
}

// ============================================================
// 结果显示
// ============================================================

function showResults() {
    DOM.resultsPanel.style.display = '';

    // 渲染编码表
    DOM.resultTbody.innerHTML = '';
    const sortedList = [...AppState.charFreqList]
        .map(({ char, freq }) => ({ char, freq, code: AppState.codes[char] || '' }))
        .sort((a, b) => a.code.length - b.code.length || a.char.localeCompare(b.char));

    sortedList.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="code-char">${escapeHtml(item.char)}</td>
            <td>${item.freq}</td>
            <td class="code-bits">${escapeHtml(item.code)}</td>
            <td>${item.code.length}</td>
        `;
        DOM.resultTbody.appendChild(tr);
    });

    // 渲染统计信息
    const stats = calculateStats(AppState.charFreqList, AppState.codes);
    DOM.statFixed.textContent       = stats.fixedTotalBits + ' bits';
    DOM.statHuffman.textContent     = stats.huffmanTotalBits + ' bits';
    DOM.statCompression.textContent = stats.compressionRatio + '%';
    DOM.statAvgLen.textContent      = stats.avgCodeLen + ' bits/字符';
}

/** HTML 转义 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================================
// Toast 提示
// ============================================================
function showToast(message) {
    // 移除旧的 toast
    document.querySelectorAll('.toast').forEach(el => el.remove());

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // 触发动画
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}
