/**
 * Polla Mundial 2026 - Gmail -> GitHub -> Netlify automation
 *
 * USO:
 * 1) Pegar TODO este archivo en Apps Script reemplazando myFunction().
 * 2) Editar CONFIG.githubToken con tu token de GitHub.
 * 3) Ejecutar installTrigger() una vez y aceptar permisos.
 * 4) Ejecutar checkPollaEmail() una vez para test.
 *
 * Qué hace:
 * - Busca cada 10 minutos el correo más reciente con Excel.
 * - Sube inbox/latest.xlsx + inbox/email.json al repo.
 * - Lanza GitHub Action update-polla.yml.
 * - Espera a que GitHub Action termine.
 * - Si termina OK, envía SOLO al remitente un correo: "web actualizada".
 * - No procesa dos veces el mismo correo.
 */

const CONFIG = {
  // Ajustar si el correo real de Beto no aparece con esta búsqueda.
  // Tip: también puedes usar from:correo@dominio.com si lo quieres exacto.
  gmailQuery: 'from:betoramost@hotmail.com has:attachment filename:xlsx newer_than:10d subject:polla subject:puntajes -subject:"web actualizada"',
  githubOwner: 'Gecch12',
  githubRepo: 'polla-mundial',
  githubBranch: 'main',

  // PEGA AQUÍ TU TOKEN. No lo compartas por chat.
  githubToken: 'code',

  workflowFile: 'update-polla.yml',
  triggerMinutes: 10,

  // Web pública. Se incluye en el correo de confirmación.
  siteUrl: 'https://fwc26polla-mundial.netlify.app',

  // AUTO_SENDER = envía confirmación solo al remitente del correo procesado.
  // Si quieres forzarlo, cambia por el correo exacto de Beto, por ejemplo: 'beto@email.com'
  confirmationTo: 'AUTO_SENDER',

  // Máximo de espera para confirmar que GitHub Action terminó.
  maxWorkflowWaitSeconds: 300,
  pollEverySeconds: 15
};

function installTrigger() {
  deleteExistingTriggers_('checkPollaEmail');
  ScriptApp.newTrigger('checkPollaEmail')
    .timeBased()
    .everyMinutes(CONFIG.triggerMinutes)
    .create();
  Logger.log('OK: trigger instalado cada ' + CONFIG.triggerMinutes + ' minutos.');
}

function uninstallTrigger() {
  deleteExistingTriggers_('checkPollaEmail');
  Logger.log('OK: trigger eliminado.');
}

function checkPollaEmail() {
  validateConfig_();

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log('Otro proceso está corriendo. Se omite esta ejecución.');
    return;
  }

  try {
    const item = findLatestUnprocessedEmail_();
    if (!item) {
      Logger.log('No hay correos nuevos para procesar.');
      return;
    }

    const msg = item.msg;
    const attachment = item.attachment;
    const messageId = msg.getId();
    const now = new Date();
    const runStartedAt = now.toISOString();
    const stamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    const safeMessageId = sanitizePath_(messageId).slice(0, 80);

    const emailPayload = buildEmailPayload_(msg, attachment, stamp);

    Logger.log('Procesando: ' + emailPayload.subject);

    // Archivos latest usados por Python.
    putGitHubFile_('inbox/latest.xlsx', attachment.getBytes(), 'Gmail: update latest Polla Excel', false);
    putGitHubFile_('inbox/email.json', JSON.stringify(emailPayload, null, 2), 'Gmail: update latest Polla email', true);

    // Historial para auditoría.
    putGitHubFile_('inbox/history/' + stamp + '_' + safeMessageId + '.xlsx', attachment.getBytes(), 'Gmail: archive Polla Excel', false);
    putGitHubFile_('inbox/history/' + stamp + '_' + safeMessageId + '.json', JSON.stringify(emailPayload, null, 2), 'Gmail: archive Polla email', true);

    dispatchWorkflow_();
    const result = waitForWorkflow_(runStartedAt);

    if (result.success) {
      markProcessed_(messageId);
      sendConfirmationEmail_(msg, emailPayload, result);
      Logger.log('OK: web actualizada y correo de confirmación enviado.');
    } else {
      throw new Error('GitHub Action no terminó correctamente: ' + result.message);
    }
  } finally {
    lock.releaseLock();
  }
}

function findLatestUnprocessedEmail_() {
  const processed = getProcessedMap_();
  const threads = GmailApp.search(CONFIG.gmailQuery, 0, 50);
  const candidates = [];

  threads.forEach(thread => {
    thread.getMessages().forEach(msg => {
      const subject = String(msg.getSubject() || '').toLowerCase();
      const fromEmail = extractEmail_(msg.getFrom()).toLowerCase();

      if (processed[msg.getId()]) return;
      if (fromEmail !== 'betoramost@hotmail.com') return;
      if (!subject.includes('polla')) return;
      if (!subject.includes('puntajes')) return;
      if (subject.includes('web actualizada')) return;

      const atts = msg.getAttachments({
        includeInlineImages: false,
        includeAttachments: true
      }).filter(a => /\.xlsx$/i.test(a.getName()));

      if (!atts.length) return;

      atts.sort((a, b) => b.getBytes().length - a.getBytes().length);

      candidates.push({
        msg: msg,
        attachment: atts[0],
        date: msg.getDate()
      });
    });
  });

  if (!candidates.length) return null;

  candidates.sort((a, b) => b.date.getTime() - a.date.getTime());

  Logger.log('Último correo válido encontrado: ' + candidates[0].msg.getSubject());
  Logger.log('Fecha: ' + candidates[0].msg.getDate());

  return candidates[0];
}

function buildEmailPayload_(msg, attachment, stamp) {
  return {
    messageId: msg.getId(),
    threadId: msg.getThread().getId(),
    subject: msg.getSubject(),
    from: msg.getFrom(),
    fromEmail: extractEmail_(msg.getFrom()),
    to: msg.getTo(),
    cc: msg.getCc(),
    sent: Utilities.formatDate(msg.getDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
    processedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
    attachment: attachment.getName(),
    archiveStamp: stamp,
    bodyText: cleanBody_(msg.getPlainBody())
  };
}

function sendConfirmationEmail_(originalMsg, emailPayload, workflowResult) {
  const to = CONFIG.confirmationTo === 'AUTO_SENDER'
    ? extractEmail_(originalMsg.getFrom())
    : CONFIG.confirmationTo;

  if (!to) {
    Logger.log('No se encontró email de confirmación. Se omite envío.');
    return;
  }

  const subject = 'web actualizada';
  const body = [
    'web actualizada',
    '',
    'Archivo procesado: ' + (emailPayload.attachment || ''),
    'Correo: ' + (emailPayload.subject || ''),
    'Web: ' + CONFIG.siteUrl,
    '',
    'Confirmación automática.'
  ].join('\n');

  MailApp.sendEmail({
    to: to,
    subject: subject,
    body: body,
    noReply: true
  });
}

function dispatchWorkflow_() {
  const url = githubApi_('/actions/workflows/' + encodeURIComponent(CONFIG.workflowFile) + '/dispatches');
  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: githubHeaders_(),
    contentType: 'application/json',
    payload: JSON.stringify({ref: CONFIG.githubBranch}),
    muteHttpExceptions: true
  });

  const code = resp.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('No se pudo lanzar GitHub Action: HTTP ' + code + ' - ' + resp.getContentText());
  }
  Logger.log('GitHub Action lanzada.');
}

function waitForWorkflow_(startedAtIso) {
  const deadline = Date.now() + CONFIG.maxWorkflowWaitSeconds * 1000;
  let seenRunId = null;
  let lastStatus = 'esperando creación del run';

  while (Date.now() < deadline) {
    Utilities.sleep(CONFIG.pollEverySeconds * 1000);
    const runs = listWorkflowRuns_();

    const run = runs.find(r => {
      return r.event === 'workflow_dispatch' &&
        r.head_branch === CONFIG.githubBranch &&
        new Date(r.created_at).getTime() >= new Date(startedAtIso).getTime() - 60000;
    });

    if (!run) {
      Logger.log('Esperando run de GitHub Action...');
      continue;
    }

    seenRunId = run.id;
    lastStatus = run.status + '/' + (run.conclusion || 'sin conclusión');
    Logger.log('GitHub Action run ' + seenRunId + ': ' + lastStatus);

    if (run.status === 'completed') {
      if (run.conclusion === 'success') {
        return {success: true, runId: seenRunId, url: run.html_url, message: 'success'};
      }
      return {success: false, runId: seenRunId, url: run.html_url, message: run.conclusion};
    }
  }

  return {success: false, runId: seenRunId, url: '', message: 'timeout: ' + lastStatus};
}

function listWorkflowRuns_() {
  const url = githubApi_('/actions/workflows/' + encodeURIComponent(CONFIG.workflowFile) + '/runs?branch=' + encodeURIComponent(CONFIG.githubBranch) + '&per_page=10');
  const resp = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: githubHeaders_(),
    muteHttpExceptions: true
  });
  const code = resp.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('No se pudo leer GitHub Actions: HTTP ' + code + ' - ' + resp.getContentText());
  }
  return JSON.parse(resp.getContentText()).workflow_runs || [];
}

function putGitHubFile_(path, content, message, isText) {
  const url = githubApi_('/contents/' + path.split('/').map(encodeURIComponent).join('/'));
  let sha = null;

  const getResp = UrlFetchApp.fetch(url + '?ref=' + encodeURIComponent(CONFIG.githubBranch), {
    method: 'get',
    headers: githubHeaders_(),
    muteHttpExceptions: true
  });

  if (getResp.getResponseCode() === 200) {
    sha = JSON.parse(getResp.getContentText()).sha;
  } else if (getResp.getResponseCode() !== 404) {
    throw new Error('No se pudo verificar archivo GitHub ' + path + ': ' + getResp.getContentText());
  }

  const bytes = isText ? Utilities.newBlob(String(content), 'text/plain', 'payload.txt').getBytes() : content;
  const payload = {
    message: message,
    content: Utilities.base64Encode(bytes),
    branch: CONFIG.githubBranch
  };
  if (sha) payload.sha = sha;

  const putResp = UrlFetchApp.fetch(url, {
    method: 'put',
    headers: githubHeaders_(),
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = putResp.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('No se pudo subir ' + path + ': HTTP ' + code + ' - ' + putResp.getContentText());
  }

  Logger.log('Subido a GitHub: ' + path);
}

function githubApi_(suffix) {
  return 'https://api.github.com/repos/' + CONFIG.githubOwner + '/' + CONFIG.githubRepo + suffix;
}

function githubHeaders_() {
  return {
    Authorization: 'Bearer ' + CONFIG.githubToken,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'polla-mundial-apps-script'
  };
}

function getProcessedMap_() {
  return JSON.parse(PropertiesService.getScriptProperties().getProperty('processedMessageIds') || '{}');
}

function markProcessed_(messageId) {
  const processed = getProcessedMap_();
  processed[messageId] = new Date().toISOString();

  // Evita que PropertiesService crezca infinito.
  const entries = Object.entries(processed)
    .sort((a, b) => String(b[1]).localeCompare(String(a[1])))
    .slice(0, 500);
  PropertiesService.getScriptProperties().setProperty('processedMessageIds', JSON.stringify(Object.fromEntries(entries)));
}

function cleanBody_(body) {
  return String(body || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function extractEmail_(fromValue) {
  const s = String(fromValue || '');
  const angle = s.match(/<([^>]+)>/);
  if (angle) return angle[1].trim();
  const plain = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return plain ? plain[0].trim() : '';
}

function sanitizePath_(s) {
  return String(s || '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function deleteExistingTriggers_(functionName) {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === functionName) ScriptApp.deleteTrigger(trigger);
  });
}

function validateConfig_() {
  if (!CONFIG.githubToken || CONFIG.githubToken === 'PEGA_AQUI_TU_TOKEN') {
    throw new Error('Falta pegar CONFIG.githubToken.');
  }
  if (!CONFIG.githubOwner || !CONFIG.githubRepo) {
    throw new Error('Falta githubOwner/githubRepo.');
  }
}

// Utilidad opcional para resetear pruebas. No usar en producción salvo que quieras reprocesar correos.
function clearProcessedCache_FOR_TEST_ONLY() {
  PropertiesService.getScriptProperties().deleteProperty('processedMessageIds');
  Logger.log('Cache de mensajes procesados eliminada.');
}
