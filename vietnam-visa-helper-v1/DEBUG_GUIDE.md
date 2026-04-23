# 🔍 调试指南 - 越南签证向导 v1.2.2

## 问题所在

根据您的console log，系统仍然在HOME页面上，没有进入DISCLAIMER和FORM页面。这意味着：
1. ❌ Disclaimer页面检测失败
2. ❌ 表单页面检测失败
3. ❌ 相应的功能没有触发

## 诊断方法

### 步骤 1️⃣: 运行诊断脚本

1. **打开越南签证网站**: https://evisa.gov.vn/
2. **按 F12** 打开开发者工具
3. **切换到 Console 标签**
4. **复制并粘贴** `DIAGNOSTIC_SCRIPT.js` 中的代码
5. **按 Enter 运行**

### 步骤 2️⃣: 检查具体页面

在官网上导航到不同页面并运行诊断脚本：

#### 页面1: HOME (首页)
- 您应该看到Apply按钮
- 运行脚本，记下所有信息

#### 页面2: DISCLAIMER (条款页面)
- 点击Apply后，应该进入此页面
- 查看是否有checkbox和"条款"相关文本
- 运行脚本，查看是否有checkbox元素

#### 页面3: FORM (表单页面)
- 继续后应该进入表单页面
- 查看有多少个input字段
- 运行脚本，看input字段的属性

### 步骤 3️⃣: 找出正确的选择器

当运行诊断脚本后，重点记下：

```
✅ 需要记录以下信息：

1. Disclaimer页面
   - 是否检测到"disclaimer"或相关文本
   - checkbox的ID、Name、class
   - Next按钮的具体文本和属性

2. 表单页面  
   - 第一个input的ID、Name、placeholder、label
   - 需要翻译的字段列表（Name属性）
   - 是否都在<form>标签内

3. 可滚动容器
   - Disclaimer内容在哪个div中
```

## 快速检查方法

如果您懒得运行脚本，也可以直接在console中检查：

```javascript
// 检查是否有checkbox
document.querySelectorAll('input[type="checkbox"]')

// 查找Next按钮
Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'))

// 查看所有input字段
document.querySelectorAll('input')

// 查看页面是否包含特定文本
document.body.innerText.includes('disclaimer')
```

## 不同浏览器的导航逻辑

根据您的情况，似乎：
1. ❌ Apply按钮点击后没有导航到disclaimer页面
2. ❌ 或者页面动态加载，没有完整的URL变化

**可能的原因**:
- 网站使用React/Vue并在同一URL内动态显示不同内容
- Disclaimer可能是Modal弹窗而不是新页面
- checkbox可能用自定义组件实现，不是标准HTML

## 临时解决方案

在您提供诊断结果之前，请尝试以下操作：

### 方案A: 手动查看页面结构

1. 在disclaimer页面上，按 F12
2. 按 Ctrl+Shift+C (或点击Inspector图标)
3. 点击页面上的checkbox
4. 在Inspector中查看其HTML
5. 复制完整的`<input>` 和其parent元素代码

### 方案B: 查看Network标签

1. 打开Network标签
2. 点击Apply按钮
3. 查看是否有新的请求（URL、请求内容、响应内容）
4. 这能告诉我们页面是否真的导航到了新地址

## 预期输出示例

当您运行诊断脚本时，应该看到类似：

```
========== 🔍 越南签证网页结构诊断 ==========

📍 当前URL: https://evisa.gov.vn/
📄 页面标题: Welcome to Vietnam e-Visa

===== 📋 Disclaimer页面诊断 =====
✓ 页面包含"disclaimer": false
✓ 页面包含"条款": false
✓ 页面包含"agree": false
✓ 页面包含"同意": false

===== ☑️ Checkbox元素诊断 =====
找到 0 个 checkbox 元素:

===== ⏭️ Next按钮诊断 =====
找到 12 个按钮/链接:
  [0] 文本: "Apply Now"
      标签: A
      ...
```

## 收集信息后的步骤

一旦您提供了诊断结果，我将：

1. ✅ 更新页面检测逻辑
2. ✅ 修改选择器以匹配实际DOM
3. ✅ 添加特定的hint/label映射
4. ✅ 重新测试extension

---

## 快速命令参考

将这些复制到console中快速检查：

```javascript
// 1. 检查是否是disclaimer页面
document.body.innerText.toLowerCase().includes('disclaimer') || document.body.innerText.toLowerCase().includes('条款')

// 2. 找所有checkbox
Array.from(document.querySelectorAll('input[type="checkbox"]')).map(cb => ({id: cb.id, name: cb.name, parent: cb.parentElement.tagName}))

// 3. 找Next按钮
Array.from(document.querySelectorAll('button, a')).filter(b => /next|下一步|继续/i.test(b.textContent))

// 4. 找表单元素
Array.from(document.querySelectorAll('input[type="text"], input[type="email"], select')).map(inp => ({name: inp.name, placeholder: inp.placeholder, type: inp.type}))

// 5. 查看可滚动容器
Array.from(document.querySelectorAll('*')).filter(el => el.scrollHeight > el.clientHeight && el.scrollHeight > 300).map(el => ({class: el.className, id: el.id, scrollHeight: el.scrollHeight}))
```

---

**💡 请运行诊断脚本并分享结果，我将基于实际数据修复extension！**
