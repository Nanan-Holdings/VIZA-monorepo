// ========== VUE 实例值修改方案 - 在控制台运行 ==========

// 第一步：获取 Vue 应用实例
const app = document.querySelector('#__nuxt')?.__vue_app__ || 
            document.querySelector('[data-v-app]')?.__vue_app__ ||
            window.__VUE_INSTANCE__;

console.log('🔍 搜索 Vue 实例...', app);

if (!app) {
  console.warn('⚠️ 找不到 Vue 应用实例');
} else {
  console.log('✅ 找到 Vue 应用实例');
  
  // 尝试找到 Ant Select 组件实例
  // 方法 1：通过 Pinia store
  if (app.config.globalProperties.$pinia) {
    console.log('📦 检测到 Pinia store');
    const stores = app.config.globalProperties.$pinia._s; // 所有 stores
    console.log('Available stores:', stores);
  }
  
  // 方法 2：找一个 Ant Select 并尝试修改其值
  const selects = document.querySelectorAll('.ant-select');
  console.log(`找到 ${selects.length} 个 Ant Select`);
  
  if (selects.length > 0) {
    const firstSelect = selects[0];
    const input = firstSelect.querySelector('input');
    
    console.log('第一个 Select 的输入框:', input);
    console.log('输入框当前值:', input?.value);
    
    // 尝试通过 Vue 组件实例修改
    const vueComponent = firstSelect.__vue_instance || firstSelect.__vueParentComponent;
    console.log('Vue 组件实例:', vueComponent);
    
    // 尝试找到 Select 的 value 属性（v-model）
    if (input) {
      // 直接修改 input 的 value
      input.value = 'China';
      
      // 触发所有可能的事件
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
      
      // 尝试点击菜单项（如果有的话）
      setTimeout(() => {
        const menuItem = document.querySelector('[role="option"]');
        if (menuItem) {
          console.log('找到菜单项:', menuItem.textContent);
          menuItem.click();
        } else {
          console.log('❌ 没有找到菜单项');
        }
      }, 500);
    }
  }
}

console.log('=== 诊断完成 ===');
