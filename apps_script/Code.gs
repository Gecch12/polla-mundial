/**
 * Polla Gmail -> GitHub automation
 * 1) Put this file in script.google.com
 * 2) Fill CONFIG
 * 3) Run installTrigger() once
 * 4) Run checkPollaEmail() once to authorize/test
 */

const CONFIG = {
  // Gmail search. Adjust sender terms if needed.
  gmailQuery: 'has:attachment filename:xlsx newer_than:3d (from:beto OR from:vete OR "Beto Ramos" OR "PUNTAJES")',

  // GitHub repo where the Netlify site lives.
  githubOwner: 'REPLACE_WITH_OWNER',
  githubRepo: 'REPLACE_WITH_REPO',
  githubBranch: 'main',

  // Create a fine-grained GitHub token with Contents: Read/Write and Actions: Read/Write.
  githubToken: 'REPLACE_WITH_GITHUB_TOKEN',

  // Workflow file in .github/workflows/update-polla.yml
  workflowFile: 'update-polla.yml',

  // Optional: Netlify build hook. Leave blank if Netlify deploys automatically on GitHub commits.
  netlifyBuildHook: '',

  // Trigger interval. Apps Script UI supports every 10 minutes.
  triggerMinutes: 10
};

function installTrigger() {
  deleteExistingTriggers_('checkPollaEmail');
  ScriptApp.newTrigger('checkPollaEmail')
    .timeBased()
    .everyMinutes(CONFIG.triggerMinutes)
    .create();
  Logger.log('Trigger installed: every ' + CONFIG.triggerMinutes + ' minutes');
}

function checkPollaEmail() {
  const props = PropertiesService.getScriptProperties();
  const processed = JSON.parse(props.getProperty('processedMessageIds') || '{}');
  const threads = GmailApp.search(CONFIG.gmailQuery, 0, 10);

  let candidates = [];
  threads.forEach(thread => {
    thread.getMessages().forEach(msg => {
      const attachments = msg.getAttachments({includeInlineImages: false, includeAttachments: true})
        .filter(a => /\.xlsx$/i.test(a.getName()));
      if (attachments.length > 0 && !processed[msg.getId()]) {
        candidates.push({msg, attachment: attachments[attachments.length - 1]});
      }
    });
  });

  if (candidates.length === 0) {
    Logger.log('No new Polla email found.');
    return;
  }

  candidates.sort((a, b) => b.msg.getDate().getTime() - a.msg.getDate().getTime());
  const item = candidates[0];
  const msg = item.msg;
  const xlsx = item.attachment;

  const emailPayload = {
    messageId: msg.getId(),
    threadId: msg.getThread().getId(),
    subject: msg.getSubject(),
    from: msg.getFrom(),
    sent: Utilities.formatDate(msg.getDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
    attachment: xlsx.getName(),
    bodyText: cleanBody_(msg.getPlainBody())
  };

  putGitHubFile_('inbox/latest.xlsx', xlsx.getBytes(), 'Update latest Polla Excel from Gmail', false);
  putGitHubFile_('inbox/email.json', JSON.stringify(emailPayload, null, 2), 'Update latest Polla email metadata', true);
  dispatchWorkflow_();

  if (CONFIG.netlifyBuildHook) {
    UrlFetchApp.fetch(CONFIG.netlifyBuildHook, {method: 'post', muteHttpExceptions: true});
  }

  processed[msg.getId()] = new Date().toISOString();
  props.setProperty('processedMessageIds', JSON.stringify(processed));
  Logger.log('Processed message: ' + msg.getSubject());
}

function putGitHubFile_(path, content, message, isText) {
  const url = `https://api.github.com/repos/${CONFIG.githubOwner}/${CONFIG.githubRepo}/contents/${path}`;
  let sha = null;

  const getResp = UrlFetchApp.fetch(url + '?ref=' + encodeURIComponent(CONFIG.githubBranch), {
    method: 'get',
    headers: githubHeaders_(),
    muteHttpExceptions: true
  });
  if (getResp.getResponseCode() === 200) {
    sha = JSON.parse(getResp.getContentText()).sha;
  }

  const bytes = isText ? Utilities.newBlob(content).getBytes() : content;
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

  if (putResp.getResponseCode() < 200 || putResp.getResponseCode() >= 300) {
    throw new Error('GitHub upload failed for ' + path + ': ' + putResp.getContentText());
  }
}

function dispatchWorkflow_() {
  const url = `https://api.github.com/repos/${CONFIG.githubOwner}/${CONFIG.githubRepo}/actions/workflows/${CONFIG.workflowFile}/dispatches`;
  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: githubHeaders_(),
    contentType: 'application/json',
    payload: JSON.stringify({ref: CONFIG.githubBranch}),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() < 200 || resp.getResponseCode() >= 300) {
    throw new Error('Workflow dispatch failed: ' + resp.getContentText());
  }
}

function githubHeaders_() {
  return {
    Authorization: 'Bearer ' + CONFIG.githubToken,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

function cleanBody_(body) {
  return String(body || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function deleteExistingTriggers_(functionName) {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === functionName) ScriptApp.deleteTrigger(trigger);
  });
}
