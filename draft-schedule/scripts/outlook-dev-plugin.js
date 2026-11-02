import { spawn } from 'node:child_process'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { fileURLToPath } from 'node:url'
import { buildReviewRequestBody, getReviewRecipients, REVIEW_REQUEST_SUBJECT } from '../src/utils/reviewRequestMail.js'

// Local Windows development only: never expose Outlook automation to remote clients.
export default function outlookDevPlugin() {
  let busy = false
  return {
    name: 'local-outlook-draft',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/local-outlook/draft', async (req, res) => {
        const reply = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)) }
        const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
        let origin
        try { origin = new URL(req.headers.origin) } catch { /* Deny absent or malformed origins. */ }
        if (!local || !origin || !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) || origin.host !== req.headers.host || origin.protocol !== 'http:') return reply(403, { error: '로컬 PGMDR에서만 호출할 수 있습니다.' })
        if (req.method !== 'POST' || !req.headers['content-type']?.startsWith('application/json')) return reply(405, { error: 'JSON POST 요청만 지원합니다.' })
        if (process.platform !== 'win32') return reply(503, { error: 'Windows 클래식 Outlook이 필요합니다.' })
        if (busy) return reply(409, { error: 'Outlook 작성창을 여는 중입니다. 잠시 기다려주세요.' })
        busy = true
        try {
          const chunks = []
          let size = 0
          for await (const chunk of req) {
            size += chunk.length
            if (size > 1024 * 1024) { reply(413, { error: '선택한 PGM이 너무 많습니다.' }); return }
            chunks.push(chunk)
          }
          const { rows } = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          if (!Array.isArray(rows) || !rows.length || rows.length > 1000 || rows.some(row => !row || typeof row !== 'object' || !['신상품', '재녹화'].includes(row.newProductType))) return reply(400, { error: '대상 PGM을 확인해주세요.' })
          const { html } = buildReviewRequestBody(rows)
          const recipients = getReviewRecipients(rows)
          const result = await new Promise((resolve, reject) => {
            const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-File', fileURLToPath(new URL('./open-outlook-draft.ps1', import.meta.url))], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
            let stderr = ''
            let stdout = ''
            child.stderr.on('data', chunk => { stderr += chunk.toString() })
            child.stdout.on('data', chunk => { stdout += chunk.toString() })
            child.stdin.on('error', () => {})
            child.on('error', reject)
            const timer = setTimeout(() => { child.kill(); reject(new Error('Outlook 응답 시간이 초과됐습니다. 로그인창이나 회사 보안 안내를 확인하고, 이미 작성창이 열렸는지 확인해주세요.')) }, 60000)
            child.on('close', code => {
              clearTimeout(timer)
              if (code !== 0) return reject(new Error(stderr.trim() || 'Outlook 작성창을 열지 못했습니다.'))
              try { resolve(JSON.parse(stdout.trim())) } catch { reject(new Error('Outlook 처리 결과를 확인하지 못했습니다. 작성창을 확인해주세요.')) }
            })
            child.stdin.end(JSON.stringify({ subject: REVIEW_REQUEST_SUBJECT, html, recipients }), 'utf8')
          })
          reply(200, { ok: true, warning: result.unresolved?.length ? `주소록에서 확인되지 않은 수신자가 있습니다. Outlook에서 확인해주세요: ${result.unresolved.join('; ')}` : '' })
        } catch (error) {
          reply(500, { error: error.message || 'Outlook 연결에 실패했습니다.' })
        } finally {
          busy = false
        }
      })
    },
  }
}
