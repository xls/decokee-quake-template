/*
 * RemoteScreenWindow — the fullscreen content window shown ON the QUAKE panel.
 *
 * The QUAKE presents itself to the OS as an HDMI monitor labelled "DK-QUAKE"
 * (1920x480 landscape / 480x1920 portrait). Lighting the panel is two parts:
 *   1. the HID watchdog keep-alive keeps the backlight powered (see HIDManager
 *      / the quake-device package), and
 *   2. a borderless window placed on that display renders the actual content.
 *
 * This window covers the DK-QUAKE display's bounds. The page it loads is the
 * canvas to build the real on-device UI on; for now it shows a minimal status
 * screen so the full pipeline (backlight + HDMI content) is visible.
 */
import { BrowserWindow, screen } from 'electron';

const QUAKE_DISPLAY_LABEL = 'DK-QUAKE';

/** A display is the QUAKE if it carries the DK-QUAKE label or its native size. */
function isQuakeDisplay(display) {
    if (display.label === QUAKE_DISPLAY_LABEL) return true;
    const { width, height } = display.size;
    return (width === 1920 && height === 480) || (width === 480 && height === 1920);
}

/** Find the OS display that belongs to the QUAKE panel, if connected. */
export function findQuakeDisplay() {
    return screen.getAllDisplays().find(isQuakeDisplay);
}

/** Build the data: URL for the on-panel content (the canvas to replace later). */
function buildContentUrl({ width, height, version }) {
    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
  body { font-family: system-ui, sans-serif; color: #fff; }
  .center { position: absolute; inset: 0; display: flex; flex-direction: column;
            align-items: center; justify-content: center; }
  .title { font-size: 64px; font-weight: 700; letter-spacing: 8px; }
  .meta { margin-top: 10px; font-size: 20px; color: #6cf; }
  .clock { margin-top: 14px; font-size: 34px; font-variant-numeric: tabular-nums; }
  .debug { position: absolute; left: 16px; bottom: 12px; right: 16px;
           font-family: ui-monospace, Consolas, monospace; font-size: 18px; line-height: 1.5; }
  .debug .knob { color: #9f9; }
  .debug .touch { color: #6cf; }
  .debug .report { color: #fc6; opacity: .9; }
  .dot { position: absolute; width: 44px; height: 44px; margin: -22px 0 0 -22px;
         border-radius: 50%; opacity: 0; transition: opacity .12s;
         pointer-events: none; display: flex; align-items: center;
         justify-content: center; font: 700 18px ui-monospace, monospace; color: #000; }
</style>
</head>
<body>
  <div class="center">
    <div class="title">DK&middot;QUAKE</div>
    <div class="meta">${width}&times;${height}${version ? ' &middot; fw ' + version : ''}</div>
    <div class="clock" id="clock"></div>
  </div>
  <div id="dots"></div>
  <div class="debug">
    <div class="knob" id="knob">knob: --</div>
    <div class="touch" id="touch">touch: --</div>
    <div class="report" id="report">report: --</div>
  </div>
  <script>
    var NATIVE_W = ${width >= height ? 1920 : 480}, NATIVE_H = ${width >= height ? 480 : 1920};
    function tick() {
      document.getElementById('clock').textContent = new Date().toLocaleTimeString();
    }
    tick(); setInterval(tick, 1000);

    var COLORS = ['108,200,255', '255,150,108', '150,255,140', '255,220,90',
                  '220,140,255', '255,120,200', '120,255,230', '200,200,200'];
    var dotsBox = document.getElementById('dots'), dotPool = [], hideT, knobTotal = 0;

    function getDot(i) {
      if (!dotPool[i]) {
        var d = document.createElement('div');
        d.className = 'dot';
        var c = COLORS[i % COLORS.length];
        d.style.background = 'rgba(' + c + ',.85)';
        d.style.boxShadow = '0 0 24px rgba(' + c + ',.9)';
        d.textContent = i + 1;
        dotsBox.appendChild(d);
        dotPool[i] = d;
      }
      return dotPool[i];
    }

    // Multi-touch: render every active point. Coordinates are panel native
    // pixels; Y origin is bottom-up so flip it to the screen's top-down space.
    window.__quakeTouch = function (points) {
      points = points || [];
      for (var i = 0; i < dotPool.length; i++) dotPool[i].style.opacity = 0;
      var parts = [];
      for (var j = 0; j < points.length; j++) {
        var p = points[j], d = getDot(j);
        d.style.left = (p.x / NATIVE_W * window.innerWidth) + 'px';
        d.style.top = ((1 - p.y / NATIVE_H) * window.innerHeight) + 'px';
        d.style.opacity = 1;
        parts.push('#' + (j + 1) + ' ' + p.x + ',' + p.y + ' a' + p.action);
      }
      document.getElementById('touch').textContent =
        'touch: ' + points.length + ' pt  ' + parts.join('   ');
      clearTimeout(hideT);
      hideT = setTimeout(function () {
        for (var k = 0; k < dotPool.length; k++) dotPool[k].style.opacity = 0;
      }, 800);
    };

    // Raw report feed: shows the knob (with rotation value + running total) and
    // every other report the device sends.
    window.__quakeReport = function (r) {
      var data = '[' + (r.subData || []).join(',') + ']';
      if (r.opCode === 3 && r.cmdID === 1) {
        var dir = r.subData[0] === 1 ? 1 : -1;
        knobTotal += dir;
        document.getElementById('knob').textContent =
          'knob: ' + (dir > 0 ? 'CW' : 'CCW') + '  step=' + dir + '  total=' + knobTotal + '  raw=' + data;
      } else if (r.opCode === 3 && r.cmdID === 2) {
        document.getElementById('knob').textContent = 'knob: PRESS  raw=' + data;
      }
      document.getElementById('report').textContent =
        'report: op=0x' + r.opCode.toString(16) + ' cmd=' + r.cmdID + ' data=' + data;
    };
  </script>
</body>
</html>`;
    return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

class RemoteScreenWindow {
    constructor(appManager) {
        this.appManager = appManager;
        this.win = null;
    }

    /** Open (or reposition) the content window on the QUAKE display. */
    open(meta = {}) {
        const display = findQuakeDisplay();
        if (!display) {
            console.warn('RemoteScreenWindow: no DK-QUAKE display detected; skipping');
            return;
        }

        const { x, y, width, height } = display.bounds;

        if (this.win) {
            this.win.setBounds(display.bounds);
            return;
        }

        this.win = new BrowserWindow({
            x,
            y,
            width,
            height,
            frame: false,
            resizable: false,
            movable: false,
            minimizable: false,
            maximizable: false,
            skipTaskbar: true,
            backgroundColor: '#000000',
            show: true,
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
            },
        });

        // Pin exactly to the display bounds (x/y in the constructor can be
        // clamped before the window exists).
        this.win.setBounds(display.bounds);
        this.win.loadURL(buildContentUrl({ width, height, version: meta.version }));

        this.win.webContents.on('did-finish-load', () => {
            if (this.win) {
                this.win.setBounds(display.bounds);
                this.win.show();
                console.log('RemoteScreenWindow: content loaded and shown');
            }
        });
        this.win.webContents.on('did-fail-load', (e, code, desc) => {
            console.error(`RemoteScreenWindow: content failed to load: ${code} ${desc}`);
        });
        this.win.on('closed', () => {
            this.win = null;
        });

        console.log(
            `RemoteScreenWindow: opened on display ${display.id} (${display.label || 'unlabelled'}) ${width}x${height} at ${x},${y}`
        );
    }

    /** Call a global handler in the on-panel page, ignoring errors. */
    _call(fn, arg) {
        if (!this.win || this.win.isDestroyed()) return;
        this.win.webContents
            .executeJavaScript(`window.${fn} && window.${fn}(${JSON.stringify(arg)})`)
            .catch(() => {});
    }

    /** Forward touch points (panel native pixels) to the page. */
    pushTouch(points) {
        this._call('__quakeTouch', points);
    }

    /** Forward a raw device report ({opCode, cmdID, subData}) to the page. */
    pushReport(report) {
        this._call('__quakeReport', report);
    }

    close() {
        if (!this.win) return;
        this.win.removeAllListeners('closed');
        try {
            this.win.close();
        } catch (e) {
            // ignore
        }
        this.win = null;
    }
}

export default RemoteScreenWindow;
