// 🔍 Vietnam Visa Helper - Page Structure Diagnostic Script
// 在浏览器控制台 (F12) 中粘贴并运行此脚本来诊断页面结构

console.log('========== 🔍 越南签证网页结构诊断 ==========\n');

// 1️⃣ 诊断当前页面URL和类型
console.log('📍 当前URL:', window.location.href);
console.log('📄 页面标题:', document.title);
console.log('');

// 2️⃣ 诊断Disclaimer相关元素
console.log('===== 📋 Disclaimer页面诊断 =====');
const disclaimerText = document.body.innerText.toLowerCase();
console.log('✓ 页面包含"disclaimer":', disclaimerText.includes('disclaimer'));
console.log('✓ 页面包含"条款":', disclaimerText.includes('条款'));
console.log('✓ 页面包含"agree":', disclaimerText.includes('agree'));
console.log('✓ 页面包含"同意":', disclaimerText.includes('同意'));
console.log('');

// 3️⃣ 查找所有checkbox
console.log('===== ☑️ Checkbox元素诊断 =====');
const checkboxes = document.querySelectorAll('input[type="checkbox"]');
console.log(`找到 ${checkboxes.length} 个 checkbox 元素:`);
checkboxes.forEach((cb, idx) => {
  console.log(`  [${idx}] ID: ${cb.id}`);
  console.log(`       Name: ${cb.name}`);
  console.log(`       Value: ${cb.value}`);
  console.log(`       Label: ${document.querySelector(`label[for="${cb.id}"]`)?.textContent || 'N/A'}`);
  console.log(`       Checked: ${cb.checked}`);
  console.log(`       Parent tag: ${cb.parentElement?.tagName}`);
  console.log('');
});

// 4️⃣ 查找Next按钮
console.log('===== ⏭️ Next按钮诊断 =====');
const allButtons = document.querySelectorAll('button, a[role="button"], [role="button"]');
console.log(`找到 ${allButtons.length} 个按钮/链接:`);
allButtons.forEach((btn, idx) => {
  const text = btn.textContent?.trim() || '';
  if (text.length > 0 && text.length < 100) {
    console.log(`  [${idx}] 文本: "${text}"`);
    console.log(`       标签: ${btn.tagName}`);
    console.log(`       ID: ${btn.id || 'N/A'}`);
    console.log(`       Class: ${btn.className || 'N/A'}`);
    console.log('');
  }
});

// 5️⃣ 查找表单元素
console.log('===== 📝 表单元素诊断 =====');
const inputs = document.querySelectorAll('input, select, textarea');
console.log(`找到 ${inputs.length} 个form元素:`);
inputs.slice(0, 15).forEach((inp, idx) => {  // 只显示前15个
  const label = document.querySelector(`label[for="${inp.id}"]`)?.textContent || 
                inp.previousElementSibling?.textContent || 
                inp.parentElement?.textContent.split('\n')[0] || '';
  console.log(`  [${idx}] 类型: ${inp.type || inp.tagName}`);
  console.log(`       ID: ${inp.id || 'N/A'}`);
  console.log(`       Name: ${inp.name || 'N/A'}`);
  console.log(`       Placeholder: ${inp.placeholder || inp.title || 'N/A'}`);
  console.log(`       Label: ${label.trim().substring(0, 50)}`);
  console.log('');
});

// 6️⃣ 查找可滚动容器
console.log('===== 🔄 可滚动容器诊断 =====');
const scrollables = document.querySelectorAll('div, main, article, section');
let scrollableCount = 0;
scrollables.forEach(el => {
  if (el.scrollHeight > el.clientHeight && el.scrollHeight > 300) {
    scrollableCount++;
    if (scrollableCount <= 5) {
      console.log(`  容器: ${el.className || el.id || el.tagName}`);
      console.log(`        scrollHeight: ${el.scrollHeight}, clientHeight: ${el.clientHeight}`);
      console.log('');
    }
  }
});
console.log(`总共 ${scrollableCount} 个可滚动容器\n`);

// 7️⃣ 生成可复制的选择器
console.log('===== ✂️ 可复制选择器 =====');
console.log('复制粘贴这些到代码中:\n');

const checkbox = document.querySelector('input[type="checkbox"]');
console.log('// Checkbox选择器:');
if (checkbox) {
  console.log(`input[type="checkbox"]  // ID: ${checkbox.id}, Name: ${checkbox.name}`);
} else {
  console.log('// ❌ 未找到checkbox');
}

const nextBtn = Array.from(allButtons).find(b => {
  const text = b.textContent?.toLowerCase() || '';
  return text.includes('next') || text.includes('下一步') || text.includes('继续');
});
console.log('\n// Next按钮选择器:');
if (nextBtn) {
  if (nextBtn.id) console.log(`#${nextBtn.id}`);
  if (nextBtn.className) console.log(`button.${nextBtn.className.split(' ')[0]}`);
  console.log(`// 文本: "${nextBtn.textContent?.trim()}"`);
} else {
  console.log('// ❌ 未找到Next按钮');
}

console.log('\n========== 诊断完成 ==========');
console.log('💡 提示: 右键点击元素 > 检查 来查看具体的HTML属性');
