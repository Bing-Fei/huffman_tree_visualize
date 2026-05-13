/**
 * visualizer.js — 哈夫曼树 SVG 可视化引擎
 *
 * 模块职责：
 *   1. TreeVisualizer 类 — 管理整个 SVG 画布
 *   2. 森林布局算法 — 将多棵树水平排列
 *   3. 单树布局算法 — 叶子从左到右排列，父节点居中于子节点之上
 *   4. SVG 节点/边绘制 — 叶子用圆角矩形，内部节点用圆形
 *   5. 高亮与动画 — 新建/被合并的节点特殊着色
 */

class TreeVisualizer {

    /**
     * @param {SVGElement} svgEl — 页面中的 <svg> 元素
     */
    constructor(svgEl) {
        this.svg = svgEl;

        // 布局参数
        this.LEAF_SPACING   = 76;   // 相邻叶子之间的水平间距
        this.LEVEL_HEIGHT   = 110;  // 相邻层级之间的垂直间距
        this.FOREST_GAP     = 40;   // 森林中相邻树之间的间距
        this.PADDING        = 60;   // 画布边距
        this.NODE_R         = 22;   // 内部节点半径
        this.LEAF_W         = 52;   // 叶子节点宽度
        this.LEAF_H         = 46;   // 叶子节点高度

        this._initDefs();
        this._initGroups();
    }

    // ---- SVG 初始化 ----

    /** 创建渐变、滤镜等 <defs> */
    _initDefs() {
        const ns = 'http://www.w3.org/2000/svg';

        // 如果已经有 defs，不重复创建
        if (this.svg.querySelector('defs')) return;

        const defs = document.createElementNS(ns, 'defs');
        defs.innerHTML = `
            <!-- 阴影滤镜 -->
            <filter id="vz-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.12"/>
            </filter>
            <!-- 高亮发光滤镜 -->
            <filter id="vz-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="5" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <!-- 叶子节点渐变 -->
            <linearGradient id="vz-leaf-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#667eea"/>
                <stop offset="100%" stop-color="#764ba2"/>
            </linearGradient>
            <!-- 内部节点渐变 -->
            <linearGradient id="vz-internal-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#38b2ac"/>
                <stop offset="100%" stop-color="#4fd1c5"/>
            </linearGradient>
            <!-- 高亮节点渐变 -->
            <linearGradient id="vz-highlight-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#f6ad55"/>
                <stop offset="100%" stop-color="#ed8936"/>
            </linearGradient>
            <!-- 新建节点渐变 -->
            <linearGradient id="vz-new-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#fc8181"/>
                <stop offset="100%" stop-color="#f56565"/>
            </linearGradient>
        `;
        this.svg.appendChild(defs);
    }

    /** 创建绘制分组 */
    _initGroups() {
        const ns = 'http://www.w3.org/2000/svg';
        // 移除旧分组（如果存在）
        this.svg.querySelectorAll('.vz-edges, .vz-nodes').forEach(el => el.remove());

        this.edgesGroup = document.createElementNS(ns, 'g');
        this.edgesGroup.setAttribute('class', 'vz-edges');
        this.svg.appendChild(this.edgesGroup);

        this.nodesGroup = document.createElementNS(ns, 'g');
        this.nodesGroup.setAttribute('class', 'vz-nodes');
        this.svg.appendChild(this.nodesGroup);
    }

    // ---- 布局算法 ----

    /**
     * 布局森林（多棵树水平排列）
     * @param {HuffmanNode[]} forest — 森林根节点数组
     * @returns {Object.<number, {x:number, y:number}>} nodeId → position
     */
    _layoutForest(forest) {
        const positions = {};
        let offsetX = 0;

        for (const root of forest) {
            const treePos   = this._layoutTree(root);
            const treeWidth = this._treeWidth(treePos);

            for (const [id, pos] of Object.entries(treePos)) {
                positions[id] = { x: pos.x + offsetX, y: pos.y };
            }
            offsetX += treeWidth + this.FOREST_GAP;
        }
        return positions;
    }

    /**
     * 布局单棵树（叶子从左到右，父节点居中）
     */
    _layoutTree(root) {
        const positions = {};
        let leafIdx = 0;

        const walk = (node, depth) => {
            if (!node) return;
            if (node.isLeaf) {
                positions[node.id] = {
                    x: leafIdx * this.LEAF_SPACING,
                    y: depth * this.LEVEL_HEIGHT
                };
                leafIdx++;
            } else {
                walk(node.left,  depth + 1);
                walk(node.right, depth + 1);
                const lp = positions[node.left.id];
                const rp = positions[node.right.id];
                positions[node.id] = {
                    x: (lp.x + rp.x) / 2,
                    y: depth * this.LEVEL_HEIGHT
                };
            }
        };

        walk(root, 0);
        return positions;
    }

    /** 计算一棵树的最大 x + 一个叶子宽度 */
    _treeWidth(positions) {
        let maxX = 0;
        for (const p of Object.values(positions)) {
            if (p.x > maxX) maxX = p.x;
        }
        return maxX + this.LEAF_SPACING;
    }

    /** 获取所有位置的边界框 */
    _bounds(positions) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of Object.values(positions)) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        }
        return { minX, minY, maxX, maxY };
    }

    // ---- 绘制 ----

    /**
     * 渲染指定步骤
     * @param {Object} step — buildHuffmanTree 返回的 steps[i]
     */
    renderStep(step) {
        const { forest, highlightIds = [], newNodeId } = step;

        // 清空旧内容
        this.edgesGroup.innerHTML = '';
        this.nodesGroup.innerHTML = '';

        if (!forest || forest.length === 0) {
            this.svg.setAttribute('viewBox', '0 0 800 500');
            return;
        }

        // 计算布局
        const positions = this._layoutForest(forest);

        // 设置 viewBox
        const b = this._bounds(positions);
        const vbX = b.minX - this.PADDING;
        const vbY = b.minY - this.PADDING;
        const vbW = (b.maxX - b.minX) + this.PADDING * 2;
        const vbH = (b.maxY - b.minY) + this.PADDING * 2;
        this.svg.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);

        // 收集所有节点
        const allNodes = [];
        const visited = new Set();
        for (const root of forest) {
            this._collectNodes(root, allNodes, visited);
        }

        // 绘制边
        for (const node of allNodes) {
            const np = positions[node.id];
            if (!np) continue;

            if (node.left) {
                const cp = positions[node.left.id];
                if (cp) this._drawEdge(np, cp, '0', highlightIds.includes(node.left.id));
            }
            if (node.right) {
                const cp = positions[node.right.id];
                if (cp) this._drawEdge(np, cp, '1', highlightIds.includes(node.right.id));
            }
        }

        // 绘制节点
        for (const node of allNodes) {
            const p = positions[node.id];
            if (!p) continue;

            const isNew        = node.id === newNodeId;
            const isHighlighted = highlightIds.includes(node.id);

            this._drawNode(node, p.x, p.y, isNew, isHighlighted);
        }
    }

    /** 递归收集所有节点 */
    _collectNodes(node, arr, visited) {
        if (!node || visited.has(node.id)) return;
        visited.add(node.id);
        arr.push(node);
        this._collectNodes(node.left, arr, visited);
        this._collectNodes(node.right, arr, visited);
    }

    /**
     * 绘制一条边（父 → 子）
     */
    _drawEdge(from, to, label, highlight) {
        const ns = 'http://www.w3.org/2000/svg';

        // 计算起止点（从节点边缘开始）
        const nodeR = this.NODE_R;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / dist;
        const uy = dy / dist;

        const x1 = from.x + ux * nodeR;
        const y1 = from.y + uy * nodeR;
        const x2 = to.x   - ux * nodeR;
        const y2 = to.y   - uy * nodeR;

        // 边线
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', highlight ? '#ed8936' : '#a0aec0');
        line.setAttribute('stroke-width', highlight ? '3' : '2');
        line.setAttribute('stroke-linecap', 'round');
        this.edgesGroup.appendChild(line);

        // 边标签（0 或 1），放在靠近父节点的位置
        const labelX = from.x + ux * (nodeR + 16) + (label === '0' ? -8 : 8);
        const labelY = from.y + uy * (nodeR + 16) + 4;

        const text = document.createElementNS(ns, 'text');
        text.setAttribute('x', labelX);
        text.setAttribute('y', labelY);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', highlight ? '#ed8936' : '#718096');
        text.setAttribute('font-size', '13');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('font-family', 'monospace');
        text.textContent = label;
        this.edgesGroup.appendChild(text);
    }

    /**
     * 绘制一个节点
     */
    _drawNode(node, x, y, isNew, isHighlighted) {
        const ns = 'http://www.w3.org/2000/svg';
        const g  = document.createElementNS(ns, 'g');
        g.setAttribute('transform', `translate(${x}, ${y})`);

        // 滤镜
        if (isNew || isHighlighted) {
            g.setAttribute('filter', 'url(#vz-glow)');
        } else {
            g.setAttribute('filter', 'url(#vz-shadow)');
        }

        // 动画类
        if (isNew) {
            g.setAttribute('class', 'vz-node-new');
        } else if (isHighlighted) {
            g.setAttribute('class', 'vz-node-hl');
        }

        if (node.isLeaf) {
            // ---- 叶子节点：圆角矩形 ----
            const w = this.LEAF_W, h = this.LEAF_H, r = 10;

            const rect = document.createElementNS(ns, 'rect');
            rect.setAttribute('x', -w / 2);
            rect.setAttribute('y', -h / 2);
            rect.setAttribute('width', w);
            rect.setAttribute('height', h);
            rect.setAttribute('rx', r);
            rect.setAttribute('fill',
                isNew || isHighlighted ? 'url(#vz-highlight-grad)' : 'url(#vz-leaf-grad)');
            rect.setAttribute('stroke', 'rgba(255,255,255,0.3)');
            rect.setAttribute('stroke-width', '1');
            g.appendChild(rect);

            // 字符
            const ct = document.createElementNS(ns, 'text');
            ct.setAttribute('y', -5);
            ct.setAttribute('text-anchor', 'middle');
            ct.setAttribute('fill', 'white');
            ct.setAttribute('font-size', '17');
            ct.setAttribute('font-weight', 'bold');
            ct.setAttribute('font-family', 'sans-serif');
            ct.textContent = node.char;
            g.appendChild(ct);

            // 频率
            const ft = document.createElementNS(ns, 'text');
            ft.setAttribute('y', 15);
            ft.setAttribute('text-anchor', 'middle');
            ft.setAttribute('fill', 'rgba(255,255,255,0.85)');
            ft.setAttribute('font-size', '11');
            ft.setAttribute('font-family', 'sans-serif');
            ft.textContent = node.freq;
            g.appendChild(ft);

        } else {
            // ---- 内部节点：圆形 ----
            const circle = document.createElementNS(ns, 'circle');
            circle.setAttribute('r', this.NODE_R);
            circle.setAttribute('fill',
                isNew ? 'url(#vz-new-grad)' :
                isHighlighted ? 'url(#vz-highlight-grad)' :
                'url(#vz-internal-grad)');
            circle.setAttribute('stroke', 'rgba(255,255,255,0.3)');
            circle.setAttribute('stroke-width', '1');
            g.appendChild(circle);

            // 频率
            const ft = document.createElementNS(ns, 'text');
            ft.setAttribute('y', 5);
            ft.setAttribute('text-anchor', 'middle');
            ft.setAttribute('fill', 'white');
            ft.setAttribute('font-size', '14');
            ft.setAttribute('font-weight', 'bold');
            ft.setAttribute('font-family', 'sans-serif');
            ft.textContent = node.freq;
            g.appendChild(ft);
        }

        this.nodesGroup.appendChild(g);
    }

    /** 清空画布 */
    clear() {
        if (this.edgesGroup) this.edgesGroup.innerHTML = '';
        if (this.nodesGroup) this.nodesGroup.innerHTML = '';
        this.svg.setAttribute('viewBox', '0 0 800 500');
    }
}
