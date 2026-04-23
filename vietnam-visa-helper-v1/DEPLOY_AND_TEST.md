# 越南签证助手 v1.2 - 部署和测试指南

## 📦 版本信息

- **版本**: v1.2 (修复版本)
- **发布日期**: 2026年4月12日
- **核心改进**: 完整的Apply按钮检测、字段识别和自动填充

## 🚀 快速部署

### 步骤1: 在Chrome中加载扩展

1. 打开Chrome浏览器
2. 进入 `chrome://extensions`
3. 启用右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择本项目文件夹 (`vietnam-visa-helper-v1`)
6. 点击打开

### 步骤2: 验证加载成功

检查扩展是否出现在列表中，ID应该显示（例如：`onjcfjdofhcfldhicflkdlnd`）

## 🧪 测试流程

### A. 首页测试 (evisa.gov.vn 主页)

**预期行为**：
- ✅ 浮动控制面板出现在右上角
- ✅ Apply按钮被自动检测和高亮 (脉冲绿色)
- ✅ 顶部显示"点击红色Apply now按钮开始"的提示

**验证步骤**：
1. 访问 https://evisa.gov.vn
2. 打开浏览器开发者工具 (F12)
3. 查看Console标签，应该看到：
   ```
   🇻🇳 越南签证助手 v1.2 已激活 - Bug修复版本
   ✅ 用户数据已加载
   ✅ 字段映射已加载，共 22 个字段
   📍 检测到: Apply 页面 (有Apply按钮)
   ✅ Apply按钮已高亮
   ```
4. 查找红色的"Apply now"按钮，应该有脉冲动画
5. 浮动面板应该显示在右上角，标题为"越南签证助手 v1.2"

**如果测试失败**：
- 检查Console中是否有错误消息
- 确认已刷新页面让扩展重新加载
- 验证manifest.json中的host_permissions是否正确

---

### B. 表单页面测试

**前置条件**：
- 在主页上点击"Apply now"按钮进入表单

**预期行为**：
- ✅ 页面加载后，所有表单字段都获得中文标签
- ✅ 每个字段旁边有黄色的❓图标
- ✅ 浮动面板显示字段数量
- ✅ "一键自动填表"按钮可用

**验证步骤**：
1. 进入表单页面后，打开F12查看Console
2. 应该看到类似的日志：
   ```
   🚀 开始检测和标签化表单字段...
   🔍 发现 XX 个表单元素
   ✅ 识别字段[1]: 姓氏 (surname)
   ✅ 识别字段[2]: 名字 (given_name)
   ...
   📊 成功识别 15 个字段，缓存可填充字段: 15
   ```

3. 向下滚动页面，应该看到所有的`input`、`select`、`textarea`字段都有：
   - 黄色边框标签，显示中文名称 (例如: "姓氏")
   - 黄色❓图标
   - 点击❓后出现黄色提示框，显示填写说明

4. 点击❓图标，应该看到提示框显示：
   - 填写说明 (中文)
   - 示例 (如果有)
   - 可选选项列表 (如果是下拉菜单)

**测试自动填表**：
1. 在浮动面板中点击"一键自动填表"按钮 (红色变绿色)
2. Console应该显示：
   ```
   🟢 自动填表已启用
   📝 开始自动填表...
   ✅ 填充: 姓氏 = Zhang
   ✅ 填充: 名字 = San
   ...
   📊 填充完成: 成功 XX, 失败 0
   ```

3. 查看表单字段：
   - 文本字段应该被填充值
   - 下拉菜单应该选定相应选项
   - 字段应该显示绿色✓标记

4. 如果某些字段未被填充，检查Console查找警告信息：
   ```
   ⚠️ 未知的字段key: xxx
   ```

**如果表单填充失败**：
- 手动检查identifyField逻辑是否识别正确
- 在Console运行以下命令调试：
  ```javascript
  // 查看找到的所有输入字段
  document.querySelectorAll('input, select, textarea').forEach((el, i) => {
    console.log(`[${i}] ${el.name || el.id} = ${el.placeholder}`);
  });
  ```

---

### C. 快速测试清单

| 功能 | Chrome | Edge | 状态 |
|-----|--------|------|------|
| 页面加载扩展 | ✓ | ✓ | 已验证 |
| Apply按钮检测 | ? | ? | **待测试** |
| 字段标签化 | ? | ? | **待测试** |
| 自动填充 | ? | ? | **待测试** |
| 事件触发 | ? | ? | **待测试** |
| 提示框显示 | ? | ? | **待测试** |

---

## 🐛 常见问题和解决方案

### Q1: 扩展不工作，Console没有输出

**解决**：
1. 刷新页面 (Ctrl+R 或 Cmd+R)
2. 检查 `chrome://extensions` 中扩展是否启用
3. 重新加载扩展: 点击圆形箭头图标
4. 在manifest.json中确认host_permissions: `"*://*.evisa.gov.vn/*"`
5. 尝试在隐身窗口中打开evisa.gov.vn

### Q2: "未找到Apply按钮"

**解决**：
1. 确认浏览器显示的按钮文本是否包含"Apply"或"apply"
2. 打开控制台，运行：
   ```javascript
   // 查找所有按钮
   document.querySelectorAll('button, a.btn, a[role="button"]').forEach((btn, i) => {
     console.log(`[${i}] ${btn.textContent.substring(0, 50)}`);
   });
   ```
3. 如果找到了，记下它的class或id，并在content.js中的selectors数组中添加
4. 或者在identifyApplyButton函数中修改文本匹配逻辑

### Q3: 字段识别失败，未找到字段

**解决**：
1. 打开Devtools，检查字段的HTML结构：
   ```javascript
   // 检查某个input的属性
   document.querySelector('[name="field_name"]')
   // 查看其label
   document.querySelector('label[for="field_id"]')
   ```
2. 如果字段使用了特殊的name或id，在content.js的identifyField中添加识别规则
3. 检查是否有关联的label元素

### Q4: 自动填充不起作用

**解决**：
1. 检查background.js中的userData是否包含正确的值
2. 验证字段是否被正确识别 (查看Console日志)
3. 某些字段可能使用了Vue或React框架，需要额外的事件触发
4. 手动检查字段的值是否真的被设置：
   ```javascript
   document.querySelector('[name="surname"]').value
   ```

### Q5: 下拉菜单填充失败

**解决**：
1. 检查option的value和text是否与userData匹配
2. 运行调试命令：
   ```javascript
   const select = document.querySelector('[name="gender"]');
   Array.from(select.options).forEach(opt => {
     console.log(`value="${opt.value}" text="${opt.text}"`);
   });
   ```
3. 如果不匹配，在background.js的fieldMappings中修改options值

---

## 📝 文件结构说明

```
vietnam-visa-helper-v1/
├── manifest.json          # 扩展清单 (已更新到v1.2)
├── content.js            # 主要逻辑 (27KB，完全重写)
├── background.js         # 数据管理 (已更新字段)
├── popup.html/js        # 弹窗UI (已优化)
├── styles.css           # 样式表 (完整)
├── content-backup.js    # 备份文件 (v1.1)
├── README.md            # 详细文档
├── DEPLOY_AND_TEST.md   # 本文件
└── test_report.md       # 测试报告 (旧)
```

---

## 🔍 调试技巧

### 启用详细日志

在content.js的初始化函数中，修改日志级别（已在v1.2版本中默认启用）

### 在控制台直接测试

```javascript
// 获取用户数据
chrome.runtime.sendMessage({ action: 'getUserData' }, (response) => {
  console.log('用户数据:', response.userData);
  console.log('字段映射:', response.fieldMappings);
});

// 手动触发字段填充
document.querySelector('input[name="surname"]').value = 'Zhang';
document.querySelector('input[name="surname"]').dispatchEvent(new Event('input', { bubbles: true }));
document.querySelector('input[name="surname"]').dispatchEvent(new Event('change', { bubbles: true }));
```

### 查看所有识别的字段

```javascript
// 在console执行
console.table(Array.from(document.querySelectorAll('input, select')).map((el, i) => ({
  '序号': i,
  '名称': el.name || el.id || 'N/A',
  '类型': el.type || el.tagName,
  '值': el.value,
  '识别': el.dataset.vhLabeled ? '✓' : 'X'
})));
```

---

## 📊 预期测试结果

### 成功标志
- ✅ Console显示所有绿色的✅消息
- ✅ 表单字段都有中文标签
- ✅ 点击自动填表后字段被填充
- ✅ 字段显示绿色✓标记

### 失败标志
- ❌ Console显示❌或⚠️错误
- ❌ 字段未被标签化
- ❌ 值未被填充
- ❌ 下拉菜单显示第一选项或空白

---

## 🎯 后续改进建议

如果测试中发现以下问题，可以在后续版本中改进：

1. **某些字段未被识别**
   - 添加更多选择器或关键词
   - 使用AI匹配引擎

2. **特定框架兼容性**
   - 添加对Vue/React框架的特殊处理
   - 使用MutationObserver监听动态字段

3. **多语言支持**
   - 添加英文、越南文
   - 自动检测浏览器语言

4. **用户数据管理**
   - 添加本地存储支持
   - 允许用户编辑数据
   - 支持多个申请人配置

---

## 📮 反馈和报告

测试过程中遇到的任何问题，请记录：

1. 浏览器版本
2. 网站URL
3. Console错误信息
4. 预期行为 vs 实际行为
5. 截图或视频

---

**最后更新**: 2026年4月12日
**维护者**: Vietnam Visa Helper Team
