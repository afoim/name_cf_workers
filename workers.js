

// HTML 内容
const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>点名表</title>
    <style>
    :root {
        --background-color: #f5f5f5;
        --container-background-color: #fff;
        --text-color: #333; /* 浅色主题的文字颜色 */
        --button-background-color: #007bff;
        --button-hover-background-color: #0056b3;
        --list-item-background-color: #f9f9f9;
        --checked-item-background-color: #e0e0e0;
        --shadow-color: rgba(0, 0, 0, 0.1);
        --blur-color: rgba(0, 0, 0, 0.05);
    }
    
    [data-theme="dark"] {
        --background-color: #121212;
        --container-background-color: #1e1e1e;
        --text-color: #ffffff; /* 暗色主题的文字颜色为白色 */
        --button-background-color: #1a73e8;
        --button-hover-background-color: #1669c1;
        --list-item-background-color: #2c2c2c;
        --checked-item-background-color: #444;
        --shadow-color: rgba(0, 0, 0, 0.3);
        --blur-color: rgba(0, 0, 0, 0.1);
    }
    
    body {
        font-family: 'Arial', sans-serif;
        background-color: var(--background-color);
        color: var(--text-color); /* 根据主题动态调整文本颜色 */
        margin: 0;
        padding: 20px;
        transition: background-color 0.3s, color 0.3s; /* 添加颜色过渡 */
    }
    
    .container {
        max-width: 80%;
        margin: 0 auto;
        padding: 20px;
        background-color: var(--container-background-color);
        border-radius: 8px;
        box-shadow: 0 4px 8px var(--shadow-color);
    }
    h1, h2 {
        text-align: center;
        color: var(--text-color);
    }
    .actions {
        margin-bottom: 20px;
        text-align: center;
    }
    .actions button {
        background-color: var(--button-background-color);
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 16px;
        margin-right: 10px;
        transition: background-color 0.3s, backdrop-filter 0.3s;
        backdrop-filter: blur(5px);
    }
    .actions button:hover {
        background-color: var(--button-hover-background-color);
    }
    .list {
        text-align: center;
        padding: 0;
        margin: 0;
    }
    .list-item {
        display: inline-block;
        padding: 10px;
        margin: 5px;
        border: 1px solid #ddd;
        cursor: pointer;
        transition: background-color 0.3s ease, transform 0.3s ease;
        border-radius: 8px;
        box-shadow: 0 2px 5px var(--shadow-color);
        background-color: var(--list-item-background-color);
        text-align: center;
        max-width: 100%;
    }
    .list-item span {
        font-size: 16px;
        color: var(--text-color);
        display: block;
    }
    .list-item.checked {
        background-color: var(--checked-item-background-color);
        color: var(--text-color);
        text-decoration: line-through;
    }
    .list-item.clicked {
        animation: bounce 0.5s ease;
    }
    .list-item input[type="checkbox"] {
        display: none;
    }
    @keyframes bounce {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
    }
    .time-container {
        text-align: center;
        font-size: 24px;
        margin-bottom: 20px;
        color: var(--text-color);
    }
    #login-container {
        text-align: center;
        margin-bottom: 20px;
    }
    #password-input, #totp-input {
        padding: 10px;
        font-size: 16px;
        border-radius: 5px;
        border: 1px solid #ddd;
        margin-right: 10px;
    }
    
    </style>
</head>
<body>
    <div class="container">
        <div id="login-container">
            <h2>请输入密码和TOTP验证码</h2>
            <input type="password" id="password-input" placeholder="密码">
            <input type="password" id="totp-input" placeholder="TOTP验证码">
            <button onclick="login()">登录</button>
        </div>
        <div id="main-container" style="display: none;">
            <h1>点名表</h1>
            <div class="actions">
                <button onclick="selectAll()">全选</button>
                <button onclick="deselectAll()">取消全选</button>
                <button onclick="toggleTheme()">切换主题</button>
            </div>
            <div id="name-list"></div>
        </div>
    </div>
    <script>
        const TOTP_SECRET = '${TOTP_SECRET}';

        // Base32 解码函数
        function base32ToUint8Array(base32) {
            const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
            let bits = '';
            for (const char of base32) {
                const val = base32Chars.indexOf(char.toUpperCase());
                if (val === -1) continue;
                bits += val.toString(2).padStart(5, '0');
            }
            const byteArray = [];
            for (let i = 0; i + 8 <= bits.length; i += 8) {
                byteArray.push(parseInt(bits.substring(i, i + 8), 2));
            }
            return new Uint8Array(byteArray);
        }

        // 生成 TOTP 函数
        async function generateTOTP(secretBase32) {
            const key = base32ToUint8Array(secretBase32);
            const time = Math.floor(Date.now() / 1000 / 30); // 30秒时间步长
            const timeBuffer = new ArrayBuffer(8);
            const timeView = new DataView(timeBuffer);
            timeView.setUint32(4, time, false); // 大端模式写入时间
            const keyData = await crypto.subtle.importKey(
                'raw',
                key,
                { name: 'HMAC', hash: 'SHA-1' },
                false,
                ['sign']
            );
            const hmac = await crypto.subtle.sign('HMAC', keyData, timeBuffer);
            const hmacView = new DataView(hmac);
            const offset = hmacView.getUint8(hmacView.byteLength - 1) & 0xf;
            const code = (
                (hmacView.getUint32(offset) & 0x7fffffff) % 1000000
            ).toString().padStart(6, '0');
            return code;
        }

        // 登录函数
        async function login() {
            const password = document.getElementById('password-input').value;
            const totp = document.getElementById('totp-input').value;

            try {
                const response = await fetch('/api/authenticate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ password, totp })
                });
                if (response.ok) {
                    const data = await response.text();
                    loadNames(data);
                    document.getElementById('login-container').style.display = 'none';
                    document.getElementById('main-container').style.display = 'block';
                } else {
                    alert('密码或TOTP错误');
                }
            } catch (error) {
                console.error('登录失败:', error);
            }
        }

        // 加载名称列表
        function loadNames(data) {
            const names = data.split('\\n').filter(name => name.trim() !== '');
            const list = document.getElementById('name-list');
            list.innerHTML = '';
            names.forEach(name => {
                const listItem = document.createElement('div');
                listItem.classList.add('list-item');
                listItem.textContent = name;
        
                // 添加点击事件，切换 'checked' 类，并将项目移动到列表的最后
                listItem.addEventListener('click', () => {
                    listItem.classList.toggle('checked');
                    if (listItem.classList.contains('checked')) {
                        // 从列表中移除，并添加到末尾
                        listItem.remove();
                        list.appendChild(listItem);
                    }
                });
        
                list.appendChild(listItem);
            });
        }

        // 全选函数
        function selectAll() {
            document.querySelectorAll('.list-item').forEach(item => {
                item.classList.add('checked');
            });
        }

        // 取消全选函数
        function deselectAll() {
            document.querySelectorAll('.list-item').forEach(item => {
                item.classList.remove('checked');
            });
        }

        // 切换主题
        function toggleTheme() {
            const body = document.body;
            body.dataset.theme = body.dataset.theme === 'dark' ? '' : 'dark';
        }

        // 实时更新TOTP
        async function updateTOTP() {
            const totpCode = await generateTOTP(TOTP_SECRET);
            console.log(totpCode);
            setTimeout(updateTOTP, 1000); // 每秒更新一次
        }

        updateTOTP();
    </script>
</body>
</html>

`;

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url);

  // 处理 API 请求，验证密码和 TOTP
  if (url.pathname === '/api/authenticate' && request.method === 'POST') {
    const { password, totp } = await request.json();
    
    // 验证密码
    if (password !== PASSWORD) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 验证 TOTP
    const generatedTotp = await generateTOTP(TOTP_SECRET);
    if (totp !== generatedTotp) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 如果认证通过，返回点名列表
    return new Response(NAMES, { headers: { 'Content-Type': 'text/plain' } });
  }

  // 返回 HTML 内容
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}

// 生成 TOTP
async function generateTOTP(secretBase32) {
  const key = base32ToUint8Array(secretBase32);
  const time = Math.floor(Date.now() / 1000 / 30);
  const timeBuffer = new ArrayBuffer(8);
  const timeView = new DataView(timeBuffer);
  timeView.setUint32(4, time, false);
  
  const keyData = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const hmac = await crypto.subtle.sign('HMAC', keyData, timeBuffer);
  const hmacView = new DataView(hmac);
  const offset = hmacView.getUint8(hmacView.byteLength - 1) & 0xf;
  const code = (
    (hmacView.getUint32(offset) & 0x7fffffff) % 1000000
  ).toString().padStart(6, '0');

  return code;
}

// Base32 解码函数
function base32ToUint8Array(base32) {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of base32) {
    const val = base32Chars.indexOf(char.toUpperCase());
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const byteArray = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    byteArray.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return new Uint8Array(byteArray);
}
