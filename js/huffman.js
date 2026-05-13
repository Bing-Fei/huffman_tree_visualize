/**
 * huffman.js — 哈夫曼树核心算法
 * 
 * 模块职责：
 *   1. HuffmanNode：哈夫曼节点数据结构
 *   2. MinHeap：最小堆优先队列
 *   3. buildHuffmanTree：构建哈夫曼树并逐步记录
 *   4. generateCodes：生成哈夫曼编码
 *   5. calculateStats：计算编码方案统计信息
 */

// ============================================================
// HuffmanNode — 哈夫曼树节点
// ============================================================
class HuffmanNode {
    static _nextId = 0;

    constructor(char, freq, left = null, right = null) {
        this.char  = char;    // 字符（内部节点为 null）
        this.freq  = freq;    // 频率 / 权重
        this.left  = left;    // 左子节点
        this.right = right;   // 右子节点
        this.id    = HuffmanNode._nextId++;
        this.code  = '';      // 从根到该节点的编码前缀
    }

    /** 是否为叶子节点 */
    get isLeaf() {
        return this.left === null && this.right === null;
    }

    /** 获取以该节点为根的所有叶子字符拼接 */
    get leafChars() {
        if (this.isLeaf) return this.char;
        return (this.left  ? this.left.leafChars  : '') +
               (this.right ? this.right.leafChars : '');
    }

    /** 短标签（最多显示 4 个字符） */
    get shortLabel() {
        if (this.isLeaf) return this.char;
        const s = this.leafChars;
        return s.length <= 4 ? s : s.slice(0, 3) + '…';
    }

    static resetId() {
        HuffmanNode._nextId = 0;
    }
}

// ============================================================
// MinHeap — 最小堆（优先队列），按 freq 升序
// ============================================================
class MinHeap {
    constructor() {
        this.data = [];
    }

    get size() {
        return this.data.length;
    }

    peek() {
        return this.data[0] || null;
    }

    push(node) {
        this.data.push(node);
        this._up(this.data.length - 1);
    }

    pop() {
        if (this.data.length === 0) return null;
        const top  = this.data[0];
        const last = this.data.pop();
        if (this.data.length > 0) {
            this.data[0] = last;
            this._down(0);
        }
        return top;
    }

    /** 返回堆内元素的浅拷贝数组（按堆序排列） */
    toArray() {
        return [...this.data];
    }

    // --- 内部方法 ---
    _up(i) {
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.data[i].freq < this.data[p].freq) {
                [this.data[i], this.data[p]] = [this.data[p], this.data[i]];
                i = p;
            } else {
                break;
            }
        }
    }

    _down(i) {
        const n = this.data.length;
        while (true) {
            let s = i;
            const l = 2 * i + 1;
            const r = 2 * i + 2;
            if (l < n && this.data[l].freq < this.data[s].freq) s = l;
            if (r < n && this.data[r].freq < this.data[s].freq) s = r;
            if (s !== i) {
                [this.data[i], this.data[s]] = [this.data[s], this.data[i]];
                i = s;
            } else {
                break;
            }
        }
    }
}

// ============================================================
// getNodeLabel — 节点的人类可读标签
// ============================================================
function getNodeLabel(node) {
    if (node.isLeaf) return `"${node.char}"`;
    return `[${node.shortLabel}]`;
}

// ============================================================
// buildHuffmanTree — 构建哈夫曼树并记录每一步
//
// 参数：charFreqList = [{ char: 'A', freq: 5 }, ...]
// 返回：{ root, steps, codes }
//
// steps 数组中每个元素的字段：
//   type          — 'init' | 'merge' | 'complete'
//   description   — 当前步骤的中文描述
//   forest        — 当前森林（堆中剩余的根节点引用数组）
//   highlightIds  — 需要高亮的节点 id 数组
//   newNodeId     — 本步新创建的节点 id（仅 merge 步骤）
//   mergeDetail   — { leftId, rightId, parentId }（仅 merge 步骤）
//   codes         — 最终编码表（仅 complete 步骤）
// ============================================================
function buildHuffmanTree(charFreqList) {
    HuffmanNode.resetId();

    if (charFreqList.length === 0) {
        throw new Error('字符集不能为空');
    }

    const steps = [];

    // — 单字符特殊处理 —
    if (charFreqList.length === 1) {
        const node = new HuffmanNode(charFreqList[0].char, charFreqList[0].freq);
        const codes = { [charFreqList[0].char]: '0' };
        steps.push({
            type: 'complete',
            description: '只有一个字符，编码为 "0"。',
            forest: [node],
            highlightIds: [],
            newNodeId: null,
            codes
        });
        return { root: node, steps, codes };
    }

    // — 创建叶子节点 —
    const leafNodes = charFreqList
        .map(({ char, freq }) => new HuffmanNode(char, freq))
        .sort((a, b) => a.freq - b.freq || (a.char || '').localeCompare(b.char || ''));

    // — 初始化优先队列 —
    const heap = new MinHeap();
    leafNodes.forEach(n => heap.push(n));

    // — 步骤 0：初始化 —
    steps.push({
        type: 'init',
        description: `初始化优先队列，共 ${leafNodes.length} 个叶子节点：\n` +
            leafNodes.map(n => `${getNodeLabel(n)} 频率:${n.freq}`).join('、'),
        forest: heap.toArray(),
        highlightIds: [],
        newNodeId: null
    });

    // — 逐步合并 —
    while (heap.size > 1) {
        const left   = heap.pop();
        const right  = heap.pop();
        const parent = new HuffmanNode(null, left.freq + right.freq, left, right);
        heap.push(parent);

        const desc = [
            `步骤 ${steps.length}：`,
            `取出两个最小频率节点：`,
            `  左 → ${getNodeLabel(left)}（频率: ${left.freq}），编码前缀 "0"`,
            `  右 → ${getNodeLabel(right)}（频率: ${right.freq}），编码前缀 "1"`,
            `合并为新节点（频率: ${parent.freq}），放回队列。`,
        ].join('\n');

        steps.push({
            type: 'merge',
            description: desc,
            forest: heap.toArray(),
            highlightIds: [left.id, right.id],
            newNodeId: parent.id,
            mergeDetail: { leftId: left.id, rightId: right.id, parentId: parent.id }
        });
    }

    // — 构建完成 —
    const root  = heap.pop();
    const codes = generateCodes(root);

    steps.push({
        type: 'complete',
        description: `哈夫曼树构建完成！共 ${charFreqList.length} 个字符，经历 ${steps.length - 1} 次合并。\n左路径编码 "0"，右路径编码 "1"，从根到叶即为各字符的哈夫曼编码。`,
        forest: [root],
        highlightIds: [],
        newNodeId: null,
        codes
    });

    return { root, steps, codes };
}

// ============================================================
// generateCodes — 递归生成哈夫曼编码
// ============================================================
function generateCodes(root) {
    const codes = {};

    function traverse(node, prefix) {
        if (!node) return;
        if (node.isLeaf) {
            codes[node.char] = prefix || '0';
            node.code = prefix || '0';
            return;
        }
        traverse(node.left,  prefix + '0');
        traverse(node.right, prefix + '1');
    }

    traverse(root, '');
    return codes;
}

// ============================================================
// calculateStats — 计算编码方案统计信息
// ============================================================
function calculateStats(charFreqList, codes) {
    const totalFreq  = charFreqList.reduce((s, { freq }) => s + freq, 0);
    const n          = charFreqList.length;
    const fixedLen   = n === 1 ? 1 : Math.ceil(Math.log2(n));
    const fixedBits  = fixedLen * totalFreq;

    let huffmanBits = 0;
    charFreqList.forEach(({ char, freq }) => {
        huffmanBits += (codes[char] || '').length * freq;
    });

    return {
        totalFreq,
        charCount: n,
        fixedCodeLen: fixedLen,
        fixedTotalBits: fixedBits,
        huffmanTotalBits: huffmanBits,
        compressionRatio: fixedBits > 0
            ? ((1 - huffmanBits / fixedBits) * 100).toFixed(1)
            : '0.0',
        avgCodeLen: totalFreq > 0
            ? (huffmanBits / totalFreq).toFixed(2)
            : '0.00',
        savedBits: fixedBits - huffmanBits
    };
}
