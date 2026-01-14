addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

const CONFIG = {
  KV_TTL: 86400, // 24 hours
  NOTIFY_EMAIL: 'your email to receive the notification',
  REMIND_HOUR: 18 // 6:00 PM
}

async function handleRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname

  // API Routes
  if (path === '/api/checkin' && request.method === 'POST') {
    return handleCheckin(request);
  }

  if (path === '/api/check-status') {
    return handleCheckStatus();
  }

  // Static Pages
  if (path === '/child') {
    return renderOwnerPage();
  }

  // Default to Senior page
  return renderMainPage();
}

/**
 * 获取今日日期 Key (UTC+8)
 */
function getTodayKey() {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return beijingTime.toISOString().split('T')[0];
}

/**
 * 格式化北京时间
 */
function getBeijingTimeString() {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return beijingTime.toLocaleString('zh-CN', { hour12: false });
}

async function handleCheckin(request) {
  try {
    const body = await request.json();
    const location = body.location || null;
    const today = getTodayKey();
    const timeStr = getBeijingTimeString();

    const data = {
      checkedIn: true,
      time: timeStr,
      location: location
    };

    // Store in KV
    await ARE_YOU_ALIVE_STATUS.put(`checkin_${today}`, JSON.stringify(data), { expirationTtl: CONFIG.KV_TTL * 2 });

    // Send Email via Resend
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #2ecc71;">✅ 老人已签到</h2>
        <p>您的家属已于 <strong>${timeStr}</strong> 完成今日安全签到。</p>
        ${location ? `
        <div style="margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
          <p style="margin: 0; color: #666;">📍 签到位置：</p>
          <p style="margin: 5px 0 0; font-weight: bold;">
            <a href="https://uri.amap.com/marker?position=${location.lng},${location.lat}" style="color: #3498db; text-decoration: none;">查看高德地图 &rarr;</a>
          </p>
        </div>
        ` : ''}
        <p style="margin-top: 30px; font-size: 12px; color: #999;">此条信息由“死了吗”App自动发送。祝您家人安康。</p>
      </div>
    `;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_APIKEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: '老人签到系统 <notify@9527878.xyz>',
        to: [CONFIG.NOTIFY_EMAIL],
        subject: `老人签到通知 - ${today}`,
        html: emailHtml
      })
    });

    if (!resendRes.ok) {
      console.error('Resend Error:', await resendRes.text());
    }

    return new Response(JSON.stringify({ success: true, time: timeStr }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}

async function handleCheckStatus() {
  const today = getTodayKey();
  const data = await ARE_YOU_ALIVE_STATUS.get(`checkin_${today}`);

  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const currentHour = beijingTime.getHours();

  return new Response(JSON.stringify({
    checkedIn: !!data,
    data: data ? JSON.parse(data) : null,
    currentHour: currentHour,
    remindHour: CONFIG.REMIND_HOUR,
    today: today
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

function renderMainPage() {
  return new Response(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>平安签到 - 老人端</title>
    <style>
        body {
            font-family: -apple-system, system-ui, sans-serif;
            background: #fdf6e3;
            margin: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            color: #5c3d2e;
        }
        .container {
            text-align: center;
            width: 90%;
            max-width: 400px;
        }
        .header { margin-bottom: 40px; }
        .header h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .header p { font-size: 1.2rem; color: #8d7b68; }
        
        #checkinBtn {
            width: 220px;
            height: 220px;
            border-radius: 50%;
            border: none;
            background: linear-gradient(145deg, #2ecc71, #27ae60);
            color: white;
            font-size: 2.2rem;
            font-weight: bold;
            box-shadow: 0 10px 20px rgba(46, 204, 113, 0.3);
            cursor: pointer;
            transition: transform 0.2s, background 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
        }
        #checkinBtn:active { transform: scale(0.95); }
        #checkinBtn:disabled {
            background: #bdc3c7;
            box-shadow: none;
            cursor: default;
        }
        #checkinBtn span { font-size: 1rem; margin-top: 10px; font-weight: normal; }

        .status-msg { margin-top: 30px; font-size: 1.2rem; min-height: 1.5em; }
        .loc-info { font-size: 0.9rem; color: #999; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>家校平安</h1>
            <p>点击下方按钮，告知家人您很安全</p>
        </div>

        <button id="checkinBtn" onclick="doCheckin()">
            报平安
            <span id="btnSub">点击签到</span>
        </button>

        <div id="statusMsg" class="status-msg"></div>
        <div id="locStatus" class="loc-info">正在获取位置...</div>
    </div>

    <script>
        let userLocation = null;

        window.onload = () => {
            checkTodayStatus();
            getLocation();
        };

        async function checkTodayStatus() {
            const res = await fetch('/api/check-status');
            const data = await res.json();
            if (data.checkedIn) {
                setAsCheckedIn(data.data.time);
            }
        }

        function getLocation() {
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        document.getElementById('locStatus').innerText = "📍 位置已锁定";
                    },
                    (err) => {
                        document.getElementById('locStatus').innerText = "⚠️ 无法获取位置，但不影响签到";
                    }
                );
            } else {
                document.getElementById('locStatus').innerText = "⚠️ 浏览器不支持定位";
            }
        }

        async function doCheckin() {
            const btn = document.getElementById('checkinBtn');
            const msg = document.getElementById('statusMsg');
            btn.disabled = true;
            msg.innerText = "正在提交...";

            try {
                const res = await fetch('/api/checkin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ location: userLocation })
                });
                const data = await res.json();
                if (data.success) {
                    setAsCheckedIn(data.time);
                    msg.style.color = "#27ae60";
                    msg.innerText = "签到成功！家人已收到通知";
                } else {
                    throw new Error(data.error);
                }
            } catch (e) {
                btn.disabled = false;
                msg.style.color = "#e74c3c";
                msg.innerText = "签到失败，请刷新重试";
            }
        }

        function setAsCheckedIn(time) {
            const btn = document.getElementById('checkinBtn');
            const sub = document.getElementById('btnSub');
            btn.disabled = true;
            btn.innerText = "已签到";
            sub.innerText = "时间：" + time.split(' ')[1];
            btn.appendChild(sub);
            document.getElementById('statusMsg').innerText = "今日已向家人报平安";
        }
    </script>
</body>
</html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

function renderOwnerPage() {
  return new Response(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>家属监控面板</title>
    <style>
        body {
            font-family: -apple-system, system-ui, sans-serif;
            background: #f0f2f5;
            margin: 0;
            padding: 20px;
            color: #1c1e21;
        }
        .card {
            background: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 500px;
            margin: 0 auto;
            box-shadow: 0 2px 12px rgba(0,0,0,0.08);
        }
        .header { text-align: center; margin-bottom: 30px; }
        .header h2 { margin: 0; color: #1a73e8; }
        
        .status-box {
            text-align: center;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 24px;
        }
        .status-safe { background: #e6fcf5; border: 1px solid #c3fae8; }
        .status-danger { background: #fff5f5; border: 1px solid #ffe3e3; }
        .status-waiting { background: #fff9db; border: 1px solid #fff3bf; }

        .emoji { font-size: 64px; margin-bottom: 16px; display: block; }
        .status-title { font-size: 24px; font-weight: bold; margin-bottom: 8px; }
        .status-desc { color: #666; font-size: 16px; }

        .details { border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px; }
        .detail-item { margin-bottom: 12px; display: flex; justify-content: space-between; }
        .label { color: #888; }
        .val { font-weight: 500; }

        .alert-bar {
            background: #e74c3c;
            color: white;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            margin-top: 24px;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <h2>平安监控面板</h2>
        </div>

        <div id="statusBox" class="status-box">
            <span id="statusEmoji" class="emoji">⏳</span>
            <div id="statusTitle" class="status-title">正在获取状态...</div>
            <div id="statusDesc" class="status-desc">请稍候</div>
        </div>

        <div id="details" class="details" style="display:none">
            <div class="detail-item">
                <span class="label">签到日期</span>
                <span id="dateVal" class="val">-</span>
            </div>
            <div class="detail-item">
                <span class="label">签到时间</span>
                <span id="timeVal" class="val">-</span>
            </div>
            <div id="locRow" class="detail-item">
                <span class="label">地理位置</span>
                <span id="locVal" class="val">
                    <a id="mapLink" href="#" target="_blank" style="color: #1a73e8;">查看地图</a>
                </span>
            </div>
        </div>

        <div id="alertBar" class="alert-bar" style="display:none">
            🚨 已经超过 18:00 还未签到，请尽快联系老人确认！
        </div>
    </div>

    <script>
        async function fetchStatus() {
            try {
                const res = await fetch('/api/check-status');
                const data = await res.json();
                updateUI(data);
            } catch (e) {
                console.error(e);
            }
        }

        function updateUI(data) {
            const box = document.getElementById('statusBox');
            const emoji = document.getElementById('statusEmoji');
            const title = document.getElementById('statusTitle');
            const desc = document.getElementById('statusDesc');
            const details = document.getElementById('details');
            const alert = document.getElementById('alertBar');

            if (data.checkedIn) {
                box.className = "status-box status-safe";
                emoji.innerText = "✅";
                title.innerText = "今日已签到";
                desc.innerText = "老人目前安全";
                
                details.style.display = "block";
                document.getElementById('dateVal').innerText = data.today;
                document.getElementById('timeVal').innerText = data.data.time.split(' ')[1];
                
                if (data.data.location) {
                    document.getElementById('locRow').style.display = "flex";
                    document.getElementById('mapLink').href = "https://uri.amap.com/marker?position=" + data.data.location.lng + "," + data.data.location.lat;
                } else {
                    document.getElementById('locRow').style.display = "none";
                }
            } else {
                const isLate = data.currentHour >= data.remindHour;
                if (isLate) {
                    box.className = "status-box status-danger";
                    emoji.innerText = "⚠️";
                    title.innerText = "警报：未签到";
                    desc.innerText = "已经超过规定时间";
                    alert.style.display = "block";
                } else {
                    box.className = "status-box status-waiting";
                    emoji.innerText = "⏰";
                    title.innerText = "等待签到";
                    desc.innerText = "今天还未签到，通常在 18:00 前完成";
                }
            }
        }

        window.onload = fetchStatus;
        setInterval(fetchStatus, 30000); // 30秒刷新一次
    </script>
</body>
</html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
