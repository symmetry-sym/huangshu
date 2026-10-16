// ==UserScript==
// @name         斗老板数据采集（半自动 - 手动翻页）
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  手动翻页，自动采集所有页数据，最后一键下载
// @author       You
// @match        https://apiv2.doulaoban.com/*
// @match        https://*.doulaoban.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // API 配置
    const API_BASE_URL = 'http://localhost:3000';
    
    const CURRENT_VERSION = '0.1';
    const VERSION_CHECK_URL = `${API_BASE_URL}/api/script/version`;
    const SCRIPT_UPDATE_URL = `${API_BASE_URL}/api/script/doulaoban.user.js`;

    // 存储所有采集到的订单数据
    let allOrderData = [];
    let currentPage = 0;
    let isPanelCollapsed = false;
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;
    let anchorInfo = null; // 存储达人信息
    let isLoggedIn = false; // 登录状态
    let hasNewVersion = false; // 是否有新版本
    let newVersionInfo = null; // 新版本信息
    let isAutoCollecting = false; // 是否正在自动采集
    let autoCollectInterval = null; // 自动采集定时器
    let isPageLoading = false; // 页面是否正在加载
    let lastDataCount = 0; // 上次数据条数
    let enableDataCapture = false; // 是否启用数据拦截
    let totalPagesCollected = 0; // 总共采集页数
    let collectedPages = new Set(); // 已采集的页码集合
    let needCollectFirstPage = false; // 是否需要采集第1页
    let currentDisplayPage = 0; // 当前显示的页码

    // 在页面上添加控制面板
    function createControlPanel() {
        const panel = document.createElement('div');
        panel.id = 'data-collector-panel';
        panel.innerHTML = `
            <div id="panel-content" style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                padding: 20px 24px;
                border-radius: 24px;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
                border: 1px solid #f1f5f9;
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                min-width: 300px;
                transition: all 0.3s ease;
            ">
                <div id="drag-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9; cursor: move;">
                    <div style="display: flex; align-items: center;">
                        <div style="width: 32px; height: 32px; background: #4CAF50; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 16px; margin-right: 8px; box-shadow: 0 4px 6px -1px rgba(76, 175, 80, 0.2);">J</div>
                        <div style="display: flex; flex-direction: column;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 16px; font-weight: 900; color: #1e293b; letter-spacing: -0.01em;">JOYMO</span>
                                <span style="font-size: 10px; color: #64748b; font-weight: 600; padding: 2px 6px; background: #f1f5f9; border-radius: 4px;">v${CURRENT_VERSION}</span>
                            </div>
                            <span style="font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">DATA HUB</span>
                        </div>
                    </div>
                    <button id="toggle-btn" style="
                        width: 24px;
                        height: 24px;
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: all 0.3s;
                        font-size: 14px;
                    " onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'">−</button>
                </div>
                <div id="panel-body" style="transition: all 0.3s ease;">
                    <div id="version-update" style="display: none; margin-bottom: 16px; padding: 12px; background: #f0fdf4; border-radius: 12px; border: 1px solid #86efac;">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <div style="font-size: 13px; font-weight: 700; color: #16a34a; margin-bottom: 2px;">🎉 新版本可用</div>
                                <div id="new-version-text" style="font-size: 11px; color: #15803d;"></div>
                            </div>
                            <button id="upgrade-btn" style="
                                padding: 6px 12px;
                                background: #16a34a;
                                color: white;
                                border: none;
                                border-radius: 8px;
                                font-weight: 700;
                                cursor: pointer;
                                font-size: 11px;
                                transition: all 0.3s;
                            " onmouseover="this.style.background='#15803d'" onmouseout="this.style.background='#16a34a'">升级</button>
                        </div>
                    </div>
                    <div id="login-status" style="display: none; margin-bottom: 16px; padding: 12px; background: #fef2f2; border-radius: 12px; border: 1px solid #fecaca; text-align: center;">
                        <div style="font-size: 13px; font-weight: 700; color: #dc2626; margin-bottom: 4px;">⚠️ 未登录</div>
                        <div style="font-size: 11px; color: #991b1b;">请先登录斗老板账号</div>
                    </div>
                    <div id="data-section" style="display: block;">
                    <div style="font-size: 11px; margin-bottom: 6px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                        当前页码: <span id="current-page" style="font-weight: 900; color: #2196F3;">0</span>
                    </div>
                    <div style="font-size: 11px; margin-bottom: 6px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                        已采集页数: <span id="page-count" style="font-weight: 900; color: #4CAF50;">0</span>
                    </div>
                    <div style="font-size: 11px; margin-bottom: 16px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                        数据条数: <span id="record-count" style="font-weight: 900; color: #4CAF50;">0</span>
                    </div>
                    <button id="download-btn" style="
                        width: 100%;
                        padding: 12px;
                        background: #4CAF50;
                        color: white;
                        border: none;
                        border-radius: 12px;
                        font-weight: 900;
                        cursor: pointer;
                        font-size: 13px;
                        transition: all 0.3s;
                        box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06);
                    " onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)'" 
                       onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)'">
                        🔄 同步订单数据
                    </button>
                    <button id="auto-collect-btn" style="
                        width: 100%;
                        padding: 12px;
                        background: #2196F3;
                        color: white;
                        border: none;
                        border-radius: 12px;
                        font-weight: 900;
                        cursor: pointer;
                        font-size: 13px;
                        transition: all 0.3s;
                        margin-top: 8px;
                        box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06);
                    " onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)'" 
                       onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)'">
                        ▶️ 开始采集
                    </button>
                    <button id="clear-btn" style="
                        width: 100%;
                        padding: 10px;
                        background: #f8fafc;
                        color: #64748b;
                        border: 1px solid #e2e8f0;
                        border-radius: 12px;
                        cursor: pointer;
                        font-size: 12px;
                        font-weight: 700;
                        margin-top: 8px;
                        transition: all 0.3s;
                    " onmouseover="this.style.background='#f1f5f9'" 
                       onmouseout="this.style.background='#f8fafc'">
                       🗑️ 清空数据
                    </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        // 绑定按钮
        document.getElementById('download-btn').addEventListener('click', syncOrderData);
        document.getElementById('auto-collect-btn').addEventListener('click', toggleAutoCollect);
        document.getElementById('clear-btn').addEventListener('click', clearAllData);
        document.getElementById('toggle-btn').addEventListener('click', togglePanel);
        document.getElementById('upgrade-btn').addEventListener('click', upgradeScript);
        
        // 绑定拖动事件
        const dragHeader = document.getElementById('drag-header');
        const panelContent = document.getElementById('panel-content');
        
        dragHeader.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
        
        function dragStart(e) {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            if (e.target === dragHeader || dragHeader.contains(e.target)) {
                isDragging = true;
            }
        }
        
        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                xOffset = currentX;
                yOffset = currentY;
                setTranslate(currentX, currentY, panelContent);
            }
        }
        
        function dragEnd() {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
        }
        
        function setTranslate(xPos, yPos, el) {
            el.style.transform = `translate(${xPos}px, ${yPos}px)`;
        }
    }

    // 切换面板展开/收起
    function togglePanel() {
        isPanelCollapsed = !isPanelCollapsed;
        const panelBody = document.getElementById('panel-body');
        const panelContent = document.getElementById('panel-content');
        const toggleBtn = document.getElementById('toggle-btn');
        
        if (isPanelCollapsed) {
            panelBody.style.maxHeight = '0';
            panelBody.style.opacity = '0';
            panelBody.style.overflow = 'hidden';
            panelContent.style.minWidth = 'auto';
            toggleBtn.textContent = '+';
        } else {
            panelBody.style.maxHeight = '500px';
            panelBody.style.opacity = '1';
            panelBody.style.overflow = 'visible';
            panelContent.style.minWidth = '300px';
            toggleBtn.textContent = '−';
        }
    }

    // 更新面板显示
    function updatePanel() {
        const currentPageEl = document.getElementById('current-page');
        const pageCountEl = document.getElementById('page-count');
        const recordCountEl = document.getElementById('record-count');
        if (currentPageEl) currentPageEl.textContent = currentDisplayPage;
        if (pageCountEl) pageCountEl.textContent = currentPage;
        if (recordCountEl) recordCountEl.textContent = allOrderData.length;
    }

    // 同步订单数据到后端
    function syncOrderData() {
        if (allOrderData.length === 0) {
            alert('暂无数据，请先浏览页面采集数据');
            return;
        }

        const btn = document.getElementById('download-btn');
        const originalText = btn.textContent;
        
        // 设置同步中状态
        btn.textContent = '⏳ 同步中...';
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.style.cursor = 'not-allowed';

        const apiUrl = `${API_BASE_URL}/api/sync/doulaoban/orders`;
        
        fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                orders: allOrderData,
                total: allOrderData.length,
                timestamp: new Date().getTime()
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log(`✅ 订单数据同步成功:`, data);
            alert(`同步成功！共 ${allOrderData.length} 条订单数据`);
        })
        .catch(error => {
            console.error('❌ 同步失败:', error);
            alert('同步失败，请检查控制台错误信息');
        })
        .finally(() => {
            // 恢复按钮状态
            btn.textContent = originalText;
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        });
    }

    // 模拟鼠标移动到元素
    function simulateMouseMove(element) {
        const rect = element.getBoundingClientRect();
        const randomOffsetX = (Math.random() - 0.5) * 20; // 随机偏移
        const randomOffsetY = (Math.random() - 0.5) * 20;
        const x = rect.left + rect.width / 2 + randomOffsetX;
        const y = rect.top + rect.height / 2 + randomOffsetY;
        
        const mouseMoveEvent = new MouseEvent('mousemove', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y
        });
        element.dispatchEvent(mouseMoveEvent);
        
        // 模拟鼠标悬停
        const mouseOverEvent = new MouseEvent('mouseover', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y
        });
        element.dispatchEvent(mouseOverEvent);
    }

    // 页面滚动到底部
    function scrollToBottom() {
        return new Promise((resolve) => {
            const scrollHeight = document.documentElement.scrollHeight;
            const randomScroll = Math.random() * 300 + 100; // 随机100-400px偏移
            const targetScroll = scrollHeight - randomScroll;
            
            window.scrollTo({
                top: targetScroll,
                behavior: 'smooth'
            });
            
            // 等待滚动完成
            setTimeout(resolve, Math.random() * 500 + 300); // 300-800ms
        });
    }

    // 随机停顿（模拟查看内容）
    function randomPause() {
        return new Promise((resolve) => {
            const shouldPause = Math.random() < 0.15; // 15%概率停顿
            if (shouldPause) {
                const pauseTime = Math.random() * 10000 + 3000; // 3-13秒
                console.log(`👀 模拟用户查看内容，停顿 ${(pauseTime/1000).toFixed(1)} 秒...`);
                setTimeout(resolve, pauseTime);
            } else {
                resolve();
            }
        });
    }

    // 检查是否在敏感时间段
    function checkSensitiveTime() {
        const hour = new Date().getHours();
        if (hour >= 1 && hour <= 6) {
            console.log('🌙 凌晨时段，暂停采集避免异常');
            stopAutoCollect();
            alert('当前为凌晨时段，已自动停止采集。建议白天使用。');
            return true;
        }
        return false;
    }
    // 清空数据
    function clearAllData() {
        if (confirm('确定要清空所有已采集的数据吗？')) {
            allOrderData = [];
            currentPage = 0;
            totalPagesCollected = 0;
            updatePanel();
            console.log('🗑️ 已清空所有数据');
        }
    }

    // 自动采集切换
    function toggleAutoCollect() {
        if (isAutoCollecting) {
            stopAutoCollect();
        } else {
            startAutoCollect();
        }
    }

    // 开始自动采集
    function startAutoCollect() {
        // 检查是否在敏感时间段
        if (checkSensitiveTime()) {
            return;
        }
        
        isAutoCollecting = true;
        enableDataCapture = true; // 开启数据拦截
        totalPagesCollected = 0;
        collectedPages.clear(); // 清空已采集页码
        needCollectFirstPage = false; // 重置标记
        
        const btn = document.getElementById('auto-collect-btn');
        btn.textContent = '⏸️ 停止采集';
        btn.style.background = '#f44336';
        
        console.log('🚀 开始自动采集模式');
        console.log('👉 从第2页开始采集，最后再回第1页补采');
        
        // 记录需要采集第1页
        needCollectFirstPage = true;
        
        // 直接开始翻页（从第2页开始）
        setTimeout(() => {
            clickNextPageWithWait();
        }, 1000);
    }

    // 停止自动采集
    function stopAutoCollect() {
        isAutoCollecting = false;
        enableDataCapture = false; // 关闭数据拦截
        
        if (autoCollectInterval) {
            clearInterval(autoCollectInterval);
            autoCollectInterval = null;
        }
        
        const btn = document.getElementById('auto-collect-btn');
        btn.textContent = '▶️ 开始采集';
        btn.style.background = '#2196F3';
        
        console.log('⏹️ 已停止自动采集');
    }

    // 点击并等待加载完成
    async function clickNextPageWithWait() {
        if (!isAutoCollecting) return;
        
        // 如果正在加载，等待1秒后再检查
        if (isPageLoading) {
            console.log('⏳ 页面加载中，等待...');
            setTimeout(clickNextPageWithWait, 1000);
            return;
        }
        
        // 模拟人的行为：滚动 -> 随机停顿 -> 点击
        await scrollToBottom();
        await randomPause();
        
        // 点击下一页
        const clicked = clickNextPage();
        
        if (clicked) {
            // 设置加载状态
            isPageLoading = true;
            lastDataCount = allOrderData.length;
            totalPagesCollected++;
            
            // 开始检测加载完成
            waitForDataLoad();
        }
    }

    // 等待数据加载完成
    function waitForDataLoad() {
        let checkCount = 0;
        const maxChecks = 30; // 最多检查30次（30秒）
        
        const checkInterval = setInterval(() => {
            checkCount++;
            
            // 检查是否有新数据
            const hasNewData = allOrderData.length > lastDataCount;
            
            // 检查加载指示器（常见的loading元素）
            const loadingElements = document.querySelectorAll(
                '.loading, .ant-spin, .el-loading-mask, [class*="loading"], [class*="spinner"]'
            );
            const isLoadingVisible = Array.from(loadingElements).some(el => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden';
            });
            
            if (hasNewData && !isLoadingVisible) {
                // 数据已加载且无loading显示
                clearInterval(checkInterval);
                isPageLoading = false;
                console.log(`✅ 第 ${currentPage} 页加载完成，新增 ${allOrderData.length - lastDataCount} 条数据`);
                
                // 模拟人的操作习惯，随机等待1-5秒后继续下一页
                const randomDelay = Math.floor(Math.random() * 4000) + 1000; // 1000-5000ms
                console.log(`⏳ 等待 ${(randomDelay/1000).toFixed(1)} 秒后继续...`);
                setTimeout(clickNextPageWithWait, randomDelay);
            } else if (checkCount >= maxChecks) {
                // 超时
                clearInterval(checkInterval);
                isPageLoading = false;
                console.log('⚠️ 等待超时，尝试继续...');
                
                // 超时也随机延迟
                const randomDelay = Math.floor(Math.random() * 4000) + 1000;
                setTimeout(clickNextPageWithWait, randomDelay);
            }
        }, 1000);
    }

    // 模拟点击下一页
    function clickNextPage() {
        // 尝试多种常见的分页按钮选择器
        const nextButtonSelectors = [
            // Arco Design 分页器（斗老板使用的）
            '.arco-pagination-item-next:not(.arco-pagination-item-disabled)',
            'span.arco-pagination-item-next:not(.arco-pagination-item-disabled)',
            // 箭头图标按钮（常见分页组件）
            'button[class*="next"]:not([disabled])',
            'li[class*="next"]:not([class*="disabled"]) button',
            'li[class*="next"]:not([class*="disabled"]) a',
            '.ant-pagination-next:not(.ant-pagination-disabled)',
            '.ant-pagination-next:not(.ant-pagination-disabled) button',
            '.el-pagination__next:not(.disabled)',
            // 通用箭头按钮
            'button[aria-label="Next"]',
            'button[title="下一页"]',
            'button[title="Next"]',
            // 包含右箭头图标的按钮
            'button svg[class*="arrow-right"]',
            'button svg[class*="right"]',
            'button i[class*="arrow-right"]',
            'button i[class*="right"]',
            // 分页器最后一个可点击按钮（通常是下一页）
            '.pagination button:last-of-type:not([disabled])',
            '[class*="pagination"] button:last-of-type:not([disabled])'
        ];
        
        let nextButton = null;
        
        // 优先尝试下一页箭头按钮
        for (const selector of nextButtonSelectors) {
            try {
                nextButton = document.querySelector(selector);
                if (nextButton && !nextButton.disabled && !nextButton.classList.contains('disabled') && !nextButton.classList.contains('arco-pagination-item-disabled')) {
                    // 验证是否为下一页按钮（检查是否在分页器中）
                    const isPaginationButton = nextButton.closest('.pagination, [class*="pagination"], .pager, [class*="pager"]');
                    if (isPaginationButton) {
                        break;
                    }
                }
                nextButton = null;
            } catch (e) {
                // 选择器无效，继续
            }
        }
        
        // 如果没找到箭头按钮，尝试数字分页
        if (!nextButton) {
            nextButton = findNextPageNumber();
        }
        
        if (nextButton) {
            // 模拟鼠标移动到按钮上
            simulateMouseMove(nextButton);
            
            // 等待短暂时间后点击（模拟人的反应时间）
            setTimeout(() => {
                console.log('👆 模拟点击下一页按钮');
                nextButton.click();
            }, Math.random() * 200 + 100); // 100-300ms反应时间
            
            return true;
        } else {
            console.log('⚠️ 未找到下一页按钮，可能已是最后一页');
            
            // 检查是否需要采集第1页
            if (needCollectFirstPage && !collectedPages.has(1)) {
                console.log('🔙 检测到第1页未采集，回到第1页补采...');
                goToFirstPage();
            } else {
                stopAutoCollect();
                alert('已采集完所有页面！总计 ' + allOrderData.length + ' 条数据');
            }
            return false;
        }
    }

    // 查找数字分页中的下一页
    function findNextPageNumber() {
        // 查找所有分页器
        const paginators = document.querySelectorAll('.pagination, [class*="pagination"], .pager, [class*="pager"]');
        
        for (const paginator of paginators) {
            // 查找当前激活的页码
            const activeItems = paginator.querySelectorAll(
                '.active, .arco-pagination-item-active, .ant-pagination-item-active, .el-pager .active, [class*="active"]'
            );
            
            for (const activeItem of activeItems) {
                // 获取当前页码
                const currentPage = parseInt(activeItem.textContent);
                if (isNaN(currentPage)) continue;
                
                // 查找下一页的页码元素
                const allPageItems = paginator.querySelectorAll(
                    'button, a, span[class*="pagination-item"], li[class*="page"]'
                );
                
                for (const item of allPageItems) {
                    const pageNum = parseInt(item.textContent);
                    if (pageNum === currentPage + 1) {
                        // 检查是否可点击
                        if (!item.disabled && !item.classList.contains('disabled')) {
                            console.log(`📄 找到数字分页: ${currentPage} → ${pageNum}`);
                            return item;
                        }
                    }
                }
            }
        }
        
        return null;
    }

    // 回到第1页
    function goToFirstPage() {
        console.log('🔄 寻找第1页按钮...');
        
        // 查找第1页按钮
        const paginators = document.querySelectorAll('.pagination, [class*="pagination"], .pager, [class*="pager"]');
        
        for (const paginator of paginators) {
            const allPageItems = paginator.querySelectorAll(
                'button, a, span[class*="pagination-item"], li[class*="page"]'
            );
            
            for (const item of allPageItems) {
                const pageNum = parseInt(item.textContent);
                if (pageNum === 1) {
                    if (!item.disabled && !item.classList.contains('disabled') && !item.classList.contains('active')) {
                        console.log('👆 点击第1页按钮');
                        item.click();
                        
                        // 等待第1页数据加载
                        setTimeout(() => {
                            if (collectedPages.has(1)) {
                                console.log('✅ 第1页补采完成！');
                                stopAutoCollect();
                                alert('已采集完所有页面！总计 ' + allOrderData.length + ' 条数据');
                            } else {
                                console.log('⚠️ 第1页数据未采集，结束采集');
                                stopAutoCollect();
                                alert('采集完成！总计 ' + allOrderData.length + ' 条数据\n注意：第1页可能未采集');
                            }
                        }, 3000);
                        return;
                    }
                }
            }
        }
        
        console.log('⚠️ 未找到第1页按钮，结束采集');
        stopAutoCollect();
        alert('采集完成！总计 ' + allOrderData.length + ' 条数据\n注意：第1页可能未采集');
    }

    // 拦截 XHR 请求
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        this._method = method;
        return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function() {
        this.addEventListener('load', function() {
            // 只有开启采集时才拦截数据
            if (!enableDataCapture) {
                return;
            }
            
            // 拦截订单详情接口
            if (this._url && this._url.includes('/xpin/api/v3/jingXuan/order_statistics_list')) {
                try {
                    const responseData = JSON.parse(this.responseText);
                    console.log('🎯 拦截到订单数据接口:', this._url);
                    
                    // 提取订单列表 - data.data 是数组
                    if (responseData.data && responseData.data.data && Array.isArray(responseData.data.data)) {
                        const orders = responseData.data.data;
                        allOrderData.push(...orders);
                        currentPage++;
                        
                        updatePanel();
                        
                        // 延迟获取DOM页码（等待页面渲染完成）
                        setTimeout(() => {
                            const activePage = document.querySelector('.arco-pagination-item-active');
                            if (activePage) {
                                const pageNum = parseInt(activePage.textContent.trim());
                                if (!isNaN(pageNum) && pageNum > 0) {
                                    currentDisplayPage = pageNum;
                                    collectedPages.add(pageNum);
                                    updatePanel();
                                    console.log(`✅ 第 ${currentDisplayPage} 页数据已采集，本页 ${orders.length} 条，总计 ${allOrderData.length} 条`);
                                } else {
                                    console.log('⚠️ 未获取到页码，当前激活元素:', activePage.textContent);
                                }
                            } else {
                                console.log('⚠️ 未找到激活页码元素');
                            }
                        }, 500);
                    }
                } catch (e) {
                    console.error('❌ 解析响应数据失败:', e);
                }
            }
        });
        return originalSend.apply(this, arguments);
    };

    // 更新登录状态显示
    function updateLoginStatus() {
        const loginStatusDiv = document.getElementById('login-status');
        const dataSection = document.getElementById('data-section');
        
        if (loginStatusDiv && dataSection) {
            // 斗老板默认显示数据区域，不需要达人信息验证
            loginStatusDiv.style.display = 'none';
            dataSection.style.display = 'block';
        }
    }

    // 页面加载完成后创建控制面板
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createControlPanel);
    } else {
        createControlPanel();
    }

    // 检查版本更新
    checkVersion();

    // 检查版本函数
    function checkVersion() {
        fetch(VERSION_CHECK_URL)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.version) {
                    if (compareVersion(data.version, CURRENT_VERSION) > 0) {
                        hasNewVersion = true;
                        newVersionInfo = data;
                        showVersionUpdate(data);
                        console.log(`🎉 发现新版本: ${data.version}`);
                    } else {
                        console.log(`✅ 已是最新版本: ${CURRENT_VERSION}`);
                    }
                }
            })
            .catch(error => {
                console.log('ℹ️ 版本检查失败:', error.message);
            });
    }

    // 版本号比较
    function compareVersion(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;
            if (p1 > p2) return 1;
            if (p1 < p2) return -1;
        }
        return 0;
    }

    // 显示版本更新提示
    function showVersionUpdate(versionData) {
        const updateDiv = document.getElementById('version-update');
        const versionText = document.getElementById('new-version-text');
        if (updateDiv && versionText) {
            versionText.textContent = `v${versionData.version} - ${versionData.description || '新版本可用'}`;
            updateDiv.style.display = 'block';
        }
    }

    // 升级脚本
    function upgradeScript() {
        if (!hasNewVersion) return;
        
        if (confirm(`确认升级到 v${newVersionInfo.version} 吗？

${newVersionInfo.description || ''}

点击确定后将打开新版本下载页面`)) {
            window.open(SCRIPT_UPDATE_URL, '_blank');
            alert('请在新打开的页面中点击 Tampermonkey 的安装提示来更新脚本。');
        }
    }

    console.log('✅ 斗老板数据采集器已启动');
    console.log('📌 使用说明：');
    console.log('   1. 点击"▶️ 开始采集"开始自动翻页采集');
    console.log('   2. 或手动翻页，脚本会自动拦截数据');
    console.log('   3. 右上角查看采集进度');
    console.log('   4. 采集完成后，点击"🔄 同步订单数据"按钮');
})();
