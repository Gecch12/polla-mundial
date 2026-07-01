/**
 * Polla Mundial 2026 - Gmail -> GitHub -> Netlify automation
 *
 * PRODUCCION:
 * - Busca el ULTIMO correo valido de Beto con Excel.
 * - Valido si subject contiene POLLA y contiene PUNTAJES o PRUEBA.
 * - Si el ultimo correo valido ya fue publicado, no hace nada.
 * - Si es nuevo, sube latest.xlsx + email.json + historial a GitHub.
 * - Lanza GitHub Action.
 * - Si el workflow termina OK, marca el messageId como publicado y envia correo a Beto.
 */

const CONFIG = {
  gmailQuery: 'from:betoramost@hotmail.com has:attachment filename:xlsx newer_than:10d subject:polla -subject:"web actualizada"',

  githubOwner: 'Gecch12',
  githubRepo: 'polla-mundial',
  githubBranch: 'main',

  // PEGA AQUI TU TOKEN. No lo compartas por chat.
  githubToken: 'PEGA_AQUI_TU_TOKEN',

  workflowFile: 'update-polla.yml',
  siteUrl: 'https://fwc26polla-mundial.netlify.app',
  triggerMinutes: 10,

  // En produccion dejar true. En pruebas puedes poner false si no quieres enviar correos.
  sendConfirmationEmail: true
};

function installTrigger() {
  deleteTriggers();
  ScriptApp.newTrigger('checkPollaEmail')
    .timeBased()
    .everyMinutes(CONFIG.triggerMinutes)
    .create();
  Logger.log('OK: trigger instalado cada ' + CONFIG.triggerMinutes + ' minutos.');
}

function deleteTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log('OK: triggers eliminados.');
}

function checkPollaEmail() {
  validateConfig_();

  const latest = findLatestValidEmail_();
  if (!latest) {
    Logger.log('Nada nuevo: no se encontro correo valido de Beto con Excel.');
    return;
  }

  const publishedId = getPublishedMessageId_();
  if (publishedId && publishedId === latest.msg.getId()) {
    Logger.log('Nada nuevo: el ultimo correo valido ya esta publicado.');
    Logger.log('Ultimo publicado: ' + latest.msg.getSubject());
    return;
  }

  Logger.log('Procesando: ' + latest.msg.getSubject());
  Logger.log('Fecha: ' + latest.msg.getDate());

  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  const shortId = latest.msg.getId().slice(-16).replace(/[^a-zA-Z0-9_-]/g, '');

  const emailJson = buildEmailJson_(latest.msg, latest.attachment);
  const xlsxBytes = latest.attachment.getBytes();

  uploadToGitHub_('inbox/latest.xlsx', xlsxBytes, 'Gmail: update latest Polla Excel');
  Logger.log('Subido a GitHub: inbox/latest.xlsx');

  uploadToGitHub_('inbox/email.json', JSON.stringify(emailJson, null, 2), 'Gmail: update latest Polla email');
  Logger.log('Subido a GitHub: inbox/email.json');

  uploadToGitHub_('inbox/history/' + timestamp + '_' + shortId + '.xlsx', xlsxBytes, 'Gmail: archive Polla Excel');
  Logger.log('Subido a GitHub: inbox/history/' + timestamp + '_' + shortId + '.xlsx');

  uploadToGitHub_('inbox/history/' + timestamp + '_' + shortId + '.json', JSON.stringify(emailJson, null, 2), 'Gmail: archive Polla email');
  Logger.log('Subido a GitHub: inbox/history/' + timestamp + '_' + shortId + '.json');

  const runId = dispatchWorkflow_();
  Logger.log('GitHub Action lanzada.');

  const result = waitForWorkflow_(runId, 8 * 60 * 1000);
  Logger.log('GitHub Action run ' + runId + ': ' + result.status + '/' + result.conclusion);

  if (result.status === 'completed' && result.conclusion === 'success') {
    setPublishedMessageId_(latest.msg.getId());
    if (CONFIG.sendConfirmationEmail) {
      sendConfirmation_(latest.msg, latest.attachment);
    }
    Logger.log('OK: web actualizada y correo de confirmacion enviado.');
  } else {
    throw new Error('GitHub Action no termino OK: ' + result.status + '/' + result.conclusion);
  }
}

function findLatestValidEmail_() {
  const threads = GmailApp.search(CONFIG.gmailQuery, 0, 50);
  const candidates = [];

  threads.forEach(thread => {
    thread.getMessages().forEach(msg => {
      const subject = String(msg.getSubject() || '');
      const subjectLower = normalize_(subject);
      const fromEmail = extractEmail_(msg.getFrom()).toLowerCase();

      if (fromEmail !== 'betoramost@hotmail.com') return;
      if (subjectLower.includes('web actualizada')) return;
      if (!subjectLower.includes('polla')) return;

      const isRealUpdate = subjectLower.includes('puntajes');
      const isTestUpdate = subjectLower.includes('prueba');
      if (!isRealUpdate && !isTestUpdate) return;

      const attachments = msg.getAttachments({
        includeInlineImages: false,
        includeAttachments: true
      }).filter(a => /\.xlsx$/i.test(a.getName()));

      if (!attachments.length) return;

      attachments.sort((a, b) => b.getBytes().length - a.getBytes().length);

      candidates.push({
        msg: msg,
        attachment: attachments[0],
        date: msg.getDate(),
        subject: subject
      });
    });
  });

  if (!candidates.length) return null;

  candidates.sort((a, b) => b.date.getTime() - a.date.getTime());

  Logger.log('Ultimo correo valido encontrado: ' + candidates[0].subject);
  Logger.log('Fecha: ' + candidates[0].date);
  Logger.log('Adjunto: ' + candidates[0].attachment.getName());

  return candidates[0];
}

function buildEmailJson_(msg, attachment) {
  return {
    messageId: msg.getId(),
    threadId: msg.getThread().getId(),
    subject: msg.getSubject(),
    from: msg.getFrom(),
    fromEmail: extractEmail_(msg.getFrom()),
    to: msg.getTo(),
    cc: msg.getCc(),
    date: msg.getDate().toISOString(),
    bodyPlain: msg.getPlainBody(),
    bodyHtml: msg.getBody(),
    attachmentName: attachment.getName(),
    processedAt: new Date().toISOString(),
    siteUrl: CONFIG.siteUrl
  };
}

function dispatchWorkflow_() {
  const before = listRecentWorkflowRuns_();
  const beforeIds = {};
  before.forEach(r => beforeIds[String(r.id)] = true);

  const url = githubApiUrl_('/repos/' + CONFIG.githubOwner + '/' + CONFIG.githubRepo + '/actions/workflows/' + encodeURIComponent(CONFIG.workflowFile) + '/dispatches');
  const payload = {
    ref: CONFIG.githubBranch
  };

  githubFetch_(url, {
    method: 'post',
    payload: JSON.stringify(payload),
    contentType: 'application/json',
    expectedCodes: [204]
  });

  const start = Date.now();
  while (Date.now() - start < 60000) {
    Utilities.sleep(3000);
    const after = listRecentWorkflowRuns_();
    for (const run of after) {
      if (!beforeIds[String(run.id)] && run.name === 'Update Polla from Gmail') {
        return run.id;
      }
    }
    if (after.length && after[0].event === 'workflow_dispatch') {
      return after[0].id;
    }
  }

  throw new Error('No se pudo identificar el GitHub Action run nuevo.');
}

function waitForWorkflow_(runId, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const run = getWorkflowRun_(runId);
    Logger.log('GitHub Action run ' + runId + ': ' + run.status + '/' + (run.conclusion || 'sin conclusion'));
    if (run.status === 'completed') {
      return {
        status: run.status,
        conclusion: run.conclusion
      };
    }
    Utilities.sleep(15000);
  }
  throw new Error('Timeout esperando GitHub Action run ' + runId);
}

function listRecentWorkflowRuns_() {
  const url = githubApiUrl_('/repos/' + CONFIG.githubOwner + '/' + CONFIG.githubRepo + '/actions/workflows/' + encodeURIComponent(CONFIG.workflowFile) + '/runs?branch=' + encodeURIComponent(CONFIG.githubBranch) + '&per_page=10');
  const res = githubFetch_(url, { method: 'get', expectedCodes: [200] });
  return JSON.parse(res.getContentText()).workflow_runs || [];
}

function getWorkflowRun_(runId) {
  const url = githubApiUrl_('/repos/' + CONFIG.githubOwner + '/' + CONFIG.githubRepo + '/actions/runs/' + runId);
  const res = githubFetch_(url, { method: 'get', expectedCodes: [200] });
  return JSON.parse(res.getContentText());
}

function uploadToGitHub_(path, content, message) {
  const url = githubApiUrl_('/repos/' + CONFIG.githubOwner + '/' + CONFIG.githubRepo + '/contents/' + encodeURIComponentPath_(path));
  let sha = null;

  const getRes = UrlFetchApp.fetch(url + '?ref=' + encodeURIComponent(CONFIG.githubBranch), {
    method: 'get',
    muteHttpExceptions: true,
    headers: githubHeaders_()
  });

  if (getRes.getResponseCode() === 200) {
    sha = JSON.parse(getRes.getContentText()).sha;
  } else if (getRes.getResponseCode() !== 404) {
    throw new Error('Error consultando archivo GitHub ' + path + ': ' + getRes.getResponseCode() + ' ' + getRes.getContentText());
  }

  const bytes = typeof content === 'string' ? Utilities.newBlob(content, 'text/plain').getBytes() : content;
  const payload = {
    message: message,
    content: Utilities.base64Encode(bytes),
    branch: CONFIG.githubBranch
  };
  if (sha) payload.sha = sha;

  githubFetch_(url, {
    method: 'put',
    payload: JSON.stringify(payload),
    contentType: 'application/json',
    expectedCodes: [200, 201]
  });
}

function sendConfirmation_(msg, attachment) {
  const to = extractEmail_(msg.getFrom());
  const body = [
    'web actualizada',
    '',
    'Archivo procesado: ' + attachment.getName(),
    'Correo: ' + msg.getSubject(),
    'Web: ' + CONFIG.siteUrl,
    '',
    'Confirmacion automatica.'
  ].join('\n');

  GmailApp.sendEmail(to, 'web actualizada', body, {
    replyTo: Session.getActiveUser().getEmail()
  });
}

function getPublishedMessageId_() {
  return PropertiesService.getScriptProperties().getProperty('PUBLISHED_MESSAGE_ID') || '';
}

function setPublishedMessageId_(messageId) {
  PropertiesService.getScriptProperties().setProperty('PUBLISHED_MESSAGE_ID', messageId);
}

function clearPublishedMessageId_FOR_TEST_ONLY() {
  PropertiesService.getScriptProperties().deleteProperty('PUBLISHED_MESSAGE_ID');
  Logger.log('Checkpoint eliminado. Usar solo para pruebas.');
}

function debugLatestValidEmail() {
  const latest = findLatestValidEmail_();
  if (!latest) {
    Logger.log('No se encontro correo valido.');
    return;
  }
  Logger.log('Subject: ' + latest.msg.getSubject());
  Logger.log('Date: ' + latest.msg.getDate());
  Logger.log('MessageId: ' + latest.msg.getId());
  Logger.log('Attachment: ' + latest.attachment.getName());
  Logger.log('PublishedMessageId: ' + getPublishedMessageId_());
}

function markLatestAsPublished_FOR_RECOVERY_ONLY() {
  const latest = findLatestValidEmail_();
  if (!latest) throw new Error('No hay correo valido para marcar.');
  setPublishedMessageId_(latest.msg.getId());
  Logger.log('Marcado como publicado: ' + latest.msg.getSubject());
}

function validateConfig_() {
  if (!CONFIG.githubToken || CONFIG.githubToken === 'PEGA_AQUI_TU_TOKEN') {
    throw new Error('Falta CONFIG.githubToken. Pegalo en Code.gs dentro de Apps Script.');
  }
  if (!CONFIG.githubOwner || !CONFIG.githubRepo || !CONFIG.githubBranch) {
    throw new Error('Faltan datos GitHub en CONFIG.');
  }
}

function githubApiUrl_(path) {
  return 'https://api.github.com' + path;
}

function githubHeaders_() {
  return {
    Authorization: 'Bearer ' + CONFIG.githubToken,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

function githubFetch_(url, options) {
  options = options || {};
  const expected = options.expectedCodes || [200];
  const fetchOptions = {
    method: options.method || 'get',
    muteHttpExceptions: true,
    headers: githubHeaders_()
  };

  if (options.payload !== undefined) fetchOptions.payload = options.payload;
  if (options.contentType) fetchOptions.contentType = options.contentType;

  const res = UrlFetchApp.fetch(url, fetchOptions);
  const code = res.getResponseCode();
  if (!expected.includes(code)) {
    throw new Error('GitHub API error ' + code + ' en ' + url + ': ' + res.getContentText());
  }
  return res;
}

function extractEmail_(fromValue) {
  const s = String(fromValue || '');
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim();
}

function normalize_(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function encodeURIComponentPath_(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}
