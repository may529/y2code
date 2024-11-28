window.addEventListener("message", (event) => {
  const message = event.data;
  switch (message.command) {
    case "saveSuccess":
      // 可以添加一些视觉反馈，比如显示一个临时的成功提示
      const saveBtn = document.getElementById("save-yapi");
      const originalText = saveBtn.textContent;
      saveBtn.textContent = "保存成功！";
      saveBtn.disabled = true;

      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
      }, 2000);
      break;
    case "loadConfig":
      console.log("收到配置数据:", message.config);
      // 填充表单数据
      if (message.config.yapi) {
        const { domain, token, projectId, requestsrc } = message.config.yapi;

        // 填充域名
        const domainInput = document.getElementById("yapi-url");
        if (domainInput && domain) {
          domainInput.value = domain;
        }

        // 填充token
        const tokenInput = document.getElementById("yapi-token");
        if (tokenInput && token) {
          tokenInput.value = token;
        }

        // 填充项目ID
        const projectInput = document.getElementById("yapi-projectId");
        if (projectInput && projectId) {
          projectInput.value = projectId;
        }

        // 填充项目request引用
        const requestInput = document.getElementById("yapi-requestsrc");
        if (requestInput && requestsrc) {
          requestInput.value = requestsrc;
        }
      }
      break;
    case "updateSelectedDirectory":
      const directoryInput = document.getElementById("template-directory");
      if (directoryInput) {
        directoryInput.value = message.path;
      }
      break;
    case "templateCreated":
      // 显示成功提示
      const notification = document.createElement("div");
      notification.textContent = message.success
        ? "模板创建成功！"
        : "模板创建失败：" + message.error;
      notification.className = message.success
        ? "success-notification"
        : "error-notification";
      document.body.appendChild(notification);

      // 2秒后移除提示
      setTimeout(() => {
        notification.remove();
      }, 2000);

      // 如果创建成功且提供了更新的模板列表，则更新模板表格
      if (message.success && message.templateList) {
        updateTemplateTable(message.templateList);
      }
      break;
    case "updateTemplateList":
      updateTemplateTable(message.templateList);
      break;
  }
});

// Tab切换逻辑
document.querySelectorAll(".tab-btn").forEach((button) => {
  button.addEventListener("click", () => {
    // 移除所有tab按钮的active类
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.remove("active");
    });

    // 移除所有内容区域的active类
    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.remove("active");
    });

    // 给当前点击的按钮添加active类
    button.classList.add("active");

    // 显示对应的内容区域
    const tabId = button.getAttribute("data-tab");
    document.getElementById(`${tabId}-content`).classList.add("active");

    // 如果切换到页面模版设置标签，请求更新模板列表
    if (tabId === "templates") {
      vscode.postMessage({ command: "getTemplateList" });
    }
  });
});

// 显示模态窗口的逻辑
document.getElementById("add-template").addEventListener("click", () => {
  const modal = document.getElementById("template-modal");
  modal.style.display = "block";
});

// 点击模态窗口外部时关闭
window.addEventListener("click", (event) => {
  const modal = document.getElementById("template-modal");
  if (event.target === modal) {
    modal.style.display = "none";
  }
});

// 取消按钮关闭模态窗口
document
  .getElementById("cancel-template")
  .addEventListener("click", (event) => {
    event.preventDefault();
    const modal = document.getElementById("template-modal");
    modal.style.display = "none";
  });

// 表单提交处理
document.getElementById("template-form").addEventListener("submit", (event) => {
  event.preventDefault();

  // 获取表单字段
  const templateName = document.getElementById("template-name").value.trim();
  const templateDirectory = document
    .getElementById("template-directory")
    .value.trim();

  // 验证字段
  if (!templateName || !templateDirectory) {
    // 创建轻提示
    const toast = document.createElement("div");
    toast.className = "toast-message";
    toast.textContent = "请填写所有必填字段";
    document.body.appendChild(toast);

    // 2秒后自动移除提示
    setTimeout(() => {
      toast.remove();
    }, 2000);

    return;
  }

  // 验证通过,发送创建模板消息
  vscode.postMessage({
    command: "createTemplate",
    name: templateName,
    sourceDirectory: templateDirectory,
  });

  // 关闭模态窗口
  const modal = document.getElementById("template-modal");
  modal.style.display = "none";

  // 清空表单
  event.target.reset();
});

// 选择目录按钮点击事件
document
  .getElementById("select-directory")
  .addEventListener("click", (event) => {
    event.preventDefault();
    console.log("选择目录按钮被点击");
    vscode.postMessage({
      command: "selectDirectory",
    });
    console.log("已发送selectDirectory消息");
  });

// 添加更新模板表格的函数
function updateTemplateTable(templateList) {
  const tableBody = document.querySelector(".template-table tbody");
  tableBody.innerHTML = ""; // 清空现有内容

  templateList.forEach((templateName) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${templateName}</td>
      <td>
        <button class="btn delete-template" data-id="${templateName}">删除</button>
      </td>
    `;
    tableBody.appendChild(row);
  });

  // 重新绑定删除按钮的事件监听器
  attachTemplateButtonListeners();
}

function attachTemplateButtonListeners() {
  document.querySelectorAll(".delete-template").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const templateName = event.target.getAttribute("data-id");
      console.log(`Delete button clicked for template: ${templateName}`);
      vscode.postMessage({
        command: "deleteTemplate",
        name: templateName,
      });
    });
  });
}

// 初始化时也调用一次，为现有的按钮绑定事件
attachTemplateButtonListeners();

// YAPI配置保存按钮点击事件
document.getElementById("save-yapi").addEventListener("click", (event) => {
  event.preventDefault();

  // 获取表单数据
  const domain = document.getElementById("yapi-url").value.trim();
  const token = document.getElementById("yapi-token").value.trim();
  const projectId = document.getElementById("yapi-projectId").value.trim();
  const requestsrc = document.getElementById("yapi-requestsrc").value.trim();

  // 验证必填字段
  if (!domain || !token || !projectId || !requestsrc) {
    const toast = document.createElement("div");
    toast.className = "toast-message";
    toast.textContent = "请填写所有必填字段";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
    return;
  }

  // 发送保存配置消息
  vscode.postMessage({
    command: "saveYapiConfig",
    config: {
      yapi: {
        domain,
        token,
        projectId,
        requestsrc,
      },
    },
  });
});
