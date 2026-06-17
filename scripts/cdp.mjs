// Minimal Chrome DevTools Protocol reader for the running Electron app.
// Usage:
//   node scripts/cdp.mjs list                     -> list debuggable targets
//   node scripts/cdp.mjs watch [titleSubstr] [ms] -> stream console logs/errors
//   node scripts/cdp.mjs eval  [titleSubstr] "<jsExpr>"  -> evaluate JS in a target
//
// Requires the app launched with --remote-debugging-port=9222 (enabled in dev).
const PORT = 9222
const [, , cmd = 'list', arg1, arg2] = process.argv

async function targets() {
    const res = await fetch(`http://localhost:${PORT}/json`)
    return res.json()
}

function pickTarget(list, sub) {
    const pages = list.filter(t => t.type === 'page' || t.type === 'webview')
    if (!sub) return pages[0]
    return pages.find(t => (t.title + ' ' + t.url).toLowerCase().includes(sub.toLowerCase())) || pages[0]
}

function connect(wsUrl) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl)
        ws.onopen = () => resolve(ws)
        ws.onerror = e => reject(new Error('ws error: ' + (e.message || e)))
    })
}

let msgId = 1
function send(ws, method, params = {}) {
    return new Promise(resolve => {
        const id = msgId++
        const onMsg = ev => {
            const m = JSON.parse(ev.data)
            if (m.id === id) { ws.removeEventListener('message', onMsg); resolve(m) }
        }
        ws.addEventListener('message', onMsg)
        ws.send(JSON.stringify({ id, method, params }))
    })
}

function fmtArg(a) {
    if (a == null) return String(a)
    if (a.type === 'string') return a.value
    if ('value' in a) return JSON.stringify(a.value)
    if (a.description) return a.description
    return a.type
}

const list = await targets()

if (cmd === 'list') {
    for (const t of list) console.log(`[${t.type}] ${t.title} :: ${t.url}\n   ${t.webSocketDebuggerUrl || '(no ws)'}`)
    process.exit(0)
}

const t = pickTarget(list, arg1)
if (!t || !t.webSocketDebuggerUrl) { console.error('No matching debuggable target.'); process.exit(1) }
console.error(`>> attached to [${t.type}] ${t.title} :: ${t.url}`)
const ws = await connect(t.webSocketDebuggerUrl)

if (cmd === 'eval') {
    await send(ws, 'Runtime.enable')
    const r = await send(ws, 'Runtime.evaluate', { expression: arg2, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) console.log('EXCEPTION:', JSON.stringify(r.result.exceptionDetails.exception, null, 2))
    else console.log('RESULT:', JSON.stringify(r.result?.result?.value, null, 2))
    ws.close(); process.exit(0)
}

if (cmd === 'watch') {
    const ms = Number(arg2) || 20000
    ws.addEventListener('message', ev => {
        const m = JSON.parse(ev.data)
        if (m.method === 'Runtime.consoleAPICalled') {
            const a = m.params.args.map(fmtArg).join(' ')
            console.log(`[${m.params.type}] ${a}`)
        } else if (m.method === 'Runtime.exceptionThrown') {
            const e = m.params.exceptionDetails
            console.log(`[EXCEPTION] ${e.exception?.description || e.text}`)
        } else if (m.method === 'Log.entryAdded') {
            const e = m.params.entry
            console.log(`[log:${e.level}] ${e.text}  ${e.url || ''}`)
        }
    })
    await send(ws, 'Runtime.enable')
    await send(ws, 'Log.enable')
    console.error(`>> watching console for ${ms}ms ...`)
    setTimeout(() => { ws.close(); process.exit(0) }, ms)
}
