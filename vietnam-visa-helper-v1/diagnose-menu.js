// 菜单诊断脚本 - 在浏览器控制台运行

console.log('🔍 开始诊断 Ant Select 菜单...\n');

// 1. 找一个 Ant Select
const selects = document.querySelectorAll('.ant-select');
console.log(`✅ 发现 ${selects.length} 个 Ant Select\n`);

if (selects.length === 0) {
  console.log('❌ 没有找到 Ant Select');
  process._exit(1);
}

const testSelect = selects[0];
console.log(`📍 测试第一个 Select:`, testSelect);

// 2. 点击打开菜单
const input = testSelect.querySelector('.ant-select-selection-search-input, input[role="combobox"]');
if (input) {
  console.log('\n📌 找到输入框，正在点击...');
  input.click();
  input.focus();
  
  // 延迟后检查
  setTimeout(() => {
    console.log('\n⏱️ 延迟 500ms 后检查菜单...\n');
    
    // 在整个 document 中查找菜单
    const listbox = document.querySelector('[role="listbox"]');
    const dropdown = document.querySelector('.ant-select-dropdown');
    const virtualList = document.querySelector('.rc-virtual-list-holder');
    
    console.log(`📋 [role="listbox"]: ${listbox ? '✅ 找到' : '❌ 未找到'}`);
    if (listbox) {
      console.log(`   位置: ${listbox.getBoundingClientRect().top}, ${listbox.getBoundingClientRect().left}`);
      console.log(`   显示: ${getComputedStyle(listbox).display}`);
      console.log(`   高度: ${getComputedStyle(listbox).height}`);
      const options = listbox.querySelectorAll('[role="option"]');
      console.log(`   选项数: ${options.length}`);
      if (options.length > 0) {
        console.log(`   第一个选项: ${options[0].getAttribute('aria-label') || options[0].textContent}`);
      }
    }
    
    console.log(`\n.ant-select-dropdown: ${dropdown ? '✅ 找到' : '❌ 未找到'}`);
    if (dropdown) {
      console.log(`   位置: ${dropdown.getBoundingClientRect().top}, ${dropdown.getBoundingClientRect().left}`);
      console.log(`   显示: ${getComputedStyle(dropdown).display}`);
      console.log(`   高度: ${getComputedStyle(dropdown).height}`);
    }
    
    console.log(`\n.rc-virtual-list-holder: ${virtualList ? '✅ 找到' : '❌ 未找到'}`);
    if (virtualList) {
      console.log(`   位置: ${virtualList.getBoundingClientRect().top}, ${virtualList.getBoundingClientRect().left}`);
    }
    
    // 检查输入框属性
    console.log(`\n📝 输入框属性:`);
    console.log(`   value: "${input.value}"`);
    console.log(`   readonly: ${input.readOnly}`);
    console.log(`   aria-expanded: ${input.getAttribute('aria-expanded')}`);
    console.log(`   aria-owns: ${input.getAttribute('aria-owns')}`);
    console.log(`   aria-controls: ${input.getAttribute('aria-controls')}`);
    
    // 检查所有包含 "dropdown" 或 "menu" 的元素
    console.log(`\n🔎 全页面搜索所有菜单相关元素...`);
    const allDropdowns = document.querySelectorAll('[class*="dropdown"], [class*="menu"], [class*="virtual-list"]');
    console.log(`   找到 ${allDropdowns.length} 个相关元素`);
    allDropdowns.forEach((el, i) => {
      const display = getComputedStyle(el).display;
      const visibility = getComputedStyle(el).visibility;
      if (display !== 'none' && visibility !== 'hidden') {
        console.log(`   [${i}] ${el.className} - 显示: ${display}`);
      }
    });
    
  }, 500);
} else {
  console.log('❌ 未找到输入框');
}
