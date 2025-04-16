const express = require('express');
const { promisify } = require('util');
const { exec: execCb } = require('child_process');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const exec = promisify(execCb);
const ytDlpPath = 'yt-dlp';
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);

// Directory where your 45 cookie files live
const cookiesDir = path.join(__dirname, 'youtube‑cookies');

// Helper: get all cookie files
function getCookieFiles() {
  return fs.readdirSync(cookiesDir)
    .filter(f => f.match(/^youtube-cookies-\d+\.txt$/))
    .map(f => path.join(cookiesDir, f));
}

// Helper: detect cookie-related errors
function isCookieError(err, stderr = '') {
  const msg = (err.message + stderr).toLowerCase();
  return msg.includes('unable to load cookies')
      || msg.includes('cookie')
      || msg.includes('certificate')
      || msg.includes('403')
      || msg.includes('forbidden');
}

/**
 * Try running a yt-dlp command with each cookie file in turn.
 * On cookie error, delete the bad cookie and retry with the next.
 */
async function runWithRotatingCookies(commandBuilder) {
  let cookies = getCookieFiles();  
  for (const cookiePath of cookies) {
    const cmd = commandBuilder(cookiePath);
    try {
      const { stdout, stderr } = await exec(cmd);
      return { stdout, stderr };           // success!
    } catch (err) {
      if (isCookieError(err, err.stderr)) {
        // delete the bad cookie so we won't pick it again
        fs.unlinkSync(cookiePath);
        console.warn(`Deleted bad cookie file: ${cookiePath}`);
        continue;                          // try next cookie
      }
      throw err;                           // non-cookie error → bail out
    }
  }
  throw new Error('No valid cookie files remaining');
}

//— generic handler creator —//
function makeDownloadHandler(formatArgs, mergeArgs = '') {
  return async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing "url".' });

    const outName = `${formatArgs.type}-${Date.now()}.${formatArgs.ext}`;
    const outputFilePath = path.join(downloadsDir, outName);

    try {
      // build & run the command with rotating cookies
      await runWithRotatingCookies(cookiePath => {
        return `${ytDlpPath} --no-check-certificate ` +
               `--cookies "${cookiePath}" ` +
               `${formatArgs.ytDlpArgs} ${mergeArgs} ` +
               `-o "${outputFilePath}" "${url}"`;
      });

      // tiny delay to ensure file is flushed
      setTimeout(() => {
        if (!fs.existsSync(outputFilePath)) {
          return res.status(500).json({ error: 'File not found after download.' });
        }
        res.download(outputFilePath, err => {
          if (err) console.error('Download error:', err);
        });
      }, 2000);

    } catch (err) {
      console.error('Download failed:', err);
      res.status(500).json({ error: err.message });
    }
  };
}

// Wire up your three endpoints
app.post(
  '/download',
  makeDownloadHandler(
    { type: 'video', ext: 'mp4', ytDlpArgs: '-f "bestvideo+bestaudio/best"' },
    '--merge-output-format mp4'
  )
);

app.post(
  '/download-audio',
  makeDownloadHandler(
    { type: 'audio', ext: 'mp3', ytDlpArgs: '-x --audio-format mp3' }
  )
);

app.post(
  '/download-video-only',
  makeDownloadHandler(
    { type: 'video-only', ext: 'mp4', ytDlpArgs: '-f "bestvideo[ext=mp4]"' }
  )
);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
