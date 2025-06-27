// ==UserScript==
// @name         智能确认完成+自动切换
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  检查评价状态，自动确认完成并切换到下一个学生
// @author       You
// @match        https://task.yungu.org/umiTask*
// @include      https://task.yungu.org/umiTask#/taskDetail/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 配置与选择器
    const CONFIG = {
        selectors: {
            levelName: '.levelNameStyle___14HFP',
            confirmButton: 'span[data-type="确认完成"]',
            studentCard: '.cardStyle___1DJm8'
        },
        keywords: ['精熟', '超越', '生长', '萌芽'],
        colors: {
            primary: '#4CAF50',
            success: '#2196F3',
            warning: '#FF9800',
            error: '#f44336'
        },
        timeout: 5000
    };

    // 工具函数
    const Utils = {
        adjustColor: (color, percent) => {
            const num = parseInt(color.replace("#", ""), 16);
            const r = Math.max(0, Math.min(255, (num >> 16) + percent));
            const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + percent));
            const b = Math.max(0, Math.min(255, (num & 0x0000FF) + percent));
            return "#" + (((1 << 24) + (r << 16) + (g << 8) + b) | 0).toString(16).slice(1);
        },

        wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

        waitForElement: (selector, timeout = CONFIG.timeout) => {
            return new Promise((resolve, reject) => {
                const element = document.querySelector(selector);
                if (element) return resolve(element);

                const timeoutId = setTimeout(() => {
                    observer.disconnect();
                    reject(new Error(`等待元素超时: ${selector}`));
                }, timeout);

                const observer = new MutationObserver(() => {
                    const el = document.querySelector(selector);
                    if (el) {
                        observer.disconnect();
                        clearTimeout(timeoutId);
                        resolve(el);
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });
            });
        },

        hasValidContent: (element) => {
            if (!element || !element.textContent) return false;
            const content = element.textContent.trim();
            return CONFIG.keywords.some(keyword => content.includes(keyword));
        },

        getStoredPosition: () => {
            const stored = localStorage.getItem('confirmButtonPosition');
            if (stored) {
                try {
                    return JSON.parse(stored);
                } catch (e) {
                    return { right: '20px', bottom: '20px' };
                }
            }
            return { right: '20px', bottom: '20px' };
        },

        savePosition: (position) => {
            localStorage.setItem('confirmButtonPosition', JSON.stringify(position));
        }
    };

    // UI组件
    const UI = {
        createDraggableButton: (text, color) => {
            const btn = document.createElement('button');
            const position = Utils.getStoredPosition();
            
            // 强制使用固定位置，避免位置保存问题
            Object.assign(btn.style, {
                position: 'fixed',
                right: '20px',
                bottom: '20px',
                zIndex: '99999',
                padding: '12px 20px',
                backgroundColor: color,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'move',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                fontSize: '14px',
                fontWeight: 'bold',
                userSelect: 'none',
                transition: 'all 0.2s ease',
                display: 'block',
                visibility: 'visible',
                opacity: '1'
            });
            btn.textContent = text;
            btn.id = 'smart-confirm-btn';
            
            console.log('[智能确认完成] 按钮已创建，样式:', btn.style.cssText);

            // 悬停效果
            btn.onmouseover = () => {
                btn.style.backgroundColor = Utils.adjustColor(color, -10);
                btn.style.transform = 'scale(1.05)';
            };
            btn.onmouseout = () => {
                btn.style.backgroundColor = color;
                btn.style.transform = 'scale(1)';
            };

            // 拖拽功能
            UI.makeDraggable(btn);
            
            return btn;
        },

        makeDraggable: (element) => {
            let isDragging = false;
            let dragOffset = { x: 0, y: 0 };
            let clickTime = 0;

            element.addEventListener('mousedown', (e) => {
                clickTime = Date.now();
                isDragging = true;
                
                const rect = element.getBoundingClientRect();
                dragOffset.x = e.clientX - rect.left;
                dragOffset.y = e.clientY - rect.top;
                
                element.style.cursor = 'grabbing';
                element.style.transition = 'none';
                
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                
                const x = e.clientX - dragOffset.x;
                const y = e.clientY - dragOffset.y;
                
                // 计算相对于窗口的位置
                const maxX = window.innerWidth - element.offsetWidth;
                const maxY = window.innerHeight - element.offsetHeight;
                
                const clampedX = Math.max(0, Math.min(x, maxX));
                const clampedY = Math.max(0, Math.min(y, maxY));
                
                // 设置 left 和 top，移除 right 和 bottom
                element.style.left = clampedX + 'px';
                element.style.top = clampedY + 'px';
                element.style.right = 'auto';
                element.style.bottom = 'auto';
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    element.style.cursor = 'move';
                    element.style.transition = 'all 0.2s ease';
                    
                    // 保存位置
                    const rect = element.getBoundingClientRect();
                    const position = {
                        left: rect.left + 'px',
                        top: rect.top + 'px'
                    };
                    Utils.savePosition(position);
                    
                    // 如果拖拽时间很短，视为点击
                    const dragDuration = Date.now() - clickTime;
                    if (dragDuration < 200) {
                        // 触发点击事件（延迟一点，避免和拖拽冲突）
                        setTimeout(() => {
                            if (element.onclick) element.onclick();
                        }, 10);
                    }
                }
            });
        },

        createNotification: (message, type = 'info') => {
            const notification = document.createElement('div');
            const colors = {
                info: CONFIG.colors.primary,
                success: CONFIG.colors.success,
                warning: CONFIG.colors.warning,
                error: CONFIG.colors.error
            };
            
            Object.assign(notification.style, {
                position: 'fixed',
                top: '20px',
                right: '20px',
                padding: '12px 20px',
                backgroundColor: colors[type] || colors.info,
                color: 'white',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                zIndex: '10000',
                fontSize: '14px',
                maxWidth: '300px',
                opacity: '0',
                transform: 'translateX(100%)',
                transition: 'all 0.3s ease'
            });
            
            notification.textContent = message;
            document.body.appendChild(notification);
            
            // 动画显示
            setTimeout(() => {
                notification.style.opacity = '1';
                notification.style.transform = 'translateX(0)';
            }, 10);
            
            // 自动消失
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 3000);
        },

        log: (msg, type = 'info') => {
            console.log(`[智能确认完成] ${msg}`);
            UI.createNotification(msg, type);
        }
    };

    // 处理器
    const Processor = {
        checkEvaluationStatus: () => {
            const levelElements = document.querySelectorAll(CONFIG.selectors.levelName);
            UI.log(`找到 ${levelElements.length} 个评价元素`);
            
            if (levelElements.length === 0) {
                UI.log('未找到任何评价元素', 'warning');
                return false;
            }
            
            let hasValidContent = false;
            const statusList = [];
            
            levelElements.forEach((element, index) => {
                const content = element.textContent.trim();
                statusList.push(`元素${index + 1}: "${content}"`);
                
                if (Utils.hasValidContent(element)) {
                    hasValidContent = true;
                }
            });
            
            console.log('评价状态详情:', statusList);
            
            if (hasValidContent) {
                UI.log('检测到有效的评价内容', 'success');
                return true;
            } else {
                UI.log('未发现有效的评价内容（精熟、超越、生长、萌芽）', 'warning');
                return false;
            }
        },
        
        clickConfirmButton: async () => {
            try {
                const confirmButton = await Utils.waitForElement(CONFIG.selectors.confirmButton);
                
                if (confirmButton) {
                    UI.log('找到确认完成按钮，正在点击...', 'info');
                    confirmButton.click();
                    UI.log('✅ 确认完成操作执行成功！', 'success');
                    return true;
                } else {
                    UI.log('未找到确认完成按钮', 'error');
                    return false;
                }
            } catch (error) {
                UI.log(`点击确认完成按钮时发生错误: ${error.message}`, 'error');
                return false;
            }
        },

        switchToNextStudent: async () => {
            try {
                // 等待一小段时间，确保确认完成操作完成
                await Utils.wait(800);
                
                const studentCards = document.querySelectorAll(CONFIG.selectors.studentCard);
                UI.log(`找到 ${studentCards.length} 个学生卡片`);
                
                if (studentCards.length > 0) {
                    UI.log('正在切换到下一个学生...', 'info');
                    studentCards[0].click();
                    UI.log('✅ 已切换到下一个学生', 'success');
                    return true;
                } else {
                    UI.log('未找到学生卡片，无法切换', 'warning');
                    return false;
                }
            } catch (error) {
                UI.log(`切换学生时发生错误: ${error.message}`, 'error');
                return false;
            }
        },
        
        executeConfirmProcess: async () => {
            UI.log('开始检查评价状态...', 'info');
            
            try {
                // 检查评价状态
                const hasValidEvaluation = Processor.checkEvaluationStatus();
                
                if (hasValidEvaluation) {
                    UI.log('评价状态检查通过，准备确认完成...', 'success');
                    
                    // 等待一小段时间，确保页面状态稳定
                    await Utils.wait(500);
                    
                    // 执行确认完成操作
                    const confirmSuccess = await Processor.clickConfirmButton();
                    
                    if (confirmSuccess) {
                        UI.log('🎉 确认完成操作成功，准备切换到下一个学生...', 'success');
                        
                        // 自动切换到下一个学生
                        const switchSuccess = await Processor.switchToNextStudent();
                        
                        if (switchSuccess) {
                            UI.log('🚀 全部操作完成！已自动切换到下一个学生', 'success');
                        } else {
                            UI.log('确认完成成功，但切换学生失败', 'warning');
                        }
                    } else {
                        UI.log('确认完成操作失败', 'error');
                    }
                } else {
                    UI.log('❌ 评价状态检查未通过，无法执行确认完成操作', 'warning');
                }
            } catch (error) {
                UI.log(`执行过程中发生错误: ${error.message}`, 'error');
            }
        }
    };

    // 主控制器
    const Controller = {
        init: () => {
            console.log('[智能确认完成] 开始初始化...');
            
            // 创建可拖拽的确认完成按钮
            const confirmBtn = UI.createDraggableButton('确认完成', CONFIG.colors.primary);
            
            // 绑定点击事件
            confirmBtn.onclick = () => {
                Processor.executeConfirmProcess();
            };
            
            // 添加到页面
            document.body.appendChild(confirmBtn);
            console.log('[智能确认完成] 按钮已添加到页面，元素:', confirmBtn);
            console.log('[智能确认完成] 页面中的按钮:', document.getElementById('smart-confirm-btn'));
            
            UI.log('智能确认完成脚本已启动', 'info');
            
            // 延迟检查按钮是否真的在页面上
            setTimeout(() => {
                const btn = document.getElementById('smart-confirm-btn');
                if (btn) {
                    console.log('[智能确认完成] ✅ 按钮确认存在于页面中');
                    console.log('[智能确认完成] 按钮位置:', btn.getBoundingClientRect());
                } else {
                    console.log('[智能确认完成] ❌ 按钮未找到！');
                    // 如果按钮不存在，尝试重新创建
                    const newBtn = UI.createDraggableButton('确认完成', CONFIG.colors.primary);
                    newBtn.onclick = () => Processor.executeConfirmProcess();
                    document.body.appendChild(newBtn);
                    console.log('[智能确认完成] 重新创建了按钮');
                }
            }, 1000);
            
            // 监听页面变化，自动检查状态
            const observer = new MutationObserver(() => {
                // 可以在这里添加自动检查逻辑，如果需要的话
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    };

    // 等待页面加载完成后启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', Controller.init);
    } else {
        Controller.init();
    }
})();